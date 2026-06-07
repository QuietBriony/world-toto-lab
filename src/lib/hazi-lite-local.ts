import {
  buildFeaturedWorldTotoImportPayloads,
  featuredWorldTotoRoundNumbers,
} from "@/lib/featured-world-toto";
import { calculateModelProbabilities } from "@/lib/probability/engine";
import type {
  Match,
  Outcome,
  Pick,
  ProductType,
  Round,
  RoundEvAssumption,
  TotoOfficialMatch,
  TotoOfficialRound,
  TotoOfficialResultStatus,
  User,
} from "@/lib/types";

const namespace = "world-toto-lab:v1";

const localKeys = {
  candidateTickets: `${namespace}:candidateTickets`,
  candidateVotes: `${namespace}:candidateVotes`,
  currentRound: `${namespace}:currentRound`,
  dataMode: `${namespace}:dataMode`,
  generatedTickets: `${namespace}:generatedTickets`,
  haziAiVersion: `${namespace}:haziLiteAiVersion`,
  matches: `${namespace}:matches`,
  picks: `${namespace}:picks`,
  roundEvAssumptions: `${namespace}:bigCarryoverAssumptions`,
  rounds: `${namespace}:rounds`,
  scoutReports: `${namespace}:scoutReports`,
  totoOfficialMatches: `${namespace}:totoOfficialMatches`,
  totoOfficialRounds: `${namespace}:totoOfficialRounds`,
  users: `${namespace}:users`,
} as const;

const haziLiteAiVersion = "team-strength-v2";

type OutcomeValue = "1" | "0" | "2";

type HaziLiteLocalState = {
  candidateTickets: unknown[];
  candidateVotes: unknown[];
  generatedTickets: unknown[];
  matches: Match[];
  picks: Pick[];
  roundEvAssumptions: RoundEvAssumption[];
  rounds: Round[];
  scoutReports: unknown[];
  totoOfficialMatches: TotoOfficialMatch[];
  totoOfficialRounds: TotoOfficialRound[];
  users: User[];
};

export type HaziLiteMatch = {
  aiPick: OutcomeValue;
  awayTeam: string;
  haziPick: OutcomeValue | null;
  homeTeam: string;
  kickoffTime: string | null;
  matchId: string;
  matchNo: number;
  modelProb0: number | null;
  modelProb1: number | null;
  modelProb2: number | null;
  modelRationale: string;
  modelSource: "official_vote" | "team_strength";
  officialMatchNo: number | null;
  reviewChange: boolean;
};

export type HaziLiteRound = {
  matchCount: number;
  matches: HaziLiteMatch[];
  pickCount: number;
  reviewChangeCount: number;
  roundId: string;
  roundNumber: number;
  title: string;
};

export type HaziLiteSummary = {
  haziUserId: string | null;
  aiVersion: string;
  isLiteReady: boolean;
  reviewChangeCount: number;
  rounds: HaziLiteRound[];
  totalMatches: number;
  totalPicks: number;
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
    return Array.isArray(parsed) ? (parsed as T[]) : [];
  } catch {
    return [];
  }
}

function writeArray<T>(key: string, rows: T[]) {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(key, JSON.stringify(rows));
}

function readState(): HaziLiteLocalState {
  return {
    candidateTickets: readArray(localKeys.candidateTickets),
    candidateVotes: readArray(localKeys.candidateVotes),
    generatedTickets: readArray(localKeys.generatedTickets),
    matches: readArray<Match>(localKeys.matches),
    picks: readArray<Pick>(localKeys.picks),
    roundEvAssumptions: readArray<RoundEvAssumption>(localKeys.roundEvAssumptions),
    rounds: readArray<Round>(localKeys.rounds),
    scoutReports: readArray(localKeys.scoutReports),
    totoOfficialMatches: readArray<TotoOfficialMatch>(localKeys.totoOfficialMatches),
    totoOfficialRounds: readArray<TotoOfficialRound>(localKeys.totoOfficialRounds),
    users: readArray<User>(localKeys.users),
  };
}

function writeState(state: HaziLiteLocalState) {
  writeArray(localKeys.candidateTickets, state.candidateTickets);
  writeArray(localKeys.candidateVotes, state.candidateVotes);
  writeArray(localKeys.generatedTickets, state.generatedTickets);
  writeArray(localKeys.matches, state.matches);
  writeArray(localKeys.picks, state.picks);
  writeArray(localKeys.roundEvAssumptions, state.roundEvAssumptions);
  writeArray(localKeys.rounds, state.rounds);
  writeArray(localKeys.scoutReports, state.scoutReports);
  writeArray(localKeys.totoOfficialMatches, state.totoOfficialMatches);
  writeArray(localKeys.totoOfficialRounds, state.totoOfficialRounds);
  writeArray(localKeys.users, state.users);
  window.localStorage.setItem(localKeys.dataMode, "local");
  window.localStorage.setItem(localKeys.haziAiVersion, haziLiteAiVersion);
}

function outcomeToEnum(value: OutcomeValue): Outcome {
  if (value === "0") {
    return "DRAW";
  }

  return value === "1" ? "ONE" : "TWO";
}

function enumToOutcome(value: Outcome | null | undefined): OutcomeValue | null {
  if (value === "ONE") {
    return "1";
  }

  if (value === "DRAW") {
    return "0";
  }

  if (value === "TWO") {
    return "2";
  }

  return null;
}

function topOutcome(input: { modelProb0: number; modelProb1: number; modelProb2: number }): OutcomeValue {
  return [
    { outcome: "1" as const, value: input.modelProb1 },
    { outcome: "0" as const, value: input.modelProb0 },
    { outcome: "2" as const, value: input.modelProb2 },
  ].sort((left, right) => right.value - left.value)[0].outcome;
}

function recommendedOutcomes(input: { modelProb0: number; modelProb1: number; modelProb2: number }) {
  return [
    { outcome: "1" as const, value: input.modelProb1 },
    { outcome: "0" as const, value: input.modelProb0 },
    { outcome: "2" as const, value: input.modelProb2 },
  ]
    .sort((left, right) => right.value - left.value)
    .slice(0, 2)
    .map((entry) => entry.outcome)
    .join(",");
}

const teamStrengthByName: Record<string, number> = {
  "アイスランド": 74,
  "アルジェリア": 78,
  "アルゼンチン": 96,
  "イングランド": 93,
  "ウズベキスタン": 73,
  "ウルグアイ": 87,
  "エクアドル": 82,
  "エジプト": 80,
  "オーストラリア": 77,
  "オーストリア": 83,
  "オランダ": 91,
  "カーボベルデ": 70,
  "カタール": 72,
  "カナダ": 77,
  "ガーナ": 79,
  "キュラソー": 67,
  "クロアチア": 86,
  "コロンビア": 86,
  "コンゴ民主共和国": 72,
  "コートジボワール": 80,
  "サウジアラビア": 72,
  "スイス": 84,
  "スウェーデン": 82,
  "スコットランド": 78,
  "スペイン": 94,
  "セネガル": 83,
  "チュニジア": 76,
  "チェコ": 79,
  "チリ": 76,
  "ドイツ": 90,
  "ニュージーランド": 67,
  "日本": 83,
  "ノルウェー": 80,
  "ハイチ": 66,
  "パナマ": 70,
  "パラグアイ": 77,
  "ブラジル": 94,
  "フランス": 95,
  "ベルギー": 88,
  "ボスニア": 75,
  "ボスニア・ヘルツェゴビナ": 75,
  "ポルトガル": 92,
  "南アフリカ": 72,
  "メキシコ": 81,
  "モロッコ": 84,
  "ヨルダン": 69,
  "韓国": 80,
};

function teamStrength(teamName: string) {
  return teamStrengthByName[teamName] ?? 75;
}

function teamStrengthPrior(input: { awayTeam: string; homeTeam: string }) {
  const homeStrength = teamStrength(input.homeTeam);
  const awayStrength = teamStrength(input.awayTeam);
  const diff = homeStrength - awayStrength;
  const draw = Math.max(0.19, Math.min(0.31, 0.29 - Math.abs(diff) * 0.003));
  const homeShare = 1 / (1 + Math.exp(-diff / 10));
  const winMass = 1 - draw;

  return {
    modelRationale: `${input.homeTeam} ${homeStrength} / ${input.awayTeam} ${awayStrength} の国別強度差から軽量推定。`,
    modelSource: "team_strength" as const,
    marketProb0: draw,
    marketProb1: winMass * homeShare,
    marketProb2: winMass * (1 - homeShare),
  };
}

function modelSeed(input: {
  awayTeam: string;
  homeTeam: string;
  officialVote0: number | null;
  officialVote1: number | null;
  officialVote2: number | null;
}) {
  const hasOfficialVote =
    input.officialVote1 !== null &&
    input.officialVote0 !== null &&
    input.officialVote2 !== null;

  if (hasOfficialVote) {
    return {
      modelRationale: "公式人気を市場確率として軽量推定。",
      modelSource: "official_vote" as const,
      marketProb0: input.officialVote0,
      marketProb1: input.officialVote1,
      marketProb2: input.officialVote2,
    };
  }

  return teamStrengthPrior(input);
}

function worldRoundNumber(round: Round, officialRound?: TotoOfficialRound | null) {
  const numberFromOfficial = officialRound?.officialRoundNumber ?? null;
  if (
    numberFromOfficial &&
    featuredWorldTotoRoundNumbers.includes(numberFromOfficial as (typeof featuredWorldTotoRoundNumbers)[number])
  ) {
    return numberFromOfficial;
  }

  const matched = `${round.title} ${round.sourceNote ?? ""}`.match(/第(163[4-7])回/);
  return matched ? Number(matched[1]) : null;
}

function findRoundByNumber(state: HaziLiteLocalState, roundNumber: number) {
  const official = state.totoOfficialRounds.find((round) => round.officialRoundNumber === roundNumber);
  if (official) {
    return state.rounds.find((round) => round.id === official.roundId) ?? null;
  }

  return (
    state.rounds.find((round) => {
      const inferred = worldRoundNumber(round, null);
      return inferred === roundNumber;
    }) ?? null
  );
}

function ensureHaziUser(state: HaziLiteLocalState) {
  const existing = state.users.find((user) => user.name.trim().toLowerCase() === "hazi");
  if (existing) {
    return existing;
  }

  const createdAt = nowIso();
  const user: User = {
    createdAt,
    id: localId("user"),
    name: "Hazi",
    role: "admin",
    updatedAt: createdAt,
  };
  state.users.push(user);
  return user;
}

function emptyMatch(roundId: string, matchNo: number, existing?: Match | null): Match {
  const createdAt = existing?.createdAt ?? nowIso();
  return {
    actualResult: null,
    adminAdjust0: null,
    adminAdjust1: null,
    adminAdjust2: null,
    adminNote: null,
    altitudeHumidityAdjust: null,
    availabilityAdjust: null,
    availabilityInfo: null,
    awayStrengthAdjust: null,
    awayTeam: "",
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
    homeTeam: "",
    id: existing?.id ?? localId("match"),
    injuryNote: null,
    injurySuspensionAdjust: null,
    kickoffTime: null,
    leagueTableMotivationAdjust: null,
    marketProb0: null,
    marketProb1: null,
    marketProb2: null,
    matchNo,
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
    updatedAt: nowIso(),
    venue: null,
  };
}

function buildRoundMatch(input: {
  existing?: Match | null;
  matchNo: number;
  roundId: string;
  row: ReturnType<typeof buildFeaturedWorldTotoImportPayloads>[number]["rows"][number];
}) {
  const seed = modelSeed({
    awayTeam: input.row.awayTeam,
    homeTeam: input.row.homeTeam,
    officialVote0: input.row.officialVote0,
    officialVote1: input.row.officialVote1,
    officialVote2: input.row.officialVote2,
  });
  const base = {
    ...emptyMatch(input.roundId, input.matchNo, input.existing),
    actualResult: input.row.actualResult,
    awayTeam: input.row.awayTeam,
    fixtureMasterId: input.row.fixtureMasterId,
    homeTeam: input.row.homeTeam,
    kickoffTime: input.row.kickoffTime,
    marketProb0: seed.marketProb0,
    marketProb1: seed.marketProb1,
    marketProb2: seed.marketProb2,
    officialMatchNo: input.row.officialMatchNo,
    officialVote0: input.row.officialVote0,
    officialVote1: input.row.officialVote1,
    officialVote2: input.row.officialVote2,
    stage: input.row.stage,
    venue: input.row.venue,
  } satisfies Match;
  const estimated = calculateModelProbabilities({
    ...base,
    competitionType: "world_cup",
    dataProfile: "manual_light",
  });

  return {
    ...base,
    adminNote: seed.modelRationale,
    modelProb0: estimated.modelProb0,
    modelProb1: estimated.modelProb1,
    modelProb2: estimated.modelProb2,
    tacticalNote: seed.modelSource === "official_vote" ? "AI source: official_vote" : "AI source: team_strength",
    recommendedOutcomes: recommendedOutcomes(estimated),
    updatedAt: nowIso(),
  } satisfies Match;
}

function liteReady(state: HaziLiteLocalState, haziUserId: string) {
  const rounds = featuredWorldTotoRoundNumbers
    .map((roundNumber) => findRoundByNumber(state, roundNumber))
    .filter((round): round is Round => Boolean(round));
  const roundIds = new Set(rounds.map((round) => round.id));
  const matchCount = state.matches.filter((match) => roundIds.has(match.roundId)).length;
  const haziPickCount = state.picks.filter(
    (pick) => roundIds.has(pick.roundId) && pick.userId === haziUserId,
  ).length;
  const candidateCount = state.candidateTickets.filter((ticket) => {
    const candidate = ticket as { roundId?: string };
    return candidate.roundId ? roundIds.has(candidate.roundId) : false;
  }).length;

  return (
    rounds.length === featuredWorldTotoRoundNumbers.length &&
    matchCount === 52 &&
    haziPickCount === 52 &&
    candidateCount === 0 &&
    rounds.every((round) => round.participantIds.length === 1 && round.participantIds[0] === haziUserId)
  );
}

export function readHaziLiteSummary(): HaziLiteSummary {
  const state = readState();
  const haziUser = state.users.find((user) => user.name.trim().toLowerCase() === "hazi") ?? null;
  const rounds = featuredWorldTotoRoundNumbers
    .map((roundNumber): HaziLiteRound | null => {
      const round = findRoundByNumber(state, roundNumber);
      if (!round) {
        return null;
      }

      const roundMatches = state.matches
        .filter((match) => match.roundId === round.id)
        .sort((left, right) => left.matchNo - right.matchNo);
      const roundPicks = state.picks.filter(
        (pick) => pick.roundId === round.id && pick.userId === haziUser?.id,
      );
      const picksByMatch = new Map(roundPicks.map((pick) => [pick.matchId, pick]));
      const matches = roundMatches.map((match) => {
        const aiPick = topOutcome({
          modelProb0: match.modelProb0 ?? 0,
          modelProb1: match.modelProb1 ?? 0,
          modelProb2: match.modelProb2 ?? 0,
        });
        const haziPick = enumToOutcome(picksByMatch.get(match.id)?.pick);

        return {
          aiPick,
          awayTeam: match.awayTeam,
          haziPick,
          homeTeam: match.homeTeam,
          kickoffTime: match.kickoffTime,
          matchId: match.id,
          matchNo: match.matchNo,
          modelProb0: match.modelProb0,
          modelProb1: match.modelProb1,
          modelProb2: match.modelProb2,
          modelRationale: match.adminNote ?? "軽量AI推定。",
          modelSource: match.tacticalNote?.includes("team_strength") ? "team_strength" : "official_vote",
          officialMatchNo: match.officialMatchNo,
          reviewChange: haziPick !== aiPick,
        } satisfies HaziLiteMatch;
      });

      return {
        matchCount: roundMatches.length,
        matches,
        pickCount: roundPicks.length,
        reviewChangeCount: matches.filter((match) => match.reviewChange).length,
        roundId: round.id,
        roundNumber,
        title: round.title,
      } satisfies HaziLiteRound;
    })
    .filter((round): round is HaziLiteRound => Boolean(round));

  return {
    aiVersion: typeof window === "undefined" ? haziLiteAiVersion : window.localStorage.getItem(localKeys.haziAiVersion) ?? "none",
    haziUserId: haziUser?.id ?? null,
    isLiteReady: haziUser ? liteReady(state, haziUser.id) : false,
    reviewChangeCount: rounds.reduce((sum, round) => sum + round.reviewChangeCount, 0),
    rounds,
    totalMatches: rounds.reduce((sum, round) => sum + round.matchCount, 0),
    totalPicks: rounds.reduce((sum, round) => sum + round.pickCount, 0),
  };
}

export function setupHaziLiteState(input: { force?: boolean } = {}) {
  if (typeof window === "undefined") {
    return readHaziLiteSummary();
  }

  const state = readState();
  const haziUser = ensureHaziUser(state);
  const currentVersion = window.localStorage.getItem(localKeys.haziAiVersion);
  if (!input.force && currentVersion === haziLiteAiVersion && liteReady(state, haziUser.id)) {
    return readHaziLiteSummary();
  }

  const payloads = buildFeaturedWorldTotoImportPayloads();
  const preparedRoundIds = new Set<string>();
  const now = nowIso();

  payloads.forEach((payload) => {
    const existingRound =
      payload.officialRoundNumber !== null
        ? findRoundByNumber(state, payload.officialRoundNumber)
        : null;
    const roundId = existingRound?.id ?? localId("round");
    preparedRoundIds.add(roundId);
    const round: Round = {
      activeMatchCount: payload.rows.length,
      budgetYen: null,
      competitionType: "world_cup",
      createdAt: existingRound?.createdAt ?? now,
      dataProfile: "manual_light",
      id: roundId,
      notes: `${payload.notes}\nHazi専用軽量ページで作成。`,
      outcomeSetJson: null,
      participantIds: [haziUser.id],
      primaryUse: "real_round_research",
      probabilityReadiness: "partial",
      productType: payload.productType as ProductType,
      requiredMatchCount: payload.requiredMatchCount,
      roundSource: "toto_official_manual",
      sourceNote: payload.sourceNote,
      sportContext: "national_team",
      status: "analyzing",
      title: payload.title,
      updatedAt: now,
      voidHandling: "manual",
    };
    const existingMatches = new Map(
      state.matches
        .filter((match) => match.roundId === roundId)
        .map((match) => [match.matchNo, match]),
    );
    const nextMatches = payload.rows.map((row, index) =>
      buildRoundMatch({
        existing: existingMatches.get(index + 1) ?? null,
        matchNo: index + 1,
        roundId,
        row,
      }),
    );
    const existingPicksByMatch = new Map(
      state.picks
        .filter((pick) => pick.roundId === roundId && pick.userId === haziUser.id)
        .map((pick) => [pick.matchId, pick]),
    );
    const nextPicks = nextMatches.map((match) => {
      const existingPick = existingPicksByMatch.get(match.id);
      if (existingPick && !input.force) {
        return existingPick;
      }

      return {
        createdAt: existingPick?.createdAt ?? now,
        id: existingPick?.id ?? localId("pick"),
        matchId: match.id,
        note: "Hazi軽量ページ: AI初期線から自動入力。必要なら1/0/2で上書き。",
        pick: outcomeToEnum(
          topOutcome({
            modelProb0: match.modelProb0 ?? 0,
            modelProb1: match.modelProb1 ?? 0,
            modelProb2: match.modelProb2 ?? 0,
          }),
        ),
        roundId,
        support: { kind: "manual" as const },
        updatedAt: now,
        userId: haziUser.id,
      };
    }) satisfies Pick[];
    const officialRound: TotoOfficialRound = {
      carryoverYen: payload.carryoverYen,
      createdAt:
        state.totoOfficialRounds.find((entry) => entry.roundId === roundId)?.createdAt ?? now,
      firstPrizeShare: payload.firstPrizeShare,
      id:
        state.totoOfficialRounds.find((entry) => entry.roundId === roundId)?.id ??
        localId("official-round"),
      officialRoundName: payload.officialRoundName,
      officialRoundNumber: payload.officialRoundNumber,
      payoutCapYen: payload.payoutCapYen,
      productType: payload.productType,
      resultStatus: payload.resultStatus as TotoOfficialResultStatus,
      returnRate: payload.returnRate,
      roundId,
      salesEndAt: payload.salesEndAt,
      salesStartAt: payload.salesStartAt,
      sourceText: payload.sourceText,
      sourceUrl: payload.sourceUrl,
      stakeYen: payload.stakeYen,
      totalSalesYen: payload.totalSalesYen,
      updatedAt: now,
    };
    const officialMatches = payload.rows.map((row) => ({
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
    })) satisfies TotoOfficialMatch[];
    const evAssumption: RoundEvAssumption = {
      carryoverYen: payload.carryoverYen,
      createdAt:
        state.roundEvAssumptions.find((entry) => entry.roundId === roundId)?.createdAt ?? now,
      firstPrizeShare: payload.firstPrizeShare ?? 0.7,
      id: state.roundEvAssumptions.find((entry) => entry.roundId === roundId)?.id ?? localId("ev"),
      note: payload.officialRoundName,
      payoutCapYen: payload.payoutCapYen,
      returnRate: payload.returnRate,
      roundId,
      stakeYen: payload.stakeYen,
      totalSalesYen: payload.totalSalesYen,
      updatedAt: now,
    };

    state.rounds = state.rounds.filter((entry) => entry.id !== roundId).concat(round);
    state.matches = state.matches.filter((match) => match.roundId !== roundId).concat(nextMatches);
    state.picks = state.picks
      .filter((pick) => !(pick.roundId === roundId && pick.userId === haziUser.id))
      .concat(nextPicks);
    state.totoOfficialRounds = state.totoOfficialRounds
      .filter((entry) => entry.roundId !== roundId)
      .concat(officialRound);
    state.totoOfficialMatches = state.totoOfficialMatches
      .filter((match) => match.roundId !== roundId)
      .concat(officialMatches);
    state.roundEvAssumptions = state.roundEvAssumptions
      .filter((entry) => entry.roundId !== roundId)
      .concat(evAssumption);
  });

  state.candidateTickets = state.candidateTickets.filter((ticket) => {
    const candidate = ticket as { roundId?: string };
    return !candidate.roundId || !preparedRoundIds.has(candidate.roundId);
  });
  state.candidateVotes = state.candidateVotes.filter((vote) => {
    const candidate = vote as { roundId?: string };
    return !candidate.roundId || !preparedRoundIds.has(candidate.roundId);
  });
  state.generatedTickets = state.generatedTickets.filter((ticket) => {
    const candidate = ticket as { roundId?: string };
    return !candidate.roundId || !preparedRoundIds.has(candidate.roundId);
  });

  writeState(state);
  const firstRoundId = featuredWorldTotoRoundNumbers
    .map((roundNumber) => findRoundByNumber(state, roundNumber)?.id)
    .find((roundId): roundId is string => Boolean(roundId));
  if (firstRoundId) {
    window.localStorage.setItem(localKeys.currentRound, firstRoundId);
  }

  return readHaziLiteSummary();
}

export function updateHaziLitePick(input: {
  matchId: string;
  pick: OutcomeValue;
  roundId: string;
}) {
  const state = readState();
  const haziUser = ensureHaziUser(state);
  const now = nowIso();
  const existing = state.picks.find(
    (pick) => pick.roundId === input.roundId && pick.matchId === input.matchId && pick.userId === haziUser.id,
  );
  const nextPick: Pick = {
    createdAt: existing?.createdAt ?? now,
    id: existing?.id ?? localId("pick"),
    matchId: input.matchId,
    note: "Hazi軽量ページで手動調整。",
    pick: outcomeToEnum(input.pick),
    roundId: input.roundId,
    support: { kind: "manual" },
    updatedAt: now,
    userId: haziUser.id,
  };

  state.picks = state.picks
    .filter(
      (pick) =>
        !(pick.roundId === input.roundId && pick.matchId === input.matchId && pick.userId === haziUser.id),
    )
    .concat(nextPick);
  writeState(state);
  return readHaziLiteSummary();
}

export function applyHaziLiteAiPicks(input: { roundId?: string | null } = {}) {
  const state = readState();
  const haziUser = ensureHaziUser(state);
  const now = nowIso();
  const targetRounds = featuredWorldTotoRoundNumbers
    .map((roundNumber) => findRoundByNumber(state, roundNumber))
    .filter((round): round is Round => Boolean(round))
    .filter((round) => !input.roundId || round.id === input.roundId);
  const targetRoundIds = new Set(targetRounds.map((round) => round.id));
  const existingPickByMatch = new Map(
    state.picks
      .filter((pick) => targetRoundIds.has(pick.roundId) && pick.userId === haziUser.id)
      .map((pick) => [pick.matchId, pick]),
  );
  const nextPicks = state.matches
    .filter((match) => targetRoundIds.has(match.roundId))
    .map((match) => {
      const existing = existingPickByMatch.get(match.id);
      return {
        createdAt: existing?.createdAt ?? now,
        id: existing?.id ?? localId("pick"),
        matchId: match.id,
        note: "Hazi軽量ページ: AI修正案をレビュー後に反映。",
        pick: outcomeToEnum(
          topOutcome({
            modelProb0: match.modelProb0 ?? 0,
            modelProb1: match.modelProb1 ?? 0,
            modelProb2: match.modelProb2 ?? 0,
          }),
        ),
        roundId: match.roundId,
        support: { kind: "manual" as const },
        updatedAt: now,
        userId: haziUser.id,
      } satisfies Pick;
    });

  state.picks = state.picks
    .filter((pick) => !(targetRoundIds.has(pick.roundId) && pick.userId === haziUser.id))
    .concat(nextPicks);
  writeState(state);
  return readHaziLiteSummary();
}
