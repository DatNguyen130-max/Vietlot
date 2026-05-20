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

interface NextDrawInfo {
  nextDrawDate: string;
  weekdayVi: string;
  scheduleDescriptionVi: string;
  vietnamToday: string;
  firstAfterLatest: string | null;
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
  nextDraw?: NextDrawInfo;
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
  top: 5,
  recentWindow: 60
};

type SyncSource = "github" | "local";

const GAME_OPTIONS: Array<{ value: GameType; label: string }> = [
  { value: "power655", label: "Power 6/55" },
  { value: "power645", label: "Mega 6/45" }
];

interface SubmitState {
  ok: boolean;
  text: string;
}

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

function getGameNumberMax(game: GameType): number {
  return game === "power655" ? 55 : 45;
}

function parseManualNumbers(input: string): number[] {
  if (!input.trim()) {
    return [];
  }

  return input
    .split(/[\s,;|]+/)
    .map((item) => item.trim())
    .filter(Boolean)
    .map((item) => Number(item));
}

export default function HomePage() {
  const [query, setQuery] = useState<QueryParams>(DEFAULT_QUERY);
  const [data, setData] = useState<PredictionPayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [syncSource, setSyncSource] = useState<SyncSource>("github");
  const [apiToken, setApiToken] = useState("");
  const [resultsTab, setResultsTab] = useState<"combos" | "heatmap">("combos");
  const [manualDrawId, setManualDrawId] = useState("");
  const [manualDrawDate, setManualDrawDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [manualNumbers, setManualNumbers] = useState("");
  const [manualBonus, setManualBonus] = useState("");
  const [manualJackpot2Value, setManualJackpot2Value] = useState("");
  const [manualSubmitting, setManualSubmitting] = useState(false);
  const [manualState, setManualState] = useState<SubmitState | null>(null);
  const latestDrawId = data?.latestDraw?.drawId;

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
      const response = await fetch(`${buildPredictUrl(query)}&_ts=${Date.now()}`, {
        method: "GET",
        cache: "no-store",
        headers: {
          "Cache-Control": "no-cache",
          Pragma: "no-cache"
        }
      });
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

  useEffect(() => {
    if (latestDrawId === undefined) {
      return;
    }

    setManualDrawId(String(latestDrawId + 1));
  }, [latestDrawId]);

  useEffect(() => {
    setManualState(null);
    if (query.game === "power645") {
      setManualBonus("");
      setManualJackpot2Value("");
    }
  }, [query.game]);

  const onSync = async () => {
    setSyncing(true);
    setError(null);

    try {
      let token = apiToken.trim();
      if (!token) {
        token = window.prompt("Nếu bạn đã bật SYNC_TOKEN, nhập token ở đây (có thể để trống)")?.trim() ?? "";
        if (token) {
          setApiToken(token);
        }
      }

      const search = new URLSearchParams({
        game: query.game,
        source: syncSource
      });
      if (token) {
        search.set("token", token);
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

  const onSubmitManual = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setManualSubmitting(true);
    setManualState(null);

    try {
      const drawId = Number(manualDrawId);
      if (!Number.isInteger(drawId) || drawId <= 0) {
        throw new Error("Draw ID phải là số nguyên dương.");
      }

      if (!/^\d{4}-\d{2}-\d{2}$/.test(manualDrawDate)) {
        throw new Error("Ngày quay phải theo định dạng YYYY-MM-DD.");
      }

      const numbers = parseManualNumbers(manualNumbers);
      const numberMax = getGameNumberMax(query.game);
      if (numbers.length !== 6) {
        throw new Error("Dãy số phải có đúng 6 số.");
      }
      if (!numbers.every((value) => Number.isInteger(value) && value >= 1 && value <= numberMax)) {
        throw new Error(`Các số phải nằm trong khoảng 1..${numberMax}.`);
      }
      if (new Set(numbers).size !== 6) {
        throw new Error("Dãy số không được trùng.");
      }

      let bonus: number | null = null;
      if (query.game === "power655" && manualBonus.trim()) {
        const parsedBonus = Number(manualBonus);
        if (!Number.isInteger(parsedBonus) || parsedBonus < 1 || parsedBonus > numberMax) {
          throw new Error(`Số Jackpot 2 phải nằm trong khoảng 1..${numberMax}.`);
        }
        bonus = parsedBonus;
      }

      let jackpot2Value: number | null = null;
      if (query.game === "power655" && manualJackpot2Value.trim()) {
        const parsedAmount = Number(manualJackpot2Value);
        if (!Number.isInteger(parsedAmount) || parsedAmount < 0) {
          throw new Error("Giá trị Jackpot 2 phải là số nguyên không âm.");
        }
        jackpot2Value = parsedAmount;
      }

      let token = apiToken.trim();
      if (!token) {
        token = window.prompt("Nhập token SYNC_TOKEN để ghi dữ liệu (nếu đã bật)")?.trim() ?? "";
        if (token) {
          setApiToken(token);
        }
      }

      const search = token ? `?token=${encodeURIComponent(token)}` : "";
      const response = await fetch(`/api/manual${search}`, {
        method: "POST",
        cache: "no-store",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          game: query.game,
          drawId,
          drawDate: manualDrawDate,
          numbers,
          bonus,
          jackpot2Value
        })
      });

      const payload = (await response.json()) as { error?: string };
      if (!response.ok) {
        throw new Error(payload.error ?? "Không lưu được kỳ quay mới.");
      }

      setManualState({
        ok: true,
        text: `Đã lưu kỳ quay #${String(drawId).padStart(5, "0")} thành công.`
      });
      setManualNumbers("");
      setManualBonus("");
      setManualJackpot2Value("");
      await loadPrediction();
    } catch (submitError) {
      setManualState({
        ok: false,
        text: submitError instanceof Error ? submitError.message : "Không lưu được kỳ quay mới."
      });
    } finally {
      setManualSubmitting(false);
    }
  };

  return (
    <main className={styles.wrapper}>
      <header className={styles.topBar}>
        <div className={styles.brand}>
          <p className={styles.kicker}>Vietlot · analytics</p>
          <h1 className={styles.brandTitle}>
            <span>{query.game === "power655" ? "6/55" : "6/45"}</span> · kỳ tới
          </h1>
          <p className={styles.subtitle}>
            Thống kê lịch sử + Monte Carlo — tham khảo kỹ thuật, không phải cam kết quay thưởng. Đồng bộ GitHub → Supabase để cập nhật sau mỗi kỳ.
          </p>
        </div>
      </header>

      <section className={styles.headerCard}>
        <div className={styles.quickRow}>
          <div className={styles.quickField}>
            <label htmlFor="game-select">Loại vé</label>
            <select
              id="game-select"
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
          </div>

          <div className={styles.quickField}>
            <label htmlFor="sync-src">Nguồn sync</label>
            <select
              id="sync-src"
              value={syncSource}
              onChange={(event) => setSyncSource(event.target.value as SyncSource)}
              title="GitHub: JSONL raw. Local: thư mục data/ trong deploy."
            >
              <option value="github">GitHub (raw JSONL)</option>
              <option value="local">Local / data/</option>
            </select>
          </div>

          <div className={styles.actions}>
            <button type="button" className={styles.primaryBtn} onClick={() => void loadPrediction()} disabled={loading}>
              {loading ? "Đang tính…" : "Tính xác suất"}
            </button>
            <button type="button" className={styles.secondaryBtn} onClick={onSync} disabled={syncing}>
              {syncing ? "Đang sync…" : "Đồng bộ Supabase"}
            </button>
          </div>
        </div>

        <details className={styles.advanced}>
          <summary>Tham số mô hình · token · nhập tay kỳ quay</summary>
          <div className={styles.advancedBody}>
            <div className={styles.formGrid}>
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
            </div>

            <div className={styles.tokenField}>
              <label htmlFor="sync-token">SYNC_TOKEN (tuỳ chọn)</label>
              <input
                id="sync-token"
                type="password"
                value={apiToken}
                onChange={(event) => setApiToken(event.target.value)}
                placeholder="Điền nếu Vercel đã bật bảo vệ API"
                autoComplete="off"
              />
            </div>

            <div className={styles.manualBlock}>
              <h3>Nhập tay một kỳ (sửa lỗi nhanh)</h3>
              <p className={styles.manualHint}>
                Luồng chính: crawl JSONL trên GitHub → nút Đồng bộ. Chỉ dùng form này khi cần vá dữ liệu.
              </p>
              <form className={styles.manualForm} onSubmit={onSubmitManual}>
                <label>
                  Draw ID
                  <input
                    type="number"
                    min={1}
                    value={manualDrawId}
                    onChange={(event) => setManualDrawId(event.target.value)}
                    required
                  />
                </label>
                <label>
                  Ngày quay
                  <input type="date" value={manualDrawDate} onChange={(event) => setManualDrawDate(event.target.value)} required />
                </label>
                <label className={styles.manualFullRow}>
                  Dãy 6 số
                  <input
                    type="text"
                    value={manualNumbers}
                    onChange={(event) => setManualNumbers(event.target.value)}
                    placeholder={query.game === "power655" ? "1,5,12,22,33,44" : "2,8,19,21,34,45"}
                    required
                  />
                </label>
                <label>
                  J2 (6/55)
                  <input
                    type="number"
                    min={1}
                    max={55}
                    value={manualBonus}
                    onChange={(event) => setManualBonus(event.target.value)}
                    placeholder="Tuỳ chọn"
                    disabled={query.game === "power645"}
                  />
                </label>
                <label>
                  Giá trị J2 VND
                  <input
                    type="number"
                    min={0}
                    value={manualJackpot2Value}
                    onChange={(event) => setManualJackpot2Value(event.target.value)}
                    placeholder="Tuỳ chọn"
                    disabled={query.game === "power645"}
                  />
                </label>
                <div className={styles.manualActions}>
                  <button type="submit" disabled={manualSubmitting}>
                    {manualSubmitting ? "Đang lưu…" : "Lưu kỳ quay"}
                  </button>
                </div>
              </form>
              {manualState && <p className={manualState.ok ? styles.success : styles.error}>{manualState.text}</p>}
            </div>
          </div>
        </details>

        {error && <p className={styles.error}>{error}</p>}
      </section>

      {data && (
        <>
          <section className={styles.metrics}>
            <article>
              <span>Kỳ quay tiếp theo</span>
              {data.nextDraw ? (
                <strong>
                  {formatDrawDate(data.nextDraw.nextDrawDate)} · {data.nextDraw.weekdayVi}
                  <br />
                  <span style={{ fontWeight: 500, color: "var(--muted)", fontSize: "0.8rem" }}>{data.nextDraw.scheduleDescriptionVi}</span>
                </strong>
              ) : (
                <strong>—</strong>
              )}
            </article>
            <article>
              <span>Kỳ mới nhất · {data.gameLabel}</span>
              {data.latestDraw ? (
                <strong>
                  #{String(data.latestDraw.drawId).padStart(5, "0")} · {formatDrawDate(data.latestDraw.drawDate)}
                </strong>
              ) : (
                <strong>—</strong>
              )}
            </article>
            <article>
              <span>Cửa sổ dữ liệu</span>
              <strong>{data.drawsUsed.toLocaleString("vi-VN")} kỳ</strong>
            </article>
            <article>
              <span>Mô phỏng MC</span>
              <strong>{data.simulations.toLocaleString("vi-VN")}</strong>
            </article>
          </section>

          <section className={styles.recommended}>
            <h2>Gợi ý 6 số · xác suất biên cao nhất</h2>
            <div className={styles.ballRow}>
              {data.recommendedNumbers.map((value) => (
                <span key={value} className={styles.ball}>
                  {String(value).padStart(2, "0")}
                </span>
              ))}
            </div>
            <p className={styles.timestamp}>
              {new Date(data.generatedAt).toLocaleString("vi-VN", { hour12: false })} · UTC {data.generatedAt.slice(11, 19)}
            </p>
          </section>

          <section className={styles.resultsCard}>
            <div className={styles.tabs}>
              <button
                type="button"
                className={resultsTab === "combos" ? styles.tabActive : ""}
                onClick={() => setResultsTab("combos")}
              >
                Top {query.top} tổ hợp
              </button>
              <button
                type="button"
                className={resultsTab === "heatmap" ? styles.tabActive : ""}
                onClick={() => setResultsTab("heatmap")}
              >
                Heatmap 1–{data.numberMax}
              </button>
            </div>

            {resultsTab === "combos" ? (
              <>
                <p className={styles.panelTitle}>Monte Carlo · tần suất xuất hiện tổ hợp</p>
                <div className={styles.comboList}>
                  {data.topCombinations.map((combo, index) => (
                    <div key={combo.numbers.join("-")} className={styles.comboItem}>
                      <div>
                        <span className={styles.rank}>#{index + 1}</span>
                        <strong>{combo.numbers.map((value) => String(value).padStart(2, "0")).join(" · ")}</strong>
                      </div>
                      <div className={styles.comboMeta}>
                        <span>{toPercent(combo.probability)}</span>
                        <span>{combo.estimatedOdds}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <>
                <p className={styles.panelTitle}>Xác suất mô phỏng theo từng số</p>
                <div className={styles.heatmap}>
                  {data.numberProbabilities
                    .slice()
                    .sort((a, b) => a.number - b.number)
                    .map((item) => {
                      const ratio = maxProbability > 0 ? item.probability / maxProbability : 0;
                      const fill = Math.max(8, Math.round(ratio * 100));

                      return (
                        <div
                          key={item.number}
                          className={styles.heatCell}
                          style={{
                            borderColor: `rgba(52, 211, 153, ${0.12 + ratio * 0.35})`,
                            background: `linear-gradient(135deg, rgba(52,211,153,${0.05 + ratio * 0.12}) ${fill}%, rgba(0,0,0,0.15) ${fill}%)`
                          }}
                        >
                          <span>{String(item.number).padStart(2, "0")}</span>
                          <small>{toPercent(item.probability)}</small>
                        </div>
                      );
                    })}
                </div>
              </>
            )}
          </section>
        </>
      )}
    </main>
  );
}
