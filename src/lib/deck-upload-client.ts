import { syncUploadedDeckSession } from "@/lib/deck-session";
import {
  type UploadDeckErrorCode,
  type UploadDeckResponse,
  type UploadedDeckSession,
} from "@/lib/upload-contract";

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

export async function uploadDeckFile(file: File): Promise<UploadedDeckSession> {
  const formData = new FormData();

  formData.set("file", file);

  const response = await fetch("/api/decks/upload", {
    body: formData,
    method: "POST",
  });
  const result = (await response.json()) as UploadDeckResponse;

  if (!result.ok) {
    throw new UploadDeckFileError(result.errorCode, result.message);
  }

  return result.session;
}

export async function uploadAndSyncDeckFile(file: File) {
  return syncUploadedDeckSession(await uploadDeckFile(file));
}
