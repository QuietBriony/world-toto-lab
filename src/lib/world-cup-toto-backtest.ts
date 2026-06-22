import {
  TOTO13_STAKE_YEN,
  missCount,
  signatureFromOutcomes,
  type TotoRoundReviewMatch,
  worldCupToto1634Matches,
  worldCupToto1634Review,
  worldCupToto1635Matches,
  worldCupToto1635Review,
} from "@/lib/world-cup-toto-review-plan";
import type { OutcomeValue } from "@/lib/domain";

type PrizeLabel = "1st" | "2nd" | "3rd" | "miss";

type PayoutByTier = {
  first: number;
  second: number;
  third: number;
};

export type WorldCupTotoInstructionStatus = "implemented" | "partial" | "next";

export type WorldCupTotoInstructionRow = {
  id: string;
  implementationStatus: WorldCupTotoInstructionStatus;
  label: string;
  operatingRule: string;
  source: string;
  userNeed: string;
};

export type WorldCupTotoBacktestTicket = {
  label: string;
  rank: number;
  signature: string;
  source: string;
  unitCount: number;
};

export type WorldCupTotoBacktestPortfolio = {
  id: string;
  label: string;
  tickets: WorldCupTotoBacktestTicket[];
};

export type WorldCupTotoBacktestHit = {
  label: string;
  misses: number;
  payoutYen: number;
  prizeLabel: PrizeLabel;
  rank: number;
  signature: string;
  unitCount: number;
};

export type WorldCupTotoBacktestPortfolioResult = {
  actualReturnYen: number;
  bestMisses: number;
  cashHitCount: number;
  costYen: number;
  hitRows: WorldCupTotoBacktestHit[];
  id: string;
  label: string;
  netProfitYen: number;
  realizedMultiple: number;
  ticketCount: number;
  unitCount: number;
};

export type WorldCupTotoBacktestRound = {
  actualSignature: string;
  label: string;
  portfolios: WorldCupTotoBacktestPortfolioResult[];
  publicFavoriteMisses: number;
  publicFavoriteSignature: string;
  roundNumber: number;
};

export type WorldCupTotoUniverseStrategyKind = "phase_aware" | "public_favorite";

export type WorldCupTotoUniverseBacktestRow = {
  actualIncluded: boolean;
  bestMisses: number;
  fullCoverageCostYen: number;
  label: string;
  phaseLabel: string;
  policySummary: string;
  roundNumber: number;
  strategyKind: WorldCupTotoUniverseStrategyKind;
  universeLineCount: number;
};

export const worldCupTotoInstructionSystem = [
  {
    id: "plain_answer_first",
    implementationStatus: "implemented",
    label: "知りたい答えを先に出す",
    operatingRule: "1口100円、何口買うか、当たったら何円戻るか、1万円で期待回収が上回るかを先に表示する。",
    source: "ユーザー要望: ちんぷんかんぷんを避けたい",
    userNeed: "専門用語より、買う金額と戻りを見たい。",
  },
  {
    id: "deadline_snapshot",
    implementationStatus: "implemented",
    label: "締切直前データを優先",
    operatingRule: "公式投票率と売上は締切直前ほど信頼し、買うなら締切30分前に再取得してCSV/PDFを差し替える。",
    source: "ユーザー要望: 買えるギリギリが期待値計算精度高い",
    userNeed: "古い票率で買い目を決めない。",
  },
  {
    id: "model_public_split",
    implementationStatus: "implemented",
    label: "p_model と p_public を分ける",
    operatingRule: "当たりやすさはモデル側、払戻の薄さは公式投票側として分け、同じ出目に人が多いほど払戻が薄くなる前提でEVを見る。",
    source: "ユーザー/Hazi要望: totoはみんなとズラすゲーム",
    userNeed: "当てに行くだけでなく、人気過剰を避けたい。",
  },
  {
    id: "world_cup_context",
    implementationStatus: "implemented",
    label: "W杯補正",
    operatingRule: "中立地、国名人気、グループ状況、引き分けOK、主力温存を試合別に持ち、proxy確率と買い目ランキングに反映する。",
    source: "Haziコメントとユーザー確認",
    userNeed: "第1戦/第2戦/第3戦の荒れ方をロジックに入れたい。",
  },
  {
    id: "tier_ev",
    implementationStatus: "implemented",
    label: "1等だけでなく2/3等EVも見る",
    operatingRule: "toto13は1等/2等/3等の推定払戻を合算し、2等カバー率も見る。Hot10の2口化は戻りを厚くするだけで、範囲は広げない。",
    source: "ユーザー要望: 2,3位も金もらえるんだっけ",
    userNeed: "1等が外れても、2/3等込みで現実的な戻りを見たい。",
  },
  {
    id: "backtest_loop",
    implementationStatus: "partial",
    label: "過去回バックテスト",
    operatingRule: "確定結果がある回は、公開人気順、過去PDF候補、現在ロジック候補を同じ評価関数で比較する。",
    source: "今回のGoal",
    userNeed: "ロジックを磨いたら過去回で即検証したい。",
  },
  {
    id: "hazi_distillation",
    implementationStatus: "next",
    label: "Hazi感想戦の蒸留",
    operatingRule: "ボイスメモを、試合タグ、外した理由、次回補正、信頼度に分解して次回の重みに入れる。",
    source: "ユーザー要望: ボイスメモ抽出元として",
    userNeed: "友人の肌感を、あとから学習可能な形で残したい。",
  },
] satisfies WorldCupTotoInstructionRow[];

export const worldCupTotoOperatingSystemStatus = {
  cleanScoreLabel: "土台は整理済み、最適化はこれから",
  implementedCount: worldCupTotoInstructionSystem.filter((row) => row.implementationStatus === "implemented").length,
  nextCount: worldCupTotoInstructionSystem.filter((row) => row.implementationStatus !== "implemented").length,
  summary:
    "UI、PDF/CSV、公式投票、W杯補正、2/3等EVはつながった。次の大きな改善は、過去回を同じ評価関数で回して重みを更新すること。",
};

function signatureFromReviewMatches(matches: readonly TotoRoundReviewMatch[]) {
  return signatureFromOutcomes(matches.map((match) => match.actual));
}

function publicFavoriteSignature(matches: readonly TotoRoundReviewMatch[]) {
  return signatureFromOutcomes(
    matches.map((match) => {
      return (["1", "0", "2"] as const)
        .map((outcome) => ({ outcome, share: match.votes[outcome] }))
        .sort((left, right) => right.share - left.share)[0].outcome;
    }),
  );
}

const OUTCOME_ORDER: OutcomeValue[] = ["1", "0", "2"];

function sortedOutcomesByShare(match: TotoRoundReviewMatch) {
  return OUTCOME_ORDER.map((outcome) => ({ outcome, share: match.votes[outcome] })).sort(
    (left, right) => right.share - left.share,
  );
}

function favoriteOutcome(match: TotoRoundReviewMatch) {
  return sortedOutcomesByShare(match)[0].outcome;
}

function uniqueOutcomes(outcomes: Iterable<OutcomeValue>) {
  const outcomeSet = new Set(outcomes);

  return OUTCOME_ORDER.filter((outcome) => outcomeSet.has(outcome));
}

function allowedOutcomesForUniverseStrategy(
  match: TotoRoundReviewMatch,
  strategyKind: WorldCupTotoUniverseStrategyKind,
  phase: "matchday1" | "matchday2",
) {
  if (strategyKind === "public_favorite") {
    return [favoriteOutcome(match)];
  }

  const sorted = sortedOutcomesByShare(match);
  const favorite = sorted[0];
  const middle = sorted[1];
  const least = sorted[2];
  const allowed = new Set<OutcomeValue>([favorite.outcome]);
  const drawShare = match.votes["0"];
  const topBottomGap = favorite.share - least.share;
  const topSecondGap = favorite.share - middle.share;

  if (phase === "matchday1") {
    if (favorite.share >= 0.65 || drawShare >= 0.1) {
      allowed.add("0");
    }

    if (topBottomGap <= 0.18 || (drawShare >= 0.25 && least.share >= 0.15)) {
      OUTCOME_ORDER.forEach((outcome) => allowed.add(outcome));
    }

    if (favorite.share >= 0.9) {
      allowed.add("0");
    }

    if (topSecondGap <= 0.08) {
      allowed.add(middle.outcome);
    }
  } else {
    if (drawShare >= 0.18 && favorite.share < 0.8) {
      allowed.add("0");
    }

    if (favorite.share >= 0.85 && drawShare >= 0.08) {
      allowed.add("0");
    }

    if (topBottomGap <= 0.16) {
      OUTCOME_ORDER.forEach((outcome) => allowed.add(outcome));
    }

    if (favorite.share < 0.55 && middle.share >= 0.25) {
      allowed.add(middle.outcome);
    }
  }

  return uniqueOutcomes(allowed);
}

function universeStrategyLabel(strategyKind: WorldCupTotoUniverseStrategyKind) {
  if (strategyKind === "public_favorite") return "公開人気1点";

  return "W杯フェーズ補正候補";
}

function universePolicySummary(
  strategyKind: WorldCupTotoUniverseStrategyKind,
  phase: "matchday1" | "matchday2",
) {
  if (strategyKind === "public_favorite") {
    return "各試合で公式投票の最多出目だけを採用。安いが荒れには弱い。";
  }

  if (phase === "matchday1") {
    return "初戦は荒れ・引き分けを厚めに見て、強人気ドローと30%台の散りを候補に残す。";
  }

  return "第2戦は順当寄りを軸にしつつ、引き分け票が残る強人気・中位人気戦を候補に残す。";
}

function buildUniverseBacktestRow(input: {
  label: string;
  matches: readonly TotoRoundReviewMatch[];
  phase: "matchday1" | "matchday2";
  phaseLabel: string;
  roundNumber: number;
  strategyKind: WorldCupTotoUniverseStrategyKind;
}): WorldCupTotoUniverseBacktestRow {
  const allowedByMatch = input.matches.map((match) =>
    allowedOutcomesForUniverseStrategy(match, input.strategyKind, input.phase),
  );
  const bestMisses = input.matches.filter((match, index) => !allowedByMatch[index].includes(match.actual)).length;
  const universeLineCount = allowedByMatch.reduce((product, allowed) => product * allowed.length, 1);

  return {
    actualIncluded: bestMisses === 0,
    bestMisses,
    fullCoverageCostYen: universeLineCount * TOTO13_STAKE_YEN,
    label: input.label,
    phaseLabel: input.phaseLabel,
    policySummary: universePolicySummary(input.strategyKind, input.phase),
    roundNumber: input.roundNumber,
    strategyKind: input.strategyKind,
    universeLineCount,
  };
}

function prizeLabelFromMisses(misses: number): PrizeLabel {
  if (misses === 0) return "1st";
  if (misses === 1) return "2nd";
  if (misses === 2) return "3rd";
  return "miss";
}

function payoutForPrize(label: PrizeLabel, payoutByTier: PayoutByTier) {
  if (label === "1st") return payoutByTier.first;
  if (label === "2nd") return payoutByTier.second;
  if (label === "3rd") return payoutByTier.third;
  return 0;
}

function evaluatePortfolio(input: {
  actualSignature: string;
  payoutByTier: PayoutByTier;
  portfolio: WorldCupTotoBacktestPortfolio;
}): WorldCupTotoBacktestPortfolioResult {
  const hitRows = input.portfolio.tickets.map((ticket) => {
    const misses = missCount(input.actualSignature, ticket.signature);
    const prizeLabel = prizeLabelFromMisses(misses);
    const payoutYen = payoutForPrize(prizeLabel, input.payoutByTier);

    return {
      label: ticket.label,
      misses,
      payoutYen,
      prizeLabel,
      rank: ticket.rank,
      signature: ticket.signature,
      unitCount: ticket.unitCount,
    } satisfies WorldCupTotoBacktestHit;
  });
  const unitCount = input.portfolio.tickets.reduce((sum, ticket) => sum + ticket.unitCount, 0);
  const costYen = unitCount * TOTO13_STAKE_YEN;
  const actualReturnYen = hitRows.reduce((sum, row) => sum + row.payoutYen * row.unitCount, 0);

  return {
    actualReturnYen,
    bestMisses: Math.min(...hitRows.map((row) => row.misses)),
    cashHitCount: hitRows.filter((row) => row.payoutYen > 0).length,
    costYen,
    hitRows,
    id: input.portfolio.id,
    label: input.portfolio.label,
    netProfitYen: actualReturnYen - costYen,
    realizedMultiple: costYen > 0 ? actualReturnYen / costYen : 0,
    ticketCount: input.portfolio.tickets.length,
    unitCount,
  };
}

function buildBacktestRound(input: {
  matches: readonly TotoRoundReviewMatch[];
  payoutByTier: PayoutByTier;
  portfolios: WorldCupTotoBacktestPortfolio[];
  roundNumber: number;
}): WorldCupTotoBacktestRound {
  const actualSignature = signatureFromReviewMatches(input.matches);
  const favoriteSignature = publicFavoriteSignature(input.matches);

  return {
    actualSignature,
    label: `第${input.roundNumber}回`,
    portfolios: input.portfolios.map((portfolio) =>
      evaluatePortfolio({
        actualSignature,
        payoutByTier: input.payoutByTier,
        portfolio,
      }),
    ),
    publicFavoriteMisses: missCount(actualSignature, favoriteSignature),
    publicFavoriteSignature: favoriteSignature,
    roundNumber: input.roundNumber,
  };
}

const publicFavoritePortfolio = (
  roundNumber: number,
  signature: string,
): WorldCupTotoBacktestPortfolio => ({
  id: `round-${roundNumber}-public-favorite`,
  label: "公式人気順 1口",
  tickets: [
    {
      label: "公式人気順",
      rank: 1,
      signature,
      source: "official_vote_favorite",
      unitCount: 1,
    },
  ],
});

export const worldCupTotoBacktestRounds = [
  buildBacktestRound({
    matches: worldCupToto1634Matches,
    payoutByTier: worldCupToto1634Review.payoutByTier,
    portfolios: [
      publicFavoritePortfolio(1634, worldCupToto1634Review.publicFavoriteSignature),
      {
        id: "round-1634-previous-positive-ev",
        label: "前PDF positive EV候補 9本",
        tickets: worldCupToto1634Review.previousReportTopRows.map((row) => ({
          label: `前PDF #${row.rank}`,
          rank: row.rank,
          signature: row.signature,
          source: "previous_pdf_positive_ev",
          unitCount: 1,
        })),
      },
    ],
    roundNumber: 1634,
  }),
  buildBacktestRound({
    matches: worldCupToto1635Matches,
    payoutByTier: worldCupToto1635Review.payoutByTier,
    portfolios: [publicFavoritePortfolio(1635, worldCupToto1635Review.publicFavoriteSignature)],
    roundNumber: 1635,
  }),
];

export const worldCupTotoUniverseBacktestRows = [
  buildUniverseBacktestRow({
    label: universeStrategyLabel("public_favorite"),
    matches: worldCupToto1634Matches,
    phase: "matchday1",
    phaseLabel: "初戦",
    roundNumber: 1634,
    strategyKind: "public_favorite",
  }),
  buildUniverseBacktestRow({
    label: universeStrategyLabel("phase_aware"),
    matches: worldCupToto1634Matches,
    phase: "matchday1",
    phaseLabel: "初戦",
    roundNumber: 1634,
    strategyKind: "phase_aware",
  }),
  buildUniverseBacktestRow({
    label: universeStrategyLabel("public_favorite"),
    matches: worldCupToto1635Matches,
    phase: "matchday2",
    phaseLabel: "第2戦",
    roundNumber: 1635,
    strategyKind: "public_favorite",
  }),
  buildUniverseBacktestRow({
    label: universeStrategyLabel("phase_aware"),
    matches: worldCupToto1635Matches,
    phase: "matchday2",
    phaseLabel: "第2戦",
    roundNumber: 1635,
    strategyKind: "phase_aware",
  }),
] satisfies WorldCupTotoUniverseBacktestRow[];

export const worldCupTotoOptimizationReadiness = {
  candidateUniverseRows: worldCupTotoUniverseBacktestRows.length,
  statusLabel: "候補宇宙は検証可能、ランキング最適化は次",
  summary:
    "1634/1635では、公開人気1点だけでなく、W杯フェーズ補正で広げた候補集合が実結果を含んでいたかを確認できる状態になった。次は候補全部を買うのではなく、予算内で順位付けして2等/3等カバーを最大化する。",
};

export const worldCupTotoBacktestSummary = {
  knownResultRoundCount: worldCupTotoBacktestRounds.length,
  lessons: [
    "1634は公開人気順が9試合ズレ。強豪ドローと低人気ドローを拾えず、W杯第1戦の荒れ方を過小評価した。",
    "1635は公開人気順が2試合ズレで3等相当。第2戦寄りは順当が増えやすい、というHaziコメントと整合する。",
    "最適化は、的中率だけでなく、公開票とズラした時の払戻、2/3等カバー、予算内の面の広さを同時に評価する必要がある。",
  ],
  nextOptimizationSteps: [
    "各回の確定結果が入ったら、公開人気順、当時PDF候補、現行ロジック再現候補を同じ関数で評価する。",
    "試合ごとに、国名人気、引き分けOK、主力温存、グループ状況、30%台分散が当たり/外れに効いたかをタグ付けする。",
    "十分な回数が貯まったら、タグ別の重みを固定値からバックテスト由来の重みに更新する。",
  ],
};
