import { readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";
import { renderDeckToImages } from "@/lib/ppt-renderer";
import {
  type ReadDeckResponse,
  type UploadedDeckSession,
  type UploadedSlideContext,
} from "@/lib/upload-contract";

export const runtime = "nodejs";

const uploadRootDirectory = path.join(process.cwd(), ".slideroom", "uploads");
const deckIdPattern = /^deck-[a-f0-9]{8}$/i;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isUploadedSlideContext(value: unknown): value is UploadedSlideContext {
  if (!isRecord(value)) return false;

  return (
    typeof value.pageNumber === "number" &&
    Number.isFinite(value.pageNumber) &&
    value.pageNumber >= 1 &&
    typeof value.extractedText === "string" &&
    (typeof value.imageUrl === "undefined" || typeof value.imageUrl === "string") &&
    (typeof value.thumbnailUrl === "undefined" || typeof value.thumbnailUrl === "string") &&
    (typeof value.aspectRatio === "undefined" ||
      (typeof value.aspectRatio === "number" && Number.isFinite(value.aspectRatio) && value.aspectRatio > 0)) &&
    typeof value.speakerNotes === "string"
  );
}

function isUploadedDeckSession(value: unknown, deckId: string): value is UploadedDeckSession {
  if (!isRecord(value)) return false;

  return (
    value.deckId === deckId &&
    typeof value.fileName === "string" &&
    typeof value.originalFileName === "string" &&
    typeof value.pageCount === "number" &&
    Number.isFinite(value.pageCount) &&
    value.pageCount >= 1 &&
    Array.isArray(value.slides) &&
    value.slides.every(isUploadedSlideContext) &&
    typeof value.size === "number" &&
    Number.isFinite(value.size) &&
    (typeof value.renderStatus === "undefined" ||
      value.renderStatus === "rendered" ||
      value.renderStatus === "unavailable" ||
      value.renderStatus === "failed") &&
    value.status === "uploaded" &&
    typeof value.storageKey === "string" &&
    typeof value.uploadedAt === "number" &&
    Number.isFinite(value.uploadedAt) &&
    (value.inspectionStatus === "parsed" || value.inspectionStatus === "unsupported" || value.inspectionStatus === "failed")
  );
}

function hasRenderedSlideImages(session: UploadedDeckSession) {
  return session.slides.some((slide) => typeof slide.imageUrl === "string" && slide.imageUrl.trim().length > 0);
}

async function findStoredDeckFile(deckDirectory: string, session: UploadedDeckSession) {
  const storageFileName = path.basename(session.storageKey);
  if (storageFileName && storageFileName !== "." && storageFileName !== path.sep) {
    return path.join(deckDirectory, storageFileName);
  }

  const files = await readdir(deckDirectory);
  const deckFile = files.find((file) => /\.pptx?$/i.test(file));
  return deckFile ? path.join(deckDirectory, deckFile) : null;
}

async function hydrateRenderedSlides(
  deckDirectory: string,
  metadataPath: string,
  session: UploadedDeckSession,
) {
  if (hasRenderedSlideImages(session) || session.renderStatus === "unavailable" || session.renderStatus === "failed") {
    return session;
  }

  try {
    const storedDeckFile = await findStoredDeckFile(deckDirectory, session);
    if (!storedDeckFile) return session;

    const renderedDeck = await renderDeckToImages({
      deckId: session.deckId,
      inputPath: storedDeckFile,
      outputDirectory: path.join(deckDirectory, "slides"),
    });
    const renderedImagesByPageNumber = new Map(renderedDeck.images.map((image) => [image.pageNumber, image]));
    const pageCount = Math.max(session.pageCount, renderedDeck.images.length || 0);
    const slides = Array.from({ length: pageCount }, (_, index) => {
      const pageNumber = index + 1;
      const slideContext = session.slides.find((slide) => slide.pageNumber === pageNumber);
      const renderedImage = renderedImagesByPageNumber.get(pageNumber);

      return {
        pageNumber,
        extractedText: slideContext?.extractedText ?? "",
        imageUrl: renderedImage?.imageUrl ?? slideContext?.imageUrl,
        thumbnailUrl: renderedImage?.thumbnailUrl ?? slideContext?.thumbnailUrl,
        aspectRatio: renderedImage?.aspectRatio ?? slideContext?.aspectRatio,
        speakerNotes: slideContext?.speakerNotes ?? "",
      };
    });
    const nextSession: UploadedDeckSession = {
      ...session,
      pageCount,
      renderStatus: renderedDeck.status,
      slides,
    };

    if (renderedDeck.status === "rendered" || renderedDeck.status === "unavailable" || renderedDeck.status === "failed") {
      await writeFile(metadataPath, JSON.stringify(nextSession, null, 2), "utf8");
    }

    return nextSession;
  } catch {
    const failedSession = {
      ...session,
      renderStatus: "failed" as const,
    };

    try {
      await writeFile(metadataPath, JSON.stringify(failedSession, null, 2), "utf8");
    } catch {
      // Persisting the failed render state is best-effort.
    }

    return failedSession;
  }
}

function deckError(message: string, status = 404) {
  return NextResponse.json(
    {
      message,
      ok: false,
    } satisfies ReadDeckResponse,
    { status },
  );
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ deckId?: string }> },
) {
  const { deckId = "" } = await params;

  if (!deckIdPattern.test(deckId)) {
    return deckError("Deck not found.");
  }

  try {
    const deckDirectory = path.join(uploadRootDirectory, deckId);
    const metadataPath = path.join(deckDirectory, "metadata.json");
    const metadata = JSON.parse(await readFile(metadataPath, "utf8")) as unknown;

    if (!isUploadedDeckSession(metadata, deckId)) {
      return deckError("Deck metadata is invalid.", 422);
    }

    const hydratedSession = await hydrateRenderedSlides(deckDirectory, metadataPath, metadata);

    return NextResponse.json(
      {
        ok: true,
        session: hydratedSession,
      } satisfies ReadDeckResponse,
    );
  } catch {
    return deckError("Deck not found.");
  }
}
