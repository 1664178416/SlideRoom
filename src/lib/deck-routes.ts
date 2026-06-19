import { getDeckFileStem, normalizeDeckFileName } from "@/lib/deck-display";
import { deckMeta } from "@/lib/mock-data";

type BuildDeckProcessingHrefInput = {
  deckId: string;
  fileName: string;
  now?: number;
  pageCount?: number;
  startedAt?: number;
};

export function buildDeckWorkspaceHref(deckId: string, fileName: string, defaultFileName = deckMeta.fileName) {
  const normalizedName = normalizeDeckFileName(fileName, defaultFileName);
  if (normalizedName === defaultFileName) return `/deck/${deckId}`;

  const workspaceParams = new URLSearchParams({ fileName: normalizedName });
  return `/deck/${deckId}?${workspaceParams.toString()}`;
}

export function buildDeckProcessingHref({
  deckId,
  fileName,
  now = Date.now(),
  pageCount = deckMeta.pageCount,
  startedAt,
}: BuildDeckProcessingHrefInput) {
  const processingParams = new URLSearchParams({
    fileName: normalizeDeckFileName(fileName, deckMeta.fileName),
    pageCount: String(Math.max(1, Math.round(pageCount))),
    startedAt: String(startedAt || now),
  });

  return `/deck/${deckId}/processing?${processingParams.toString()}`;
}

export function getDeckRouteStem(fileName: string, fallback = deckMeta.id) {
  return getDeckFileStem(fileName, fallback);
}
