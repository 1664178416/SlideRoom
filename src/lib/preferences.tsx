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
    "home.invalidFile": "Unsupported file type",
    "home.invalidFileHint": "Choose a .ppt or .pptx file to continue.",
    "home.uploadFailedHint": "The PPT could not be saved locally. Try another file.",
    "home.uploadErrorEmpty": "This file is empty. Choose a PPT with slide content.",
    "home.uploadErrorTooLarge": "This file is over the 50 MB local preview limit.",
    "home.uploadErrorMissing": "No PPT file was attached. Choose a file to continue.",
    "home.uploadErrorUnsupported": "Only .ppt and .pptx files are supported.",
    "home.uploadAnother": "Choose another file",
    "home.processingHint": "Rendering previews and extracting text/notes locally. No AI summary, embedding, or model call runs until you ask.",
    "home.readyHint": "Slides are ready. AI tags are generated only after you click a preset or ask a question.",
    "home.fileTypes": "PPT / PPTX only",
    "home.contextParsed": "Text extraction ready",
    "home.contextPartial": "Partial page context",
    "home.contextPreviewOnly": "Limited local preview",
    "home.contextFailed": "Parsing needs review",
    "processing.upload": "Upload",
    "processing.convert": "Parse",
    "processing.render": "Preview",
    "processing.extract": "Local text",
    "processing.ready": "Ready",
    "processing.title": "Processing deck",
    "processing.subtitle": "Rendering previews and extracting local text/notes. Upload never calls the model, summarizes, or embeds.",
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
    "common.exportDeckNotes": "Export reading context",
    "common.copy": "Copy",
    "common.copied": "Copied",
    "common.copyFailed": "Copy failed",
    "common.error": "Error",
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
    "settings.modelPlaceholder": "Enter a model name, for example gpt-4o-mini",
    "settings.interfaceMode": "Interface",
    "settings.interfaceAuto": "Auto",
    "settings.interfaceResponses": "Responses",
    "settings.interfaceChat": "Chat",
    "settings.interfaceModeHint": "Auto tries Responses first, then Chat Completions when fallback is allowed.",
    "settings.showKey": "Show API key",
    "settings.hideKey": "Hide API key",
    "settings.saveAISettings": "Save AI settings",
    "settings.clearAISettings": "Clear",
    "settings.saved": "Saved locally",
    "settings.testAISettings": "Test",
    "settings.testingAISettings": "Testing connection",
    "settings.testAISettingsHint": "Send one tiny request to verify the API key, Base URL, and model.",
    "settings.testPassed": "Connection works. AI will run only when you ask.",
    "settings.tokenPolicy": "AI usage",
    "settings.tokenPolicyHint": "Uploading never calls the model. Presets and questions are the only token-spending actions.",
    "settings.onDemand": "On demand",
    "settings.requiredNow": "Must do at upload",
    "settings.requiredNowHint": "Save the file, render/preview pages, and extract raw text plus speaker notes locally.",
    "settings.deferredAI": "Model calls",
    "settings.deferredAIHint": "Right-side presets and custom questions call your configured API only on demand.",
    "command.title": "Command menu",
    "command.placeholder": "Search slides or actions",
    "command.slides": "Slides",
    "command.actions": "Actions",
    "command.searchRail": "Search in slide rail",
    "command.exportDeck": "Export reading context",
    "command.empty": "No matching slides or actions",
    "export.generatedAt": "Exported at",
    "export.aiOnDemand": "Includes only AI tags or answers you generated manually.",
    "workspace.exported": "Exported",
    "workspace.appearance": "Appearance",
    "workspace.deckStatus": "Deck status",
    "workspace.contextQuality": "Context quality",
    "workspace.readyForQuestions": "Ready for questions",
    "workspace.showSlideRail": "Show slide rail",
    "workspace.hideSlideRail": "Hide slide rail",
    "workspace.showInspector": "Show AI inspector",
    "workspace.hideInspector": "Hide AI inspector",
    "workspace.uploadingDeck": "Importing locally",
    "workspace.uploadingDeckHint": "Rendering previews and extracting text/notes locally. No model call is sent.",
    "rail.slides": "Slides",
    "rail.thumbnails": "Thumbnails",
    "rail.outline": "Outline",
    "rail.sectionCount": "sections",
    "rail.search": "Search slides",
    "rail.matches": "matches",
    "rail.noResults": "No slides found",
    "rail.rawExcerpt": "Raw text",
    "rail.rawNotes": "Raw notes",
    "rail.noReadableText": "No readable text",
    "stage.slide": "Slide",
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
    "slideArt.emptySummary": "This page is ready for page-specific questions. No extractable text was found yet.",
    "slideArt.importedVisualReady": "Original preview was exported locally. If fonts differ from PowerPoint, the source file was not modified.",
    "slideArt.importedVisualPlaceholder": "Original preview was not generated on this device. Text and notes still work; the source PPT was not modified.",
    "slideArt.previewUnavailable": "Original preview unavailable",
    "slideArt.importedPpt": "PPT page",
    "slideArt.importedPptx": "PPTX page",
    "slideArt.untitledSlide": "Untitled slide",
    "section.opening": "Opening",
    "section.market": "Market",
    "section.product": "Product",
    "section.revenue": "Revenue",
    "section.risks": "Risks",
    "section.close": "Close",
    "section.imported": "PPT",
    "stage.previousSlide": "Previous slide",
    "stage.nextSlide": "Next slide",
    "stage.zoomOut": "Zoom out",
    "stage.zoomIn": "Zoom in",
    "stage.fit": "Fit",
    "ai.inspector": "AI Inspector",
    "ai.asking": "Focused on",
    "ai.currentSlide": "Current slide",
    "ai.nearbySlides": "Nearby slides",
    "ai.wholeDeck": "Deck outline",
    "ai.current": "Current",
    "ai.nearby": "Nearby",
    "ai.deck": "Outline",
    "ai.explain": "Note",
    "ai.summary": "Brief",
    "ai.script": "Cue",
    "ai.review": "Check",
    "ai.explainShort": "Note",
    "ai.summaryShort": "Brief",
    "ai.scriptShort": "Cue",
    "ai.reviewShort": "Check",
    "ai.explainHint": "Click to get one margin phrase.",
    "ai.summaryHint": "Click to get one skim phrase.",
    "ai.scriptHint": "Click to get one presenter cue.",
    "ai.reviewHint": "Click to get one risk check.",
    "ai.preset": "Preset",
    "ai.runPreset": "Generate",
    "ai.generating": "Generating",
    "ai.otherRequestRunning": "Another slide is waiting for the model.",
    "ai.configureProviderFirst": "Configure API Key, Base URL, and Model in the top AI panel first.",
    "ai.contextUnavailable": "This context has no extracted text or speaker notes yet. AI generation is paused to avoid guessing from the preview image.",
    "ai.presetContextUnavailable": "This slide has no extracted text or speaker notes yet. Preset tags stay paused to avoid guessing.",
    "ai.contextUnavailableShort": "No readable text or notes yet",
    "ai.requestFailed": "AI request failed",
    "ai.result": "Result",
    "ai.notes": "Tag",
    "ai.generated": "AI tag",
    "ai.customQuestions": "Custom questions",
    "ai.generatedStatus": "Generated",
    "ai.notGenerated": "Not generated",
    "ai.pendingStatus": "Pending",
    "ai.emptyResult": "No tag for this preset yet",
    "ai.emptyResultHint": "Click Generate; this panel returns one phrase, not a report.",
    "ai.onDemand": "On demand",
    "ai.resultTakeaway": "Takeaway",
    "ai.resultEvidence": "Evidence",
    "ai.resultReview": "Review",
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
    "ai.contextPrompt": "Context",
    "ai.ask": "Ask",
    "ai.copyResult": "Copy result",
    "prompt.explain": "Create one tiny margin tag.",
    "prompt.summary": "Create one tiny skim tag.",
    "prompt.script": "Create one tiny presenter cue.",
    "prompt.review": "Create one tiny risk-question check.",
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
    "home.invalidFile": "不支持的文件类型",
    "home.invalidFileHint": "请选择 .ppt 或 .pptx 文件继续。",
    "home.uploadFailedHint": "PPT 无法保存到本地，请换一份文件再试。",
    "home.uploadErrorEmpty": "这个文件是空的，请选择包含幻灯片内容的 PPT。",
    "home.uploadErrorTooLarge": "文件超过 50 MB 本地预览上限。",
    "home.uploadErrorMissing": "没有附加 PPT 文件，请选择文件继续。",
    "home.uploadErrorUnsupported": "仅支持 .ppt 和 .pptx 文件。",
    "home.uploadAnother": "重新选择文件",
    "home.processingHint": "正在本地生成预览并提取文字/备注；不会自动做 AI 摘要、embedding 或模型调用。",
    "home.readyHint": "幻灯片已准备好；AI 短签只会在点击预设或提问后生成。",
    "home.fileTypes": "仅支持 PPT / PPTX",
    "home.contextParsed": "文字提取已就绪",
    "home.contextPartial": "部分页面上下文",
    "home.contextPreviewOnly": "本地预览有限",
    "home.contextFailed": "解析需要复查",
    "processing.upload": "上传",
    "processing.convert": "解析",
    "processing.render": "预览",
    "processing.extract": "本地文本",
    "processing.ready": "就绪",
    "processing.title": "正在处理演示文稿",
    "processing.subtitle": "正在本地生成预览并提取文字/备注；上传时不做 AI 摘要、embedding 或模型调用。",
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
    "common.exportDeckNotes": "导出阅读上下文",
    "common.copy": "复制",
    "common.copied": "已复制",
    "common.copyFailed": "复制失败",
    "common.error": "错误",
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
    "settings.modelPlaceholder": "请输入模型名，例如 gpt-4o-mini",
    "settings.interfaceMode": "接口",
    "settings.interfaceAuto": "自动",
    "settings.interfaceResponses": "Responses",
    "settings.interfaceChat": "Chat",
    "settings.interfaceModeHint": "自动模式会先试 Responses；允许回退时再试 Chat Completions。",
    "settings.showKey": "显示 API Key",
    "settings.hideKey": "隐藏 API Key",
    "settings.saveAISettings": "保存 AI 配置",
    "settings.clearAISettings": "清空",
    "settings.saved": "已保存到本地",
    "settings.testAISettings": "测试",
    "settings.testingAISettings": "正在测试连接",
    "settings.testAISettingsHint": "发送一次极短请求，检查 API Key、Base URL 和模型名是否可用。",
    "settings.testPassed": "连接正常；AI 仍只会在你主动提问或生成时运行。",
    "settings.tokenPolicy": "AI 使用",
    "settings.tokenPolicyHint": "上传不会调用模型；只有点击右侧预设或提交问题才会消耗 token。",
    "settings.onDemand": "按需",
    "settings.requiredNow": "上传必须做",
    "settings.requiredNowHint": "保存文件、渲染/预览页面，并在本地提取文字和讲者备注。",
    "settings.deferredAI": "模型调用",
    "settings.deferredAIHint": "右侧预设和自定义问题只会按需调用你配置的 API。",
    "command.title": "命令面板",
    "command.placeholder": "搜索幻灯片或操作",
    "command.slides": "幻灯片",
    "command.actions": "操作",
    "command.searchRail": "在幻灯片栏中搜索",
    "command.exportDeck": "导出阅读上下文",
    "command.empty": "没有匹配的幻灯片或操作",
    "export.generatedAt": "导出时间",
    "export.aiOnDemand": "仅包含你手动生成过的 AI 短签或回答。",
    "workspace.exported": "已导出",
    "workspace.appearance": "外观",
    "workspace.deckStatus": "文稿状态",
    "workspace.contextQuality": "上下文质量",
    "workspace.readyForQuestions": "可提问",
    "workspace.showSlideRail": "显示幻灯片栏",
    "workspace.hideSlideRail": "隐藏幻灯片栏",
    "workspace.showInspector": "显示 AI 面板",
    "workspace.hideInspector": "隐藏 AI 面板",
    "workspace.uploadingDeck": "正在本地导入",
    "workspace.uploadingDeckHint": "正在本地渲染页面并提取文字/备注，不会调用模型。",
    "rail.slides": "幻灯片",
    "rail.thumbnails": "缩略图",
    "rail.outline": "大纲",
    "rail.sectionCount": "个章节",
    "rail.search": "搜索幻灯片",
    "rail.matches": "条匹配",
    "rail.noResults": "没有匹配的幻灯片",
    "rail.rawExcerpt": "原始摘录",
    "rail.rawNotes": "原始备注",
    "rail.noReadableText": "无可读文字",
    "stage.slide": "第",
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
    "slideArt.emptySummary": "这一页已可逐页提问，暂未提取到可读文字。",
    "slideArt.importedVisualReady": "原始预览已由本机导出；若字体显示不同，源 PPT 并未被修改。",
    "slideArt.importedVisualPlaceholder": "当前设备未生成原始预览；文字/备注仍可提问，源 PPT 并未被修改。",
    "slideArt.previewUnavailable": "原始预览不可用",
    "slideArt.importedPpt": "PPT 页",
    "slideArt.importedPptx": "PPTX 页",
    "slideArt.untitledSlide": "未命名页",
    "section.opening": "开场",
    "section.market": "市场",
    "section.product": "产品",
    "section.revenue": "收入",
    "section.risks": "风险",
    "section.close": "收束",
    "section.imported": "PPT",
    "stage.previousSlide": "上一页",
    "stage.nextSlide": "下一页",
    "stage.zoomOut": "缩小",
    "stage.zoomIn": "放大",
    "stage.fit": "适配",
    "ai.inspector": "AI 面板",
    "ai.asking": "聚焦",
    "ai.currentSlide": "当前页",
    "ai.nearbySlides": "邻近页",
    "ai.wholeDeck": "全稿大纲",
    "ai.current": "当前",
    "ai.nearby": "邻近",
    "ai.deck": "大纲",
    "ai.explain": "旁注",
    "ai.summary": "摘要",
    "ai.script": "提示",
    "ai.review": "审阅",
    "ai.explainShort": "旁注",
    "ai.summaryShort": "摘要",
    "ai.scriptShort": "提示",
    "ai.reviewShort": "审阅",
    "ai.explainHint": "点击生成一枚页边短签。",
    "ai.summaryHint": "点击生成一枚扫读短签。",
    "ai.scriptHint": "点击生成一句讲者提示。",
    "ai.reviewHint": "点击生成一个风险检查。",
    "ai.preset": "预设",
    "ai.runPreset": "生成",
    "ai.generating": "生成中",
    "ai.otherRequestRunning": "另一页正在等待模型返回。",
    "ai.configureProviderFirst": "请先在顶部 AI 面板配置 API Key、Base URL 和模型名。",
    "ai.contextUnavailable": "当前上下文还没有提取文字或原始备注。为避免根据预览图猜测，AI 生成已暂停。",
    "ai.presetContextUnavailable": "当前页还没有提取文字或原始备注；为避免猜图，短签生成已暂停。",
    "ai.contextUnavailableShort": "暂无可读文字或备注",
    "ai.requestFailed": "AI 请求失败",
    "ai.result": "结果",
    "ai.notes": "短签",
    "ai.generated": "AI 短签",
    "ai.customQuestions": "自定义提问",
    "ai.generatedStatus": "已生成",
    "ai.notGenerated": "未生成",
    "ai.pendingStatus": "等待中",
    "ai.emptyResult": "当前预设还没有短签",
    "ai.emptyResultHint": "点击生成；这里只返回一句短签，不写报告。",
    "ai.onDemand": "按需",
    "ai.resultTakeaway": "结论",
    "ai.resultEvidence": "依据",
    "ai.resultReview": "审阅",
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
    "ai.contextPrompt": "上下文",
    "ai.ask": "提问",
    "ai.copyResult": "复制结果",
    "prompt.explain": "生成一枚极短旁注标签。",
    "prompt.summary": "生成一枚扫读摘要标签。",
    "prompt.script": "生成一枚讲稿提示标签。",
    "prompt.review": "生成一枚风险追问检查标签。",
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

  if (normalizedKicker === "pptx page") return dictionaries[language]["slideArt.importedPptx"];
  if (normalizedKicker === "ppt page") return dictionaries[language]["slideArt.importedPpt"];
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
    /^Slide \d{2} is ready for page-specific questions\. (?:Text extraction did not return content for this page yet|No extractable text was found yet)\.$/;

  if (emptySummaryPattern.test(normalizedSummary)) {
    const separator = language === "zh" ? "：" : ": ";
    return `${formatSlideLabel(pageNumber, language)}${separator}${dictionaries[language]["slideArt.emptySummary"]}`;
  }

  return summary;
}

export function getGeneratedVisualSummary(visualSummary: string, language: Language) {
  const normalizedVisualSummary = visualSummary.trim();
  const importedRenderedPreviewReady = "imported-rendered-preview-ready";
  const importedPreviewUnavailable = "imported-preview-unavailable";
  const legacyImportedVisualReady = "Imported slide with extracted text ready for page-level reading and questions.";
  const legacyImportedVisualPlaceholder = "Imported slide placeholder. Full image rendering can be connected after the local renderer is enabled.";

  if (
    normalizedVisualSummary === importedRenderedPreviewReady ||
    normalizedVisualSummary === dictionaries.en["slideArt.importedVisualReady"] ||
    normalizedVisualSummary === legacyImportedVisualReady
  ) {
    return dictionaries[language]["slideArt.importedVisualReady"];
  }

  if (
    normalizedVisualSummary === importedPreviewUnavailable ||
    normalizedVisualSummary === dictionaries.en["slideArt.importedVisualPlaceholder"] ||
    normalizedVisualSummary === legacyImportedVisualPlaceholder
  ) {
    return dictionaries[language]["slideArt.importedVisualPlaceholder"];
  }

  return visualSummary;
}

export function formatSlideLabel(pageNumber: number, language: Language) {
  const paddedNumber = String(pageNumber).padStart(2, "0");

  return language === "zh" ? `第 ${paddedNumber} 页` : `Slide ${paddedNumber}`;
}
