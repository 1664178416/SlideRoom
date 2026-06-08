const maxDeckFileNameLength = 180;
const maxDeckTitleLength = 96;

function clampDisplayText(value: string, maxLength: number) {
  if (value.length <= maxLength) return value;

  return `${value.slice(0, maxLength - 3).trimEnd()}...`;
}

export function normalizeDeckFileName(fileName: string, fallback = "deck.pptx") {
  const lastPathSegment = fileName
    .replace(/[\u0000-\u001f\u007f]/g, "")
    .split(/[\\/]/)
    .filter(Boolean)
    .pop();
  const normalized = (lastPathSegment ?? "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxDeckFileNameLength);

  return normalized || fallback;
}

export function getDeckFileStem(fileName: string, fallback = "deck") {
  const trimmedName = normalizeDeckFileName(fileName, fallback);
  const withoutExtension = trimmedName.replace(/\.(pptx?|pdf)$/i, "").trim();
  const stem = withoutExtension || fallback;

  return stem.replace(/[\\/:*?"<>|]+/g, "-").replace(/\s+/g, " ").trim() || fallback;
}

export function getDeckDisplayTitle(fileName: string, fallbackTitle: string) {
  const stem = getDeckFileStem(fileName, fallbackTitle);
  const title = stem.replace(/[_-]+/g, " ").replace(/\s+/g, " ").trim();

  return clampDisplayText(title || fallbackTitle, maxDeckTitleLength);
}

export function getSessionDeckTitle(fileName: string, defaultFileName: string, fallbackTitle: string) {
  const normalizedFileName = normalizeDeckFileName(fileName, defaultFileName);

  return normalizedFileName === defaultFileName ? fallbackTitle : getDeckDisplayTitle(normalizedFileName, fallbackTitle);
}
