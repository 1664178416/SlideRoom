import { normalizeDeckFileName } from "@/lib/deck-display";
import {
  getDeckContextQuality,
  getSlideContextStats,
  type DeckContextQuality,
  type DeckInspectionStatus,
  type SlideContextStats,
} from "@/lib/upload-contract";

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
  deckId?: string;
  fileName?: string;
  openedAt?: number;
  speakerNotesSlideCount?: number;
  slideCount?: number;
  status?: RecentDeckStatus;
  textSlideCount?: number;
};

type RecentDeckContextSlide = {
  extractedText?: string;
  speakerNotes?: string;
};

export type RecentDeckContextSource = {
  contextQuality?: DeckContextQuality;
  contextStats?: SlideContextStats;
  inspectionStatus?: DeckInspectionStatus | null;
  pageCount?: number;
  slides?: RecentDeckContextSlide[];
};

const recentDecksStorageKey = "slideroom-recent-decks-v1";
const maxRecentDecks = 6;

function isDeckContextQuality(value: unknown): value is DeckContextQuality {
  return value === "failed" || value === "parsed" || value === "partial" || value === "preview_only";
}

function sanitizeSlideCount(value: unknown, fallback = 0) {
  return Math.max(0, Math.round(typeof value === "number" && Number.isFinite(value) ? value : fallback));
}

function getResolvedRecentDeckContextQuality(source: RecentDeckContextSource) {
  if (source.contextQuality) return source.contextQuality;
  if (!source.slides) return undefined;

  return getDeckContextQuality({
    inspectionStatus: source.inspectionStatus,
    pageCount: Math.max(1, sanitizeSlideCount(source.pageCount, source.slides.length || 1)),
    slides: source.slides,
  });
}

export function getRecentDeckContextStats(
  recentDeck: Pick<RecentDeck, "speakerNotesSlideCount" | "textSlideCount">,
): SlideContextStats | undefined {
  if (recentDeck.textSlideCount === undefined && recentDeck.speakerNotesSlideCount === undefined) return undefined;

  return {
    speakerNotesSlideCount: recentDeck.speakerNotesSlideCount ?? 0,
    textSlideCount: recentDeck.textSlideCount ?? 0,
  };
}

export function getRecentDeckContextFields(source?: RecentDeckContextSource): RecentDeckInput {
  if (!source) return {};

  const contextQuality = getResolvedRecentDeckContextQuality(source);
  const contextStats = source.contextStats ?? (source.slides ? getSlideContextStats(source.slides) : undefined);

  return {
    ...(contextQuality ? { contextQuality } : {}),
    ...(contextStats
      ? {
          speakerNotesSlideCount: contextStats.speakerNotesSlideCount,
          textSlideCount: contextStats.textSlideCount,
        }
      : {}),
  };
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
  if (typeof deck.deckId !== "string" || typeof deck.fileName !== "string") return null;

  const deckId = deck.deckId.trim();
  const fileName = normalizeDeckFileName(deck.fileName);
  const slideCount = sanitizeSlideCount(deck.slideCount);
  const textSlideCount = sanitizeSlideCount(deck.textSlideCount);
  const speakerNotesSlideCount = sanitizeSlideCount(deck.speakerNotesSlideCount);
  const openedAt = typeof deck.openedAt === "number" && Number.isFinite(deck.openedAt) ? deck.openedAt : Date.now();

  if (!deckId || !fileName) return null;

  return {
    ...(isDeckContextQuality(deck.contextQuality) ? { contextQuality: deck.contextQuality } : {}),
    deckId,
    fileName,
    openedAt: Math.min(Date.now(), Math.max(0, openedAt)),
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

    return normalizeRecentDecks(
      parsedDecks.filter((deck): deck is RecentDeckInput => typeof deck === "object" && deck !== null && !Array.isArray(deck)),
    );
  } catch {
    return [];
  }
}

export function upsertRecentDeck(deck: RecentDeckInput, contextSource?: RecentDeckContextSource) {
  if (typeof window === "undefined") return null;

  const sanitizedDeck = sanitizeRecentDeck({
    ...getRecentDeckContextFields(contextSource),
    ...deck,
  });
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
