import type { GameType } from "@/lib/games";

/** JS weekday: 0 = Sunday … 6 = Saturday (the instant is anchored at noon +07:00 for the given calendar day in Vietnam). */

/** Power 6/55: thứ Ba, Năm, Bảy */
const POWER655_WEEKDAYS = [2, 4, 6];

/** Mega 6/45: thứ Tư, Sáu, Chủ nhật */
const POWER645_WEEKDAYS = [0, 3, 5];

const VI_DAY_NAMES = ["Chủ nhật", "Thứ hai", "Thứ ba", "Thứ tư", "Thứ năm", "Thứ sáu", "Thứ bảy"];

const GAME_SCHEDULE: Record<GameType, { weekdays: number[]; descriptionVi: string }> = {
  power655: {
    weekdays: POWER655_WEEKDAYS,
    descriptionVi: "Thứ Ba, Năm, Bảy (Power 6/55)"
  },
  power645: {
    weekdays: POWER645_WEEKDAYS,
    descriptionVi: "Thứ Tư, Sáu, Chủ nhật (Mega 6/45)"
  }
};

export interface NextDrawInfo {
  /** Next official draw date (YYYY-MM-DD, Asia/Ho_Chi_Minh calendar). */
  nextDrawDate: string;
  weekdayVi: string;
  scheduleDescriptionVi: string;
  vietnamToday: string;
  /** First scheduled date strictly after the latest stored draw (before merging with "today"). */
  firstAfterLatest: string | null;
}

export function vietnamTodayYmd(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Ho_Chi_Minh" });
}

export function addDaysYmd(ymd: string, delta: number): string {
  const t = new Date(`${ymd}T12:00:00+07:00`);
  t.setTime(t.getTime() + delta * 86_400_000);
  return t.toLocaleDateString("en-CA", { timeZone: "Asia/Ho_Chi_Minh" });
}

function jsWeekdayForYmdVN(ymd: string): number {
  const t = new Date(`${ymd}T12:00:00+07:00`);
  return t.getUTCDay();
}

function weekdayLabelVi(ymd: string): string {
  return VI_DAY_NAMES[jsWeekdayForYmdVN(ymd)];
}

function nextOnOrAfter(ymd: string, allowed: number[]): string {
  let cursor = ymd;
  for (let i = 0; i < 14; i += 1) {
    if (allowed.includes(jsWeekdayForYmdVN(cursor))) {
      return cursor;
    }
    cursor = addDaysYmd(cursor, 1);
  }
  throw new Error("Could not find next draw day (on or after) within 14 days.");
}

function nextStrictlyAfter(ymd: string, allowed: number[]): string {
  return nextOnOrAfter(addDaysYmd(ymd, 1), allowed);
}

/**
 * Next scheduled draw date used for UI + prediction context.
 * - Prefers the first draw day strictly after `latestDrawDate` when that is still upcoming (>= today VN).
 * - If that date is already in the past (data lag), uses the first draw day on or after today VN.
 */
export function getNextDrawInfo(game: GameType, latestDrawDate: string | null): NextDrawInfo {
  const { weekdays, descriptionVi } = GAME_SCHEDULE[game];
  const today = vietnamTodayYmd();

  if (!latestDrawDate) {
    const next = nextOnOrAfter(today, weekdays);
    return {
      nextDrawDate: next,
      weekdayVi: weekdayLabelVi(next),
      scheduleDescriptionVi: descriptionVi,
      vietnamToday: today,
      firstAfterLatest: null
    };
  }

  const firstAfterLatest = nextStrictlyAfter(latestDrawDate, weekdays);
  const nextDrawDate = firstAfterLatest >= today ? firstAfterLatest : nextOnOrAfter(today, weekdays);

  return {
    nextDrawDate,
    weekdayVi: weekdayLabelVi(nextDrawDate),
    scheduleDescriptionVi: descriptionVi,
    vietnamToday: today,
    firstAfterLatest
  };
}
