import { readFile } from "node:fs/promises";
import path from "node:path";

import { getGameConfig, type GameType } from "@/lib/games";

const LOCAL_SNAPSHOT_CANDIDATES: Record<GameType, string[]> = {
  power655: [path.join(process.cwd(), "power655.jsonl"), path.join(process.cwd(), "data", "power655.jsonl")],
  power645: [path.join(process.cwd(), "power645.jsonl"), path.join(process.cwd(), "data", "power645.jsonl")]
};

export interface SnapshotPayload {
  sourceLabel: string;
  body: string;
}

export async function loadLocalSnapshot(game: GameType): Promise<SnapshotPayload> {
  const config = getGameConfig(game);
  const candidates = LOCAL_SNAPSHOT_CANDIDATES[game];
  let lastError: Error | null = null;
  let body: string | null = null;
  let sourcePath: string | null = null;

  for (const filePath of candidates) {
    try {
      body = await readFile(filePath, "utf8");
      sourcePath = filePath;
      break;
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
    }
  }

  if (body === null) {
    throw new Error(
      `Cannot read local snapshot for ${config.label}. Expected one of: ${candidates.join(", ")}. Last error: ${lastError?.message ?? "unknown"}`
    );
  }

  return {
    sourceLabel: `local://${sourcePath ?? config.localSnapshotPath}`,
    body
  };
}
