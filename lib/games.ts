export type GameType = "power655" | "power645";

export interface GameConfig {
  game: GameType;
  label: string;
  maxNumber: number;
  hasBonus: boolean;
  tableName: string;
  localSnapshotPath: string;
}

const GAME_CONFIGS: Record<GameType, GameConfig> = {
  power655: {
    game: "power655",
    label: "Power 6/55",
    maxNumber: 55,
    hasBonus: true,
    tableName: "power655_results",
    localSnapshotPath: "data/power655.jsonl"
  },
  power645: {
    game: "power645",
    label: "Mega 6/45",
    maxNumber: 45,
    hasBonus: false,
    tableName: "power645_results",
    localSnapshotPath: "data/power645.jsonl"
  }
};

const GAME_ALIASES: Record<string, GameType> = {
  "655": "power655",
  "645": "power645",
  power655: "power655",
  power645: "power645",
  mega645: "power645",
  power6x55: "power655",
  mega6x45: "power645",
  six55: "power655",
  six45: "power645"
};

function normalizeGameValue(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]/g, "");
}

export function parseGameType(value: string | null | undefined): GameType | null {
  if (!value) {
    return "power655";
  }

  const normalized = normalizeGameValue(value);
  return GAME_ALIASES[normalized] ?? null;
}

export function getGameConfig(game: GameType): GameConfig {
  return GAME_CONFIGS[game];
}

export function getAllGames(): GameType[] {
  return ["power655", "power645"];
}
