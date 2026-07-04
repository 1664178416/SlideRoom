import { readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";
import { renderDeckToImages } from "@/lib/ppt-renderer";
import {
  isUploadedDeckSession,
  type ReadDeckResponse,
  type UploadedDeckSession,
} from "@/lib/upload-contract";

export const runtime = "nodejs";

const uploadRootDirectory = path.join(process.cwd(), ".slideroom", "uploads");
const deckIdPattern = /^deck-[a-f0-9]{8}$/i;
const renderRetryCooldownMs = 5 * 60 * 1000;

function hasRenderedSlideImages(session: UploadedDeckSession) {
  return session.slides.some((slide) => typeof slide.imageUrl === "string" && slide.imageUrl.trim().length > 0);
}

function shouldAttemptRender(session: UploadedDeckSession) {
  if (hasRenderedSlideImages(session)) return false;

  const lastAttemptedAt = typeof session.renderAttemptedAt === "number" ? session.renderAttemptedAt : 0;
  return Date.now() - lastAttemptedAt >= renderRetryCooldownMs;
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
  if (!shouldAttemptRender(session)) {
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
      renderAttemptedAt: Date.now(),
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
      renderAttemptedAt: Date.now(),
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

    if (!isUploadedDeckSession(metadata) || metadata.deckId !== deckId) {
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
