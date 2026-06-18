import { syncUploadedDeckSession } from "@/lib/deck-session";
import { isDemoDeckId } from "@/lib/mock-data";
import type { ProcessingSession } from "@/lib/processing-session";
import {
  type ReadDeckResponse,
  type UploadedDeckSession,
} from "@/lib/upload-contract";

export function buildFallbackUploadedDeckSession({
  deckId,
  fileName,
  processingSession,
}: {
  deckId: string;
  fileName: string;
  processingSession: ProcessingSession | null;
}): UploadedDeckSession | null {
  if (isDemoDeckId(deckId)) return null;

  return {
    deckId,
    fileName,
    inspectionStatus: "unsupported",
    originalFileName: fileName,
    pageCount: Math.max(1, processingSession?.pageCount ?? 1),
    slides: [],
    size: 0,
    status: "uploaded",
    storageKey: "",
    uploadedAt: processingSession?.startedAt ?? 0,
  };
}

export async function fetchUploadedDeckSession(deckId: string) {
  if (isDemoDeckId(deckId)) return null;

  const response = await fetch(`/api/decks/${encodeURIComponent(deckId)}`);
  const result = (await response.json()) as ReadDeckResponse;

  if (!result.ok) return null;
  return result.session;
}

export async function fetchAndSyncUploadedDeckSession(deckId: string) {
  const session = await fetchUploadedDeckSession(deckId);

  return session ? syncUploadedDeckSession(session) : null;
}
