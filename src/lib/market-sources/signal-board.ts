/**
 * Signal Board: チームごとに各ソースのシグナルを横並びで比較する集計（純粋）。
 *
 * 並べる列:
 *  - Hyperliquid / Polymarket / Bookmaker の優勝確率（champion probability）
 *  - Human strength F average（Scout の方向スコアをチーム視点で平均）
 *  - Official Toto vote average（そのチームの試合での公式人気平均）
 *  - signal disagreement（ソース間の優勝確率のばらつき）
 *
 * 注意: 優勝市場は上流シグナル。個別試合の 1X2 とは別物として「比較して見る」ための板。
 */
import type { Match } from "@/lib/types";
import {
  canonicalTeamName,
  japaneseTeamName,
  normalizeTeamKey,
  teamNameMatches,
} from "@/lib/market-sources/team-names";
import type { MarketNode, MarketSource } from "@/lib/market-sources/types";

export type SignalBoardRow = {
  /** 表示名（可能なら日本語、無ければ正規英語名 or 素の表記）。 */
  team: string;
  teamCanonical: string | null;
  matchNos: number[];
  hyperliquidChampion: number | null;
  polymarketChampion: number | null;
  bookmakerChampion: number | null;
  /** Scout の F（地力/調子方向）をチーム視点で平均（正 = そのチーム有利）。 */
  humanStrengthF: number | null;
  /** 公式人気（そのチーム勝ちの投票シェア）の平均、0..1。 */
  officialVotePopularity: number | null;
  /** ソース間の優勝確率のばらつき（max - min）。2 ソース未満なら null。 */
  championProbSpread: number | null;
  /** 利用できた最良の優勝確率（並び替え用）。 */
  bestChampionProb: number | null;
  /** 優勝確率が取れたソース数。 */
  championSourceCount: number;
};

export type SignalBoard = {
  rows: SignalBoardRow[];
};

function averageDefined(values: Array<number | null | undefined>): number | null {
  const defined = values.filter(
    (value): value is number => typeof value === "number" && Number.isFinite(value),
  );
  if (defined.length === 0) {
    return null;
  }
  return defined.reduce((total, value) => total + value, 0) / defined.length;
}

function championProbForSource(
  teamName: string,
  source: MarketSource,
  nodes: readonly MarketNode[],
): number | null {
  const matching = nodes.filter(
    (node) =>
      node.source === source &&
      node.marketType === "outright_champion" &&
      node.outcomeLabel.trim().toUpperCase() !== "NO" &&
      node.probability !== null &&
      Number.isFinite(node.probability) &&
      node.team !== null &&
      teamNameMatches(node.team, teamName),
  );
  return averageDefined(matching.map((node) => node.probability));
}

/** 試合 + 市場ノードから Signal Board を組み立てる。 */
export function buildSignalBoard(input: {
  matches: readonly Match[];
  nodes: readonly MarketNode[];
}): SignalBoard {
  const { matches, nodes } = input;

  // チームを正規化キーで集約（表示名は日本語の試合表記を優先）。
  const teamKeys = new Map<string, { display: string; matchNos: Set<number> }>();
  const register = (name: string | null | undefined, matchNo: number) => {
    if (!name) {
      return;
    }
    const key = canonicalTeamName(name) ?? normalizeTeamKey(name);
    if (!key) {
      return;
    }
    const existing = teamKeys.get(key);
    if (existing) {
      existing.matchNos.add(matchNo);
    } else {
      teamKeys.set(key, { display: name, matchNos: new Set([matchNo]) });
    }
  };

  for (const match of matches) {
    register(match.homeTeam, match.matchNo);
    register(match.awayTeam, match.matchNo);
  }

  const rows: SignalBoardRow[] = [];
  for (const [, info] of teamKeys) {
    const teamName = info.display;
    const teamMatches = matches.filter(
      (match) =>
        teamNameMatches(match.homeTeam, teamName) ||
        teamNameMatches(match.awayTeam, teamName),
    );

    const humanStrengthF = averageDefined(
      teamMatches.map((match) => {
        if (match.consensusF === null) {
          return null;
        }
        // consensusF は正でホーム有利。チームがアウェイなら符号反転。
        return teamNameMatches(match.homeTeam, teamName)
          ? match.consensusF
          : -match.consensusF;
      }),
    );

    const officialVotePopularity = averageDefined(
      teamMatches.map((match) =>
        teamNameMatches(match.homeTeam, teamName)
          ? match.officialVote1
          : match.officialVote2,
      ),
    );

    const hyperliquidChampion = championProbForSource(teamName, "hyperliquid", nodes);
    const polymarketChampion = championProbForSource(teamName, "polymarket", nodes);
    const bookmakerChampion = championProbForSource(teamName, "bookmaker", nodes);

    const championValues = [hyperliquidChampion, polymarketChampion, bookmakerChampion].filter(
      (value): value is number => value !== null,
    );
    const championProbSpread =
      championValues.length >= 2
        ? Math.max(...championValues) - Math.min(...championValues)
        : null;
    const bestChampionProb =
      championValues.length > 0 ? Math.max(...championValues) : null;

    rows.push({
      team: japaneseTeamName(teamName) ?? canonicalTeamName(teamName) ?? teamName,
      teamCanonical: canonicalTeamName(teamName),
      matchNos: Array.from(info.matchNos).sort((a, b) => a - b),
      hyperliquidChampion,
      polymarketChampion,
      bookmakerChampion,
      humanStrengthF,
      officialVotePopularity,
      championProbSpread,
      bestChampionProb,
      championSourceCount: championValues.length,
    });
  }

  // 優勝確率が取れたチームを上に、その中で確率の高い順。
  rows.sort((left, right) => {
    const leftProb = left.bestChampionProb ?? -1;
    const rightProb = right.bestChampionProb ?? -1;
    if (leftProb !== rightProb) {
      return rightProb - leftProb;
    }
    return (right.humanStrengthF ?? 0) - (left.humanStrengthF ?? 0);
  });

  return { rows };
}
