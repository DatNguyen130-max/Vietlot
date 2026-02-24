import { NextRequest, NextResponse } from "next/server";

import { validateApiToken } from "@/lib/auth";
import { getAllGames, getGameConfig, parseGameType, type GameType } from "@/lib/games";
import { loadLocalSnapshot } from "@/lib/snapshot";
import { parsePowerDrawJsonl, upsertPowerRows } from "@/lib/vietlott";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function parseTargetGames(value: string | null): GameType[] {
  if (!value || value.toLowerCase() === "all") {
    return getAllGames();
  }

  const parsed = parseGameType(value);
  if (!parsed) {
    throw new Error("Invalid game. Use power655, power645, or all.");
  }

  return [parsed];
}

type SyncSourceType = "local";

function parseSyncSource(sourceValue: string | null): SyncSourceType {
  if (!sourceValue) {
    return "local";
  }

  const normalized = sourceValue.trim().toLowerCase();
  if (normalized === "local" || normalized === "file" || normalized === "snapshot") {
    return "local";
  }
  throw new Error("Invalid source. Only source=local is supported.");
}

async function performSync(request: NextRequest): Promise<NextResponse> {
  const authError = validateApiToken(request);
  if (authError) {
    return NextResponse.json({ error: authError }, { status: 401 });
  }

  const games = parseTargetGames(request.nextUrl.searchParams.get("game"));
  const sourceType = parseSyncSource(request.nextUrl.searchParams.get("source"));
  const results: Array<{
    game: GameType;
    gameLabel: string;
    sourceUrl: string;
    parsedRows: number;
    writtenRows: number;
    latestDraw: {
      drawId: number;
      drawDate: string;
      numbers: number[];
      bonus: number | null;
    } | null;
  }> = [];

  for (const game of games) {
    const gameConfig = getGameConfig(game);
    const sourceResult = await loadLocalSnapshot(game);
    const body = sourceResult.body;
    const rows = parsePowerDrawJsonl(game, body);
    const written = await upsertPowerRows(game, rows);

    const latest = rows.at(-1);
    results.push({
      game,
      gameLabel: gameConfig.label,
      sourceUrl: sourceResult.sourceLabel,
      parsedRows: rows.length,
      writtenRows: written,
      latestDraw: latest
        ? {
            drawId: latest.draw_id,
            drawDate: latest.draw_date,
            numbers: latest.numbers,
            bonus: latest.bonus
          }
        : null
    });
  }

  return NextResponse.json({
    ok: true,
    source: sourceType,
    syncedGames: results.length,
    results,
    syncedAt: new Date().toISOString()
  });
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    return await performSync(request);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected error";
    const status = message.startsWith("Invalid game.") || message.startsWith("Invalid source.") ? 400 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    return await performSync(request);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected error";
    const status = message.startsWith("Invalid game.") || message.startsWith("Invalid source.") ? 400 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
