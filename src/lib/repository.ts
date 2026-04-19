import { canEstimateAiModel, estimateAiModel } from "@/lib/ai-estimator";
import { computeConsensus, getEdge } from "@/lib/domain";
import {
  buildDemoMatchRows,
  buildDemoPickRows,
  buildDemoReviewNotes,
  buildDemoScoutReportRows,
  demoRoundNotes,
  demoRoundTitle,
  demoTicketSettings,
} from "@/lib/demo-data";
import { encodePickSupportNote, parsePickSupportNote } from "@/lib/pick-support";
import { defaultMemberNames } from "@/lib/sample-data";
import { requireSupabaseClient } from "@/lib/supabase";
import { generateAllModeTickets } from "@/lib/tickets";
import { filterPredictors, isPredictorRole } from "@/lib/users";
import type {
  DashboardData,
  DashboardRoundSummary,
  GeneratedTicket,
  HumanScoutReport,
  Match,
  MatchCategory,
  Outcome,
  Pick,
  PickSupport,
  ProvisionalCall,
  ReviewNote,
  Round,
  RoundStatus,
  RoundWorkspace,
  TicketMode,
  User,
  UserRole,
} from "@/lib/types";

type UserRow = {
  created_at: string;
  id: string;
  name: string;
  role: UserRole;
  updated_at: string;
};

type RoundRow = {
  budget_yen: number | null;
  created_at: string;
  id: string;
  notes: string | null;
  status: RoundStatus;
  title: string;
  updated_at: string;
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

function mapRound(row: RoundRow): Round {
  return {
    id: row.id,
    title: row.title,
    status: row.status,
    budgetYen: row.budget_yen,
    notes: row.notes,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapMatch(row: MatchRow): Match {
  return {
    id: row.id,
    roundId: row.round_id,
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

function mapPick(row: PickRow, user?: User): Pick {
  const parsed = parsePickSupportNote(row.note);
  return {
    id: row.id,
    roundId: row.round_id,
    matchId: row.match_id,
    userId: row.user_id,
    pick: row.pick,
    note: parsed.note,
    support: parsed.support,
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

function deriveRoundSummary(
  round: Round,
  matches: Match[],
  picks: Pick[],
  scoutReports: HumanScoutReport[],
): DashboardRoundSummary {
  const topEdges = matches
    .map((match) => {
      const edges = [
        getEdge(match, "1") ?? Number.NEGATIVE_INFINITY,
        getEdge(match, "0") ?? Number.NEGATIVE_INFINITY,
        getEdge(match, "2") ?? Number.NEGATIVE_INFINITY,
      ];

      return {
        matchId: match.id,
        matchNo: match.matchNo,
        fixture: `${match.homeTeam} 対 ${match.awayTeam}`,
        edge: Math.max(...edges),
      };
    })
    .filter((entry) => Number.isFinite(entry.edge))
    .sort((left, right) => right.edge - left.edge)
    .slice(0, 3);

  const consensusCompleted = matches.filter((match) => match.consensusCall !== null).length;
  const resultedCount = matches.filter((match) => match.actualResult !== null).length;

  return {
    ...round,
    matches,
    picks,
    scoutReports,
    matchCount: matches.length,
    pickCount: picks.length,
    resultedCount,
    consensusCompletion: matches.length > 0 ? consensusCompleted / matches.length : 0,
    topEdges,
  };
}

function placeholderMatches(roundId: string) {
  return Array.from({ length: 13 }, (_, index) => ({
    round_id: roundId,
    match_no: index + 1,
    home_team: `チーム ${index + 1}A`,
    away_team: `チーム ${index + 1}B`,
    stage: "グループステージ",
  }));
}

async function deleteRoundCascade(roundId: string) {
  const supabase = requireSupabaseClient();
  await supabase.from("rounds").delete().eq("id", roundId);
}

export async function listDashboardData(): Promise<DashboardData> {
  const supabase = requireSupabaseClient();
  const [usersResult, roundsResult, matchesResult, picksResult, reportsResult] =
    await Promise.all([
      supabase.from("users").select("*").order("role").order("name"),
      supabase.from("rounds").select("*").order("created_at", { ascending: false }),
      supabase.from("matches").select("*").order("round_id").order("match_no"),
      supabase.from("picks").select("*"),
      supabase.from("human_scout_reports").select("*"),
    ]);

  throwIfError("Failed to load users", usersResult);
  throwIfError("Failed to load rounds", roundsResult);
  throwIfError("Failed to load matches", matchesResult);
  throwIfError("Failed to load picks", picksResult);
  throwIfError("Failed to load scout reports", reportsResult);

  const users = sortUsers((usersResult.data as UserRow[]).map(mapUser));
  const rounds = (roundsResult.data as RoundRow[]).map(mapRound);
  const matches = (matchesResult.data as MatchRow[]).map(mapMatch);
  const picks = (picksResult.data as PickRow[]).map((row) => mapPick(row));
  const scoutReports = (reportsResult.data as HumanScoutReportRow[]).map((row) =>
    mapScoutReport(row),
  );

  const matchesByRound = groupByRoundId(matches);
  const picksByRound = groupByRoundId(picks);
  const reportsByRound = groupByRoundId(scoutReports);

  return {
    users,
    rounds: rounds.map((round) =>
      deriveRoundSummary(
        round,
        matchesByRound.get(round.id) ?? [],
        picksByRound.get(round.id) ?? [],
        reportsByRound.get(round.id) ?? [],
      ),
    ),
  };
}

export async function getRoundWorkspace(roundId: string): Promise<RoundWorkspace | null> {
  const supabase = requireSupabaseClient();
  const [usersResult, roundResult, matchesResult, picksResult, reportsResult, ticketsResult, notesResult] =
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
  throwIfError("Failed to load review notes", notesResult);

  if (!roundResult.data) {
    return null;
  }

  const users = sortUsers((usersResult.data as UserRow[]).map(mapUser));
  const userById = new Map(users.map((user) => [user.id, user]));
  const round = mapRound(roundResult.data as RoundRow);
  const matches = (matchesResult.data as MatchRow[]).map(mapMatch);
  const matchById = new Map(matches.map((match) => [match.id, match]));
  const picks = (picksResult.data as PickRow[]).map((row) =>
    mapPick(row, userById.get(row.user_id)),
  );
  const scoutReports = (reportsResult.data as HumanScoutReportRow[]).map((row) =>
    mapScoutReport(row, userById.get(row.user_id), matchById.get(row.match_id)),
  );
  const generatedTickets = (ticketsResult.data as GeneratedTicketRow[]).map(
    mapGeneratedTicket,
  );
  const reviewNotes = (notesResult.data as ReviewNoteRow[]).map((row) =>
    mapReviewNote(row, userById.get(row.user_id ?? ""), matchById.get(row.match_id ?? "")),
  );

  return {
    users,
    round: {
      ...round,
      matches,
      picks,
      scoutReports,
      generatedTickets,
      reviewNotes,
    },
  };
}

export async function createSampleUsers() {
  const supabase = requireSupabaseClient();
  const existingResult = await supabase.from("users").select("id");
  throwIfError("Failed to check existing users", existingResult);

  if ((existingResult.data ?? []).length > 0) {
    return;
  }

  const insertResult = await supabase.from("users").insert(
    defaultMemberNames.map((name, index) => ({
      name,
      role: index === 0 ? "admin" : "member",
    })),
  );

  throwIfError("Failed to create sample users", insertResult);
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

export async function createRound(input: {
  budgetYen: number | null;
  notes: string | null;
  status: RoundStatus;
  title: string;
}) {
  const supabase = requireSupabaseClient();
  const roundResult = await supabase
    .from("rounds")
    .insert({
      title: input.title,
      status: input.status,
      budget_yen: input.budgetYen,
      notes: input.notes,
    })
    .select("*")
    .single();

  throwIfError("Failed to create round", roundResult);

  const round = roundResult.data as RoundRow;
  const matchesResult = await supabase
    .from("matches")
    .insert(placeholderMatches(round.id));

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
  if (existingRoundId) {
    return existingRoundId;
  }

  await createSampleUsers();

  const usersResult = await supabase.from("users").select("*").order("role").order("name");
  throwIfError("Failed to load users for demo round", usersResult);

  const users = sortUsers((usersResult.data as UserRow[]).map(mapUser));
  if (users.length === 0) {
    throw new Error("No users are available for the demo round.");
  }
  const predictorIds = filterPredictors(users).map((user) => user.id);

  const roundResult = await supabase
    .from("rounds")
    .insert({
      title: demoRoundTitle,
      status: "reviewed",
      budget_yen: demoTicketSettings.budgetYen,
      notes: demoRoundNotes,
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
    const userIds = users.map((user) => user.id);
    const pickRows = buildDemoPickRows(round.id, matches, userIds);
    const scoutRows = buildDemoScoutReportRows(
      round.id,
      matches,
      predictorIds.length > 0 ? predictorIds : [userIds[0]],
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
      const allTickets = generateAllModeTickets(workspace.round.matches, demoTicketSettings);
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
      .insert(buildDemoReviewNotes(round.id, matches, userIds));

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
  status: RoundStatus;
  title: string;
}) {
  const supabase = requireSupabaseClient();
  const result = await supabase
    .from("rounds")
    .update({
      title: input.title,
      status: input.status,
      budget_yen: input.budgetYen,
      notes: input.notes,
    })
    .eq("id", input.roundId);

  throwIfError("Failed to update round", result);
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
    return;
  }

  const insertResult = await supabase.from("picks").insert(rows);
  throwIfError("Failed to save picks", insertResult);
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
