import { normalizeDeckFileName } from "@/lib/deck-display";

export const processingDurationMs = 3600;

export type ProcessingSession = {
  deckId: string;
  fileName: string;
  pageCount?: number;
  startedAt: number;
};

const processingSessionStorageKey = "slideroom-processing-session-v1";

function isProcessingSession(value: unknown): value is ProcessingSession {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return false;

  const candidate = value as Partial<ProcessingSession>;
  return (
    typeof candidate.deckId === "string" &&
    typeof candidate.fileName === "string" &&
    typeof candidate.startedAt === "number" &&
    (typeof candidate.pageCount === "undefined" || typeof candidate.pageCount === "number")
  );
}

function sanitizeProcessingSession(session: ProcessingSession): ProcessingSession {
  return {
    deckId: session.deckId.trim(),
    fileName: normalizeDeckFileName(session.fileName),
    pageCount: typeof session.pageCount === "number" ? Math.max(1, Math.round(session.pageCount)) : undefined,
    startedAt: Math.min(Date.now(), Math.max(0, session.startedAt)),
  };
}

export function isProcessingComplete(startedAt: number, currentTimestamp: number) {
  return currentTimestamp - startedAt >= processingDurationMs;
}

export function writeProcessingSession(session: ProcessingSession) {
  if (typeof window === "undefined") return;

  try {
    window.localStorage.setItem(processingSessionStorageKey, JSON.stringify(sanitizeProcessingSession(session)));
  } catch {
    // Storage can fail in private mode or when quota is exhausted.
  }
}

export function clearProcessingSession(deckId?: string) {
  if (typeof window === "undefined") return;

  try {
    if (!deckId) {
      window.localStorage.removeItem(processingSessionStorageKey);
      return;
    }

    const session = readProcessingSession(deckId);
    if (session) {
      window.localStorage.removeItem(processingSessionStorageKey);
    }
  } catch {
    // Storage can fail in private mode or constrained environments.
  }
}

export function readProcessingSession(deckId: string) {
  if (typeof window === "undefined") return null;

  try {
    const storedSession = window.localStorage.getItem(processingSessionStorageKey);
    if (!storedSession) return null;

    const parsedSession = JSON.parse(storedSession) as unknown;
    if (!isProcessingSession(parsedSession) || parsedSession.deckId !== deckId) return null;

    return sanitizeProcessingSession(parsedSession);
  } catch {
    return null;
  }
}
