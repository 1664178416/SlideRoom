import { inflateRawSync } from "node:zlib";

export type InspectedSlide = {
  pageNumber: number;
  extractedText: string;
  speakerNotes: string;
};

export type InspectedPptx = {
  inspectionStatus: "parsed" | "unsupported" | "failed";
  pageCount: number;
  slides: InspectedSlide[];
};

type ZipEntry = {
  compressedSize: number;
  compressionMethod: number;
  localHeaderOffset: number;
  name: string;
  uncompressedSize: number;
};

const centralDirectorySignature = 0x02014b50;
const endOfCentralDirectorySignature = 0x06054b50;
const localFileHeaderSignature = 0x04034b50;
const maxZipCommentLength = 65535;
const maxExtractedTextLength = 1800;
const maxReadableZipEntryBytes = 8 * 1024 * 1024;
const officeDocumentRelationshipType = "http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument";
const slideRelationshipType = "http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide";
const notesSlideRelationshipType = "http://schemas.openxmlformats.org/officeDocument/2006/relationships/notesSlide";

function findEndOfCentralDirectory(buffer: Buffer) {
  const minOffset = Math.max(0, buffer.length - maxZipCommentLength - 22);

  for (let offset = buffer.length - 22; offset >= minOffset; offset -= 1) {
    if (buffer.readUInt32LE(offset) === endOfCentralDirectorySignature) {
      return offset;
    }
  }

  return -1;
}

function readZipEntries(buffer: Buffer) {
  const endOffset = findEndOfCentralDirectory(buffer);
  if (endOffset < 0) return [];

  const totalEntries = buffer.readUInt16LE(endOffset + 10);
  const centralDirectoryOffset = buffer.readUInt32LE(endOffset + 16);
  const entries: ZipEntry[] = [];
  let offset = centralDirectoryOffset;

  for (let index = 0; index < totalEntries; index += 1) {
    if (offset + 46 > buffer.length || buffer.readUInt32LE(offset) !== centralDirectorySignature) break;

    const compressionMethod = buffer.readUInt16LE(offset + 10);
    const compressedSize = buffer.readUInt32LE(offset + 20);
    const uncompressedSize = buffer.readUInt32LE(offset + 24);
    const fileNameLength = buffer.readUInt16LE(offset + 28);
    const extraFieldLength = buffer.readUInt16LE(offset + 30);
    const fileCommentLength = buffer.readUInt16LE(offset + 32);
    const localHeaderOffset = buffer.readUInt32LE(offset + 42);
    const fileNameStart = offset + 46;
    const fileNameEnd = fileNameStart + fileNameLength;

    if (fileNameEnd > buffer.length) break;

    entries.push({
      compressedSize,
      compressionMethod,
      localHeaderOffset,
      name: buffer.toString("utf8", fileNameStart, fileNameEnd).replace(/\\/g, "/"),
      uncompressedSize,
    });

    offset = fileNameEnd + extraFieldLength + fileCommentLength;
  }

  return entries;
}

function readZipEntry(buffer: Buffer, entry: ZipEntry) {
  if (entry.uncompressedSize > maxReadableZipEntryBytes) return null;

  const localHeaderOffset = entry.localHeaderOffset;
  if (
    localHeaderOffset < 0 ||
    localHeaderOffset + 30 > buffer.length ||
    buffer.readUInt32LE(localHeaderOffset) !== localFileHeaderSignature
  ) {
    return null;
  }

  const fileNameLength = buffer.readUInt16LE(localHeaderOffset + 26);
  const extraFieldLength = buffer.readUInt16LE(localHeaderOffset + 28);
  const dataStart = localHeaderOffset + 30 + fileNameLength + extraFieldLength;
  const dataEnd = dataStart + entry.compressedSize;

  if (dataStart < 0 || dataEnd > buffer.length) return null;

  const compressedData = buffer.subarray(dataStart, dataEnd);

  if (entry.compressionMethod === 0) {
    return compressedData.length <= maxReadableZipEntryBytes ? compressedData : null;
  }

  if (entry.compressionMethod === 8) {
    try {
      const inflatedData = inflateRawSync(compressedData, {
        maxOutputLength: maxReadableZipEntryBytes,
      });
      return inflatedData.length <= maxReadableZipEntryBytes ? inflatedData : null;
    } catch {
      return null;
    }
  }

  return null;
}

function decodeXmlCodePoint(match: string, rawCodePoint: string, radix: number) {
  const codePoint = Number.parseInt(rawCodePoint, radix);

  if (!Number.isFinite(codePoint) || codePoint <= 0 || codePoint > 0x10ffff) {
    return match;
  }

  try {
    return String.fromCodePoint(codePoint);
  } catch {
    return match;
  }
}

function decodeXmlEntities(value: string) {
  return value
    .replace(/&#x([0-9a-fA-F]+);/g, (match, codePoint: string) => decodeXmlCodePoint(match, codePoint, 16))
    .replace(/&#(\d+);/g, (match, codePoint: string) => decodeXmlCodePoint(match, codePoint, 10))
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, "\"")
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&");
}

function getXmlAttribute(attributes: string, name: string) {
  const escapedName = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = attributes.match(new RegExp(`\\b${escapedName}=(["'])([\\s\\S]*?)\\1`));

  return match ? decodeXmlEntities(match[2]) : "";
}

function compactLine(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function clipExtractedText(value: string) {
  return value.trim().slice(0, maxExtractedTextLength);
}

function extractTextRuns(xml: string) {
  return [...xml.matchAll(/<a:t[^>]*>([\s\S]*?)<\/a:t>/g)]
    .map((match) => compactLine(decodeXmlEntities(match[1])))
    .filter(Boolean);
}

function extractTextFromXml(xml: string) {
  const paragraphs = [...xml.matchAll(/<a:p(?:\s[^>]*)?>([\s\S]*?)<\/a:p>/g)]
    .map((match) => compactLine(extractTextRuns(match[1]).join(" ")))
    .filter(Boolean);

  if (paragraphs.length > 0) {
    return clipExtractedText(paragraphs.join("\n"));
  }

  return clipExtractedText(extractTextRuns(xml).join(" "));
}

function getSlidePageNumber(name: string, prefix: string) {
  const match = name.match(new RegExp(`^${prefix}(\\d+)\\.xml$`));
  return match ? Number(match[1]) : 0;
}

function normalizeRelationshipTarget(baseDirectory: string, target: string) {
  const targetPath = target.startsWith("/") ? target.slice(1) : `${baseDirectory}/${target}`;
  const normalizedParts: string[] = [];

  targetPath.split("/").forEach((part) => {
    if (!part || part === ".") return;
    if (part === "..") {
      normalizedParts.pop();
      return;
    }

    normalizedParts.push(part);
  });

  return normalizedParts.join("/");
}

function getEntryText(buffer: Buffer, entriesByName: Map<string, ZipEntry>, name: string) {
  const entry = entriesByName.get(name);
  if (!entry) return "";

  const xmlBytes = readZipEntry(buffer, entry);
  return xmlBytes ? xmlBytes.toString("utf8") : "";
}

function getRelationships(xml: string, baseDirectory: string) {
  return [...xml.matchAll(/<Relationship\b([^>]*)\/?>/g)].map((match) => {
    const attributes = match[1];
    const id = getXmlAttribute(attributes, "Id");
    const type = getXmlAttribute(attributes, "Type");
    const target = getXmlAttribute(attributes, "Target");

    return {
      id,
      target: target ? normalizeRelationshipTarget(baseDirectory, decodeXmlEntities(target)) : "",
      type,
    };
  });
}

function getPresentationPath(buffer: Buffer, entriesByName: Map<string, ZipEntry>) {
  const rootRelationshipsXml = getEntryText(buffer, entriesByName, "_rels/.rels");
  const officeDocumentRelationship = getRelationships(rootRelationshipsXml, "").find(
    (relationship) => relationship.type === officeDocumentRelationshipType && relationship.target.endsWith(".xml"),
  );

  return officeDocumentRelationship?.target || "ppt/presentation.xml";
}

function getSlideOrder(buffer: Buffer, entriesByName: Map<string, ZipEntry>, slideEntries: ZipEntry[]) {
  const presentationPath = getPresentationPath(buffer, entriesByName);
  const presentationXml = getEntryText(buffer, entriesByName, presentationPath);
  const presentationDirectory = presentationPath.split("/").slice(0, -1).join("/") || ".";
  const relationshipPath = `${presentationDirectory}/_rels/${presentationPath.split("/").pop()}.rels`;
  const relationshipXml = getEntryText(buffer, entriesByName, relationshipPath);
  const relationshipsById = new Map(
    getRelationships(relationshipXml, presentationDirectory).map((relationship) => [relationship.id, relationship]),
  );
  const orderedSlideNames = [...presentationXml.matchAll(/<p:sldId\b([^>]*)\/?>/g)]
    .map((match) => relationshipsById.get(getXmlAttribute(match[1], "r:id")))
    .filter((relationship) => relationship?.type === slideRelationshipType && Boolean(relationship.target))
    .map((relationship) => relationship?.target)
    .filter((target): target is string => Boolean(target));
  const slideEntriesByName = new Map(slideEntries.map((entry) => [entry.name, entry]));
  const orderedSlideEntries = orderedSlideNames
    .map((name) => slideEntriesByName.get(name))
    .filter((entry): entry is ZipEntry => Boolean(entry));

  if (orderedSlideEntries.length === slideEntries.length) return orderedSlideEntries;

  return slideEntries;
}

function getSlideNotesBySlideName(buffer: Buffer, entriesByName: Map<string, ZipEntry>, slideEntries: ZipEntry[]) {
  const notesByPageNumber = new Map(
    [...entriesByName.values()]
      .filter((entry) => /^ppt\/notesSlides\/notesSlide\d+\.xml$/.test(entry.name))
      .map((entry) => {
        const notesXml = getEntryText(buffer, entriesByName, entry.name);
        const pageNumber = getSlidePageNumber(entry.name, "ppt/notesSlides/notesSlide");

        return [pageNumber, notesXml ? extractTextFromXml(notesXml) : ""] as const;
      })
      .filter(([pageNumber]) => pageNumber > 0),
  );

  return new Map(
    slideEntries.map((slideEntry) => {
      const slideDirectory = slideEntry.name.split("/").slice(0, -1).join("/") || ".";
      const slideFileName = slideEntry.name.split("/").pop() ?? "";
      const slideRelationshipPath = `${slideDirectory}/_rels/${slideFileName}.rels`;
      const relationshipXml = getEntryText(buffer, entriesByName, slideRelationshipPath);
      const notesRelationship = getRelationships(relationshipXml, slideDirectory).find(
        (relationship) => relationship.type === notesSlideRelationshipType && relationship.target,
      );
      const notesXml = notesRelationship?.target ? getEntryText(buffer, entriesByName, notesRelationship.target) : "";
      const fallbackPageNumber = getSlidePageNumber(slideEntry.name, "ppt/slides/slide");

      return [slideEntry.name, notesXml ? extractTextFromXml(notesXml) : notesByPageNumber.get(fallbackPageNumber) ?? ""] as const;
    }),
  );
}

export function inspectPptx(buffer: Buffer): InspectedPptx {
  try {
    const entries = readZipEntries(buffer);
    if (entries.length === 0) {
      return {
        inspectionStatus: "unsupported",
        pageCount: 0,
        slides: [],
      };
    }

    const entriesByName = new Map(entries.map((entry) => [entry.name, entry]));

    const slideEntries = entries
      .filter((entry) => /^ppt\/slides\/slide\d+\.xml$/.test(entry.name))
      .sort((left, right) => getSlidePageNumber(left.name, "ppt/slides/slide") - getSlidePageNumber(right.name, "ppt/slides/slide"));

    if (slideEntries.length === 0) {
      return {
        inspectionStatus: "unsupported",
        pageCount: 0,
        slides: [],
      };
    }

    const orderedSlideEntries = getSlideOrder(buffer, entriesByName, slideEntries);
    const notesBySlideName = getSlideNotesBySlideName(buffer, entriesByName, orderedSlideEntries);

    const slides = orderedSlideEntries.map((entry, index) => {
      const xmlBytes = readZipEntry(buffer, entry);
      const pageNumber = index + 1;

      return {
        extractedText: xmlBytes ? extractTextFromXml(xmlBytes.toString("utf8")) : "",
        pageNumber,
        speakerNotes: notesBySlideName.get(entry.name) ?? "",
      };
    });

    return {
      inspectionStatus: "parsed",
      pageCount: slides.length,
      slides,
    };
  } catch {
    return {
      inspectionStatus: "failed",
      pageCount: 0,
      slides: [],
    };
  }
}
