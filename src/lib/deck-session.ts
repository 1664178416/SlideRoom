import { normalizeDeckFileName } from "@/lib/deck-display";
import {
  type DeckInspectionStatus,
  type UploadedDeckSession,
  type UploadedSlideContext,
} from "@/lib/upload-contract";

const deckSessionsStorageKey = "slideroom-deck-sessions-v1";
const maxStoredDeckSessions = 10;
const maxStoredSlideTextLength = 6000;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isInspectionStatus(value: unknown): value is DeckInspectionStatus {
  return value === "parsed" || value === "unsupported" || value === "failed";
}

function clipStoredText(value: string) {
  return value.trim().slice(0, maxStoredSlideTextLength);
}

function sanitizeSlides(value: unknown): UploadedSlideContext[] {
  if (!Array.isArray(value)) return [];

  return value
    .map((slide) => {
      if (!isRecord(slide) || typeof slide.pageNumber !== "number") return null;

      const pageNumber = Math.max(1, Math.round(slide.pageNumber));

      return {
        pageNumber,
        extractedText: typeof slide.extractedText === "string" ? clipStoredText(slide.extractedText) : "",
        speakerNotes: typeof slide.speakerNotes === "string" ? clipStoredText(slide.speakerNotes) : "",
      };
    })
    .filter((slide): slide is UploadedSlideContext => Boolean(slide))
    .sort((left, right) => left.pageNumber - right.pageNumber);
}

function sanitizeUploadedDeckSession(value: unknown): UploadedDeckSession | null {
  if (!isRecord(value)) return null;

  const deckId = typeof value.deckId === "string" ? value.deckId.trim() : "";
  const fileName = typeof value.fileName === "string" ? normalizeDeckFileName(value.fileName) : "";
  const originalFileName = typeof value.originalFileName === "string" ? normalizeDeckFileName(value.originalFileName) : fileName;
  const slides = sanitizeSlides(value.slides);
  const pageCount = Math.max(1, Math.round(typeof value.pageCount === "number" ? value.pageCount : slides.length || 1));

  if (!deckId || !fileName) return null;

  return {
    deckId,
    fileName,
    inspectionStatus: isInspectionStatus(value.inspectionStatus) ? value.inspectionStatus : "unsupported",
    originalFileName,
    pageCount,
    slides,
    size: Math.max(0, Math.round(typeof value.size === "number" ? value.size : 0)),
    status: "uploaded",
    storageKey: typeof value.storageKey === "string" ? value.storageKey : "",
    uploadedAt: Math.min(Date.now(), Math.max(0, typeof value.uploadedAt === "number" ? value.uploadedAt : Date.now())),
  };
}

function readDeckSessionMap() {
  if (typeof window === "undefined") return new Map<string, UploadedDeckSession>();

  try {
    const storedSessions = window.localStorage.getItem(deckSessionsStorageKey);
    if (!storedSessions) return new Map<string, UploadedDeckSession>();

    const parsedSessions = JSON.parse(storedSessions) as unknown;
    if (!Array.isArray(parsedSessions)) return new Map<string, UploadedDeckSession>();

    return new Map(
      parsedSessions
        .map(sanitizeUploadedDeckSession)
        .filter((session): session is UploadedDeckSession => Boolean(session))
        .map((session) => [session.deckId, session]),
    );
  } catch {
    return new Map<string, UploadedDeckSession>();
  }
}

function writeDeckSessionMap(sessions: Map<string, UploadedDeckSession>) {
  if (typeof window === "undefined") return;

  try {
    const normalizedSessions = [...sessions.values()]
      .map(sanitizeUploadedDeckSession)
      .filter((session): session is UploadedDeckSession => Boolean(session))
      .sort((left, right) => right.uploadedAt - left.uploadedAt)
      .slice(0, maxStoredDeckSessions);

    window.localStorage.setItem(deckSessionsStorageKey, JSON.stringify(normalizedSessions));
  } catch {
    // Storage can fail in private mode or when quota is exhausted.
  }
}

export function writeUploadedDeckSession(session: UploadedDeckSession) {
  if (typeof window === "undefined") return null;

  const sanitizedSession = sanitizeUploadedDeckSession(session);
  if (!sanitizedSession) return null;

  const sessions = readDeckSessionMap();
  sessions.set(sanitizedSession.deckId, sanitizedSession);
  writeDeckSessionMap(sessions);

  return sanitizedSession;
}

export function readUploadedDeckSession(deckId: string) {
  if (!deckId) return null;

  return readDeckSessionMap().get(deckId) ?? null;
}
