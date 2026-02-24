import { NextRequest, NextResponse } from "next/server";

import { validateApiToken } from "@/lib/auth";
import { getGameConfig, parseGameType } from "@/lib/games";
import { makeManualPowerRow, upsertPowerRows } from "@/lib/vietlott";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface ManualPayload {
  game?: unknown;
  drawId?: unknown;
  drawDate?: unknown;
  numbers?: unknown;
  bonus?: unknown;
  jackpot2Value?: unknown;
}

function toInt(value: unknown): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    throw new Error("drawId must be a number.");
  }
  return Math.floor(parsed);
}

function toBonus(value: unknown): number | null {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    throw new Error("bonus must be a number or null.");
  }
  return Math.floor(parsed);
}

function toJackpot2Value(value: unknown): number | null {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    throw new Error("jackpot2Value must be a non-negative integer or null.");
  }

  const asInt = Math.floor(parsed);
  if (asInt < 0) {
    throw new Error("jackpot2Value must be a non-negative integer or null.");
  }

  return asInt;
}

function toNumbers(value: unknown): number[] {
  if (!Array.isArray(value)) {
    throw new Error("numbers must be an array of 6 values.");
  }

  return value.map((item) => {
    const parsed = Number(item);
    if (!Number.isFinite(parsed)) {
      throw new Error("numbers must contain only numeric values.");
    }
    return Math.floor(parsed);
  });
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const authError = validateApiToken(request);
    if (authError) {
      return NextResponse.json({ error: authError }, { status: 401 });
    }

    const body = (await request.json()) as ManualPayload;
    const game = parseGameType(typeof body.game === "string" ? body.game : null);
    if (!game) {
      return NextResponse.json({ error: "Invalid game. Use power655 or power645." }, { status: 400 });
    }

    if (typeof body.drawDate !== "string") {
      return NextResponse.json({ error: "drawDate is required in YYYY-MM-DD format." }, { status: 400 });
    }

    const row = makeManualPowerRow(game, {
      drawId: toInt(body.drawId),
      drawDate: body.drawDate,
      numbers: toNumbers(body.numbers),
      bonus: toBonus(body.bonus),
      jackpot2Value: toJackpot2Value(body.jackpot2Value)
    });

    await upsertPowerRows(game, [row]);

    return NextResponse.json({
      ok: true,
      game,
      gameLabel: getGameConfig(game).label,
      draw: {
        drawId: row.draw_id,
        drawDate: row.draw_date,
        numbers: row.numbers,
        bonus: row.bonus,
        jackpot2Value: row.jackpot2_value ?? null
      },
      updatedAt: new Date().toISOString()
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
