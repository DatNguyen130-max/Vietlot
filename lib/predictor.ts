import type { HistoricalDraw } from "@/lib/vietlott";

const NUMBER_MIN = 1;
const PICK_COUNT = 6;

export interface NumberProbability {
  number: number;
  probability: number;
  score: number;
  frequency: number;
  recentFrequency: number;
  gap: number;
}

export interface CombinationProbability {
  numbers: number[];
  probability: number;
  estimatedOdds: string;
  simulatedHits: number;
}

export interface PredictionResponse {
  generatedAt: string;
  numberMax: number;
  drawsUsed: number;
  simulations: number;
  confidenceScore: number;
  recommendedNumbers: number[];
  topCombinations: CombinationProbability[];
  numberProbabilities: NumberProbability[];
}

export interface PredictionOptions {
  lookback: number;
  simulations: number;
  topCombinations: number;
  recentWindow: number;
}

function clampInt(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) {
    return min;
  }

  return Math.max(min, Math.min(max, Math.floor(value)));
}

function createRng(seed: number): () => number {
  let x = seed >>> 0;

  return () => {
    x ^= x << 13;
    x ^= x >>> 17;
    x ^= x << 5;
    return ((x >>> 0) & 0xffffffff) / 0x100000000;
  };
}

function scoreToWeights(scores: number[], numberCount: number): number[] {
  const total = scores.reduce((sum, value) => sum + value, 0);
  if (total <= 0) {
    return Array.from({ length: numberCount }, () => 1 / numberCount);
  }

  return scores.map((score) => score / total);
}

function sampleCombination(weights: number[], numberMax: number, random: () => number): number[] {
  const numberCount = numberMax - NUMBER_MIN + 1;
  const availableNumbers = Array.from({ length: numberCount }, (_, index) => index + NUMBER_MIN);
  const availableWeights = [...weights];
  const picked: number[] = [];

  for (let step = 0; step < PICK_COUNT; step += 1) {
    const totalWeight = availableWeights.reduce((sum, value) => sum + value, 0);
    let marker = random() * totalWeight;
    let selectedIndex = 0;

    for (let i = 0; i < availableWeights.length; i += 1) {
      marker -= availableWeights[i];
      if (marker <= 0) {
        selectedIndex = i;
        break;
      }
      if (i === availableWeights.length - 1) {
        selectedIndex = i;
      }
    }

    picked.push(availableNumbers[selectedIndex]);
    availableNumbers.splice(selectedIndex, 1);
    availableWeights.splice(selectedIndex, 1);
  }

  return picked.sort((a, b) => a - b);
}

function comboKey(numbers: number[]): string {
  return numbers.map((value) => value.toString().padStart(2, "0")).join("-");
}

function parseComboKey(key: string): number[] {
  return key.split("-").map((item) => Number(item));
}

function formatOdds(probability: number): string {
  if (probability <= 0) {
    return "N/A";
  }

  const oneIn = Math.round(1 / probability);
  return `1 / ${oneIn.toLocaleString("en-US")}`;
}

function computeConfidence(weights: number[], numberCount: number): number {
  const entropy = -weights.reduce((sum, value) => {
    if (value <= 0) {
      return sum;
    }

    return sum + value * Math.log(value);
  }, 0);

  const normalizedEntropy = entropy / Math.log(numberCount);
  const concentration = Math.max(0, 1 - normalizedEntropy);
  return Number((concentration * 100).toFixed(2));
}

export function estimateNextDraw(
  draws: HistoricalDraw[],
  numberMax: number,
  options: PredictionOptions
): PredictionResponse {
  if (draws.length < 30) {
    throw new Error("At least 30 historical draws are required to estimate probabilities.");
  }

  const safeNumberMax = clampInt(numberMax, 10, 99);
  const numberCount = safeNumberMax - NUMBER_MIN + 1;
  const lookback = clampInt(options.lookback, 30, 2500);
  const simulations = clampInt(options.simulations, 1000, 120000);
  const topCombinations = clampInt(options.topCombinations, 1, 30);

  const lookbackSlice = draws.slice(-lookback);
  const recentWindow = clampInt(options.recentWindow, 10, Math.max(10, lookbackSlice.length));

  const frequency = Array.from({ length: safeNumberMax + 1 }, () => 0);
  const recentFrequency = Array.from({ length: safeNumberMax + 1 }, () => 0);
  const bonusFrequency = Array.from({ length: safeNumberMax + 1 }, () => 0);
  const lastSeen = Array.from({ length: safeNumberMax + 1 }, () => -1);

  for (let drawIndex = 0; drawIndex < lookbackSlice.length; drawIndex += 1) {
    const draw = lookbackSlice[drawIndex];
    const isRecent = drawIndex >= lookbackSlice.length - recentWindow;

    for (const value of draw.numbers) {
      if (value < NUMBER_MIN || value > safeNumberMax) {
        continue;
      }
      frequency[value] += 1;
      lastSeen[value] = drawIndex;
      if (isRecent) {
        recentFrequency[value] += 1;
      }
    }

    if (typeof draw.bonus === "number" && draw.bonus >= NUMBER_MIN && draw.bonus <= safeNumberMax) {
      bonusFrequency[draw.bonus] += 1;
    }
  }

  const maxFrequency = Math.max(...frequency.slice(1));
  const maxRecent = Math.max(...recentFrequency.slice(1));
  const maxBonus = Math.max(...bonusFrequency.slice(1));

  const scoreMap = Array.from({ length: safeNumberMax + 1 }, () => 0);

  for (let value = NUMBER_MIN; value <= safeNumberMax; value += 1) {
    const hotScore = maxFrequency > 0 ? frequency[value] / maxFrequency : 0;
    const trendScore = maxRecent > 0 ? recentFrequency[value] / maxRecent : 0;
    const bonusScore = maxBonus > 0 ? bonusFrequency[value] / maxBonus : 0;

    const missingDraws =
      lastSeen[value] === -1 ? lookbackSlice.length : Math.max(0, lookbackSlice.length - 1 - lastSeen[value]);
    const overdueScore = Math.min(1, missingDraws / Math.max(1, Math.round(lookbackSlice.length / 3)));

    scoreMap[value] = hotScore * 0.5 + trendScore * 0.26 + overdueScore * 0.16 + bonusScore * 0.08 + 0.01;
  }

  const weights = scoreToWeights(scoreMap.slice(1), numberCount);
  const random = createRng((lookbackSlice.at(-1)?.drawId ?? draws.length) * 9973 + simulations * 11 + lookback * 3);

  const numberHits = Array.from({ length: safeNumberMax + 1 }, () => 0);
  const comboCounts = new Map<string, number>();

  for (let index = 0; index < simulations; index += 1) {
    const sampled = sampleCombination(weights, safeNumberMax, random);

    for (const value of sampled) {
      numberHits[value] += 1;
    }

    const key = comboKey(sampled);
    comboCounts.set(key, (comboCounts.get(key) ?? 0) + 1);
  }

  const numberProbabilities: NumberProbability[] = Array.from({ length: numberCount }, (_, offset) => {
    const value = offset + NUMBER_MIN;
    return {
      number: value,
      probability: numberHits[value] / simulations,
      score: scoreMap[value],
      frequency: frequency[value],
      recentFrequency: recentFrequency[value],
      gap:
        lastSeen[value] === -1
          ? lookbackSlice.length
          : Math.max(0, lookbackSlice.length - 1 - lastSeen[value])
    };
  }).sort((a, b) => b.probability - a.probability);

  const topCombinationList: CombinationProbability[] = [...comboCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, topCombinations)
    .map(([key, hits]) => {
      const probability = hits / simulations;
      return {
        numbers: parseComboKey(key),
        probability,
        estimatedOdds: formatOdds(probability),
        simulatedHits: hits
      };
    });

  const recommendedNumbers = numberProbabilities
    .slice(0, PICK_COUNT)
    .map((item) => item.number)
    .sort((a, b) => a - b);

  return {
    generatedAt: new Date().toISOString(),
    numberMax: safeNumberMax,
    drawsUsed: lookbackSlice.length,
    simulations,
    confidenceScore: computeConfidence(weights, numberCount),
    recommendedNumbers,
    topCombinations: topCombinationList,
    numberProbabilities
  };
}
