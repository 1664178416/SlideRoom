import { isDemoDeckId, Slide, slides } from "@/lib/mock-data";
import {
  getSlideDisplayLabel,
  getSlideDisplayMetricsSummary,
  getSlideDisplaySummary,
  getSlideDisplayTitle,
  getSlideDisplayVisualSummary,
} from "@/lib/slide-derived";
import {
  formatMarkdownCodeBlock,
  formatMarkdownInline,
  getMarkdownEmptyValue,
} from "@/lib/markdown-export";
import {
  getSlideSectionLabel,
  Language,
  TranslationKey,
} from "@/lib/preferences";

export type ContextMode = "current" | "nearby" | "deck";

export type QuickActionId = "explain" | "summary" | "script" | "review";

export type UserMessage = {
  id: string;
  role: "user";
  content: string;
  promptKey?: TranslationKey;
};

export type AssistantMessage = {
  id: string;
  role: "assistant";
  prompt: string;
  modelPrompt?: string;
  content?: string;
  error?: string;
  contextMode: ContextMode;
  action?: QuickActionId;
  promptKey?: TranslationKey;
};

export type Message = UserMessage | AssistantMessage;

export type PersistedAIInspectorState = {
  contextMode?: ContextMode;
  draftsBySlideId?: Record<string, string>;
  messagesBySlideId?: Record<string, Message[]>;
  selectedActionId?: QuickActionId;
};

export type AssistantResultSection = {
  id: "takeaway" | "evidence" | "review" | "citation";
  titleKey: TranslationKey;
  shortTitleKey: TranslationKey;
  content: string;
};

export type AssistantResult = {
  title: string;
  summary: string;
  prompt: string;
  contextNote: string;
  sourceSlideLabels: string[];
  sourceSlideText: string;
  sections: AssistantResultSection[];
  error?: string;
};

export const quickActionDefinitions: Array<{
  id: QuickActionId;
  labelKey: TranslationKey;
  shortLabelKey: TranslationKey;
  hintKey: TranslationKey;
  promptKey: TranslationKey;
}> = [
  {
    id: "explain",
    labelKey: "ai.explain",
    shortLabelKey: "ai.explainShort",
    hintKey: "ai.explainHint",
    promptKey: "prompt.explain",
  },
  {
    id: "summary",
    labelKey: "ai.summary",
    shortLabelKey: "ai.summaryShort",
    hintKey: "ai.summaryHint",
    promptKey: "prompt.summary",
  },
  {
    id: "script",
    labelKey: "ai.script",
    shortLabelKey: "ai.scriptShort",
    hintKey: "ai.scriptHint",
    promptKey: "prompt.script",
  },
  {
    id: "review",
    labelKey: "ai.review",
    shortLabelKey: "ai.reviewShort",
    hintKey: "ai.reviewHint",
    promptKey: "prompt.review",
  },
] as const;

export const emptyMessages: Message[] = [];

const aiInspectorStorageKey = "slideroom-ai-inspector-state-v1";
const maxPersistedTextLength = 5000;
const maxMessagesPerSlide = 18;
const maxPersistedDrafts = 32;
const maxPersistedSlideRecords = 28;
const maxPromptExtractedTextLength = 900;
const maxPromptSpeakerNotesLength = 360;
const maxPromptOutlineLength = 640;
const maxPresetExtractedTextLength = 56;
const maxPresetSpeakerNotesLength = 24;
const maxPresetOutlineLength = 36;
const maxAIExportTextLength = 900;

const presetOutputTokenLimits: Record<QuickActionId, Record<Language, number>> = {
  explain: {
    en: 4,
    zh: 4,
  },
  review: {
    en: 4,
    zh: 4,
  },
  script: {
    en: 4,
    zh: 4,
  },
  summary: {
    en: 4,
    zh: 4,
  },
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function getAIInspectorStorageKey(scopeId?: string) {
  const cleanScopeId = scopeId?.trim();
  if (!cleanScopeId) return aiInspectorStorageKey;

  return `${aiInspectorStorageKey}:${cleanScopeId}`;
}

function isContextMode(value: unknown): value is ContextMode {
  return value === "current" || value === "nearby" || value === "deck";
}

function isQuickActionId(value: unknown): value is QuickActionId {
  return quickActionDefinitions.some((action) => action.id === value);
}

function isPromptKey(value: unknown): value is TranslationKey {
  return typeof value === "string" && quickActionDefinitions.some((action) => action.promptKey === value);
}

function clipPersistedText(value: string) {
  return value.slice(0, maxPersistedTextLength);
}

function clipPromptContext(value: string, maxLength: number, language: Language) {
  const cleanValue = value.trim();
  if (cleanValue.length <= maxLength) return cleanValue;

  const suffix = language === "zh" ? `\n[已截断 ${cleanValue.length - maxLength} 字]` : `\n[truncated ${cleanValue.length - maxLength} chars]`;
  return `${cleanValue.slice(0, maxLength).trimEnd()}${suffix}`;
}

function clipPromptLine(value: string, maxLength: number) {
  const cleanValue = value.replace(/\s+/g, " ").trim();
  if (cleanValue.length <= maxLength) return cleanValue;

  return `${cleanValue.slice(0, Math.max(1, maxLength - 3)).trimEnd()}...`;
}

function clipAIExportText(value: string, language: Language) {
  const cleanValue = value.trim();
  if (cleanValue.length <= maxAIExportTextLength) return cleanValue;

  const hiddenLength = cleanValue.length - maxAIExportTextLength;
  const suffix =
    language === "zh"
      ? `\n\n[已截断 ${hiddenLength} 字，完整内容仍保留在当前页历史中]`
      : `\n\n[truncated ${hiddenLength} chars; full content remains in the slide history]`;

  return `${cleanValue.slice(0, maxAIExportTextLength).trimEnd()}${suffix}`;
}

function getMessageCounter(message: Message) {
  const counterMatch = message.id.match(/-(\d+)$/);
  const counter = counterMatch ? Number(counterMatch[1]) : 0;

  return Number.isFinite(counter) ? counter : 0;
}

function getMessagesSortScore(messages: Message[]) {
  return messages.reduce((maxCounter, message) => Math.max(maxCounter, getMessageCounter(message)), 0);
}

function sanitizeMessages(value: unknown): Record<string, Message[]> {
  if (!isRecord(value)) return {};

  const nextMessageEntries: Array<[string, Message[]]> = [];

  Object.entries(value).forEach(([slideId, messages]) => {
    if (!slideId.trim() || !Array.isArray(messages)) return;

    const sanitizedMessages = messages.reduce<Message[]>((items, message) => {
      if (!isRecord(message) || typeof message.id !== "string") return items;

      const promptKey = isPromptKey(message.promptKey) ? message.promptKey : undefined;

      if (message.role === "user" && typeof message.content === "string") {
        items.push({
          id: message.id,
          role: "user",
          content: promptKey ?? clipPersistedText(message.content),
          ...(promptKey ? { promptKey } : {}),
        });
      }

      if (message.role === "assistant" && typeof message.prompt === "string") {
        const content = typeof message.content === "string" ? clipPersistedText(message.content) : "";
        const error = typeof message.error === "string" ? clipPersistedText(message.error) : "";
        if (!content && !error) return items;

        items.push({
          id: message.id,
          role: "assistant",
          prompt: promptKey ?? clipPersistedText(message.prompt),
          ...(content ? { content } : {}),
          ...(error ? { error } : {}),
          contextMode: isContextMode(message.contextMode) ? message.contextMode : "current",
          ...(isQuickActionId(message.action) ? { action: message.action } : {}),
          ...(promptKey ? { promptKey } : {}),
        });
      }

      return items;
    }, []);

    if (sanitizedMessages.length > 0) {
      nextMessageEntries.push([slideId, sanitizedMessages.slice(-maxMessagesPerSlide)]);
    }
  });

  return Object.fromEntries(
    nextMessageEntries
      .sort((left, right) => getMessagesSortScore(right[1]) - getMessagesSortScore(left[1]))
      .slice(0, maxPersistedSlideRecords),
  );
}

function sanitizeDrafts(value: unknown): Record<string, string> {
  if (!isRecord(value)) return {};

  const nextDraftEntries: Array<[string, string]> = [];

  Object.entries(value).forEach(([slideId, draft]) => {
    if (slideId.trim() && typeof draft === "string" && draft.trim().length > 0) {
      nextDraftEntries.push([slideId, clipPersistedText(draft)]);
    }
  });

  return Object.fromEntries(nextDraftEntries.slice(0, maxPersistedDrafts));
}

function getCompactAIInspectorState(state: PersistedAIInspectorState): PersistedAIInspectorState {
  const compactMessagesBySlideId = Object.fromEntries(
    Object.entries(sanitizeMessages(state.messagesBySlideId))
      .slice(0, 10)
      .map(([slideId, messages]) => [
        slideId,
        messages.slice(-8).map((message) => {
          if (message.role === "user") {
            return {
              ...message,
              content: message.content.slice(0, 1200),
            } satisfies Message;
          }

          return {
            ...message,
            content: message.content?.slice(0, 1600),
            error: message.error?.slice(0, 1600),
            prompt: message.prompt.slice(0, 1200),
          } satisfies Message;
        }),
      ]),
  );
  const compactDraftsBySlideId = Object.fromEntries(
    Object.entries(sanitizeDrafts(state.draftsBySlideId))
      .slice(0, 12)
      .map(([slideId, draft]) => [slideId, draft.slice(0, 1000)]),
  );

  return {
    contextMode: isContextMode(state.contextMode) ? state.contextMode : undefined,
    draftsBySlideId: compactDraftsBySlideId,
    messagesBySlideId: compactMessagesBySlideId,
    selectedActionId: isQuickActionId(state.selectedActionId) ? state.selectedActionId : undefined,
  };
}

export function readAIInspectorState(scopeId?: string): PersistedAIInspectorState {
  if (typeof window === "undefined") return {};

  try {
    const storageKey = getAIInspectorStorageKey(scopeId);
    const shouldReadLegacyState = isDemoDeckId(scopeId) || !scopeId;
    const storedState = window.localStorage.getItem(storageKey) ?? (shouldReadLegacyState ? window.localStorage.getItem(aiInspectorStorageKey) : null);
    if (!storedState) return {};

    const parsedState = JSON.parse(storedState) as unknown;
    if (!isRecord(parsedState)) return {};

    return {
      contextMode: isContextMode(parsedState.contextMode) ? parsedState.contextMode : undefined,
      draftsBySlideId: sanitizeDrafts(parsedState.draftsBySlideId),
      messagesBySlideId: sanitizeMessages(parsedState.messagesBySlideId),
      selectedActionId: isQuickActionId(parsedState.selectedActionId) ? parsedState.selectedActionId : undefined,
    };
  } catch {
    return {};
  }
}

export function writeAIInspectorState(state: PersistedAIInspectorState, scopeId?: string) {
  if (typeof window === "undefined") return;

  const storageKey = getAIInspectorStorageKey(scopeId);

  const nextState = {
    contextMode: isContextMode(state.contextMode) ? state.contextMode : undefined,
    draftsBySlideId: sanitizeDrafts(state.draftsBySlideId),
    messagesBySlideId: sanitizeMessages(state.messagesBySlideId),
    selectedActionId: isQuickActionId(state.selectedActionId) ? state.selectedActionId : undefined,
  } satisfies PersistedAIInspectorState;

  try {
    window.localStorage.setItem(storageKey, JSON.stringify(nextState));
  } catch {
    try {
      window.localStorage.setItem(storageKey, JSON.stringify(getCompactAIInspectorState(nextState)));
    } catch {
      // Storage can fail in private mode or when quota is exhausted.
    }
  }
}

export function getMessageCounterSeed(messagesBySlideId: Record<string, Message[]>) {
  return Object.values(messagesBySlideId).reduce((maxCounter, messages) => {
    return messages.reduce((currentMaxCounter, message) => {
      return Math.max(currentMaxCounter, getMessageCounter(message));
    }, maxCounter);
  }, 0);
}

function getContextLabel(contextMode: ContextMode, language: Language) {
  if (language === "zh") {
    if (contextMode === "current") return "当前页";
    if (contextMode === "nearby") return "邻近页";
    return "全稿大纲";
  }

  if (contextMode === "current") return "current slide";
  if (contextMode === "nearby") return "nearby slides";
  return "deck outline";
}

export function getContextTitle(contextMode: ContextMode, t: (key: TranslationKey) => string) {
  if (contextMode === "current") return t("ai.currentSlide");
  if (contextMode === "nearby") return t("ai.nearbySlides");
  return t("ai.wholeDeck");
}

function getContextSlides(slide: Slide, contextMode: ContextMode, deckSlides: Slide[]) {
  const slideIndex = deckSlides.findIndex((item) => item.id === slide.id);
  const activeIndex = slideIndex >= 0 ? slideIndex : 0;

  if (contextMode === "current") return [slide];
  if (contextMode === "nearby") {
    return deckSlides.slice(Math.max(0, activeIndex - 1), Math.min(deckSlides.length, activeIndex + 2));
  }

  return deckSlides;
}

function getContextSlideLabels(contextSlides: Slide[], language: Language) {
  return contextSlides.map((contextSlide) => getSlideDisplayLabel(contextSlide, language));
}

function formatSourceSlideLabels(contextSlides: Slide[], language: Language) {
  return getContextSlideLabels(contextSlides, language).join(language === "zh" ? "、" : ", ");
}

function formatPromptSourceSlides(contextMode: ContextMode, contextSlides: Slide[], language: Language) {
  if (contextMode !== "deck") return formatSourceSlideLabels(contextSlides, language);

  const count = contextSlides.length;
  if (contextSlides.every((contextSlide) => contextSlide.section === "imported")) {
    return language === "zh" ? `全稿 ${count} 页原始速览` : `${count}-slide raw outline`;
  }

  return language === "zh" ? `全稿 ${count} 页大纲` : `${count}-slide deck outline`;
}

function getContextOutline(contextSlides: Slide[], language: Language) {
  return contextSlides
    .map(
      (contextSlide) =>
        `${getSlideDisplayLabel(contextSlide, language)} · ${getSlideDisplayTitle(contextSlide, language)}: ${getSlideDisplaySummary(contextSlide, language)}`,
    )
    .join("\n");
}

function getRawContextOutline(contextSlides: Slide[], language: Language) {
  return contextSlides
    .map((contextSlide) => {
      const rawContext = contextSlide.extractedText || contextSlide.speakerNotes || getSlideDisplayTitle(contextSlide, language);

      return `${getSlideDisplayLabel(contextSlide, language)}: ${clipPromptLine(rawContext, 118)}`;
    })
    .join("\n");
}

function getDeckSectionOutline(language: Language, deckSlides: Slide[]) {
  const groups = deckSlides.reduce<Array<{ section: Slide["section"]; slideTitles: string[] }>>((items, slide) => {
    const group = items.find((item) => item.section === slide.section);

    if (group) {
      group.slideTitles.push(`${getSlideDisplayLabel(slide, language)} ${getSlideDisplayTitle(slide, language)}`);
    } else {
      items.push({
        section: slide.section,
        slideTitles: [`${getSlideDisplayLabel(slide, language)} ${getSlideDisplayTitle(slide, language)}`],
      });
    }

    return items;
  }, []);

  return groups
    .map((group) => `${getSlideSectionLabel(group.section, language)}: ${group.slideTitles.join(" / ")}`)
    .join("\n");
}

function getContextNote({
  contextMode,
  contextSlides,
  language,
  slide,
  deckSlides,
}: {
  contextMode: ContextMode;
  contextSlides: Slide[];
  language: Language;
  slide: Slide;
  deckSlides: Slide[];
}) {
  const sourceLabels = formatSourceSlideLabels(contextSlides, language);
  const currentSlideLabel = getSlideDisplayLabel(slide, language);
  const isImportedSlide = slide.section === "imported";

  if (language === "zh") {
    if (contextMode === "current") {
      if (isImportedSlide) {
        return `只使用 ${currentSlideLabel} 的本地提取文字和原始备注。`;
      }

      return `只使用 ${currentSlideLabel} 的本地提取文字、讲者备注和页面摘要。`;
    }

    if (contextMode === "nearby") {
      if (isImportedSlide) {
        return `额外参考 ${sourceLabels} 的原始文字/备注速览，用于判断前后页关系。`;
      }

      return `额外参考 ${sourceLabels} 的标题和摘要，用于判断承接和前后逻辑。`;
    }

    if (isImportedSlide) {
      return `参考全稿 ${deckSlides.length} 页的原始文字/备注速览，当前页细节仍以 ${currentSlideLabel} 为主。`;
    }

    return `参考全稿 ${deckSlides.length} 页的标题/摘要大纲，当前页细节仍以 ${currentSlideLabel} 为主。`;
  }

  if (contextMode === "current") {
    if (isImportedSlide) {
      return `Uses only ${currentSlideLabel}: locally extracted text and raw speaker notes.`;
    }

    return `Uses only ${currentSlideLabel}: locally extracted text, speaker notes, and page summary.`;
  }

  if (contextMode === "nearby") {
    if (isImportedSlide) {
      return `Also references raw text/notes skim from ${sourceLabels} to judge nearby slide relationships.`;
    }

    return `Also references titles and summaries from ${sourceLabels} to judge handoff and local logic.`;
  }

  if (isImportedSlide) {
    return `References raw text/notes skim from the ${deckSlides.length}-slide deck; details still come from ${currentSlideLabel}.`;
  }

  return `References the ${deckSlides.length}-slide title/summary outline; details still come from ${currentSlideLabel}.`;
}

function getAssistantResultTitle({
  action,
  language,
  slideLabel,
}: {
  action: QuickActionId;
  language: Language;
  slideLabel: string;
}) {
  if (language === "zh") {
    const titles: Record<QuickActionId, string> = {
      explain: `${slideLabel} · 旁注`,
      summary: `${slideLabel} · 摘要`,
      script: `${slideLabel} · 提示`,
      review: `${slideLabel} · 审阅`,
    };

    return titles[action];
  }

  const titles: Record<QuickActionId, string> = {
    explain: `${slideLabel} · Note`,
    summary: `${slideLabel} · Brief`,
    script: `${slideLabel} · Cue`,
    review: `${slideLabel} · Check`,
  };

  return titles[action];
}

function normalizeModelHeading(value: string) {
  return value
    .replace(/^\s{0,3}#{1,6}\s*/, "")
    .replace(/^\s*[-*]\s*/, "")
    .trim()
    .toLowerCase();
}

function resolveModelSectionId(value: string): AssistantResultSection["id"] | null {
  const heading = normalizeModelHeading(value)
    .replace(/\s+/g, " ")
    .replace(/[：:：\-–—]+$/g, "")
    .trim();

  if (/^(takeaway|core|conclusion|summary|script|结论|核心结论|摘要|要点|讲稿)$/.test(heading)) {
    return "takeaway";
  }
  if (/^(evidence|proof|basis|support|cue|依据|证据|支撑|理由|提示)$/.test(heading)) return "evidence";
  if (
    /^(watch|next|fix|risks? & questions|risk & questions|risks?|questions?|review|注意|下一步|修正|风险与追问|风险和追问|风险|追问|问题|审阅)$/.test(
      heading,
    )
  ) {
    return "review";
  }
  if (/^(citation|citations|sources?|引用|来源|出处)$/.test(heading)) return "citation";

  return null;
}

function getModelSectionMeta(id: AssistantResultSection["id"]) {
  if (id === "takeaway") {
    return {
      shortTitleKey: "ai.resultTakeawayShort",
      titleKey: "ai.resultTakeaway",
    } satisfies Pick<AssistantResultSection, "shortTitleKey" | "titleKey">;
  }

  if (id === "evidence") {
    return {
      shortTitleKey: "ai.resultEvidenceShort",
      titleKey: "ai.resultEvidence",
    } satisfies Pick<AssistantResultSection, "shortTitleKey" | "titleKey">;
  }

  if (id === "review") {
    return {
      shortTitleKey: "ai.resultReviewShort",
      titleKey: "ai.resultReview",
    } satisfies Pick<AssistantResultSection, "shortTitleKey" | "titleKey">;
  }

  return {
    shortTitleKey: "ai.resultCitationShort",
    titleKey: "ai.resultCitation",
  } satisfies Pick<AssistantResultSection, "shortTitleKey" | "titleKey">;
}

function parseModelSections(content: string): AssistantResultSection[] {
  const buckets: Record<AssistantResultSection["id"], string[]> = {
    citation: [],
    evidence: [],
    review: [],
    takeaway: [],
  };
  let activeSectionId: AssistantResultSection["id"] = "takeaway";

  content.split(/\r?\n/).forEach((line) => {
    const cleanLine = line.trim();
    if (!cleanLine) {
      if (buckets[activeSectionId].length > 0) buckets[activeSectionId].push("");
      return;
    }

    const inlineMatch = cleanLine.match(/^\s{0,3}(?:#{1,6}\s*)?([^:：]{1,34})\s*[:：]\s*(.*)$/);
    const inlineSectionId = inlineMatch ? resolveModelSectionId(inlineMatch[1]) : null;
    if (inlineSectionId) {
      activeSectionId = inlineSectionId;
      if (inlineMatch?.[2]?.trim()) {
        buckets[activeSectionId].push(inlineMatch[2].trim());
      }
      return;
    }

    const headingSectionId = cleanLine.length <= 36 ? resolveModelSectionId(cleanLine) : null;
    if (headingSectionId) {
      activeSectionId = headingSectionId;
      return;
    }

    buckets[activeSectionId].push(cleanLine);
  });

  const orderedSectionIds: AssistantResultSection["id"][] = ["takeaway", "evidence", "review", "citation"];
  const sections = orderedSectionIds
    .map<AssistantResultSection | null>((id) => {
      const content = buckets[id].join("\n").trim();
      if (!content) return null;

      return {
        id,
        ...getModelSectionMeta(id),
        content,
      } satisfies AssistantResultSection;
    })
    .filter((section): section is AssistantResultSection => Boolean(section));

  if (sections.length > 0) return sections;

  return [
    {
      id: "takeaway",
      ...getModelSectionMeta("takeaway"),
      content,
    },
  ];
}

function getModelSummary(content: string, language: Language) {
  const firstContentLine =
    content
      .split(/\r?\n/)
      .map((line) => line.replace(/^\s{0,3}#{1,6}\s*/, "").replace(/^\s*[-*]\s*/, "").trim())
      .find((line) => line && !resolveModelSectionId(line)) ?? "";

  if (firstContentLine) return firstContentLine.slice(0, 260);
  return language === "zh" ? "模型已基于当前上下文生成结果。" : "The model generated a result from the selected context.";
}

function buildModelAssistantResult({
  action,
  content,
  contextMode,
  deckSlides,
  error,
  language,
  prompt,
  promptKey,
  resultPrompt,
  slide,
}: {
  action?: QuickActionId;
  content?: string;
  contextMode: ContextMode;
  deckSlides: Slide[];
  error?: string;
  language: Language;
  prompt: string;
  promptKey?: TranslationKey;
  resultPrompt?: string;
  slide: Slide;
}): AssistantResult | null {
  const slideLabel = getSlideDisplayLabel(slide, language);
  const contextSlides = getContextSlides(slide, contextMode, deckSlides);
  const sourceSlideLabels = getContextSlideLabels(contextSlides, language);
  const contextNote = getContextNote({
    contextMode,
    contextSlides,
    deckSlides,
    language,
    slide,
  });
  const mode = getResultMode(prompt, action);
  const title = promptKey
    ? getAssistantResultTitle({
        action: mode,
        language,
        slideLabel,
      })
    : language === "zh"
      ? `${slideLabel} · 自定义提问`
      : `${slideLabel} · Custom question`;

  if (error?.trim()) {
    const errorSummary =
      language === "zh"
        ? "模型调用失败，未生成结果。"
        : "The model request failed. No result was generated.";

    return {
      error,
      title: language === "zh" ? `${slideLabel} · AI 请求失败` : `${slideLabel} · AI request failed`,
      summary: errorSummary,
      prompt: resultPrompt ?? prompt,
      contextNote,
      sourceSlideLabels,
      sourceSlideText: formatPromptSourceSlides(contextMode, contextSlides, language),
      sections: [
        {
          id: "review",
          ...getModelSectionMeta("review"),
          content: error,
        },
      ],
    };
  }

  if (!content?.trim()) return null;

  const displayContent = promptKey ? compactPresetModelContent(content, mode, language) : content;

  return {
    title,
    summary: getModelSummary(displayContent, language),
    prompt: resultPrompt ?? prompt,
    contextNote,
    sourceSlideLabels,
    sourceSlideText: formatPromptSourceSlides(contextMode, contextSlides, language),
    sections: promptKey ? parseCompactPresetSections(displayContent, mode, language) : parseModelSections(displayContent),
  };
}

export function getResultMode(prompt: string, action?: QuickActionId): QuickActionId {
  if (action) return action;

  const lower = prompt.toLowerCase();

  if (prompt.includes("讲稿") || lower.includes("script") || lower.includes("speaker")) return "script";
  if (prompt.includes("总结") || prompt.includes("摘要") || lower.includes("summary") || lower.includes("summarize")) {
    return "summary";
  }
  if (
    prompt.includes("风险") ||
    prompt.includes("问题") ||
    prompt.includes("追问") ||
    lower.includes("risk") ||
    lower.includes("question") ||
    lower.includes("review")
  ) {
    return "review";
  }

  return "explain";
}

type CompactPresetSlot = {
  aliases: string[];
  label: string;
  maxChars: number;
};

const compactPresetSlots: Record<QuickActionId, Record<Language, CompactPresetSlot[]>> = {
  explain: {
    en: [
      {
        aliases: ["note", "explain", "takeaway", "conclusion", "core", "summary", "解释", "结论", "核心结论"],
        label: "Note",
        maxChars: 10,
      },
    ],
    zh: [
      {
        aliases: ["旁注", "解释", "结论", "核心结论", "takeaway", "conclusion", "core", "summary"],
        label: "旁注",
        maxChars: 4,
      },
    ],
  },
  review: {
    en: [
      {
        aliases: ["review", "check", "risk", "question", "审阅", "风险", "追问"],
        label: "Check",
        maxChars: 10,
      },
    ],
    zh: [
      {
        aliases: ["审阅", "检查", "风险", "追问", "问题", "review", "check", "risk", "question"],
        label: "审阅",
        maxChars: 4,
      },
    ],
  },
  script: {
    en: [
      {
        aliases: ["script", "talk track", "speaker note", "讲稿"],
        label: "Cue",
        maxChars: 10,
      },
    ],
    zh: [
      {
        aliases: ["提示", "讲稿", "script", "cue", "talk track", "speaker note"],
        label: "提示",
        maxChars: 4,
      },
    ],
  },
  summary: {
    en: [
      {
        aliases: ["summary", "takeaway", "conclusion", "摘要", "结论"],
        label: "Brief",
        maxChars: 10,
      },
    ],
    zh: [
      {
        aliases: ["摘要", "结论", "summary", "takeaway", "conclusion"],
        label: "摘要",
        maxChars: 4,
      },
    ],
  },
};

function normalizeCompactLabel(value: string) {
  return value
    .trim()
    .replace(/^\s{0,3}#{1,6}\s*/, "")
    .replace(/^\s*[-*]\s*/, "")
    .replace(/[*_`]+/g, "")
    .replace(/\s+/g, " ")
    .replace(/[：:：\-–—]+$/g, "")
    .toLowerCase();
}

function cleanCompactBody(value: string) {
  return value
    .replace(/^\s{0,3}#{1,6}\s*/, "")
    .replace(/^\s*(?:[-*]|\d+[.)])\s*/, "")
    .replace(/[*_`]+/g, "")
    .replace(/^(?:note|brief|cue|check|tag|summary|takeaway|review|risk|question|旁注|摘要|提示|审阅|检查|风险|追问)\s*[:：\-–—]\s*/i, "")
    .replace(
      /^(?:我的判断是|核心判断是|核心是|结论是|重点是|短签是|标签是|这页(?:的)?(?:主要)?(?:是在|是|讲|说明|表达|强调|呈现)?|这一页(?:主要)?(?:是在|是|讲|说明|表达|强调|呈现)?|本页(?:主要)?(?:是在|是|讲|说明|表达|强调|呈现)?|该页(?:主要)?(?:是在|是|讲|说明|表达|强调|呈现)?|这张幻灯片(?:主要)?(?:是在|是|讲|说明|表达|强调|呈现)?|该幻灯片(?:主要)?(?:是在|是|讲|说明|表达|强调|呈现)?|根据(?:页面|幻灯片|PPT|内容|材料)?(?:来看)?|从(?:页面|数据|内容|材料)(?:来看)?|可以理解为|总体来看|简单说|In short,?|Overall,?|Key idea:?|The key idea is|The tag is|Tag:?|This slide(?: mainly)?(?: shows| suggests| highlights| says| is about)?|The slide(?: mainly)?(?: shows| suggests| highlights| says| is about)?|It(?: shows| suggests| highlights| says)?)\s*/i,
      "",
    )
    .replace(/\s+/g, " ")
    .trim();
}

function splitCompactFallbackBodies(value: string) {
  const cleanValue = cleanCompactBody(value);
  if (!cleanValue) return [];

  const labeledSegments = getCompactLabeledSegments(cleanValue, Object.values(compactPresetSlots).flatMap((slotsByLanguage) => [
    ...slotsByLanguage.en,
    ...slotsByLanguage.zh,
  ]));

  if (labeledSegments.length > 0) {
    return labeledSegments.map((segment) => segment.body).filter(Boolean);
  }

  const sentenceParts = cleanValue
    .split(/[。！？.!?；;]\s*/g)
    .map(cleanCompactBody)
    .filter(Boolean);

  if (sentenceParts.length > 1) return sentenceParts;

  return cleanValue
    .split(/\s*(?:[，,、]|\s+-\s+|\s+\/\s+)\s*/g)
    .map(cleanCompactBody)
    .filter(Boolean);
}

function clipCompactBody(value: string, maxChars: number) {
  const cleanValue = cleanCompactBody(value)
    .split(/[。！？!?；;\r\n]+/)[0]
    .replace(/^["“”'‘’]+|["“”'‘’]+$/g, "")
    .replace(/[，,、：:；;。.!！?？\s]+$/g, "")
    .trim();
  const wordCompactValue = /[\u2E80-\u9FFF]/.test(cleanValue)
    ? cleanValue
    : cleanValue.split(/\s+/).filter(Boolean).slice(0, 2).join(" ");

  if (wordCompactValue.length <= maxChars) return wordCompactValue;

  const clippedValue = wordCompactValue.slice(0, Math.max(1, maxChars)).trimEnd().replace(/[，,、：:；;。.!！?？\s]+$/g, "");
  if (/[\u2E80-\u9FFF]/.test(wordCompactValue)) return clippedValue;

  const clippedAtWord = clippedValue.replace(/\s+\S*$/, "").trim();
  return clippedAtWord || clippedValue;
}

function getCompactSlotKey(slot: CompactPresetSlot) {
  return normalizeCompactLabel(slot.label);
}

function escapeCompactRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function findCompactSlot(slots: CompactPresetSlot[], label: string) {
  const normalizedLabel = normalizeCompactLabel(label);

  return slots.find(
    (slot) =>
      normalizeCompactLabel(slot.label) === normalizedLabel ||
      slot.aliases.some((alias) => normalizeCompactLabel(alias) === normalizedLabel),
  );
}

function getPresetCompactSectionId(action: QuickActionId, index: number): AssistantResultSection["id"] {
  if (action === "review") return "review";
  if (action === "summary" && index > 0) return "review";
  if (index === 0) return "takeaway";

  return "evidence";
}

function parseCompactPresetSections(
  content: string,
  action: QuickActionId,
  language: Language,
): AssistantResultSection[] {
  const slots = compactPresetSlots[action]?.[language];
  if (!slots) return parseModelSections(content);

  const lines = content
    .split(/\r?\n/)
    .map(cleanCompactBody)
    .filter(Boolean)
    .slice(0, slots.length);

  if (lines.length === 0) return parseModelSections(content);

  return lines.map((line, index) => {
    const id = getPresetCompactSectionId(action, index);

    return {
      id,
      ...getModelSectionMeta(id),
      content: clipCompactBody(line, (slots[index] ?? slots[0]).maxChars),
    } satisfies AssistantResultSection;
  });
}

function getCompactLabeledSegments(line: string, slots: CompactPresetSlot[]) {
  const aliases = slots.flatMap((slot) => [slot.label, ...slot.aliases]);
  const aliasPattern = [...new Set(aliases.map(normalizeCompactLabel).filter(Boolean))]
    .sort((left, right) => right.length - left.length)
    .map(escapeCompactRegExp)
    .join("|");

  if (!aliasPattern) return [];

  const labelRegex = new RegExp(
    `(?:\\*\\*|__)?(${aliasPattern})\\s*(?:\\*\\*|__)?\\s*[:：\\-–—]\\s*(?:\\*\\*|__)?`,
    "gi",
  );
  const matches = [...line.matchAll(labelRegex)];
  if (matches.length === 0) return [];

  return matches
    .map((match, index) => {
      const matchedLabel = match[1] ?? "";
      const slot = findCompactSlot(slots, matchedLabel);
      const bodyStart = (match.index ?? 0) + match[0].length;
      const bodyEnd = matches[index + 1]?.index ?? line.length;
      const body = line.slice(bodyStart, bodyEnd).trim();

      return slot && body
        ? {
            body,
            slot,
          }
        : null;
    })
    .filter((segment): segment is { body: string; slot: CompactPresetSlot } => Boolean(segment));
}

export function compactPresetModelContent(content: string, action: QuickActionId, language: Language) {
  const slots = compactPresetSlots[action]?.[language];
  if (!slots) return content.trim();

  const fallbackBodies: string[] = [];
  const bodiesBySlot = new Map<string, string>();

  content
    .split(/\r?\n/)
    .map(cleanCompactBody)
    .filter(Boolean)
    .forEach((line) => {
      const labeledSegments = getCompactLabeledSegments(line, slots);
      if (labeledSegments.length > 0) {
        labeledSegments.forEach(({ body, slot }) => {
          const slotKey = getCompactSlotKey(slot);
          if (!bodiesBySlot.has(slotKey)) bodiesBySlot.set(slotKey, body);
        });
        return;
      }

      if (line.length > 0 && !resolveModelSectionId(line)) {
        if (action === "review" && slots.length === 1) {
          fallbackBodies.push(line);
          return;
        }

        fallbackBodies.push(...splitCompactFallbackBodies(line));
      }
    });

  const compactLines = slots
    .map((slot) => {
      const slotKey = getCompactSlotKey(slot);
      const body = bodiesBySlot.get(slotKey) ?? fallbackBodies.shift();
      if (!body) return "";

      return clipCompactBody(body, slot.maxChars);
    })
    .filter(Boolean);

  if (compactLines.length > 0) return compactLines.join("\n");

  const fallbackLines = splitCompactFallbackBodies(content)
    .slice(0, slots.length)
    .map((body, index) => {
      const slot = slots[index] ?? slots[0];
      return clipCompactBody(body, slot.maxChars);
    });

  if (fallbackLines.length > 0) return fallbackLines.join("\n");

  const fallbackBody = cleanCompactBody(content);
  return fallbackBody ? clipCompactBody(fallbackBody, slots[0].maxChars) : content.trim();
}

export function resolvePresetOutputTokens(action: QuickActionId, language: Language) {
  return presetOutputTokenLimits[action]?.[language] ?? 14;
}

export function buildPresetPrompt({
  action,
  contextMode,
  deckSlides = slides,
  language,
  sectionLabel,
  slide,
  slideLabel,
  compactContext = true,
}: {
  action: QuickActionId;
  contextMode: ContextMode;
  deckSlides?: Slide[];
  language: Language;
  sectionLabel: string;
  slide: Slide;
  slideLabel: string;
  compactContext?: boolean;
}) {
  const contextLabel = getContextLabel(contextMode, language);
  const isImportedSlide = slide.section === "imported";
  const metrics =
    slide.metrics.length > 0
      ? getSlideDisplayMetricsSummary(slide, language)
      : language === "zh"
        ? "暂无指标"
        : "No metrics";
  const bullets = slide.bullets.length > 0 ? slide.bullets.join("; ") : language === "zh" ? "暂无要点" : "No bullets";
  const slideSummary = getSlideDisplaySummary(slide, language);
  const slideTitle = getSlideDisplayTitle(slide, language);
  const slideVisualSummary = getSlideDisplayVisualSummary(slide, language);
  const contextSlides = getContextSlides(slide, contextMode, deckSlides);
  const promptSourceSlides = formatPromptSourceSlides(contextMode, contextSlides, language);
  const contextNote = getContextNote({
    contextMode,
    contextSlides,
    deckSlides,
    language,
    slide,
  });
  const contextOutline = isImportedSlide ? getRawContextOutline(contextSlides, language) : getContextOutline(contextSlides, language);
  const deckSectionOutline = contextMode === "deck" ? getDeckSectionOutline(language, deckSlides) : "";
  const promptExtractedTextLimit = compactContext ? maxPresetExtractedTextLength : maxPromptExtractedTextLength;
  const promptSpeakerNotesLimit = compactContext ? maxPresetSpeakerNotesLength : maxPromptSpeakerNotesLength;
  const promptOutlineLimit = compactContext ? maxPresetOutlineLength : maxPromptOutlineLength;
  const promptExtractedText = clipPromptContext(slide.extractedText, promptExtractedTextLimit, language);
  const promptSpeakerNotes = slide.speakerNotes
    ? clipPromptContext(slide.speakerNotes, promptSpeakerNotesLimit, language)
    : language === "zh"
      ? "暂无"
      : "None";
  const promptContextOutline = clipPromptContext(contextOutline, promptOutlineLimit, language);
  const promptDeckSectionOutline = deckSectionOutline
    ? clipPromptContext(deckSectionOutline, maxPromptOutlineLength, language)
    : "";

  const zhInstructions: Record<QuickActionId, string> = {
    explain:
      "只输出一个阅读短签，2-4个中文字符。不要句子、原因、建议、列表、标点、标题复述或“旁注：”。信息不足只写：缺文本。",
    summary:
      "只输出一个扫读短签，2-4个中文字符。只写结论方向，不要句子、解释、列表、标点、页面复述或“摘要：”。信息不足只写：缺文本。",
    script:
      "只输出一个讲者提示，2-4个中文字符。只给上台时提醒自己的词，不要讲稿、背景、解释、标点、列表或“提示：”。信息不足只写：缺文本。",
    review:
      "只输出一个审阅短签，2-4个中文字符。合并风险和追问，不要问题句、建议、解释、列表、标点或“审阅：”。信息不足只写：缺文本。",
  };
  const enInstructions: Record<QuickActionId, string> = {
    explain:
      "Return one reading tag only. Prefer one word, two words max. No label, punctuation, sentence, bullet, explanation, advice, or slide-title restatement. If weak, write only: No text.",
    summary:
      "Return one skim tag only. Prefer one word, two words max. Keep only the conclusion direction. No label, punctuation, sentence, bullet, explanation, or restatement. If weak, write only: No text.",
    script:
      "Return one presenter cue only. Prefer one word, two words max. No label, speaker note, background, punctuation, bullet, or explanation. If weak, write only: No text.",
    review:
      "Return one review tag only. Prefer one word, two words max. Merge risk plus question. No label, question sentence, recommendation, punctuation, bullet, or explanation. If weak, write only: No text.",
  };

  if (isImportedSlide) {
    if (language === "zh") {
      return [
        zhInstructions[action],
        "",
        `上下文：${contextLabel}`,
        `来源：${promptSourceSlides}`,
        `当前页：${slideLabel}`,
        `提取文字：${promptExtractedText || "暂无"}`,
        `原始备注：${promptSpeakerNotes}`,
        ...(contextMode === "current" ? [] : ["", "邻近/大纲速览：", promptContextOutline]),
      ].join("\n");
    }

    return [
      enInstructions[action],
      "",
      `Context: ${contextLabel}`,
      `Source: ${promptSourceSlides}`,
      `Current slide: ${slideLabel}`,
      `Extracted text: ${promptExtractedText || "None"}`,
      `Raw speaker notes: ${promptSpeakerNotes}`,
      ...(contextMode === "current" ? [] : ["", "Nearby/outline skim:", promptContextOutline]),
    ].join("\n");
  }

  if (compactContext) {
    if (language === "zh") {
      return [
        zhInstructions[action],
        "",
        `上下文：${contextLabel}`,
        `来源：${promptSourceSlides}`,
        `当前页：${slideLabel}`,
        `标题：${slideTitle}`,
        `页面摘要：${slideSummary}`,
        `提取文字：${promptExtractedText || "暂无"}`,
        `原始备注：${promptSpeakerNotes}`,
        ...(contextMode === "current" ? [] : ["", "邻近/大纲速览：", promptContextOutline]),
      ].join("\n");
    }

    return [
      enInstructions[action],
      "",
      `Context: ${contextLabel}`,
      `Source: ${promptSourceSlides}`,
      `Current slide: ${slideLabel}`,
      `Title: ${slideTitle}`,
      `Slide summary: ${slideSummary}`,
      `Extracted text: ${promptExtractedText || "None"}`,
      `Raw speaker notes: ${promptSpeakerNotes}`,
      ...(contextMode === "current" ? [] : ["", "Nearby/outline skim:", promptContextOutline]),
    ].join("\n");
  }

  if (language === "zh") {
    return [
      zhInstructions[action],
      "",
      `上下文范围：${contextLabel}`,
      `上下文说明：${contextNote}`,
      `实际来源：${promptSourceSlides}`,
      `页面：${slideLabel}`,
      `标题：${slideTitle}`,
      `章节：${sectionLabel}`,
      `页面摘要：${slideSummary}`,
      `要点：${bullets}`,
      `指标：${metrics}`,
      `视觉摘要：${slideVisualSummary}`,
      `提取文字：${promptExtractedText}`,
      `讲者备注：${promptSpeakerNotes}`,
      "",
      "上下文大纲：",
      promptContextOutline,
      ...(promptDeckSectionOutline ? ["", "全稿章节地图：", promptDeckSectionOutline] : []),
    ].join("\n");
  }

  return [
    enInstructions[action],
    "",
    `Context scope: ${contextLabel}`,
    `Context note: ${contextNote}`,
    `Source: ${promptSourceSlides}`,
    `Slide: ${slideLabel}`,
    `Title: ${slideTitle}`,
    `Section: ${sectionLabel}`,
    `Slide summary: ${slideSummary}`,
    `Bullets: ${bullets}`,
    `Metrics: ${metrics}`,
    `Visual summary: ${slideVisualSummary}`,
    `Extracted text: ${promptExtractedText}`,
    `Speaker notes: ${promptSpeakerNotes}`,
    "",
    "Context outline:",
    promptContextOutline,
    ...(promptDeckSectionOutline ? ["", "Deck section map:", promptDeckSectionOutline] : []),
  ].join("\n");
}

export function buildQuestionPrompt({
  contextMode,
  deckSlides = slides,
  language,
  question,
  sectionLabel,
  slide,
  slideLabel,
}: {
  contextMode: ContextMode;
  deckSlides?: Slide[];
  language: Language;
  question: string;
  sectionLabel: string;
  slide: Slide;
  slideLabel: string;
}) {
  const contextPrompt = buildPresetPrompt({
    action: getResultMode(question),
    contextMode,
    deckSlides,
    language,
    sectionLabel,
    slide,
    slideLabel,
    compactContext: false,
  })
    .split(/\r?\n/)
    .slice(2)
    .join("\n")
    .trim();
  const clippedQuestion = clipPromptContext(question, 1200, language);

  if (language === "zh") {
    return [
      "回答用户问题。只根据下面的页面上下文，不要编造；默认最多 2 行，每行只保留一个判断。除非用户明确要求展开，不要写背景、客套、长解释或 Markdown。上下文不足时，直接说明缺什么。",
      `用户问题：${clippedQuestion}`,
      "",
      "页面上下文：",
      contextPrompt,
    ].join("\n");
  }

  return [
    "Answer the user's question using only the slide context below. Do not invent missing facts. Default to at most 2 lines, one judgment per line. Unless the user explicitly asks for depth, do not write background, pleasantries, long explanations, or Markdown. If context is insufficient, say what is missing.",
    `User question: ${clippedQuestion}`,
    "",
    "Slide context:",
    contextPrompt,
  ].join("\n");
}

export function resolveQuestionOutputTokens(question: string) {
  const cleanQuestion = question.trim();
  const lowerQuestion = cleanQuestion.toLowerCase();
  const asksForDepth =
    /详细|展开|完整|逐条|列出|分析|方案|步骤|对比|为什么|生成|写(?:一段|成|出)?|讲稿|备注/.test(cleanQuestion) ||
    /\b(detail(?:ed)?|expand|full|step-by-step|list|analy[sz]e|analysis|plan|steps|compare|why|generate|write|draft|script|speaker notes?)\b/.test(
      lowerQuestion,
    );

  return asksForDepth ? 160 : 64;
}

export function getAssistantPromptForLanguage({
  deckSlides = slides,
  language,
  message,
  slide,
}: {
  deckSlides?: Slide[];
  language: Language;
  message: AssistantMessage;
  slide: Slide;
}) {
  const action = message.action ?? getResultMode(message.prompt);
  const actionDefinition = quickActionDefinitions.find((item) => item.id === action);
  const hasPresetPromptKey = Boolean(actionDefinition && message.promptKey === actionDefinition.promptKey);
  const structuredPresetPrompt =
    (
      message.prompt.includes("上下文范围：") &&
      (message.prompt.includes("实际来源页：") || message.prompt.includes("实际来源：")) &&
      message.prompt.includes("上下文大纲：")
    ) ||
    (
      message.prompt.includes("Context scope:") &&
      (message.prompt.includes("Source slides:") || message.prompt.includes("Source:")) &&
      message.prompt.includes("Context outline:")
    );
  const matchesGeneratedPreset =
    hasPresetPromptKey ||
    structuredPresetPrompt ||
    (["zh", "en"] satisfies Language[]).some((candidateLanguage) => {
      return (
        message.prompt ===
        buildPresetPrompt({
          action,
          contextMode: message.contextMode,
          deckSlides,
          language: candidateLanguage,
          sectionLabel: getSlideSectionLabel(slide.section, candidateLanguage),
          slide,
          slideLabel: getSlideDisplayLabel(slide, candidateLanguage),
        })
      );
    });

  if (!matchesGeneratedPreset) return message.prompt;

  return buildPresetPrompt({
    action,
    contextMode: message.contextMode,
    deckSlides,
    language,
    sectionLabel: getSlideSectionLabel(slide.section, language),
    slide,
    slideLabel: getSlideDisplayLabel(slide, language),
  });
}

export function buildAssistantResult(
  slide: Slide,
  prompt: string,
  contextMode: ContextMode,
  language: Language,
  sectionLabel: string,
  action?: QuickActionId,
  deckSlides = slides,
  message?: AssistantMessage,
): AssistantResult | null {
  const modelResult = buildModelAssistantResult({
    action,
    content: message?.content,
    contextMode,
    deckSlides,
    error: message?.error,
    language,
    prompt,
    promptKey: message?.promptKey,
    resultPrompt: message?.modelPrompt,
    slide,
  });

  if (modelResult) return modelResult;

  return null;
}

function getLatestAssistantMessagesByAction(messages: Message[]) {
  return quickActionDefinitions.reduce<AssistantMessage[]>((items, action) => {
    const latestMessage = [...messages]
      .reverse()
      .find(
        (message): message is AssistantMessage =>
          message.role === "assistant" &&
          Boolean(message.content?.trim()) &&
          message.promptKey === action.promptKey &&
          (message.action ?? getResultMode(message.prompt)) === action.id,
      );

    if (latestMessage) {
      items.push(latestMessage);
    }

    return items;
  }, []);
}

function getRecentCustomAssistantMessages(messages: Message[]) {
  const maxCustomQuestionsToExport = 3;

  return messages
    .filter(
      (message): message is AssistantMessage =>
        message.role === "assistant" &&
        Boolean(message.content?.trim()) &&
        !message.promptKey,
    )
    .slice(-maxCustomQuestionsToExport);
}

export function getPersistedAISlideExportLines({
  deckId,
  language,
  slide,
  t,
}: {
  deckId?: string;
  language: Language;
  slide: Slide;
  t: (key: TranslationKey) => string;
}) {
  const persistedState = readAIInspectorState(deckId);
  const messages = persistedState.messagesBySlideId?.[slide.id] ?? emptyMessages;
  const assistantMessages = getLatestAssistantMessagesByAction(messages);
  const customAssistantMessages = getRecentCustomAssistantMessages(messages);

  if (assistantMessages.length === 0 && customAssistantMessages.length === 0) return [];

  const emptyValue = getMarkdownEmptyValue(language);
  const formatExportAIContent = (value: string) => formatMarkdownCodeBlock(clipAIExportText(value, language), emptyValue);
  const formatPresetTitle = (message: AssistantMessage) => {
    const action = message.action ?? getResultMode(message.prompt);
    const actionDefinition = quickActionDefinitions.find((item) => item.id === action);

    return formatMarkdownInline(actionDefinition ? t(actionDefinition.labelKey) : message.prompt, emptyValue);
  };
  const formatPresetLine = (message: AssistantMessage) => {
    const action = message.action ?? getResultMode(message.prompt);
    const compactContent = clipAIExportText(compactPresetModelContent(message.content ?? "", action, language), language);

    return `- ${formatPresetTitle(message)}: ${formatMarkdownInline(compactContent, emptyValue)}`;
  };

  return [
    `### ${t("export.manualAI")}`,
    "",
    ...assistantMessages.map(formatPresetLine),
    ...(assistantMessages.length > 0 ? [""] : []),
    ...(customAssistantMessages.length > 0
      ? [
          `#### ${t("ai.customQuestions")}`,
          "",
          ...customAssistantMessages.flatMap((message) => [
            `##### ${formatMarkdownInline(message.prompt, emptyValue)}`,
            "",
            ...formatExportAIContent(message.content ?? ""),
            "",
          ]),
        ]
      : []),
  ];
}
