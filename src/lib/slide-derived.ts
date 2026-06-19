import type { Slide } from "@/lib/mock-data";
import {
  formatSlideLabel,
  getGeneratedKickerLabel,
  getGeneratedMetricLabel,
  getGeneratedSlideSummary,
  getGeneratedSlideTitle,
  getGeneratedVisualSummary,
  type Language,
} from "@/lib/preferences";

export function getSlideDisplayTitle(slide: Slide, language: Language) {
  return getGeneratedSlideTitle(slide.title, slide.pageNumber, language);
}

export function getSlideDisplaySummary(slide: Slide, language: Language) {
  return getGeneratedSlideSummary(slide.summary, slide.pageNumber, language);
}

export function getSlideDisplayKicker(slide: Slide, language: Language) {
  return getGeneratedKickerLabel(slide.kicker, language);
}

export function getSlideDisplayVisualSummary(slide: Slide, language: Language) {
  return getGeneratedVisualSummary(slide.visualSummary, language);
}

export function getSlideDisplayMetricLabel(label: string, language: Language) {
  return getGeneratedMetricLabel(label, language);
}

export function getSlideDisplayLabel(slide: Slide, language: Language) {
  return formatSlideLabel(slide.pageNumber, language);
}

export function getSlideDisplayHeading(slide: Slide, language: Language) {
  return `${getSlideDisplayLabel(slide, language)} · ${getSlideDisplayTitle(slide, language)}`;
}

export function getSlideAspectRatio(slide: Pick<Slide, "aspectRatio">) {
  return slide.aspectRatio && slide.aspectRatio > 0 ? slide.aspectRatio : 16 / 10;
}
