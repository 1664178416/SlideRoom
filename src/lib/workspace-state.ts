import type { Slide } from "@/lib/mock-data";

export type WorkspaceState = {
  currentSlideId?: string;
  inspectorOpen?: boolean;
  railOpen?: boolean;
  zoom?: number;
};

const workspaceStorageKey = "slideroom-workspace-state-v2";
export const defaultWorkspaceInspectorOpen = true;
export const defaultWorkspaceRailOpen = true;
export const defaultWorkspaceZoom = 1;
export const minWorkspaceZoom = 0.78;
export const maxWorkspaceZoom = 1.14;

function getWorkspaceStorageKey(deckId: string) {
  return `${workspaceStorageKey}:${deckId}`;
}

function hasSlide(deckSlides: Slide[], slideId?: string) {
  return Boolean(slideId && deckSlides.some((slide) => slide.id === slideId));
}

export function clampWorkspaceZoom(zoom?: number) {
  return typeof zoom === "number" ? Math.min(maxWorkspaceZoom, Math.max(minWorkspaceZoom, zoom)) : undefined;
}

export function readWorkspaceState(deckId: string, deckSlides: Slide[]): WorkspaceState {
  if (typeof window === "undefined") return {};

  try {
    const storedState = window.localStorage.getItem(getWorkspaceStorageKey(deckId));
    if (!storedState) return {};

    const parsedState = JSON.parse(storedState) as WorkspaceState;
    return {
      currentSlideId: hasSlide(deckSlides, parsedState.currentSlideId) ? parsedState.currentSlideId : undefined,
      inspectorOpen: typeof parsedState.inspectorOpen === "boolean" ? parsedState.inspectorOpen : undefined,
      railOpen: typeof parsedState.railOpen === "boolean" ? parsedState.railOpen : undefined,
      zoom: clampWorkspaceZoom(parsedState.zoom),
    };
  } catch {
    return {};
  }
}

export function writeWorkspaceState(deckId: string, deckSlides: Slide[], state: WorkspaceState) {
  if (typeof window === "undefined") return;

  try {
    window.localStorage.setItem(
      getWorkspaceStorageKey(deckId),
      JSON.stringify({
        currentSlideId: hasSlide(deckSlides, state.currentSlideId) ? state.currentSlideId : undefined,
        inspectorOpen: typeof state.inspectorOpen === "boolean" ? state.inspectorOpen : undefined,
        railOpen: typeof state.railOpen === "boolean" ? state.railOpen : undefined,
        zoom: clampWorkspaceZoom(state.zoom),
      } satisfies WorkspaceState),
    );
  } catch {
    // Storage can fail in private mode or when quota is exhausted.
  }
}
