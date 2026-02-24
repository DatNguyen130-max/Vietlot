import { NextRequest, NextResponse } from "next/server";

import { getGameConfig, parseGameType } from "@/lib/games";
import { estimateNextDraw } from "@/lib/predictor";
import { loadLocalSnapshot } from "@/lib/snapshot";
import { fetchHistoricalDraws, parsePowerDrawJsonl, upsertPowerRows, type HistoricalDraw } from "@/lib/vietlott";

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

interface BootstrapResult {
  used: boolean;
  source?: string;
  parsedRows?: number;
  writtenRows?: number;
  fallbackMode?: "database" | "local_snapshot";
  warning?: string;
}

function mapRowsToHistorical(rows: ReturnType<typeof parsePowerDrawJsonl>): HistoricalDraw[] {
  return rows.map((row) => ({
    drawId: row.draw_id,
    drawDate: row.draw_date,
    numbers: [...row.numbers].sort((a, b) => a - b),
    bonus: row.bonus
  }));
}

interface FetchResult {
  rows: HistoricalDraw[];
  error?: string;
}

async function safeFetchHistorical(game: ReturnType<typeof parseGameType>, limit: number): Promise<FetchResult> {
  if (!game) {
    return { rows: [] };
  }

  try {
    const rows = await fetchHistoricalDraws(game, limit);
    return { rows };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { rows: [], error: message };
  }
}

async function loadHistoricalWithBootstrap(game: ReturnType<typeof parseGameType>, limit: number): Promise<{
  historical: HistoricalDraw[];
  bootstrap: BootstrapResult;
}> {
  if (!game) {
    return { historical: [], bootstrap: { used: false } };
  }

  const initialFetch = await safeFetchHistorical(game, limit);
  const historical = initialFetch.rows;
  if (historical.length >= 30) {
    return {
      historical,
      bootstrap: {
        used: false,
        fallbackMode: "database",
        warning: initialFetch.error
      }
    };
  }

  const localSnapshot = await loadLocalSnapshot(game);
  const rows = parsePowerDrawJsonl(game, localSnapshot.body);
  const warnings: string[] = [];
  if (initialFetch.error) {
    warnings.push(`Initial Supabase read failed: ${initialFetch.error}`);
  }

  let writtenRows = 0;
  try {
    writtenRows = await upsertPowerRows(game, rows);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    warnings.push(`Supabase upsert failed: ${message}`);
  }

  const reloadedFetch = await safeFetchHistorical(game, limit);
  const reloaded = reloadedFetch.rows;
  if (reloadedFetch.error) {
    warnings.push(`Supabase read after bootstrap failed: ${reloadedFetch.error}`);
  }

  if (reloaded.length >= 30) {
    return {
      historical: reloaded,
      bootstrap: {
        used: true,
        source: localSnapshot.sourceLabel,
        parsedRows: rows.length,
        writtenRows,
        fallbackMode: "database",
        warning: warnings.length ? warnings.join(" | ") : undefined
      }
    };
  }

  // If DB still returns empty/too few rows after upsert, fallback to local snapshot for prediction.
  const snapshotHistorical = mapRowsToHistorical(rows).slice(-Math.max(limit, 50));

  return {
    historical: snapshotHistorical,
    bootstrap: {
      used: true,
      source: localSnapshot.sourceLabel,
      parsedRows: rows.length,
      writtenRows,
      fallbackMode: "local_snapshot",
      warning: warnings.length
        ? `Using local snapshot because Supabase returned too few rows after bootstrap. ${warnings.join(" | ")}`
        : "Using local snapshot because Supabase returned too few rows after bootstrap."
    }
  };
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

    const { historical, bootstrap } = await loadHistoricalWithBootstrap(game, Math.max(lookback, 300));

    if (historical.length < 30) {
      const bootstrapHint = bootstrap.used
        ? `Bootstrap attempted from ${bootstrap.source ?? "local snapshot"} (parsed=${bootstrap.parsedRows ?? 0}, written=${bootstrap.writtenRows ?? 0}).`
        : "Bootstrap was not triggered.";

      return NextResponse.json(
        {
          error: `Not enough ${gameConfig.label} historical data in Supabase (current: ${historical.length}). Run /api/sync?source=local to initialize data. ${bootstrapHint}`,
          bootstrap
        },
        { status: 400 }
      );
    }

    const prediction = estimateNextDraw(historical, gameConfig.maxNumber, { lookback, simulations, topCombinations, recentWindow });

    return NextResponse.json({
      game,
      gameLabel: gameConfig.label,
      ...prediction,
      latestDraw: historical.at(-1) ?? null,
      bootstrap
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
