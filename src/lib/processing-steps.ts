import type { TranslationKey } from "@/lib/preferences";

export const processingActiveSteps = [
  "processing.upload",
  "processing.convert",
  "processing.render",
  "processing.extract",
] satisfies TranslationKey[];

export const processingSteps = [...processingActiveSteps, "processing.ready"] satisfies TranslationKey[];

function normalizeProcessingProgress(progress: number) {
  if (!Number.isFinite(progress)) return 0;
  return Math.min(100, Math.max(0, progress));
}

function getActiveProgress(progress: number) {
  return Math.min(99, normalizeProcessingProgress(progress));
}

export function getVisibleProcessingSteps(progress: number, ready: boolean) {
  if (ready) return processingSteps;

  const visibleStepCount = Math.ceil((getActiveProgress(progress) / 100) * processingActiveSteps.length);
  const count = Math.max(1, visibleStepCount);
  return processingActiveSteps.slice(0, count);
}

export function getActiveProcessingStepIndex(progress: number, ready: boolean) {
  if (ready) return processingSteps.length - 1;

  const progressStepIndex = Math.floor((getActiveProgress(progress) / 100) * processingActiveSteps.length);
  return Math.min(processingActiveSteps.length - 1, progressStepIndex);
}