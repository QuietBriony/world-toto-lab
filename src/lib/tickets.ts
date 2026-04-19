import {
  aiRecommendedOutcomes,
  buildAdvantageRows,
  clamp,
  favoriteOutcomeForBucket,
  humanConsensusOutcomes,
  type AdvantageBucket,
  type AdvantageRow,
  type DrawPolicy,
  type MatchLike,
  type OutcomeValue,
  ticketModeLabel,
} from "@/lib/domain";
import type { Pick, TicketMode, User } from "@/lib/types";

export type GeneratorInput = {
  matches: Array<MatchLike & { id: string }>;
  picks?: Pick[];
  users?: User[];
};

export type GeneratorSettings = {
  budgetYen: number;
  humanWeight: number;
  maxContrarianMatches: number;
  includeDrawPolicy: DrawPolicy;
};

export type TicketSelection = {
  attentionShare: number;
  bucket: AdvantageBucket;
  compositeAdvantage: number;
  compositeProbability: number;
  confidence: number;
  contrarian: boolean;
  crowdProbability: number;
  crowdSource: "market" | "official" | null;
  darkHorseScore: number;
  edge: number;
  fixture: string;
  humanAligned: boolean;
  matchId: string;
  matchNo: number;
  modelProbability: number;
  officialVoteShare: number;
  outcome: OutcomeValue;
  predictorPickCount: number;
  predictorProbability: number | null;
  reasons: string[];
  riskScore: number;
  watcherProbability: number | null;
  watcherSupportCount: number;
};

export type TicketPayload = {
  attentionShare: number;
  averageRiskScore: number;
  contrarianScore: number;
  estimatedHitProb: number;
  mode: TicketMode;
  selections: TicketSelection[];
  ticketScore: number;
  comment: string;
};

type PartialTicket = {
  contrarianCount: number;
  partialScore: number;
  selections: TicketSelection[];
};

const MODE_WEIGHTS: Record<
  TicketMode,
  {
    advantage: number;
    attention: number;
    crowdFade: number;
    darkhorse: number;
    darkhorsePenalty: number;
    limit: number;
    predictor: number;
    riskPenalty: number;
  }
> = {
  conservative: {
    advantage: 1.25,
    attention: 1.05,
    crowdFade: 0.18,
    darkhorse: 0.24,
    darkhorsePenalty: 0.2,
    limit: 2,
    predictor: 0.52,
    riskPenalty: 0.84,
  },
  balanced: {
    advantage: 1.12,
    attention: 0.96,
    crowdFade: 0.32,
    darkhorse: 0.58,
    darkhorsePenalty: 0.14,
    limit: 3,
    predictor: 0.64,
    riskPenalty: 0.62,
  },
  upset: {
    advantage: 0.96,
    attention: 0.88,
    crowdFade: 0.5,
    darkhorse: 1.08,
    darkhorsePenalty: 0.08,
    limit: 3,
    predictor: 0.58,
    riskPenalty: 0.38,
  },
};

function normalizeCandidateLimit(value: number) {
  return Math.min(Math.max(Math.floor(value), 1), 8);
}

export function candidateLimitFromBudget(budgetYen: number) {
  return normalizeCandidateLimit(Math.floor(budgetYen / 100));
}

export function budgetFromCandidateLimit(candidateLimit: number) {
  return normalizeCandidateLimit(candidateLimit) * 100;
}

function selectionReasonSet(match: MatchLike, row: AdvantageRow) {
  const reasons = new Set<string>();

  if (aiRecommendedOutcomes(match).includes(row.outcome)) {
    reasons.add("AI本線");
  }

  if ((row.compositeAdvantage ?? 0) >= 0.06) {
    reasons.add("合成優位");
  }

  if (row.predictorPickCount > 0 && (row.predictorAdvantage ?? 0) >= 0) {
    reasons.add("予想者優位");
  }

  if (row.watcherSupportCount > 0 && (row.watcherAdvantage ?? 0) >= 0) {
    reasons.add("ウォッチ支持");
  }

  if (row.bucket === "core") {
    reasons.add("コア候補");
  }

  if (row.darkHorseScore >= 0.055) {
    reasons.add("ダークホース");
  }

  if (row.outcome === "0" && humanConsensusOutcomes(match).includes("0")) {
    reasons.add("0警戒");
  }

  if ((row.crowdProbability ?? 1) <= 0.24 && (row.compositeAdvantage ?? 0) > 0) {
    reasons.add("人気読み替え");
  }

  return Array.from(reasons);
}

function buildSelection(match: MatchLike & { id: string }, row: AdvantageRow): TicketSelection {
  const crowdProbability = row.crowdProbability ?? row.officialVoteShare ?? 0.05;
  const compositeProbability = row.compositeProbability ?? row.aiProbability ?? 0.08;
  const reasons = selectionReasonSet(match, row);
  const officialFavorite = favoriteOutcomeForBucket(match, "official");

  return {
    attentionShare: row.attentionShare,
    bucket: row.bucket,
    compositeAdvantage: row.compositeAdvantage ?? 0,
    compositeProbability,
    confidence: clamp(match.confidence ?? 0.55, 0, 1),
    contrarian: officialFavorite ? officialFavorite !== row.outcome : false,
    crowdProbability,
    crowdSource: row.crowdSource,
    darkHorseScore: row.darkHorseScore,
    edge: row.aiAdvantage ?? row.edge ?? 0,
    fixture: `${match.homeTeam} 対 ${match.awayTeam}`,
    humanAligned:
      row.predictorPickCount > 0 || humanConsensusOutcomes(match).includes(row.outcome),
    matchId: match.id,
    matchNo: match.matchNo,
    modelProbability: row.aiProbability ?? row.modelProbability ?? 0.08,
    officialVoteShare: row.officialVoteShare ?? crowdProbability,
    outcome: row.outcome,
    predictorPickCount: row.predictorPickCount,
    predictorProbability: row.predictorProbability,
    reasons,
    riskScore: row.riskScore,
    watcherProbability: row.watcherProbability,
    watcherSupportCount: row.watcherSupportCount,
  };
}

function scoreSelection(
  selection: TicketSelection,
  mode: TicketMode,
  humanWeight: number,
) {
  const weights = MODE_WEIGHTS[mode];
  const predictorBoost =
    Math.max(selection.predictorPickCount, 0) * 0.015 +
    Math.max(selection.watcherSupportCount, 0) * 0.009 +
    Math.max(selection.predictorProbability ?? 0, 0) * 0.12;
  const crowdFade = 1 - clamp(selection.crowdProbability, 0, 1);
  const darkhorsePenalty =
    mode === "conservative" && selection.bucket === "darkhorse" ? 0.14 : 0;

  return (
    Math.log(Math.max(selection.compositeProbability, 0.08)) +
    weights.advantage * Math.max(selection.compositeAdvantage, 0) * 3.1 +
    weights.attention * selection.attentionShare * 3.2 +
    weights.predictor * predictorBoost * Math.max(humanWeight, 0.2) +
    weights.darkhorse * selection.darkHorseScore * 1.8 +
    weights.crowdFade * crowdFade * 0.5 -
    weights.riskPenalty * selection.riskScore * 0.62 -
    darkhorsePenalty
  );
}

function candidateSelectionsForMatch(input: {
  advantageRows: AdvantageRow[];
  match: MatchLike & { id: string };
  mode: TicketMode;
  settings: GeneratorSettings;
}) {
  const candidates = new Map<OutcomeValue, TicketSelection>();
  const topModelOutcome = favoriteOutcomeForBucket(input.match, "model");
  const drawRow = input.advantageRows.find((row) => row.outcome === "0");

  if (topModelOutcome) {
    const topAiRow = input.advantageRows.find((row) => row.outcome === topModelOutcome);
    if (topAiRow) {
      candidates.set(topModelOutcome, buildSelection(input.match, topAiRow));
    }
  }

  input.advantageRows
    .filter((row) => row.include)
    .forEach((row) => {
      candidates.set(row.outcome, buildSelection(input.match, row));
    });

  input.advantageRows
    .filter(
      (row) =>
        row.predictorPickCount > 0 &&
        ((row.predictorAdvantage ?? 0) >= 0 || (row.predictorProbability ?? 0) >= 0.25),
    )
    .forEach((row) => {
      candidates.set(row.outcome, buildSelection(input.match, row));
    });

  if (
    drawRow &&
    (input.settings.includeDrawPolicy === "high" ||
      (input.settings.includeDrawPolicy === "medium" &&
        ((drawRow.compositeAdvantage ?? 0) >= 0.02 ||
          drawRow.darkHorseScore >= 0.03 ||
          humanConsensusOutcomes(input.match).includes("0"))))
  ) {
    candidates.set("0", buildSelection(input.match, drawRow));
  }

  if (input.mode === "upset") {
    input.advantageRows
      .filter(
        (row) =>
          row.darkHorseScore >= 0.035 ||
          ((row.crowdProbability ?? 1) <= 0.24 && (row.compositeAdvantage ?? 0) > 0),
      )
      .forEach((row) => {
        candidates.set(row.outcome, buildSelection(input.match, row));
      });
  }

  const fallbackRow = input.advantageRows[0];
  if (candidates.size === 0 && fallbackRow) {
    candidates.set(fallbackRow.outcome, buildSelection(input.match, fallbackRow));
  }

  return Array.from(candidates.values())
    .sort((left, right) => {
      const leftScore = scoreSelection(left, input.mode, input.settings.humanWeight);
      const rightScore = scoreSelection(right, input.mode, input.settings.humanWeight);
      return rightScore - leftScore;
    })
    .slice(0, MODE_WEIGHTS[input.mode].limit);
}

function finalizeTicket(
  selections: TicketSelection[],
  mode: TicketMode,
  settings: GeneratorSettings,
): TicketPayload {
  const weights = MODE_WEIGHTS[mode];
  const darkHorseCount = selections.filter(
    (selection) => selection.bucket === "darkhorse" || selection.contrarian,
  ).length;
  const coreCount = selections.filter((selection) => selection.bucket === "core").length;
  const predictorCount = selections.filter((selection) => selection.predictorPickCount > 0).length;
  const ticketScore = selections.reduce(
    (sum, selection) => sum + scoreSelection(selection, mode, settings.humanWeight),
    0,
  );
  const estimatedHitProb =
    selections.reduce((sum, selection) => sum + selection.compositeProbability, 0) /
    selections.length;
  const averageRiskScore =
    selections.reduce((sum, selection) => sum + selection.riskScore, 0) / selections.length;
  const contrarianScore =
    selections.reduce((sum, selection) => sum + selection.darkHorseScore, 0) /
    selections.length;
  const comment = `${ticketModeLabel[mode]}寄り。コア ${coreCount} 件、予想者が押す候補 ${predictorCount} 件、ダークホース ${darkHorseCount} 件。注目配分は並び替え用の目安で、金額配分は扱いません。`;

  return {
    attentionShare: 0,
    averageRiskScore,
    comment,
    contrarianScore,
    estimatedHitProb,
    mode,
    selections,
    ticketScore:
      ticketScore -
      Math.max(0, darkHorseCount - settings.maxContrarianMatches) * weights.darkhorsePenalty,
  };
}

function attachAttentionShares(tickets: TicketPayload[]) {
  if (tickets.length === 0) {
    return tickets;
  }

  const minScore = Math.min(...tickets.map((ticket) => ticket.ticketScore));
  const rawWeights = tickets.map((ticket) =>
    Math.max(ticket.ticketScore - minScore + 0.18, 0.05) *
    (1 - ticket.averageRiskScore * 0.18),
  );
  const totalWeight = rawWeights.reduce((sum, value) => sum + value, 0);

  return tickets.map((ticket, index) => ({
    ...ticket,
    attentionShare: totalWeight > 0 ? rawWeights[index] / totalWeight : 1 / tickets.length,
  }));
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
          selections.filter(
            (entry) => entry.contrarian || entry.bucket === "darkhorse",
          ).length + (selection.contrarian || selection.bucket === "darkhorse" ? 1 : 0);

        if (contrarianCount > settings.maxContrarianMatches + 1) {
          continue;
        }

        walk(index + 1, [...selections, selection]);
      }
    };

    walk(0, []);

    return attachAttentionShares(
      results
        .sort((left, right) => right.ticketScore - left.ticketScore)
        .slice(0, maxTickets),
    );
  }

  const beamWidth = Math.min(Math.max(maxTickets * 6, 60), 4000);
  let beam: PartialTicket[] = [{ contrarianCount: 0, partialScore: 0, selections: [] }];

  for (const candidates of matchCandidates) {
    const expanded: PartialTicket[] = [];

    for (const state of beam) {
      for (const selection of candidates) {
        const contrarianCount =
          state.contrarianCount +
          (selection.contrarian || selection.bucket === "darkhorse" ? 1 : 0);
        if (contrarianCount > settings.maxContrarianMatches + 1) {
          continue;
        }

        expanded.push({
          contrarianCount,
          partialScore:
            state.partialScore + scoreSelection(selection, mode, settings.humanWeight),
          selections: [...state.selections, selection],
        });
      }
    }

    beam = expanded
      .sort((left, right) => right.partialScore - left.partialScore)
      .slice(0, beamWidth);
  }

  return attachAttentionShares(
    beam
      .map((state) => finalizeTicket(state.selections, mode, settings))
      .sort((left, right) => right.ticketScore - left.ticketScore)
      .slice(0, maxTickets),
  );
}

export function generateTicketsForMode(
  input: GeneratorInput,
  settings: GeneratorSettings,
  mode: TicketMode,
) {
  const maxTickets = candidateLimitFromBudget(settings.budgetYen);
  const advantageRows = buildAdvantageRows({
    matches: input.matches,
    picks: input.picks ?? [],
    users: input.users ?? [],
  });
  const rowsByMatchId = advantageRows.reduce((map, row) => {
    const current = map.get(row.matchId) ?? [];
    current.push(row);
    map.set(row.matchId, current);
    return map;
  }, new Map<string, AdvantageRow[]>());

  const matchCandidates = input.matches.map((match) => {
    const candidates = candidateSelectionsForMatch({
      advantageRows: rowsByMatchId.get(match.id) ?? [],
      match,
      mode,
      settings,
    });

    if (candidates.length > 0) {
      return candidates;
    }

    const fallbackOutcome = favoriteOutcomeForBucket(match, "model") ?? "1";
    const fallbackRow =
      (rowsByMatchId.get(match.id) ?? []).find((row) => row.outcome === fallbackOutcome) ??
      (rowsByMatchId.get(match.id) ?? [])[0];

    return fallbackRow ? [buildSelection(match, fallbackRow)] : [];
  });

  return expandAll(matchCandidates, maxTickets, settings, mode);
}

export function generateAllModeTickets(input: GeneratorInput, settings: GeneratorSettings) {
  return {
    conservative: generateTicketsForMode(input, settings, "conservative"),
    balanced: generateTicketsForMode(input, settings, "balanced"),
    upset: generateTicketsForMode(input, settings, "upset"),
  };
}
