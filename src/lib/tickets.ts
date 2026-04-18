import {
  aiRecommendedOutcomes,
  buildEdgeRows,
  type DrawPolicy,
  favoriteOutcomeForBucket,
  getEdge,
  getProbability,
  humanConsensusOutcomes,
  type MatchLike,
  type OutcomeValue,
  ticketModeLabel,
} from "@/lib/domain";
import type { TicketMode } from "@/lib/types";

export type GeneratorSettings = {
  budgetYen: number;
  humanWeight: number;
  maxContrarianMatches: number;
  includeDrawPolicy: DrawPolicy;
};

export type TicketSelection = {
  matchNo: number;
  fixture: string;
  outcome: OutcomeValue;
  modelProbability: number;
  officialVoteShare: number;
  edge: number;
  humanAligned: boolean;
  contrarian: boolean;
  reasons: string[];
};

export type TicketPayload = {
  mode: TicketMode;
  selections: TicketSelection[];
  ticketScore: number;
  estimatedHitProb: number;
  contrarianScore: number;
  comment: string;
};

type PartialTicket = {
  selections: TicketSelection[];
  partialScore: number;
  contrarianCount: number;
};

const MODE_WEIGHTS: Record<
  TicketMode,
  { alpha: number; beta: number; gamma: number; upsetPenalty: number; limit: number }
> = {
  conservative: { alpha: 0.5, beta: 0.2, gamma: 0.5, upsetPenalty: 0.8, limit: 2 },
  balanced: { alpha: 1, beta: 0.5, gamma: 0.8, upsetPenalty: 0.45, limit: 2 },
  upset: { alpha: 1.5, beta: 1, gamma: 1, upsetPenalty: 0.15, limit: 3 },
};

function scoreSelection(
  selection: TicketSelection,
  mode: TicketMode,
  humanWeight: number,
) {
  const weights = MODE_WEIGHTS[mode];
  return (
    Math.log(Math.max(selection.modelProbability, 0.05)) +
    weights.alpha * selection.edge +
    weights.beta * (1 - selection.officialVoteShare) +
    weights.gamma * (selection.humanAligned ? humanWeight : 0.12) -
    (selection.contrarian ? weights.upsetPenalty : 0)
  );
}

function buildSelection(match: MatchLike, outcome: OutcomeValue): TicketSelection {
  const modelProbability = Math.max(getProbability(match, "model", outcome) ?? 0.05, 0.05);
  const officialVoteShare = Math.max(
    getProbability(match, "official", outcome) ?? 0.05,
    0.05,
  );
  const edge = getEdge(match, outcome) ?? 0;
  const humanAligned = humanConsensusOutcomes(match).includes(outcome);
  const officialFavorite = favoriteOutcomeForBucket(match, "official");
  const contrarian = officialFavorite ? officialFavorite !== outcome : false;
  const reasons: string[] = [];

  if (aiRecommendedOutcomes(match).includes(outcome)) {
    reasons.push("AI候補");
  }

  if (humanAligned) {
    reasons.push("人力コンセンサス");
  }

  if (edge >= 0.08) {
    reasons.push("高エッジ");
  }

  if (outcome === "0" && (match.consensusD ?? 0) >= 1.5) {
    reasons.push("引き分け警戒");
  }

  if (
    officialVoteShare <= 0.25 &&
    ((getProbability(match, "model", outcome) ?? 0) >= 0.28 || humanAligned)
  ) {
    reasons.push("人気薄の分析候補");
  }

  return {
    matchNo: match.matchNo,
    fixture: `${match.homeTeam} vs ${match.awayTeam}`,
    outcome,
    modelProbability,
    officialVoteShare,
    edge,
    humanAligned,
    contrarian,
    reasons,
  };
}

function candidateSelectionsForMatch(
  match: MatchLike,
  settings: GeneratorSettings,
  mode: TicketMode,
) {
  const candidates = new Map<OutcomeValue, TicketSelection>();
  const topModelOutcome = favoriteOutcomeForBucket(match, "model");

  if (topModelOutcome) {
    candidates.set(topModelOutcome, buildSelection(match, topModelOutcome));
  }

  for (const edgeRow of buildEdgeRows([match])) {
    if (edgeRow.edge !== null && edgeRow.edge >= 0.08) {
      candidates.set(edgeRow.outcome, buildSelection(match, edgeRow.outcome));
    }
  }

  for (const humanOutcome of humanConsensusOutcomes(match)) {
    candidates.set(humanOutcome, buildSelection(match, humanOutcome));
  }

  const drawSelection = buildSelection(match, "0");
  if (
    settings.includeDrawPolicy === "high" ||
    (settings.includeDrawPolicy === "medium" &&
      ((match.consensusD ?? 0) >= 1.2 || drawSelection.edge >= 0.03))
  ) {
    candidates.set("0", drawSelection);
  }

  if (mode === "upset") {
    for (const outcome of ["1", "0", "2"] as OutcomeValue[]) {
      const selection = buildSelection(match, outcome);
      if (
        selection.officialVoteShare <= 0.25 &&
        (selection.edge >= 0.04 || selection.humanAligned || selection.modelProbability >= 0.28)
      ) {
        candidates.set(outcome, selection);
      }
    }
  }

  const sorted = Array.from(candidates.values()).sort((left, right) => {
    const leftScore = scoreSelection(left, mode, settings.humanWeight);
    const rightScore = scoreSelection(right, mode, settings.humanWeight);
    return rightScore - leftScore;
  });

  return sorted.slice(0, MODE_WEIGHTS[mode].limit);
}

function finalizeTicket(
  selections: TicketSelection[],
  mode: TicketMode,
  settings: GeneratorSettings,
): TicketPayload {
  const weights = MODE_WEIGHTS[mode];
  const humanAlignmentScore =
    selections.reduce(
      (sum, selection) => sum + (selection.humanAligned ? 1 : 0),
      0,
    ) / selections.length;
  const upsetCount = selections.filter((selection) => selection.contrarian).length;
  const ticketScore = selections.reduce(
    (sum, selection) => sum + scoreSelection(selection, mode, settings.humanWeight),
    0,
  );
  const estimatedHitProb = selections.reduce(
    (product, selection) => product * Math.max(selection.modelProbability, 0.05),
    1,
  );
  const contrarianScore =
    selections.reduce(
      (sum, selection) =>
        sum + (1 - selection.officialVoteShare) + Math.max(selection.edge, 0),
      0,
    ) / selections.length;
  const drawCount = selections.filter((selection) => selection.outcome === "0").length;
  const comment = `${ticketModeLabel[mode]}寄り。引き分け候補 ${drawCount} 件、逆張り候補 ${upsetCount} 件、${
    humanAlignmentScore >= 0.55 ? "人力コンセンサスも反映" : "AI寄りの構成"
  }。スコアは厳密な最適化ではなく並び替え用です。`;

  return {
    mode,
    selections,
    ticketScore:
      ticketScore -
      Math.max(0, upsetCount - settings.maxContrarianMatches) * weights.upsetPenalty,
    estimatedHitProb,
    contrarianScore,
    comment,
  };
}

function expandAll(
  matchCandidates: TicketSelection[][],
  maxTickets: number,
  settings: GeneratorSettings,
  mode: TicketMode,
) {
  const product = matchCandidates.reduce(
    (accumulator, selections) => accumulator * selections.length,
    1,
  );

  if (product <= maxTickets) {
    const results: TicketPayload[] = [];

    const walk = (index: number, selections: TicketSelection[]) => {
      if (index === matchCandidates.length) {
        results.push(finalizeTicket(selections, mode, settings));
        return;
      }

      for (const selection of matchCandidates[index]) {
        const contrarianCount =
          selections.filter((entry) => entry.contrarian).length +
          (selection.contrarian ? 1 : 0);

        if (contrarianCount > settings.maxContrarianMatches) {
          continue;
        }

        walk(index + 1, [...selections, selection]);
      }
    };

    walk(0, []);

    return results
      .sort((left, right) => right.ticketScore - left.ticketScore)
      .slice(0, maxTickets);
  }

  const beamWidth = Math.min(Math.max(maxTickets * 6, 60), 4000);
  let beam: PartialTicket[] = [
    { selections: [], partialScore: 0, contrarianCount: 0 },
  ];

  for (const candidates of matchCandidates) {
    const expanded: PartialTicket[] = [];

    for (const state of beam) {
      for (const selection of candidates) {
        const contrarianCount = state.contrarianCount + (selection.contrarian ? 1 : 0);
        if (contrarianCount > settings.maxContrarianMatches) {
          continue;
        }

        expanded.push({
          selections: [...state.selections, selection],
          partialScore:
            state.partialScore + scoreSelection(selection, mode, settings.humanWeight),
          contrarianCount,
        });
      }
    }

    beam = expanded
      .sort((left, right) => right.partialScore - left.partialScore)
      .slice(0, beamWidth);
  }

  return beam
    .map((state) => finalizeTicket(state.selections, mode, settings))
    .sort((left, right) => right.ticketScore - left.ticketScore)
    .slice(0, maxTickets);
}

export function generateTicketsForMode(
  matches: MatchLike[],
  settings: GeneratorSettings,
  mode: TicketMode,
) {
  const maxTickets = Math.max(Math.floor(settings.budgetYen / 100), 1);
  const matchCandidates = matches.map((match) => {
    const candidates = candidateSelectionsForMatch(match, settings, mode);
    return candidates.length > 0
      ? candidates
      : [buildSelection(match, favoriteOutcomeForBucket(match, "model") ?? "1")];
  });

  return expandAll(matchCandidates, maxTickets, settings, mode);
}

export function generateAllModeTickets(matches: MatchLike[], settings: GeneratorSettings) {
  return {
    conservative: generateTicketsForMode(matches, settings, "conservative"),
    balanced: generateTicketsForMode(matches, settings, "balanced"),
    upset: generateTicketsForMode(matches, settings, "upset"),
  };
}
