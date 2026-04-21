import { canEstimateAiModel, estimateAiModel } from "@/lib/ai-estimator";
import {
  generateCandidateTickets,
  isCandidateTicketSetStale,
} from "@/lib/candidate-tickets";
import { buildAdvantageRows, computeConsensus } from "@/lib/domain";
import {
  buildDemoMatchRows,
  buildDemoPickRows,
  buildDemoReviewNotes,
  buildDemoScoutReportRows,
  demoRoundNotes,
  demoRoundTitle,
  demoTicketSettings,
  isDemoRoundTitle,
} from "@/lib/demo-data";
import { parseOutcome } from "@/lib/forms";
import {
  encodePickSupportNote,
  parsePickSupportNote,
  resolveSupportedOutcome,
} from "@/lib/pick-support";
import {
  encodeRoundParticipantsNote,
  parseRoundParticipantsNote,
  resolveRoundParticipantUsers,
} from "@/lib/round-participants";
import { defaultDemoUsers, defaultInitialUsers, isDemoAccountName } from "@/lib/sample-data";
import { requireSupabaseClient } from "@/lib/supabase";
import { generateAllModeTickets } from "@/lib/tickets";
import { filterPredictors, isPredictorRole } from "@/lib/users";
import {
  buildProductRule,
  normalizeOutcomeSet,
  normalizeRequiredMatchCount,
} from "@/lib/product-rules";
import type {
  CandidateDataQuality,
  CandidateStrategyType,
  CandidateTicket,
  CandidateVote,
  CandidateVoteValue,
  DashboardData,
  DashboardRoundSummary,
  FixtureDataConfidence,
  FixtureMaster,
  FixtureSource,
  GeneratedTicket,
  HumanScoutReport,
  Match,
  MatchCategory,
  Outcome,
  Pick,
  PickSupport,
  ProductType,
  ProvisionalCall,
  ReviewNote,
  Round,
  RoundEvAssumption,
  RoundSource,
  RoundStatus,
  RoundWorkspace,
  TicketMode,
  TotoOfficialMatch,
  TotoOfficialMatchStatus,
  TotoOfficialResultStatus,
  TotoOfficialRoundLibraryEntry,
  TotoOfficialRoundLibraryMatch,
  TotoOfficialRound,
  User,
  UserRole,
  VoidHandling,
} from "@/lib/types";

type UserRow = {
  created_at: string;
  id: string;
  name: string;
  role: UserRole;
  updated_at: string;
};

type RoundRow = {
  active_match_count: number | null;
  budget_yen: number | null;
  created_at: string;
  id: string;
  notes: string | null;
  outcome_set_json: string[] | null;
  product_type: ProductType;
  required_match_count: number | null;
  round_source: RoundSource;
  source_note: string | null;
  status: RoundStatus;
  title: string;
  updated_at: string;
  void_handling: VoidHandling;
};

type MatchRow = {
  actual_result: Outcome | null;
  admin_note: string | null;
  away_team: string;
  category: MatchCategory | null;
  confidence: number | null;
  consensus_call: string | null;
  consensus_d: number | null;
  consensus_f: number | null;
  created_at: string;
  disagreement_score: number | null;
  exception_count: number | null;
  fixture_master_id: string | null;
  home_team: string;
  id: string;
  injury_note: string | null;
  kickoff_time: string | null;
  market_prob_0: number | null;
  market_prob_1: number | null;
  market_prob_2: number | null;
  match_no: number;
  model_prob_0: number | null;
  model_prob_1: number | null;
  model_prob_2: number | null;
  motivation_note: string | null;
  official_match_no: number | null;
  official_vote_0: number | null;
  official_vote_1: number | null;
  official_vote_2: number | null;
  recommended_outcomes: string | null;
  round_id: string;
  stage: string | null;
  tactical_note: string | null;
  updated_at: string;
  venue: string | null;
};

type PickRow = {
  created_at: string;
  id: string;
  match_id: string;
  note: string | null;
  pick: Outcome;
  round_id: string;
  updated_at: string;
  user_id: string;
};

type HumanScoutReportRow = {
  created_at: string;
  direction_score_f: number;
  draw_alert: number;
  exception_flag: boolean;
  exception_note: string | null;
  id: string;
  match_id: string;
  note_availability: string | null;
  note_conditions: string | null;
  note_draw_alert: string | null;
  note_micro: string | null;
  note_strength_form: string | null;
  note_tactical_matchup: string | null;
  provisional_call: ProvisionalCall;
  round_id: string;
  score_availability: number;
  score_conditions: number;
  score_micro: number;
  score_strength_form: number;
  score_tactical_matchup: number;
  updated_at: string;
  user_id: string;
};

type GeneratedTicketRow = {
  contrarian_score: number | null;
  created_at: string;
  estimated_hit_prob: number | null;
  id: string;
  mode: TicketMode;
  round_id: string;
  ticket_json: string;
  ticket_score: number | null;
};

type RoundEvAssumptionRow = {
  carryover_yen: number;
  created_at: string;
  first_prize_share: number;
  id: string;
  note: string | null;
  payout_cap_yen: number | null;
  return_rate: number;
  round_id: string;
  stake_yen: number;
  total_sales_yen: number | null;
  updated_at: string;
};

type CandidateTicketRow = {
  contrarian_count: number;
  created_at: string;
  data_quality: CandidateDataQuality;
  draw_count: number;
  estimated_payout_yen: number | null;
  ev_multiple: number | null;
  ev_percent: number | null;
  gross_ev_yen: number | null;
  hit_probability: number | null;
  human_alignment_score: number | null;
  id: string;
  label: string;
  p_model_combo: number | null;
  p_public_combo: number | null;
  picks_json: Array<{
    matchNo: number;
    pick: "1" | "0" | "2";
  }> | null;
  proxy_score: number | null;
  public_overlap_score: number | null;
  rationale: string | null;
  round_id: string;
  strategy_type: CandidateStrategyType;
  updated_at: string;
  warning: string | null;
};

type CandidateVoteRow = {
  candidate_ticket_id: string;
  comment: string | null;
  created_at: string;
  id: string;
  round_id: string;
  updated_at: string;
  user_id: string;
  vote: CandidateVoteValue;
};

type FixtureMasterRow = {
  away_team: string;
  city: string | null;
  competition: string;
  country: string | null;
  created_at: string;
  data_confidence: FixtureDataConfidence;
  external_fixture_id: string | null;
  group_name: string | null;
  home_team: string;
  id: string;
  kickoff_time: string | null;
  match_date: string | null;
  source: FixtureSource;
  source_text: string | null;
  source_url: string | null;
  stage: string | null;
  timezone: string | null;
  updated_at: string;
  venue: string | null;
};

type TotoOfficialRoundRow = {
  carryover_yen: number;
  created_at: string;
  first_prize_share: number | null;
  id: string;
  official_round_name: string | null;
  official_round_number: number | null;
  payout_cap_yen: number | null;
  product_type: ProductType;
  result_status: TotoOfficialResultStatus;
  return_rate: number;
  round_id: string;
  sales_end_at: string | null;
  sales_start_at: string | null;
  source_text: string | null;
  source_url: string | null;
  stake_yen: number;
  total_sales_yen: number | null;
  updated_at: string;
};

type TotoOfficialMatchRow = {
  actual_result: Outcome | null;
  away_team: string;
  created_at: string;
  fixture_master_id: string | null;
  home_team: string;
  id: string;
  kickoff_time: string | null;
  match_id: string | null;
  match_status: TotoOfficialMatchStatus;
  official_match_no: number;
  official_vote_0: number | null;
  official_vote_1: number | null;
  official_vote_2: number | null;
  round_id: string;
  source_text: string | null;
  stage: string | null;
  updated_at: string;
  venue: string | null;
};

type TotoOfficialRoundLibraryRow = {
  carryover_yen: number;
  created_at: string;
  first_prize_share: number | null;
  id: string;
  matches_json: TotoOfficialRoundLibraryMatch[] | null;
  notes: string | null;
  official_round_name: string | null;
  official_round_number: number | null;
  outcome_set_json: string[] | null;
  payout_cap_yen: number | null;
  product_type: ProductType;
  required_match_count: number | null;
  result_status: TotoOfficialResultStatus;
  return_rate: number;
  sales_end_at: string | null;
  sales_start_at: string | null;
  source_note: string | null;
  source_text: string | null;
  source_url: string | null;
  stake_yen: number;
  title: string;
  total_sales_yen: number | null;
  updated_at: string;
  void_handling: VoidHandling;
};

type ReviewNoteRow = {
  created_at: string;
  id: string;
  match_id: string | null;
  note: string;
  round_id: string;
  user_id: string | null;
};

function mapUser(row: UserRow): User {
  return {
    id: row.id,
    name: row.name,
    role: row.role,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

const userNameCollator = new Intl.Collator("ja", {
  numeric: true,
  sensitivity: "base",
});

function sortUsers(users: User[]) {
  return [...users].sort((left, right) => {
    if (left.role !== right.role) {
      return left.role === "admin" ? -1 : 1;
    }

    const byName = userNameCollator.compare(left.name, right.name);
    if (byName !== 0) {
      return byName;
    }

    if (left.createdAt !== right.createdAt) {
      return left.createdAt.localeCompare(right.createdAt);
    }

    return left.id.localeCompare(right.id);
  });
}

function partitionUsers(users: User[]) {
  return {
    demoUsers: sortUsers(users.filter((user) => isDemoAccountName(user.name))),
    liveUsers: sortUsers(users.filter((user) => !isDemoAccountName(user.name))),
  };
}

function hasExpectedDemoUsers(users: User[]) {
  if (users.length !== defaultDemoUsers.length) {
    return false;
  }

  return defaultDemoUsers.every((seed) =>
    users.some((user) => user.name === seed.name && user.role === seed.role),
  );
}

function mapRound(row: RoundRow): Round {
  const parsed = parseRoundParticipantsNote(row.notes);

  return {
    id: row.id,
    title: row.title,
    status: row.status,
    budgetYen: row.budget_yen,
    notes: parsed.notes,
    productType: row.product_type,
    requiredMatchCount: row.required_match_count,
    activeMatchCount: row.active_match_count,
    roundSource: row.round_source,
    sourceNote: row.source_note,
    outcomeSetJson: row.outcome_set_json,
    voidHandling: row.void_handling,
    participantIds: parsed.participantIds,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapMatch(row: MatchRow): Match {
  return {
    id: row.id,
    roundId: row.round_id,
    fixtureMasterId: row.fixture_master_id,
    officialMatchNo: row.official_match_no,
    matchNo: row.match_no,
    homeTeam: row.home_team,
    awayTeam: row.away_team,
    kickoffTime: row.kickoff_time,
    venue: row.venue,
    stage: row.stage,
    officialVote1: row.official_vote_1,
    officialVote0: row.official_vote_0,
    officialVote2: row.official_vote_2,
    marketProb1: row.market_prob_1,
    marketProb0: row.market_prob_0,
    marketProb2: row.market_prob_2,
    modelProb1: row.model_prob_1,
    modelProb0: row.model_prob_0,
    modelProb2: row.model_prob_2,
    consensusF: row.consensus_f,
    consensusD: row.consensus_d,
    consensusCall: row.consensus_call,
    disagreementScore: row.disagreement_score,
    exceptionCount: row.exception_count,
    confidence: row.confidence,
    category: row.category,
    recommendedOutcomes: row.recommended_outcomes,
    tacticalNote: row.tactical_note,
    injuryNote: row.injury_note,
    motivationNote: row.motivation_note,
    adminNote: row.admin_note,
    actualResult: row.actual_result,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapResolvedPick(
  row: PickRow,
  input: {
    note: string | null;
    pick: Outcome;
    support: PickSupport;
  },
  user?: User,
): Pick {
  return {
    id: row.id,
    roundId: row.round_id,
    matchId: row.match_id,
    userId: row.user_id,
    pick: input.pick,
    note: input.note,
    support: input.support,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    user,
  };
}

function mapScoutReport(
  row: HumanScoutReportRow,
  user?: User,
  match?: Match,
): HumanScoutReport {
  return {
    id: row.id,
    roundId: row.round_id,
    matchId: row.match_id,
    userId: row.user_id,
    scoreStrengthForm: row.score_strength_form,
    noteStrengthForm: row.note_strength_form,
    scoreAvailability: row.score_availability,
    noteAvailability: row.note_availability,
    scoreConditions: row.score_conditions,
    noteConditions: row.note_conditions,
    scoreTacticalMatchup: row.score_tactical_matchup,
    noteTacticalMatchup: row.note_tactical_matchup,
    scoreMicro: row.score_micro,
    noteMicro: row.note_micro,
    drawAlert: row.draw_alert,
    noteDrawAlert: row.note_draw_alert,
    directionScoreF: row.direction_score_f,
    provisionalCall: row.provisional_call,
    exceptionFlag: row.exception_flag,
    exceptionNote: row.exception_note,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    user,
    match,
  };
}

function mapGeneratedTicket(row: GeneratedTicketRow): GeneratedTicket {
  return {
    id: row.id,
    roundId: row.round_id,
    mode: row.mode,
    ticketJson: row.ticket_json,
    ticketScore: row.ticket_score,
    estimatedHitProb: row.estimated_hit_prob,
    contrarianScore: row.contrarian_score,
    createdAt: row.created_at,
  };
}

function mapRoundEvAssumption(row: RoundEvAssumptionRow): RoundEvAssumption {
  return {
    id: row.id,
    roundId: row.round_id,
    stakeYen: row.stake_yen,
    totalSalesYen: row.total_sales_yen,
    returnRate: row.return_rate,
    firstPrizeShare: row.first_prize_share,
    carryoverYen: row.carryover_yen,
    payoutCapYen: row.payout_cap_yen,
    note: row.note,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapCandidateTicket(row: CandidateTicketRow): CandidateTicket {
  return {
    id: row.id,
    roundId: row.round_id,
    label: row.label,
    strategyType: row.strategy_type,
    picks: Array.isArray(row.picks_json) ? row.picks_json : [],
    pModelCombo: row.p_model_combo,
    pPublicCombo: row.p_public_combo,
    estimatedPayoutYen: row.estimated_payout_yen,
    grossEvYen: row.gross_ev_yen,
    evMultiple: row.ev_multiple,
    evPercent: row.ev_percent,
    proxyScore: row.proxy_score,
    hitProbability: row.hit_probability,
    publicOverlapScore: row.public_overlap_score,
    contrarianCount: row.contrarian_count,
    drawCount: row.draw_count,
    humanAlignmentScore: row.human_alignment_score,
    dataQuality: row.data_quality,
    rationale: row.rationale,
    warning: row.warning,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapCandidateVote(row: CandidateVoteRow, user?: User): CandidateVote {
  return {
    id: row.id,
    roundId: row.round_id,
    candidateTicketId: row.candidate_ticket_id,
    userId: row.user_id,
    vote: row.vote,
    comment: row.comment,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    user,
  };
}

function mapFixtureMaster(row: FixtureMasterRow): FixtureMaster {
  return {
    id: row.id,
    competition: row.competition,
    source: row.source,
    sourceUrl: row.source_url,
    sourceText: row.source_text,
    externalFixtureId: row.external_fixture_id,
    matchDate: row.match_date,
    kickoffTime: row.kickoff_time,
    timezone: row.timezone,
    homeTeam: row.home_team,
    awayTeam: row.away_team,
    groupName: row.group_name,
    stage: row.stage,
    venue: row.venue,
    city: row.city,
    country: row.country,
    dataConfidence: row.data_confidence,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapTotoOfficialRound(row: TotoOfficialRoundRow): TotoOfficialRound {
  return {
    id: row.id,
    roundId: row.round_id,
    productType: row.product_type,
    officialRoundName: row.official_round_name,
    officialRoundNumber: row.official_round_number,
    salesStartAt: row.sales_start_at,
    salesEndAt: row.sales_end_at,
    resultStatus: row.result_status,
    stakeYen: row.stake_yen,
    totalSalesYen: row.total_sales_yen,
    returnRate: row.return_rate,
    firstPrizeShare: row.first_prize_share,
    carryoverYen: row.carryover_yen,
    payoutCapYen: row.payout_cap_yen,
    sourceUrl: row.source_url,
    sourceText: row.source_text,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapTotoOfficialMatch(row: TotoOfficialMatchRow): TotoOfficialMatch {
  return {
    id: row.id,
    roundId: row.round_id,
    matchId: row.match_id,
    fixtureMasterId: row.fixture_master_id,
    officialMatchNo: row.official_match_no,
    homeTeam: row.home_team,
    awayTeam: row.away_team,
    kickoffTime: row.kickoff_time,
    venue: row.venue,
    stage: row.stage,
    officialVote1: row.official_vote_1,
    officialVote0: row.official_vote_0,
    officialVote2: row.official_vote_2,
    actualResult: row.actual_result,
    matchStatus: row.match_status,
    sourceText: row.source_text,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapTotoOfficialRoundLibraryMatch(
  row: TotoOfficialRoundLibraryMatch,
): TotoOfficialRoundLibraryMatch {
  return {
    actualResult: row.actualResult,
    awayTeam: row.awayTeam,
    fixtureMasterId: row.fixtureMasterId,
    homeTeam: row.homeTeam,
    kickoffTime: row.kickoffTime,
    matchStatus: row.matchStatus,
    officialMatchNo: row.officialMatchNo,
    officialVote0: row.officialVote0,
    officialVote1: row.officialVote1,
    officialVote2: row.officialVote2,
    sourceText: row.sourceText,
    stage: row.stage,
    venue: row.venue,
  };
}

function mapTotoOfficialRoundLibraryEntry(
  row: TotoOfficialRoundLibraryRow,
): TotoOfficialRoundLibraryEntry {
  const matches = Array.isArray(row.matches_json)
    ? row.matches_json.map(mapTotoOfficialRoundLibraryMatch)
    : [];

  return {
    id: row.id,
    title: row.title,
    notes: row.notes,
    productType: row.product_type,
    requiredMatchCount: row.required_match_count,
    outcomeSetJson: row.outcome_set_json,
    sourceNote: row.source_note,
    voidHandling: row.void_handling,
    officialRoundName: row.official_round_name,
    officialRoundNumber: row.official_round_number,
    salesStartAt: row.sales_start_at,
    salesEndAt: row.sales_end_at,
    resultStatus: row.result_status,
    stakeYen: row.stake_yen,
    totalSalesYen: row.total_sales_yen,
    returnRate: row.return_rate,
    firstPrizeShare: row.first_prize_share,
    carryoverYen: row.carryover_yen,
    payoutCapYen: row.payout_cap_yen,
    sourceUrl: row.source_url,
    sourceText: row.source_text,
    matchCount: matches.length,
    matches,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function applyScopedConsensus(
  matches: Match[],
  scoutReports: HumanScoutReport[],
) {
  const reportsByMatchId = new Map<string, HumanScoutReport[]>();

  scoutReports.forEach((report) => {
    const current = reportsByMatchId.get(report.matchId) ?? [];
    current.push(report);
    reportsByMatchId.set(report.matchId, current);
  });

  return matches.map((match) => {
    const reports = reportsByMatchId.get(match.id) ?? [];
    if (reports.length === 0) {
      return {
        ...match,
        consensusF: null,
        consensusD: null,
        consensusCall: null,
        disagreementScore: null,
        exceptionCount: null,
      };
    }

    const summary = computeConsensus(reports);
    return {
      ...match,
      consensusF: summary.avgF,
      consensusD: summary.avgD,
      consensusCall: summary.consensusCall,
      disagreementScore: summary.disagreementScore,
      exceptionCount: summary.exceptionCount,
    };
  });
}

function mapReviewNote(row: ReviewNoteRow, user?: User, match?: Match): ReviewNote {
  return {
    id: row.id,
    roundId: row.round_id,
    matchId: row.match_id,
    userId: row.user_id,
    note: row.note,
    createdAt: row.created_at,
    user,
    match,
  };
}

function groupByRoundId<T extends { roundId: string }>(records: T[]) {
  const map = new Map<string, T[]>();

  records.forEach((record) => {
    const current = map.get(record.roundId) ?? [];
    current.push(record);
    map.set(record.roundId, current);
  });

  return map;
}

function throwIfError(
  label: string,
  result: { data: unknown; error: Error | null },
) {
  if (result.error) {
    throw new Error(`${label}: ${result.error.message}`);
  }
}

type TotoOfficialRoundImportMatchInput = TotoOfficialRoundLibraryMatch;

type TotoOfficialRoundImportInput = {
  carryoverYen: number;
  firstPrizeShare: number | null;
  notes: string | null;
  officialRoundName: string | null;
  officialRoundNumber: number | null;
  outcomeSetJson?: string[] | null;
  participantIds?: string[];
  payoutCapYen: number | null;
  productType: ProductType;
  requiredMatchCount?: number | null;
  resultStatus: TotoOfficialResultStatus;
  returnRate: number;
  roundId?: string | null;
  rows: TotoOfficialRoundImportMatchInput[];
  salesEndAt: string | null;
  salesStartAt: string | null;
  sourceNote?: string | null;
  sourceText: string | null;
  sourceUrl: string | null;
  stakeYen: number;
  status?: RoundStatus;
  title?: string | null;
  totalSalesYen: number | null;
  voidHandling?: VoidHandling;
};

function deriveRoundSummary(
  round: Round,
  candidateTicketCount: number,
  matches: Match[],
  picks: Pick[],
  scoutReports: HumanScoutReport[],
  reviewNotes: ReviewNote[],
  users: User[],
): DashboardRoundSummary {
  const topSignals = buildAdvantageRows({
    matches,
    picks,
    users,
  })
    .filter((row) => row.include)
    .slice(0, 3);

  const consensusCompleted = matches.filter((match) => match.consensusCall !== null).length;
  const resultedCount = matches.filter((match) => match.actualResult !== null).length;

  return {
    ...round,
    candidateTicketCount,
    matches,
    picks,
    scoutReports,
    reviewNotes,
    matchCount: matches.length,
    pickCount: picks.length,
    resultedCount,
    consensusCompletion: matches.length > 0 ? consensusCompleted / matches.length : 0,
    topSignals: topSignals.map((row) => ({
      attentionShare: row.attentionShare,
      bucket: row.bucket,
      compositeAdvantage: row.compositeAdvantage ?? 0,
      fixture: row.fixture,
      matchId: row.matchId,
      matchNo: row.matchNo,
      outcome: row.outcome,
    })),
  };
}

function collectRoundUserIds(input: {
  picks: PickRow[];
  reviewNotes: ReviewNoteRow[];
  scoutReports: HumanScoutReportRow[];
}) {
  const userIds = new Set<string>();

  input.picks.forEach((pick) => {
    userIds.add(pick.user_id);
    const support = parsePickSupportNote(pick.note).support;
    if (support.kind === "predictor") {
      userIds.add(support.userId);
    }
  });

  input.scoutReports.forEach((report) => {
    userIds.add(report.user_id);
  });

  input.reviewNotes.forEach((note) => {
    if (note.user_id) {
      userIds.add(note.user_id);
    }
  });

  return userIds;
}

function resolveUsersForRoundRows(input: {
  allUsers: User[];
  demoUsers: User[];
  liveUsers: User[];
  participantIds: string[];
  picks: PickRow[];
  reviewNotes: ReviewNoteRow[];
  roundTitle: string;
  scoutReports: HumanScoutReportRow[];
}) {
  if (!isDemoRoundTitle(input.roundTitle)) {
    return resolveRoundParticipantUsers(input.liveUsers, input.participantIds);
  }

  const roundUserIds = collectRoundUserIds({
    picks: input.picks,
    reviewNotes: input.reviewNotes,
    scoutReports: input.scoutReports,
  });
  const scopedUsers = sortUsers(
    input.allUsers.filter((user) => roundUserIds.has(user.id)),
  );

  return scopedUsers.length > 0 ? scopedUsers : input.demoUsers;
}

function filterRowsForScopedUsers<T extends { user_id: string }>(
  rows: T[],
  users: User[],
) {
  const scopedUserIds = new Set(users.map((user) => user.id));
  return rows.filter((row) => scopedUserIds.has(row.user_id));
}

function filterReviewNotesForScopedUsers(
  rows: ReviewNoteRow[],
  users: User[],
) {
  const scopedUserIds = new Set(users.map((user) => user.id));
  return rows.filter((row) => !row.user_id || scopedUserIds.has(row.user_id));
}

function resolvePicksForScopedUsers(input: {
  matches: Match[];
  rows: PickRow[];
  users: User[];
}) {
  const userById = new Map(input.users.map((user) => [user.id, user]));
  const selectedUserIds = new Set(userById.keys());
  const matchById = new Map(input.matches.map((match) => [match.id, match]));
  const rowByMatchUser = new Map(
    input.rows.map((row) => [`${row.match_id}:${row.user_id}`, row]),
  );
  const parsedByRowId = new Map(
    input.rows.map((row) => [row.id, parsePickSupportNote(row.note)]),
  );
  const resolvedPickByRowId = new Map<
    string,
    | {
        note: string | null;
        pick: Outcome;
        support: PickSupport;
      }
    | null
  >();
  const resolvingRowIds = new Set<string>();

  const resolveRowPick = (
    row: PickRow,
  ):
    | {
        note: string | null;
        pick: Outcome;
        support: PickSupport;
      }
    | null => {
    const cached = resolvedPickByRowId.get(row.id);
    if (cached !== undefined) {
      return cached;
    }

    if (resolvingRowIds.has(row.id)) {
      return {
        note: parsePickSupportNote(row.note).note,
        pick: row.pick,
        support: parsePickSupportNote(row.note).support,
      };
    }

    resolvingRowIds.add(row.id);
    const parsed = parsedByRowId.get(row.id) ?? parsePickSupportNote(row.note);
    let resolved:
      | {
          note: string | null;
          pick: Outcome;
          support: PickSupport;
        }
      | null = {
      note: parsed.note,
      pick: row.pick,
      support: parsed.support,
    };

    if (parsed.support.kind === "ai") {
      const match = matchById.get(row.match_id);
      const nextPick = match
        ? parseOutcome(
            resolveSupportedOutcome({
              match,
              picks: [],
              support: parsed.support,
            }),
          )
        : null;

      resolved = nextPick
        ? {
            note: parsed.note,
            pick: nextPick,
            support: parsed.support,
          }
        : null;
    } else if (
      parsed.support.kind === "predictor"
    ) {
      if (!selectedUserIds.has(parsed.support.userId)) {
        resolved = null;
      } else {
      const predictorRow = rowByMatchUser.get(
        `${row.match_id}:${parsed.support.userId}`,
      );
        const predictorPick = predictorRow ? resolveRowPick(predictorRow) : null;
        resolved = predictorPick
          ? {
              note: parsed.note,
              pick: predictorPick.pick,
              support: parsed.support,
            }
          : null;
      }
    }

    resolvingRowIds.delete(row.id);
    resolvedPickByRowId.set(row.id, resolved);
    return resolved;
  };

  return input.rows.flatMap((row) => {
    const resolved = resolveRowPick(row);
    if (!resolved) {
      return [];
    }

    return [mapResolvedPick(row, resolved, userById.get(row.user_id))];
  });
}

function sameParticipantIds(left: string[] | null | undefined, right: string[] | null | undefined) {
  const leftIds = Array.from(new Set((left ?? []).filter(Boolean))).sort();
  const rightIds = Array.from(new Set((right ?? []).filter(Boolean))).sort();

  if (leftIds.length !== rightIds.length) {
    return false;
  }

  return leftIds.every((value, index) => value === rightIds[index]);
}

async function clearGeneratedTicketsForRound(roundId: string) {
  const supabase = requireSupabaseClient();
  const result = await supabase.from("generated_tickets").delete().eq("round_id", roundId);
  throwIfError("Failed to clear generated tickets", result);
}

function isValidDemoRound(input: {
  demoUsers: User[];
  matches: MatchRow[];
  picks: PickRow[];
  reviewNotes: ReviewNoteRow[];
  scoutReports: HumanScoutReportRow[];
}) {
  const predictorIds = new Set(filterPredictors(input.demoUsers).map((user) => user.id));
  const demoUserIds = new Set(input.demoUsers.map((user) => user.id));
  const roundUserIds = collectRoundUserIds({
    picks: input.picks,
    reviewNotes: input.reviewNotes,
    scoutReports: input.scoutReports,
  });

  if (!hasExpectedDemoUsers(input.demoUsers)) {
    return false;
  }

  if (predictorIds.size !== 2 || input.matches.length === 0) {
    return false;
  }

  if (input.picks.length !== input.matches.length * input.demoUsers.length) {
    return false;
  }

  if (input.scoutReports.length !== input.matches.length * predictorIds.size) {
    return false;
  }

  if (![...roundUserIds].every((userId) => demoUserIds.has(userId))) {
    return false;
  }

  return input.scoutReports.every((report) => predictorIds.has(report.user_id));
}

function normalizeMatchCount(value: number | null | undefined) {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return 13;
  }

  return Math.min(Math.max(Math.floor(value), 1), 20);
}

function normalizeFixtureKeyPart(value: string | null | undefined) {
  return (value ?? "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/[‐‑‒–—―-]/g, "-")
    .trim();
}

function buildFixtureIdentityKey(input: {
  awayTeam: string;
  homeTeam: string;
  matchDate?: string | null;
  venue?: string | null;
}) {
  return [
    input.matchDate ?? "",
    normalizeFixtureKeyPart(input.homeTeam),
    normalizeFixtureKeyPart(input.awayTeam),
    normalizeFixtureKeyPart(input.venue),
  ].join("|");
}

function resolveRoundProductDefaults(input: {
  matchCount?: number | null;
  outcomeSetJson?: string[] | null;
  productType?: ProductType | null;
  requiredMatchCount?: number | null;
  roundSource?: RoundSource | null;
  sourceNote?: string | null;
  voidHandling?: VoidHandling | null;
}) {
  const productType = input.productType ?? "toto13";
  const requiredMatchCount = normalizeRequiredMatchCount(
    productType,
    input.requiredMatchCount ?? input.matchCount,
  );
  const activeMatchCount = normalizeMatchCount(input.matchCount ?? requiredMatchCount ?? 13);
  const outcomeSetJson = normalizeOutcomeSet(productType, input.outcomeSetJson);

  return {
    activeMatchCount,
    outcomeSetJson,
    productType,
    requiredMatchCount,
    roundSource: input.roundSource ?? "user_manual",
    sourceNote: input.sourceNote ?? null,
    voidHandling: input.voidHandling ?? "manual",
  };
}

function placeholderMatches(roundId: string, matchCount?: number | null) {
  return Array.from({ length: normalizeMatchCount(matchCount) }, (_, index) => ({
    round_id: roundId,
    match_no: index + 1,
    home_team: `チーム ${index + 1}A`,
    away_team: `チーム ${index + 1}B`,
    stage: "グループステージ",
  }));
}

function matchFixtureSignature(input: {
  awayTeam: string;
  homeTeam: string;
  kickoffTime?: string | null;
  venue?: string | null;
}) {
  const kickoffDate =
    input.kickoffTime && !Number.isNaN(Date.parse(input.kickoffTime))
      ? new Date(input.kickoffTime).toISOString().slice(0, 16)
      : "";

  return [
    normalizeFixtureKeyPart(input.homeTeam),
    normalizeFixtureKeyPart(input.awayTeam),
    kickoffDate,
    normalizeFixtureKeyPart(input.venue),
  ].join("|");
}

async function deleteRoundCascade(roundId: string) {
  const supabase = requireSupabaseClient();
  await supabase.from("rounds").delete().eq("id", roundId);
}

async function replaceDemoUsers() {
  const supabase = requireSupabaseClient();
  const usersResult = await supabase.from("users").select("*").order("role").order("name");
  throwIfError("Failed to load users for demo setup", usersResult);

  const existingUsers = sortUsers((usersResult.data as UserRow[]).map(mapUser));
  const demoUsers = existingUsers.filter((user) => isDemoAccountName(user.name));

  for (const user of demoUsers) {
    await deleteUserIfInactive(user.id);
  }

  const insertResult = await supabase.from("users").insert(
    defaultDemoUsers.map((user) => ({
      name: user.name,
      role: user.role,
    })),
  );
  throwIfError("Failed to create demo users", insertResult);

  const refreshedUsersResult = await supabase.from("users").select("*").order("role").order("name");
  throwIfError("Failed to reload demo users", refreshedUsersResult);

  return sortUsers(
    (refreshedUsersResult.data as UserRow[])
      .map(mapUser)
      .filter((user) => isDemoAccountName(user.name)),
  );
}

export async function listDashboardData(): Promise<DashboardData> {
  const supabase = requireSupabaseClient();
  const [usersResult, roundsResult, matchesResult, picksResult, reportsResult, notesResult, candidateTicketsResult] =
    await Promise.all([
      supabase.from("users").select("*").order("role").order("name"),
      supabase.from("rounds").select("*").order("created_at", { ascending: false }),
      supabase.from("matches").select("*").order("round_id").order("match_no"),
      supabase.from("picks").select("*"),
      supabase.from("human_scout_reports").select("*"),
      supabase.from("review_notes").select("*"),
      supabase.from("candidate_tickets").select("round_id"),
    ]);

  throwIfError("Failed to load users", usersResult);
  throwIfError("Failed to load rounds", roundsResult);
  throwIfError("Failed to load matches", matchesResult);
  throwIfError("Failed to load picks", picksResult);
  throwIfError("Failed to load scout reports", reportsResult);
  throwIfError("Failed to load review notes", notesResult);
  throwIfError("Failed to load candidate tickets", candidateTicketsResult);

  const allUsers = sortUsers((usersResult.data as UserRow[]).map(mapUser));
  const { demoUsers, liveUsers } = partitionUsers(allUsers);
  const rounds = (roundsResult.data as RoundRow[]).map(mapRound);
  const rawMatches = matchesResult.data as MatchRow[];
  const rawPicks = picksResult.data as PickRow[];
  const rawScoutReports = reportsResult.data as HumanScoutReportRow[];
  const rawReviewNotes = notesResult.data as ReviewNoteRow[];
  const candidateTicketRows =
    (candidateTicketsResult.data as Array<{ round_id: string }>) ?? [];
  const matches = rawMatches.map(mapMatch);
  const matchesByRound = groupByRoundId(matches);
  const rawPicksByRound = new Map<string, PickRow[]>();
  const rawReportsByRound = new Map<string, HumanScoutReportRow[]>();
  const rawNotesByRound = new Map<string, ReviewNoteRow[]>();
  const candidateTicketCountByRound = new Map<string, number>();

  rawPicks.forEach((row) => {
    const current = rawPicksByRound.get(row.round_id) ?? [];
    current.push(row);
    rawPicksByRound.set(row.round_id, current);
  });
  rawScoutReports.forEach((row) => {
    const current = rawReportsByRound.get(row.round_id) ?? [];
    current.push(row);
    rawReportsByRound.set(row.round_id, current);
  });
  rawReviewNotes.forEach((row) => {
    const current = rawNotesByRound.get(row.round_id) ?? [];
    current.push(row);
    rawNotesByRound.set(row.round_id, current);
  });
  candidateTicketRows.forEach((row) => {
    candidateTicketCountByRound.set(
      row.round_id,
      (candidateTicketCountByRound.get(row.round_id) ?? 0) + 1,
    );
  });

  return {
    demoUsers,
    rounds: rounds.map((round) => {
      const users = resolveUsersForRoundRows({
        allUsers,
        demoUsers,
        liveUsers,
        participantIds: round.participantIds,
        picks: rawPicksByRound.get(round.id) ?? [],
        reviewNotes: rawNotesByRound.get(round.id) ?? [],
        roundTitle: round.title,
        scoutReports: rawReportsByRound.get(round.id) ?? [],
      });
      const picks = resolvePicksForScopedUsers({
        matches: matchesByRound.get(round.id) ?? [],
        rows: filterRowsForScopedUsers(rawPicksByRound.get(round.id) ?? [], users),
        users,
      });
      const userById = new Map(users.map((user) => [user.id, user]));
      const scoutReports = filterRowsForScopedUsers(
        rawReportsByRound.get(round.id) ?? [],
        users,
      ).map((row) => mapScoutReport(row, userById.get(row.user_id)));
      const scopedMatches = applyScopedConsensus(
        matchesByRound.get(round.id) ?? [],
        scoutReports,
      );
      const reviewNotes = filterReviewNotesForScopedUsers(
        rawNotesByRound.get(round.id) ?? [],
        users,
      ).map((row) => mapReviewNote(row, userById.get(row.user_id ?? "")));

      return deriveRoundSummary(
        round,
        candidateTicketCountByRound.get(round.id) ?? 0,
        scopedMatches,
        picks,
        scoutReports,
        reviewNotes,
        users,
      );
    }),
    users: liveUsers,
  };
}

export async function getRoundWorkspace(roundId: string): Promise<RoundWorkspace | null> {
  const supabase = requireSupabaseClient();
  const [
    usersResult,
    roundResult,
    matchesResult,
    picksResult,
    reportsResult,
    ticketsResult,
    evAssumptionResult,
    candidateTicketsResult,
    candidateVotesResult,
    totoOfficialRoundResult,
    totoOfficialMatchesResult,
    notesResult,
  ] =
    await Promise.all([
      supabase.from("users").select("*").order("role").order("name"),
      supabase.from("rounds").select("*").eq("id", roundId).maybeSingle(),
      supabase.from("matches").select("*").eq("round_id", roundId).order("match_no"),
      supabase.from("picks").select("*").eq("round_id", roundId),
      supabase.from("human_scout_reports").select("*").eq("round_id", roundId),
      supabase
        .from("generated_tickets")
        .select("*")
        .eq("round_id", roundId)
        .order("created_at", { ascending: false })
        .order("ticket_score", { ascending: false }),
      supabase.from("round_ev_assumptions").select("*").eq("round_id", roundId).maybeSingle(),
      supabase.from("candidate_tickets").select("*").eq("round_id", roundId).order("created_at"),
      supabase
        .from("candidate_votes")
        .select("*")
        .eq("round_id", roundId)
        .order("updated_at", { ascending: false }),
      supabase.from("toto_official_rounds").select("*").eq("round_id", roundId).maybeSingle(),
      supabase
        .from("toto_official_matches")
        .select("*")
        .eq("round_id", roundId)
        .order("official_match_no"),
      supabase.from("review_notes").select("*").eq("round_id", roundId).order("created_at", {
        ascending: false,
      }),
    ]);

  throwIfError("Failed to load users", usersResult);
  throwIfError("Failed to load round", roundResult);
  throwIfError("Failed to load matches", matchesResult);
  throwIfError("Failed to load picks", picksResult);
  throwIfError("Failed to load scout reports", reportsResult);
  throwIfError("Failed to load generated tickets", ticketsResult);
  throwIfError("Failed to load EV assumptions", evAssumptionResult);
  throwIfError("Failed to load candidate tickets", candidateTicketsResult);
  throwIfError("Failed to load candidate votes", candidateVotesResult);
  throwIfError("Failed to load toto official round", totoOfficialRoundResult);
  throwIfError("Failed to load toto official matches", totoOfficialMatchesResult);
  throwIfError("Failed to load review notes", notesResult);

  if (!roundResult.data) {
    return null;
  }

  const round = mapRound(roundResult.data as RoundRow);
  const allUsers = sortUsers((usersResult.data as UserRow[]).map(mapUser));
  const { demoUsers, liveUsers } = partitionUsers(allUsers);
  const rawPicks = picksResult.data as PickRow[];
  const rawScoutReports = reportsResult.data as HumanScoutReportRow[];
  const rawReviewNotes = notesResult.data as ReviewNoteRow[];
  const users = resolveUsersForRoundRows({
    allUsers,
    demoUsers,
    liveUsers,
    participantIds: round.participantIds,
    picks: rawPicks,
    reviewNotes: rawReviewNotes,
    roundTitle: round.title,
    scoutReports: rawScoutReports,
  });
  const userById = new Map(users.map((user) => [user.id, user]));
  const matches = (matchesResult.data as MatchRow[]).map(mapMatch);
  const matchById = new Map(matches.map((match) => [match.id, match]));
  const picks = resolvePicksForScopedUsers({
    matches,
    rows: filterRowsForScopedUsers(rawPicks, users),
    users,
  });
  const scoutReports = filterRowsForScopedUsers(rawScoutReports, users).map((row) =>
    mapScoutReport(row, userById.get(row.user_id), matchById.get(row.match_id)),
  );
  const scopedMatches = applyScopedConsensus(matches, scoutReports);
  const scopedMatchById = new Map(scopedMatches.map((match) => [match.id, match]));
  const generatedTickets = (ticketsResult.data as GeneratedTicketRow[]).map(
    mapGeneratedTicket,
  );
  const evAssumption = evAssumptionResult.data
    ? mapRoundEvAssumption(evAssumptionResult.data as RoundEvAssumptionRow)
    : null;
  const candidateTickets = (candidateTicketsResult.data as CandidateTicketRow[]).map(
    mapCandidateTicket,
  );
  const candidateVotes = filterRowsForScopedUsers(
    candidateVotesResult.data as CandidateVoteRow[],
    users,
  ).map((row) => mapCandidateVote(row, userById.get(row.user_id)));
  const totoOfficialRound = totoOfficialRoundResult.data
    ? mapTotoOfficialRound(totoOfficialRoundResult.data as TotoOfficialRoundRow)
    : null;
  const totoOfficialMatches = (totoOfficialMatchesResult.data as TotoOfficialMatchRow[]).map(
    mapTotoOfficialMatch,
  );
  const reviewNotes = filterReviewNotesForScopedUsers(rawReviewNotes, users).map((row) =>
    mapReviewNote(row, userById.get(row.user_id ?? ""), scopedMatchById.get(row.match_id ?? "")),
  );

  return {
    availableUsers: isDemoRoundTitle(round.title) ? users : liveUsers,
    users,
    round: {
      ...round,
      matches: scopedMatches,
      picks,
      scoutReports,
      generatedTickets,
      evAssumption,
      candidateTickets,
      candidateVotes,
      totoOfficialRound,
      totoOfficialMatches,
      reviewNotes,
    },
  };
}

export async function createInitialUsers() {
  const supabase = requireSupabaseClient();
  const existingResult = await supabase.from("users").select("*").order("role").order("name");
  throwIfError("Failed to check existing users", existingResult);

  const existingUsers = sortUsers((existingResult.data as UserRow[]).map(mapUser));
  if (partitionUsers(existingUsers).liveUsers.length > 0) {
    return;
  }

  const insertResult = await supabase.from("users").insert(
    defaultInitialUsers.map((user) => ({
      name: user.name,
      role: user.role,
    })),
  );

  throwIfError("Failed to create initial users", insertResult);
}

export async function createUser(input: { name: string; role?: UserRole }) {
  const supabase = requireSupabaseClient();
  const name = input.name.trim();

  if (!name) {
    throw new Error("あだ名を入力してください。");
  }

  const result = await supabase.from("users").insert({
    name,
    role: input.role ?? "member",
  });

  throwIfError("Failed to create user", result);
}

export async function updateUserProfile(input: {
  userId: string;
  name: string;
  role: UserRole;
}) {
  const supabase = requireSupabaseClient();
  const name = input.name.trim();

  if (!name) {
    throw new Error("あだ名を空にはできません。");
  }

  const result = await supabase
    .from("users")
    .update({
      name,
      role: input.role,
    })
    .eq("id", input.userId);

  throwIfError("Failed to update user profile", result);
}

export async function deleteUserIfInactive(userId: string) {
  const supabase = requireSupabaseClient();
  const [picksResult, reportsResult, notesResult, supportRefsResult] = await Promise.all([
    supabase.from("picks").select("id", { count: "exact", head: true }).eq("user_id", userId),
    supabase
      .from("human_scout_reports")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId),
    supabase
      .from("review_notes")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId),
    supabase
      .from("picks")
      .select("id", { count: "exact", head: true })
      .like("note", `[[support:predictor:${userId}]]%`),
  ]);

  throwIfError("Failed to inspect user picks", picksResult);
  throwIfError("Failed to inspect user scout reports", reportsResult);
  throwIfError("Failed to inspect user review notes", notesResult);
  throwIfError("Failed to inspect user support references", supportRefsResult);

  const pickCount = picksResult.count ?? 0;
  const scoutReportCount = reportsResult.count ?? 0;
  const reviewNoteCount = notesResult.count ?? 0;
  const supportRefCount = supportRefsResult.count ?? 0;

  if (pickCount > 0 || scoutReportCount > 0 || reviewNoteCount > 0) {
    throw new Error(
      "このメンバーには入力データがあります。内容を消してからでないと整理できません。",
    );
  }

  if (supportRefCount > 0) {
    throw new Error(
      "このメンバーは支持先として使われています。先に支持先を変えてから整理してください。",
    );
  }

  const result = await supabase.from("users").delete().eq("id", userId);
  throwIfError("Failed to delete user", result);
}

export async function createRound(input: {
  budgetYen: number | null;
  matchCount?: number | null;
  notes: string | null;
  outcomeSetJson?: string[] | null;
  participantIds?: string[];
  productType?: ProductType;
  requiredMatchCount?: number | null;
  roundSource?: RoundSource;
  sourceNote?: string | null;
  status: RoundStatus;
  title: string;
  voidHandling?: VoidHandling;
}) {
  const supabase = requireSupabaseClient();
  const defaults = resolveRoundProductDefaults(input);
  const roundResult = await supabase
    .from("rounds")
    .insert({
      title: input.title,
      status: input.status,
      budget_yen: input.budgetYen,
      notes: encodeRoundParticipantsNote(input.notes, input.participantIds),
      product_type: defaults.productType,
      required_match_count: defaults.requiredMatchCount,
      active_match_count: defaults.activeMatchCount,
      round_source: defaults.roundSource,
      source_note: defaults.sourceNote,
      outcome_set_json: defaults.outcomeSetJson,
      void_handling: defaults.voidHandling,
    })
    .select("*")
    .single();

  throwIfError("Failed to create round", roundResult);

  const round = roundResult.data as RoundRow;
  const matchesResult = await supabase
    .from("matches")
    .insert(placeholderMatches(round.id, defaults.activeMatchCount));

  if (matchesResult.error) {
    await supabase.from("rounds").delete().eq("id", round.id);
    throw new Error(`Failed to create placeholder matches: ${matchesResult.error.message}`);
  }

  return round.id;
}

export async function createDemoRound() {
  const supabase = requireSupabaseClient();
  const existingResult = await supabase
    .from("rounds")
    .select("id")
    .eq("title", demoRoundTitle)
    .order("created_at", { ascending: false })
    .limit(1);

  throwIfError("Failed to check existing demo round", existingResult);

  const existingRoundId = (existingResult.data as Array<{ id: string }>)[0]?.id;
  const usersResult = await supabase.from("users").select("*").order("role").order("name");
  throwIfError("Failed to load users for demo round", usersResult);

  const allUsers = sortUsers((usersResult.data as UserRow[]).map(mapUser));
  let { demoUsers } = partitionUsers(allUsers);

  if (existingRoundId && hasExpectedDemoUsers(demoUsers)) {
    const [matchesResult, picksResult, reportsResult, notesResult] = await Promise.all([
      supabase.from("matches").select("*").eq("round_id", existingRoundId),
      supabase.from("picks").select("*").eq("round_id", existingRoundId),
      supabase.from("human_scout_reports").select("*").eq("round_id", existingRoundId),
      supabase.from("review_notes").select("*").eq("round_id", existingRoundId),
    ]);

    throwIfError("Failed to inspect demo matches", matchesResult);
    throwIfError("Failed to inspect demo picks", picksResult);
    throwIfError("Failed to inspect demo scout reports", reportsResult);
    throwIfError("Failed to inspect demo review notes", notesResult);

    if (
      isValidDemoRound({
        demoUsers,
        matches: matchesResult.data as MatchRow[],
        picks: picksResult.data as PickRow[],
        reviewNotes: notesResult.data as ReviewNoteRow[],
        scoutReports: reportsResult.data as HumanScoutReportRow[],
      })
    ) {
      return existingRoundId;
    }
  }

  if (existingRoundId) {
    await deleteRoundCascade(existingRoundId);
  }

  demoUsers = await replaceDemoUsers();
  if (demoUsers.length === 0) {
    throw new Error("デモ用ユーザーを準備できませんでした。");
  }

  const predictorIds = filterPredictors(demoUsers).map((user) => user.id);

  const roundResult = await supabase
    .from("rounds")
    .insert({
      title: demoRoundTitle,
      status: "reviewed",
      budget_yen: demoTicketSettings.budgetYen,
      notes: demoRoundNotes,
      product_type: "toto13",
      required_match_count: 13,
      active_match_count: 13,
      round_source: "demo_sample",
      source_note: "デモ用サンプルラウンド",
      outcome_set_json: buildProductRule({
        productType: "toto13",
      }).outcomeSetJson,
      void_handling: "manual",
    })
    .select("*")
    .single();

  throwIfError("Failed to create demo round", roundResult);

  const round = roundResult.data as RoundRow;

  try {
    const matchesResult = await supabase
      .from("matches")
      .insert(buildDemoMatchRows(round.id))
      .select("*")
      .order("match_no");

    throwIfError("Failed to create demo matches", matchesResult);

    const matches = (matchesResult.data as MatchRow[]).map(mapMatch);
    const pickRows = buildDemoPickRows(round.id, matches, demoUsers);
    const scoutRows = buildDemoScoutReportRows(
      round.id,
      matches,
      predictorIds.length > 0 ? predictorIds : [demoUsers[0].id],
    );

    const [picksResult, reportsResult] = await Promise.all([
      supabase.from("picks").insert(pickRows),
      supabase.from("human_scout_reports").insert(scoutRows),
    ]);

    throwIfError("Failed to create demo picks", picksResult);
    throwIfError("Failed to create demo scout reports", reportsResult);

    const scoutRowsByMatch = new Map<string, typeof scoutRows>();
    scoutRows.forEach((report) => {
      const current = scoutRowsByMatch.get(report.match_id) ?? [];
      current.push(report);
      scoutRowsByMatch.set(report.match_id, current);
    });

    const consensusUpdates = matches.map((match) => {
      const reports = scoutRowsByMatch.get(match.id) ?? [];
      const summary = computeConsensus(
        reports.map((report) => ({
          directionScoreF: report.direction_score_f,
          drawAlert: report.draw_alert,
          exceptionFlag: report.exception_flag,
          noteAvailability: report.note_availability,
          noteConditions: report.note_conditions,
          noteDrawAlert: report.note_draw_alert,
          noteMicro: report.note_micro,
          noteStrengthForm: report.note_strength_form,
          noteTacticalMatchup: report.note_tactical_matchup,
        })),
      );

      return {
        id: match.id,
        round_id: round.id,
        consensus_f: summary.avgF,
        consensus_d: summary.avgD,
        consensus_call: summary.consensusCall,
        disagreement_score: summary.disagreementScore,
        exception_count: summary.exceptionCount,
      };
    });

    const consensusResults = await Promise.all(
      consensusUpdates.map((entry) =>
        supabase
          .from("matches")
          .update({
            consensus_f: entry.consensus_f,
            consensus_d: entry.consensus_d,
            consensus_call: entry.consensus_call,
            disagreement_score: entry.disagreement_score,
            exception_count: entry.exception_count,
          })
          .eq("id", entry.id)
          .eq("round_id", round.id),
      ),
    );
    consensusResults.forEach((result) => throwIfError("Failed to save demo consensus", result));

    const workspace = await getRoundWorkspace(round.id);
    if (workspace) {
      const allTickets = generateAllModeTickets(
        {
          matches: workspace.round.matches,
          picks: workspace.round.picks,
          users: workspace.users,
        },
        demoTicketSettings,
      );
      const maxTickets = Math.min(
        Math.max(Math.floor(demoTicketSettings.budgetYen / 100), 1),
        8,
      );
      const ticketRows = (["conservative", "balanced", "upset"] as const).flatMap((mode) =>
        allTickets[mode].slice(0, maxTickets).map((ticket) => ({
          round_id: round.id,
          mode,
          ticket_json: JSON.stringify({
            ...ticket,
            settings: demoTicketSettings,
          }),
          ticket_score: ticket.ticketScore,
          estimated_hit_prob: ticket.estimatedHitProb,
          contrarian_score: ticket.contrarianScore,
        })),
      );

      if (ticketRows.length > 0) {
        const ticketsResult = await supabase.from("generated_tickets").insert(ticketRows);
        throwIfError("Failed to save demo tickets", ticketsResult);
      }
    }

    const notesResult = await supabase
      .from("review_notes")
      .insert(buildDemoReviewNotes(round.id, matches, demoUsers));

    throwIfError("Failed to save demo review notes", notesResult);

    return round.id;
  } catch (error) {
    await deleteRoundCascade(round.id);
    throw error;
  }
}

export async function updateRound(input: {
  roundId: string;
  budgetYen: number | null;
  notes: string | null;
  outcomeSetJson?: string[] | null;
  participantIds?: string[];
  productType?: ProductType;
  requiredMatchCount?: number | null;
  roundSource?: RoundSource;
  sourceNote?: string | null;
  status: RoundStatus;
  title: string;
  voidHandling?: VoidHandling;
}) {
  const supabase = requireSupabaseClient();
  const currentRoundResult = await supabase
    .from("rounds")
    .select("*")
    .eq("id", input.roundId)
    .maybeSingle();

  throwIfError("Failed to load round before update", currentRoundResult);

  if (!currentRoundResult.data) {
    throw new Error("更新対象のラウンドが見つかりません。");
  }

  const currentRound = mapRound(currentRoundResult.data as RoundRow);
  const nextRule = resolveRoundProductDefaults({
    matchCount: currentRound.activeMatchCount,
    outcomeSetJson: input.outcomeSetJson ?? currentRound.outcomeSetJson,
    productType: input.productType ?? currentRound.productType,
    requiredMatchCount: input.requiredMatchCount ?? currentRound.requiredMatchCount,
    roundSource: input.roundSource ?? currentRound.roundSource,
    sourceNote: input.sourceNote ?? currentRound.sourceNote,
    voidHandling: input.voidHandling ?? currentRound.voidHandling,
  });
  const result = await supabase
    .from("rounds")
    .update({
      title: input.title,
      status: input.status,
      budget_yen: input.budgetYen,
      notes: encodeRoundParticipantsNote(input.notes, input.participantIds),
      product_type: nextRule.productType,
      required_match_count: nextRule.requiredMatchCount,
      active_match_count: currentRound.activeMatchCount ?? nextRule.activeMatchCount,
      round_source: nextRule.roundSource,
      source_note: nextRule.sourceNote,
      outcome_set_json: nextRule.outcomeSetJson,
      void_handling: nextRule.voidHandling,
    })
    .eq("id", input.roundId);

  throwIfError("Failed to update round", result);

  if (
    currentRound.budgetYen !== input.budgetYen ||
    !sameParticipantIds(currentRound.participantIds, input.participantIds) ||
    currentRound.productType !== nextRule.productType ||
    currentRound.requiredMatchCount !== nextRule.requiredMatchCount ||
    currentRound.roundSource !== nextRule.roundSource ||
    currentRound.sourceNote !== nextRule.sourceNote ||
    JSON.stringify(currentRound.outcomeSetJson ?? []) !==
      JSON.stringify(nextRule.outcomeSetJson ?? []) ||
    currentRound.voidHandling !== nextRule.voidHandling
  ) {
    await clearGeneratedTicketsForRound(input.roundId);
  }
}

export async function updateMatch(input: {
  roundId: string;
  matchId: string;
  homeTeam: string;
  awayTeam: string;
  kickoffTime: string | null;
  venue: string | null;
  stage: string | null;
  officialVote1: number | null;
  officialVote0: number | null;
  officialVote2: number | null;
  marketProb1: number | null;
  marketProb0: number | null;
  marketProb2: number | null;
  modelProb1: number | null;
  modelProb0: number | null;
  modelProb2: number | null;
  tacticalNote: string | null;
  injuryNote: string | null;
  motivationNote: string | null;
  adminNote: string | null;
  category: MatchCategory | null;
  confidence: number | null;
  recommendedOutcomes: string | null;
}) {
  const supabase = requireSupabaseClient();
  const result = await supabase
    .from("matches")
    .update({
      home_team: input.homeTeam,
      away_team: input.awayTeam,
      kickoff_time: input.kickoffTime,
      venue: input.venue,
      stage: input.stage,
      official_vote_1: input.officialVote1,
      official_vote_0: input.officialVote0,
      official_vote_2: input.officialVote2,
      market_prob_1: input.marketProb1,
      market_prob_0: input.marketProb0,
      market_prob_2: input.marketProb2,
      model_prob_1: input.modelProb1,
      model_prob_0: input.modelProb0,
      model_prob_2: input.modelProb2,
      tactical_note: input.tacticalNote,
      injury_note: input.injuryNote,
      motivation_note: input.motivationNote,
      admin_note: input.adminNote,
      category: input.category,
      confidence: input.confidence,
      recommended_outcomes: input.recommendedOutcomes,
    })
    .eq("id", input.matchId)
    .eq("round_id", input.roundId);

  throwIfError("Failed to update match", result);
  await clearGeneratedTicketsForRound(input.roundId);
}

export async function bulkUpdateRoundMatches(input: {
  roundId: string;
  rows: Array<{
    adminNote: string | null;
    awayTeam: string;
    homeTeam: string;
    kickoffTime: string | null;
    matchNo: number;
    stage: string | null;
    venue: string | null;
  }>;
}) {
  const supabase = requireSupabaseClient();
  const matchesResult = await supabase
    .from("matches")
    .select("id, match_no, home_team, away_team, kickoff_time, venue, stage, admin_note")
    .eq("round_id", input.roundId);

  throwIfError("Failed to load matches for bulk update", matchesResult);

  const existingByMatchNo = new Map(
    ((matchesResult.data as Array<{
      admin_note: string | null;
      away_team: string;
      home_team: string;
      id: string;
      kickoff_time: string | null;
      match_no: number;
      stage: string | null;
      venue: string | null;
    }>) ?? []).map((row) => [row.match_no, row]),
  );

  const results = await Promise.all(
    input.rows.map((row) => {
      const current = existingByMatchNo.get(row.matchNo);
      if (!current) {
        throw new Error(`第${row.matchNo}試合が見つかりませんでした。`);
      }

      return supabase
        .from("matches")
        .update({
          home_team: row.homeTeam,
          away_team: row.awayTeam,
          kickoff_time: row.kickoffTime ?? current.kickoff_time,
          venue: row.venue ?? current.venue,
          stage: row.stage ?? current.stage,
          admin_note: row.adminNote ?? current.admin_note,
        })
        .eq("id", current.id)
        .eq("round_id", input.roundId);
    }),
  );

  results.forEach((result) => throwIfError("Failed to bulk update matches", result));
  await clearGeneratedTicketsForRound(input.roundId);
}

export async function estimateRoundAiModel(input: {
  overwriteExisting?: boolean;
  roundId: string;
}) {
  const supabase = requireSupabaseClient();
  const matchesResult = await supabase.from("matches").select("*").eq("round_id", input.roundId);

  throwIfError("Failed to load matches for AI estimation", matchesResult);

  const matches = (matchesResult.data as MatchRow[]).map(mapMatch);
  const targetMatches = matches.filter((match) => {
    const hasExistingModel =
      match.modelProb1 !== null || match.modelProb0 !== null || match.modelProb2 !== null;

    if (hasExistingModel && !input.overwriteExisting) {
      return false;
    }

    return canEstimateAiModel(match);
  });

  const updates = targetMatches
    .map((match) => {
      const estimated = estimateAiModel(match);
      if (!estimated) {
        return null;
      }

      return {
        matchId: match.id,
        estimated,
      };
    })
    .filter(
      (
        entry,
      ): entry is {
        estimated: NonNullable<ReturnType<typeof estimateAiModel>>;
        matchId: string;
      } => entry !== null,
    );

  const results = await Promise.all(
    updates.map((entry) =>
      supabase
        .from("matches")
        .update({
          model_prob_1: entry.estimated.modelProb1,
          model_prob_0: entry.estimated.modelProb0,
          model_prob_2: entry.estimated.modelProb2,
          recommended_outcomes: entry.estimated.recommendedOutcomes,
        })
        .eq("id", entry.matchId)
        .eq("round_id", input.roundId),
    ),
  );

  results.forEach((result) => throwIfError("Failed to save estimated AI model", result));
  await clearGeneratedTicketsForRound(input.roundId);

  return {
    skippedCount: matches.length - updates.length,
    updatedCount: updates.length,
  };
}

export async function replacePicks(input: {
  roundId: string;
  userId: string;
  picks: Array<{
    matchId: string;
    note: string | null;
    pick: Outcome | null;
    support?: PickSupport;
  }>;
}) {
  const supabase = requireSupabaseClient();
  const deleteResult = await supabase
    .from("picks")
    .delete()
    .eq("round_id", input.roundId)
    .eq("user_id", input.userId);

  throwIfError("Failed to replace picks", deleteResult);

  const rows = input.picks
    .filter((entry) => entry.pick !== null)
    .map((entry) => ({
      round_id: input.roundId,
      user_id: input.userId,
      match_id: entry.matchId,
      pick: entry.pick,
      note: encodePickSupportNote(entry.note, entry.support ?? { kind: "manual" }),
    }));

  if (rows.length === 0) {
    await clearGeneratedTicketsForRound(input.roundId);
    return;
  }

  const insertResult = await supabase.from("picks").insert(rows);
  throwIfError("Failed to save picks", insertResult);
  await clearGeneratedTicketsForRound(input.roundId);
}

export async function replaceScoutReports(input: {
  roundId: string;
  userId: string;
  reports: Array<{
    matchId: string;
    scoreStrengthForm: number;
    noteStrengthForm: string | null;
    scoreAvailability: number;
    noteAvailability: string | null;
    scoreConditions: number;
    noteConditions: string | null;
    scoreTacticalMatchup: number;
    noteTacticalMatchup: string | null;
    scoreMicro: number;
    noteMicro: string | null;
    drawAlert: number;
    noteDrawAlert: string | null;
    directionScoreF: number;
    provisionalCall: ProvisionalCall;
    exceptionFlag: boolean;
    exceptionNote: string | null;
  }>;
}) {
  const supabase = requireSupabaseClient();
  const deleteResult = await supabase
    .from("human_scout_reports")
    .delete()
    .eq("round_id", input.roundId)
    .eq("user_id", input.userId);

  throwIfError("Failed to replace scout reports", deleteResult);

  const rows = input.reports.map((report) => ({
    round_id: input.roundId,
    user_id: input.userId,
    match_id: report.matchId,
    score_strength_form: report.scoreStrengthForm,
    note_strength_form: report.noteStrengthForm,
    score_availability: report.scoreAvailability,
    note_availability: report.noteAvailability,
    score_conditions: report.scoreConditions,
    note_conditions: report.noteConditions,
    score_tactical_matchup: report.scoreTacticalMatchup,
    note_tactical_matchup: report.noteTacticalMatchup,
    score_micro: report.scoreMicro,
    note_micro: report.noteMicro,
    draw_alert: report.drawAlert,
    note_draw_alert: report.noteDrawAlert,
    direction_score_f: report.directionScoreF,
    provisional_call: report.provisionalCall,
    exception_flag: report.exceptionFlag,
    exception_note: report.exceptionNote,
  }));

  if (rows.length > 0) {
    const insertResult = await supabase.from("human_scout_reports").insert(rows);
    throwIfError("Failed to save scout reports", insertResult);
  }

  const workspace = await getRoundWorkspace(input.roundId);

  if (!workspace) {
    return;
  }

  const reportsByMatch = new Map<string, HumanScoutReport[]>();
  for (const report of workspace.round.scoutReports) {
    if (!isPredictorRole(report.user?.role ?? "member")) {
      continue;
    }

    const current = reportsByMatch.get(report.matchId) ?? [];
    current.push(report);
    reportsByMatch.set(report.matchId, current);
  }

  const updates = workspace.round.matches.map((match) => {
    const reports = reportsByMatch.get(match.id) ?? [];

    if (reports.length === 0) {
      return {
        id: match.id,
        round_id: input.roundId,
        consensus_f: null,
        consensus_d: null,
        consensus_call: null,
        disagreement_score: null,
        exception_count: null,
      };
    }

    const summary = computeConsensus(reports);

    return {
      id: match.id,
      round_id: input.roundId,
      consensus_f: summary.avgF,
      consensus_d: summary.avgD,
      consensus_call: summary.consensusCall,
      disagreement_score: summary.disagreementScore,
      exception_count: summary.exceptionCount,
    };
  });

  const updateResult = await supabase.from("matches").upsert(updates, {
    onConflict: "id",
  });
  throwIfError("Failed to update consensus fields", updateResult);
  await clearGeneratedTicketsForRound(input.roundId);
}

export async function replaceGeneratedTickets(input: {
  roundId: string;
  budgetYen: number;
  tickets: Array<{
    mode: TicketMode;
    ticketJson: string;
    ticketScore: number;
    estimatedHitProb: number;
    contrarianScore: number;
  }>;
}) {
  const supabase = requireSupabaseClient();
  const [roundResult, deleteResult] = await Promise.all([
    supabase
      .from("rounds")
      .update({
        budget_yen: input.budgetYen,
      })
      .eq("id", input.roundId),
    supabase.from("generated_tickets").delete().eq("round_id", input.roundId),
  ]);

  throwIfError("Failed to update round budget", roundResult);
  throwIfError("Failed to clear generated tickets", deleteResult);

  if (input.tickets.length === 0) {
    return;
  }

  const insertResult = await supabase.from("generated_tickets").insert(
    input.tickets.map((ticket) => ({
      round_id: input.roundId,
      mode: ticket.mode,
      ticket_json: ticket.ticketJson,
      ticket_score: ticket.ticketScore,
      estimated_hit_prob: ticket.estimatedHitProb,
      contrarian_score: ticket.contrarianScore,
    })),
  );

  throwIfError("Failed to save generated tickets", insertResult);
}

type FixtureMasterWriteInput = {
  awayTeam: string;
  city: string | null;
  competition: string;
  country: string | null;
  dataConfidence: FixtureDataConfidence;
  externalFixtureId: string | null;
  groupName: string | null;
  homeTeam: string;
  kickoffTime: string | null;
  matchDate: string | null;
  source: FixtureSource;
  sourceText: string | null;
  sourceUrl: string | null;
  stage: string | null;
  timezone: string | null;
  venue: string | null;
};

type SyncRoundMatchInput = {
  actualResult?: Outcome | null;
  awayTeam: string;
  fixtureMasterId?: string | null;
  homeTeam: string;
  kickoffTime?: string | null;
  matchNo?: number | null;
  officialMatchNo?: number | null;
  officialVote0?: number | null;
  officialVote1?: number | null;
  officialVote2?: number | null;
  stage?: string | null;
  venue?: string | null;
};

function isSameRoundMatch(input: {
  current: MatchRow;
  next: SyncRoundMatchInput;
}) {
  if (input.next.fixtureMasterId && input.current.fixture_master_id === input.next.fixtureMasterId) {
    return true;
  }

  return (
    matchFixtureSignature({
      awayTeam: input.current.away_team,
      homeTeam: input.current.home_team,
      kickoffTime: input.current.kickoff_time,
      venue: input.current.venue,
    }) ===
    matchFixtureSignature({
      awayTeam: input.next.awayTeam,
      homeTeam: input.next.homeTeam,
      kickoffTime: input.next.kickoffTime,
      venue: input.next.venue,
    })
  );
}

async function syncRoundMatches(input: {
  roundId: string;
  rows: SyncRoundMatchInput[];
}) {
  const supabase = requireSupabaseClient();
  const matchesResult = await supabase
    .from("matches")
    .select("*")
    .eq("round_id", input.roundId)
    .order("match_no");

  throwIfError("Failed to load round matches for sync", matchesResult);

  const existing = (matchesResult.data as MatchRow[]) ?? [];

  for (const [index, row] of input.rows.entries()) {
    const matchNo = row.matchNo ?? index + 1;
    const current = existing[index];
    const payload = {
      round_id: input.roundId,
      match_no: matchNo,
      fixture_master_id: row.fixtureMasterId ?? null,
      official_match_no: row.officialMatchNo ?? null,
      home_team: row.homeTeam,
      away_team: row.awayTeam,
      kickoff_time: row.kickoffTime ?? null,
      venue: row.venue ?? null,
      stage: row.stage ?? null,
      official_vote_1: row.officialVote1 ?? null,
      official_vote_0: row.officialVote0 ?? null,
      official_vote_2: row.officialVote2 ?? null,
      actual_result: row.actualResult ?? null,
    };

    if (!current) {
      const insertResult = await supabase.from("matches").insert(payload);
      throwIfError("Failed to insert round match", insertResult);
      continue;
    }

    if (isSameRoundMatch({ current, next: row })) {
      const updateResult = await supabase
        .from("matches")
        .update(payload)
        .eq("id", current.id)
        .eq("round_id", input.roundId);
      throwIfError("Failed to update round match", updateResult);
      continue;
    }

    const deleteResult = await supabase
      .from("matches")
      .delete()
      .eq("id", current.id)
      .eq("round_id", input.roundId);
    throwIfError("Failed to replace outdated round match", deleteResult);

    const insertResult = await supabase.from("matches").insert(payload);
    throwIfError("Failed to insert replacement round match", insertResult);
  }

  const staleMatches = existing.slice(input.rows.length);
  if (staleMatches.length > 0) {
    const deleteResult = await supabase
      .from("matches")
      .delete()
      .in(
        "id",
        staleMatches.map((match) => match.id),
      );
    throwIfError("Failed to clear removed round matches", deleteResult);
  }

  const roundResult = await supabase
    .from("rounds")
    .update({
      active_match_count: input.rows.length,
    })
    .eq("id", input.roundId);
  throwIfError("Failed to update active match count", roundResult);
}

export async function listFixtureMaster(input?: {
  competition?: string | null;
  dataConfidence?: FixtureDataConfidence | null;
  dateFrom?: string | null;
  dateTo?: string | null;
  groupName?: string | null;
  source?: FixtureSource | null;
  stage?: string | null;
  teamQuery?: string | null;
  venueQuery?: string | null;
}) {
  const supabase = requireSupabaseClient();
  let query = supabase
    .from("fixture_master")
    .select("*")
    .order("match_date")
    .order("kickoff_time", { ascending: true });

  if (input?.competition) {
    query = query.eq("competition", input.competition);
  }

  if (input?.source) {
    query = query.eq("source", input.source);
  }

  if (input?.dataConfidence) {
    query = query.eq("data_confidence", input.dataConfidence);
  }

  if (input?.dateFrom) {
    query = query.gte("match_date", input.dateFrom);
  }

  if (input?.dateTo) {
    query = query.lte("match_date", input.dateTo);
  }

  const result = await query;
  throwIfError("Failed to load fixture master", result);

  const fixtures = ((result.data as FixtureMasterRow[]) ?? []).map(mapFixtureMaster);
  const teamNeedle = normalizeFixtureKeyPart(input?.teamQuery);
  const venueNeedle = normalizeFixtureKeyPart(input?.venueQuery);
  const groupNeedle = normalizeFixtureKeyPart(input?.groupName);
  const stageNeedle = normalizeFixtureKeyPart(input?.stage);

  return fixtures.filter((fixture) => {
    const teamMatch =
      !teamNeedle ||
      normalizeFixtureKeyPart(`${fixture.homeTeam} ${fixture.awayTeam}`).includes(teamNeedle);
    const venueMatch =
      !venueNeedle || normalizeFixtureKeyPart(fixture.venue).includes(venueNeedle);
    const groupMatch =
      !groupNeedle || normalizeFixtureKeyPart(fixture.groupName).includes(groupNeedle);
    const stageMatch =
      !stageNeedle || normalizeFixtureKeyPart(fixture.stage).includes(stageNeedle);

    return teamMatch && venueMatch && groupMatch && stageMatch;
  });
}

export async function saveFixtureMasterEntries(input: {
  entries: FixtureMasterWriteInput[];
}) {
  const supabase = requireSupabaseClient();
  if (input.entries.length === 0) {
    return {
      insertedCount: 0,
      skippedCount: 0,
      updatedCount: 0,
      warnings: ["保存対象の試合がありません。"],
    };
  }

  const competitions = Array.from(new Set(input.entries.map((entry) => entry.competition)));
  let existingQuery = supabase.from("fixture_master").select("*");
  existingQuery =
    competitions.length === 1
      ? existingQuery.eq("competition", competitions[0])
      : existingQuery.in("competition", competitions);
  const existingResult = await existingQuery;
  throwIfError("Failed to load existing fixture master entries", existingResult);

  const existingRows = ((existingResult.data as FixtureMasterRow[]) ?? []).map(mapFixtureMaster);
  const byExternalId = new Map<string, FixtureMaster>();
  const byIdentity = new Map<string, FixtureMaster>();
  existingRows.forEach((row) => {
    if (row.externalFixtureId) {
      byExternalId.set(`${row.source}:${row.externalFixtureId}`, row);
    }

    byIdentity.set(
      buildFixtureIdentityKey({
        awayTeam: row.awayTeam,
        homeTeam: row.homeTeam,
        matchDate: row.matchDate,
        venue: row.venue,
      }),
      row,
    );
  });

  const warnings: string[] = [];
  const seenBatchKeys = new Set<string>();
  let insertedCount = 0;
  let updatedCount = 0;
  let skippedCount = 0;

  for (const entry of input.entries) {
    const identityKey = buildFixtureIdentityKey(entry);
    const externalKey = entry.externalFixtureId ? `${entry.source}:${entry.externalFixtureId}` : null;
    const batchKey = externalKey ?? `${entry.competition}|${identityKey}`;

    if (seenBatchKeys.has(batchKey)) {
      skippedCount += 1;
      warnings.push(`${entry.homeTeam} vs ${entry.awayTeam} は貼り付け内で重複したためスキップしました。`);
      continue;
    }

    seenBatchKeys.add(batchKey);

    const existing =
      (externalKey ? byExternalId.get(externalKey) : null) ??
      byIdentity.get(identityKey) ??
      null;

    const payload = {
      competition: entry.competition,
      source: entry.source,
      source_url: entry.sourceUrl,
      source_text: entry.sourceText,
      external_fixture_id: entry.externalFixtureId,
      match_date: entry.matchDate,
      kickoff_time: entry.kickoffTime,
      timezone: entry.timezone,
      home_team: entry.homeTeam,
      away_team: entry.awayTeam,
      group_name: entry.groupName,
      stage: entry.stage,
      venue: entry.venue,
      city: entry.city,
      country: entry.country,
      data_confidence: entry.dataConfidence,
    };

    if (existing) {
      const updateResult = await supabase
        .from("fixture_master")
        .update(payload)
        .eq("id", existing.id);
      throwIfError("Failed to update fixture master entry", updateResult);
      updatedCount += 1;
      continue;
    }

    const insertResult = await supabase.from("fixture_master").insert(payload);
    throwIfError("Failed to insert fixture master entry", insertResult);
    insertedCount += 1;
  }

  return {
    insertedCount,
    skippedCount,
    updatedCount,
    warnings,
  };
}

export async function createRoundFromFixtures(input: {
  budgetYen: number | null;
  fixtureIds: string[];
  notes: string | null;
  outcomeSetJson?: string[] | null;
  participantIds?: string[];
  productType: ProductType;
  requiredMatchCount?: number | null;
  roundId?: string | null;
  sourceNote?: string | null;
  status: RoundStatus;
  title: string;
  voidHandling?: VoidHandling;
}) {
  const supabase = requireSupabaseClient();
  const fixtureResult = await supabase
    .from("fixture_master")
    .select("*")
    .in("id", input.fixtureIds);

  throwIfError("Failed to load selected fixtures", fixtureResult);

  const fixturesById = new Map(
    (((fixtureResult.data as FixtureMasterRow[]) ?? []).map(mapFixtureMaster)).map((fixture) => [
      fixture.id,
      fixture,
    ]),
  );
  const fixtures = input.fixtureIds
    .map((fixtureId) => fixturesById.get(fixtureId))
    .filter((fixture): fixture is FixtureMaster => Boolean(fixture));

  if (fixtures.length === 0) {
    throw new Error("Round に使う試合を1つ以上選んでください。");
  }

  const roundId =
    input.roundId ??
    (await createRound({
      title: input.title,
      status: input.status,
      budgetYen: input.budgetYen,
      matchCount: fixtures.length,
      notes: input.notes,
      outcomeSetJson: input.outcomeSetJson,
      participantIds: input.participantIds,
      productType: input.productType,
      requiredMatchCount: input.requiredMatchCount ?? fixtures.length,
      roundSource: "fixture_master",
      sourceNote: input.sourceNote,
      voidHandling: input.voidHandling,
    }));

  await syncRoundMatches({
    roundId,
    rows: fixtures.map((fixture, index) => ({
      awayTeam: fixture.awayTeam,
      fixtureMasterId: fixture.id,
      homeTeam: fixture.homeTeam,
      kickoffTime: fixture.kickoffTime,
      matchNo: index + 1,
      officialMatchNo: null,
      stage: fixture.stage ?? fixture.groupName,
      venue: fixture.venue,
    })),
  });

  const roundRule = resolveRoundProductDefaults({
    matchCount: fixtures.length,
    outcomeSetJson: input.outcomeSetJson,
    productType: input.productType,
    requiredMatchCount: input.requiredMatchCount ?? fixtures.length,
    roundSource: "fixture_master",
    sourceNote: input.sourceNote,
    voidHandling: input.voidHandling,
  });

  const roundUpdate = await supabase
    .from("rounds")
    .update({
      title: input.title,
      status: input.status,
      budget_yen: input.budgetYen,
      notes: encodeRoundParticipantsNote(input.notes, input.participantIds),
      product_type: roundRule.productType,
      required_match_count: roundRule.requiredMatchCount,
      active_match_count: fixtures.length,
      round_source: roundRule.roundSource,
      source_note: roundRule.sourceNote,
      outcome_set_json: roundRule.outcomeSetJson,
      void_handling: roundRule.voidHandling,
    })
    .eq("id", roundId);
  throwIfError("Failed to update round from selected fixtures", roundUpdate);
  await clearGeneratedTicketsForRound(roundId);

  return roundId;
}

function buildTotoOfficialRoundLibraryPayload(
  input: Omit<TotoOfficialRoundImportInput, "participantIds" | "roundId" | "status">,
) {
  const defaults = resolveRoundProductDefaults({
    matchCount: input.rows.length,
    outcomeSetJson: input.outcomeSetJson,
    productType: input.productType,
    requiredMatchCount: input.requiredMatchCount ?? input.rows.length,
    roundSource: "toto_official_manual",
    sourceNote: input.sourceNote ?? input.officialRoundName,
    voidHandling: input.voidHandling,
  });

  return {
    title: input.title ?? input.officialRoundName ?? "公式対象回",
    notes: input.notes,
    product_type: defaults.productType,
    required_match_count: defaults.requiredMatchCount,
    outcome_set_json: defaults.outcomeSetJson,
    source_note: defaults.sourceNote,
    void_handling: defaults.voidHandling,
    official_round_name: input.officialRoundName,
    official_round_number: input.officialRoundNumber,
    sales_start_at: input.salesStartAt,
    sales_end_at: input.salesEndAt,
    result_status: input.resultStatus,
    stake_yen: input.stakeYen,
    total_sales_yen: input.totalSalesYen,
    return_rate: input.returnRate,
    first_prize_share: input.firstPrizeShare,
    carryover_yen: input.carryoverYen,
    payout_cap_yen: input.payoutCapYen,
    source_url: input.sourceUrl,
    source_text: input.sourceText,
    matches_json: input.rows.map((row) => mapTotoOfficialRoundLibraryMatch(row)),
  };
}

async function getTotoOfficialRoundLibraryEntry(entryId: string) {
  const supabase = requireSupabaseClient();
  const result = await supabase
    .from("toto_official_round_library")
    .select("*")
    .eq("id", entryId)
    .maybeSingle();

  throwIfError("Failed to load toto official round library entry", result);

  if (!result.data) {
    return null;
  }

  return mapTotoOfficialRoundLibraryEntry(result.data as TotoOfficialRoundLibraryRow);
}

export async function listTotoOfficialRoundLibrary(input?: {
  productType?: ProductType | null;
  resultStatus?: TotoOfficialResultStatus | null;
  searchQuery?: string | null;
}) {
  const supabase = requireSupabaseClient();
  let query = supabase
    .from("toto_official_round_library")
    .select("*")
    .order("official_round_number", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false });

  if (input?.productType) {
    query = query.eq("product_type", input.productType);
  }

  if (input?.resultStatus) {
    query = query.eq("result_status", input.resultStatus);
  }

  const result = await query;
  throwIfError("Failed to load toto official round library", result);

  const entries = ((result.data as TotoOfficialRoundLibraryRow[]) ?? []).map(
    mapTotoOfficialRoundLibraryEntry,
  );
  const searchNeedle = normalizeFixtureKeyPart(input?.searchQuery);

  if (!searchNeedle) {
    return entries;
  }

  return entries.filter((entry) =>
    [
      entry.title,
      entry.officialRoundName,
      entry.sourceNote,
      entry.sourceText,
      entry.sourceUrl,
    ]
      .map((value) => normalizeFixtureKeyPart(value))
      .some((value) => value.includes(searchNeedle)),
  );
}

export async function saveTotoOfficialRoundLibraryEntry(
  input: TotoOfficialRoundImportInput & {
    id?: string | null;
  },
) {
  const supabase = requireSupabaseClient();
  if (input.rows.length === 0) {
    throw new Error("公式対象試合を1件以上取り込んでください。");
  }

  const payload = buildTotoOfficialRoundLibraryPayload(input);
  const result = input.id
    ? await supabase
        .from("toto_official_round_library")
        .update(payload)
        .eq("id", input.id)
        .select("*")
        .single()
    : await supabase.from("toto_official_round_library").insert(payload).select("*").single();

  throwIfError("Failed to save toto official round library entry", result);

  return mapTotoOfficialRoundLibraryEntry(result.data as TotoOfficialRoundLibraryRow);
}

export async function instantiateTotoOfficialRoundLibraryEntry(input: {
  entryId: string;
  notes?: string | null;
  participantIds?: string[];
  roundId?: string | null;
  sourceNote?: string | null;
  status?: RoundStatus;
  title?: string | null;
}) {
  const entry = await getTotoOfficialRoundLibraryEntry(input.entryId);
  if (!entry) {
    throw new Error("指定した公式対象回ライブラリが見つかりません。");
  }

  return saveTotoOfficialRoundImport({
    carryoverYen: entry.carryoverYen,
    firstPrizeShare: entry.firstPrizeShare,
    notes: input.notes ?? entry.notes,
    officialRoundName: entry.officialRoundName,
    officialRoundNumber: entry.officialRoundNumber,
    outcomeSetJson: entry.outcomeSetJson,
    participantIds: input.participantIds,
    payoutCapYen: entry.payoutCapYen,
    productType: entry.productType,
    requiredMatchCount: entry.requiredMatchCount ?? entry.matches.length,
    resultStatus: entry.resultStatus,
    returnRate: entry.returnRate,
    roundId: input.roundId,
    rows: entry.matches,
    salesEndAt: entry.salesEndAt,
    salesStartAt: entry.salesStartAt,
    sourceNote: input.sourceNote ?? entry.sourceNote,
    sourceText: entry.sourceText,
    sourceUrl: entry.sourceUrl,
    stakeYen: entry.stakeYen,
    status: input.status,
    title: input.title ?? entry.title,
    totalSalesYen: entry.totalSalesYen,
    voidHandling: entry.voidHandling,
  });
}

export async function saveTotoOfficialRoundImport(input: TotoOfficialRoundImportInput) {
  const supabase = requireSupabaseClient();
  if (input.rows.length === 0) {
    throw new Error("公式対象試合を1件以上取り込んでください。");
  }

  const roundId =
    input.roundId ??
    (await createRound({
      title: input.title ?? input.officialRoundName ?? "公式対象回",
      status: input.status ?? "analyzing",
      budgetYen: null,
      matchCount: input.rows.length,
      notes: input.notes,
      outcomeSetJson: input.outcomeSetJson,
      participantIds: input.participantIds,
      productType: input.productType,
      requiredMatchCount: input.requiredMatchCount ?? input.rows.length,
      roundSource: "toto_official_manual",
      sourceNote: input.sourceNote ?? input.officialRoundName,
      voidHandling: input.voidHandling,
    }));

  const roundRule = resolveRoundProductDefaults({
    matchCount: input.rows.length,
    outcomeSetJson: input.outcomeSetJson,
    productType: input.productType,
    requiredMatchCount: input.requiredMatchCount ?? input.rows.length,
    roundSource: "toto_official_manual",
    sourceNote: input.sourceNote ?? input.officialRoundName,
    voidHandling: input.voidHandling,
  });

  const roundUpdate = await supabase
    .from("rounds")
    .update({
      title: input.title ?? input.officialRoundName ?? "公式対象回",
      status: input.status ?? "analyzing",
      notes: encodeRoundParticipantsNote(input.notes, input.participantIds),
      product_type: roundRule.productType,
      required_match_count: roundRule.requiredMatchCount,
      active_match_count: input.rows.length,
      round_source: roundRule.roundSource,
      source_note: roundRule.sourceNote,
      outcome_set_json: roundRule.outcomeSetJson,
      void_handling: roundRule.voidHandling,
    })
    .eq("id", roundId);
  throwIfError("Failed to update round for official import", roundUpdate);

  const officialRoundResult = await supabase.from("toto_official_rounds").upsert(
    {
      round_id: roundId,
      product_type: input.productType,
      official_round_name: input.officialRoundName,
      official_round_number: input.officialRoundNumber,
      sales_start_at: input.salesStartAt,
      sales_end_at: input.salesEndAt,
      result_status: input.resultStatus,
      stake_yen: input.stakeYen,
      total_sales_yen: input.totalSalesYen,
      return_rate: input.returnRate,
      first_prize_share: input.firstPrizeShare,
      carryover_yen: input.carryoverYen,
      payout_cap_yen: input.payoutCapYen,
      source_url: input.sourceUrl,
      source_text: input.sourceText,
    },
    {
      onConflict: "round_id",
    },
  );
  throwIfError("Failed to save toto official round", officialRoundResult);

  const deleteOfficialMatchesResult = await supabase
    .from("toto_official_matches")
    .delete()
    .eq("round_id", roundId);
  throwIfError("Failed to clear existing toto official matches", deleteOfficialMatchesResult);

  const officialMatchResult = await supabase.from("toto_official_matches").insert(
    input.rows.map((row) => ({
      round_id: roundId,
      match_id: null,
      fixture_master_id: row.fixtureMasterId,
      official_match_no: row.officialMatchNo,
      home_team: row.homeTeam,
      away_team: row.awayTeam,
      kickoff_time: row.kickoffTime,
      venue: row.venue,
      stage: row.stage,
      official_vote_1: row.officialVote1,
      official_vote_0: row.officialVote0,
      official_vote_2: row.officialVote2,
      actual_result: row.actualResult,
      match_status: row.matchStatus,
      source_text: row.sourceText,
    })),
  );
  throwIfError("Failed to save toto official matches", officialMatchResult);

  await syncRoundMatches({
    roundId,
    rows: input.rows.map((row, index) => ({
      actualResult: row.actualResult,
      awayTeam: row.awayTeam,
      fixtureMasterId: row.fixtureMasterId,
      homeTeam: row.homeTeam,
      kickoffTime: row.kickoffTime,
      matchNo: index + 1,
      officialMatchNo: row.officialMatchNo,
      officialVote0: row.officialVote0,
      officialVote1: row.officialVote1,
      officialVote2: row.officialVote2,
      stage: row.stage,
      venue: row.venue,
    })),
  });

  await saveRoundEvAssumption({
    roundId,
    stakeYen: input.stakeYen,
    totalSalesYen: input.totalSalesYen,
    returnRate: input.returnRate,
    firstPrizeShare: input.firstPrizeShare ?? 0.7,
    carryoverYen: input.carryoverYen,
    payoutCapYen: input.payoutCapYen,
    note: input.officialRoundName,
  });
  await clearGeneratedTicketsForRound(roundId);

  return roundId;
}

export async function refreshCandidateTicketsForRound(input: {
  force?: boolean;
  roundId: string;
}) {
  const workspace = await getRoundWorkspace(input.roundId);
  if (!workspace) {
    throw new Error("候補を更新するラウンドが見つかりません。");
  }

  if (
    !input.force &&
    !isCandidateTicketSetStale({
      candidateTickets: workspace.round.candidateTickets,
      evAssumption: workspace.round.evAssumption,
      matches: workspace.round.matches,
      picks: workspace.round.picks,
      scoutReports: workspace.round.scoutReports,
    })
  ) {
    return {
      regenerated: false,
      round: workspace.round,
    };
  }

  const generated = generateCandidateTickets({
    evAssumption: workspace.round.evAssumption,
    matches: workspace.round.matches,
    picks: workspace.round.picks,
    roundTitle: workspace.round.title,
    scoutReports: workspace.round.scoutReports,
    users: workspace.users,
  });

  await replaceCandidateTickets({
    roundId: input.roundId,
    tickets: generated.tickets,
  });

  const refreshed = await getRoundWorkspace(input.roundId);

  return {
    dataQualitySummary: generated.dataQualitySummary,
    regenerated: true,
    round: refreshed?.round ?? workspace.round,
  };
}

export async function saveRoundEvAssumption(input: {
  roundId: string;
  stakeYen: number;
  totalSalesYen: number | null;
  returnRate: number;
  firstPrizeShare: number;
  carryoverYen: number;
  payoutCapYen: number | null;
  note: string | null;
}) {
  const supabase = requireSupabaseClient();
  const result = await supabase.from("round_ev_assumptions").upsert(
    {
      round_id: input.roundId,
      stake_yen: input.stakeYen,
      total_sales_yen: input.totalSalesYen,
      return_rate: input.returnRate,
      first_prize_share: input.firstPrizeShare,
      carryover_yen: input.carryoverYen,
      payout_cap_yen: input.payoutCapYen,
      note: input.note,
    },
    {
      onConflict: "round_id",
    },
  );

  throwIfError("Failed to save EV assumptions", result);
}

export async function replaceCandidateTickets(input: {
  roundId: string;
  tickets: Array<{
    label: string;
    strategyType: CandidateStrategyType;
    picks: Array<{ matchNo: number; pick: "1" | "0" | "2" }>;
    pModelCombo: number | null;
    pPublicCombo: number | null;
    estimatedPayoutYen: number | null;
    grossEvYen: number | null;
    evMultiple: number | null;
    evPercent: number | null;
    proxyScore: number | null;
    hitProbability: number | null;
    publicOverlapScore: number | null;
    contrarianCount: number;
    drawCount: number;
    humanAlignmentScore: number | null;
    dataQuality: CandidateDataQuality;
    rationale: string | null;
    warning: string | null;
  }>;
}) {
  const supabase = requireSupabaseClient();
  const existingResult = await supabase
    .from("candidate_tickets")
    .select("id, label")
    .eq("round_id", input.roundId);

  throwIfError("Failed to load existing candidate tickets", existingResult);

  const nextLabels = new Set(input.tickets.map((ticket) => ticket.label));
  const staleIds = ((existingResult.data as Array<{ id: string; label: string }>) ?? [])
    .filter((row) => !nextLabels.has(row.label))
    .map((row) => row.id);

  if (staleIds.length > 0) {
    const deleteResult = await supabase.from("candidate_tickets").delete().in("id", staleIds);
    throwIfError("Failed to clear removed candidate tickets", deleteResult);
  }

  if (input.tickets.length === 0) {
    return;
  }

  const result = await supabase.from("candidate_tickets").upsert(
    input.tickets.map((ticket) => ({
      round_id: input.roundId,
      label: ticket.label,
      strategy_type: ticket.strategyType,
      picks_json: ticket.picks,
      p_model_combo: ticket.pModelCombo,
      p_public_combo: ticket.pPublicCombo,
      estimated_payout_yen: ticket.estimatedPayoutYen,
      gross_ev_yen: ticket.grossEvYen,
      ev_multiple: ticket.evMultiple,
      ev_percent: ticket.evPercent,
      proxy_score: ticket.proxyScore,
      hit_probability: ticket.hitProbability,
      public_overlap_score: ticket.publicOverlapScore,
      contrarian_count: ticket.contrarianCount,
      draw_count: ticket.drawCount,
      human_alignment_score: ticket.humanAlignmentScore,
      data_quality: ticket.dataQuality,
      rationale: ticket.rationale,
      warning: ticket.warning,
    })),
    {
      onConflict: "round_id,label",
    },
  );

  throwIfError("Failed to save candidate tickets", result);
}

export async function upsertCandidateVote(input: {
  roundId: string;
  candidateTicketId: string;
  userId: string;
  vote: CandidateVoteValue;
  comment: string | null;
}) {
  const supabase = requireSupabaseClient();
  const result = await supabase.from("candidate_votes").upsert(
    {
      round_id: input.roundId,
      candidate_ticket_id: input.candidateTicketId,
      user_id: input.userId,
      vote: input.vote,
      comment: input.comment,
    },
    {
      onConflict: "round_id,candidate_ticket_id,user_id",
    },
  );

  throwIfError("Failed to save candidate vote", result);
}

export async function saveResults(input: {
  roundId: string;
  status: RoundStatus;
  results: Array<{
    actualResult: Outcome | null;
    matchId: string;
  }>;
}) {
  const supabase = requireSupabaseClient();
  const updatePromises = input.results.map((entry) =>
    supabase
      .from("matches")
      .update({
        actual_result: entry.actualResult,
      })
      .eq("id", entry.matchId)
      .eq("round_id", input.roundId),
  );

  const matchResults = await Promise.all(updatePromises);
  matchResults.forEach((result) => throwIfError("Failed to save results", result));

  const roundResult = await supabase
    .from("rounds")
    .update({
      status: input.status,
    })
    .eq("id", input.roundId);

  throwIfError("Failed to update round status", roundResult);
}

export async function addReviewNote(input: {
  roundId: string;
  matchId: string | null;
  userId: string | null;
  note: string;
}) {
  const supabase = requireSupabaseClient();
  const result = await supabase.from("review_notes").insert({
    round_id: input.roundId,
    match_id: input.matchId,
    user_id: input.userId,
    note: input.note,
  });

  throwIfError("Failed to save review note", result);
}
