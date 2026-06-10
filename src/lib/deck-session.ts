import { normalizeDeckFileName } from "@/lib/deck-display";
import {
  type DeckInspectionStatus,
  type UploadedDeckSession,
  type UploadedSlideContext,
} from "@/lib/upload-contract";

const deckSessionsStorageKey = "slideroom-deck-sessions-v1";
const maxStoredDeckSessions = 6;
const maxStoredExtractedTextLength = 1600;
const maxStoredSpeakerNotesLength = 2200;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isInspectionStatus(value: unknown): value is DeckInspectionStatus {
  return value === "parsed" || value === "unsupported" || value === "failed";
}

function clipStoredText(value: string, maxLength: number) {
  return value.trim().slice(0, maxLength);
}

function sanitizeSlides(value: unknown): UploadedSlideContext[] {
  if (!Array.isArray(value)) return [];

  return value
    .reduce<UploadedSlideContext[]>((items, slide) => {
      if (!isRecord(slide) || typeof slide.pageNumber !== "number") return items;

      const pageNumber = Math.max(1, Math.round(slide.pageNumber));

      items.push({
        pageNumber,
        aspectRatio:
          typeof slide.aspectRatio === "number" && Number.isFinite(slide.aspectRatio) && slide.aspectRatio > 0
            ? slide.aspectRatio
            : undefined,
        extractedText:
          typeof slide.extractedText === "string"
            ? clipStoredText(slide.extractedText, maxStoredExtractedTextLength)
            : "",
        imageUrl: typeof slide.imageUrl === "string" ? slide.imageUrl : undefined,
        speakerNotes:
          typeof slide.speakerNotes === "string"
            ? clipStoredText(slide.speakerNotes, maxStoredSpeakerNotesLength)
            : "",
        thumbnailUrl: typeof slide.thumbnailUrl === "string" ? slide.thumbnailUrl : undefined,
      });

      return items;
    }, [])
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
    renderAttemptedAt:
      typeof value.renderAttemptedAt === "number" && Number.isFinite(value.renderAttemptedAt) && value.renderAttemptedAt >= 0
        ? value.renderAttemptedAt
        : undefined,
    renderStatus:
      value.renderStatus === "rendered" || value.renderStatus === "unavailable" || value.renderStatus === "failed"
        ? value.renderStatus
        : undefined,
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

function getStorageLightSession(session: UploadedDeckSession): UploadedDeckSession {
  return {
    ...session,
    slides: session.slides.map((slide) => ({
      pageNumber: slide.pageNumber,
      ...(slide.aspectRatio ? { aspectRatio: slide.aspectRatio } : {}),
      extractedText: "",
      ...(slide.imageUrl ? { imageUrl: slide.imageUrl } : {}),
      speakerNotes: "",
      ...(slide.thumbnailUrl ? { thumbnailUrl: slide.thumbnailUrl } : {}),
    })),
  };
}

function writeDeckSessionMap(sessions: Map<string, UploadedDeckSession>) {
  if (typeof window === "undefined") return;

  const normalizedSessions = [...sessions.values()]
    .map(sanitizeUploadedDeckSession)
    .filter((session): session is UploadedDeckSession => Boolean(session))
    .sort((left, right) => right.uploadedAt - left.uploadedAt)
    .slice(0, maxStoredDeckSessions);

  try {
    window.localStorage.setItem(deckSessionsStorageKey, JSON.stringify(normalizedSessions));
  } catch {
    try {
      window.localStorage.setItem(
        deckSessionsStorageKey,
        JSON.stringify(normalizedSessions.slice(0, 3).map(getStorageLightSession)),
      );
    } catch {
      // Storage can fail in private mode or when quota is exhausted.
    }
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
