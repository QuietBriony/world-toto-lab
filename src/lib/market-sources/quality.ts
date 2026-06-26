/**
 * Market Node のデータ品質警告（純粋）。
 *
 * spec の要求警告:
 *  - mapping なし
 *  - liquidity 不明
 *  - spread 広い
 *  - API 取得失敗
 *  - manual price
 *  - old price
 *  - source market is upstream only
 */
import type {
  MarketNode,
  TraderMarketSignal,
  TraderSignal,
} from "@/lib/market-sources/types";

export type MarketWarningCode =
  | "mapping_missing"
  | "liquidity_unknown"
  | "spread_wide"
  | "api_error"
  | "manual_price"
  | "no_price"
  | "old_price"
  | "upstream_only";

export type MarketNodeWarning = {
  code: MarketWarningCode;
  message: string;
  tone: "amber" | "slate";
};

export type MarketWarningOptions = {
  /** 判定の基準時刻（ISO）。テスト用に注入可能。 */
  now?: string;
  /** これより古い価格を old price とみなす時間（既定 12h）。 */
  oldPriceHours?: number;
  /** これより広い spread を wide とみなす（0..1 の確率価格想定、既定 0.08）。 */
  wideSpread?: number;
};

export type TraderSignalWarningCode =
  | "sample_size_low"
  | "concentration_high"
  | "no_recent_activity"
  | "stale_activity"
  | "inferred_identity";

export type TraderSignalWarning = {
  code: TraderSignalWarningCode;
  message: string;
  tone: "amber" | "slate";
};

function ageHours(lastFetchedAt: string, now: string): number | null {
  const fetched = Date.parse(lastFetchedAt);
  const current = Date.parse(now);
  if (Number.isNaN(fetched) || Number.isNaN(current)) {
    return null;
  }
  return (current - fetched) / (1000 * 60 * 60);
}

/** Market Node の警告一覧を返す。 */
export function marketNodeWarnings(
  node: MarketNode,
  options: MarketWarningOptions = {},
): MarketNodeWarning[] {
  const warnings: MarketNodeWarning[] = [];
  const oldPriceHours = options.oldPriceHours ?? 12;
  const wideSpread = options.wideSpread ?? 0.08;
  const now = options.now ?? new Date().toISOString();

  if (node.signalLayer === "upstream_team_prior") {
    warnings.push({
      code: "upstream_only",
      tone: "slate",
      message:
        "この市場は上流シグナル（優勝市場）です。個別試合の90分1/0/2を直接決めるものではありません。",
    });
  }

  if (node.source === "hyperliquid" && !node.externalSymbol) {
    warnings.push({
      code: "mapping_missing",
      tone: "amber",
      message:
        "API 用の symbol mapping がありません。価格は手入力で扱われます（API取得不可）。",
    });
  }

  const hasAnyPrice =
    node.probability !== null ||
    node.mid !== null ||
    node.bid !== null ||
    node.ask !== null;
  if (!hasAnyPrice) {
    warnings.push({
      code: "no_price",
      tone: "amber",
      message: "価格が未取得です。手入力するか、API取得を試してください。",
    });
  }

  if (node.priceSource === "manual") {
    warnings.push({
      code: "manual_price",
      tone: "slate",
      message: "価格は手入力です（自動取得値ではありません）。",
    });
  }

  if (node.liquidityScore === null) {
    warnings.push({
      code: "liquidity_unknown",
      tone: "slate",
      message: "流動性が不明です。価格の信頼度は限定的です。",
    });
  }

  if (node.spread !== null && node.spread > wideSpread) {
    warnings.push({
      code: "spread_wide",
      tone: "amber",
      message: `スプレッドが広め（${node.spread.toFixed(3)}）です。価格の不確実性が高い可能性があります。`,
    });
  }

  if (node.lastApiError) {
    warnings.push({
      code: "api_error",
      tone: "amber",
      message: `API取得に失敗しました: ${node.lastApiError}`,
    });
  }

  if (node.lastFetchedAt) {
    const age = ageHours(node.lastFetchedAt, now);
    if (age !== null && age > oldPriceHours) {
      warnings.push({
        code: "old_price",
        tone: "amber",
        message: `価格が古い可能性があります（最終取得から約${Math.round(age)}時間）。`,
      });
    }
  }

  return warnings;
}

export function traderSignalWarnings(
  signal: TraderSignal,
  marketSignals: readonly TraderMarketSignal[] = [],
  options: MarketWarningOptions = {},
): TraderSignalWarning[] {
  const warnings: TraderSignalWarning[] = [];
  const now = options.now ?? new Date().toISOString();
  const oldPriceHours = options.oldPriceHours ?? 24;
  const sampleSize = signal.predictionCount ?? marketSignals.length;

  if (sampleSize > 0 && sampleSize <= 3) {
    warnings.push({
      code: "sample_size_low",
      tone: "amber",
      message:
        "予測件数が少ないため、強アカウントとしては検証中です。大勝1回をそのまま買い目へコピーしません。",
    });
  }

  const totalAbsPnl = marketSignals.reduce(
    (total, marketSignal) => total + Math.abs(marketSignal.cashPnl ?? 0),
    0,
  );
  const maxAbsPnl = marketSignals.reduce(
    (max, marketSignal) => Math.max(max, Math.abs(marketSignal.cashPnl ?? 0)),
    0,
  );
  if (totalAbsPnl > 0 && maxAbsPnl / totalAbsPnl >= 0.8) {
    warnings.push({
      code: "concentration_high",
      tone: "amber",
      message:
        "損益が1市場に集中しています。市場全般に強い人というより、単発イベントの大口シグナルとして扱います。",
    });
  }

  if (!signal.lastActivityAt) {
    warnings.push({
      code: "no_recent_activity",
      tone: "slate",
      message: "直近アクティビティ時刻が未取得です。公開APIで更新してから判断します。",
    });
  } else {
    const age = ageHours(signal.lastActivityAt, now);
    if (age !== null && age > oldPriceHours) {
      warnings.push({
        code: "stale_activity",
        tone: "amber",
        message: `直近アクティビティから約${Math.round(age)}時間経過しています。締切前に再取得してください。`,
      });
    }
  }

  if (signal.dataConfidence !== "high") {
    warnings.push({
      code: "inferred_identity",
      tone: "slate",
      message:
        "候補リストまたは公開APIの照合による監視対象です。ウォレット本人確認ではありません。",
    });
  }

  return warnings;
}
