import { randomUUID } from "node:crypto";
import { mkdir, readdir, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";
import { getDeckFileStem, normalizeDeckFileName } from "@/lib/deck-display";
import { deckMeta } from "@/lib/mock-data";
import { inspectPptx } from "@/lib/pptx-inspector";
import { renderDeckToImages } from "@/lib/ppt-renderer";
import {
  isSupportedDeckFileName,
  maxUploadFileSizeBytes,
  type UploadDeckErrorCode,
  type UploadDeckResponse,
  type UploadedDeckSession,
} from "@/lib/upload-contract";

export const runtime = "nodejs";

const uploadRootDirectory = path.join(process.cwd(), ".slideroom", "uploads");
const maxStoredUploadDirectories = 24;
const deckDirectoryPattern = /^deck-[a-f0-9]{8}$/i;

function uploadError(errorCode: UploadDeckErrorCode, message: string, status = 400) {
  return NextResponse.json(
    {
      errorCode,
      message,
      ok: false,
    } satisfies UploadDeckResponse,
    { status },
  );
}

function getStoredFileName(deckId: string, fileName: string) {
  const extension = fileName.toLowerCase().endsWith(".ppt") ? ".ppt" : ".pptx";
  const stem = getDeckFileStem(fileName, "deck").replace(/[^a-zA-Z0-9._-]+/g, "-").slice(0, 80) || "deck";

  return `${deckId}-${stem}${extension}`;
}

async function pruneOldUploads() {
  try {
    const entries = await readdir(uploadRootDirectory, { withFileTypes: true });
    const uploadDirectories = await Promise.all(
      entries
        .filter((entry) => entry.isDirectory() && deckDirectoryPattern.test(entry.name))
        .map(async (entry) => {
          const directoryPath = path.join(uploadRootDirectory, entry.name);

          try {
            const directoryStat = await stat(directoryPath);
            return {
              mtimeMs: directoryStat.mtimeMs,
              path: directoryPath,
            };
          } catch {
            return null;
          }
        }),
    );
    const staleDirectories = uploadDirectories
      .filter((directory): directory is { mtimeMs: number; path: string } => Boolean(directory))
      .sort((left, right) => right.mtimeMs - left.mtimeMs)
      .slice(maxStoredUploadDirectories);

    await Promise.all(
      staleDirectories.map((directory) => rm(directory.path, { force: true, recursive: true })),
    );
  } catch {
    // Upload pruning is best-effort and must never block a successful import.
  }
}

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const uploadedFile = formData.get("file");

    if (!(uploadedFile instanceof File)) {
      return uploadError("missing_file", "No PPT file was attached.");
    }

    const fileName = normalizeDeckFileName(uploadedFile.name, deckMeta.fileName);

    if (!isSupportedDeckFileName(fileName)) {
      return uploadError("unsupported_type", "Only .ppt and .pptx files are supported.");
    }

    if (uploadedFile.size <= 0) {
      return uploadError("empty_file", "The uploaded file is empty.");
    }

    if (uploadedFile.size > maxUploadFileSizeBytes) {
      return uploadError("file_too_large", "The uploaded file is larger than the 50 MB local preview limit.", 413);
    }

    const deckId = `deck-${randomUUID().slice(0, 8)}`;
    const uploadedAt = Date.now();
    const deckDirectory = path.join(uploadRootDirectory, deckId);
    const storedFileName = getStoredFileName(deckId, fileName);
    const storageKey = `.slideroom/uploads/${deckId}/${storedFileName}`;
    const fileBytes = Buffer.from(await uploadedFile.arrayBuffer());
    const storedFilePath = path.join(deckDirectory, storedFileName);
    const inspection = fileName.toLowerCase().endsWith(".pptx")
      ? inspectPptx(fileBytes)
      : { inspectionStatus: "unsupported" as const, pageCount: 0, slides: [] };

    await mkdir(deckDirectory, { recursive: true });
    await writeFile(storedFilePath, fileBytes);

    const renderedDeck = await renderDeckToImages({
      deckId,
      inputPath: storedFilePath,
      outputDirectory: path.join(deckDirectory, "slides"),
    });
    const renderedImagesByPageNumber = new Map(renderedDeck.images.map((image) => [image.pageNumber, image]));
    const pageCount = Math.max(1, renderedDeck.images.length || inspection.pageCount || 1);
    const session: UploadedDeckSession = {
      deckId,
      fileName,
      inspectionStatus: inspection.inspectionStatus,
      originalFileName: uploadedFile.name,
      pageCount,
      renderStatus: renderedDeck.status,
      slides: Array.from({ length: pageCount }, (_, index) => {
        const pageNumber = index + 1;
        const slideContext = inspection.slides.find((slide) => slide.pageNumber === pageNumber);
        const renderedImage = renderedImagesByPageNumber.get(pageNumber);

        return {
          pageNumber,
          extractedText: slideContext?.extractedText ?? "",
          imageUrl: renderedImage?.imageUrl,
          thumbnailUrl: renderedImage?.thumbnailUrl,
          aspectRatio: renderedImage?.aspectRatio,
          speakerNotes: slideContext?.speakerNotes ?? "",
        };
      }),
      size: fileBytes.byteLength,
      status: "uploaded",
      storageKey,
      uploadedAt,
    };

    await writeFile(path.join(deckDirectory, "metadata.json"), JSON.stringify(session, null, 2), "utf8");
    await pruneOldUploads();

    return NextResponse.json(
      {
        ok: true,
        session,
      } satisfies UploadDeckResponse,
      { status: 201 },
    );
  } catch {
    return uploadError("upload_failed", "The PPT could not be saved locally.", 500);
  }
}
