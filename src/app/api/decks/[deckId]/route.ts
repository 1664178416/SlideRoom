import { readFile } from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";
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
    value.status === "uploaded" &&
    typeof value.storageKey === "string" &&
    typeof value.uploadedAt === "number" &&
    Number.isFinite(value.uploadedAt) &&
    (value.inspectionStatus === "parsed" || value.inspectionStatus === "unsupported" || value.inspectionStatus === "failed")
  );
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
    const metadataPath = path.join(uploadRootDirectory, deckId, "metadata.json");
    const metadata = JSON.parse(await readFile(metadataPath, "utf8")) as unknown;

    if (!isUploadedDeckSession(metadata, deckId)) {
      return deckError("Deck metadata is invalid.", 422);
    }

    return NextResponse.json(
      {
        ok: true,
        session: metadata,
      } satisfies ReadDeckResponse,
    );
  } catch {
    return deckError("Deck not found.");
  }
}
