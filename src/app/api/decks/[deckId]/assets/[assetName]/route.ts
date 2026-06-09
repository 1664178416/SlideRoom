import { readFile } from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

const uploadRootDirectory = path.join(process.cwd(), ".slideroom", "uploads");
const deckIdPattern = /^deck-[a-f0-9]{8}$/i;

function assetError(message: string, status = 404) {
  return NextResponse.json({ message, ok: false }, { status });
}

function isSafePngAssetName(assetName: string) {
  return (
    assetName.length > 0 &&
    assetName.length <= 180 &&
    /\.png$/i.test(assetName) &&
    !assetName.includes("/") &&
    !assetName.includes("\\") &&
    !assetName.includes("\0")
  );
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ assetName?: string; deckId?: string }> },
) {
  const { assetName = "", deckId = "" } = await params;

  if (!deckIdPattern.test(deckId) || !isSafePngAssetName(assetName)) {
    return assetError("Asset not found.");
  }

  const assetPath = path.join(uploadRootDirectory, deckId, "slides", assetName);
  const resolvedAssetPath = path.resolve(assetPath);
  const resolvedDeckAssetsDirectory = path.resolve(uploadRootDirectory, deckId, "slides");

  if (!resolvedAssetPath.startsWith(`${resolvedDeckAssetsDirectory}${path.sep}`)) {
    return assetError("Asset not found.");
  }

  try {
    const image = await readFile(resolvedAssetPath);

    return new NextResponse(image, {
      headers: {
        "Cache-Control": "public, max-age=31536000, immutable",
        "Content-Type": "image/png",
      },
    });
  } catch {
    return assetError("Asset not found.");
  }
}
