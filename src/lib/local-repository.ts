import {
  generateCandidateTickets,
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
import { resolveRoundParticipantUsers } from "@/lib/round-participants";
import { defaultDemoUsers, defaultInitialUsers, isDemoAccountName } from "@/lib/sample-data";
import { calculateModelProbabilities } from "@/lib/probability/engine";
import { summarizeRoundReadiness } from "@/lib/probability/readiness";
import { buildProductRule, normalizeOutcomeSet, normalizeRequiredMatchCount } from "@/lib/product-rules";
import { inferRoundProbabilityReadiness, resolveRoundModeDefaults } from "@/lib/round-mode";
import { isDemoDataMode } from "@/lib/data-mode";
import type { BigOfficialSyncPayload } from "@/lib/big-official";
import type {
  CandidateDataQuality,
  CandidateStrategyType,
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
  ProbabilityReadiness,
  ProductType,
  ProvisionalCall,
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
  TotoOfficialResultStatus,
  TotoOfficialRound,
  TotoOfficialRoundLibraryEntry,
  TotoOfficialRoundLibraryMatch,
  User,
  UserRole,
  VoidHandling,
} from "@/lib/types";

const namespace = "world-toto-lab:v1";

const localKeys = {
  candidateTickets: `${namespace}:candidateTickets`,
  candidateVotes: `${namespace}:candidateVotes`,
  currentRound: `${namespace}:currentRound`,
  fixtureMaster: `${namespace}:fixtureMaster`,
  generatedTickets: `${namespace}:generatedTickets`,
  matches: `${namespace}:matches`,
  officialRoundLibrary: `${namespace}:officialRoundLibrary`,
  picks: `${namespace}:picks`,
  researchMemos: `${namespace}:researchMemos`,
  reviewNotes: `${namespace}:reviewNotes`,
  roundEvAssumptions: `${namespace}:bigCarryoverAssumptions`,
  rounds: `${namespace}:rounds`,
  scoutReports: `${namespace}:scoutReports`,
  totoOfficialMatches: `${namespace}:totoOfficialMatches`,
  totoOfficialRounds: `${namespace}:totoOfficialRounds`,
  users: `${namespace}:users`,
} as const;

export type LocalRoundBundle = {
  candidateTickets: RoundWorkspace["round"]["candidateTickets"];
  candidateVotes: RoundWorkspace["round"]["candidateVotes"];
  generatedTickets: GeneratedTicket[];
  matches: Match[];
  metadata: {
    appVersion: string;
    dataMode: "demo" | "local" | "shared";
    exportedAt: string;
  };
  picks: Pick[];
  researchMemos: ResearchMemo[];
  reviewNotes: ReviewNote[];
  round: Round;
  scoutReports: HumanScoutReport[];
  roundEvAssumption: RoundEvAssumption | null;
  totoOfficialMatches: TotoOfficialMatch[];
  totoOfficialRound: TotoOfficialRound | null;
  users: User[];
};

export type LocalState = {
  candidateTickets: RoundWorkspace["round"]["candidateTickets"];
  candidateVotes: RoundWorkspace["round"]["candidateVotes"];
  fixtureMaster: FixtureMaster[];
  generatedTickets: GeneratedTicket[];
  matches: Match[];
  officialRoundLibrary: TotoOfficialRoundLibraryEntry[];
  picks: Pick[];
  researchMemos: ResearchMemo[];
  reviewNotes: ReviewNote[];
  roundEvAssumptions: RoundEvAssumption[];
  rounds: Round[];
  scoutReports: HumanScoutReport[];
  totoOfficialMatches: TotoOfficialMatch[];
  totoOfficialRounds: TotoOfficialRound[];
  users: User[];
};

function nowIso() {
  return new Date().toISOString();
}

function localId(prefix: string) {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }

  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function readArray<T>(key: string): T[] {
  if (typeof window === "undefined") {
    return [];
  }

  const raw = window.localStorage.getItem(key);
  if (!raw) {
    return [];
  }

  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed as T[] : [];
  } catch {
    return [];
  }
}

function writeArray<T>(key: string, rows: T[]) {
  if (typeof window === "undefined" || isDemoDataMode()) {
    return;
  }

  window.localStorage.setItem(key, JSON.stringify(rows));
}

function readLocalState(): LocalState {
  if (isDemoDataMode()) {
    return buildDemoState();
  }

  return {
    candidateTickets: readArray(localKeys.candidateTickets),
    candidateVotes: readArray(localKeys.candidateVotes),
    fixtureMaster: readArray(localKeys.fixtureMaster),
    generatedTickets: readArray(localKeys.generatedTickets),
    matches: readArray(localKeys.matches),
    officialRoundLibrary: readArray(localKeys.officialRoundLibrary),
    picks: readArray(localKeys.picks),
    researchMemos: readArray(localKeys.researchMemos),
    reviewNotes: readArray(localKeys.reviewNotes),
    roundEvAssumptions: readArray(localKeys.roundEvAssumptions),
    rounds: readArray(localKeys.rounds),
    scoutReports: readArray(localKeys.scoutReports),
    totoOfficialMatches: readArray(localKeys.totoOfficialMatches),
    totoOfficialRounds: readArray(localKeys.totoOfficialRounds),
    users: readArray(localKeys.users),
  };
}

function writeLocalState(state: LocalState) {
  writeArray(localKeys.candidateTickets, state.candidateTickets);
  writeArray(localKeys.candidateVotes, state.candidateVotes);
  writeArray(localKeys.fixtureMaster, state.fixtureMaster);
  writeArray(localKeys.generatedTickets, state.generatedTickets);
  writeArray(localKeys.matches, state.matches);
  writeArray(localKeys.officialRoundLibrary, state.officialRoundLibrary);
  writeArray(localKeys.picks, state.picks);
  writeArray(localKeys.researchMemos, state.researchMemos);
  writeArray(localKeys.reviewNotes, state.reviewNotes);
  writeArray(localKeys.roundEvAssumptions, state.roundEvAssumptions);
  writeArray(localKeys.rounds, state.rounds);
  writeArray(localKeys.scoutReports, state.scoutReports);
  writeArray(localKeys.totoOfficialMatches, state.totoOfficialMatches);
  writeArray(localKeys.totoOfficialRounds, state.totoOfficialRounds);
  writeArray(localKeys.users, state.users);
}

function saveCurrentRound(roundId: string) {
  if (typeof window !== "undefined" && !isDemoDataMode()) {
    window.localStorage.setItem(localKeys.currentRound, roundId);
  }
}

function assertWritable() {
  if (isDemoDataMode()) {
    throw new Error("デモモードでは保存しません。ローカル保存モードに切り替えると編集できます。");
  }
}

function sortUsers(users: User[]) {
  return users
    .slice()
    .sort((left, right) => left.role.localeCompare(right.role) || left.name.localeCompare(right.name));
}

function liveUsers(users: User[]) {
  return sortUsers(users.filter((user) => !isDemoAccountName(user.name)));
}

function demoUsers(users: User[]) {
  return sortUsers(users.filter((user) => isDemoAccountName(user.name)));
}

function resolveRoundProductDefaults(input: {
  competitionType?: CompetitionType | null;
  dataProfile?: DataProfile | null;
  matchCount?: number | null;
  outcomeSetJson?: string[] | null;
  primaryUse?: PrimaryUse | null;
  probabilityReadiness?: ProbabilityReadiness | null;
  productType?: ProductType;
  requiredMatchCount?: number | null;
  roundSource?: RoundSource;
  sourceNote?: string | null;
  sportContext?: SportContext | null;
  title?: string | null;
  voidHandling?: VoidHandling;
}) {
  const productType = input.productType ?? "toto13";
  const requiredMatchCount = normalizeRequiredMatchCount(productType, input.requiredMatchCount);
  const activeMatchCount =
    input.matchCount ?? requiredMatchCount ?? input.requiredMatchCount ?? 13;
  const productRule = buildProductRule({
    outcomeSetJson: input.outcomeSetJson ?? undefined,
    productType,
    requiredMatchCount,
    voidHandling: input.voidHandling,
  });
  const modeDefaults = resolveRoundModeDefaults({
    competitionType: input.competitionType ?? undefined,
    dataProfile: input.dataProfile ?? undefined,
    primaryUse: input.primaryUse ?? undefined,
    productType,
    sportContext: input.sportContext ?? undefined,
    title: input.title ?? undefined,
  });

  return {
    activeMatchCount,
    competitionType: modeDefaults.competitionType,
    dataProfile: modeDefaults.dataProfile,
    outcomeSetJson: normalizeOutcomeSet(productType, productRule.outcomeSetJson),
    primaryUse: modeDefaults.primaryUse,
    probabilityReadiness: input.probabilityReadiness ?? "not_ready",
    productType,
    requiredMatchCount: productRule.requiredMatchCount,
    roundSource: input.roundSource ?? "user_manual",
    sourceNote: input.sourceNote ?? null,
    sportContext: modeDefaults.sportContext,
    voidHandling: productRule.voidHandling,
  };
}

function placeholderMatches(roundId: string, count: number): Match[] {
  const createdAt = nowIso();
  return Array.from({ length: count }, (_, index) => ({
    actualResult: null,
    adminAdjust0: null,
    adminAdjust1: null,
    adminAdjust2: null,
    adminNote: null,
    altitudeHumidityAdjust: null,
    availabilityAdjust: null,
    availabilityInfo: null,
    awayStrengthAdjust: null,
    awayTeam: `アウェイ ${index + 1}`,
    category: null,
    confidence: null,
    consensusCall: null,
    consensusD: null,
    consensusF: null,
    conditionsAdjust: null,
    conditionsInfo: null,
    createdAt,
    disagreementScore: null,
    exceptionCount: null,
    fixtureMasterId: null,
    groupStandingMotivationAdjust: null,
    homeAdvantageAdjust: null,
    homeStrengthAdjust: null,
    homeTeam: `ホーム ${index + 1}`,
    id: localId("match"),
    injuryNote: null,
    injurySuspensionAdjust: null,
    kickoffTime: null,
    leagueTableMotivationAdjust: null,
    marketProb0: null,
    marketProb1: null,
    marketProb2: null,
    matchNo: index + 1,
    modelProb0: null,
    modelProb1: null,
    modelProb2: null,
    motivationAdjust: null,
    motivationNote: null,
    officialMatchNo: null,
    officialVote0: null,
    officialVote1: null,
    officialVote2: null,
    recentFormNote: null,
    recommendedOutcomes: null,
    restDaysAdjust: null,
    rotationRiskAdjust: null,
    roundId,
    squadDepthAdjust: null,
    stage: null,
    tacticalAdjust: null,
    tacticalNote: null,
    tournamentPressureAdjust: null,
    travelAdjust: null,
    travelClimateAdjust: null,
    updatedAt: createdAt,
    venue: null,
  }));
}

function attachPickRelations(picks: Pick[], users: User[]) {
  const userById = new Map(users.map((user) => [user.id, user]));
  return picks.map((pick) => ({ ...pick, user: userById.get(pick.userId) }));
}

function attachScoutRelations(reports: HumanScoutReport[], users: User[], matches: Match[]) {
  const userById = new Map(users.map((user) => [user.id, user]));
  const matchById = new Map(matches.map((match) => [match.id, match]));
  return reports.map((report) => ({
    ...report,
    match: matchById.get(report.matchId),
    user: userById.get(report.userId),
  }));
}

function attachVoteRelations(votes: RoundWorkspace["round"]["candidateVotes"], users: User[]) {
  const userById = new Map(users.map((user) => [user.id, user]));
  return votes.map((vote) => ({ ...vote, user: userById.get(vote.userId) }));
}

function attachReviewRelations(notes: ReviewNote[], users: User[], matches: Match[]) {
  const userById = new Map(users.map((user) => [user.id, user]));
  const matchById = new Map(matches.map((match) => [match.id, match]));
  return notes.map((note) => ({
    ...note,
    match: note.matchId ? matchById.get(note.matchId) : undefined,
    user: note.userId ? userById.get(note.userId) : undefined,
  }));
}

function attachMemoRelations(memos: ResearchMemo[], users: User[], matches: Match[]) {
  const userById = new Map(users.map((user) => [user.id, user]));
  const matchById = new Map(matches.map((match) => [match.id, match]));
  return memos.map((memo) => ({
    ...memo,
    match: memo.matchId ? matchById.get(memo.matchId) : undefined,
    user: userById.get(memo.createdBy),
  }));
}

function updateConsensusFields(matches: Match[], scoutReports: HumanScoutReport[], users: User[]) {
  const userById = new Map(users.map((user) => [user.id, user]));
  const reportsByMatch = new Map<string, HumanScoutReport[]>();
  scoutReports.forEach((report) => {
    if (userById.get(report.userId)?.role !== "admin") {
      return;
    }

    const current = reportsByMatch.get(report.matchId) ?? [];
    current.push(report);
    reportsByMatch.set(report.matchId, current);
  });

  return matches.map((match) => {
    const reports = reportsByMatch.get(match.id) ?? [];
    if (reports.length === 0) {
      return {
        ...match,
        consensusCall: null,
        consensusD: null,
        consensusF: null,
        disagreementScore: null,
        exceptionCount: null,
      };
    }

    const summary = computeConsensus(reports);
    return {
      ...match,
      consensusCall: summary.consensusCall,
      consensusD: summary.avgD,
      consensusF: summary.avgF,
      disagreementScore: summary.disagreementScore,
      exceptionCount: summary.exceptionCount,
    };
  });
}

function resolveUsersForRound(state: LocalState, round: Round) {
  const sourceUsers = isDemoRoundTitle(round.title) ? demoUsers(state.users) : liveUsers(state.users);
  return resolveRoundParticipantUsers(sourceUsers, round.participantIds);
}

/**
 * 配列状態（LocalState）から RoundWorkspace を組み立てる純粋関数。
 * local / D1 の両方で再利用する（consensus / readiness / 関連付けを含む）。
 */
export function workspaceFromState(state: LocalState, roundId: string): RoundWorkspace | null {
  const round = state.rounds.find((entry) => entry.id === roundId) ?? null;
  if (!round) {
    return null;
  }

  const users = resolveUsersForRound(state, round);
  const userIds = new Set(users.map((user) => user.id));
  const matches = state.matches
    .filter((match) => match.roundId === roundId)
    .sort((left, right) => left.matchNo - right.matchNo);
  const picks = attachPickRelations(
    state.picks.filter((pick) => pick.roundId === roundId && userIds.has(pick.userId)),
    users,
  );
  const scoutReports = attachScoutRelations(
    state.scoutReports.filter((report) => report.roundId === roundId && userIds.has(report.userId)),
    users,
    matches,
  );
  const consensusMatches = updateConsensusFields(matches, scoutReports, users);
  const researchMemos = attachMemoRelations(
    state.researchMemos.filter((memo) => memo.roundId === roundId),
    users,
    consensusMatches,
  ).sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
  const inferredProbabilityReadiness = summarizeRoundReadiness({
    matches: consensusMatches,
    researchMemos,
    round,
  }).level;

  return {
    availableUsers: isDemoRoundTitle(round.title) ? users : liveUsers(state.users),
    round: {
      ...round,
      probabilityReadiness:
        inferredProbabilityReadiness ?? inferRoundProbabilityReadiness(consensusMatches),
      candidateTickets: state.candidateTickets.filter((ticket) => ticket.roundId === roundId),
      candidateVotes: attachVoteRelations(
        state.candidateVotes.filter((vote) => vote.roundId === roundId && userIds.has(vote.userId)),
        users,
      ),
      evAssumption:
        state.roundEvAssumptions.find((assumption) => assumption.roundId === roundId) ?? null,
      generatedTickets: state.generatedTickets.filter((ticket) => ticket.roundId === roundId),
      matches: consensusMatches,
      picks,
      researchMemos,
      reviewNotes: attachReviewRelations(
        state.reviewNotes.filter(
          (note) => note.roundId === roundId && (!note.userId || userIds.has(note.userId)),
        ),
        users,
        consensusMatches,
      ).sort((left, right) => right.createdAt.localeCompare(left.createdAt)),
      scoutReports,
      totoOfficialMatches: state.totoOfficialMatches.filter((match) => match.roundId === roundId),
      totoOfficialRound:
        state.totoOfficialRounds.find((entry) => entry.roundId === roundId) ?? null,
    },
    users,
  };
}

/** RoundWorkspace から Dashboard 用サマリを作る純粋関数（local / D1 共用）。 */
export function summaryFromWorkspace(workspace: RoundWorkspace): DashboardRoundSummary {
  const round = workspace.round;
  const resultedCount = round.matches.filter((match) => match.actualResult !== null).length;
  const advantageRows = buildAdvantageRows({
    matches: round.matches,
    picks: round.picks,
    users: workspace.users,
  });

  return {
    ...round,
    candidateTicketCount: round.candidateTickets.length,
    consensusCompletion:
      round.matches.length > 0
        ? round.matches.filter((match) => match.consensusCall || match.consensusF !== null || match.consensusD !== null).length /
          round.matches.length
        : 0,
    matchCount: round.matches.length,
    pickCount: round.picks.length,
    resultedCount,
    reviewNotes: round.reviewNotes,
    scoutReports: round.scoutReports,
    topSignals: advantageRows
      .filter((row) => row.include)
      .slice(0, 3)
      .map((row) => ({
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

function buildDemoState(): LocalState {
  const createdAt = "2026-01-01T00:00:00.000Z";
  const users = defaultDemoUsers.map((user, index): User => ({
    createdAt,
    id: `demo-user-${index + 1}`,
    name: user.name,
    role: user.role,
    updatedAt: createdAt,
  }));
  const roundId = "demo-round";
  const round: Round = {
    activeMatchCount: 13,
    budgetYen: demoTicketSettings.budgetYen,
    competitionType: "world_cup",
    createdAt,
    dataProfile: "demo",
    id: roundId,
    notes: demoRoundNotes,
    outcomeSetJson: buildProductRule({ productType: "toto13" }).outcomeSetJson,
    participantIds: users.map((user) => user.id),
    primaryUse: "demo",
    probabilityReadiness: "partial",
    productType: "toto13",
    requiredMatchCount: 13,
    roundSource: "demo_sample",
    sourceNote: "デモ用サンプルラウンド",
    sportContext: "national_team",
    status: "reviewed",
    title: demoRoundTitle,
    updatedAt: createdAt,
    voidHandling: "manual",
  };
  const matches: Match[] = buildDemoMatchRows(roundId).map((row, index) => ({
    ...placeholderMatches(roundId, 13)[index],
    actualResult: row.actual_result,
    adminNote: row.admin_note ?? null,
    awayTeam: row.away_team,
    category: row.category ?? null,
    confidence: row.confidence ?? null,
    homeTeam: row.home_team,
    id: `demo-match-${index + 1}`,
    injuryNote: row.injury_note ?? null,
    kickoffTime: row.kickoff_time ?? null,
    marketProb0: row.market_prob_0 ?? null,
    marketProb1: row.market_prob_1 ?? null,
    marketProb2: row.market_prob_2 ?? null,
    matchNo: row.match_no,
    modelProb0: row.model_prob_0 ?? null,
    modelProb1: row.model_prob_1 ?? null,
    modelProb2: row.model_prob_2 ?? null,
    motivationNote: row.motivation_note ?? null,
    officialVote0: row.official_vote_0 ?? null,
    officialVote1: row.official_vote_1 ?? null,
    officialVote2: row.official_vote_2 ?? null,
    recommendedOutcomes: row.recommended_outcomes ?? null,
    stage: row.stage ?? null,
    tacticalNote: row.tactical_note ?? null,
    venue: row.venue ?? null,
  }));
  const matchIdByNo = new Map(matches.map((match) => [match.matchNo, match.id]));
  const matchByOldId = new Map(buildDemoMatchRows(roundId).map((row) => [`${row.round_id}:${row.match_no}`, matchIdByNo.get(row.match_no) ?? ""]));
  const demoPickRows = buildDemoPickRows(roundId, matches, users);
  const picks: Pick[] = demoPickRows.map((row, index) => ({
    createdAt,
    id: `demo-pick-${index + 1}`,
    matchId: row.match_id,
    note: row.note,
    pick: row.pick,
    roundId,
    support: { kind: "manual" },
    updatedAt: createdAt,
    userId: row.user_id,
  }));
  const scoutReports: HumanScoutReport[] = buildDemoScoutReportRows(
    roundId,
    matches,
    users.filter((user) => user.role === "admin").map((user) => user.id),
  ).map((row, index) => ({
    createdAt,
    directionScoreF: row.direction_score_f,
    drawAlert: row.draw_alert,
    exceptionFlag: row.exception_flag,
    exceptionNote: row.exception_note,
    id: `demo-scout-${index + 1}`,
    matchId: row.match_id,
    noteAvailability: row.note_availability,
    noteConditions: row.note_conditions,
    noteDrawAlert: row.note_draw_alert,
    noteMicro: row.note_micro,
    noteStrengthForm: row.note_strength_form,
    noteTacticalMatchup: row.note_tactical_matchup,
    provisionalCall: row.provisional_call,
    roundId,
    scoreAvailability: row.score_availability,
    scoreConditions: row.score_conditions,
    scoreMicro: row.score_micro,
    scoreStrengthForm: row.score_strength_form,
    scoreTacticalMatchup: row.score_tactical_matchup,
    updatedAt: createdAt,
    userId: row.user_id,
  }));
  const reviewNotes: ReviewNote[] = buildDemoReviewNotes(roundId, matches, users).map((row, index) => ({
    createdAt,
    id: `demo-review-${index + 1}`,
    matchId: row.match_id ? matchByOldId.get(row.match_id) ?? row.match_id : null,
    note: row.note,
    roundId,
    userId: row.user_id,
  }));
  const consensusMatches = updateConsensusFields(matches, scoutReports, users);
  const generated = generateCandidateTickets({
    evAssumption: null,
    matches: consensusMatches,
    picks,
    roundTitle: round.title,
    scoutReports,
    users,
  });

  return {
    candidateTickets: generated.tickets.map((ticket, index) => ({
      ...ticket,
      createdAt,
      id: `demo-candidate-${index + 1}`,
      roundId,
      updatedAt: createdAt,
    })),
    candidateVotes: [],
    fixtureMaster: [],
    generatedTickets: [],
    matches: consensusMatches,
    officialRoundLibrary: [],
    picks,
    researchMemos: [],
    reviewNotes,
    roundEvAssumptions: [],
    rounds: [round],
    scoutReports,
    totoOfficialMatches: [],
    totoOfficialRounds: [],
    users,
  };
}

function ensureLocalUsers(state: LocalState) {
  if (state.users.length > 0) {
    return state;
  }

  const createdAt = nowIso();
  state.users = defaultInitialUsers.map((user) => ({
    createdAt,
    id: localId("user"),
    name: user.name,
    role: user.role,
    updatedAt: createdAt,
  }));
  return state;
}

export async function localListDashboardData(): Promise<DashboardData> {
  const state = readLocalState();
  const rounds = state.rounds
    .slice()
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt))
    .flatMap((round) => {
      const workspace = workspaceFromState(state, round.id);
      return workspace ? [summaryFromWorkspace(workspace)] : [];
    });

  return {
    demoUsers: demoUsers(state.users),
    rounds,
    users: liveUsers(state.users),
  };
}

export async function localGetRoundWorkspace(roundId: string): Promise<RoundWorkspace | null> {
  return workspaceFromState(readLocalState(), roundId);
}

export async function localCreateInitialUsers() {
  assertWritable();
  const state = readLocalState();
  if (liveUsers(state.users).length > 0) {
    return;
  }

  const createdAt = nowIso();
  state.users.push(
    ...defaultInitialUsers.map((user) => ({
      createdAt,
      id: localId("user"),
      name: user.name,
      role: user.role,
      updatedAt: createdAt,
    })),
  );
  writeLocalState(state);
}

export async function localCreateUser(input: { name: string; role?: UserRole }) {
  assertWritable();
  const name = input.name.trim();
  if (!name) {
    throw new Error("あだ名を入力してください。");
  }

  const state = readLocalState();
  const createdAt = nowIso();
  state.users.push({
    createdAt,
    id: localId("user"),
    name,
    role: input.role ?? "member",
    updatedAt: createdAt,
  });
  writeLocalState(state);
}

export async function localUpdateUserProfile(input: { name: string; role: UserRole; userId: string }) {
  assertWritable();
  const name = input.name.trim();
  if (!name) {
    throw new Error("あだ名を空にはできません。");
  }

  const state = readLocalState();
  state.users = state.users.map((user) =>
    user.id === input.userId
      ? { ...user, name, role: input.role, updatedAt: nowIso() }
      : user,
  );
  writeLocalState(state);
}

export async function localDeleteUserIfInactive(userId: string) {
  assertWritable();
  const state = readLocalState();
  const hasUsage =
    state.picks.some((pick) => pick.userId === userId) ||
    state.scoutReports.some((report) => report.userId === userId) ||
    state.reviewNotes.some((note) => note.userId === userId) ||
    state.candidateVotes.some((vote) => vote.userId === userId);

  if (hasUsage) {
    throw new Error("このメンバーには入力データがあります。内容を消してからでないと整理できません。");
  }

  state.users = state.users.filter((user) => user.id !== userId);
  writeLocalState(state);
}

export async function localDeleteRound(roundId: string) {
  assertWritable();
  const state = readLocalState();
  state.rounds = state.rounds.filter((round) => round.id !== roundId);
  state.matches = state.matches.filter((match) => match.roundId !== roundId);
  state.picks = state.picks.filter((pick) => pick.roundId !== roundId);
  state.scoutReports = state.scoutReports.filter((report) => report.roundId !== roundId);
  state.researchMemos = state.researchMemos.filter((memo) => memo.roundId !== roundId);
  state.generatedTickets = state.generatedTickets.filter((ticket) => ticket.roundId !== roundId);
  state.roundEvAssumptions = state.roundEvAssumptions.filter((assumption) => assumption.roundId !== roundId);
  state.candidateTickets = state.candidateTickets.filter((ticket) => ticket.roundId !== roundId);
  state.candidateVotes = state.candidateVotes.filter((vote) => vote.roundId !== roundId);
  state.reviewNotes = state.reviewNotes.filter((note) => note.roundId !== roundId);
  state.totoOfficialRounds = state.totoOfficialRounds.filter((round) => round.roundId !== roundId);
  state.totoOfficialMatches = state.totoOfficialMatches.filter((match) => match.roundId !== roundId);
  writeLocalState(state);
}

export async function localCreateRound(input: {
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
  assertWritable();
  const state = ensureLocalUsers(readLocalState());
  const createdAt = nowIso();
  const defaults = resolveRoundProductDefaults(input);
  const round: Round = {
    activeMatchCount: defaults.activeMatchCount,
    budgetYen: input.budgetYen,
    competitionType: defaults.competitionType,
    createdAt,
    dataProfile: defaults.dataProfile,
    id: localId("round"),
    notes: input.notes,
    outcomeSetJson: defaults.outcomeSetJson,
    participantIds: input.participantIds ?? [],
    primaryUse: defaults.primaryUse,
    probabilityReadiness: defaults.probabilityReadiness,
    productType: defaults.productType,
    requiredMatchCount: defaults.requiredMatchCount,
    roundSource: defaults.roundSource,
    sourceNote: defaults.sourceNote,
    sportContext: defaults.sportContext,
    status: input.status,
    title: input.title,
    updatedAt: createdAt,
    voidHandling: defaults.voidHandling,
  };

  state.rounds.push(round);
  state.matches.push(...placeholderMatches(round.id, defaults.activeMatchCount));
  writeLocalState(state);
  saveCurrentRound(round.id);
  return round.id;
}

export async function localCreateDemoRound() {
  if (isDemoDataMode()) {
    return "demo-round";
  }

  assertWritable();
  const demo = buildDemoState();
  const state = readLocalState();
  await localDeleteRound(demo.rounds[0].id).catch(() => undefined);
  const existingDemoIds = new Set(state.users.filter((user) => isDemoAccountName(user.name)).map((user) => user.id));
  state.users = state.users.filter((user) => !existingDemoIds.has(user.id));
  state.users.push(...demo.users);
  state.rounds = state.rounds.filter((round) => round.id !== "demo-round");
  state.rounds.push(...demo.rounds);
  state.matches = state.matches.filter((match) => match.roundId !== "demo-round").concat(demo.matches);
  state.picks = state.picks.filter((pick) => pick.roundId !== "demo-round").concat(demo.picks);
  state.scoutReports = state.scoutReports.filter((report) => report.roundId !== "demo-round").concat(demo.scoutReports);
  state.reviewNotes = state.reviewNotes.filter((note) => note.roundId !== "demo-round").concat(demo.reviewNotes);
  state.candidateTickets = state.candidateTickets.filter((ticket) => ticket.roundId !== "demo-round").concat(demo.candidateTickets);
  writeLocalState(state);
  saveCurrentRound("demo-round");
  return "demo-round";
}

export async function localUpdateRound(input: {
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
  assertWritable();
  const state = readLocalState();
  const current = state.rounds.find((round) => round.id === input.roundId);
  if (!current) {
    throw new Error("更新対象のラウンドが見つかりません。");
  }

  const defaults = resolveRoundProductDefaults({
    ...current,
    ...input,
    matchCount: current.activeMatchCount,
  });
  state.rounds = state.rounds.map((round) =>
    round.id === input.roundId
      ? {
          ...round,
          budgetYen: input.budgetYen,
          competitionType: defaults.competitionType,
          dataProfile: defaults.dataProfile,
          notes: input.notes,
          outcomeSetJson: defaults.outcomeSetJson,
          participantIds: input.participantIds ?? round.participantIds,
          primaryUse: defaults.primaryUse,
          probabilityReadiness: defaults.probabilityReadiness,
          productType: defaults.productType,
          requiredMatchCount: defaults.requiredMatchCount,
          roundSource: defaults.roundSource,
          sourceNote: defaults.sourceNote,
          sportContext: defaults.sportContext,
          status: input.status,
          title: input.title,
          updatedAt: nowIso(),
          voidHandling: defaults.voidHandling,
        }
      : round,
  );
  state.generatedTickets = state.generatedTickets.filter((ticket) => ticket.roundId !== input.roundId);
  writeLocalState(state);
}

export async function localUpdateMatch(input: {
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
  assertWritable();
  const state = readLocalState();
  const updatedAt = nowIso();
  state.matches = state.matches.map((match) =>
    match.id === input.matchId && match.roundId === input.roundId
      ? {
          ...match,
          ...input,
          updatedAt,
        }
      : match,
  );
  state.generatedTickets = state.generatedTickets.filter((ticket) => ticket.roundId !== input.roundId);
  writeLocalState(state);
}

export async function localBulkUpdateRoundMatches(input: {
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
  assertWritable();
  const state = readLocalState();
  const updatedAt = nowIso();
  const byMatchNo = new Map(input.rows.map((row) => [row.matchNo, row]));
  state.matches = state.matches.map((match) => {
    if (match.roundId !== input.roundId) {
      return match;
    }

    const row = byMatchNo.get(match.matchNo);
    return row
      ? {
          ...match,
          adminNote: row.adminNote ?? match.adminNote,
          awayTeam: row.awayTeam,
          homeTeam: row.homeTeam,
          kickoffTime: row.kickoffTime ?? match.kickoffTime,
          stage: row.stage ?? match.stage,
          updatedAt,
          venue: row.venue ?? match.venue,
        }
      : match;
  });
  state.generatedTickets = state.generatedTickets.filter((ticket) => ticket.roundId !== input.roundId);
  writeLocalState(state);
}

export async function localEstimateRoundAiModel(input: { overwriteExisting?: boolean; roundId: string }) {
  assertWritable();
  const state = readLocalState();
  const round = state.rounds.find((entry) => entry.id === input.roundId) ?? null;
  let updatedCount = 0;
  let skippedCount = 0;
  state.matches = state.matches.map((match) => {
    if (match.roundId !== input.roundId) {
      return match;
    }

    const hasExistingModel = match.modelProb1 !== null || match.modelProb0 !== null || match.modelProb2 !== null;
    if (hasExistingModel && !input.overwriteExisting) {
      skippedCount += 1;
      return match;
    }

    const estimated = calculateModelProbabilities({
      ...match,
      competitionType: round?.competitionType ?? "world_cup",
      dataProfile: round?.dataProfile ?? "manual_light",
    });

    if (!estimated) {
      skippedCount += 1;
      return match;
    }

    updatedCount += 1;
    return {
      ...match,
      modelProb0: estimated.modelProb0,
      modelProb1: estimated.modelProb1,
      modelProb2: estimated.modelProb2,
      recommendedOutcomes: [estimated.modelProb1, estimated.modelProb0, estimated.modelProb2]
        .map((value, index) => ({ index, value }))
        .sort((left, right) => right.value - left.value)
        .slice(0, 2)
        .map((entry) => (entry.index === 0 ? "1" : entry.index === 1 ? "0" : "2"))
        .join(","),
      updatedAt: nowIso(),
    };
  });
  state.generatedTickets = state.generatedTickets.filter((ticket) => ticket.roundId !== input.roundId);
  writeLocalState(state);
  return { skippedCount, updatedCount };
}

export async function localReplacePicks(input: {
  roundId: string;
  userId: string;
  picks: Array<{
    matchId: string;
    note: string | null;
    pick: Outcome | null;
    support?: PickSupport;
  }>;
}) {
  assertWritable();
  const state = readLocalState();
  const createdAt = nowIso();
  state.picks = state.picks.filter((pick) => !(pick.roundId === input.roundId && pick.userId === input.userId));
  state.picks.push(
    ...input.picks
      .filter((pick) => pick.pick !== null)
      .map((pick) => ({
        createdAt,
        id: localId("pick"),
        matchId: pick.matchId,
        note: pick.note,
        pick: pick.pick as Outcome,
        roundId: input.roundId,
        support: pick.support ?? { kind: "manual" as const },
        updatedAt: createdAt,
        userId: input.userId,
      })),
  );
  state.generatedTickets = state.generatedTickets.filter((ticket) => ticket.roundId !== input.roundId);
  writeLocalState(state);
}

export async function localReplaceScoutReports(input: {
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
  assertWritable();
  const state = readLocalState();
  const createdAt = nowIso();
  state.scoutReports = state.scoutReports.filter((report) => !(report.roundId === input.roundId && report.userId === input.userId));
  state.scoutReports.push(
    ...input.reports.map((report) => ({
      ...report,
      createdAt,
      id: localId("scout"),
      roundId: input.roundId,
      updatedAt: createdAt,
      userId: input.userId,
    })),
  );
  const roundUsers = state.rounds.find((round) => round.id === input.roundId)
    ? resolveUsersForRound(state, state.rounds.find((round) => round.id === input.roundId)!)
    : state.users;
  const roundReports = state.scoutReports.filter((report) => report.roundId === input.roundId);
  state.matches = state.matches.map((match) =>
    match.roundId === input.roundId
      ? updateConsensusFields([match], roundReports, roundUsers)[0]
      : match,
  );
  state.generatedTickets = state.generatedTickets.filter((ticket) => ticket.roundId !== input.roundId);
  writeLocalState(state);
}

export async function localReplaceGeneratedTickets(input: {
  budgetYen: number;
  roundId: string;
  tickets: Array<{
    contrarianScore: number;
    estimatedHitProb: number;
    mode: TicketMode;
    ticketJson: string;
    ticketScore: number;
  }>;
}) {
  assertWritable();
  const state = readLocalState();
  const createdAt = nowIso();
  state.rounds = state.rounds.map((round) =>
    round.id === input.roundId ? { ...round, budgetYen: input.budgetYen, updatedAt: createdAt } : round,
  );
  state.generatedTickets = state.generatedTickets.filter((ticket) => ticket.roundId !== input.roundId);
  state.generatedTickets.push(
    ...input.tickets.map((ticket) => ({
      ...ticket,
      createdAt,
      id: localId("generated-ticket"),
      roundId: input.roundId,
    })),
  );
  writeLocalState(state);
}

export async function localListFixtureMaster(input?: {
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
  const state = readLocalState();
  const normalize = (value: string | null | undefined) => (value ?? "").toLowerCase().trim();
  const teamNeedle = normalize(input?.teamQuery);
  const venueNeedle = normalize(input?.venueQuery);
  const groupNeedle = normalize(input?.groupName);
  const stageNeedle = normalize(input?.stage);

  return state.fixtureMaster
    .filter((fixture) => !input?.competition || fixture.competition === input.competition)
    .filter((fixture) => !input?.source || fixture.source === input.source)
    .filter((fixture) => !input?.dataConfidence || fixture.dataConfidence === input.dataConfidence)
    .filter((fixture) => !input?.dateFrom || (fixture.matchDate ?? "") >= input.dateFrom!)
    .filter((fixture) => !input?.dateTo || (fixture.matchDate ?? "") <= input.dateTo!)
    .filter((fixture) => !teamNeedle || normalize(`${fixture.homeTeam} ${fixture.awayTeam}`).includes(teamNeedle))
    .filter((fixture) => !venueNeedle || normalize(fixture.venue).includes(venueNeedle))
    .filter((fixture) => !groupNeedle || normalize(fixture.groupName).includes(groupNeedle))
    .filter((fixture) => !stageNeedle || normalize(fixture.stage).includes(stageNeedle))
    .sort((left, right) => (left.matchDate ?? "").localeCompare(right.matchDate ?? ""));
}

export async function localSaveFixtureMasterEntries(input: {
  entries: Array<{
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
  }>;
}) {
  assertWritable();
  const state = readLocalState();
  const createdAt = nowIso();
  let insertedCount = 0;
  let updatedCount = 0;
  const warnings: string[] = [];

  input.entries.forEach((entry) => {
    const existingIndex = state.fixtureMaster.findIndex((fixture) =>
      entry.externalFixtureId
        ? fixture.source === entry.source && fixture.externalFixtureId === entry.externalFixtureId
        : fixture.competition === entry.competition &&
          fixture.homeTeam === entry.homeTeam &&
          fixture.awayTeam === entry.awayTeam &&
          fixture.matchDate === entry.matchDate,
    );
    const next: FixtureMaster = {
      ...entry,
      createdAt: existingIndex >= 0 ? state.fixtureMaster[existingIndex].createdAt : createdAt,
      id: existingIndex >= 0 ? state.fixtureMaster[existingIndex].id : localId("fixture"),
      updatedAt: createdAt,
    };

    if (existingIndex >= 0) {
      state.fixtureMaster[existingIndex] = next;
      updatedCount += 1;
    } else {
      state.fixtureMaster.push(next);
      insertedCount += 1;
    }
  });

  writeLocalState(state);
  return { insertedCount, skippedCount: 0, updatedCount, warnings };
}

export async function localCreateRoundFromFixtures(input: {
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
  assertWritable();
  const state = readLocalState();
  const fixtures = input.fixtureIds
    .map((id) => state.fixtureMaster.find((fixture) => fixture.id === id))
    .filter((fixture): fixture is FixtureMaster => Boolean(fixture));
  if (fixtures.length === 0) {
    throw new Error("Round に使う試合を1つ以上選んでください。");
  }

  const existingState = readLocalState();
  const existingRound = input.roundId
    ? existingState.rounds.find((round) => round.id === input.roundId)
    : null;
  const roundId =
    existingRound?.id ??
    (await localCreateRound({
      budgetYen: input.budgetYen,
      matchCount: fixtures.length,
      notes: input.notes,
      outcomeSetJson: input.outcomeSetJson,
      participantIds: input.participantIds,
      productType: input.productType,
      requiredMatchCount: input.requiredMatchCount ?? fixtures.length,
      roundSource: "fixture_master",
      sourceNote: input.sourceNote,
      status: input.status,
      title: input.title,
      voidHandling: input.voidHandling,
    }));

  const nextState = readLocalState();
  nextState.matches = nextState.matches.filter((match) => match.roundId !== roundId);
  nextState.matches.push(
    ...fixtures.map((fixture, index) => ({
      ...placeholderMatches(roundId, fixtures.length)[index],
      awayTeam: fixture.awayTeam,
      fixtureMasterId: fixture.id,
      homeTeam: fixture.homeTeam,
      kickoffTime: fixture.kickoffTime,
      stage: fixture.stage ?? fixture.groupName,
      venue: fixture.venue,
    })),
  );
  nextState.rounds = nextState.rounds.map((round) =>
    round.id === roundId
      ? {
          ...round,
          activeMatchCount: fixtures.length,
          budgetYen: input.budgetYen,
          notes: input.notes,
          participantIds: input.participantIds ?? round.participantIds,
          status: input.status,
          title: input.title,
          updatedAt: nowIso(),
        }
      : round,
  );
  writeLocalState(nextState);
  return roundId;
}

export async function localListTotoOfficialRoundLibrary(input?: {
  productType?: ProductType | null;
  query?: string | null;
  resultStatus?: TotoOfficialResultStatus | null;
  searchQuery?: string | null;
}) {
  const query = (input?.query ?? input?.searchQuery ?? "").trim().toLowerCase();
  return readLocalState().officialRoundLibrary
    .filter((entry) => !input?.productType || entry.productType === input.productType)
    .filter((entry) => !input?.resultStatus || entry.resultStatus === input.resultStatus)
    .filter((entry) => !query || `${entry.title} ${entry.officialRoundName ?? ""}`.toLowerCase().includes(query))
    .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
}

export async function localGetTotoOfficialRoundLibraryEntry(id: string) {
  return readLocalState().officialRoundLibrary.find((entry) => entry.id === id) ?? null;
}

function officialLibraryEntryFromInput(input: {
  carryoverYen: number;
  firstPrizeShare: number | null;
  notes: string | null;
  officialRoundName: string | null;
  officialRoundNumber: number | null;
  outcomeSetJson?: string[] | null;
  payoutCapYen: number | null;
  productType: ProductType;
  requiredMatchCount?: number | null;
  resultStatus: TotoOfficialResultStatus;
  returnRate: number;
  rows: TotoOfficialRoundLibraryMatch[];
  salesEndAt: string | null;
  salesStartAt: string | null;
  sourceNote?: string | null;
  sourceText: string | null;
  sourceUrl: string | null;
  stakeYen: number;
  title?: string | null;
  totalSalesYen: number | null;
  voidHandling?: VoidHandling;
}, id: string, createdAt: string): TotoOfficialRoundLibraryEntry {
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
    carryoverYen: input.carryoverYen,
    createdAt,
    firstPrizeShare: input.firstPrizeShare,
    id,
    matchCount: input.rows.length,
    matches: input.rows,
    notes: input.notes,
    officialRoundName: input.officialRoundName,
    officialRoundNumber: input.officialRoundNumber,
    outcomeSetJson: defaults.outcomeSetJson,
    payoutCapYen: input.payoutCapYen,
    productType: defaults.productType,
    requiredMatchCount: defaults.requiredMatchCount,
    resultStatus: input.resultStatus,
    returnRate: input.returnRate,
    salesEndAt: input.salesEndAt,
    salesStartAt: input.salesStartAt,
    sourceNote: defaults.sourceNote,
    sourceText: input.sourceText,
    sourceUrl: input.sourceUrl,
    stakeYen: input.stakeYen,
    title: input.title ?? input.officialRoundName ?? "公式対象回",
    totalSalesYen: input.totalSalesYen,
    updatedAt: nowIso(),
    voidHandling: defaults.voidHandling,
  };
}

export async function localSaveTotoOfficialRoundLibraryEntry(input: {
  carryoverYen: number;
  firstPrizeShare: number | null;
  id?: string | null;
  notes: string | null;
  officialRoundName: string | null;
  officialRoundNumber: number | null;
  outcomeSetJson?: string[] | null;
  payoutCapYen: number | null;
  productType: ProductType;
  requiredMatchCount?: number | null;
  resultStatus: TotoOfficialResultStatus;
  returnRate: number;
  rows: TotoOfficialRoundLibraryMatch[];
  salesEndAt: string | null;
  salesStartAt: string | null;
  sourceNote?: string | null;
  sourceText: string | null;
  sourceUrl: string | null;
  stakeYen: number;
  title?: string | null;
  totalSalesYen: number | null;
  voidHandling?: VoidHandling;
}) {
  assertWritable();
  if (input.rows.length === 0) {
    throw new Error("公式対象試合を1件以上取り込んでください。");
  }

  const state = readLocalState();
  const existing = input.id
    ? state.officialRoundLibrary.find((entry) => entry.id === input.id)
    : null;
  const entry = officialLibraryEntryFromInput(
    input,
    existing?.id ?? input.id ?? localId("official-library"),
    existing?.createdAt ?? nowIso(),
  );
  state.officialRoundLibrary = state.officialRoundLibrary.filter((item) => item.id !== entry.id);
  state.officialRoundLibrary.push(entry);
  writeLocalState(state);
  return entry;
}

export async function localUpsertTotoOfficialRoundLibraryFromSync(input: {
  entries: Array<{
    carryoverYen: number;
    firstPrizeShare: number | null;
    matches: TotoOfficialRoundLibraryMatch[];
    notes: string | null;
    officialRoundName: string | null;
    officialRoundNumber: number | null;
    outcomeSetJson: string[] | null;
    payoutCapYen: number | null;
    productType: ProductType;
    requiredMatchCount: number | null;
    resultStatus: TotoOfficialResultStatus;
    returnRate: number;
    salesEndAt: string | null;
    salesStartAt: string | null;
    sourceNote: string | null;
    sourceText: string | null;
    sourceUrl: string | null;
    stakeYen: number;
    title: string;
    totalSalesYen: number | null;
    voidHandling: VoidHandling;
  }>;
  sourceUrl: string | null;
}) {
  assertWritable();
  let insertedCount = 0;
  let updatedCount = 0;
  let skippedCount = 0;
  const warnings: string[] = [];

  for (const entry of input.entries) {
    if (!entry.title) {
      skippedCount += 1;
      warnings.push("タイトル不明の回をスキップしました。");
      continue;
    }

    const state = readLocalState();
    const existing = state.officialRoundLibrary.find((item) =>
      entry.officialRoundNumber !== null
        ? item.officialRoundNumber === entry.officialRoundNumber && item.productType === entry.productType
        : item.title === entry.title && item.productType === entry.productType,
    );

    await localSaveTotoOfficialRoundLibraryEntry({
      ...entry,
      id: existing?.id,
      rows: entry.matches,
      sourceUrl: entry.sourceUrl ?? input.sourceUrl,
    });

    if (existing) {
      updatedCount += 1;
    } else {
      insertedCount += 1;
    }
  }

  return { insertedCount, skippedCount, updatedCount, warnings };
}

export async function localSaveTotoOfficialRoundImport(input: {
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
  rows: TotoOfficialRoundLibraryMatch[];
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
}) {
  assertWritable();
  if (input.rows.length === 0) {
    throw new Error("公式対象試合を1件以上取り込んでください。");
  }

  const existingState = readLocalState();
  const existingRound = input.roundId
    ? existingState.rounds.find((round) => round.id === input.roundId)
    : null;
  const roundId =
    existingRound?.id ??
    (await localCreateRound({
      budgetYen: null,
      matchCount: input.rows.length,
      notes: input.notes,
      outcomeSetJson: input.outcomeSetJson,
      participantIds: input.participantIds,
      productType: input.productType,
      requiredMatchCount: input.requiredMatchCount ?? input.rows.length,
      roundSource: "toto_official_manual",
      sourceNote: input.sourceNote ?? input.officialRoundName,
      status: input.status ?? "analyzing",
      title: input.title ?? input.officialRoundName ?? "公式対象回",
      voidHandling: input.voidHandling,
    }));
  const state = readLocalState();
  const now = nowIso();
  state.matches = state.matches.filter((match) => match.roundId !== roundId);
  state.matches.push(
    ...input.rows.map((row, index) => ({
      ...placeholderMatches(roundId, input.rows.length)[index],
      actualResult: row.actualResult,
      awayTeam: row.awayTeam,
      fixtureMasterId: row.fixtureMasterId,
      homeTeam: row.homeTeam,
      kickoffTime: row.kickoffTime,
      officialMatchNo: row.officialMatchNo,
      officialVote0: row.officialVote0,
      officialVote1: row.officialVote1,
      officialVote2: row.officialVote2,
      stage: row.stage,
      venue: row.venue,
    })),
  );
  state.totoOfficialRounds = state.totoOfficialRounds.filter((round) => round.roundId !== roundId);
  state.totoOfficialRounds.push({
    carryoverYen: input.carryoverYen,
    createdAt: now,
    firstPrizeShare: input.firstPrizeShare,
    id: localId("official-round"),
    officialRoundName: input.officialRoundName,
    officialRoundNumber: input.officialRoundNumber,
    payoutCapYen: input.payoutCapYen,
    productType: input.productType,
    resultStatus: input.resultStatus,
    returnRate: input.returnRate,
    roundId,
    salesEndAt: input.salesEndAt,
    salesStartAt: input.salesStartAt,
    sourceText: input.sourceText,
    sourceUrl: input.sourceUrl,
    stakeYen: input.stakeYen,
    totalSalesYen: input.totalSalesYen,
    updatedAt: now,
  });
  state.totoOfficialMatches = state.totoOfficialMatches.filter((match) => match.roundId !== roundId);
  state.totoOfficialMatches.push(
    ...input.rows.map((row) => ({
      actualResult: row.actualResult,
      awayTeam: row.awayTeam,
      createdAt: now,
      fixtureMasterId: row.fixtureMasterId,
      homeTeam: row.homeTeam,
      id: localId("official-match"),
      kickoffTime: row.kickoffTime,
      matchId: null,
      matchStatus: row.matchStatus,
      officialMatchNo: row.officialMatchNo,
      officialVote0: row.officialVote0,
      officialVote1: row.officialVote1,
      officialVote2: row.officialVote2,
      roundId,
      sourceText: row.sourceText,
      stage: row.stage,
      updatedAt: now,
      venue: row.venue,
    })),
  );
  writeLocalState(state);
  await localSaveRoundEvAssumption({
    carryoverYen: input.carryoverYen,
    firstPrizeShare: input.firstPrizeShare ?? 0.7,
    note: input.officialRoundName,
    payoutCapYen: input.payoutCapYen,
    returnRate: input.returnRate,
    roundId,
    stakeYen: input.stakeYen,
    totalSalesYen: input.totalSalesYen,
  });
  return roundId;
}

export async function localInstantiateTotoOfficialRoundLibraryEntry(input: {
  entryId: string;
  notes?: string | null;
  participantIds?: string[];
  roundId?: string | null;
  sourceNote?: string | null;
  status?: RoundStatus;
  title?: string | null;
}) {
  const entry = await localGetTotoOfficialRoundLibraryEntry(input.entryId);
  if (!entry) {
    throw new Error("指定した公式対象回ライブラリが見つかりません。");
  }

  return localSaveTotoOfficialRoundImport({
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

export async function localSaveRoundEvAssumption(input: {
  carryoverYen: number;
  firstPrizeShare: number;
  note: string | null;
  payoutCapYen: number | null;
  returnRate: number;
  roundId: string;
  stakeYen: number;
  totalSalesYen: number | null;
}) {
  assertWritable();
  const state = readLocalState();
  const existing = state.roundEvAssumptions.find((entry) => entry.roundId === input.roundId);
  const createdAt = existing?.createdAt ?? nowIso();
  const next: RoundEvAssumption = {
    ...input,
    createdAt,
    id: existing?.id ?? localId("ev"),
    updatedAt: nowIso(),
  };
  state.roundEvAssumptions = state.roundEvAssumptions.filter((entry) => entry.roundId !== input.roundId);
  state.roundEvAssumptions.push(next);
  writeLocalState(state);
}

export async function localReplaceCandidateTickets(input: {
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
  assertWritable();
  const state = readLocalState();
  const existingByLabel = new Map(
    state.candidateTickets
      .filter((ticket) => ticket.roundId === input.roundId)
      .map((ticket) => [ticket.label, ticket]),
  );
  const now = nowIso();
  state.candidateTickets = state.candidateTickets.filter((ticket) => ticket.roundId !== input.roundId);
  state.candidateTickets.push(
    ...input.tickets.map((ticket) => {
      const existing = existingByLabel.get(ticket.label);
      return {
        ...ticket,
        createdAt: existing?.createdAt ?? now,
        id: existing?.id ?? localId("candidate"),
        roundId: input.roundId,
        updatedAt: now,
      };
    }),
  );
  writeLocalState(state);
}

export async function localUpsertCandidateVote(input: {
  candidateTicketId: string;
  comment: string | null;
  roundId: string;
  userId: string;
  vote: CandidateVoteValue;
}) {
  assertWritable();
  const state = readLocalState();
  const existing = state.candidateVotes.find(
    (vote) =>
      vote.roundId === input.roundId &&
      vote.candidateTicketId === input.candidateTicketId &&
      vote.userId === input.userId,
  );
  const now = nowIso();
  state.candidateVotes = state.candidateVotes.filter(
    (vote) =>
      !(
        vote.roundId === input.roundId &&
        vote.candidateTicketId === input.candidateTicketId &&
        vote.userId === input.userId
      ),
  );
  state.candidateVotes.push({
    ...input,
    createdAt: existing?.createdAt ?? now,
    id: existing?.id ?? localId("candidate-vote"),
    updatedAt: now,
  });
  writeLocalState(state);
}

export async function localSaveResults(input: {
  roundId: string;
  status: RoundStatus;
  results: Array<{ actualResult: Outcome | null; matchId: string }>;
}) {
  assertWritable();
  const state = readLocalState();
  const resultByMatchId = new Map(input.results.map((entry) => [entry.matchId, entry.actualResult]));
  state.matches = state.matches.map((match) =>
    match.roundId === input.roundId && resultByMatchId.has(match.id)
      ? { ...match, actualResult: resultByMatchId.get(match.id) ?? null, updatedAt: nowIso() }
      : match,
  );
  state.rounds = state.rounds.map((round) =>
    round.id === input.roundId ? { ...round, status: input.status, updatedAt: nowIso() } : round,
  );
  writeLocalState(state);
}

export async function localAddReviewNote(input: {
  matchId: string | null;
  note: string;
  roundId: string;
  userId: string | null;
}) {
  assertWritable();
  const state = readLocalState();
  state.reviewNotes.push({
    ...input,
    createdAt: nowIso(),
    id: localId("review"),
  });
  writeLocalState(state);
}

export async function localSaveResearchMemo(input: {
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
  assertWritable();
  const state = readLocalState();
  const existing = input.memoId
    ? state.researchMemos.find((memo) => memo.id === input.memoId)
    : null;
  const now = nowIso();
  const next: ResearchMemo = {
    confidence: input.confidence,
    createdAt: existing?.createdAt ?? now,
    createdBy: input.createdBy,
    id: existing?.id ?? localId("memo"),
    matchId: input.matchId,
    memoType: input.memoType,
    roundId: input.roundId,
    sourceDate: input.sourceDate,
    sourceName: input.sourceName,
    sourceUrl: input.sourceUrl,
    summary: input.summary,
    team: input.team,
    title: input.title,
    updatedAt: now,
  };
  state.researchMemos = state.researchMemos.filter((memo) => memo.id !== next.id);
  state.researchMemos.push(next);
  writeLocalState(state);
}

export async function localDeleteResearchMemo(memoId: string) {
  assertWritable();
  const state = readLocalState();
  state.researchMemos = state.researchMemos.filter((memo) => memo.id !== memoId);
  writeLocalState(state);
}

export async function localSyncBigOfficialWatchFromOfficial(): Promise<BigOfficialSyncPayload> {
  return {
    fetchedAt: nowIso(),
    snapshots: [],
    sourceUrl: "https://store.toto-dream.com/dcs/subos/screen/pi02/spin005/PGSPIN00501InitBIGLotInfo.form",
    warnings: ["ローカル保存モードではBIG公式同期を行いません。URLパラメータまたはプリセットで試算できます。"],
  };
}

export function buildLocalRoundBundle(workspace: RoundWorkspace, dataMode: "demo" | "local" | "shared"): LocalRoundBundle {
  return {
    candidateTickets: workspace.round.candidateTickets,
    candidateVotes: workspace.round.candidateVotes,
    generatedTickets: workspace.round.generatedTickets,
    matches: workspace.round.matches,
    metadata: {
      appVersion: process.env.NEXT_PUBLIC_APP_VERSION ?? "0.1.0",
      dataMode,
      exportedAt: nowIso(),
    },
    picks: workspace.round.picks,
    researchMemos: workspace.round.researchMemos,
    reviewNotes: workspace.round.reviewNotes,
    round: workspace.round,
    roundEvAssumption: workspace.round.evAssumption,
    scoutReports: workspace.round.scoutReports,
    totoOfficialMatches: workspace.round.totoOfficialMatches,
    totoOfficialRound: workspace.round.totoOfficialRound,
    users: workspace.users,
  };
}

export async function localImportRoundBundle(bundle: LocalRoundBundle, strategy: "copy" | "overwrite") {
  assertWritable();
  const state = readLocalState();
  const now = nowIso();
  const roundId = strategy === "overwrite" ? bundle.round.id : localId("round");
  const matchIdMap = new Map<string, string>();
  const userIdMap = new Map<string, string>();
  const candidateIdMap = new Map<string, string>();

  bundle.users.forEach((user) => {
    const existing = state.users.find((entry) => entry.name === user.name && entry.role === user.role);
    const nextId = existing?.id ?? (strategy === "overwrite" ? user.id : localId("user"));
    userIdMap.set(user.id, nextId);
    if (!existing) {
      state.users.push({ ...user, createdAt: now, id: nextId, updatedAt: now });
    }
  });

  const nextRound: Round = {
    ...bundle.round,
    createdAt: strategy === "overwrite" ? bundle.round.createdAt : now,
    id: roundId,
    participantIds: bundle.round.participantIds.map((id) => userIdMap.get(id) ?? id),
    title: strategy === "copy" ? `${bundle.round.title} (local import)` : bundle.round.title,
    updatedAt: now,
  };

  bundle.matches.forEach((match) => {
    matchIdMap.set(match.id, strategy === "overwrite" ? match.id : localId("match"));
  });
  bundle.candidateTickets.forEach((ticket) => {
    candidateIdMap.set(ticket.id, strategy === "overwrite" ? ticket.id : localId("candidate"));
  });

  state.rounds = state.rounds.filter((round) => round.id !== roundId);
  state.rounds.push(nextRound);
  state.matches = state.matches.filter((match) => match.roundId !== roundId);
  state.matches.push(
    ...bundle.matches.map((match) => ({
      ...match,
      createdAt: strategy === "overwrite" ? match.createdAt : now,
      id: matchIdMap.get(match.id) ?? match.id,
      roundId,
      updatedAt: now,
    })),
  );
  state.picks = state.picks.filter((pick) => pick.roundId !== roundId);
  state.picks.push(
    ...bundle.picks.map((pick) => ({
      ...pick,
      createdAt: strategy === "overwrite" ? pick.createdAt : now,
      id: strategy === "overwrite" ? pick.id : localId("pick"),
      matchId: matchIdMap.get(pick.matchId) ?? pick.matchId,
      roundId,
      updatedAt: now,
      userId: userIdMap.get(pick.userId) ?? pick.userId,
    })),
  );
  state.scoutReports = state.scoutReports.filter((report) => report.roundId !== roundId);
  state.scoutReports.push(
    ...bundle.scoutReports.map((report) => ({
      ...report,
      createdAt: strategy === "overwrite" ? report.createdAt : now,
      id: strategy === "overwrite" ? report.id : localId("scout"),
      matchId: matchIdMap.get(report.matchId) ?? report.matchId,
      roundId,
      updatedAt: now,
      userId: userIdMap.get(report.userId) ?? report.userId,
    })),
  );
  state.researchMemos = state.researchMemos.filter((memo) => memo.roundId !== roundId);
  state.researchMemos.push(
    ...bundle.researchMemos.map((memo) => ({
      ...memo,
      createdAt: strategy === "overwrite" ? memo.createdAt : now,
      createdBy: userIdMap.get(memo.createdBy) ?? memo.createdBy,
      id: strategy === "overwrite" ? memo.id : localId("memo"),
      matchId: memo.matchId ? matchIdMap.get(memo.matchId) ?? memo.matchId : null,
      roundId,
      updatedAt: now,
    })),
  );
  state.candidateTickets = state.candidateTickets.filter((ticket) => ticket.roundId !== roundId);
  state.candidateTickets.push(
    ...bundle.candidateTickets.map((ticket) => ({
      ...ticket,
      createdAt: strategy === "overwrite" ? ticket.createdAt : now,
      id: candidateIdMap.get(ticket.id) ?? ticket.id,
      roundId,
      updatedAt: now,
    })),
  );
  state.candidateVotes = state.candidateVotes.filter((vote) => vote.roundId !== roundId);
  state.candidateVotes.push(
    ...bundle.candidateVotes.map((vote) => ({
      ...vote,
      candidateTicketId: candidateIdMap.get(vote.candidateTicketId) ?? vote.candidateTicketId,
      createdAt: strategy === "overwrite" ? vote.createdAt : now,
      id: strategy === "overwrite" ? vote.id : localId("candidate-vote"),
      roundId,
      updatedAt: now,
      userId: userIdMap.get(vote.userId) ?? vote.userId,
    })),
  );
  state.reviewNotes = state.reviewNotes.filter((note) => note.roundId !== roundId);
  state.reviewNotes.push(
    ...bundle.reviewNotes.map((note) => ({
      ...note,
      createdAt: strategy === "overwrite" ? note.createdAt : now,
      id: strategy === "overwrite" ? note.id : localId("review"),
      matchId: note.matchId ? matchIdMap.get(note.matchId) ?? note.matchId : null,
      roundId,
      userId: note.userId ? userIdMap.get(note.userId) ?? note.userId : null,
    })),
  );
  state.roundEvAssumptions = state.roundEvAssumptions.filter((assumption) => assumption.roundId !== roundId);
  if (bundle.roundEvAssumption) {
    state.roundEvAssumptions.push({
      ...bundle.roundEvAssumption,
      createdAt: strategy === "overwrite" ? bundle.roundEvAssumption.createdAt : now,
      id: strategy === "overwrite" ? bundle.roundEvAssumption.id : localId("ev"),
      roundId,
      updatedAt: now,
    });
  }
  state.generatedTickets = state.generatedTickets.filter((ticket) => ticket.roundId !== roundId);
  state.generatedTickets.push(
    ...bundle.generatedTickets.map((ticket) => ({
      ...ticket,
      createdAt: strategy === "overwrite" ? ticket.createdAt : now,
      id: strategy === "overwrite" ? ticket.id : localId("generated"),
      roundId,
    })),
  );
  state.totoOfficialRounds = state.totoOfficialRounds.filter((officialRound) => officialRound.roundId !== roundId);
  if (bundle.totoOfficialRound) {
    state.totoOfficialRounds.push({
      ...bundle.totoOfficialRound,
      createdAt: strategy === "overwrite" ? bundle.totoOfficialRound.createdAt : now,
      id: strategy === "overwrite" ? bundle.totoOfficialRound.id : localId("official-round"),
      roundId,
      updatedAt: now,
    });
  }
  state.totoOfficialMatches = state.totoOfficialMatches.filter((match) => match.roundId !== roundId);
  state.totoOfficialMatches.push(
    ...bundle.totoOfficialMatches.map((match) => ({
      ...match,
      createdAt: strategy === "overwrite" ? match.createdAt : now,
      id: strategy === "overwrite" ? match.id : localId("official-match"),
      matchId: match.matchId ? matchIdMap.get(match.matchId) ?? match.matchId : null,
      roundId,
      updatedAt: now,
    })),
  );

  writeLocalState(state);
  saveCurrentRound(roundId);
  return roundId;
}
