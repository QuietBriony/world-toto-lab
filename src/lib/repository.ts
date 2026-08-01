import {
  generateCandidateTickets,
  isCandidateTicketSetStale,
} from "@/lib/candidate-tickets";
import {
  getRuntimeDataMode,
  isCloudflareD1Mode,
  shouldUseLocalRepository,
} from "@/lib/data-mode";
import * as d1Repository from "@/lib/repository-d1";
import * as localRepository from "@/lib/local-repository";
import type { BigOfficialSyncPayload } from "@/lib/big-official";
import type {
  CandidateDataQuality,
  CandidateStrategyType,
  CandidateVoteValue,
  CompetitionType,
  DashboardData,
  DataProfile,
  FixtureDataConfidence,
  FixtureSource,
  MatchCategory,
  Outcome,
  PickSupport,
  PrimaryUse,
  ProductType,
  ProvisionalCall,
  ProbabilityReadiness,
  ResearchMemoConfidence,
  ResearchMemoType,
  RoundSource,
  RoundStatus,
  RoundWorkspace,
  SportContext,
  TicketMode,
  TotoOfficialMatchStatus,
  TotoOfficialResultStatus,
  TotoOfficialRoundLibraryMatch,
  UserRole,
  VoidHandling,
} from "@/lib/types";

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

export async function deleteRound(roundId: string) {
  if (isCloudflareD1Mode()) {
    // 共有D1にラウンド削除 API は提供しない（共有データ保護）。local 実装へ落とすと
    // 共有ラウンドはローカル state に無く silent no-op になるため、明示エラーにする。
    throw new Error(
      "共有保存（Cloudflare D1）のラウンドは削除できません（共有データ保護のため削除APIを提供していません）。",
    );
  }
  return localRepository.localDeleteRound(roundId);
}

export async function listDashboardData(): Promise<DashboardData> {
  if (isCloudflareD1Mode()) {
    return d1Repository.listDashboardData();
  }
  return localRepository.localListDashboardData();
}

export async function getRoundWorkspace(roundId: string): Promise<RoundWorkspace | null> {
  if (isCloudflareD1Mode()) {
    return d1Repository.getRoundWorkspace(roundId);
  }
  return localRepository.localGetRoundWorkspace(roundId);
}

export async function createInitialUsers() {
  if (isCloudflareD1Mode()) {
    return d1Repository.createInitialUsers();
  }
  return localRepository.localCreateInitialUsers();
}

export async function createUser(input: { name: string; role?: UserRole }) {
  if (isCloudflareD1Mode()) {
    return d1Repository.createUser(input);
  }
  return localRepository.localCreateUser(input);
}

export async function updateUserProfile(input: {
  userId: string;
  name: string;
  role: UserRole;
}) {
  if (isCloudflareD1Mode()) {
    return d1Repository.updateUserProfile(input);
  }
  return localRepository.localUpdateUserProfile(input);
}

export async function deleteUserIfInactive(userId: string) {
  return localRepository.localDeleteUserIfInactive(userId);
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
  if (isCloudflareD1Mode()) {
    return d1Repository.createRound(input);
  }
  return localRepository.localCreateRound(input);
}

export async function createDemoRound() {
  return localRepository.localCreateDemoRound();
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
  if (isCloudflareD1Mode()) {
    return d1Repository.updateRound(input);
  }
  return localRepository.localUpdateRound(input);
}

export async function updateMatch(input: {
  roundId: string;
  matchId: string;
  matchNo: number;
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
  if (isCloudflareD1Mode()) {
    return d1Repository.updateMatch(input);
  }
  return localRepository.localUpdateMatch(input);
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
  if (isCloudflareD1Mode()) {
    return d1Repository.bulkUpdateRoundMatches(input);
  }
  return localRepository.localBulkUpdateRoundMatches(input);
}

export async function estimateRoundAiModel(input: {
  overwriteExisting?: boolean;
  roundId: string;
}) {
  if (isCloudflareD1Mode()) {
    return d1Repository.estimateRoundAiModel(input);
  }
  return localRepository.localEstimateRoundAiModel(input);
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
  if (isCloudflareD1Mode()) {
    return d1Repository.replacePicks(input);
  }
  return localRepository.localReplacePicks(input);
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
  if (isCloudflareD1Mode()) {
    return d1Repository.replaceScoutReports(input);
  }
  return localRepository.localReplaceScoutReports(input);
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
  if (isCloudflareD1Mode()) {
    // generatedTickets は共有D1に保存先が無い（Worker の state は常に [] を返す）。
    // local 実装へ落とすと localStorage に書かれて共有画面には反映されない
    // silent no-op になるため、明示エラーにする。共有運用の候補比較は
    // pick-room の「候補カード」を使う（UI 側でも D1 では生成ボタンを抑止）。
    throw new Error(
      "「注目配分ジェネレーター」は端末ローカル専用のツールです（共有保存には未対応）。みんなで共有する候補は「候補カード」をご利用ください。",
    );
  }
  return localRepository.localReplaceGeneratedTickets(input);
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
  return localRepository.localListFixtureMaster(input);
}

export async function saveFixtureMasterEntries(input: {
  entries: FixtureMasterWriteInput[];
}) {
  return localRepository.localSaveFixtureMasterEntries(input);
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
  return localRepository.localCreateRoundFromFixtures(input);
}

export async function syncTotoOfficialRoundListFromOfficial(
  input: SyncTotoOfficialRoundApiInput,
): Promise<SyncTotoOfficialRoundListResponse> {
  if (shouldUseLocalRepository()) {
    return {
      fetchedAt: new Date().toISOString(),
      rounds: [],
      sourceText: null,
      sourceUrl: input.sourceUrl ?? "https://toto.yahoo.co.jp/schedule/toto",
      warnings: ["ローカル保存モードでは公式回リスト同期を行いません。JSON取り込みまたは手入力で続行できます。"],
    };
  }

  throw new Error("自動同期は廃止されました（Supabase 終了）。CSV / 手入力 / JSON 取り込みをご利用ください。");
}

/**
 * BIG 公式くじ情報の取得。
 *
 * 公式ページは公開情報で、保存モード（Cloudflare D1 / localStorage）とは独立。
 * ブラウザから公式ドメインを直接 fetch すると CORS で落ちるため、同一オリジンの
 * Pages Function（functions/api/big-official-watch.ts）にサーバ側で取らせる。
 * Functions が無い配信（github.io / ローカル dev）では取得できないので、
 * その場合は空 payload を返して /big-carryover のHTML貼り付けに委ねる。
 */
export async function syncBigOfficialWatchFromOfficial(
  // input は呼び出し側の API 互換のため残置（取得先は Function 側で固定）。
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  input: SyncBigOfficialWatchApiInput = {},
): Promise<BigOfficialSyncPayload> {
  if (typeof window === "undefined") {
    return localRepository.localSyncBigOfficialWatchFromOfficial();
  }

  try {
    const response = await fetch("/api/big-official-watch", {
      headers: { Accept: "application/json" },
    });

    if (response.ok) {
      const payload = (await response.json()) as BigOfficialSyncPayload;
      if (Array.isArray(payload?.snapshots)) {
        return payload;
      }
    }
  } catch {
    // ネットワーク断・Functions 無しの配信。下の fallback へ流す。
  }

  return localRepository.localSyncBigOfficialWatchFromOfficial();
}

export async function upsertTotoOfficialRoundLibraryFromSync(input: {
  entries: SyncedTotoOfficialRoundEntry[];
  sourceUrl: string | null;
}) {
  return localRepository.localUpsertTotoOfficialRoundLibraryFromSync(input);
}

async function getTotoOfficialRoundLibraryEntry(entryId: string) {
  return localRepository.localGetTotoOfficialRoundLibraryEntry(entryId);
}

export async function listTotoOfficialRoundLibrary(input?: {
  productType?: ProductType | null;
  resultStatus?: TotoOfficialResultStatus | null;
  searchQuery?: string | null;
}) {
  return localRepository.localListTotoOfficialRoundLibrary(input);
}

export async function saveTotoOfficialRoundLibraryEntry(
  input: TotoOfficialRoundImportInput & {
    id?: string | null;
  },
) {
  return localRepository.localSaveTotoOfficialRoundLibraryEntry(input);
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
  if (shouldUseLocalRepository()) {
    return localRepository.localInstantiateTotoOfficialRoundLibraryEntry(input);
  }

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
  return localRepository.localSaveTotoOfficialRoundImport(input);
}

export async function refreshCandidateTicketsForRound(input: {
  force?: boolean;
  roundId: string;
  /** 呼び出し側が直前に読み込んだ workspace。渡すと再フェッチせずそのデータから候補を生成する。 */
  workspace?: RoundWorkspace | null;
}) {
  const workspace =
    input.workspace && input.workspace.round.id === input.roundId
      ? input.workspace
      : await getRoundWorkspace(input.roundId);
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

  // 保存後の round は返さない（全呼び出し元が自前で refresh するため、
  // ここでの再フェッチは D1 モードで丸ごと1往復の無駄になる）。
  return {
    dataQualitySummary: generated.dataQualitySummary,
    regenerated: true,
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
  if (isCloudflareD1Mode()) {
    return d1Repository.saveRoundEvAssumption(input);
  }
  return localRepository.localSaveRoundEvAssumption(input);
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
  if (isCloudflareD1Mode()) {
    return d1Repository.replaceCandidateTickets(input);
  }
  return localRepository.localReplaceCandidateTickets(input);
}

export async function upsertCandidateVote(input: {
  roundId: string;
  candidateTicketId: string;
  userId: string;
  vote: CandidateVoteValue;
  comment: string | null;
}) {
  if (isCloudflareD1Mode()) {
    return d1Repository.upsertCandidateVote(input);
  }
  return localRepository.localUpsertCandidateVote(input);
}

export async function saveResults(input: {
  roundId: string;
  status: RoundStatus;
  results: Array<{
    actualResult: Outcome | null;
    matchId: string;
    matchNo: number;
  }>;
}) {
  if (isCloudflareD1Mode()) {
    return d1Repository.saveResults(input);
  }
  return localRepository.localSaveResults(input);
}

export async function addReviewNote(input: {
  roundId: string;
  matchId: string | null;
  userId: string | null;
  note: string;
}) {
  if (isCloudflareD1Mode()) {
    return d1Repository.addReviewNote(input);
  }
  return localRepository.localAddReviewNote(input);
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
  if (isCloudflareD1Mode()) {
    return d1Repository.saveResearchMemo(input);
  }
  return localRepository.localSaveResearchMemo(input);
}

export async function deleteResearchMemo(input: {
  memoId: string;
  roundId: string;
}) {
  if (isCloudflareD1Mode()) {
    return d1Repository.deleteResearchMemo(input);
  }
  return localRepository.localDeleteResearchMemo(input.memoId);
}

export async function exportRoundJson(roundId: string) {
  const workspace = await getRoundWorkspace(roundId);
  if (!workspace) {
    throw new Error("JSON export 対象のラウンドが見つかりません。");
  }

  const mode = getRuntimeDataMode();
  return localRepository.buildLocalRoundBundle(
    workspace,
    mode === "cloudflare_d1" ? "shared" : mode,
  );
}

export async function importRoundJson(
  bundle: localRepository.LocalRoundBundle,
  strategy: "copy" | "overwrite",
) {
  if (isCloudflareD1Mode()) {
    return d1Repository.importRoundBundle(bundle, strategy);
  }
  return localRepository.localImportRoundBundle(bundle, strategy);
}
