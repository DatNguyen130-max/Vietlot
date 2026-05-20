import type { HistoricalDraw } from "@/lib/vietlott";
import type {
  CombinationProbability,
  InferentialDiagnostics,
  NumberProbability,
  PredictionResponse
} from "@/lib/predictor";

function nChooseK(n: number, k: number): number {
  if (k < 0 || k > n) {
    return 0;
  }
  if (k === 0 || k === n) {
    return 1;
  }
  const kUse = Math.min(k, n - k);
  let r = 1;
  for (let i = 1; i <= kUse; i += 1) {
    r = (r * (n - kUse + i)) / i;
  }
  return Math.round(r);
}

/** Abramowitz–Stegun erf(x) approx. */
function erfApprox(x: number): number {
  const sign = x < 0 ? -1 : 1;
  const ax = Math.abs(x);
  const t = 1 / (1 + 0.3275911 * ax);
  const y =
    1 -
    (((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t) *
      Math.exp(-ax * ax);
  return sign * y;
}

function normalCdf(x: number): number {
  return 0.5 * (1 + erfApprox(x / Math.SQRT2));
}

/** Wilson–Hilferty transform: upper-tail p-value for χ²(df). */
function chiSquareSurvival(x: number, df: number): number {
  if (x <= 0 || df <= 0) {
    return 1;
  }
  const h = 2 / (9 * df);
  const z = (Math.pow(x / df, 1 / 3) - (1 - h)) / Math.sqrt(h);
  return Math.min(1, Math.max(0, 1 - normalCdf(z)));
}

function clampInt(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, Math.floor(value)));
}

/**
 * Mô hình suy luận thống kê (không Monte Carlo có trọng số heuristic):
 * - H0: mỗi số 1..N xuất hiện với cùng kỳ vọng trong tổng 6D “lần xuất hiện” (D kỳ, mỗi kỳ 6 bi).
 * - Kiểm định χ² đa thể loại (df = N−1), phần dư Pearson cho từng số.
 * - “Gợi ý” = 6 số có phần dư dương lớn nhất (mô tả mẫu), không phải xác suất quay thật.
 */
export function estimateInferentialDraw(
  draws: HistoricalDraw[],
  numberMax: number,
  options: { lookback: number; topCombinations: number; recentWindow: number }
): PredictionResponse {
  if (draws.length < 30) {
    throw new Error("At least 30 historical draws are required.");
  }

  const safeN = clampInt(numberMax, 10, 99);
  const lookback = clampInt(options.lookback, 30, Math.min(2500, draws.length));
  const topK = clampInt(options.topCombinations, 1, 30);
  const recentWindow = clampInt(options.recentWindow, 10, Math.max(10, lookback));

  const lookbackSlice = draws.slice(-lookback);
  const D = lookbackSlice.length;
  const totalSlots = D * 6;
  const expectedPerNumber = totalSlots / safeN;
  const df = safeN - 1;
  const theoreticalMarginal = 6 / safeN;

  const frequency = Array.from({ length: safeN + 1 }, () => 0);
  const lastSeen = Array.from({ length: safeN + 1 }, () => -1);
  const recentFrequency = Array.from({ length: safeN + 1 }, () => 0);

  for (let i = 0; i < lookbackSlice.length; i += 1) {
    const draw = lookbackSlice[i];
    for (const v of draw.numbers) {
      if (v >= 1 && v <= safeN) {
        frequency[v] += 1;
        lastSeen[v] = i;
      }
    }
  }

  const rStart = Math.max(0, D - recentWindow);
  for (let i = rStart; i < D; i += 1) {
    for (const v of lookbackSlice[i].numbers) {
      if (v >= 1 && v <= safeN) {
        recentFrequency[v] += 1;
      }
    }
  }

  let chiSquare = 0;
  for (let v = 1; v <= safeN; v += 1) {
    const diff = frequency[v] - expectedPerNumber;
    chiSquare += (diff * diff) / expectedPerNumber;
  }

  const pValue = chiSquareSurvival(chiSquare, df);
  const rejectsUniformAt005 = pValue < 0.05;
  const cramersV = Math.sqrt(chiSquare / (totalSlots * Math.max(df, 1)));

  const numberProbabilities: NumberProbability[] = [];
  for (let v = 1; v <= safeN; v += 1) {
    const o = frequency[v];
    const pearsonResidual = (o - expectedPerNumber) / Math.sqrt(expectedPerNumber);
    const gap = lastSeen[v] === -1 ? D : Math.max(0, D - 1 - lastSeen[v]);
    numberProbabilities.push({
      number: v,
      probability: theoreticalMarginal,
      score: pearsonResidual,
      frequency: o,
      recentFrequency: recentFrequency[v],
      gap
    });
  }

  numberProbabilities.sort((a, b) => a.number - b.number);

  const byResidual = [...numberProbabilities].sort((a, b) => b.score - a.score);
  const recommendedNumbers = byResidual
    .slice(0, 6)
    .map((n) => n.number)
    .sort((a, b) => a - b);

  const comboMap = new Map<string, number>();
  for (const draw of lookbackSlice) {
    const key = [...draw.numbers]
      .sort((a, b) => a - b)
      .map((x) => x.toString().padStart(2, "0"))
      .join("-");
    comboMap.set(key, (comboMap.get(key) ?? 0) + 1);
  }

  const comboSpaceSize = nChooseK(safeN, 6);
  const expectedCountPerComboUnderUniform = D / comboSpaceSize;

  const topCombinations: CombinationProbability[] = [...comboMap.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, topK)
    .map(([key, count]) => ({
      numbers: key.split("-").map((item) => Number(item)),
      probability: count / D,
      estimatedOdds:
        count > 1
          ? `${count}× trong ${D} kỳ · E≈${expectedCountPerComboUnderUniform < 0.001 ? expectedCountPerComboUnderUniform.toExponential(2) : expectedCountPerComboUnderUniform.toFixed(4)}`
          : `${count}/${D} kỳ · E≈${expectedCountPerComboUnderUniform < 0.001 ? expectedCountPerComboUnderUniform.toExponential(2) : expectedCountPerComboUnderUniform.toFixed(4)}`,
      simulatedHits: count
    }));

  const interpretationVi = rejectsUniformAt005
    ? `χ²=${chiSquare.toFixed(1)} (df=${df}), p=${pValue.toFixed(4)} < 0.05: có bằng chứng thống kê (mức 5%) lệch khỏi tần suất hoàn toàn đều trong cửa sổ ${D} kỳ. Phần dư Pearson (/√E) mô tả số nào xuất hiện nhiều/ít hơn kỳ vọng — không suy ra “kỳ sau sẽ nổ” những số đó.`
    : `χ²=${chiSquare.toFixed(1)} (df=${df}), p=${pValue.toFixed(4)} ≥ 0.05: không bác bỏ H₀ đều ở mức 5%. Mẫu còn nhất quán với mô hình mỗi số có cùng kỳ vọng trong tổng 6D lần rút. Xác suất một số có mặt ở một kỳ tương lai nếu cơ chế đều: ≈ ${(theoreticalMarginal * 100).toFixed(2)}%.`;

  const inferential: InferentialDiagnostics = {
    chiSquare,
    degreesOfFreedom: df,
    pValueVsUniform: pValue,
    rejectsUniformAt005,
    expectedCountPerNumber: expectedPerNumber,
    theoreticalMarginalInNextDraw: theoreticalMarginal,
    cramersV,
    comboSpaceSize,
    expectedCountPerComboUnderUniform,
    interpretationVi
  };

  return {
    generatedAt: new Date().toISOString(),
    numberMax: safeN,
    drawsUsed: D,
    simulations: 0,
    confidenceScore: Number((cramersV * 100).toFixed(2)),
    recommendedNumbers,
    topCombinations,
    numberProbabilities,
    model: "inferential",
    inferential
  };
}
