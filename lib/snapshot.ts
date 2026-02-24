import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

import { getGameConfig, resolveSourceUrl, type GameType } from "@/lib/games";

const LOCAL_SNAPSHOT_URLS: Record<GameType, URL> = {
  power655: new URL("../data/power655.jsonl", import.meta.url),
  power645: new URL("../data/power645.jsonl", import.meta.url)
};

export interface SnapshotPayload {
  sourceLabel: string;
  body: string;
}

async function readSnapshotText(game: GameType): Promise<string> {
  const config = getGameConfig(game);
  const url = LOCAL_SNAPSHOT_URLS[game];
  const candidates = [
    fileURLToPath(url),
    decodeURIComponent(url.pathname),
    path.join(process.cwd(), config.localSnapshotPath)
  ];

  let lastError: Error | null = null;

  for (const candidate of candidates) {
    try {
      const absolutePath = path.resolve(candidate);
      return await readFile(absolutePath, "utf8");
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
    }
  }

  throw new Error(
    `Unable to read local snapshot file for ${config.label}. Last error: ${lastError?.message ?? "unknown"}`
  );
}

export async function loadLocalSnapshot(game: GameType): Promise<SnapshotPayload> {
  const config = getGameConfig(game);
  const body = await readSnapshotText(game);

  return {
    sourceLabel: `local://${config.localSnapshotPath}`,
    body
  };
}

export async function loadRemoteSnapshot(game: GameType): Promise<SnapshotPayload> {
  const sourceUrl = resolveSourceUrl(game);

  const sourceResponse = await fetch(sourceUrl, {
    method: "GET",
    cache: "no-store",
    headers: {
      "User-Agent": "vietlot-internal-dashboard"
    }
  });

  if (!sourceResponse.ok) {
    throw new Error(`Unable to fetch ${getGameConfig(game).label} source data (${sourceResponse.status})`);
  }

  return {
    sourceLabel: sourceUrl,
    body: await sourceResponse.text()
  };
}
