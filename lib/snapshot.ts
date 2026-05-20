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

function resolveGithubJsonlUrl(game: GameType): string {
  const specific =
    game === "power655" ? process.env.GITHUB_POWER655_JSONL_URL?.trim() : process.env.GITHUB_POWER645_JSONL_URL?.trim();

  if (specific) {
    return specific;
  }

  const base = process.env.GITHUB_JSONL_RAW_BASE?.trim().replace(/\/$/, "");
  if (base) {
    const fileName = game === "power655" ? "power655.jsonl" : "power645.jsonl";
    return `${base}/${fileName}`;
  }

  throw new Error(
    "GitHub JSONL URL is not configured. Set GITHUB_POWER655_JSONL_URL and GITHUB_POWER645_JSONL_URL, or set GITHUB_JSONL_RAW_BASE (e.g. https://raw.githubusercontent.com/USER/REPO/main/data)."
  );
}

export async function loadGithubSnapshot(game: GameType): Promise<SnapshotPayload> {
  const url = resolveGithubJsonlUrl(game);
  const response = await fetch(url, {
    cache: "no-store",
    headers: {
      Accept: "application/json,text/plain,*/*",
      "User-Agent": "VietlotDashboard/1.0"
    }
  });

  if (!response.ok) {
    throw new Error(`Failed to download JSONL (${response.status}): ${url}`);
  }

  const body = await response.text();
  return {
    sourceLabel: `github://${url}`,
    body
  };
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
