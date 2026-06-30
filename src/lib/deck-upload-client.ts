import { syncUploadedDeckSession } from "@/lib/deck-session";
import {
  type UploadDeckErrorCode,
  type UploadDeckResponse,
  type UploadedDeckSession,
} from "@/lib/upload-contract";

const fallbackUploadErrorMessage = "The PPT could not be saved locally.";

export class UploadDeckFileError extends Error {
  errorCode: UploadDeckErrorCode;

  constructor(errorCode: UploadDeckErrorCode, message: string) {
    super(message);
    this.name = "UploadDeckFileError";
    this.errorCode = errorCode;
  }
}

export function isUploadDeckFileError(error: unknown): error is UploadDeckFileError {
  return error instanceof UploadDeckFileError;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isUploadDeckErrorCode(value: unknown): value is UploadDeckErrorCode {
  return (
    value === "missing_file" ||
    value === "unsupported_type" ||
    value === "empty_file" ||
    value === "file_too_large" ||
    value === "upload_failed"
  );
}

function isDeckInspectionStatus(value: unknown) {
  return value === "parsed" || value === "unsupported" || value === "failed";
}

function isUploadedDeckSession(value: unknown): value is UploadedDeckSession {
  return (
    isRecord(value) &&
    typeof value.deckId === "string" &&
    typeof value.fileName === "string" &&
    isDeckInspectionStatus(value.inspectionStatus) &&
    typeof value.originalFileName === "string" &&
    typeof value.pageCount === "number" &&
    Array.isArray(value.slides) &&
    typeof value.size === "number" &&
    value.status === "uploaded" &&
    typeof value.storageKey === "string" &&
    typeof value.uploadedAt === "number"
  );
}

function parseUploadDeckResponse(value: unknown): UploadDeckResponse {
  if (!isRecord(value) || typeof value.ok !== "boolean") {
    throw new UploadDeckFileError("upload_failed", fallbackUploadErrorMessage);
  }

  if (value.ok) {
    if (!isUploadedDeckSession(value.session)) {
      throw new UploadDeckFileError("upload_failed", fallbackUploadErrorMessage);
    }

    return {
      ok: true,
      session: value.session,
    };
  }

  return {
    errorCode: isUploadDeckErrorCode(value.errorCode) ? value.errorCode : "upload_failed",
    message: typeof value.message === "string" && value.message.trim() ? value.message : fallbackUploadErrorMessage,
    ok: false,
  };
}

async function readUploadDeckResponse(response: Response) {
  try {
    return parseUploadDeckResponse(await response.json());
  } catch (error) {
    if (isUploadDeckFileError(error)) throw error;

    throw new UploadDeckFileError("upload_failed", fallbackUploadErrorMessage);
  }
}

export async function uploadDeckFile(file: File): Promise<UploadedDeckSession> {
  const formData = new FormData();

  formData.set("file", file);

  let response: Response;

  try {
    response = await fetch("/api/decks/upload", {
      body: formData,
      method: "POST",
    });
  } catch {
    throw new UploadDeckFileError("upload_failed", fallbackUploadErrorMessage);
  }

  const result = await readUploadDeckResponse(response);

  if (!result.ok) {
    throw new UploadDeckFileError(result.errorCode, result.message);
  }

  return result.session;
}

export async function uploadAndSyncDeckFile(file: File) {
  return syncUploadedDeckSession(await uploadDeckFile(file));
}
