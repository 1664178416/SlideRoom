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
const maxPersistedTextLength = 12000;
const maxMessagesPerSlide = 32;
const maxPersistedDrafts = 64;
const maxPersistedSlideRecords = 48;

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

      if (message.role === "user" && typeof message.content === "string") {
        items.push({
          id: message.id,
          role: "user",
          content: clipPersistedText(message.content),
          ...(isPromptKey(message.promptKey) ? { promptKey: message.promptKey } : {}),
        });
      }

      if (message.role === "assistant" && typeof message.prompt === "string") {
        items.push({
          id: message.id,
          role: "assistant",
          prompt: clipPersistedText(message.prompt),
          contextMode: isContextMode(message.contextMode) ? message.contextMode : "current",
          ...(isQuickActionId(message.action) ? { action: message.action } : {}),
          ...(isPromptKey(message.promptKey) ? { promptKey: message.promptKey } : {}),
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

  try {
    window.localStorage.setItem(
      aiInspectorStorageKey,
      JSON.stringify({
        contextMode: isContextMode(state.contextMode) ? state.contextMode : undefined,
        draftsBySlideId: sanitizeDrafts(state.draftsBySlideId),
        messagesBySlideId: sanitizeMessages(state.messagesBySlideId),
        selectedActionId: isQuickActionId(state.selectedActionId) ? state.selectedActionId : undefined,
      } satisfies PersistedAIInspectorState),
    );
  } catch {
    // Storage can fail in private mode or when quota is exhausted.
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
    return "整份 PPT";
  }

  if (contextMode === "current") return "current slide";
  if (contextMode === "nearby") return "nearby slides";
  return "whole deck";
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
      return `只读取 ${formatSlideLabel(slide.pageNumber, language)} 的页面内容、视觉摘要、提取文字和讲者备注。`;
    }

    if (contextMode === "nearby") {
      return `同时读取 ${sourceLabels}，用于判断这页的承接、跳转和前后逻辑压力。`;
    }

    return `读取全稿 ${deckSlides.length} 页，并按章节故事线定位 ${formatSlideLabel(slide.pageNumber, language)} 的作用。`;
  }

  if (contextMode === "current") {
    return `Reads only ${formatSlideLabel(slide.pageNumber, language)}: slide content, visual summary, extracted text, and speaker notes.`;
  }

  if (contextMode === "nearby") {
    return `Reads ${sourceLabels} to judge the handoff, transition, and local logic pressure around this slide.`;
  }

  return `Reads the full ${deckSlides.length}-slide deck and places ${formatSlideLabel(slide.pageNumber, language)} inside the section narrative.`;
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
  const sourceSlideLabels = formatSourceSlideLabels(contextSlides, language);
  const contextNote = getContextNote({
    contextMode,
    contextSlides,
    deckSlides,
    language,
    slide,
  });
  const contextOutline = getContextOutline(contextSlides, language);
  const deckSectionOutline = contextMode === "deck" ? getDeckSectionOutline(language, deckSlides) : "";

  const zhInstructions: Record<QuickActionId, string> = {
    explain:
      "解释这一页的业务意图、逻辑链路、隐含判断和听众应该带走的结论。输出分为：结论、依据、风险与追问、引用。",
    summary:
      "把这一页压缩成一条可执行摘要，保留关键指标和支撑点，避免空泛复述。输出分为：结论、依据、风险与追问、引用。",
    script:
      "生成一段可以直接讲给听众的讲稿，语气克制、清晰、有过渡，先讲判断再讲证据。输出分为：结论、依据、风险与追问、引用。",
    review:
      "审阅这一页的风险、隐含假设、可能被挑战的点和更锋利的追问。把风险和问题合并处理。输出分为：结论、依据、风险与追问、引用。",
  };
  const enInstructions: Record<QuickActionId, string> = {
    explain:
      "Explain the business intent, logic chain, implicit judgment, and audience takeaway. Return sections: Takeaway, Evidence, Risks & questions, Citation.",
    summary:
      "Compress this slide into one actionable decision note, preserving the key metric and support points without generic restatement. Return sections: Takeaway, Evidence, Risks & questions, Citation.",
    script:
      "Write a presenter-ready talk track with a restrained, clear voice. Lead with the judgment, then land the evidence. Return sections: Takeaway, Evidence, Risks & questions, Citation.",
    review:
      "Review risks, assumptions, likely challenge points, and sharper follow-up questions. Treat risks and questions as one combined review lane. Return sections: Takeaway, Evidence, Risks & questions, Citation.",
  };

  if (language === "zh") {
    return [
      zhInstructions[action],
      "",
      `上下文范围：${contextLabel}`,
      `上下文说明：${contextNote}`,
      `实际来源页：${sourceSlideLabels}`,
      `页面：${slideLabel}`,
      `标题：${slideTitle}`,
      `章节：${sectionLabel}`,
      `页面摘要：${slideSummary}`,
      `要点：${bullets}`,
      `指标：${metrics}`,
      `视觉摘要：${slideVisualSummary}`,
      `提取文字：${slide.extractedText}`,
      `讲者备注：${slide.speakerNotes || "暂无"}`,
      "",
      "上下文大纲：",
      contextOutline,
      ...(deckSectionOutline ? ["", "全稿章节地图：", deckSectionOutline] : []),
    ].join("\n");
  }

  return [
    enInstructions[action],
    "",
    `Context scope: ${contextLabel}`,
    `Context note: ${contextNote}`,
    `Source slides: ${sourceSlideLabels}`,
    `Slide: ${slideLabel}`,
    `Title: ${slideTitle}`,
    `Section: ${sectionLabel}`,
    `Slide summary: ${slideSummary}`,
    `Bullets: ${bullets}`,
    `Metrics: ${metrics}`,
    `Visual summary: ${slideVisualSummary}`,
    `Extracted text: ${slide.extractedText}`,
    `Speaker notes: ${slide.speakerNotes || "None"}`,
    "",
    "Context outline:",
    contextOutline,
    ...(deckSectionOutline ? ["", "Deck section map:", deckSectionOutline] : []),
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
      message.prompt.includes("实际来源页：") &&
      message.prompt.includes("上下文大纲：")
    ) ||
    (
      message.prompt.includes("Context scope:") &&
      message.prompt.includes("Source slides:") &&
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
): AssistantResult {
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
    const contextSummaryLabel = contextMode === "deck" ? "整份 PPT 上下文" : `${contextLabel}上下文`;
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
              `来源页：${sourceSlideLabels.join("、")}。`,
              `全稿路径：从 ${deckFirstSlideTitle} 开场，到 ${deckLastSlideTitle} 收束。`,
              `当前页位于「${sectionLabel}」章节，作用是把局部判断接回整份 PPT 的故事线。`,
            ].join("\n");
    const contextRisk =
      contextMode === "current"
        ? `风险：如果「${firstBullet}」推进速度低于预期，页面结论会变弱。${speakerNotes}`
        : contextMode === "nearby"
          ? `风险：如果本页和前后页之间的承接不够清楚，听众会把「${firstBullet}」当成孤立事项。${speakerNotes}`
          : `风险：如果本页结论无法支撑最后的行动请求，整份 PPT 会出现“看懂了但不知道要批准什么”的断点。${speakerNotes}`;
    const citationLines = contextSlides.map(
      (contextSlide) =>
        `${formatSlideLabel(contextSlide.pageNumber, language)} · ${getSlideSectionLabel(contextSlide.section, language)} · ${getSlideDisplayTitle(contextSlide, language)}`,
    );
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
      sourceSlideText: formatSourceSlideLabels(contextSlides, language),
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
          content: `关键指标：${primaryMetricLabel} 为 ${primaryMetric.value}。\n支撑点：${zhBullets}。\n视觉线索：${slideVisualSummary}\n${contextEvidence}`,
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
            `Source slides: ${sourceSlideLabels.join(", ")}.`,
            `Deck path: opens with ${deckFirstSlideTitle} and closes with ${deckLastSlideTitle}.`,
            `This page sits in the ${sectionLabel} section and reconnects the local point to the deck narrative.`,
          ].join("\n");
  const contextRisk =
    contextMode === "current"
      ? `Risk: If "${firstBullet}" moves slower than expected, the page's conclusion weakens. ${speakerNotes}`
      : contextMode === "nearby"
        ? `Risk: If the handoff around this page is not explicit, the audience may treat "${firstBullet}" as an isolated issue. ${speakerNotes}`
        : `Risk: If this page does not support the final operating ask, the deck may be clear but not decision-ready. ${speakerNotes}`;
  const citationLines = contextSlides.map(
    (contextSlide) =>
      `${formatSlideLabel(contextSlide.pageNumber, language)} · ${getSlideSectionLabel(contextSlide.section, language)} · ${getSlideDisplayTitle(contextSlide, language)}`,
  );
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
    sourceSlideText: formatSourceSlideLabels(contextSlides, language),
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
        content: `Key metric: ${primaryMetricLabel} is ${primaryMetric.value}.\nSupport points: ${slide.bullets.join(", ") || "None"}.\nVisual cue: ${slideVisualSummary}\n${contextEvidence}`,
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
          message.role === "assistant" && (message.action ?? getResultMode(message.prompt)) === action.id,
      );

    if (latestMessage) {
      items.push(latestMessage);
    }

    return items;
  }, []);
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

  if (assistantMessages.length === 0) return [];

  const emptyValue = getMarkdownEmptyValue(language);
  const sectionLabel = getSlideSectionLabel(slide.section, language);

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
          ...formatMarkdownCodeBlock(section.content, emptyValue),
          "",
        ]),
        `##### ${t("ai.promptTrace")}`,
        ...formatMarkdownCodeBlock(result.prompt, emptyValue),
        "",
      ];
    }),
  ];
}
