"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type { Slide } from "@/lib/mock-data";

export type Language = "zh" | "en";
export type ThemeMode = "light" | "dark";

const dictionaries = {
  en: {
    "app.subtitle": "PPT reading workspace",
    "app.tagline": "Ask every PPT page like a focused room.",
    "home.uploadPpt": "Upload PPT",
    "home.openDemoDeck": "Open sample deck",
    "home.recent": "Recent",
    "home.recentHint": "Local deck drawer",
    "home.clearRecent": "Clear recent decks",
    "home.openRecent": "Open recent deck",
    "home.sampleDeck": "Sample deck",
    "home.readyDeck": "Open",
    "home.processingDeck": "Processing",
    "home.mvp": "Workspace preview",
    "home.enterWorkspace": "Enter workspace",
    "home.uploadTitle": "Upload a PPT deck",
    "home.uploadDescription":
      "PPT and PPTX files become slide-by-slide rooms for reading, citations, and focused questions.",
    "home.chooseFile": "Choose file",
    "home.waiting": "Waiting for upload",
    "home.processing": "Processing deck",
    "home.ready": "Deck is ready",
    "home.openWorkspace": "Open workspace",
    "home.simulate": "Preview sample flow",
    "home.invalidFile": "Unsupported file type",
    "home.invalidFileHint": "Choose a .ppt or .pptx file to continue.",
    "home.uploadFailedHint": "The PPT could not be saved locally. Try another file.",
    "home.uploadErrorEmpty": "This file is empty. Choose a PPT with slide content.",
    "home.uploadErrorTooLarge": "This file is over the 50 MB local preview limit.",
    "home.uploadErrorMissing": "No PPT file was attached. Choose a file to continue.",
    "home.uploadErrorUnsupported": "Only .ppt and .pptx files are supported.",
    "home.uploadAnother": "Choose another file",
    "home.processingHint": "Rendering previews and extracting local text/notes. AI runs only when you ask.",
    "home.readyHint": "Slides are ready. Deep AI analysis stays on-demand and cached.",
    "home.fileTypes": "PPT / PPTX only",
    "home.contextParsed": "Text extraction ready",
    "home.contextPartial": "Partial page context",
    "home.contextPreviewOnly": "Preview-only import",
    "home.contextFailed": "Parsing needs review",
    "processing.upload": "Upload",
    "processing.convert": "Parse",
    "processing.render": "Preview",
    "processing.extract": "Local text",
    "processing.index": "Defer AI",
    "processing.ready": "Ready",
    "processing.title": "Processing deck",
    "processing.subtitle": "Rendering previews and extracting local text. AI waits for user action.",
    "processing.file": "File",
    "processing.pipeline": "Pipeline",
    "processing.pages": "Pages",
    "processing.pageReady": "Ready",
    "processing.pageProcessing": "Processing",
    "processing.pageQueued": "Queued",
    "processing.autoOpen": "Opening workspace",
    "processing.openNow": "Open workspace",
    "processing.preparingWorkspace": "Preparing workspace",
    "processing.backHome": "Back home",
    "common.slides": "slides",
    "common.ready": "Ready",
    "common.search": "Search",
    "common.aiActions": "AI actions",
    "common.export": "Export",
    "common.exportDeckNotes": "Export deck notes",
    "common.copy": "Copy",
    "common.copied": "Copied",
    "common.copyFailed": "Copy failed",
    "common.summary": "Summary",
    "common.keyPoints": "Key points",
    "common.metrics": "Metrics",
    "common.visualSummary": "Visual summary",
    "common.speakerNotes": "Speaker notes",
    "common.extractedText": "Extracted text",
    "common.textSlides": "Text slides",
    "common.noteSlides": "Note slides",
    "common.parseStatus": "Parse status",
    "common.totalSlides": "Total slides",
    "common.settings": "Settings",
    "common.close": "Close",
    "common.section": "Section",
    "common.themeLight": "Switch to day theme",
    "common.themeDark": "Switch to night theme",
    "common.day": "Day",
    "common.night": "Night",
    "common.language": "Switch language",
    "common.languageLabel": "Language",
    "common.englishFull": "English",
    "common.chineseFull": "Chinese",
    "common.theme": "Theme",
    "common.clearSearch": "Clear search",
    "common.english": "EN",
    "common.chinese": "中",
    "settings.aiShort": "AI",
    "settings.aiProvider": "AI provider",
    "settings.aiProviderHint": "Stored locally in this browser. Opening a deck will not call the model automatically.",
    "settings.configured": "Configured",
    "settings.notConfigured": "Local only",
    "settings.apiKey": "API key",
    "settings.apiKeyPlaceholder": "sk-... or provider key",
    "settings.baseUrl": "Base URL",
    "settings.baseUrlPlaceholder": "https://api.openai.com/v1",
    "settings.model": "Model",
    "settings.modelPlaceholder": "Choose later or enter a model name",
    "settings.showKey": "Show API key",
    "settings.hideKey": "Hide API key",
    "settings.saveAISettings": "Save AI settings",
    "settings.clearAISettings": "Clear",
    "settings.saved": "Saved locally",
    "settings.tokenPolicy": "Token policy",
    "settings.tokenPolicyHint": "Upload is lightweight; expensive AI work is delayed until the user asks for it.",
    "settings.policyOnDemand": "On demand",
    "settings.policyOnDemandHint": "Only generate the selected slide, preset, or question. Recommended for MVP.",
    "settings.policyWarmCurrent": "Warm current",
    "settings.policyWarmCurrentHint": "Prepare the active slide after opening; nearby/deck work still waits.",
    "settings.policyFullDeck": "Full deck",
    "settings.policyFullDeckHint": "Build embeddings and visual summaries for every slide. Useful later, expensive now.",
    "settings.requiredNow": "Must do at upload",
    "settings.requiredNowHint": "Save file, render/preview pages, extract raw text and speaker notes locally.",
    "settings.deferredAI": "Can wait",
    "settings.deferredAIHint": "Visual summaries, embeddings, chart interpretation, and deck-wide reasoning.",
    "command.title": "Command menu",
    "command.placeholder": "Search slides or actions",
    "command.slides": "Slides",
    "command.actions": "Actions",
    "command.searchRail": "Search in slide rail",
    "command.exportDeck": "Export deck notes",
    "command.empty": "No matching slides or actions",
    "workspace.exported": "Exported",
    "workspace.appearance": "Appearance",
    "workspace.deckStatus": "Deck status",
    "workspace.contextQuality": "Context quality",
    "workspace.readyForQuestions": "Ready for questions",
    "workspace.showSlideRail": "Show slide rail",
    "workspace.hideSlideRail": "Hide slide rail",
    "workspace.showInspector": "Show AI inspector",
    "workspace.hideInspector": "Hide AI inspector",
    "rail.slides": "Slides",
    "rail.thumbnails": "Thumbnails",
    "rail.outline": "Outline",
    "rail.sectionCount": "sections",
    "rail.search": "Search slides",
    "rail.matches": "matches",
    "rail.noResults": "No slides found",
    "stage.slide": "Slide",
    "stage.pptNote": "PPT note",
    "stage.contextPanel": "Slide context",
    "stage.noSpeakerNotes": "No speaker notes extracted.",
    "stage.noExtractedText": "No extracted text available.",
    "stage.noKeyPoints": "No key points extracted yet.",
    "stage.noMetrics": "No metrics detected yet.",
    "slideArt.text": "Text",
    "slideArt.notes": "Notes",
    "slideArt.context": "Context",
    "slideArt.signal": "Signal",
    "slideArt.ready": "Ready",
    "slideArt.emptySummary": "This page is ready for page-specific questions. No extracted text was found yet.",
    "slideArt.importedVisualReady": "Imported slide with extracted text ready for page-level reading and questions.",
    "slideArt.importedVisualPlaceholder": "Imported slide placeholder. Full image rendering can be connected after the local renderer is enabled.",
    "slideArt.importedPpt": "Imported PPT page",
    "slideArt.importedPptx": "Imported PPTX page",
    "slideArt.untitledSlide": "Untitled slide",
    "section.opening": "Opening",
    "section.market": "Market",
    "section.product": "Product",
    "section.revenue": "Revenue",
    "section.risks": "Risks",
    "section.close": "Close",
    "section.imported": "Imported",
    "stage.zoomOut": "Zoom out",
    "stage.zoomIn": "Zoom in",
    "stage.fit": "Fit",
    "ai.inspector": "AI Inspector",
    "ai.asking": "Focused on",
    "ai.currentSlide": "Current slide",
    "ai.nearbySlides": "Nearby slides",
    "ai.wholeDeck": "Whole deck",
    "ai.current": "Current",
    "ai.nearby": "Nearby",
    "ai.deck": "Deck",
    "ai.explain": "Explain",
    "ai.summary": "Summary",
    "ai.script": "Script",
    "ai.review": "Review",
    "ai.explainShort": "Explain",
    "ai.summaryShort": "Brief",
    "ai.scriptShort": "Script",
    "ai.reviewShort": "Review",
    "ai.explainHint": "Read the logic, intent, and audience takeaway.",
    "ai.summaryHint": "Compress the slide into a brief decision note.",
    "ai.scriptHint": "Shape this page into a presenter-ready talk track.",
    "ai.reviewHint": "Surface risks, assumptions, and sharper follow-ups.",
    "ai.preset": "Preset",
    "ai.runPreset": "Generate",
    "ai.result": "Result",
    "ai.notes": "AI notes",
    "ai.generated": "Insight",
    "ai.generatedStatus": "Generated",
    "ai.notGenerated": "Not generated",
    "ai.emptyResult": "No result for this preset yet",
    "ai.emptyResultHint": "Generate this preset to create a focused answer for the current slide.",
    "ai.resultTakeaway": "Takeaway",
    "ai.resultEvidence": "Evidence",
    "ai.resultReview": "Risks & questions",
    "ai.resultCitation": "Citation",
    "ai.resultTakeawayShort": "Core",
    "ai.resultEvidenceShort": "Proof",
    "ai.resultReviewShort": "Risk",
    "ai.resultCitationShort": "Cite",
    "ai.sections": "sections",
    "ai.memory": "Slide memory",
    "ai.memoryCompact": "Context locked to this slide.",
    "ai.history": "Question history",
    "ai.closeHistory": "Close history",
    "ai.noHistory": "No questions yet",
    "ai.latest": "Latest",
    "ai.viewTurn": "View turn",
    "ai.turns": "turns",
    "ai.clear": "Clear",
    "ai.confirmClear": "Confirm clear",
    "ai.confirmClearConversation": "Confirm clearing this slide conversation",
    "ai.clearConversation": "Clear this slide conversation",
    "ai.welcome": "Current slide context is locked. Ask about the story, chart, review points, or speaker notes.",
    "ai.askPlaceholder": "Ask",
    "ai.context": "Context",
    "ai.sources": "Sources",
    "ai.promptTrace": "Prompt trace",
    "ai.contextPrompt": "Context / prompt",
    "ai.ask": "Ask",
    "ai.copyResult": "Copy result",
    "prompt.explain": "Explain this slide.",
    "prompt.summary": "Summarize this slide.",
    "prompt.script": "Generate speaker notes for this slide.",
    "prompt.review": "Review risks and useful questions for this slide.",
  },
  zh: {
    "app.subtitle": "PPT 逐页阅读工作台",
    "app.tagline": "像进入房间一样询问每一页 PPT。",
    "home.uploadPpt": "上传 PPT",
    "home.openDemoDeck": "打开示例文稿",
    "home.recent": "最近打开",
    "home.recentHint": "本地文稿抽屉",
    "home.clearRecent": "清空最近文稿",
    "home.openRecent": "打开最近文稿",
    "home.sampleDeck": "示例文稿",
    "home.readyDeck": "打开",
    "home.processingDeck": "处理中",
    "home.mvp": "工作台预览",
    "home.enterWorkspace": "进入工作台",
    "home.uploadTitle": "上传一份 PPT",
    "home.uploadDescription": "PPT 和 PPTX 会被拆成逐页空间，用于阅读、引用和精准提问。",
    "home.chooseFile": "选择文件",
    "home.waiting": "等待上传",
    "home.processing": "正在处理演示文稿",
    "home.ready": "演示文稿已就绪",
    "home.openWorkspace": "打开工作台",
    "home.simulate": "体验示例流程",
    "home.invalidFile": "不支持的文件类型",
    "home.invalidFileHint": "请选择 .ppt 或 .pptx 文件继续。",
    "home.uploadFailedHint": "PPT 无法保存到本地，请换一份文件再试。",
    "home.uploadErrorEmpty": "这个文件是空的，请选择包含幻灯片内容的 PPT。",
    "home.uploadErrorTooLarge": "文件超过 50 MB 本地预览上限。",
    "home.uploadErrorMissing": "没有附加 PPT 文件，请选择文件继续。",
    "home.uploadErrorUnsupported": "仅支持 .ppt 和 .pptx 文件。",
    "home.uploadAnother": "重新选择文件",
    "home.processingHint": "正在生成预览并提取本地文字/备注；AI 只在你提问或点击生成时运行。",
    "home.readyHint": "幻灯片已准备好；深度 AI 分析会按需生成并缓存。",
    "home.fileTypes": "仅支持 PPT / PPTX",
    "home.contextParsed": "文字提取已就绪",
    "home.contextPartial": "部分页面上下文",
    "home.contextPreviewOnly": "仅占位预览",
    "home.contextFailed": "解析需要复查",
    "processing.upload": "上传",
    "processing.convert": "解析",
    "processing.render": "预览",
    "processing.extract": "本地文本",
    "processing.index": "延后 AI",
    "processing.ready": "就绪",
    "processing.title": "正在处理演示文稿",
    "processing.subtitle": "正在生成预览并提取本地文本；AI 等你提问或点击生成时再运行。",
    "processing.file": "文件",
    "processing.pipeline": "处理流程",
    "processing.pages": "页面",
    "processing.pageReady": "就绪",
    "processing.pageProcessing": "处理中",
    "processing.pageQueued": "排队中",
    "processing.autoOpen": "即将进入工作台",
    "processing.openNow": "打开工作台",
    "processing.preparingWorkspace": "准备工作台",
    "processing.backHome": "返回首页",
    "common.slides": "页",
    "common.ready": "就绪",
    "common.search": "搜索",
    "common.aiActions": "AI 动作",
    "common.export": "导出",
    "common.exportDeckNotes": "导出整份笔记",
    "common.copy": "复制",
    "common.copied": "已复制",
    "common.copyFailed": "复制失败",
    "common.summary": "摘要",
    "common.keyPoints": "要点",
    "common.metrics": "指标",
    "common.visualSummary": "视觉摘要",
    "common.speakerNotes": "讲者备注",
    "common.extractedText": "提取文字",
    "common.textSlides": "文字页数",
    "common.noteSlides": "备注页数",
    "common.parseStatus": "解析状态",
    "common.totalSlides": "总页数",
    "common.settings": "设置",
    "common.close": "关闭",
    "common.section": "章节",
    "common.themeLight": "切换到白天主题",
    "common.themeDark": "切换到黑夜主题",
    "common.day": "白天",
    "common.night": "黑夜",
    "common.language": "切换语言",
    "common.languageLabel": "语言",
    "common.englishFull": "英文",
    "common.chineseFull": "中文",
    "common.theme": "主题",
    "common.clearSearch": "清除搜索",
    "common.english": "EN",
    "common.chinese": "中",
    "settings.aiShort": "AI",
    "settings.aiProvider": "AI 接入",
    "settings.aiProviderHint": "仅保存在当前浏览器本地；打开文稿不会自动调用模型。",
    "settings.configured": "已配置",
    "settings.notConfigured": "本地预览",
    "settings.apiKey": "API Key",
    "settings.apiKeyPlaceholder": "sk-... 或其他服务商 Key",
    "settings.baseUrl": "Base URL",
    "settings.baseUrlPlaceholder": "https://api.openai.com/v1",
    "settings.model": "模型",
    "settings.modelPlaceholder": "可先留空，之后输入模型名",
    "settings.showKey": "显示 API Key",
    "settings.hideKey": "隐藏 API Key",
    "settings.saveAISettings": "保存 AI 配置",
    "settings.clearAISettings": "清空",
    "settings.saved": "已保存到本地",
    "settings.tokenPolicy": "Token 策略",
    "settings.tokenPolicyHint": "上传阶段保持轻量；真正消耗 token 的工作等用户需要时再做。",
    "settings.policyOnDemand": "按需生成",
    "settings.policyOnDemandHint": "只生成当前页、当前预设或当前问题；MVP 推荐。",
    "settings.policyWarmCurrent": "预热当前页",
    "settings.policyWarmCurrentHint": "打开后只准备当前页；邻近页和全局分析仍等待。",
    "settings.policyFullDeck": "全量索引",
    "settings.policyFullDeckHint": "为每页建立 embedding 和视觉摘要；适合后续版本，但现在成本更高。",
    "settings.requiredNow": "上传必须做",
    "settings.requiredNowHint": "保存文件、渲染/预览页面、本地提取文字和讲者备注。",
    "settings.deferredAI": "可以延后",
    "settings.deferredAIHint": "视觉摘要、embedding、图表解读、整份 PPT 推理。",
    "command.title": "命令面板",
    "command.placeholder": "搜索幻灯片或操作",
    "command.slides": "幻灯片",
    "command.actions": "操作",
    "command.searchRail": "在幻灯片栏中搜索",
    "command.exportDeck": "导出文稿笔记",
    "command.empty": "没有匹配的幻灯片或操作",
    "workspace.exported": "已导出",
    "workspace.appearance": "外观",
    "workspace.deckStatus": "文稿状态",
    "workspace.contextQuality": "上下文质量",
    "workspace.readyForQuestions": "可提问",
    "workspace.showSlideRail": "显示幻灯片栏",
    "workspace.hideSlideRail": "隐藏幻灯片栏",
    "workspace.showInspector": "显示 AI 面板",
    "workspace.hideInspector": "隐藏 AI 面板",
    "rail.slides": "幻灯片",
    "rail.thumbnails": "缩略图",
    "rail.outline": "大纲",
    "rail.sectionCount": "个章节",
    "rail.search": "搜索幻灯片",
    "rail.matches": "条匹配",
    "rail.noResults": "没有匹配的幻灯片",
    "stage.slide": "第",
    "stage.pptNote": "PPT 原始摘要",
    "stage.contextPanel": "当前页上下文",
    "stage.noSpeakerNotes": "未提取到讲者备注。",
    "stage.noExtractedText": "暂无提取文字。",
    "stage.noKeyPoints": "暂无提取要点。",
    "stage.noMetrics": "暂无识别指标。",
    "slideArt.text": "文字",
    "slideArt.notes": "备注",
    "slideArt.context": "上下文",
    "slideArt.signal": "信号",
    "slideArt.ready": "就绪",
    "slideArt.emptySummary": "这一页已可逐页提问，暂未提取到页面文字。",
    "slideArt.importedVisualReady": "导入页已提取文字，可用于逐页阅读和提问。",
    "slideArt.importedVisualPlaceholder": "导入页占位预览。启用本地渲染器后可接入完整页面图像。",
    "slideArt.importedPpt": "导入 PPT 页",
    "slideArt.importedPptx": "导入 PPTX 页",
    "slideArt.untitledSlide": "未命名页",
    "section.opening": "开场",
    "section.market": "市场",
    "section.product": "产品",
    "section.revenue": "收入",
    "section.risks": "风险",
    "section.close": "收束",
    "section.imported": "导入页",
    "stage.zoomOut": "缩小",
    "stage.zoomIn": "放大",
    "stage.fit": "适配",
    "ai.inspector": "AI 面板",
    "ai.asking": "聚焦",
    "ai.currentSlide": "当前页",
    "ai.nearbySlides": "邻近页",
    "ai.wholeDeck": "整份 PPT",
    "ai.current": "当前",
    "ai.nearby": "邻近",
    "ai.deck": "全局",
    "ai.explain": "解释",
    "ai.summary": "总结",
    "ai.script": "讲稿",
    "ai.review": "风险与追问",
    "ai.explainShort": "解释",
    "ai.summaryShort": "总结",
    "ai.scriptShort": "讲稿",
    "ai.reviewShort": "审阅",
    "ai.explainHint": "阅读这一页的逻辑、意图和听众应带走的判断。",
    "ai.summaryHint": "把页面压缩成一条简短的决策备注。",
    "ai.scriptHint": "整理成可以直接讲给听众的讲稿线索。",
    "ai.reviewHint": "找出风险、隐含假设和更锋利的追问。",
    "ai.preset": "预设",
    "ai.runPreset": "生成",
    "ai.result": "结果",
    "ai.notes": "AI 备注",
    "ai.generated": "分析结果",
    "ai.generatedStatus": "已生成",
    "ai.notGenerated": "未生成",
    "ai.emptyResult": "当前预设还没有结果",
    "ai.emptyResultHint": "生成当前预设后，这里只展示它对应的当前页结果。",
    "ai.resultTakeaway": "结论",
    "ai.resultEvidence": "依据",
    "ai.resultReview": "风险与追问",
    "ai.resultCitation": "引用",
    "ai.resultTakeawayShort": "结论",
    "ai.resultEvidenceShort": "依据",
    "ai.resultReviewShort": "风险",
    "ai.resultCitationShort": "引用",
    "ai.sections": "层",
    "ai.memory": "当前页记忆",
    "ai.memoryCompact": "上下文仍锁定在当前页。",
    "ai.history": "提问历史",
    "ai.closeHistory": "关闭历史",
    "ai.noHistory": "还没有提问",
    "ai.latest": "最新",
    "ai.viewTurn": "查看这一轮",
    "ai.turns": "轮",
    "ai.clear": "清空",
    "ai.confirmClear": "确认清空",
    "ai.confirmClearConversation": "确认清空当前页对话",
    "ai.clearConversation": "清空当前页对话",
    "ai.welcome": "当前页上下文已锁定。可以询问故事线、图表、风险与追问或讲稿。",
    "ai.askPlaceholder": "询问",
    "ai.context": "上下文",
    "ai.sources": "来源",
    "ai.promptTrace": "Prompt 追溯",
    "ai.contextPrompt": "上下文 / Prompt",
    "ai.ask": "提问",
    "ai.copyResult": "复制结果",
    "prompt.explain": "解释这一页。",
    "prompt.summary": "总结这一页。",
    "prompt.script": "生成这一页的讲稿。",
    "prompt.review": "审阅这一页的风险和追问。",
  },
} as const;

export type TranslationKey = keyof typeof dictionaries.en;

type PreferencesContextValue = {
  language: Language;
  theme: ThemeMode;
  setLanguage: (language: Language) => void;
  setTheme: (theme: ThemeMode) => void;
  toggleLanguage: () => void;
  toggleTheme: () => void;
  t: (key: TranslationKey) => string;
};

const PreferencesContext = createContext<PreferencesContextValue | null>(null);

const languageStorageKey = "slideroom-language";
const themeStorageKey = "slideroom-theme";
let themeTransitionTimerId: number | null = null;

function readStoredPreference(key: string) {
  if (typeof window === "undefined") return null;

  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeStoredPreference(key: string, value: string) {
  if (typeof window === "undefined") return;

  try {
    window.localStorage.setItem(key, value);
  } catch {
    // Storage can be unavailable in private mode or constrained environments.
  }
}

function readCookiePreference(key: string) {
  if (typeof document === "undefined") return null;

  try {
    const cookie = document.cookie
      .split("; ")
      .find((item) => item.startsWith(`${key}=`));

    return cookie ? decodeURIComponent(cookie.slice(key.length + 1)) : null;
  } catch {
    return null;
  }
}

function writeCookiePreference(key: string, value: string) {
  if (typeof document === "undefined") return;

  try {
    document.cookie = `${key}=${encodeURIComponent(value)}; path=/; max-age=31536000; SameSite=Lax`;
  } catch {
    // Cookies can be unavailable in private mode or constrained environments.
  }
}

function isLanguage(value: string | null): value is Language {
  return value === "zh" || value === "en";
}

function isTheme(value: string | null): value is ThemeMode {
  return value === "light" || value === "dark";
}

function getInitialLanguage(): Language {
  if (typeof window === "undefined") return "zh";

  const stored = readStoredPreference(languageStorageKey);
  if (isLanguage(stored)) return stored;

  const cookie = readCookiePreference(languageStorageKey);
  if (isLanguage(cookie)) return cookie;

  return window.navigator.language.toLowerCase().startsWith("zh") ? "zh" : "en";
}

function getInitialTheme(): ThemeMode {
  if (typeof window === "undefined") return "light";

  const stored = readStoredPreference(themeStorageKey);
  if (isTheme(stored)) return stored;

  const cookie = readCookiePreference(themeStorageKey);
  if (isTheme(cookie)) return cookie;

  try {
    return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  } catch {
    return "light";
  }
}

function applyTheme(theme: ThemeMode, withTransition: boolean) {
  const root = document.documentElement;

  if (withTransition) {
    if (themeTransitionTimerId !== null) {
      window.clearTimeout(themeTransitionTimerId);
    }

    root.classList.add("theme-transition");
    themeTransitionTimerId = window.setTimeout(() => {
      root.classList.remove("theme-transition");
      themeTransitionTimerId = null;
    }, 420);
  }

  root.classList.toggle("dark", theme === "dark");
  root.dataset.theme = theme;
  root.style.colorScheme = theme;
}

type PreferencesProviderProps = {
  children: ReactNode;
  initialLanguage?: Language;
  initialTheme?: ThemeMode;
};

export function PreferencesProvider({
  children,
  initialLanguage = "zh",
  initialTheme = "light",
}: PreferencesProviderProps) {
  const [language, setLanguageState] = useState<Language>(initialLanguage);
  const [theme, setThemeState] = useState<ThemeMode>(initialTheme);
  const [preferencesRestored, setPreferencesRestored] = useState(false);
  const shouldAnimateTheme = useRef(false);

  useEffect(() => {
    if (!preferencesRestored) return;

    applyTheme(theme, shouldAnimateTheme.current);
    shouldAnimateTheme.current = false;
    document.documentElement.lang = language === "zh" ? "zh-CN" : "en";
  }, [language, preferencesRestored, theme]);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      const nextLanguage = getInitialLanguage();
      const nextTheme = getInitialTheme();

      setLanguageState(nextLanguage);
      setThemeState(nextTheme);
      writeCookiePreference(languageStorageKey, nextLanguage);
      writeCookiePreference(themeStorageKey, nextTheme);
      setPreferencesRestored(true);
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, []);

  const setLanguage = useCallback((nextLanguage: Language) => {
    setPreferencesRestored(true);
    setLanguageState(nextLanguage);
    writeStoredPreference(languageStorageKey, nextLanguage);
    writeCookiePreference(languageStorageKey, nextLanguage);
    document.documentElement.lang = nextLanguage === "zh" ? "zh-CN" : "en";
  }, []);

  const setTheme = useCallback((nextTheme: ThemeMode) => {
    setPreferencesRestored(true);
    shouldAnimateTheme.current = true;
    setThemeState(nextTheme);
    writeStoredPreference(themeStorageKey, nextTheme);
    writeCookiePreference(themeStorageKey, nextTheme);
  }, []);

  const toggleLanguage = useCallback(() => {
    setLanguage(language === "zh" ? "en" : "zh");
  }, [language, setLanguage]);

  const toggleTheme = useCallback(() => {
    setTheme(theme === "light" ? "dark" : "light");
  }, [setTheme, theme]);

  const dictionary = dictionaries[language];
  const t = useCallback(
    (key: TranslationKey) => dictionary[key] ?? key,
    [dictionary],
  );

  const value = useMemo(
    () => ({
      language,
      theme,
      setLanguage,
      setTheme,
      toggleLanguage,
      toggleTheme,
      t,
    }),
    [language, setLanguage, setTheme, t, theme, toggleLanguage, toggleTheme],
  );

  return (
    <PreferencesContext.Provider value={value}>
      {children}
    </PreferencesContext.Provider>
  );
}

export function usePreferences() {
  const context = useContext(PreferencesContext);

  if (!context) {
    throw new Error("usePreferences must be used inside PreferencesProvider");
  }

  return context;
}

export function getSlideSectionKey(section: Slide["section"]): TranslationKey {
  return `section.${section}`;
}

export function getSlideSectionLabel(section: Slide["section"], language: Language) {
  return dictionaries[language][getSlideSectionKey(section)];
}

export function getGeneratedMetricLabel(label: string, language: Language) {
  const normalizedLabel = label.trim().toLowerCase();

  if (normalizedLabel === "text") return dictionaries[language]["slideArt.text"];
  if (normalizedLabel === "context") return dictionaries[language]["slideArt.context"];
  if (normalizedLabel === "signal") return dictionaries[language]["slideArt.signal"];

  return label;
}

export function getGeneratedKickerLabel(kicker: string, language: Language) {
  const normalizedKicker = kicker.trim().toLowerCase();

  if (normalizedKicker === "imported pptx page") return dictionaries[language]["slideArt.importedPptx"];
  if (normalizedKicker === "imported ppt page") return dictionaries[language]["slideArt.importedPpt"];

  return kicker;
}

export function getGeneratedSlideTitle(title: string, pageNumber: number, language: Language) {
  if (/^Slide\s+0?\d+$/i.test(title.trim())) {
    return dictionaries[language]["slideArt.untitledSlide"];
  }

  return title;
}

export function getGeneratedSlideSummary(summary: string, pageNumber: number, language: Language) {
  const normalizedSummary = summary.trim();
  const emptySummaryPattern =
    /^Slide \d{2} is ready for page-specific questions\. Text extraction did not return content for this page yet\.$/;

  if (emptySummaryPattern.test(normalizedSummary)) {
    const separator = language === "zh" ? "：" : ": ";
    return `${formatSlideLabel(pageNumber, language)}${separator}${dictionaries[language]["slideArt.emptySummary"]}`;
  }

  return summary;
}

export function getGeneratedVisualSummary(visualSummary: string, language: Language) {
  const normalizedVisualSummary = visualSummary.trim();

  if (normalizedVisualSummary === dictionaries.en["slideArt.importedVisualReady"]) {
    return dictionaries[language]["slideArt.importedVisualReady"];
  }

  if (normalizedVisualSummary === dictionaries.en["slideArt.importedVisualPlaceholder"]) {
    return dictionaries[language]["slideArt.importedVisualPlaceholder"];
  }

  return visualSummary;
}

export function formatSlideLabel(pageNumber: number, language: Language) {
  const paddedNumber = String(pageNumber).padStart(2, "0");

  return language === "zh" ? `第 ${paddedNumber} 页` : `Slide ${paddedNumber}`;
}
