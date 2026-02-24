import { NextRequest, NextResponse } from "next/server";

import { getGameConfig, parseGameType } from "@/lib/games";
import { estimateNextDraw } from "@/lib/predictor";
import { fetchHistoricalDraws } from "@/lib/vietlott";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function parseInteger(value: string | null, fallback: number): number {
  if (!value) {
    return fallback;
  }

  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return fallback;
  }

  return Math.floor(parsed);
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const game = parseGameType(request.nextUrl.searchParams.get("game"));
    if (!game) {
      return NextResponse.json({ error: "Invalid game. Use power655 or power645." }, { status: 400 });
    }

    const gameConfig = getGameConfig(game);
    const lookback = parseInteger(request.nextUrl.searchParams.get("lookback"), 300);
    const simulations = parseInteger(request.nextUrl.searchParams.get("simulations"), 25000);
    const topCombinations = parseInteger(request.nextUrl.searchParams.get("top"), 10);
    const recentWindow = parseInteger(request.nextUrl.searchParams.get("recentWindow"), 45);

    const historical = await fetchHistoricalDraws(game, Math.max(lookback, 300));

    if (historical.length < 30) {
      return NextResponse.json(
        {
          error: `Not enough ${gameConfig.label} historical data in Supabase. Please run /api/sync first.`
        },
        { status: 400 }
      );
    }

    const prediction = estimateNextDraw(historical, gameConfig.maxNumber, { lookback, simulations, topCombinations, recentWindow });

    return NextResponse.json({
      game,
      gameLabel: gameConfig.label,
      ...prediction,
      latestDraw: historical.at(-1) ?? null
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected error";

    return NextResponse.json(
      {
        error: message
      },
      { status: 500 }
    );
  }
}
