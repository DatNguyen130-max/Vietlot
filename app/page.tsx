"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import styles from "./page.module.css";

type GameType = "power655" | "power645";

interface LatestDraw {
  drawId: number;
  drawDate: string;
  numbers: number[];
  bonus: number | null;
}

interface NumberProbability {
  number: number;
  probability: number;
  score: number;
  frequency: number;
  recentFrequency: number;
  gap: number;
}

interface CombinationProbability {
  numbers: number[];
  probability: number;
  estimatedOdds: string;
  simulatedHits: number;
}

interface PredictionPayload {
  game: GameType;
  gameLabel: string;
  generatedAt: string;
  numberMax: number;
  drawsUsed: number;
  simulations: number;
  confidenceScore: number;
  recommendedNumbers: number[];
  topCombinations: CombinationProbability[];
  numberProbabilities: NumberProbability[];
  latestDraw: LatestDraw | null;
}

interface QueryParams {
  game: GameType;
  lookback: number;
  simulations: number;
  top: number;
  recentWindow: number;
}

const DEFAULT_QUERY: QueryParams = {
  game: "power655",
  lookback: 420,
  simulations: 40000,
  top: 12,
  recentWindow: 60
};

const GAME_OPTIONS: Array<{ value: GameType; label: string }> = [
  { value: "power655", label: "Power 6/55" },
  { value: "power645", label: "Mega 6/45" }
];

function toPercent(value: number): string {
  return `${(value * 100).toFixed(3)}%`;
}

function formatDrawDate(isoDate: string): string {
  const parsed = new Date(isoDate);
  if (Number.isNaN(parsed.valueOf())) {
    return isoDate;
  }

  return parsed.toLocaleDateString("vi-VN");
}

function buildPredictUrl(params: QueryParams): string {
  const search = new URLSearchParams({
    game: params.game,
    lookback: String(params.lookback),
    simulations: String(params.simulations),
    top: String(params.top),
    recentWindow: String(params.recentWindow)
  });

  return `/api/predict?${search.toString()}`;
}

export default function HomePage() {
  const [query, setQuery] = useState<QueryParams>(DEFAULT_QUERY);
  const [data, setData] = useState<PredictionPayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);

  const maxProbability = useMemo(() => {
    if (!data || data.numberProbabilities.length === 0) {
      return 0;
    }

    return data.numberProbabilities[0].probability;
  }, [data]);

  const loadPrediction = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(buildPredictUrl(query), { method: "GET", cache: "no-store" });
      const payload = (await response.json()) as PredictionPayload & { error?: string };

      if (!response.ok) {
        throw new Error(payload.error ?? "Không tải được dữ liệu dự đoán.");
      }

      setData(payload);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Không tải được dữ liệu dự đoán.");
    } finally {
      setLoading(false);
    }
  }, [query]);

  useEffect(() => {
    void loadPrediction();
  }, [loadPrediction]);

  const onSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    void loadPrediction();
  };

  const onSync = async () => {
    setSyncing(true);
    setError(null);

    try {
      const token = window.prompt("Nếu bạn đã bật SYNC_TOKEN, nhập token ở đây (có thể để trống)");
      const search = new URLSearchParams({
        game: query.game
      });
      if (token?.trim()) {
        search.set("token", token.trim());
      }

      const response = await fetch(`/api/sync?${search.toString()}`, {
        method: "POST",
        cache: "no-store"
      });

      const payload = (await response.json()) as { error?: string };

      if (!response.ok) {
        throw new Error(payload.error ?? "Đồng bộ dữ liệu thất bại.");
      }

      await loadPrediction();
    } catch (syncError) {
      setError(syncError instanceof Error ? syncError.message : "Đồng bộ dữ liệu thất bại.");
    } finally {
      setSyncing(false);
    }
  };

  return (
    <main className={styles.wrapper}>
      <section className={styles.headerCard}>
        <p className={styles.badge}>Internal Dashboard</p>
        <h1>Ước tính xác suất dãy số cho kỳ quay tới ({query.game === "power655" ? "Power 6/55" : "Mega 6/45"})</h1>
        <p className={styles.subtitle}>
          Mô hình này chỉ dùng thống kê lịch sử và mô phỏng Monte Carlo để tham khảo nội bộ, không phải cam kết kết quả quay số.
        </p>

        <form className={styles.form} onSubmit={onSubmit}>
          <label>
            Loại vé
            <select
              value={query.game}
              onChange={(event) =>
                setQuery((prev) => ({
                  ...prev,
                  game: event.target.value as GameType
                }))
              }
            >
              {GAME_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>

          <label>
            Lookback (kỳ)
            <input
              type="number"
              min={30}
              max={2500}
              value={query.lookback}
              onChange={(event) =>
                setQuery((prev) => ({
                  ...prev,
                  lookback: Number(event.target.value)
                }))
              }
            />
          </label>

          <label>
            Simulations
            <input
              type="number"
              min={1000}
              max={120000}
              step={1000}
              value={query.simulations}
              onChange={(event) =>
                setQuery((prev) => ({
                  ...prev,
                  simulations: Number(event.target.value)
                }))
              }
            />
          </label>

          <label>
            Top tổ hợp
            <input
              type="number"
              min={1}
              max={30}
              value={query.top}
              onChange={(event) =>
                setQuery((prev) => ({
                  ...prev,
                  top: Number(event.target.value)
                }))
              }
            />
          </label>

          <label>
            Cửa sổ gần nhất
            <input
              type="number"
              min={10}
              max={query.lookback}
              value={query.recentWindow}
              onChange={(event) =>
                setQuery((prev) => ({
                  ...prev,
                  recentWindow: Number(event.target.value)
                }))
              }
            />
          </label>

          <div className={styles.actions}>
            <button type="submit" disabled={loading}>
              {loading ? "Đang tính..." : "Tính xác suất"}
            </button>
            <button type="button" className={styles.secondaryBtn} onClick={onSync} disabled={syncing}>
              {syncing ? "Đang sync..." : "Sync dữ liệu game đang chọn"}
            </button>
          </div>
        </form>

        {error && <p className={styles.error}>{error}</p>}
      </section>

      {data && (
        <>
          <section className={styles.metrics}>
            <article>
              <span>Latest draw ({data.gameLabel})</span>
              {data.latestDraw ? (
                <strong>
                  #{String(data.latestDraw.drawId).padStart(5, "0")} ({formatDrawDate(data.latestDraw.drawDate)})
                </strong>
              ) : (
                <strong>Chưa có dữ liệu</strong>
              )}
            </article>
            <article>
              <span>Dữ liệu dùng</span>
              <strong>{data.drawsUsed.toLocaleString("vi-VN")} kỳ</strong>
            </article>
            <article>
              <span>Mô phỏng</span>
              <strong>{data.simulations.toLocaleString("vi-VN")}</strong>
            </article>
            <article>
              <span>Confidence</span>
              <strong>{data.confidenceScore.toFixed(2)} / 100</strong>
            </article>
          </section>

          <section className={styles.recommended}>
            <h2>Bộ 6 số khuyến nghị theo xác suất biên cao nhất</h2>
            <div className={styles.ballRow}>
              {data.recommendedNumbers.map((value) => (
                <span key={value} className={styles.ball}>
                  {String(value).padStart(2, "0")}
                </span>
              ))}
            </div>
            <p className={styles.timestamp}>Generated at: {new Date(data.generatedAt).toLocaleString("vi-VN")}</p>
          </section>

          <section className={styles.gridSection}>
            <article className={styles.combinationsCard}>
              <h3>Top tổ hợp 6 số</h3>
              <div className={styles.comboList}>
                {data.topCombinations.map((combo, index) => (
                  <div key={combo.numbers.join("-")} className={styles.comboItem}>
                    <div>
                      <span className={styles.rank}>#{index + 1}</span>
                      <strong>{combo.numbers.map((value) => String(value).padStart(2, "0")).join(" - ")}</strong>
                    </div>
                    <div className={styles.comboMeta}>
                      <span>{toPercent(combo.probability)}</span>
                      <span>{combo.estimatedOdds}</span>
                    </div>
                  </div>
                ))}
              </div>
            </article>

            <article className={styles.heatmapCard}>
              <h3>Xác suất từng số (1-{data.numberMax})</h3>
              <div className={styles.heatmap}>
                {data.numberProbabilities
                  .slice()
                  .sort((a, b) => a.number - b.number)
                  .map((item) => {
                    const ratio = maxProbability > 0 ? item.probability / maxProbability : 0;
                    const fill = Math.max(6, Math.round(ratio * 100));

                    return (
                      <div
                        key={item.number}
                        className={styles.heatCell}
                        style={{
                          background: `linear-gradient(90deg, rgba(25,106,69,0.55) ${fill}%, rgba(255,255,255,0.9) ${fill}%)`
                        }}
                      >
                        <span>{String(item.number).padStart(2, "0")}</span>
                        <small>{toPercent(item.probability)}</small>
                      </div>
                    );
                  })}
              </div>
            </article>
          </section>
        </>
      )}
    </main>
  );
}
