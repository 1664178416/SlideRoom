import { Slide, slides } from "@/lib/mock-data";
import {
  formatMarkdownCodeBlock,
  formatMarkdownInline,
  getMarkdownEmptyValue,
} from "@/lib/markdown-export";
import {
  formatSlideLabel,
  getGeneratedKickerLabel,
  getGeneratedMetricLabel,
  getGeneratedSlideTitle,
  getGeneratedSlideSummary,
  getGeneratedVisualSummary,
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
const maxAIExportTextLength = 900;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
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
          ...(!promptKey && typeof message.modelPrompt === "string"
            ? { modelPrompt: clipPersistedText(message.modelPrompt) }
            : {}),
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
            modelPrompt: message.modelPrompt?.slice(0, 2000),
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

export function readAIInspectorState(): PersistedAIInspectorState {
  if (typeof window === "undefined") return {};

  try {
    const storedState = window.localStorage.getItem(aiInspectorStorageKey);
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

export function writeAIInspectorState(state: PersistedAIInspectorState) {
  if (typeof window === "undefined") return;

  const nextState = {
    contextMode: isContextMode(state.contextMode) ? state.contextMode : undefined,
    draftsBySlideId: sanitizeDrafts(state.draftsBySlideId),
    messagesBySlideId: sanitizeMessages(state.messagesBySlideId),
    selectedActionId: isQuickActionId(state.selectedActionId) ? state.selectedActionId : undefined,
  } satisfies PersistedAIInspectorState;

  try {
    window.localStorage.setItem(aiInspectorStorageKey, JSON.stringify(nextState));
  } catch {
    try {
      window.localStorage.setItem(aiInspectorStorageKey, JSON.stringify(getCompactAIInspectorState(nextState)));
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
  return contextSlides.map((contextSlide) => formatSlideLabel(contextSlide.pageNumber, language));
}

function getSlideDisplayTitle(slide: Slide, language: Language) {
  return getGeneratedSlideTitle(slide.title, slide.pageNumber, language);
}

function formatSourceSlideLabels(contextSlides: Slide[], language: Language) {
  return getContextSlideLabels(contextSlides, language).join(language === "zh" ? "、" : ", ");
}

function formatPromptSourceSlides(contextMode: ContextMode, contextSlides: Slide[], language: Language) {
  if (contextMode !== "deck") return formatSourceSlideLabels(contextSlides, language);

  const count = contextSlides.length;
  return language === "zh" ? `全稿 ${count} 页大纲` : `${count}-slide deck outline`;
}

function getContextOutline(contextSlides: Slide[], language: Language) {
  return contextSlides
    .map(
      (contextSlide) =>
        `${formatSlideLabel(contextSlide.pageNumber, language)} · ${getSlideDisplayTitle(contextSlide, language)}: ${getGeneratedSlideSummary(contextSlide.summary, contextSlide.pageNumber, language)}`,
    )
    .join("\n");
}

function getDeckSectionOutline(language: Language, deckSlides: Slide[]) {
  const groups = deckSlides.reduce<Array<{ section: Slide["section"]; slideTitles: string[] }>>((items, slide) => {
    const group = items.find((item) => item.section === slide.section);

    if (group) {
      group.slideTitles.push(`${formatSlideLabel(slide.pageNumber, language)} ${getSlideDisplayTitle(slide, language)}`);
    } else {
      items.push({
        section: slide.section,
        slideTitles: [`${formatSlideLabel(slide.pageNumber, language)} ${getSlideDisplayTitle(slide, language)}`],
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

  if (language === "zh") {
    if (contextMode === "current") {
      return `只使用 ${formatSlideLabel(slide.pageNumber, language)} 的本地提取文字、讲者备注和页面摘要。`;
    }

    if (contextMode === "nearby") {
      return `额外参考 ${sourceLabels} 的标题和摘要，用于判断承接和前后逻辑。`;
    }

    return `参考全稿 ${deckSlides.length} 页的标题/摘要大纲，当前页细节仍以 ${formatSlideLabel(slide.pageNumber, language)} 为主。`;
  }

  if (contextMode === "current") {
    return `Uses only ${formatSlideLabel(slide.pageNumber, language)}: locally extracted text, speaker notes, and page summary.`;
  }

  if (contextMode === "nearby") {
    return `Also references titles and summaries from ${sourceLabels} to judge handoff and local logic.`;
  }

  return `References the ${deckSlides.length}-slide title/summary outline; details still come from ${formatSlideLabel(slide.pageNumber, language)}.`;
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
      explain: `${slideLabel} · 逐页解释`,
      summary: `${slideLabel} · 摘要`,
      script: `${slideLabel} · 讲稿草稿`,
      review: `${slideLabel} · 风险与追问`,
    };

    return titles[action];
  }

  const titles: Record<QuickActionId, string> = {
    explain: `${slideLabel} · Explanation`,
    summary: `${slideLabel} · Summary`,
    script: `${slideLabel} · Speaker draft`,
    review: `${slideLabel} · Risks & questions`,
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
  const slideLabel = formatSlideLabel(slide.pageNumber, language);
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

  return {
    title,
    summary: getModelSummary(content, language),
    prompt: resultPrompt ?? prompt,
    contextNote,
    sourceSlideLabels,
    sourceSlideText: formatPromptSourceSlides(contextMode, contextSlides, language),
    sections: promptKey ? parseCompactPresetSections(content, mode, language) : parseModelSections(content),
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
        aliases: ["takeaway", "conclusion", "core", "summary", "结论", "核心结论"],
        label: "Takeaway",
        maxChars: 42,
      },
      {
        aliases: ["evidence", "proof", "basis", "support", "依据", "证据", "支撑"],
        label: "Evidence",
        maxChars: 42,
      },
    ],
    zh: [
      {
        aliases: ["结论", "核心结论", "takeaway", "conclusion", "core", "summary"],
        label: "结论",
        maxChars: 12,
      },
      {
        aliases: ["依据", "证据", "支撑", "evidence", "proof", "basis", "support"],
        label: "依据",
        maxChars: 12,
      },
    ],
  },
  review: {
    en: [
      {
        aliases: ["risk", "watch", "issue", "risks", "风险", "注意"],
        label: "Risk",
        maxChars: 42,
      },
      {
        aliases: ["question", "follow-up", "follow up", "追问", "问题"],
        label: "Question",
        maxChars: 42,
      },
    ],
    zh: [
      {
        aliases: ["风险", "注意", "risk", "watch", "issue", "risks"],
        label: "风险",
        maxChars: 12,
      },
      {
        aliases: ["追问", "问题", "question", "follow-up", "follow up"],
        label: "追问",
        maxChars: 12,
      },
    ],
  },
  script: {
    en: [
      {
        aliases: ["script", "talk track", "speaker note", "讲稿"],
        label: "Script",
        maxChars: 72,
      },
    ],
    zh: [
      {
        aliases: ["讲稿", "script", "talk track", "speaker note"],
        label: "讲稿",
        maxChars: 24,
      },
    ],
  },
  summary: {
    en: [
      {
        aliases: ["summary", "takeaway", "conclusion", "摘要", "结论"],
        label: "Summary",
        maxChars: 42,
      },
    ],
    zh: [
      {
        aliases: ["摘要", "结论", "summary", "takeaway", "conclusion"],
        label: "摘要",
        maxChars: 14,
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
    .replace(/^(?:我的判断是|核心判断是|这页主要是|这一页主要是|该页主要是|可以理解为|总体来看|简单说|In short,?|Overall,?)\s*/i, "")
    .replace(/\s+/g, " ")
    .trim();
}

function splitCompactFallbackBodies(value: string) {
  const cleanValue = cleanCompactBody(value);
  if (!cleanValue) return [];

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
  const cleanValue = cleanCompactBody(value);
  if (cleanValue.length <= maxChars) return cleanValue;

  return `${cleanValue.slice(0, Math.max(1, maxChars - 3)).trimEnd()}...`;
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

function ensureCompactLineLabel(line: string, slot: CompactPresetSlot, language: Language) {
  const labeledSegments = getCompactLabeledSegments(line, [slot]);
  const separator = language === "zh" ? "：" : ": ";
  if (labeledSegments.length > 0) {
    return `${slot.label}${separator}${clipCompactBody(labeledSegments[0].body, slot.maxChars)}`;
  }

  return `${slot.label}${separator}${clipCompactBody(line, slot.maxChars)}`;
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
      content: ensureCompactLineLabel(line, slots[index] ?? slots[0], language),
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
        fallbackBodies.push(...splitCompactFallbackBodies(line));
      }
    });

  const compactLines = slots
    .map((slot) => {
      const slotKey = getCompactSlotKey(slot);
      const body = bodiesBySlot.get(slotKey) ?? fallbackBodies.shift();
      if (!body) return "";

      const separator = language === "zh" ? "：" : ": ";
      return `${slot.label}${separator}${clipCompactBody(body, slot.maxChars)}`;
    })
    .filter(Boolean);

  if (compactLines.length > 0) return compactLines.join("\n");

  const separator = language === "zh" ? "：" : ": ";
  const fallbackLines = splitCompactFallbackBodies(content)
    .slice(0, slots.length)
    .map((body, index) => {
      const slot = slots[index] ?? slots[0];
      return `${slot.label}${separator}${clipCompactBody(body, slot.maxChars)}`;
    });

  if (fallbackLines.length > 0) return fallbackLines.join("\n");

  const fallbackBody = cleanCompactBody(content);
  return fallbackBody ? `${slots[0].label}${separator}${clipCompactBody(fallbackBody, slots[0].maxChars)}` : content.trim();
}

function formatCitationLines(contextSlides: Slide[], language: Language) {
  const maxVisibleCitations = 8;
  const visibleSlides = contextSlides.slice(0, maxVisibleCitations);
  const hiddenCount = Math.max(0, contextSlides.length - visibleSlides.length);
  const citationLines = visibleSlides.map(
    (contextSlide) =>
      `${formatSlideLabel(contextSlide.pageNumber, language)} · ${getSlideSectionLabel(contextSlide.section, language)} · ${getSlideDisplayTitle(contextSlide, language)}`,
  );

  if (hiddenCount > 0) {
    citationLines.push(
      language === "zh" ? `另有 ${hiddenCount} 页已纳入大纲。` : `${hiddenCount} more slides included in the outline.`,
    );
  }

  return citationLines;
}

export function buildPresetPrompt({
  action,
  contextMode,
  deckSlides = slides,
  language,
  sectionLabel,
  slide,
  slideLabel,
}: {
  action: QuickActionId;
  contextMode: ContextMode;
  deckSlides?: Slide[];
  language: Language;
  sectionLabel: string;
  slide: Slide;
  slideLabel: string;
}) {
  const contextLabel = getContextLabel(contextMode, language);
  const metrics =
    slide.metrics.length > 0
      ? slide.metrics.map((metric) => `${getGeneratedMetricLabel(metric.label, language)}: ${metric.value}`).join("; ")
      : language === "zh"
        ? "暂无指标"
        : "No metrics";
  const bullets = slide.bullets.length > 0 ? slide.bullets.join("; ") : language === "zh" ? "暂无要点" : "No bullets";
  const slideSummary = getGeneratedSlideSummary(slide.summary, slide.pageNumber, language);
  const slideTitle = getSlideDisplayTitle(slide, language);
  const slideVisualSummary = getGeneratedVisualSummary(slide.visualSummary, language);
  const contextSlides = getContextSlides(slide, contextMode, deckSlides);
  const promptSourceSlides = formatPromptSourceSlides(contextMode, contextSlides, language);
  const contextNote = getContextNote({
    contextMode,
    contextSlides,
    deckSlides,
    language,
    slide,
  });
  const contextOutline = getContextOutline(contextSlides, language);
  const deckSectionOutline = contextMode === "deck" ? getDeckSectionOutline(language, deckSlides) : "";
  const promptExtractedText = clipPromptContext(slide.extractedText, maxPromptExtractedTextLength, language);
  const promptSpeakerNotes = slide.speakerNotes
    ? clipPromptContext(slide.speakerNotes, maxPromptSpeakerNotesLength, language)
    : language === "zh"
      ? "暂无"
      : "None";
  const promptContextOutline = clipPromptContext(contextOutline, maxPromptOutlineLength, language);
  const promptDeckSectionOutline = deckSectionOutline
    ? clipPromptContext(deckSectionOutline, maxPromptOutlineLength, language)
    : "";

  const zhInstructions: Record<QuickActionId, string> = {
    explain:
      "只给页边旁注，不写报告。必须只输出 2 行，保留标签：结论：10 字内；依据：10 字内。不要复述标题或原文。",
    summary:
      "把这一页压成扫读旁注。必须只输出 1 行，保留标签：摘要：14 字内。只给判断，不列点。",
    script:
      "写一句极短讲稿，不覆盖全部内容。必须只输出 1 行，保留标签：讲稿：24 字内。口语化，可直接念。",
    review:
      "只做轻量审阅，不写分析。必须只输出 2 行，保留标签：风险：10 字内；追问：10 字内。只抓最重要一处。",
  };
  const enInstructions: Record<QuickActionId, string> = {
    explain:
      "Write a margin note, not a report. Exactly 2 labeled lines: Takeaway: max 5 words; Evidence: max 5 words. Do not restate text.",
    summary:
      "Compress this slide into one skim note. Exactly 1 labeled line: Summary: max 7 words. Judgment only.",
    script:
      "Write one tiny presenter note. Exactly 1 labeled line: Script: max 14 words, ready to read aloud.",
    review:
      "Write a light review, not analysis. Exactly 2 labeled lines: Risk: max 5 words; Question: max 5 words. Pick only the sharpest point.",
  };

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
  })
    .split(/\r?\n/)
    .slice(2)
    .join("\n")
    .trim();
  const clippedQuestion = clipPromptContext(question, 1200, language);

  if (language === "zh") {
    return [
      "回答用户问题。只根据下面的页面上下文，不要编造；最多 3 行，每行只保留一个判断。如果上下文不足，直接说明缺什么。",
      `用户问题：${clippedQuestion}`,
      "",
      "页面上下文：",
      contextPrompt,
    ].join("\n");
  }

  return [
    "Answer the user's question using only the slide context below. Do not invent missing facts. Use at most 3 lines, one judgment per line. If context is insufficient, say what is missing.",
    `User question: ${clippedQuestion}`,
    "",
    "Slide context:",
    contextPrompt,
  ].join("\n");
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
          slideLabel: formatSlideLabel(slide.pageNumber, candidateLanguage),
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
    slideLabel: formatSlideLabel(slide.pageNumber, language),
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
): AssistantResult {
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

  const slideLabel = formatSlideLabel(slide.pageNumber, language);
  const contextLabel = getContextLabel(contextMode, language);
  const slideTitle = getSlideDisplayTitle(slide, language);
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
  const primaryMetric = slide.metrics[0] ?? {
    label: language === "zh" ? "关键指标" : "Key signal",
    value: language === "zh" ? "待确认" : "to confirm",
  };
  const primaryMetricLabel = getGeneratedMetricLabel(primaryMetric.label, language);
  const kickerLabel = getGeneratedKickerLabel(slide.kicker, language);
  const slideSummary = getGeneratedSlideSummary(slide.summary, slide.pageNumber, language);
  const slideVisualSummary = getGeneratedVisualSummary(slide.visualSummary, language);
  const firstBullet = slide.bullets[0] ?? (language === "zh" ? "核心事项" : "the main point");
  const zhBullets = slide.bullets.length > 0 ? slide.bullets.join("、") : "核心事项";
  const enBullets = slide.bullets.length > 0 ? slide.bullets.join(", ") : "the main point";
  const previousSlide = contextSlides.find((contextSlide) => contextSlide.pageNumber === slide.pageNumber - 1);
  const nextSlide = contextSlides.find((contextSlide) => contextSlide.pageNumber === slide.pageNumber + 1);
  const deckFirstSlide = deckSlides[0] ?? slide;
  const deckLastSlide = deckSlides[deckSlides.length - 1] ?? slide;
  const previousSlideTitle = previousSlide ? getSlideDisplayTitle(previousSlide, language) : "";
  const nextSlideTitle = nextSlide ? getSlideDisplayTitle(nextSlide, language) : "";
  const deckFirstSlideTitle = getSlideDisplayTitle(deckFirstSlide, language);
  const deckLastSlideTitle = getSlideDisplayTitle(deckLastSlide, language);
  const speakerNotes =
    slide.speakerNotes || (language === "zh" ? "暂无讲者备注。" : "No speaker notes were extracted.");

  if (language === "zh") {
    const contextSummaryLabel = contextMode === "deck" ? "全稿大纲上下文" : `${contextLabel}上下文`;
    const contextEvidence =
      contextMode === "current"
        ? `来源页：${sourceSlideLabels.join("、")}。`
        : contextMode === "nearby"
          ? [
              `来源页：${sourceSlideLabels.join("、")}。`,
              previousSlide
                ? `前一页承接：${previousSlideTitle} 提供了「${getGeneratedSlideSummary(previousSlide.summary, previousSlide.pageNumber, language)}」。`
                : "",
              nextSlide
                ? `后一页去向：${nextSlideTitle} 会继续落到「${getGeneratedSlideSummary(nextSlide.summary, nextSlide.pageNumber, language)}」。`
                : "",
            ]
              .filter(Boolean)
              .join("\n")
          : [
              `来源：全稿 ${deckSlides.length} 页标题/摘要大纲。`,
              `大纲路径：从 ${deckFirstSlideTitle} 开场，到 ${deckLastSlideTitle} 收束。`,
              `当前页位于「${sectionLabel}」章节，作用是把局部判断接回整体故事线。`,
            ].join("\n");
    const contextRisk =
      contextMode === "current"
        ? `风险：如果「${firstBullet}」推进速度低于预期，页面结论会变弱。${speakerNotes}`
        : contextMode === "nearby"
          ? `风险：如果本页和前后页之间的承接不够清楚，听众会把「${firstBullet}」当成孤立事项。${speakerNotes}`
          : `风险：如果本页结论无法支撑最后的行动请求，演示文稿会出现“看懂了但不知道要批准什么”的断点。${speakerNotes}`;
    const citationLines = formatCitationLines(contextSlides, language);
    const titles: Record<QuickActionId, string> = {
      explain: `${slideLabel} · 逐页解释`,
      summary: `${slideLabel} · 摘要`,
      script: `${slideLabel} · 讲稿草案`,
      review: `${slideLabel} · 风险与追问`,
    };
    const summaries: Record<QuickActionId, string> = {
      explain: `基于${contextSummaryLabel}，这页的主线是：${slideSummary}`,
      summary: `这页可以压缩成一个判断：${slideSummary}`,
      script: `这页适合讲成“从判断到证据”的短段落，先说 ${slideTitle}，再落到 ${primaryMetricLabel}。`,
      review: `这页最值得审阅的是「${firstBullet}」带来的执行压力，以及它背后的假设是否足够稳定。`,
    };

    return {
      title: titles[mode],
      summary: summaries[mode],
      prompt,
      contextNote,
      sourceSlideLabels,
      sourceSlideText: formatPromptSourceSlides(contextMode, contextSlides, language),
      sections: [
        {
          id: "takeaway",
          titleKey: "ai.resultTakeaway",
          shortTitleKey: "ai.resultTakeawayShort",
          content:
            mode === "script"
              ? `讲稿主线：${slideTitle} 这一页把演示文稿推进到一个具体判断。先点出 ${kickerLabel}，再说明为什么 ${zhBullets} 是当前重点。\n${contextNote}`
              : `核心结论：${slideSummary} 这页不是孤立信息，更像是 ${sectionLabel} 部分里的一个判断节点。\n${contextNote}`,
        },
        {
          id: "evidence",
          titleKey: "ai.resultEvidence",
          shortTitleKey: "ai.resultEvidenceShort",
          content: `关键指标：${primaryMetricLabel} 为 ${primaryMetric.value}。\n支撑点：${zhBullets}。\n页面线索：${slideVisualSummary}\n${contextEvidence}`,
        },
        {
          id: "review",
          titleKey: "ai.resultReview",
          shortTitleKey: "ai.resultReviewShort",
          content:
            `${contextRisk}\n` +
            `追问：1. ${primaryMetric.value} 背后的假设是什么？2. 谁负责推进「${firstBullet}」？3. 如果图表趋势下季度放缓，结论需要怎样调整？`,
        },
        {
          id: "citation",
          titleKey: "ai.resultCitation",
          shortTitleKey: "ai.resultCitationShort",
          content: citationLines.join("\n"),
        },
      ],
    };
  }

  const contextEvidence =
    contextMode === "current"
      ? `Source slide: ${sourceSlideLabels.join(", ")}.`
      : contextMode === "nearby"
        ? [
            `Source slides: ${sourceSlideLabels.join(", ")}.`,
            previousSlide
              ? `Before: ${previousSlideTitle} frames "${getGeneratedSlideSummary(previousSlide.summary, previousSlide.pageNumber, language)}."`
              : "",
            nextSlide
              ? `After: ${nextSlideTitle} carries the story toward "${getGeneratedSlideSummary(nextSlide.summary, nextSlide.pageNumber, language)}."`
              : "",
          ]
            .filter(Boolean)
            .join("\n")
        : [
            `Source: ${deckSlides.length}-slide title/summary outline.`,
            `Outline path: opens with ${deckFirstSlideTitle} and closes with ${deckLastSlideTitle}.`,
            `This page sits in the ${sectionLabel} section and reconnects the local point to the deck narrative.`,
          ].join("\n");
  const contextRisk =
    contextMode === "current"
      ? `Risk: If "${firstBullet}" moves slower than expected, the page's conclusion weakens. ${speakerNotes}`
      : contextMode === "nearby"
        ? `Risk: If the handoff around this page is not explicit, the audience may treat "${firstBullet}" as an isolated issue. ${speakerNotes}`
        : `Risk: If this page does not support the final operating ask, the deck may be clear but not decision-ready. ${speakerNotes}`;
  const citationLines = formatCitationLines(contextSlides, language);
  const titles: Record<QuickActionId, string> = {
    explain: `${slideLabel} · Explanation`,
    summary: `${slideLabel} · Summary`,
    script: `${slideLabel} · Speaker draft`,
    review: `${slideLabel} · Risks & questions`,
  };
  const summaries: Record<QuickActionId, string> = {
    explain: `Using the ${contextLabel} context, this page says: ${slideSummary}`,
    summary: `Decision note: ${slideSummary}`,
    script: `This should be spoken as a short judgment-to-evidence passage: start with ${slideTitle}, then land ${primaryMetricLabel}.`,
    review: `The sharp review point is whether "${firstBullet}" is supported strongly enough to survive audience challenge.`,
  };

  return {
    title: titles[mode],
    summary: summaries[mode],
    prompt,
    contextNote,
    sourceSlideLabels,
    sourceSlideText: formatPromptSourceSlides(contextMode, contextSlides, language),
    sections: [
      {
        id: "takeaway",
        titleKey: "ai.resultTakeaway",
        shortTitleKey: "ai.resultTakeawayShort",
        content:
          mode === "script"
            ? `Talk track: ${slideTitle} moves the deck into a specific judgment. Start with ${kickerLabel}, then explain why ${enBullets} are the operating focus.\n${contextNote}`
            : `Core takeaway: ${slideSummary} This is less a standalone fact and more a decision point inside the ${sectionLabel} section.\n${contextNote}`,
      },
      {
        id: "evidence",
        titleKey: "ai.resultEvidence",
        shortTitleKey: "ai.resultEvidenceShort",
        content: `Key metric: ${primaryMetricLabel} is ${primaryMetric.value}.\nSupport points: ${slide.bullets.join(", ") || "None"}.\nPage cue: ${slideVisualSummary}\n${contextEvidence}`,
      },
      {
        id: "review",
        titleKey: "ai.resultReview",
        shortTitleKey: "ai.resultReviewShort",
        content:
          `${contextRisk}\n` +
          `Questions: 1. What assumption sits behind ${primaryMetric.value}? 2. Who owns "${firstBullet}"? 3. How would the conclusion change if the chart trend slows next quarter?`,
      },
      {
        id: "citation",
        titleKey: "ai.resultCitation",
        shortTitleKey: "ai.resultCitationShort",
        content: citationLines.join("\n"),
      },
    ],
  };
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
  deckSlides = slides,
  language,
  slide,
  t,
}: {
  deckSlides?: Slide[];
  language: Language;
  slide: Slide;
  t: (key: TranslationKey) => string;
}) {
  const persistedState = readAIInspectorState();
  const messages = persistedState.messagesBySlideId?.[slide.id] ?? emptyMessages;
  const assistantMessages = getLatestAssistantMessagesByAction(messages);
  const customAssistantMessages = getRecentCustomAssistantMessages(messages);

  if (assistantMessages.length === 0 && customAssistantMessages.length === 0) return [];

  const emptyValue = getMarkdownEmptyValue(language);
  const sectionLabel = getSlideSectionLabel(slide.section, language);
  const formatExportAIContent = (value: string) => formatMarkdownCodeBlock(clipAIExportText(value, language), emptyValue);

  return [
    `### ${t("ai.generated")}`,
    "",
    ...assistantMessages.flatMap((message) => {
      const result = buildAssistantResult(
        slide,
        getAssistantPromptForLanguage({
          deckSlides,
          language,
          message,
          slide,
        }),
        message.contextMode,
        language,
        sectionLabel,
        message.action,
        deckSlides,
        message,
      );

      return [
        `#### ${formatMarkdownInline(result.title, emptyValue)}`,
        "",
        formatMarkdownInline(result.summary, emptyValue),
        "",
        `- ${t("ai.context")}: ${formatMarkdownInline(result.contextNote, emptyValue)}`,
        `- ${t("ai.sources")}: ${formatMarkdownInline(result.sourceSlideText, emptyValue)}`,
        "",
        ...result.sections.flatMap((section) => [
          `##### ${t(section.titleKey)}`,
          ...formatExportAIContent(section.content),
          "",
        ]),
      ];
    }),
    ...(customAssistantMessages.length > 0
      ? [
          `#### ${t("ai.customQuestions")}`,
          "",
          ...customAssistantMessages.flatMap((message) => {
            const result = buildAssistantResult(
              slide,
              getAssistantPromptForLanguage({
                deckSlides,
                language,
                message,
                slide,
              }),
              message.contextMode,
              language,
              sectionLabel,
              message.action,
              deckSlides,
              message,
            );

            return [
              `##### ${formatMarkdownInline(message.prompt, emptyValue)}`,
              "",
              formatMarkdownInline(result.summary, emptyValue),
              "",
              `- ${t("ai.context")}: ${formatMarkdownInline(result.contextNote, emptyValue)}`,
              `- ${t("ai.sources")}: ${formatMarkdownInline(result.sourceSlideText, emptyValue)}`,
              "",
              ...result.sections.flatMap((section) => [
                `###### ${t(section.titleKey)}`,
                ...formatExportAIContent(section.content),
                "",
              ]),
            ];
          }),
        ]
      : []),
  ];
}
