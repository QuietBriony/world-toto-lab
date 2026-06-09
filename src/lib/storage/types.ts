/**
 * StorageAdapter 抽象層の共通型。
 *
 * 目的: World Toto Lab の保存先（localStorage / Cloudflare D1 API / demo）を
 * 1つの interface で扱えるようにする。既存の `src/lib/repository.ts` を壊さない追加方式の
 * 第一歩で、まずは「契約（interface）」と「共通型」だけをここに定義する。
 *
 * 戻り値はできるだけ既存のドメイン型（`@/lib/types`）に揃える。
 */
import type { LocalRoundBundle } from "@/lib/local-repository";
import type {
  CandidateDataQuality,
  CandidateStrategyType,
  CandidateTicket,
  CandidateVote,
  CandidateVoteValue,
  CompetitionType,
  DataProfile,
  HumanScoutReport,
  Match,
  Outcome,
  Pick,
  PrimaryUse,
  ProbabilityReadiness,
  ProductType,
  ProvisionalCall,
  ReviewNote,
  Round,
  RoundSource,
  RoundStatus,
  SportContext,
  VoidHandling,
} from "@/lib/types";

/**
 * 保存モード。
 * - `local`         : ブラウザ localStorage（単独作業用 fallback）
 * - `cloudflare_d1` : Cloudflare Worker / Pages Functions 経由の D1（SQLite、共有保存）
 * - `demo`          : サンプルデータ閲覧用（書き込みは破棄）
 */
export type StorageMode = "local" | "cloudflare_d1" | "demo";

export const STORAGE_MODES: readonly StorageMode[] = [
  "local",
  "cloudflare_d1",
  "demo",
] as const;

export function isStorageMode(value: unknown): value is StorageMode {
  return (
    value === "local" ||
    value === "cloudflare_d1" ||
    value === "demo"
  );
}

/** Round 単位の export/import バンドル。既存の JSON export と同一形式。 */
export type RoundBundle = LocalRoundBundle;

/** import 時の取り込み方法。`copy` は別Roundとして、`overwrite` は同一IDへ上書き。 */
export type ImportStrategy = "copy" | "overwrite";

export type StorageHealthStatus =
  | "ok"
  | "unreachable"
  | "missing_config"
  | "error";

export type StorageHealth = {
  status: StorageHealthStatus;
  message: string;
  checkedAt: string;
};

/** Round 作成入力（`repository.createRound` と同一シェイプ）。 */
export type CreateRoundInput = {
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
};

/** Round 更新パッチ。指定したフィールドのみ更新する（未指定は現状維持）。 */
export type UpdateRoundPatch = {
  budgetYen?: number | null;
  competitionType?: CompetitionType | null;
  dataProfile?: DataProfile | null;
  notes?: string | null;
  outcomeSetJson?: string[] | null;
  participantIds?: string[];
  primaryUse?: PrimaryUse | null;
  probabilityReadiness?: ProbabilityReadiness | null;
  productType?: ProductType;
  requiredMatchCount?: number | null;
  roundSource?: RoundSource;
  sourceNote?: string | null;
  sportContext?: SportContext | null;
  status?: RoundStatus;
  title?: string;
  voidHandling?: VoidHandling;
};

/** 試合の一括 upsert 行（match-editor の一括編集と同一シェイプ）。 */
export type MatchUpsertRow = {
  adminNote: string | null;
  awayTeam: string;
  homeTeam: string;
  kickoffTime: string | null;
  matchNo: number;
  stage: string | null;
  venue: string | null;
};

/** Human Scout Card 1件の upsert 入力。 */
export type ScoutReportUpsert = {
  roundId: string;
  userId: string;
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
};

/** Candidate Ticket 1件の upsert 入力（round 内のセットを置き換える）。 */
export type CandidateTicketUpsert = {
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
};

/** Candidate Vote の upsert 入力。 */
export type CandidateVoteUpsert = {
  roundId: string;
  candidateTicketId: string;
  userId: string;
  vote: CandidateVoteValue;
  comment: string | null;
};

/** Review Note の upsert（追記）入力。 */
export type ReviewNoteUpsert = {
  roundId: string;
  matchId: string | null;
  userId: string | null;
  note: string;
};

/**
 * 保存先を抽象化する共通 interface。
 *
 * 既存の `repository.ts` / `local-repository.ts` のサーフェスを、保存先非依存の
 * 最小契約に整理したもの。Cloudflare D1（`d1ApiAdapter`）や将来の保存先も
 * この契約を満たすことで差し替え可能になる。
 */
export interface StorageAdapter {
  readonly mode: StorageMode;

  /** 接続状態の確認（バッジ / Settings 表示や mode 判定に使う）。 */
  health(): Promise<StorageHealth>;

  // --- Round ---
  getRounds(): Promise<Round[]>;
  getRound(roundId: string): Promise<Round | null>;
  createRound(input: CreateRoundInput): Promise<string>;
  updateRound(roundId: string, patch: UpdateRoundPatch): Promise<void>;
  /**
   * Round 削除。local では実行されるが、`cloudflare_d1` では
   * 安全のため未実装（adminToken 必須の設計）。本番データ保護のため安易に呼ばない。
   */
  deleteRound(roundId: string): Promise<void>;

  // --- Match ---
  getMatches(roundId: string): Promise<Match[]>;
  upsertMatches(roundId: string, matches: MatchUpsertRow[]): Promise<void>;

  // --- Human Picks ---
  getPicks(roundId: string): Promise<Pick[]>;
  upsertPick(
    roundId: string,
    userId: string,
    matchId: string,
    pick: Outcome,
  ): Promise<void>;

  // --- Human Scout Cards ---
  getScoutReports(roundId: string): Promise<HumanScoutReport[]>;
  upsertScoutReport(report: ScoutReportUpsert): Promise<void>;

  // --- Candidate Tickets ---
  getCandidateTickets(roundId: string): Promise<CandidateTicket[]>;
  upsertCandidateTickets(
    roundId: string,
    tickets: CandidateTicketUpsert[],
  ): Promise<void>;

  // --- Candidate Votes ---
  getCandidateVotes(roundId: string): Promise<CandidateVote[]>;
  upsertCandidateVote(vote: CandidateVoteUpsert): Promise<void>;

  // --- Review Notes ---
  getReviewNotes(roundId: string): Promise<ReviewNote[]>;
  upsertReviewNote(note: ReviewNoteUpsert): Promise<void>;

  // --- JSON export / import（local ⇄ D1 の移行・バックアップに使う） ---
  exportRoundBundle(roundId: string): Promise<RoundBundle>;
  importRoundBundle(
    bundle: RoundBundle,
    strategy?: ImportStrategy,
  ): Promise<string>;
}
