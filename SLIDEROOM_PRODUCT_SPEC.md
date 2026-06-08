# SlideRoom

> 逐页理解你的 PPT。  
> An AI workspace for reading, questioning, and reshaping every PPT page.

SlideRoom 是一个专门面向 PPT / PPTX 的 AI 阅读工作台。它不是普通的“上传文档后聊天”，而是把整份 PPT 拆解成一组可以进入、查看、追问、总结和重构的 slide spaces。

产品气质参考：Arc Browser 的侧边栏和空间感、shadcn/ui 的克制组件质感、Tailwind 的精确布局、Motion 的轻量过渡、Spatial UI 的层级和舞台感。

## 1. 产品定位

### 核心定义

用户上传 PPT 后，系统自动将每一页转成独立的可视、可检索、可提问对象。

用户可以：

- 选择某一页，对这一页单独提问。
- 基于当前页、前后页或整份 PPT 提问。
- 让 AI 解释图表、总结要点、生成讲稿、提炼风险和追问问题。
- 查看回答引用的页码、标题区、图表区或局部内容。

一句话：

> 让 PPT 变成一个可以逐页进入、询问、整理和重构的知识空间。

### 不做什么

第一阶段不要做成：

- 泛文档问答平台。
- 花哨营销落地页。
- 完整 PPT 编辑器。
- 类 ChatGPT 的普通聊天壳。

SlideRoom 的第一屏应该直接是工具本身。

## 2. 目标用户与核心场景

### 目标用户

- 学生：理解课件、复习、生成讲稿和考试问题。
- 咨询 / 投研 / 商务分析人员：快速读懂 deck、定位关键信息、比较页间逻辑。
- 产品 / 运营 / 销售：复盘方案、准备汇报、提炼行动项。
- 老师 / 培训师：生成逐页讲解稿、互动问题和课程摘要。

### 高频任务

- “解释这一页在讲什么。”
- “这页图表的结论是什么？”
- “第 3 页和第 8 页有什么关系？”
- “帮我把这一页变成演讲稿。”
- “这一页有什么风险、假设或遗漏？”
- “帮我总结整份 PPT 的结构。”

## 3. MVP 范围

MVP 目标是做出一个完整、好看、可演示、能真实使用的工作台。

### 必须包含

- PPT / PPTX 上传。
- 上传后自动解析处理。
- 每页渲染成高清图片和缩略图。
- 左侧 slide 缩略图列表。
- 中间 16:10 slide stage 查看当前页。
- 右侧 AI inspector，对当前页提问。
- 当前页聊天记录保存。
- 快捷动作：
  - 解释这一页
  - 总结这一页
  - 生成讲稿
  - 提炼问题
- 回答中显示引用页码。

### 暂不包含

- 多人协作。
- 完整 PPT 在线编辑。
- 多 deck 对比。
- 精确到像素级的区域框选问答。
- 复杂权限系统。
- 企业知识库集成。

## 4. 信息架构

建议第一版保留三个主要视图。

### 4.1 上传入口

路径建议：`/`

目标：快速进入，不做重营销。

内容：

- 顶部极简品牌栏：SlideRoom。
- 主体拖拽上传区。
- 最近打开的 decks。
- 上传进度与错误提示。

视觉原则：

- 页面克制、留白充足。
- 拖拽区域像工具入口，而不是 SaaS hero。
- 不使用大面积彩色渐变。

### 4.2 处理视图

路径建议：`/deck/[deckId]/processing`

目标：让用户感知 PPT 正在被转化成可阅读空间。

内容：

- 文件名和整体处理进度。
- 每处理完一页，即显示对应缩略图。
- 失败页单独标记，不阻塞整份 PPT。
- 处理完成后自动进入工作台。

### 4.3 工作台

路径建议：`/deck/[deckId]`

这是核心体验。

```text
┌────────────────────────────────────────────────────────────┐
│ Top Bar: Deck name / Search / Export / Settings            │
├──────────────┬──────────────────────────────┬──────────────┤
│ Slide Rail   │ Slide Stage                  │ AI Inspector │
│ Thumbnails   │ 16:10 viewer                 │ Context      │
│ Page status  │ Zoom / Pan / Annotations     │ Ask / History│
└──────────────┴──────────────────────────────┴──────────────┘
```

核心原则：

- 左侧选页。
- 中间看页。
- 右侧问这一页。

## 5. 视觉设计方向

### 5.1 总体气质

关键词：

- 高级
- 简约
- 安静
- 空间感
- 工具感
- 轻微未来感

应该像：

> Arc Browser + Notion AI + Keynote Inspector

不应该像：

- 普通网盘预览器。
- 聊天机器人页面。
- 炫技型 3D 展示页。
- 卡片堆叠式 SaaS landing page。

### 5.2 布局语言

- 左侧 sidebar 参考 Arc Browser：紧凑、半透明、可折叠、强调当前对象。
- 中间 slide stage 是视觉重心，幻灯片以 16:10 比例稳定呈现。
- 右侧 AI inspector 参考设计工具属性面板，而不是普通聊天页。
- 面板之间用细边线、透明度、阴影和层级区分，不依赖重色块。

### 5.3 色彩

基础建议：

- 背景：near-white / warm gray / soft neutral。
- 文本：slate / zinc 系。
- 边线：低对比 neutral border。
- Accent：从 PPT 封面或主题色中提取一个主色。

Tailwind token 示例：

```ts
const theme = {
  background: "hsl(42 24% 97%)",
  foreground: "hsl(220 14% 11%)",
  muted: "hsl(40 12% 93%)",
  border: "hsl(36 10% 84%)",
  accent: "var(--deck-accent)",
}
```

注意：

- 不要做单一紫色 / 蓝紫渐变主题。
- 不要用大面积装饰性光斑。
- 不要让 UI 变成深蓝灰 dashboard。
- Accent 色只用于当前页、引用、焦点态和关键按钮。

### 5.4 圆角与阴影

- 工具面板圆角：6px - 8px。
- 按钮圆角：6px - 8px。
- Slide stage 可略大，但不要超过 12px。
- 阴影要轻，强调浮层而非装饰。

### 5.5 Motion 原则

使用 Motion / Framer Motion，但动画要短、稳、轻。

适合使用：

- slide 切换：轻微 fade + scale。
- 右侧 inspector 切换上下文：opacity + y。
- 上传处理中缩略图逐个浮现。
- Command menu 打开：scale 0.98 -> 1。

避免：

- 大幅位移。
- 弹性过强。
- 花哨的连续动效。

建议参数：

```ts
const transition = {
  duration: 0.18,
  ease: [0.22, 1, 0.36, 1],
}
```

## 6. 关键组件

推荐基于 shadcn/ui 组合，而不是从零写一套 UI。

### 基础组件

- `Button`
- `Input`
- `Textarea`
- `ScrollArea`
- `Tooltip`
- `DropdownMenu`
- `Command`
- `Dialog`
- `Sheet`
- `Tabs`
- `Badge`
- `Separator`
- `Skeleton`
- `Toast`
- `ResizablePanel`

### 业务组件

```text
AppShell
TopBar
DeckUploadDropzone
ProcessingGrid
SlideRail
SlideThumbnail
SlideStage
SlideToolbar
AIInspector
ContextModeSwitcher
PromptComposer
AnswerCard
CitationPill
QuickActionBar
DeckSearchCommand
```

### 组件职责

`SlideRail`

- 显示缩略图虚拟列表。
- 显示页码、处理状态、当前选中态。
- 支持折叠。

`SlideStage`

- 显示当前页高清图片。
- 保持 16:10 viewer。
- 支持 zoom / fit / pan。
- 后续支持局部高亮和引用框。

`AIInspector`

- 显示当前上下文：`Asking Slide 12`。
- 提供上下文模式切换。
- 显示快捷动作。
- 显示当前页聊天历史。
- 输入问题并发送。

## 7. 核心交互

### 7.1 上传

流程：

1. 用户拖入 PPT / PPTX。
2. 前端创建 deck upload session。
3. 文件上传到对象存储或本地开发存储。
4. 后端创建处理任务。
5. 前端进入处理视图。
6. 每页处理完成后通过 polling 或 websocket 更新状态。
7. 全部完成后进入工作台。

交互细节：

- 拖拽 hover 时只做轻微边框和背景变化。
- 上传失败要展示具体原因。
- 允许重新上传或移除文件。

### 7.2 选页

- 点击左侧缩略图切换当前页。
- 当前页缩略图使用 accent border。
- 中间 slide stage 进行轻微 fade + scale。
- 右侧 inspector 的上下文立即切换到当前页。

### 7.3 提问

默认提问对象是当前页。

上下文模式：

- Current Slide
- Nearby Slides
- Whole Deck

输入框上方显示：

```text
Asking Slide 12
Context: Current Slide
```

快捷动作：

- Explain
- Summarize
- Speaker Notes
- Find Risks
- Generate Questions

### 7.4 回答引用

回答应该尽量带引用。

引用格式：

```text
Slide 12
Title area
Chart area
Speaker notes
```

MVP 可先只引用页码；V1 再支持区域级引用。

## 8. AI 与解析流程

### 8.1 上传后处理 Pipeline

```text
Upload PPT
  -> Store original file
  -> Convert PPT to PDF
  -> Render PDF pages to PNG
  -> Generate thumbnails
  -> Extract text and speaker notes
  -> OCR slide images
  -> Generate visual summary per slide
  -> Generate embeddings
  -> Mark deck ready
```

### 8.2 推荐实现

PPT 渲染：

- LibreOffice headless：PPT / PPTX -> PDF。
- Poppler 或 PDF renderer：PDF -> PNG。

文本提取：

- `officeparser` 或类似库提取文本。
- 复杂图表和图片内容通过 OCR 补齐。

AI：

- 文本模型：回答、总结、讲稿生成。
- 视觉模型：每页视觉摘要、图表解释、版式理解。
- Embedding：整份 PPT 检索和跨页问答。

### 8.3 用户提问时的上下文组装

Current Slide：

- 当前页 extracted text。
- 当前页 OCR text。
- 当前页 visual summary。
- 当前页 speaker notes。

Nearby Slides：

- 当前页。
- 前一页和后一页摘要。
- 必要时加入 section title。

Whole Deck：

- 先检索相关 slide chunks。
- 加入 deck outline。
- 回答时强制引用页码。

## 9. 数据模型

### 9.1 TypeScript 类型

```ts
type Deck = {
  id: string
  title: string
  fileName: string
  fileUrl: string
  status: "uploading" | "processing" | "ready" | "failed"
  pageCount: number
  accentColor?: string
  createdAt: string
  updatedAt: string
}

type Slide = {
  id: string
  deckId: string
  pageNumber: number
  status: "queued" | "processing" | "ready" | "failed"
  imageUrl?: string
  thumbnailUrl?: string
  extractedText?: string
  ocrText?: string
  speakerNotes?: string
  visualSummary?: string
  layoutSummary?: string
  embeddingId?: string
}

type ChatThread = {
  id: string
  deckId: string
  slideId?: string
  contextMode: "current_slide" | "nearby_slides" | "whole_deck"
  createdAt: string
}

type ChatMessage = {
  id: string
  threadId: string
  role: "user" | "assistant"
  content: string
  citations?: Citation[]
  createdAt: string
}

type Citation = {
  slideId: string
  pageNumber: number
  label?: string
  region?: {
    x: number
    y: number
    width: number
    height: number
  }
}
```

### 9.2 数据库表

建议第一版：

```text
decks
slides
chat_threads
chat_messages
slide_embeddings
processing_jobs
```

如果使用 Postgres + pgvector，可以将向量直接放在 `slide_embeddings`。

## 10. API 草案

### Deck

```text
POST   /api/decks
GET    /api/decks
GET    /api/decks/:deckId
DELETE /api/decks/:deckId
```

### Upload

```text
POST /api/uploads/presign
POST /api/decks/:deckId/process
GET  /api/decks/:deckId/processing-status
```

### Slides

```text
GET /api/decks/:deckId/slides
GET /api/slides/:slideId
```

### Ask

```text
POST /api/ask
```

Request:

```ts
type AskRequest = {
  deckId: string
  slideId?: string
  contextMode: "current_slide" | "nearby_slides" | "whole_deck"
  question: string
  action?: "explain" | "summarize" | "speaker_notes" | "risks" | "questions"
}
```

Response:

```ts
type AskResponse = {
  answer: string
  citations: Citation[]
  threadId: string
}
```

## 11. 前端状态设计

推荐 zustand 或 jotai。

### 全局状态

```ts
type WorkspaceState = {
  deckId?: string
  currentSlideId?: string
  contextMode: "current_slide" | "nearby_slides" | "whole_deck"
  leftRailCollapsed: boolean
  inspectorOpen: boolean
  zoom: number
}
```

### 服务端状态

建议使用 TanStack Query 或 Next.js server actions + client cache。

服务端状态包括：

- deck metadata
- slides
- processing status
- chat history
- ask response stream

## 12. 页面结构建议

```text
app/
  page.tsx
  deck/
    [deckId]/
      page.tsx
      processing/
        page.tsx
components/
  app-shell.tsx
  upload/
    deck-upload-dropzone.tsx
    recent-decks.tsx
  deck/
    slide-rail.tsx
    slide-thumbnail.tsx
    slide-stage.tsx
    slide-toolbar.tsx
    ai-inspector.tsx
    prompt-composer.tsx
    answer-card.tsx
    citation-pill.tsx
lib/
  ppt/
    process-deck.ts
    render-slides.ts
    extract-text.ts
  ai/
    build-context.ts
    ask-slide.ts
    summarize-slide.ts
  db/
    schema.ts
    queries.ts
```

## 13. 视觉验收标准

工作台必须满足：

- 第一眼能看出这是 SlideRoom，而不是普通聊天工具。
- 当前页、当前上下文、当前提问范围非常明确。
- 16:10 slide stage 稳定，不因加载、切页、回答而跳动。
- 左侧、中央、右侧层级清晰。
- 字体大小在工具界面中克制，不使用 landing page 式巨型标题。
- 没有卡片套卡片。
- 动效轻，不干扰阅读。
- 移动端至少能完成：选页、看页、提问。

## 14. MVP 开发里程碑

### Milestone 1: 项目骨架

- Next.js + TypeScript。
- Tailwind CSS。
- shadcn/ui 初始化。
- 基础 AppShell。
- 三栏工作台静态布局。

### Milestone 2: 上传与处理状态

- 上传 dropzone。
- deck 创建。
- processing 页面。
- mock slide processing 状态。

### Milestone 3: Slide Viewer

- 左侧缩略图列表。
- 中间 16:10 slide stage。
- 当前页状态。
- 切页 motion。

### Milestone 4: 真实 PPT 解析

- PPT -> PDF。
- PDF -> PNG。
- thumbnail 生成。
- slides 表落库。

### Milestone 5: 当前页问答

- 当前页文本上下文。
- AI inspector。
- 快捷动作。
- 聊天记录保存。
- 基础引用页码。

### Milestone 6: 打磨与演示

- 空状态、错误态、加载态。
- 移动端适配。
- 键盘快捷入口。
- 示例 deck。
- 视觉 QA。

## 15. 后续路线

### V1

- 整份 PPT 问答。
- 页间关系分析。
- 图表解释。
- 区域级引用定位。
- 导出问答记录、摘要、讲稿。
- 自动生成 deck outline。

### V2

- 多人协作批注。
- 自动生成演讲者备注。
- 多 PPT 对比。
- “这一页可以怎么改得更好”建议。
- 局部框选提问。
- Slide map 空间总览。

## 16. 推荐品牌表达

主标题：

```text
SlideRoom
```

副标题：

```text
逐页理解你的 PPT
```

英文 tagline：

```text
Ask every PPT page like a room of thought.
```

更产品化的描述：

```text
SlideRoom turns every PPT page into a focused space for reading, questioning, and presenting.
```

## 17. 第一版设计提示词

可以把下面这段作为前端实现时的设计约束：

> Build a premium, minimal AI workspace for slide-by-slide PPT reading. The interface should feel like Arc Browser plus Keynote Inspector: a compact left slide rail, a large 16:10 central slide stage, and a quiet AI inspector on the right. Use shadcn/ui, Tailwind, and subtle Motion transitions. Avoid marketing-page composition, oversized hero typography, decorative gradients, and card-heavy layouts. The product should feel calm, spatial, precise, and ready for daily work.

