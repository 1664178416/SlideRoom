import { normalizeDeckFileName } from "@/lib/deck-display";
import type { DeckContextQuality } from "@/lib/upload-contract";

export type RecentDeckStatus = "processing" | "ready";

export type RecentDeck = {
  contextQuality?: DeckContextQuality;
  deckId: string;
  fileName: string;
  openedAt: number;
  speakerNotesSlideCount?: number;
  slideCount: number;
  status: RecentDeckStatus;
  textSlideCount?: number;
};

type RecentDeckInput = {
  contextQuality?: DeckContextQuality;
  deckId: string;
  fileName: string;
  openedAt?: number;
  speakerNotesSlideCount?: number;
  slideCount?: number;
  status?: RecentDeckStatus;
  textSlideCount?: number;
};

const recentDecksStorageKey = "slideroom-recent-decks-v1";
const maxRecentDecks = 6;

function isDeckContextQuality(value: unknown): value is DeckContextQuality {
  return value === "failed" || value === "parsed" || value === "partial" || value === "preview_only";
}

function sanitizeSlideCount(value: unknown, fallback = 0) {
  return Math.max(0, Math.round(typeof value === "number" && Number.isFinite(value) ? value : fallback));
}

function isRecentDeck(value: unknown): value is RecentDeck {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return false;

  const candidate = value as Partial<RecentDeck>;
  return (
    typeof candidate.deckId === "string" &&
    typeof candidate.fileName === "string" &&
    typeof candidate.openedAt === "number" &&
    typeof candidate.slideCount === "number" &&
    (candidate.status === "processing" || candidate.status === "ready")
  );
}

function getRecentDeckKey(deck: Pick<RecentDeck, "deckId" | "fileName">) {
  return `${deck.deckId.trim().toLowerCase()}:${normalizeDeckFileName(deck.fileName).toLowerCase()}`;
}

function mergeRecentDeck(existingDeck: RecentDeck, incomingDeck: RecentDeck): RecentDeck {
  const primaryDeck = incomingDeck.openedAt >= existingDeck.openedAt ? incomingDeck : existingDeck;
  const secondaryDeck = primaryDeck === incomingDeck ? existingDeck : incomingDeck;
  const slideCount = primaryDeck.slideCount || secondaryDeck.slideCount;
  const contextQuality = primaryDeck.contextQuality ?? secondaryDeck.contextQuality;
  const hasPrimaryContextStats =
    primaryDeck.speakerNotesSlideCount !== undefined || primaryDeck.textSlideCount !== undefined;
  const speakerNotesSlideCount = hasPrimaryContextStats
    ? primaryDeck.speakerNotesSlideCount
    : secondaryDeck.speakerNotesSlideCount;
  const textSlideCount = hasPrimaryContextStats ? primaryDeck.textSlideCount : secondaryDeck.textSlideCount;

  return {
    ...primaryDeck,
    ...(contextQuality ? { contextQuality } : {}),
    ...(speakerNotesSlideCount !== undefined
      ? { speakerNotesSlideCount: Math.min(slideCount, speakerNotesSlideCount) }
      : {}),
    slideCount,
    ...(textSlideCount !== undefined ? { textSlideCount: Math.min(slideCount, textSlideCount) } : {}),
  };
}

function sanitizeRecentDeck(deck: RecentDeckInput): RecentDeck | null {
  const deckId = deck.deckId.trim();
  const fileName = normalizeDeckFileName(deck.fileName);
  const slideCount = sanitizeSlideCount(deck.slideCount);
  const textSlideCount = sanitizeSlideCount(deck.textSlideCount);
  const speakerNotesSlideCount = sanitizeSlideCount(deck.speakerNotesSlideCount);

  if (!deckId || !fileName) return null;

  return {
    ...(isDeckContextQuality(deck.contextQuality) ? { contextQuality: deck.contextQuality } : {}),
    deckId,
    fileName,
    openedAt: Math.min(Date.now(), Math.max(0, deck.openedAt ?? Date.now())),
    ...(deck.speakerNotesSlideCount !== undefined ? { speakerNotesSlideCount: Math.min(slideCount, speakerNotesSlideCount) } : {}),
    slideCount,
    status: deck.status === "processing" ? "processing" : "ready",
    ...(deck.textSlideCount !== undefined ? { textSlideCount: Math.min(slideCount, textSlideCount) } : {}),
  };
}

function normalizeRecentDecks(decks: RecentDeckInput[]) {
  const dedupedDecks = new Map<string, RecentDeck>();

  decks.forEach((deck) => {
    const sanitizedDeck = sanitizeRecentDeck(deck);
    if (!sanitizedDeck) return;

    const deckKey = getRecentDeckKey(sanitizedDeck);
    const existingDeck = dedupedDecks.get(deckKey);

    if (!existingDeck) {
      dedupedDecks.set(deckKey, sanitizedDeck);
    } else {
      dedupedDecks.set(deckKey, mergeRecentDeck(existingDeck, sanitizedDeck));
    }
  });

  return [...dedupedDecks.values()]
    .sort((leftDeck, rightDeck) => rightDeck.openedAt - leftDeck.openedAt)
    .slice(0, maxRecentDecks);
}

function writeRecentDecks(decks: RecentDeck[]) {
  if (typeof window === "undefined") return;

  try {
    window.localStorage.setItem(recentDecksStorageKey, JSON.stringify(normalizeRecentDecks(decks)));
  } catch {
    // Storage can fail in private mode or when quota is exhausted.
  }
}

export function readRecentDecks() {
  if (typeof window === "undefined") return [];

  try {
    const storedDecks = window.localStorage.getItem(recentDecksStorageKey);
    if (!storedDecks) return [];

    const parsedDecks = JSON.parse(storedDecks) as unknown;
    if (!Array.isArray(parsedDecks)) return [];

    return normalizeRecentDecks(parsedDecks.filter(isRecentDeck));
  } catch {
    return [];
  }
}

export function upsertRecentDeck(deck: RecentDeckInput) {
  if (typeof window === "undefined") return null;

  const sanitizedDeck = sanitizeRecentDeck(deck);
  if (!sanitizedDeck) return null;

  const nextDecks = normalizeRecentDecks([
    sanitizedDeck,
    ...readRecentDecks().filter((recentDeck) => getRecentDeckKey(recentDeck) !== getRecentDeckKey(sanitizedDeck)),
  ]);

  writeRecentDecks(nextDecks);

  return sanitizedDeck;
}

export function clearRecentDecks() {
  if (typeof window === "undefined") return;

  try {
    window.localStorage.removeItem(recentDecksStorageKey);
  } catch {
    // Storage can fail in private mode or constrained environments.
  }
}
