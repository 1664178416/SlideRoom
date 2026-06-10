import { execFile } from "node:child_process";
import { mkdir, readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";

export type RenderedSlideImage = {
  pageNumber: number;
  imagePath: string;
  imageUrl: string;
  thumbnailUrl: string;
  aspectRatio: number;
};

export type RenderDeckResult = {
  images: RenderedSlideImage[];
  status: "rendered" | "unavailable" | "failed";
};

const execFileAsync = promisify(execFile);
const defaultAspectRatio = 16 / 10;
const exportTimeoutMs = 90000;
const pptSlideExportFilter = "PNG";
const appRelativeUploadRoot = "/api/decks";

function escapePowerShellString(value: string) {
  return value.replace(/'/g, "''");
}

function normalizePathForPowerShell(value: string) {
  return escapePowerShellString(path.resolve(value));
}

async function getPowerPointComAvailable() {
  try {
    const { stdout } = await execFileAsync(
      "powershell.exe",
      [
        "-NoProfile",
        "-NonInteractive",
        "-Command",
        "$type = [type]::GetTypeFromProgID('PowerPoint.Application'); if ($null -eq $type) { 'no' } else { 'yes' }",
      ],
      {
        timeout: 10000,
        windowsHide: true,
      },
    );

    return stdout.trim().toLowerCase() === "yes";
  } catch {
    return false;
  }
}

async function exportDeckWithPowerPoint(inputPath: string, outputDirectory: string) {
  const script = [
    "$ErrorActionPreference = 'Stop'",
    `$inputPath = '${normalizePathForPowerShell(inputPath)}'`,
    `$outputPath = '${normalizePathForPowerShell(outputDirectory)}'`,
    "$powerPoint = $null",
    "$presentation = $null",
    "try {",
    "  $powerPoint = New-Object -ComObject PowerPoint.Application",
    "  $powerPoint.Visible = 0",
    "  $presentation = $powerPoint.Presentations.Open($inputPath, -1, 0, 0)",
    `  $presentation.Export($outputPath, '${pptSlideExportFilter}')`,
    "}",
    "finally {",
    "  if ($presentation -ne $null) { $presentation.Close() | Out-Null }",
    "  if ($powerPoint -ne $null) { $powerPoint.Quit() | Out-Null }",
    "}",
  ].join("\n");

  await execFileAsync("powershell.exe", ["-NoProfile", "-NonInteractive", "-Command", script], {
    timeout: exportTimeoutMs,
    windowsHide: true,
  });
}

async function readPngAspectRatio(imagePath: string) {
  try {
    const pngHeader = await readFile(imagePath);
    if (pngHeader.length < 24 || pngHeader.toString("ascii", 1, 4) !== "PNG") return defaultAspectRatio;

    const width = pngHeader.readUInt32BE(16);
    const height = pngHeader.readUInt32BE(20);
    if (width <= 0 || height <= 0) return defaultAspectRatio;

    return width / height;
  } catch {
    return defaultAspectRatio;
  }
}

function getPageNumberFromExportName(fileName: string, fallbackPageNumber: number) {
  const match = fileName.match(/(\d+)(?=\.png$)/i);
  if (!match) return fallbackPageNumber;

  const pageNumber = Number.parseInt(match[1], 10);
  return Number.isFinite(pageNumber) && pageNumber > 0 ? pageNumber : fallbackPageNumber;
}

export async function renderDeckToImages({
  deckId,
  inputPath,
  outputDirectory,
}: {
  deckId: string;
  inputPath: string;
  outputDirectory: string;
}): Promise<RenderDeckResult> {
  const powerPointAvailable = await getPowerPointComAvailable();
  if (!powerPointAvailable) {
    return {
      images: [],
      status: "unavailable",
    };
  }

  try {
    await mkdir(outputDirectory, { recursive: true });
    await exportDeckWithPowerPoint(inputPath, outputDirectory);

    const exportedFiles = (await readdir(outputDirectory))
      .filter((fileName) => fileName.toLowerCase().endsWith(".png"))
      .sort((left, right) => getPageNumberFromExportName(left, 0) - getPageNumberFromExportName(right, 0));

    const images = await Promise.all(
      exportedFiles.map(async (fileName, index) => {
        const pageNumber = getPageNumberFromExportName(fileName, index + 1);
        const imageUrl = `${appRelativeUploadRoot}/${encodeURIComponent(deckId)}/assets/${encodeURIComponent(fileName)}`;
        const imagePath = path.join(outputDirectory, fileName);

        return {
          pageNumber,
          imagePath,
          imageUrl,
          thumbnailUrl: imageUrl,
          aspectRatio: await readPngAspectRatio(imagePath),
        };
      }),
    );

    return {
      images,
      status: exportedFiles.length > 0 ? "rendered" : "failed",
    };
  } catch {
    return {
      images: [],
      status: "failed",
    };
  }
}
