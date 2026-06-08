import type { Language } from "@/lib/preferences";

export function getMarkdownEmptyValue(language: Language) {
  return language === "zh" ? "暂无" : "None";
}

export function formatMarkdownInline(value: string, emptyValue: string) {
  const trimmedValue = value.replace(/\s+/g, " ").trim();
  if (!trimmedValue) return emptyValue;

  const escapedValue = trimmedValue.replace(/([\\`*_{}\[\]()#+!|>])/g, "\\$1");

  return escapedValue
    .replace(/^([-+])\s/, "\\$1 ")
    .replace(/^(\d+)\.\s/, "$1\\. ")
    .replace(/^(-{3,}|={3,})$/, "\\$1");
}

export function formatMarkdownCodeBlock(value: string, emptyValue: string) {
  const trimmedValue = value.trim();
  if (!trimmedValue) return [emptyValue];

  return ["```text", trimmedValue.replace(/```/g, "`\u200b``"), "```"];
}

export function formatMarkdownQuote(value: string, emptyValue: string) {
  const trimmedValue = value.trim();
  if (!trimmedValue) return [emptyValue];

  return trimmedValue.split(/\r?\n/).map((line) => `> ${line.replace(/^>+/, (marker) => "\\".repeat(marker.length) + marker) || " "}`);
}

export function formatMarkdownListItems(values: string[], emptyValue: string) {
  if (values.length === 0) return [`  - ${emptyValue}`];

  return values.map((value) => `  - ${formatMarkdownInline(value, emptyValue)}`);
}
