export type Slide = {
  id: string;
  pageNumber: number;
  section: "opening" | "market" | "product" | "revenue" | "risks" | "close" | "imported";
  title: string;
  kicker: string;
  summary: string;
  bullets: string[];
  metrics: Array<{
    label: string;
    value: string;
    tone: "teal" | "coral" | "blue" | "gold";
  }>;
  chart: number[];
  accent: string;
  visualSummary: string;
  extractedText: string;
  speakerNotes: string;
};

export const slides: Slide[] = [
  {
    id: "slide-01",
    pageNumber: 1,
    section: "opening",
    title: "Investor Narrative",
    kicker: "Q2 Strategy Readout",
    summary: "The deck opens by reframing growth around retention, pricing discipline, and a narrower enterprise motion.",
    bullets: ["Retention-led growth", "Enterprise motion", "Pricing discipline"],
    metrics: [
      { label: "NRR", value: "128%", tone: "teal" },
      { label: "Pipeline", value: "$42M", tone: "blue" },
    ],
    chart: [52, 68, 64, 78, 88],
    accent: "168 42% 30%",
    visualSummary: "A title-led opening slide with two operating metrics and a compact growth chart.",
    extractedText: "Investor Narrative. Q2 Strategy Readout. Retention-led growth. Enterprise motion. Pricing discipline. NRR 128%. Pipeline $42M.",
    speakerNotes: "Open with the shift from acquisition-heavy growth to higher confidence expansion inside existing accounts.",
  },
  {
    id: "slide-02",
    pageNumber: 2,
    section: "market",
    title: "Where Demand Is Moving",
    kicker: "Category pressure",
    summary: "Demand is consolidating around fewer vendors, faster onboarding, and measurable workflow improvement.",
    bullets: ["Vendor consolidation", "Shorter time-to-value", "Workflow proof"],
    metrics: [
      { label: "Cycle", value: "-18%", tone: "coral" },
      { label: "Intent", value: "3.4x", tone: "gold" },
    ],
    chart: [36, 48, 54, 71, 84],
    accent: "18 58% 54%",
    visualSummary: "A market movement slide with a rising demand curve and two compact proof metrics.",
    extractedText: "Where Demand Is Moving. Category pressure. Vendor consolidation. Shorter time-to-value. Workflow proof. Cycle -18%. Intent 3.4x.",
    speakerNotes: "Emphasize that buyers are not spending less; they are buying with more scrutiny and stronger proof requirements.",
  },
  {
    id: "slide-03",
    pageNumber: 3,
    section: "product",
    title: "Workspace-Led Adoption",
    kicker: "Activation model",
    summary: "The product strategy centers on making a single workspace feel immediately valuable before expanding to the team.",
    bullets: ["Personal workspace first", "Shared context later", "Admin layer last"],
    metrics: [
      { label: "Activation", value: "41%", tone: "teal" },
      { label: "Share rate", value: "2.1x", tone: "blue" },
    ],
    chart: [22, 31, 46, 58, 76],
    accent: "205 42% 38%",
    visualSummary: "A product motion slide showing a workspace activation ladder with adoption metrics.",
    extractedText: "Workspace-Led Adoption. Activation model. Personal workspace first. Shared context later. Admin layer last. Activation 41%. Share rate 2.1x.",
    speakerNotes: "Tie this slide to the sales narrative: user value comes before centralized rollout.",
  },
  {
    id: "slide-04",
    pageNumber: 4,
    section: "revenue",
    title: "Expansion Quality",
    kicker: "Revenue composition",
    summary: "Expansion revenue is becoming healthier as large customers buy more seats and attach premium workflow modules.",
    bullets: ["Seat growth", "Premium module attach", "Lower discounting"],
    metrics: [
      { label: "Attach", value: "36%", tone: "gold" },
      { label: "Discount", value: "-9pt", tone: "coral" },
    ],
    chart: [48, 56, 66, 69, 81],
    accent: "39 74% 45%",
    visualSummary: "A revenue slide with stacked quality signals around attach rate and discount reduction.",
    extractedText: "Expansion Quality. Revenue composition. Seat growth. Premium module attach. Lower discounting. Attach 36%. Discount -9pt.",
    speakerNotes: "Explain that the revenue mix matters more than top-line bookings alone.",
  },
  {
    id: "slide-05",
    pageNumber: 5,
    section: "risks",
    title: "Execution Watchlist",
    kicker: "Operating risks",
    summary: "The main risks are services capacity, sales enablement depth, and the timeline for enterprise security requirements.",
    bullets: ["Services bottleneck", "Enablement depth", "Security review latency"],
    metrics: [
      { label: "At risk", value: "14%", tone: "coral" },
      { label: "Mitigated", value: "7/10", tone: "teal" },
    ],
    chart: [74, 62, 59, 51, 44],
    accent: "7 60% 48%",
    visualSummary: "A risk slide with a declining exposure chart and a direct operating watchlist.",
    extractedText: "Execution Watchlist. Operating risks. Services bottleneck. Enablement depth. Security review latency. At risk 14%. Mitigated 7/10.",
    speakerNotes: "Do not overstate the risk. Position it as manageable if the next two quarters stay focused.",
  },
  {
    id: "slide-06",
    pageNumber: 6,
    section: "close",
    title: "Next Operating Moves",
    kicker: "Decision frame",
    summary: "The close asks leadership to fund customer success capacity and focus product messaging around workspace outcomes.",
    bullets: ["Fund CS capacity", "Tighten product story", "Measure expansion loops"],
    metrics: [
      { label: "Ask", value: "$1.8M", tone: "blue" },
      { label: "Payback", value: "9 mo", tone: "teal" },
    ],
    chart: [35, 44, 58, 72, 86],
    accent: "151 34% 34%",
    visualSummary: "A closing decision slide with investment ask, payback estimate, and operating priorities.",
    extractedText: "Next Operating Moves. Decision frame. Fund CS capacity. Tighten product story. Measure expansion loops. Ask $1.8M. Payback 9 mo.",
    speakerNotes: "End by making the decision concrete: this is a focused capacity investment, not a broad budget expansion.",
  },
];

export const deckMeta = {
  id: "demo-deck",
  title: "Q2 Strategy Readout",
  fileName: "Q2_strategy_readout.pptx",
  pageCount: slides.length,
};
