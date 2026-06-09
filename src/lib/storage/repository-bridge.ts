/**
 * 既存 repository / local-repository を `StorageAdapter` 契約へ橋渡しする内部ファクトリ。
 *
 * 各 adapter（`localStorageAdapter` など）は、ほぼ同じ手順で「round 単位の facade」を
 * 個別エンティティ API に整える。その共通部分をここに集約し、各 adapter は
 * 「どの backend 関数を使うか」だけを差し替える（追加方式・最小差分）。
 */
import type {
  HumanScoutReport,
  Match,
  Outcome,
  Pick,
  Round,
  RoundStatus,
  RoundWorkspaceRound,
} from "@/lib/types";
import type {
  CandidateTicketUpsert,
  CandidateVoteUpsert,
  CreateRoundInput,
  ImportStrategy,
  MatchUpsertRow,
  ReviewNoteUpsert,
  RoundBundle,
  ScoutReportUpsert,
  StorageAdapter,
  StorageHealth,
  StorageMode,
  UpdateRoundPatch,
} from "@/lib/storage/types";

/** `repository.updateRound` / `localUpdateRound` と同一の入力シェイプ。 */
export type BackendUpdateRoundInput = UpdateRoundPatch & {
  roundId: string;
  budgetYen: number | null;
  notes: string | null;
  status: RoundStatus;
  title: string;
};

/** repository / local-repository が共通して提供する低レベル関数の束。 */
export type RepositoryBackend = {
  listRounds(): Promise<Round[]>;
  getWorkspaceRound(roundId: string): Promise<RoundWorkspaceRound | null>;
  createRound(input: CreateRoundInput): Promise<string>;
  updateRound(input: BackendUpdateRoundInput): Promise<unknown>;
  deleteRound(roundId: string): Promise<unknown>;
  bulkUpdateMatches(input: { roundId: string; rows: MatchUpsertRow[] }): Promise<unknown>;
  replacePicks(input: {
    roundId: string;
    userId: string;
    picks: Array<{ matchId: string; note: string | null; pick: Outcome | null }>;
  }): Promise<unknown>;
  replaceScoutReports(input: {
    roundId: string;
    userId: string;
    reports: Array<Omit<ScoutReportUpsert, "roundId" | "userId">>;
  }): Promise<unknown>;
  replaceCandidateTickets(input: {
    roundId: string;
    tickets: CandidateTicketUpsert[];
  }): Promise<unknown>;
  upsertCandidateVote(input: CandidateVoteUpsert): Promise<unknown>;
  addReviewNote(input: ReviewNoteUpsert): Promise<unknown>;
  exportBundle(roundId: string): Promise<RoundBundle>;
  importBundle(bundle: RoundBundle, strategy: ImportStrategy): Promise<string>;
};

/** DashboardRoundSummary / RoundWorkspaceRound から base Round だけを取り出す。 */
export function toBaseRound(round: Round): Round {
  return {
    id: round.id,
    title: round.title,
    status: round.status,
    budgetYen: round.budgetYen,
    notes: round.notes,
    competitionType: round.competitionType,
    productType: round.productType,
    sportContext: round.sportContext,
    primaryUse: round.primaryUse,
    requiredMatchCount: round.requiredMatchCount,
    activeMatchCount: round.activeMatchCount,
    dataProfile: round.dataProfile,
    probabilityReadiness: round.probabilityReadiness,
    roundSource: round.roundSource,
    sourceNote: round.sourceNote,
    outcomeSetJson: round.outcomeSetJson,
    voidHandling: round.voidHandling,
    participantIds: round.participantIds,
    createdAt: round.createdAt,
    updatedAt: round.updatedAt,
  };
}

async function requireWorkspaceRound(
  backend: RepositoryBackend,
  roundId: string,
): Promise<RoundWorkspaceRound> {
  const round = await backend.getWorkspaceRound(roundId);
  if (!round) {
    throw new Error(`Round が見つかりません: ${roundId}`);
  }
  return round;
}

function mergeSinglePick(
  picks: Pick[],
  matchId: string,
  pick: Outcome,
): Array<{ matchId: string; note: string | null; pick: Outcome | null }> {
  const next = picks.map((entry) => ({
    matchId: entry.matchId,
    note: entry.note,
    pick: entry.pick as Outcome | null,
  }));

  const existing = next.find((entry) => entry.matchId === matchId);
  if (existing) {
    existing.pick = pick;
  } else {
    next.push({ matchId, note: null, pick });
  }

  return next;
}

function mergeSingleScoutReport(
  reports: HumanScoutReport[],
  next: ScoutReportUpsert,
): Array<Omit<ScoutReportUpsert, "roundId" | "userId">> {
  const merged = new Map<string, Omit<ScoutReportUpsert, "roundId" | "userId">>();

  for (const report of reports) {
    merged.set(report.matchId, {
      matchId: report.matchId,
      scoreStrengthForm: report.scoreStrengthForm,
      noteStrengthForm: report.noteStrengthForm,
      scoreAvailability: report.scoreAvailability,
      noteAvailability: report.noteAvailability,
      scoreConditions: report.scoreConditions,
      noteConditions: report.noteConditions,
      scoreTacticalMatchup: report.scoreTacticalMatchup,
      noteTacticalMatchup: report.noteTacticalMatchup,
      scoreMicro: report.scoreMicro,
      noteMicro: report.noteMicro,
      drawAlert: report.drawAlert,
      noteDrawAlert: report.noteDrawAlert,
      directionScoreF: report.directionScoreF,
      provisionalCall: report.provisionalCall,
      exceptionFlag: report.exceptionFlag,
      exceptionNote: report.exceptionNote,
    });
  }

  merged.set(next.matchId, {
    matchId: next.matchId,
    scoreStrengthForm: next.scoreStrengthForm,
    noteStrengthForm: next.noteStrengthForm,
    scoreAvailability: next.scoreAvailability,
    noteAvailability: next.noteAvailability,
    scoreConditions: next.scoreConditions,
    noteConditions: next.noteConditions,
    scoreTacticalMatchup: next.scoreTacticalMatchup,
    noteTacticalMatchup: next.noteTacticalMatchup,
    scoreMicro: next.scoreMicro,
    noteMicro: next.noteMicro,
    drawAlert: next.drawAlert,
    noteDrawAlert: next.noteDrawAlert,
    directionScoreF: next.directionScoreF,
    provisionalCall: next.provisionalCall,
    exceptionFlag: next.exceptionFlag,
    exceptionNote: next.exceptionNote,
  });

  return Array.from(merged.values());
}

/**
 * repository / local-repository の関数束を `StorageAdapter` に変換する。
 * 個別エンティティの read は round workspace から切り出し、
 * 単発の upsert は「現状を読み出して 1件だけ差し替えて bulk 保存」に変換する。
 */
export function createRepositoryAdapter(
  mode: StorageMode,
  backend: RepositoryBackend,
  health: () => Promise<StorageHealth>,
): StorageAdapter {
  return {
    mode,
    health,

    async getRounds() {
      const rounds = await backend.listRounds();
      return rounds.map(toBaseRound);
    },

    async getRound(roundId) {
      const round = await backend.getWorkspaceRound(roundId);
      return round ? toBaseRound(round) : null;
    },

    async createRound(input) {
      return backend.createRound(input);
    },

    async updateRound(roundId, patch) {
      const current = await requireWorkspaceRound(backend, roundId);
      await backend.updateRound({
        roundId,
        title: patch.title ?? current.title,
        status: patch.status ?? current.status,
        budgetYen: patch.budgetYen ?? current.budgetYen,
        notes: patch.notes ?? current.notes,
        competitionType: patch.competitionType ?? current.competitionType,
        dataProfile: patch.dataProfile ?? current.dataProfile,
        outcomeSetJson: patch.outcomeSetJson ?? current.outcomeSetJson,
        participantIds: patch.participantIds ?? current.participantIds,
        primaryUse: patch.primaryUse ?? current.primaryUse,
        probabilityReadiness:
          patch.probabilityReadiness ?? current.probabilityReadiness,
        productType: patch.productType ?? current.productType,
        requiredMatchCount: patch.requiredMatchCount ?? current.requiredMatchCount,
        roundSource: patch.roundSource ?? current.roundSource,
        sourceNote: patch.sourceNote ?? current.sourceNote,
        sportContext: patch.sportContext ?? current.sportContext,
        voidHandling: patch.voidHandling ?? current.voidHandling,
      });
    },

    async deleteRound(roundId) {
      await backend.deleteRound(roundId);
    },

    async getMatches(roundId): Promise<Match[]> {
      const round = await requireWorkspaceRound(backend, roundId);
      return round.matches;
    },

    async upsertMatches(roundId, matches) {
      await backend.bulkUpdateMatches({ roundId, rows: matches });
    },

    async getPicks(roundId) {
      const round = await requireWorkspaceRound(backend, roundId);
      return round.picks;
    },

    async upsertPick(roundId, userId, matchId, pick) {
      const round = await requireWorkspaceRound(backend, roundId);
      const userPicks = round.picks.filter((entry) => entry.userId === userId);
      await backend.replacePicks({
        roundId,
        userId,
        picks: mergeSinglePick(userPicks, matchId, pick),
      });
    },

    async getScoutReports(roundId) {
      const round = await requireWorkspaceRound(backend, roundId);
      return round.scoutReports;
    },

    async upsertScoutReport(report) {
      const round = await requireWorkspaceRound(backend, report.roundId);
      const userReports = round.scoutReports.filter(
        (entry) => entry.userId === report.userId,
      );
      await backend.replaceScoutReports({
        roundId: report.roundId,
        userId: report.userId,
        reports: mergeSingleScoutReport(userReports, report),
      });
    },

    async getCandidateTickets(roundId) {
      const round = await requireWorkspaceRound(backend, roundId);
      return round.candidateTickets;
    },

    async upsertCandidateTickets(roundId, tickets) {
      await backend.replaceCandidateTickets({ roundId, tickets });
    },

    async getCandidateVotes(roundId) {
      const round = await requireWorkspaceRound(backend, roundId);
      return round.candidateVotes;
    },

    async upsertCandidateVote(vote) {
      await backend.upsertCandidateVote(vote);
    },

    async getReviewNotes(roundId) {
      const round = await requireWorkspaceRound(backend, roundId);
      return round.reviewNotes;
    },

    async upsertReviewNote(note) {
      await backend.addReviewNote(note);
    },

    async exportRoundBundle(roundId) {
      return backend.exportBundle(roundId);
    },

    async importRoundBundle(bundle, strategy = "copy") {
      return backend.importBundle(bundle, strategy);
    },
  };
}
