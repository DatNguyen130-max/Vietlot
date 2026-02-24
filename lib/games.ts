export type GameType = "power655" | "power645";

export interface GameConfig {
  game: GameType;
  label: string;
  maxNumber: number;
  hasBonus: boolean;
  tableName: string;
  defaultSourceUrl: string;
  sourceEnvVar: string;
}

const GAME_CONFIGS: Record<GameType, GameConfig> = {
  power655: {
    game: "power655",
    label: "Power 6/55",
    maxNumber: 55,
    hasBonus: true,
    tableName: "power655_results",
    defaultSourceUrl: "https://raw.githubusercontent.com/vietvudanh/vietlott-data/main/data/power655.jsonl",
    sourceEnvVar: "SYNC_SOURCE_URL_655"
  },
  power645: {
    game: "power645",
    label: "Mega 6/45",
    maxNumber: 45,
    hasBonus: false,
    tableName: "power645_results",
    defaultSourceUrl: "https://raw.githubusercontent.com/vietvudanh/vietlott-data/main/data/power645.jsonl",
    sourceEnvVar: "SYNC_SOURCE_URL_645"
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

export function resolveSourceUrl(game: GameType): string {
  const config = getGameConfig(game);
  const direct = process.env[config.sourceEnvVar];
  if (direct && direct.trim()) {
    return direct.trim();
  }

  // Backward compatibility with previous single-game env var.
  if (game === "power655") {
    const legacy = process.env.SYNC_SOURCE_URL;
    if (legacy && legacy.trim()) {
      return legacy.trim();
    }
  }

  return config.defaultSourceUrl;
}
