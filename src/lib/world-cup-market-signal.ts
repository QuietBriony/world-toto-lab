/**
 * featured W杯ラウンドへ「市場(Polymarket)シグナル」を供給するアクセサ。
 *
 * ドイツ戦の教訓（第1637回 M01 Ecuador vs Germany: 公衆はドイツ73.8%だが
 * Polymarket は64.3%）を operational にするための最小データ配線。featured ラウンド
 * 構築（featured-world-toto-d1）がこの map を使って `marketProb` 列を埋めると、
 * engine `calculateModelProbabilities` が市場を土台にし、Edge = 市場 − 公衆 で
 * 公衆過信の本命が自動で割り引かれる（engine / types は無改変）。
 *
 * 設計上の注意:
 * - 市場データの正本は Codex レーンの `world-cup-toto-review-plan.ts`。本ファイルは
 *   その **export 済み** 定数 `worldCupToto1637ExternalMarketOverlay` だけを読み、
 *   review-plan.ts を一切編集しない（並走 Codex との同一ファイル衝突を避けるため）。
 * - 各 overlay 行は `marketProb`(Polymarket) と `officialProb`(公衆票) の両方を
 *   matchNo 付きで持つので、ここから派生するだけで他シンボルへ依存しない。
 */
import {
  worldCupToto1637ExternalMarketOverlay,
  type Toto1637ExternalMarketOverlay,
} from "@/lib/world-cup-toto-review-plan";

export type WorldCupMarketSignal = {
  marketProb0: number;
  marketProb1: number;
  marketProb2: number;
  // 公衆票が overlay に無い回は null（呼び出し側が source の値に fall through できる）。
  officialVote0: number | null;
  officialVote1: number | null;
  officialVote2: number | null;
};

/**
 * 市場オーバーレイがある回のレジストリ。現状は第1637回のみ。
 * 新しい回の overlay（review-plan.ts への追記や将来の snapshot fetch）が増えたら
 * ここに 1 行足すだけでよい。
 */
const MARKET_SIGNAL_OVERLAY_BY_ROUND: Record<number, Toto1637ExternalMarketOverlay> = {
  1637: worldCupToto1637ExternalMarketOverlay,
};

function hasAnyShare(...values: number[]) {
  return values.some((value) => Number.isFinite(value) && value > 0);
}

/**
 * 指定回の matchNo → 市場(Polymarket) + 公衆(公式票) シグナル。
 * overlay が無い回は空 Map ＝従来どおり国別強度シードのまま（挙動不変）。
 */
export function worldCupMarketSignalByMatchNo(
  roundNumber: number,
): Map<number, WorldCupMarketSignal> {
  const map = new Map<number, WorldCupMarketSignal>();
  const overlay = MARKET_SIGNAL_OVERLAY_BY_ROUND[roundNumber];
  if (!overlay) {
    return map;
  }

  for (const row of overlay.comparisonRows) {
    // officialProb は plan match 不在時に {0,0,0} のフォールバックになり得る。
    // 全ゼロは「公衆票なし」なので市場確率だけ供給する（公式票は null のまま残す）。
    const officialAvailable = hasAnyShare(
      row.officialProb["1"],
      row.officialProb["0"],
      row.officialProb["2"],
    );

    map.set(row.matchNo, {
      marketProb1: row.marketProb["1"],
      marketProb0: row.marketProb["0"],
      marketProb2: row.marketProb["2"],
      officialVote1: officialAvailable ? row.officialProb["1"] : null,
      officialVote0: officialAvailable ? row.officialProb["0"] : null,
      officialVote2: officialAvailable ? row.officialProb["2"] : null,
    });
  }

  return map;
}
