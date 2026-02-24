import { getGameConfig, type GameType } from "@/lib/games";
import { getSupabaseAdmin } from "@/lib/supabase";

const MIN_NUMBER = 1;
const MAIN_NUMBER_COUNT = 6;
const UPSERT_BATCH_SIZE = 500;

export interface PowerDrawRow {
  draw_id: number;
  draw_code: string;
  draw_date: string;
  numbers: number[];
  bonus: number | null;
  raw_result: number[];
  source_updated_at: string | null;
}

export interface HistoricalDraw {
  drawId: number;
  drawDate: string;
  numbers: number[];
  bonus: number | null;
}

export interface ManualDrawInput {
  drawId: number;
  drawDate: string;
  numbers: number[];
  bonus: number | null;
}

interface SourceRow {
  date?: unknown;
  id?: unknown;
  result?: unknown;
  process_time?: unknown;
}

function isInRange(value: number, maxNumber: number): boolean {
  return Number.isInteger(value) && value >= MIN_NUMBER && value <= maxNumber;
}

function normalizeProcessTime(value: unknown): string | null {
  if (typeof value !== "string" || !value.trim()) {
    return null;
  }

  const isoCandidate = value.replace(" ", "T");
  const parsed = new Date(isoCandidate);
  if (Number.isNaN(parsed.valueOf())) {
    return null;
  }

  return parsed.toISOString();
}

function parseResult(result: unknown, maxNumber: number, minResultCount: number, maxResultCount: number): number[] {
  if (!Array.isArray(result)) {
    throw new Error("Row contains invalid result array");
  }

  if (result.length < minResultCount) {
    throw new Error("Row result does not include enough numbers");
  }

  const parsed = result.slice(0, maxResultCount).map((value) => {
    const asNumber = Number(value);
    if (!isInRange(asNumber, maxNumber)) {
      throw new Error(`Number out of range: ${String(value)}`);
    }
    return asNumber;
  });

  return parsed;
}

export function parsePowerDrawJsonl(game: GameType, jsonlText: string): PowerDrawRow[] {
  const { maxNumber, hasBonus } = getGameConfig(game);
  const minResultCount = MAIN_NUMBER_COUNT;
  const maxResultCount = hasBonus ? 7 : 6;
  const lines = jsonlText
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  const dedupe = new Map<number, PowerDrawRow>();

  for (const line of lines) {
    let payload: SourceRow;

    try {
      payload = JSON.parse(line) as SourceRow;
    } catch {
      throw new Error(`Unable to parse JSONL line: ${line.slice(0, 80)}...`);
    }

    if (typeof payload.id !== "string" || !/^\d+$/.test(payload.id)) {
      throw new Error("Missing or invalid draw id");
    }

    if (typeof payload.date !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(payload.date)) {
      throw new Error("Missing or invalid draw date");
    }

    const drawId = Number(payload.id);
    const rawResult = parseResult(payload.result, maxNumber, minResultCount, maxResultCount);
    const mainNumbers = [...rawResult.slice(0, MAIN_NUMBER_COUNT)].sort((a, b) => a - b);

    if (new Set(mainNumbers).size !== MAIN_NUMBER_COUNT) {
      throw new Error(`Draw ${payload.id} contains duplicated main numbers`);
    }

    let bonus: number | null = null;
    if (hasBonus && rawResult.length > MAIN_NUMBER_COUNT) {
      const parsedBonus = rawResult[MAIN_NUMBER_COUNT];
      if (!isInRange(parsedBonus, maxNumber)) {
        throw new Error(`Draw ${payload.id} has invalid bonus number`);
      }
      bonus = parsedBonus;
    }

    dedupe.set(drawId, {
      draw_id: drawId,
      draw_code: payload.id,
      draw_date: payload.date,
      numbers: mainNumbers,
      bonus,
      raw_result: rawResult,
      source_updated_at: normalizeProcessTime(payload.process_time)
    });
  }

  return [...dedupe.values()].sort((a, b) => a.draw_id - b.draw_id);
}

export function makeManualPowerRow(game: GameType, input: ManualDrawInput): PowerDrawRow {
  const { maxNumber, hasBonus } = getGameConfig(game);
  const drawId = Math.floor(input.drawId);
  if (!Number.isInteger(drawId) || drawId <= 0) {
    throw new Error("drawId must be a positive integer.");
  }

  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.drawDate)) {
    throw new Error("drawDate must be in YYYY-MM-DD format.");
  }

  if (!Array.isArray(input.numbers) || input.numbers.length !== MAIN_NUMBER_COUNT) {
    throw new Error("numbers must contain exactly 6 values.");
  }

  const normalizedNumbers = input.numbers.map((value) => Math.floor(Number(value))).sort((a, b) => a - b);
  for (const value of normalizedNumbers) {
    if (!isInRange(value, maxNumber)) {
      throw new Error(`numbers must be within 1..${maxNumber}.`);
    }
  }

  if (new Set(normalizedNumbers).size !== MAIN_NUMBER_COUNT) {
    throw new Error("numbers must not contain duplicates.");
  }

  let bonus: number | null = null;
  if (hasBonus) {
    if (input.bonus === null || input.bonus === undefined) {
      bonus = null;
    } else {
      const parsedBonus = Math.floor(Number(input.bonus));
      if (!isInRange(parsedBonus, maxNumber)) {
        throw new Error(`bonus must be within 1..${maxNumber}.`);
      }
      bonus = parsedBonus;
    }
  }

  const raw_result = bonus === null ? [...normalizedNumbers] : [...normalizedNumbers, bonus];
  return {
    draw_id: drawId,
    draw_code: String(drawId).padStart(5, "0"),
    draw_date: input.drawDate,
    numbers: normalizedNumbers,
    bonus,
    raw_result,
    source_updated_at: new Date().toISOString()
  };
}

export async function upsertPowerRows(game: GameType, rows: PowerDrawRow[]): Promise<number> {
  if (rows.length === 0) {
    return 0;
  }

  const { tableName } = getGameConfig(game);
  const supabase = getSupabaseAdmin();
  let processedCount = 0;

  for (let index = 0; index < rows.length; index += UPSERT_BATCH_SIZE) {
    const batch = rows.slice(index, index + UPSERT_BATCH_SIZE);

    const { error, count } = await supabase.from(tableName).upsert(batch, {
      onConflict: "draw_id",
      ignoreDuplicates: false,
      count: "exact"
    });

    if (error) {
      const hint = /fetch failed/i.test(error.message)
        ? " Check SUPABASE_URL and use service_role key in SUPABASE_SERVICE_ROLE_KEY."
        : "";
      throw new Error(`Failed to upsert rows to Supabase: ${error.message}.${hint}`);
    }

    processedCount += count ?? batch.length;
  }

  return processedCount;
}

export async function fetchHistoricalDraws(game: GameType, limit: number): Promise<HistoricalDraw[]> {
  const safeLimit = Math.max(50, Math.min(2500, Math.floor(limit)));
  const { tableName } = getGameConfig(game);
  const supabase = getSupabaseAdmin();

  const { data, error } = await supabase
    .from(tableName)
    .select("draw_id, draw_date, numbers, bonus")
    .order("draw_date", { ascending: false })
    .limit(safeLimit);

  if (error) {
    const hint = /fetch failed/i.test(error.message)
      ? " Check SUPABASE_URL and use service_role key in SUPABASE_SERVICE_ROLE_KEY."
      : "";
    throw new Error(`Failed to load historical data: ${error.message}.${hint}`);
  }

  return (data ?? [])
    .map((row) => ({
      drawId: Number(row.draw_id),
      drawDate: String(row.draw_date),
      numbers: (row.numbers as number[]).map((n) => Number(n)).sort((a, b) => a - b),
      bonus: row.bonus === null ? null : Number(row.bonus)
    }))
    .sort((a, b) => a.drawId - b.drawId);
}
