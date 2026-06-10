import { normalizeDeckFileName } from "@/lib/deck-display";

export const processingDurationMs = 3600;

export type ProcessingSession = {
  deckId: string;
  fileName: string;
  pageCount?: number;
  startedAt: number;
};

const processingSessionStorageKey = "slideroom-processing-session-v1";
const maxStoredProcessingSessions = 12;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function sanitizeProcessingSession(value: unknown): ProcessingSession | null {
  if (!isRecord(value)) return null;

  const deckId = typeof value.deckId === "string" ? value.deckId.trim() : "";
  const fileName = typeof value.fileName === "string" ? normalizeDeckFileName(value.fileName) : "";
  const startedAt = typeof value.startedAt === "number" && Number.isFinite(value.startedAt) ? value.startedAt : NaN;
  const pageCount =
    typeof value.pageCount === "number" && Number.isFinite(value.pageCount)
      ? Math.max(1, Math.round(value.pageCount))
      : undefined;

  if (!deckId || !fileName || !Number.isFinite(startedAt)) return null;

  return {
    deckId,
    fileName,
    ...(pageCount !== undefined ? { pageCount } : {}),
    startedAt: Math.min(Date.now(), Math.max(0, startedAt)),
  };
}

function normalizeProcessingSessions(sessions: ProcessingSession[]) {
  const sessionsByDeckId = new Map<string, ProcessingSession>();

  sessions.forEach((session) => {
    const sanitizedSession = sanitizeProcessingSession(session);
    if (!sanitizedSession) return;

    const existingSession = sessionsByDeckId.get(sanitizedSession.deckId);
    if (!existingSession || sanitizedSession.startedAt >= existingSession.startedAt) {
      sessionsByDeckId.set(sanitizedSession.deckId, sanitizedSession);
    }
  });

  return [...sessionsByDeckId.values()]
    .sort((left, right) => right.startedAt - left.startedAt)
    .slice(0, maxStoredProcessingSessions);
}

function readProcessingSessions() {
  if (typeof window === "undefined") return [];

  try {
    const storedSessions = window.localStorage.getItem(processingSessionStorageKey);
    if (!storedSessions) return [];

    const parsedSessions = JSON.parse(storedSessions) as unknown;
    const sessionCandidates = Array.isArray(parsedSessions) ? parsedSessions : [parsedSessions];

    return normalizeProcessingSessions(
      sessionCandidates
        .map(sanitizeProcessingSession)
        .filter((session): session is ProcessingSession => Boolean(session)),
    );
  } catch {
    return [];
  }
}

function writeProcessingSessions(sessions: ProcessingSession[]) {
  if (typeof window === "undefined") return;

  const normalizedSessions = normalizeProcessingSessions(sessions);

  try {
    if (normalizedSessions.length === 0) {
      window.localStorage.removeItem(processingSessionStorageKey);
      return;
    }

    window.localStorage.setItem(processingSessionStorageKey, JSON.stringify(normalizedSessions));
  } catch {
    // Storage can fail in private mode or when quota is exhausted.
  }
}

export function isProcessingComplete(startedAt: number, currentTimestamp: number) {
  return currentTimestamp - startedAt >= processingDurationMs;
}

export function writeProcessingSession(session: ProcessingSession) {
  const sanitizedSession = sanitizeProcessingSession(session);
  if (!sanitizedSession) return;

  const nextSessions = [
    sanitizedSession,
    ...readProcessingSessions().filter((storedSession) => storedSession.deckId !== sanitizedSession.deckId),
  ];

  writeProcessingSessions(nextSessions);
}

export function clearProcessingSession(deckId?: string) {
  if (typeof window === "undefined") return;

  try {
    if (!deckId) {
      window.localStorage.removeItem(processingSessionStorageKey);
      return;
    }

    writeProcessingSessions(readProcessingSessions().filter((session) => session.deckId !== deckId));
  } catch {
    // Storage can fail in private mode or constrained environments.
  }
}

export function readProcessingSession(deckId: string) {
  if (!deckId) return null;

  return readProcessingSessions().find((session) => session.deckId === deckId) ?? null;
}
