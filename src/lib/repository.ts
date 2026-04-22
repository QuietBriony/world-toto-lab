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
import {
  buildSupabaseFunctionHeaders,
  requireSupabaseClient,
} from "@/lib/supabase";
import { generateAllModeTickets } from "@/lib/tickets";
import { filterPredictors, isPredictorRole } from "@/lib/users";
import type { BigOfficialSyncPayload } from "@/lib/big-official";
import {
  buildProductRule,
  normalizeOutcomeSet,
  normalizeRequiredMatchCount,
} from "@/lib/product-rules";
import { calculateModelProbabilities } from "@/lib/probability/engine";
import { summarizeRoundReadiness } from "@/lib/probability/readiness";
import {
  inferRoundProbabilityReadiness,
  resolveRoundModeDefaults,
} from "@/lib/round-mode";
import type {
  CandidateDataQuality,
  CandidateStrategyType,
  CandidateTicket,
  CandidateVote,
  CandidateVoteValue,
  CompetitionType,
  DashboardData,
  DashboardRoundSummary,
  DataProfile,
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
  PrimaryUse,
  ProductType,
  ProvisionalCall,
  ProbabilityReadiness,
  ResearchMemo,
  ResearchMemoConfidence,
  ResearchMemoType,
  ReviewNote,
  Round,
  RoundEvAssumption,
  RoundSource,
  RoundStatus,
  RoundWorkspace,
  SportContext,
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
  competition_type: CompetitionType;
  created_at: string;
  data_profile: DataProfile;
  id: string;
  notes: string | null;
  outcome_set_json: string[] | null;
  primary_use: PrimaryUse;
  probability_readiness: ProbabilityReadiness;
  product_type: ProductType;
  required_match_count: number | null;
  round_source: RoundSource;
  source_note: string | null;
  sport_context: SportContext;
  status: RoundStatus;
  title: string;
  updated_at: string;
  void_handling: VoidHandling;
};

type MatchRow = {
  actual_result: Outcome | null;
  admin_note: string | null;
  admin_adjust_0: number | null;
  admin_adjust_1: number | null;
  admin_adjust_2: number | null;
  altitude_humidity_adjust: number | null;
  availability_adjust: number | null;
  availability_info: string | null;
  away_team: string;
  away_strength_adjust: number | null;
  category: MatchCategory | null;
  confidence: number | null;
  consensus_call: string | null;
  consensus_d: number | null;
  consensus_f: number | null;
  conditions_adjust: number | null;
  conditions_info: string | null;
  created_at: string;
  disagreement_score: number | null;
  exception_count: number | null;
  fixture_master_id: string | null;
  group_standing_motivation_adjust: number | null;
  home_team: string;
  home_advantage_adjust: number | null;
  home_strength_adjust: number | null;
  id: string;
  injury_note: string | null;
  injury_suspension_adjust: number | null;
  kickoff_time: string | null;
  league_table_motivation_adjust: number | null;
  market_prob_0: number | null;
  market_prob_1: number | null;
  market_prob_2: number | null;
  match_no: number;
  model_prob_0: number | null;
  model_prob_1: number | null;
  model_prob_2: number | null;
  motivation_adjust: number | null;
  motivation_note: string | null;
  official_match_no: number | null;
  official_vote_0: number | null;
  official_vote_1: number | null;
  official_vote_2: number | null;
  recent_form_note: string | null;
  recommended_outcomes: string | null;
  rest_days_adjust: number | null;
  rotation_risk_adjust: number | null;
  round_id: string;
  squad_depth_adjust: number | null;
  stage: string | null;
  tactical_adjust: number | null;
  tactical_note: string | null;
  tournament_pressure_adjust: number | null;
  travel_adjust: number | null;
  travel_climate_adjust: number | null;
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

type ResearchMemoRow = {
  confidence: ResearchMemoConfidence;
  created_at: string;
  created_by: string;
  id: string;
  match_id: string | null;
  memo_type: ResearchMemoType;
  round_id: string;
  source_date: string | null;
  source_name: string | null;
  source_url: string | null;
  summary: string;
  team: string | null;
  title: string;
  updated_at: string;
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
    competitionType: row.competition_type,
    productType: row.product_type,
    sportContext: row.sport_context,
    primaryUse: row.primary_use,
    requiredMatchCount: row.required_match_count,
    activeMatchCount: row.active_match_count,
    dataProfile: row.data_profile,
    probabilityReadiness: row.probability_readiness,
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
    recentFormNote: row.recent_form_note,
    availabilityInfo: row.availability_info,
    conditionsInfo: row.conditions_info,
    homeStrengthAdjust: row.home_strength_adjust,
    awayStrengthAdjust: row.away_strength_adjust,
    availabilityAdjust: row.availability_adjust,
    conditionsAdjust: row.conditions_adjust,
    tacticalAdjust: row.tactical_adjust,
    motivationAdjust: row.motivation_adjust,
    adminAdjust1: row.admin_adjust_1,
    adminAdjust0: row.admin_adjust_0,
    adminAdjust2: row.admin_adjust_2,
    homeAdvantageAdjust: row.home_advantage_adjust,
    restDaysAdjust: row.rest_days_adjust,
    travelAdjust: row.travel_adjust,
    leagueTableMotivationAdjust: row.league_table_motivation_adjust,
    injurySuspensionAdjust: row.injury_suspension_adjust,
    rotationRiskAdjust: row.rotation_risk_adjust,
    groupStandingMotivationAdjust: row.group_standing_motivation_adjust,
    travelClimateAdjust: row.travel_climate_adjust,
    altitudeHumidityAdjust: row.altitude_humidity_adjust,
    squadDepthAdjust: row.squad_depth_adjust,
    tournamentPressureAdjust: row.tournament_pressure_adjust,
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

function compareIsoDateTimeDesc(left: string | null | undefined, right: string | null | undefined) {
  const leftTime = left ? Date.parse(left) : Number.NEGATIVE_INFINITY;
  const rightTime = right ? Date.parse(right) : Number.NEGATIVE_INFINITY;

  if (Number.isFinite(leftTime) && Number.isFinite(rightTime) && leftTime !== rightTime) {
    return rightTime - leftTime;
  }

  if (Number.isFinite(leftTime) !== Number.isFinite(rightTime)) {
    return Number.isFinite(rightTime) ? 1 : -1;
  }

  return 0;
}

function sortLibraryRowsNewestFirst<T extends { created_at: string; updated_at: string }>(
  rows: T[],
) {
  return rows.slice().sort((left, right) => {
    const updatedDiff = compareIsoDateTimeDesc(left.updated_at, right.updated_at);
    if (updatedDiff !== 0) {
      return updatedDiff;
    }

    const createdDiff = compareIsoDateTimeDesc(left.created_at, right.created_at);
    if (createdDiff !== 0) {
      return createdDiff;
    }

    return 0;
  });
}

function dedupeTotoOfficialRoundLibraryRows(rows: TotoOfficialRoundLibraryRow[]) {
  const uniqueRows = new Map<string, TotoOfficialRoundLibraryRow>();
  const duplicateIdsByKey = new Map<string, string[]>();

  for (const row of sortLibraryRowsNewestFirst(rows)) {
    const identityKey = libraryIdentityMatchKey(row as unknown as SyncedRoundIdentityInput);
    if (!uniqueRows.has(identityKey)) {
      uniqueRows.set(identityKey, row);
      continue;
    }

    const current = duplicateIdsByKey.get(identityKey) ?? [];
    current.push(row.id);
    duplicateIdsByKey.set(identityKey, current);
  }

  return {
    duplicateIdsByKey,
    uniqueRows,
  };
}

const OFFICIAL_LIBRARY_HISTORY_RETAIN_COUNT_PER_PRODUCT = 24;
const OFFICIAL_LIBRARY_ACTIVE_STATUSES = new Set(["draft", "selling", "unknown"]);

function compareNullableNumberDesc(left: number | null | undefined, right: number | null | undefined) {
  const leftValue = Number.isFinite(left ?? Number.NaN) ? (left as number) : Number.NEGATIVE_INFINITY;
  const rightValue = Number.isFinite(right ?? Number.NaN) ? (right as number) : Number.NEGATIVE_INFINITY;

  if (leftValue !== rightValue) {
    return rightValue - leftValue;
  }

  return 0;
}

function sortLibraryRowsForRetention(rows: TotoOfficialRoundLibraryRow[]) {
  return rows.slice().sort((left, right) => {
    const roundDiff = compareNullableNumberDesc(left.official_round_number, right.official_round_number);
    if (roundDiff !== 0) {
      return roundDiff;
    }

    const updatedDiff = compareIsoDateTimeDesc(left.updated_at, right.updated_at);
    if (updatedDiff !== 0) {
      return updatedDiff;
    }

    return compareIsoDateTimeDesc(left.created_at, right.created_at);
  });
}

function isSyncedOfficialRoundLibraryRow(row: TotoOfficialRoundLibraryRow) {
  const sourceUrl = (row.source_url ?? "").toLowerCase();
  const sourceNote = (row.source_note ?? "").toLowerCase();

  return (
    sourceUrl.includes("toto.yahoo.co.jp") ||
    sourceUrl.includes("store.toto-dream.com") ||
    sourceNote.includes("オフィシャル") ||
    sourceNote.includes("yahoo! toto")
  );
}

function collectPrunableOfficialRoundLibraryRowIds(rows: TotoOfficialRoundLibraryRow[]) {
  const idsToDelete = new Set<string>();
  const { duplicateIdsByKey, uniqueRows } = dedupeTotoOfficialRoundLibraryRows(
    rows.filter(isSyncedOfficialRoundLibraryRow),
  );

  duplicateIdsByKey.forEach((duplicateIds) => {
    duplicateIds.forEach((id) => idsToDelete.add(id));
  });

  const rowsByProduct = new Map<string, TotoOfficialRoundLibraryRow[]>();
  Array.from(uniqueRows.values()).forEach((row) => {
    const bucket = rowsByProduct.get(row.product_type) ?? [];
    bucket.push(row);
    rowsByProduct.set(row.product_type, bucket);
  });

  rowsByProduct.forEach((productRows) => {
    const historicalRows = sortLibraryRowsForRetention(
      productRows.filter(
        (row) => !OFFICIAL_LIBRARY_ACTIVE_STATUSES.has(row.result_status ?? "unknown"),
      ),
    );

    historicalRows
      .slice(OFFICIAL_LIBRARY_HISTORY_RETAIN_COUNT_PER_PRODUCT)
      .forEach((row) => idsToDelete.add(row.id));
  });

  return Array.from(idsToDelete);
}

function sortOfficialRoundLibraryEntriesNewestFirst(entries: TotoOfficialRoundLibraryEntry[]) {
  return entries.slice().sort((left, right) => {
    const roundDiff = compareNullableNumberDesc(left.officialRoundNumber, right.officialRoundNumber);
    if (roundDiff !== 0) {
      return roundDiff;
    }

    const salesEndDiff = compareIsoDateTimeDesc(left.salesEndAt, right.salesEndAt);
    if (salesEndDiff !== 0) {
      return salesEndDiff;
    }

    const updatedDiff = compareIsoDateTimeDesc(left.updatedAt, right.updatedAt);
    if (updatedDiff !== 0) {
      return updatedDiff;
    }

    return left.title.localeCompare(right.title, "ja");
  });
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

function mapResearchMemo(row: ResearchMemoRow, user?: User, match?: Match): ResearchMemo {
  return {
    id: row.id,
    roundId: row.round_id,
    matchId: row.match_id,
    team: row.team,
    memoType: row.memo_type,
    title: row.title,
    summary: row.summary,
    sourceUrl: row.source_url,
    sourceName: row.source_name,
    sourceDate: row.source_date,
    confidence: row.confidence,
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
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
  result: { data: unknown; error: { message: string } | Error | null },
) {
  if (result.error) {
    throw new Error(`${label}: ${result.error.message}`);
  }
}

type RelationMissingResult = {
  data: unknown;
  error:
    | {
        message?: string | null;
        code?: string | null;
        details?: string | null;
        hint?: string | null;
      }
    | null;
};

function normalizeRelationMessage(error: RelationMissingResult["error"]) {
  if (!error) {
    return "";
  }

  const message = error.message ?? "";
  const details = (error as { details?: string | null }).details ?? "";
  const hint = (error as { hint?: string | null }).hint ?? "";

  return `${message} ${details} ${hint}`.toLowerCase();
}

function isMissingRelationError(error: RelationMissingResult["error"], table: string) {
  if (!error) {
    return false;
  }

  const missingCodes = new Set(["42P01", "PGRST204", "PGRST205", "PGRST116", "PGRST201"]);

  if (error.code && missingCodes.has(error.code)) {
    return true;
  }

  const normalizedMessage = normalizeRelationMessage(error);
  const normalizedTable = table.toLowerCase();
  const hasTableMention =
    normalizedMessage.includes(`public.${normalizedTable}`) ||
    normalizedMessage.includes(`public.` + `"${normalizedTable}"`) ||
    normalizedMessage.includes(`"${normalizedTable}"`) ||
    normalizedMessage.includes(`'${normalizedTable}'`) ||
    normalizedMessage.includes("`" + normalizedTable + "`") ||
    normalizedMessage.includes(normalizedTable);
  const hasMissingHint =
    normalizedMessage.includes("schema cache") ||
    normalizedMessage.includes("does not exist") ||
    normalizedMessage.includes("is not in the schema cache") ||
    normalizedMessage.includes("is missing") ||
    normalizedMessage.includes("is missing from the schema cache") ||
    normalizedMessage.includes("relation") ||
    normalizedMessage.includes("table");
  const publicTablePattern = `public.${table}`;
  const quotedPattern = `"${publicTablePattern}"`;
  const bareQuotedPattern = `"${table}"`;
  const candidatePattern = table;

  if (hasTableMention && hasMissingHint) {
    return true;
  }

  return (
    normalizedMessage.includes(`could not find table '${publicTablePattern}' in the schema cache`) ||
    normalizedMessage.includes(`could not find the table '${publicTablePattern}' in the schema cache`) ||
    normalizedMessage.includes(`could not find table '${candidatePattern}' in the schema cache`) ||
    normalizedMessage.includes(`could not find the table '${candidatePattern}' in the schema cache`) ||
    normalizedMessage.includes(`could not find table \"${publicTablePattern}\" in the schema cache`) ||
    normalizedMessage.includes(`could not find the table \"${publicTablePattern}\" in the schema cache`) ||
    normalizedMessage.includes(`could not find table \"${candidatePattern}\" in the schema cache`) ||
    normalizedMessage.includes(`could not find the table \"${candidatePattern}\" in the schema cache`) ||
    normalizedMessage.includes(`relation ${publicTablePattern} does not exist`) ||
    normalizedMessage.includes(`relation \"${candidatePattern}\" does not exist`) ||
    normalizedMessage.includes(`relation \"${publicTablePattern}\" does not exist`) ||
    normalizedMessage.includes(`relation ${quotedPattern} does not exist`) ||
    normalizedMessage.includes(`relation "${candidatePattern}" in the from clause does not exist`) ||
    normalizedMessage.includes(`relation '${candidatePattern}' in the from clause does not exist`) ||
    normalizedMessage.includes(`relation ${candidatePattern} does not exist`) ||
    normalizedMessage.includes(`relation ${bareQuotedPattern} does not exist`) ||
    normalizedMessage.includes(`${publicTablePattern} does not exist`) ||
    normalizedMessage.includes(`${candidatePattern} does not exist`) ||
    normalizedMessage.includes(`${publicTablePattern} is not in the schema cache`) ||
    normalizedMessage.includes(`${candidatePattern} is not in the schema cache`) ||
    normalizedMessage.includes(`relation "${publicTablePattern}" is missing`) ||
    normalizedMessage.includes(`relation "${candidatePattern}" is missing`) ||
    normalizedMessage.includes(`relation ${publicTablePattern} is missing`) ||
    normalizedMessage.includes(`relation ${candidatePattern} is missing`)
  );
}

function ignoreMissingRelation<T>(
  result: { data: T | null; error: { message: string } | null },
  table: string,
  fallback: T,
): { data: T; error: { message: string } | null } {
  if (!isMissingRelationError(result.error, table)) {
    return result as { data: T; error: { message: string } | null };
  }

  console.warn(
    `[World Toto Lab] Missing table "${table}" in schema cache. Returning fallback for compatibility.`,
  );
  return { data: fallback, error: null };
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

type SyncTotoOfficialRoundApiInput = {
  includeMatches?: boolean;
  sourceUrl?: string;
};

type SyncBigOfficialWatchApiInput = {
  sourceUrl?: string;
};

type SyncedTotoOfficialRoundMatchInput = {
  actualResult: "ONE" | "DRAW" | "TWO" | null;
  awayTeam: string;
  fixtureMasterId: string | null;
  goal3FixtureNo?: number | null;
  goal3TeamRole?: "home" | "away" | null;
  homeTeam: string;
  kickoffTime: string | null;
  matchStatus: TotoOfficialMatchStatus;
  officialMatchNo: number;
  officialVote0: number | null;
  officialVote1: number | null;
  officialVote2: number | null;
  officialVote3?: number | null;
  sourceText: string | null;
  stage: string | null;
  venue: string | null;
};

export type SyncedTotoOfficialRoundEntry = {
  title: string;
  notes: string | null;
  officialRoundName: string | null;
  officialRoundNumber: number | null;
  productType: ProductType;
  requiredMatchCount: number | null;
  outcomeSetJson: string[] | null;
  sourceNote: string | null;
  voidHandling: VoidHandling;
  resultStatus: TotoOfficialResultStatus;
  salesStartAt: string | null;
  salesEndAt: string | null;
  stakeYen: number;
  totalSalesYen: number | null;
  returnRate: number;
  firstPrizeShare: number | null;
  carryoverYen: number;
  payoutCapYen: number | null;
  sourceUrl: string | null;
  sourceText: string | null;
  matches: SyncedTotoOfficialRoundMatchInput[];
};

export type SyncTotoOfficialRoundListResponse = {
  fetchedAt: string | null;
  rounds: SyncedTotoOfficialRoundEntry[];
  sourceText: string | null;
  sourceUrl: string;
  warnings: string[];
};

export type UpsertTotoOfficialRoundLibraryFromSyncResult = {
  insertedCount: number;
  updatedCount: number;
  skippedCount: number;
  warnings: string[];
};

function normalizeSyncRoundValue(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeSyncRoundNumber(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  const parsed = Number(value);
  if (Number.isFinite(parsed)) {
    return Math.trunc(parsed);
  }

  return null;
}

function normalizeSyncRoundRatio(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return null;
  }

  return parsed;
}

function isKnownSyncProductType(value: unknown): value is ProductType {
  return (
    value === "toto13" ||
    value === "mini_toto" ||
    value === "winner" ||
    value === "custom"
  );
}

function parseSyncPercentInput(value: unknown, label: string, warnings: string[]) {
  const raw = normalizeSyncRoundValue(value);
  if (!raw) {
    return null;
  }

  const normalized = raw.replace(/%/g, "");
  const parsed = Number(normalized);
  if (!Number.isFinite(parsed)) {
    warnings.push(`${label} は数値に変換できませんでした: ${raw}`);
    return null;
  }

  if (parsed > 1 && parsed <= 100) {
    warnings.push(`${label} は ${parsed} と解釈されるため、百分率として ${parsed / 100} に変換しました。`);
    return parsed / 100;
  }

  if (parsed < 0 || parsed > 1) {
    warnings.push(`${label} は想定範囲外です（0〜1 または 0〜100）: ${raw}`);
    return null;
  }

  return parsed;
}

function parseSyncReturnRateInput(
  value: unknown,
  label: string,
  warnings: string[],
) {
  if (value === null || value === undefined) {
    return null;
  }

  const raw = normalizeSyncRoundValue(value);
  if (!raw) {
    return null;
  }

  const normalized = raw.replace(/%/g, "");
  const parsed = Number(normalized);
  if (!Number.isFinite(parsed)) {
    warnings.push(`${label} は数値に変換できませんでした: ${raw}`);
    return null;
  }

  if (parsed > 1 && parsed <= 100) {
    const ratio = parsed / 100;
    warnings.push(`${label} は ${parsed} と解釈されるため、百分率として ${ratio} に変換しました。`);
    return ratio;
  }

  if (parsed < 0 || parsed > 1) {
    warnings.push(`${label} は想定範囲外です（0〜1 または 0〜100）: ${raw}`);
    return null;
  }

  return parsed;
}

function isKnownSyncResultStatus(value: unknown): value is TotoOfficialResultStatus {
  return (
    value === "draft" ||
    value === "selling" ||
    value === "closed" ||
    value === "resulted" ||
    value === "cancelled" ||
    value === "unknown"
  );
}

function parseSyncApiResponse(
  raw: unknown,
  fallbackSourceUrl: string,
): SyncTotoOfficialRoundListResponse {
  const data = (raw ?? {}) as Record<string, unknown>;
  const roundsRaw = Array.isArray(data.rounds) ? data.rounds : [];
  const warnings: string[] = [];
  const normalizedSourceUrl = normalizeSyncRoundValue(fallbackSourceUrl);
  const parentSourceUrl = normalizedSourceUrl || null;
  const parentSourceText = dataSourceTextFromPayload(raw);
  const parseMatches = (row: unknown): SyncedTotoOfficialRoundMatchInput[] => {
    if (!Array.isArray((row as { matches?: unknown[] }).matches)) {
      return [];
    }

    const normalizedMatches: SyncedTotoOfficialRoundMatchInput[] = [];
    for (const entry of (row as { matches: unknown[] }).matches) {
      const record = (entry ?? {}) as Record<string, unknown>;
      const no = normalizeSyncRoundNumber(record.officialMatchNo);
      if (no === null) {
        continue;
      }

      normalizedMatches.push({
        actualResult: null,
        awayTeam: normalizeSyncRoundValue(record.awayTeam) || "未設定",
        fixtureMasterId: null,
        goal3FixtureNo: normalizeSyncRoundNumber(record.goal3FixtureNo),
        goal3TeamRole:
          record.goal3TeamRole === "home" || record.goal3TeamRole === "away"
            ? record.goal3TeamRole
            : null,
        homeTeam: normalizeSyncRoundValue(record.homeTeam) || "未設定",
        kickoffTime: normalizeSyncRoundValue(record.kickoffTime) || null,
        matchStatus: normalizeSyncMatchStatus(record.matchStatus),
        officialMatchNo: no,
        officialVote0: parseSyncPercentInput(
          record.officialVote0,
          `公式回 ${normalizeSyncRoundValue(record.officialMatchNo)} 試合 vote0`,
          warnings,
        ),
        officialVote1: parseSyncPercentInput(
          record.officialVote1,
          `公式回 ${normalizeSyncRoundValue(record.officialMatchNo)} 試合 vote1`,
          warnings,
        ),
        officialVote2: parseSyncPercentInput(
          record.officialVote2,
          `公式回 ${normalizeSyncRoundValue(record.officialMatchNo)} 試合 vote2`,
          warnings,
        ),
        officialVote3: parseSyncPercentInput(
          record.officialVote3,
          `公式回 ${normalizeSyncRoundValue(record.officialMatchNo)} 試合 vote3`,
          warnings,
        ),
        stage: normalizeSyncRoundValue(record.stage) || null,
        venue: normalizeSyncRoundValue(record.venue) || null,
        sourceText:
          normalizeSyncRoundValue(record.sourceText) || parentSourceText || null,
      });
    }

    return normalizedMatches;
  };

  return {
    fetchedAt: normalizeSyncRoundValue(data.fetchedAt) || null,
    rounds: roundsRaw.map((entry) => {
      const record = (entry ?? {}) as Record<string, unknown>;
      return {
        title: normalizeSyncRoundValue(record.title) || "公式回",
        notes: normalizeSyncRoundValue(record.notes) || null,
        officialRoundName: normalizeSyncRoundValue(record.officialRoundName) || null,
        officialRoundNumber: normalizeSyncRoundNumber(record.officialRoundNumber),
        productType: isKnownSyncProductType(record.productType)
          ? record.productType
          : "toto13",
        requiredMatchCount: normalizeSyncRoundNumber(record.requiredMatchCount),
        outcomeSetJson:
          Array.isArray(record.outcomeSetJson) && record.outcomeSetJson.length > 0
            ? record.outcomeSetJson.filter((value): value is string => typeof value === "string")
            : null,
        sourceNote: normalizeSyncRoundValue(record.sourceNote) || null,
        voidHandling: record.voidHandling === "manual" ? "manual"
          : record.voidHandling === "all_outcomes_valid" ? "all_outcomes_valid"
          : record.voidHandling === "exclude_from_combo" ? "exclude_from_combo"
          : record.voidHandling === "keep_as_pending" ? "keep_as_pending"
          : "manual",
        resultStatus: isKnownSyncResultStatus(record.resultStatus)
          ? record.resultStatus
          : "unknown",
        salesStartAt: normalizeSyncRoundValue(record.salesStartAt) || null,
        salesEndAt: normalizeSyncRoundValue(record.salesEndAt) || null,
        stakeYen: normalizeSyncRoundNumber(record.stakeYen) ?? 100,
        totalSalesYen:
          record.totalSalesYen === null
            ? null
            : normalizeSyncRoundRatio(record.totalSalesYen),
        returnRate:
          parseSyncReturnRateInput(record.returnRate, "returnRate", warnings) ??
          normalizeSyncRoundRatio(record.returnRate) ??
          0.5,
        firstPrizeShare:
          record.firstPrizeShare === null
            ? null
            : parseSyncReturnRateInput(record.firstPrizeShare, "firstPrizeShare", warnings) ??
              normalizeSyncRoundRatio(record.firstPrizeShare),
        carryoverYen: normalizeSyncRoundNumber(record.carryoverYen) ?? 0,
        payoutCapYen:
          record.payoutCapYen === null ? null : normalizeSyncRoundRatio(record.payoutCapYen),
        sourceUrl: normalizeSyncRoundValue(record.sourceUrl) || parentSourceUrl,
        sourceText: normalizeSyncRoundValue(record.sourceText) || dataSourceTextFromPayload(raw),
        matches: parseMatches(record),
      } satisfies SyncedTotoOfficialRoundEntry;
    }),
    sourceText: dataSourceTextFromPayload(raw),
    sourceUrl: parentSourceUrl || "",
    warnings: [
      ...warnings,
      ...(Array.isArray(data.warnings) && data.warnings.length > 0
        ? data.warnings.filter((value): value is string => typeof value === "string")
        : []),
    ],
  };
}

function isKnownSyncMatchStatus(value: unknown): value is TotoOfficialMatchStatus {
  return (
    value === "scheduled" ||
    value === "played" ||
    value === "cancelled" ||
    value === "postponed" ||
    value === "void" ||
    value === "unknown"
  );
}

function normalizeSyncMatchStatus(input: unknown): TotoOfficialMatchStatus {
  if (isKnownSyncMatchStatus(input)) {
    return input;
  }

  return "scheduled";
}

function dataSourceTextFromPayload(raw: unknown) {
  const payload = raw as { sourceText?: unknown } | null;
  return payload ? normalizeSyncRoundValue(payload.sourceText) || null : null;
}

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
  competitionType?: CompetitionType | null;
  dataProfile?: DataProfile | null;
  matchCount?: number | null;
  notes?: string | null;
  outcomeSetJson?: string[] | null;
  primaryUse?: PrimaryUse | null;
  productType?: ProductType | null;
  probabilityReadiness?: ProbabilityReadiness | null;
  requiredMatchCount?: number | null;
  roundSource?: RoundSource | null;
  sourceNote?: string | null;
  sportContext?: SportContext | null;
  title?: string | null;
  voidHandling?: VoidHandling | null;
}) {
  const productType = input.productType ?? "toto13";
  const requiredMatchCount = normalizeRequiredMatchCount(
    productType,
    input.requiredMatchCount ?? input.matchCount,
  );
  const activeMatchCount = normalizeMatchCount(input.matchCount ?? requiredMatchCount ?? 13);
  const outcomeSetJson = normalizeOutcomeSet(productType, input.outcomeSetJson);
  const roundMode = resolveRoundModeDefaults({
    competitionType: input.competitionType,
    dataProfile: input.dataProfile,
    notes: input.notes,
    primaryUse: input.primaryUse,
    productType,
    roundSource: input.roundSource,
    sourceNote: input.sourceNote,
    sportContext: input.sportContext,
    title: input.title,
  });

  return {
    activeMatchCount,
    competitionType: roundMode.competitionType,
    dataProfile: roundMode.dataProfile,
    outcomeSetJson,
    primaryUse: roundMode.primaryUse,
    probabilityReadiness: input.probabilityReadiness ?? "not_ready",
    productType,
    requiredMatchCount,
    roundSource: input.roundSource ?? "user_manual",
    sourceNote: input.sourceNote ?? null,
    sportContext: roundMode.sportContext,
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

export async function deleteRound(roundId: string) {
  await deleteRoundCascade(roundId);
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
  const safeNotesResult = ignoreMissingRelation(notesResult, "review_notes", []);
  throwIfError("Failed to load review notes", safeNotesResult);
  const safeCandidateTicketsResult = ignoreMissingRelation(
    candidateTicketsResult,
    "candidate_tickets",
    [],
  );
  throwIfError("Failed to load candidate tickets", safeCandidateTicketsResult);

  const allUsers = sortUsers((usersResult.data as UserRow[]).map(mapUser));
  const { demoUsers, liveUsers } = partitionUsers(allUsers);
  const rounds = (roundsResult.data as RoundRow[]).map(mapRound);
  const rawMatches = matchesResult.data as MatchRow[];
  const rawPicks = picksResult.data as PickRow[];
  const rawScoutReports = reportsResult.data as HumanScoutReportRow[];
  const rawReviewNotes = safeNotesResult.data as ReviewNoteRow[];
  const candidateTicketRows =
    (safeCandidateTicketsResult.data as Array<{ round_id: string }>) ?? [];
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
    researchMemosResult,
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
      supabase.from("research_memos").select("*").eq("round_id", roundId).order("updated_at", {
        ascending: false,
      }),
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
  const safeResearchMemosResult = ignoreMissingRelation(
    researchMemosResult,
    "research_memos",
    [],
  );
  const safeTicketsResult = ignoreMissingRelation(ticketsResult, "generated_tickets", []);
  const safeEvAssumptionResult = ignoreMissingRelation(evAssumptionResult, "round_ev_assumptions", null);
  const safeTotoOfficialRoundResult = ignoreMissingRelation(
    totoOfficialRoundResult,
    "toto_official_rounds",
    null,
  );
  const safeTotoOfficialMatchesResult = ignoreMissingRelation(
    totoOfficialMatchesResult,
    "toto_official_matches",
    [],
  );
  const safeNotesResult = ignoreMissingRelation(notesResult, "review_notes", []);
  throwIfError("Failed to load generated tickets", safeTicketsResult);
  throwIfError("Failed to load EV assumptions", safeEvAssumptionResult);
  const safeCandidateTicketsResult = ignoreMissingRelation(
    candidateTicketsResult,
    "candidate_tickets",
    [],
  );
  const safeCandidateVotesResult = ignoreMissingRelation(
    candidateVotesResult,
    "candidate_votes",
    [],
  );
  throwIfError("Failed to load candidate votes", safeCandidateVotesResult);
  throwIfError("Failed to load candidate tickets", safeCandidateTicketsResult);
  throwIfError("Failed to load toto official round", safeTotoOfficialRoundResult);
  throwIfError("Failed to load toto official matches", safeTotoOfficialMatchesResult);
  throwIfError("Failed to load review notes", safeNotesResult);
  throwIfError("Failed to load research memos", safeResearchMemosResult);

  if (!roundResult.data) {
    return null;
  }

  const round = mapRound(roundResult.data as RoundRow);
  const allUsers = sortUsers((usersResult.data as UserRow[]).map(mapUser));
  const { demoUsers, liveUsers } = partitionUsers(allUsers);
  const rawPicks = picksResult.data as PickRow[];
  const rawScoutReports = reportsResult.data as HumanScoutReportRow[];
  const rawReviewNotes = safeNotesResult.data as ReviewNoteRow[];
  const rawResearchMemos = safeResearchMemosResult.data as ResearchMemoRow[];
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
  const generatedTickets = (safeTicketsResult.data as GeneratedTicketRow[]).map(
    mapGeneratedTicket,
  );
  const evAssumption = safeEvAssumptionResult.data
    ? mapRoundEvAssumption(safeEvAssumptionResult.data as RoundEvAssumptionRow)
    : null;
  const candidateTickets = (safeCandidateTicketsResult.data as CandidateTicketRow[]).map(
    mapCandidateTicket,
  );
  const candidateVotes = filterRowsForScopedUsers(
    safeCandidateVotesResult.data as CandidateVoteRow[],
    users,
  ).map((row) => mapCandidateVote(row, userById.get(row.user_id)));
  const totoOfficialRound = safeTotoOfficialRoundResult.data
    ? mapTotoOfficialRound(safeTotoOfficialRoundResult.data as TotoOfficialRoundRow)
    : null;
  const totoOfficialMatches = (safeTotoOfficialMatchesResult.data as TotoOfficialMatchRow[]).map(
    mapTotoOfficialMatch,
  );
  const reviewNotes = filterReviewNotesForScopedUsers(rawReviewNotes, users).map((row) =>
    mapReviewNote(row, userById.get(row.user_id ?? ""), scopedMatchById.get(row.match_id ?? "")),
  );
  const researchMemos = rawResearchMemos.map((row) =>
    mapResearchMemo(row, userById.get(row.created_by), scopedMatchById.get(row.match_id ?? "")),
  );
  const inferredProbabilityReadiness = summarizeRoundReadiness({
    researchMemos,
    round,
    matches: scopedMatches,
  }).level;

  return {
    availableUsers: isDemoRoundTitle(round.title) ? users : liveUsers,
    users,
    round: {
      ...round,
      probabilityReadiness: inferredProbabilityReadiness ?? inferRoundProbabilityReadiness(scopedMatches),
      matches: scopedMatches,
      picks,
      scoutReports,
      researchMemos,
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
  competitionType?: CompetitionType | null;
  dataProfile?: DataProfile | null;
  matchCount?: number | null;
  notes: string | null;
  outcomeSetJson?: string[] | null;
  participantIds?: string[];
  primaryUse?: PrimaryUse | null;
  probabilityReadiness?: ProbabilityReadiness | null;
  productType?: ProductType;
  requiredMatchCount?: number | null;
  roundSource?: RoundSource;
  sourceNote?: string | null;
  sportContext?: SportContext | null;
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
      competition_type: defaults.competitionType,
      product_type: defaults.productType,
      sport_context: defaults.sportContext,
      primary_use: defaults.primaryUse,
      required_match_count: defaults.requiredMatchCount,
      active_match_count: defaults.activeMatchCount,
      data_profile: defaults.dataProfile,
      probability_readiness: defaults.probabilityReadiness,
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
      competition_type: "world_cup",
      product_type: "toto13",
      sport_context: "national_team",
      primary_use: "demo",
      required_match_count: 13,
      active_match_count: 13,
      data_profile: "demo",
      probability_readiness: "partial",
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
  competitionType?: CompetitionType | null;
  dataProfile?: DataProfile | null;
  notes: string | null;
  outcomeSetJson?: string[] | null;
  participantIds?: string[];
  primaryUse?: PrimaryUse | null;
  probabilityReadiness?: ProbabilityReadiness | null;
  productType?: ProductType;
  requiredMatchCount?: number | null;
  roundSource?: RoundSource;
  sourceNote?: string | null;
  sportContext?: SportContext | null;
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
    competitionType: input.competitionType ?? currentRound.competitionType,
    dataProfile: input.dataProfile ?? currentRound.dataProfile,
    matchCount: currentRound.activeMatchCount,
    notes: input.notes,
    outcomeSetJson: input.outcomeSetJson ?? currentRound.outcomeSetJson,
    primaryUse: input.primaryUse ?? currentRound.primaryUse,
    productType: input.productType ?? currentRound.productType,
    probabilityReadiness: input.probabilityReadiness ?? currentRound.probabilityReadiness,
    requiredMatchCount: input.requiredMatchCount ?? currentRound.requiredMatchCount,
    roundSource: input.roundSource ?? currentRound.roundSource,
    sourceNote: input.sourceNote ?? currentRound.sourceNote,
    sportContext: input.sportContext ?? currentRound.sportContext,
    title: input.title,
    voidHandling: input.voidHandling ?? currentRound.voidHandling,
  });
  const result = await supabase
    .from("rounds")
    .update({
      title: input.title,
      status: input.status,
      budget_yen: input.budgetYen,
      notes: encodeRoundParticipantsNote(input.notes, input.participantIds),
      competition_type: nextRule.competitionType,
      product_type: nextRule.productType,
      sport_context: nextRule.sportContext,
      primary_use: nextRule.primaryUse,
      required_match_count: nextRule.requiredMatchCount,
      active_match_count: currentRound.activeMatchCount ?? nextRule.activeMatchCount,
      data_profile: nextRule.dataProfile,
      probability_readiness: nextRule.probabilityReadiness,
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
    currentRound.competitionType !== nextRule.competitionType ||
    currentRound.productType !== nextRule.productType ||
    currentRound.sportContext !== nextRule.sportContext ||
    currentRound.primaryUse !== nextRule.primaryUse ||
    currentRound.requiredMatchCount !== nextRule.requiredMatchCount ||
    currentRound.dataProfile !== nextRule.dataProfile ||
    currentRound.probabilityReadiness !== nextRule.probabilityReadiness ||
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
  recentFormNote: string | null;
  availabilityInfo: string | null;
  conditionsInfo: string | null;
  homeStrengthAdjust: number | null;
  awayStrengthAdjust: number | null;
  availabilityAdjust: number | null;
  conditionsAdjust: number | null;
  tacticalAdjust: number | null;
  motivationAdjust: number | null;
  adminAdjust1: number | null;
  adminAdjust0: number | null;
  adminAdjust2: number | null;
  homeAdvantageAdjust: number | null;
  restDaysAdjust: number | null;
  travelAdjust: number | null;
  leagueTableMotivationAdjust: number | null;
  injurySuspensionAdjust: number | null;
  rotationRiskAdjust: number | null;
  groupStandingMotivationAdjust: number | null;
  travelClimateAdjust: number | null;
  altitudeHumidityAdjust: number | null;
  squadDepthAdjust: number | null;
  tournamentPressureAdjust: number | null;
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
      recent_form_note: input.recentFormNote,
      availability_info: input.availabilityInfo,
      conditions_info: input.conditionsInfo,
      home_strength_adjust: input.homeStrengthAdjust,
      away_strength_adjust: input.awayStrengthAdjust,
      availability_adjust: input.availabilityAdjust,
      conditions_adjust: input.conditionsAdjust,
      tactical_adjust: input.tacticalAdjust,
      motivation_adjust: input.motivationAdjust,
      admin_adjust_1: input.adminAdjust1,
      admin_adjust_0: input.adminAdjust0,
      admin_adjust_2: input.adminAdjust2,
      home_advantage_adjust: input.homeAdvantageAdjust,
      rest_days_adjust: input.restDaysAdjust,
      travel_adjust: input.travelAdjust,
      league_table_motivation_adjust: input.leagueTableMotivationAdjust,
      injury_suspension_adjust: input.injurySuspensionAdjust,
      rotation_risk_adjust: input.rotationRiskAdjust,
      group_standing_motivation_adjust: input.groupStandingMotivationAdjust,
      travel_climate_adjust: input.travelClimateAdjust,
      altitude_humidity_adjust: input.altitudeHumidityAdjust,
      squad_depth_adjust: input.squadDepthAdjust,
      tournament_pressure_adjust: input.tournamentPressureAdjust,
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
  const [matchesResult, roundResult] = await Promise.all([
    supabase.from("matches").select("*").eq("round_id", input.roundId),
    supabase.from("rounds").select("*").eq("id", input.roundId).maybeSingle(),
  ]);

  throwIfError("Failed to load matches for AI estimation", matchesResult);
  throwIfError("Failed to load round for AI estimation", roundResult);

  const matches = (matchesResult.data as MatchRow[]).map(mapMatch);
  const round = roundResult.data ? mapRound(roundResult.data as RoundRow) : null;
  const targetMatches = matches.filter((match) => {
    const hasExistingModel =
      match.modelProb1 !== null || match.modelProb0 !== null || match.modelProb2 !== null;

    if (hasExistingModel && !input.overwriteExisting) {
      return false;
    }

    return true;
  });

  const updates = targetMatches
    .map((match) => {
      return {
        matchId: match.id,
        estimated: calculateModelProbabilities({
          ...match,
          competitionType: round?.competitionType ?? "world_cup",
          dataProfile: round?.dataProfile ?? "manual_light",
        }),
      };
    })
    .filter((entry) => entry.estimated !== null);

  const results = await Promise.all(
    updates.map((entry) =>
      supabase
        .from("matches")
        .update({
          model_prob_1: entry.estimated.modelProb1,
          model_prob_0: entry.estimated.modelProb0,
          model_prob_2: entry.estimated.modelProb2,
          recommended_outcomes: [entry.estimated.modelProb1, entry.estimated.modelProb0, entry.estimated.modelProb2]
            .map((value, index) => ({ index, value }))
            .sort((left, right) => right.value - left.value)
            .slice(0, 2)
            .map((entry) => (entry.index === 0 ? "1" : entry.index === 1 ? "0" : "2"))
            .join(","),
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

export async function syncTotoOfficialRoundListFromOfficial(input: SyncTotoOfficialRoundApiInput) {
  const sourceUrl =
    normalizeSyncRoundValue(input.sourceUrl) || "https://toto.yahoo.co.jp/schedule/toto";
  const functionName =
    normalizeSyncRoundValue(process.env.NEXT_PUBLIC_TOTO_OFFICIAL_ROUND_SYNC_FUNCTION_NAME) ||
    "sync-toto-official-round-list";
  const supabaseUrl = normalizeSyncRoundValue(process.env.NEXT_PUBLIC_SUPABASE_URL);
  const supabaseAnonKey = normalizeSyncRoundValue(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

  if (!supabaseUrl) {
    throw new Error("NEXT_PUBLIC_SUPABASE_URL が未設定です。");
  }

  if (!supabaseAnonKey) {
    throw new Error("NEXT_PUBLIC_SUPABASE_ANON_KEY が未設定です。");
  }

  const requestBody = {
    includeMatches: input.includeMatches ?? false,
    sourceUrl,
  };
  const functionEndpoint = `${supabaseUrl}/functions/v1/${functionName}`;

  const response = await fetch(functionEndpoint, {
    method: "POST",
    headers: buildSupabaseFunctionHeaders(supabaseAnonKey, {
      "content-type": "application/json",
      "x-client-info": "world-toto-lab",
    }),
    body: JSON.stringify(requestBody),
  });

  if (!response.ok) {
    const rawText = await response.text();
    throw new Error(
      `公式一覧の同期 API 呼び出しに失敗しました: ${response.status} ${response.statusText}${
        rawText ? ` / ${rawText}` : ""
      }`,
    );
  }

  const payload = await response.json();
  return parseSyncApiResponse(payload, sourceUrl);
}

export async function syncBigOfficialWatchFromOfficial(
  input: SyncBigOfficialWatchApiInput = {},
) {
  const sourceUrl =
    normalizeSyncRoundValue(input.sourceUrl) ||
    "https://store.toto-dream.com/dcs/subos/screen/pi02/spin005/PGSPIN00501InitBIGLotInfo.form";
  const functionName =
    normalizeSyncRoundValue(process.env.NEXT_PUBLIC_BIG_OFFICIAL_WATCH_FUNCTION_NAME) ||
    "sync-big-official-watch";
  const supabaseUrl = normalizeSyncRoundValue(process.env.NEXT_PUBLIC_SUPABASE_URL);
  const supabaseAnonKey = normalizeSyncRoundValue(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

  if (!supabaseUrl) {
    throw new Error("NEXT_PUBLIC_SUPABASE_URL が未設定です。");
  }

  if (!supabaseAnonKey) {
    throw new Error("NEXT_PUBLIC_SUPABASE_ANON_KEY が未設定です。");
  }

  const response = await fetch(`${supabaseUrl}/functions/v1/${functionName}`, {
    method: "POST",
    headers: buildSupabaseFunctionHeaders(supabaseAnonKey, {
      "content-type": "application/json",
      "x-client-info": "world-toto-lab",
    }),
    body: JSON.stringify({ sourceUrl }),
  });

  if (!response.ok) {
    const rawText = await response.text();
    throw new Error(
      `BIG公式同期 API 呼び出しに失敗しました: ${response.status} ${response.statusText}${
        rawText ? ` / ${rawText}` : ""
      }`,
    );
  }

  return (await response.json()) as BigOfficialSyncPayload;
}

function normalizeLibraryRoundMatchJson(rows: SyncedTotoOfficialRoundMatchInput[] | null) {
  return JSON.stringify(
    (rows ?? [])
      .slice()
      .sort((left, right) => {
        if (left.officialMatchNo !== right.officialMatchNo) {
          return left.officialMatchNo - right.officialMatchNo;
        }

        const leftHome = left.homeTeam.toLowerCase();
        const rightHome = right.homeTeam.toLowerCase();
        if (leftHome !== rightHome) {
          return leftHome.localeCompare(rightHome, "ja");
        }

        return left.awayTeam.toLowerCase().localeCompare(right.awayTeam.toLowerCase(), "ja");
      })
      .map((row) => ({
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
      })),
  );
}

function normalizeLibraryRoundMatchRows(value: unknown): SyncedTotoOfficialRoundMatchInput[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((entry) => {
      const row = entry as Record<string, unknown>;
      const no = normalizeSyncRoundNumber(row.officialMatchNo);
      if (no === null) {
        return null;
      }

      return {
        actualResult: (row.actualResult as SyncedTotoOfficialRoundMatchInput["actualResult"]) ?? null,
        awayTeam: normalizeSyncRoundValue(row.awayTeam) || "未設定",
        fixtureMasterId:
          typeof row.fixtureMasterId === "string" ? row.fixtureMasterId : null,
        homeTeam: normalizeSyncRoundValue(row.homeTeam) || "未設定",
        kickoffTime: normalizeSyncRoundValue(row.kickoffTime) || null,
        matchStatus: normalizeSyncMatchStatus(row.matchStatus),
        officialMatchNo: no,
        officialVote0: normalizeSyncRoundRatio(row.officialVote0),
        officialVote1: normalizeSyncRoundRatio(row.officialVote1),
        officialVote2: normalizeSyncRoundRatio(row.officialVote2),
        sourceText: normalizeSyncRoundValue(row.sourceText) || null,
        stage: normalizeSyncRoundValue(row.stage) || null,
        venue: normalizeSyncRoundValue(row.venue) || null,
      } satisfies SyncedTotoOfficialRoundMatchInput;
    })
    .filter((entry): entry is SyncedTotoOfficialRoundMatchInput => Boolean(entry));
}

type SyncedRoundIdentityInput = {
  officialRoundNumber: number | null;
  officialRoundName: string | null;
  productType: ProductType;
  title: string | null;
};

function libraryIdentityMatchKey(input: SyncedRoundIdentityInput) {
  const nameKey = normalizeSyncRoundValue(input.officialRoundName) || normalizeSyncRoundValue(input.title) || "no-round-name";

  if (input.officialRoundNumber !== null) {
    return `n:${input.productType}:${input.officialRoundNumber}:${nameKey}`;
  }

  return `t:${input.productType}:${nameKey}:${normalizeSyncRoundValue(input.title) || "no-title"}`;
}

function hasSyncEntryCoreChange(
  existing: {
    title: string;
    notes: string | null;
    official_round_name: string | null;
    official_round_number: number | null;
    required_match_count: number | null;
    outcome_set_json: string[] | null;
    source_note: string | null;
    void_handling: VoidHandling;
    result_status: TotoOfficialResultStatus;
    sales_start_at: string | null;
    sales_end_at: string | null;
    stake_yen: number;
    total_sales_yen: number | null;
    return_rate: number;
    first_prize_share: number | null;
    carryover_yen: number;
    payout_cap_yen: number | null;
    source_url: string | null;
    source_text: string | null;
  },
  payload: ReturnType<typeof buildTotoOfficialRoundLibraryPayload>,
) {
  const payloadCore = {
    title: payload.title,
    notes: payload.notes,
    official_round_name: payload.official_round_name,
    official_round_number: payload.official_round_number,
    required_match_count: payload.required_match_count,
    outcome_set_json: payload.outcome_set_json,
    source_note: payload.source_note,
    void_handling: payload.void_handling,
    result_status: payload.result_status,
    sales_start_at: payload.sales_start_at,
    sales_end_at: payload.sales_end_at,
    stake_yen: payload.stake_yen,
    total_sales_yen: payload.total_sales_yen,
    return_rate: payload.return_rate,
    first_prize_share: payload.first_prize_share,
    carryover_yen: payload.carryover_yen,
    payout_cap_yen: payload.payout_cap_yen,
    source_url: payload.source_url ?? null,
    source_text: payload.source_text,
  };
  const existingCore = {
    title: existing.title,
    notes: existing.notes,
    official_round_name: existing.official_round_name,
    official_round_number: existing.official_round_number,
    required_match_count: existing.required_match_count,
    outcome_set_json: existing.outcome_set_json,
    source_note: existing.source_note,
    void_handling: existing.void_handling,
    result_status: existing.result_status,
    sales_start_at: existing.sales_start_at,
    sales_end_at: existing.sales_end_at,
    stake_yen: existing.stake_yen,
    total_sales_yen: existing.total_sales_yen,
    return_rate: existing.return_rate,
    first_prize_share: existing.first_prize_share,
    carryover_yen: existing.carryover_yen,
    payout_cap_yen: existing.payout_cap_yen,
    source_url: existing.source_url,
    source_text: existing.source_text,
  };

  return (
    JSON.stringify(payloadCore.outcome_set_json ?? []) !==
      JSON.stringify(existingCore.outcome_set_json ?? []) ||
    JSON.stringify(payloadCore) !== JSON.stringify(existingCore)
  );
}

export async function upsertTotoOfficialRoundLibraryFromSync(input: {
  entries: SyncedTotoOfficialRoundEntry[];
  sourceUrl: string | null;
}) {
  const supabase = requireSupabaseClient();
  const sourceUrl = normalizeSyncRoundValue(input.sourceUrl) || null;
  const warnings: string[] = [];
  const rows = input.entries.filter((entry) => {
    if (!entry.title) {
      warnings.push("タイトル不明の回をスキップしました。");
      return false;
    }
    return true;
  });

  const existingQuery = supabase
    .from("toto_official_round_library")
    .select(
      "id, title, notes, product_type, required_match_count, outcome_set_json, source_note, void_handling, official_round_name, official_round_number, sales_start_at, sales_end_at, result_status, stake_yen, total_sales_yen, return_rate, first_prize_share, carryover_yen, payout_cap_yen, source_url, source_text, matches_json",
    );
  const existingResult = await existingQuery;

  throwIfError("Failed to load existing official round library for sync", existingResult);
  const existingRows = (existingResult.data ?? []) as TotoOfficialRoundLibraryRow[];
  const { duplicateIdsByKey, uniqueRows } = dedupeTotoOfficialRoundLibraryRows(existingRows);

  const byNumber = new Map<string, TotoOfficialRoundLibraryRow>();
  const byTitle = new Map<string, TotoOfficialRoundLibraryRow>();
  Array.from(uniqueRows.values()).forEach((existing) => {
    const identityKey = libraryIdentityMatchKey(existing as unknown as SyncedTotoOfficialRoundEntry);
    if (existing.official_round_number !== null) {
      byNumber.set(identityKey, existing);
    }

    byTitle.set(identityKey, existing);
  });

  const seenKeys = new Set<string>();
  let insertedCount = 0;
  let updatedCount = 0;
  let skippedCount = 0;

  for (const entry of rows) {
    const identityKey = libraryIdentityMatchKey(entry);
    if (seenKeys.has(identityKey)) {
      warnings.push(`${entry.title} は入力内で重複があったため先頭を採用します。`);
      skippedCount += 1;
      continue;
    }
    seenKeys.add(identityKey);

    const payload = buildTotoOfficialRoundLibraryPayload({
      title: entry.title,
      notes: entry.notes,
      officialRoundName: entry.officialRoundName,
      officialRoundNumber: entry.officialRoundNumber,
      productType: entry.productType,
      requiredMatchCount: entry.requiredMatchCount,
      outcomeSetJson: entry.outcomeSetJson ?? undefined,
      sourceNote: entry.sourceNote,
      voidHandling: entry.voidHandling,
      resultStatus: entry.resultStatus,
      salesStartAt: entry.salesStartAt,
      salesEndAt: entry.salesEndAt,
      stakeYen: entry.stakeYen,
      totalSalesYen: entry.totalSalesYen,
      returnRate: entry.returnRate,
      firstPrizeShare: entry.firstPrizeShare,
      carryoverYen: entry.carryoverYen,
      payoutCapYen: entry.payoutCapYen,
      sourceUrl: normalizeSyncRoundValue(entry.sourceUrl) || sourceUrl,
      sourceText: entry.sourceText,
      rows: entry.matches,
    });

    const nextMatchJson = normalizeLibraryRoundMatchJson(payload.matches_json);
    const target = entry.officialRoundNumber !== null
      ? byNumber.get(identityKey) ?? byTitle.get(identityKey)
      : byTitle.get(identityKey);
    const duplicateIds = duplicateIdsByKey.get(identityKey) ?? [];

    if (!target) {
      const insertResult = await supabase.from("toto_official_round_library").insert(payload).select("id");

      if (insertResult.error) {
        warnings.push(`${entry.title} の保存に失敗しました: ${insertResult.error.message}`);
        continue;
      }
      insertedCount += 1;
      continue;
    }

    const currentMatchJson = normalizeLibraryRoundMatchJson(
      normalizeLibraryRoundMatchRows(target.matches_json),
    );
    const hasCoreChange = hasSyncEntryCoreChange(target, payload);
    const hasMatchChange = nextMatchJson !== currentMatchJson;

    if (!hasCoreChange && !hasMatchChange) {
      if (duplicateIds.length > 0) {
        const deleteDuplicatesResult = await supabase
          .from("toto_official_round_library")
          .delete()
          .in("id", duplicateIds);

        if (deleteDuplicatesResult.error) {
          warnings.push(`${entry.title} の古い重複履歴削除に失敗しました: ${deleteDuplicatesResult.error.message}`);
        } else {
          warnings.push(`${entry.title} の古い重複履歴 ${duplicateIds.length} 件を整理しました。`);
        }
      }
      skippedCount += 1;
      continue;
    }

    const updateResult = await supabase
      .from("toto_official_round_library")
      .update(payload)
      .eq("id", target.id);

    if (updateResult.error) {
      warnings.push(`${entry.title} の更新に失敗しました: ${updateResult.error.message}`);
      continue;
    }

    updatedCount += 1;

    if (duplicateIds.length > 0) {
      const deleteDuplicatesResult = await supabase
        .from("toto_official_round_library")
        .delete()
        .in("id", duplicateIds);

      if (deleteDuplicatesResult.error) {
        warnings.push(`${entry.title} の古い重複履歴削除に失敗しました: ${deleteDuplicatesResult.error.message}`);
      } else {
        warnings.push(`${entry.title} の古い重複履歴 ${duplicateIds.length} 件を整理しました。`);
      }
    }
  }

  const refreshedResult = await supabase
    .from("toto_official_round_library")
    .select("*");

  throwIfError("Failed to reload toto official round library for cleanup", refreshedResult);
  const pruneIds = collectPrunableOfficialRoundLibraryRowIds(
    (refreshedResult.data ?? []) as TotoOfficialRoundLibraryRow[],
  );

  if (pruneIds.length > 0) {
    const pruneResult = await supabase
      .from("toto_official_round_library")
      .delete()
      .in("id", pruneIds);

    if (pruneResult.error) {
      warnings.push(`公式回ライブラリの古い終了回整理に失敗しました: ${pruneResult.error.message}`);
    } else {
      warnings.push(`公式回ライブラリの古い終了回・重複 ${pruneIds.length} 件を整理しました。`);
    }
  }

  return {
    insertedCount,
    updatedCount,
    skippedCount,
    warnings,
  } satisfies UpsertTotoOfficialRoundLibraryFromSyncResult;
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

  const rawRows = ((result.data as TotoOfficialRoundLibraryRow[]) ?? []);
  const { uniqueRows } = dedupeTotoOfficialRoundLibraryRows(rawRows);
  const entries = sortOfficialRoundLibraryEntriesNewestFirst(
    Array.from(uniqueRows.values()).map(
      mapTotoOfficialRoundLibraryEntry,
    ),
  );
  const searchNeedle = normalizeFixtureKeyPart(input?.searchQuery);

  if (!searchNeedle) {
    return entries;
  }

  return sortOfficialRoundLibraryEntriesNewestFirst(
    entries.filter((entry) =>
      [
        entry.title,
        entry.officialRoundName,
        entry.sourceNote,
        entry.sourceText,
        entry.sourceUrl,
      ]
        .map((value) => normalizeFixtureKeyPart(value))
        .some((value) => value.includes(searchNeedle)),
    ),
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
  const safeExistingResult = ignoreMissingRelation<Array<{ id: string; label: string }>>(
    existingResult,
    "candidate_tickets",
    [],
  );

  if (safeExistingResult.error) {
    throwIfError("Failed to load existing candidate tickets", safeExistingResult);
  }

  const nextLabels = new Set(input.tickets.map((ticket) => ticket.label));
  const staleIds = (safeExistingResult.data ?? [])
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

  if (isMissingRelationError(result.error, "candidate_tickets")) {
    return;
  }

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

  if (isMissingRelationError(result.error, "candidate_votes")) {
    return;
  }

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

export async function saveResearchMemo(input: {
  confidence: ResearchMemoConfidence;
  createdBy: string;
  matchId: string | null;
  memoId?: string | null;
  memoType: ResearchMemoType;
  roundId: string;
  sourceDate: string | null;
  sourceName: string | null;
  sourceUrl: string | null;
  summary: string;
  team: string | null;
  title: string;
}) {
  const supabase = requireSupabaseClient();
  const payload = {
    confidence: input.confidence,
    created_by: input.createdBy,
    match_id: input.matchId,
    memo_type: input.memoType,
    round_id: input.roundId,
    source_date: input.sourceDate,
    source_name: input.sourceName,
    source_url: input.sourceUrl,
    summary: input.summary,
    team: input.team,
    title: input.title,
  };
  const result = input.memoId
    ? await supabase.from("research_memos").update(payload).eq("id", input.memoId)
    : await supabase.from("research_memos").insert(payload);

  throwIfError("Failed to save research memo", result);
}

export async function deleteResearchMemo(memoId: string) {
  const supabase = requireSupabaseClient();
  const result = await supabase.from("research_memos").delete().eq("id", memoId);
  throwIfError("Failed to delete research memo", result);
}
