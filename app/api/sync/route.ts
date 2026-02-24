import { NextRequest, NextResponse } from "next/server";

import { getAllGames, getGameConfig, parseGameType, resolveSourceUrl, type GameType } from "@/lib/games";
import { parsePowerDrawJsonl, upsertPowerRows } from "@/lib/vietlott";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function readToken(request: NextRequest): string | null {
  const bearer = request.headers.get("authorization");
  if (bearer?.startsWith("Bearer ")) {
    return bearer.slice("Bearer ".length).trim();
  }

  return (
    request.headers.get("x-sync-token") ??
    request.nextUrl.searchParams.get("token") ??
    request.nextUrl.searchParams.get("syncToken")
  );
}

function authorize(request: NextRequest): string | null {
  const expectedTokens = [process.env.SYNC_TOKEN, process.env.CRON_SECRET].filter(
    (value): value is string => Boolean(value && value.trim())
  );

  if (expectedTokens.length === 0) {
    return null;
  }

  const incoming = readToken(request);
  if (!incoming || !expectedTokens.includes(incoming)) {
    return "Unauthorized";
  }

  return null;
}

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

async function performSync(request: NextRequest): Promise<NextResponse> {
  const authError = authorize(request);
  if (authError) {
    return NextResponse.json({ error: authError }, { status: 401 });
  }

  const games = parseTargetGames(request.nextUrl.searchParams.get("game"));
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
    const sourceUrl = resolveSourceUrl(game);

    const sourceResponse = await fetch(sourceUrl, {
      method: "GET",
      cache: "no-store",
      headers: {
        "User-Agent": "vietlot-internal-dashboard"
      }
    });

    if (!sourceResponse.ok) {
      throw new Error(`Unable to fetch ${gameConfig.label} source data (${sourceResponse.status})`);
    }

    const body = await sourceResponse.text();
    const rows = parsePowerDrawJsonl(game, body);
    const written = await upsertPowerRows(game, rows);

    const latest = rows.at(-1);
    results.push({
      game,
      gameLabel: gameConfig.label,
      sourceUrl,
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
    const status = message.startsWith("Invalid game.") ? 400 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    return await performSync(request);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected error";
    const status = message.startsWith("Invalid game.") ? 400 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
