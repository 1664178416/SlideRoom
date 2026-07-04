import { syncUploadedDeckSession } from "@/lib/deck-session";
import { isDemoDeckId } from "@/lib/mock-data";
import type { ProcessingSession } from "@/lib/processing-session";
import {
  isUploadedDeckSession,
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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parseReadDeckResponse(value: unknown): ReadDeckResponse {
  if (!isRecord(value) || typeof value.ok !== "boolean") {
    return {
      message: "Deck metadata is unavailable.",
      ok: false,
    };
  }

  if (value.ok) {
    if (!isUploadedDeckSession(value.session)) {
      return {
        message: "Deck metadata is invalid.",
        ok: false,
      };
    }

    return {
      ok: true,
      session: value.session,
    };
  }

  return {
    message: typeof value.message === "string" && value.message.trim() ? value.message : "Deck metadata is unavailable.",
    ok: false,
  };
}

async function readDeckResponse(response: Response) {
  try {
    return parseReadDeckResponse(await response.json());
  } catch {
    return {
      message: "Deck metadata is unavailable.",
      ok: false,
    } satisfies ReadDeckResponse;
  }
}

export async function fetchUploadedDeckSession(deckId: string) {
  if (isDemoDeckId(deckId)) return null;

  let response: Response;

  try {
    response = await fetch(`/api/decks/${encodeURIComponent(deckId)}`);
  } catch {
    return null;
  }

  const result = await readDeckResponse(response);

  if (!result.ok) return null;
  return result.session;
}

export async function fetchAndSyncUploadedDeckSession(deckId: string) {
  const session = await fetchUploadedDeckSession(deckId);

  return session ? syncUploadedDeckSession(session) : null;
}
