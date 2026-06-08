export const maxUploadFileSizeBytes = 50 * 1024 * 1024;

export type DeckInspectionStatus = "parsed" | "unsupported" | "failed";
export type DeckContextQuality = "failed" | "parsed" | "partial" | "preview_only";

export type UploadedSlideContext = {
  pageNumber: number;
  extractedText: string;
  speakerNotes: string;
};

export type UploadedDeckSession = {
  deckId: string;
  fileName: string;
  inspectionStatus: DeckInspectionStatus;
  originalFileName: string;
  pageCount: number;
  slides: UploadedSlideContext[];
  size: number;
  status: "uploaded";
  storageKey: string;
  uploadedAt: number;
};

export type SlideContextStats = {
  speakerNotesSlideCount: number;
  textSlideCount: number;
};

export type UploadDeckErrorCode =
  | "missing_file"
  | "unsupported_type"
  | "empty_file"
  | "file_too_large"
  | "upload_failed";

export type UploadDeckResponse =
  | {
      ok: true;
      session: UploadedDeckSession;
    }
  | {
      errorCode: UploadDeckErrorCode;
      message: string;
      ok: false;
    };

export type ReadDeckResponse =
  | {
      ok: true;
      session: UploadedDeckSession;
    }
  | {
      message: string;
      ok: false;
    };

export function isSupportedDeckFileName(fileName: string) {
  const normalizedName = fileName.toLowerCase();

  return normalizedName.endsWith(".ppt") || normalizedName.endsWith(".pptx");
}

export function getSlideContextStats(
  slides: Array<{
    extractedText?: string;
    speakerNotes?: string;
  }>,
): SlideContextStats {
  return slides.reduce<SlideContextStats>(
    (stats, slide) => ({
      speakerNotesSlideCount: stats.speakerNotesSlideCount + (slide.speakerNotes?.trim() ? 1 : 0),
      textSlideCount: stats.textSlideCount + (slide.extractedText?.trim() ? 1 : 0),
    }),
    {
      speakerNotesSlideCount: 0,
      textSlideCount: 0,
    },
  );
}

export function getDeckContextQuality({
  inspectionStatus,
  pageCount,
  slides,
}: {
  inspectionStatus?: DeckInspectionStatus | null;
  pageCount: number;
  slides: Array<{
    extractedText?: string;
    speakerNotes?: string;
  }>;
}): DeckContextQuality {
  if (inspectionStatus === "failed") return "failed";
  if (inspectionStatus === "unsupported") return "preview_only";

  const normalizedPageCount = Math.max(1, Math.round(pageCount));
  const stats = getSlideContextStats(slides);

  if (stats.textSlideCount >= normalizedPageCount) return "parsed";
  if (stats.textSlideCount > 0 || stats.speakerNotesSlideCount > 0) return "partial";

  return inspectionStatus === "parsed" ? "preview_only" : "partial";
}
