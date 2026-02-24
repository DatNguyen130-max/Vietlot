import { readFile } from "node:fs/promises";

import { getGameConfig, resolveSourceUrl, type GameType } from "@/lib/games";

const LOCAL_SNAPSHOT_URLS: Record<GameType, URL> = {
  power655: new URL("../data/power655.jsonl", import.meta.url),
  power645: new URL("../data/power645.jsonl", import.meta.url)
};

export interface SnapshotPayload {
  sourceLabel: string;
  body: string;
}

export async function loadLocalSnapshot(game: GameType): Promise<SnapshotPayload> {
  const config = getGameConfig(game);
  const body = await readFile(LOCAL_SNAPSHOT_URLS[game], "utf8");

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
