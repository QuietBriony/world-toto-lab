/**
 * Cloudflare D1 backed repository（ライブのデータ読み書きを D1 へ）。
 *
 * 読み取り: Worker の GET /api/state（round 単位の読み取りは ?round=<id> で絞る）から
 *   状態を取得し、local-repository の純粋 assembler
 *   `workspaceFromState` / `summaryFromWorkspace` を再利用して RoundWorkspace / Dashboard を組む。
 * 書き込み: Worker の各エンドポイントへ fetch（round 単位の editToken を添付）。
 *
 * repository.ts から `isCloudflareD1Mode()` のときに短絡呼び出しされる。
 * D1 未対応の操作（fixture master / official library / sync / round 削除 / demo 等）は
 * repository 側で local fallback されるため、ここには実装しない。
 */
import {
  estimateModelUpdatesForMatches,
  summaryFromWorkspace,
  workspaceFromState,
  type LocalState,
} from "@/lib/local-repository";
import {
  getStoredRoundTokens,
  storeRoundTokens,
} from "@/lib/storage/d1ApiAdapter";
import { defaultInitialUsers } from "@/lib/sample-data";
import type {
  DashboardData,
  Match,
  RoundWorkspace,
  User,
  UserRole,
} from "@/lib/types";

function apiBase() {
  return (process.env.NEXT_PUBLIC_D1_API_BASE ?? "").replace(/\/+$/, "");
}

function enc(value: string) {
  return encodeURIComponent(value);
}

type RequestOptions = {
  body?: unknown;
  roundId?: string;
  write?: boolean;
};

async function req<T = unknown>(
  method: string,
  path: string,
  { body, roundId, write }: RequestOptions = {},
): Promise<T> {
  const base = apiBase();
  if (!base) {
    throw new Error("NEXT_PUBLIC_D1_API_BASE が設定されていません。");
  }

  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (roundId) {
    const tokens = getStoredRoundTokens(roundId);
    if (tokens?.shareCode) headers["X-Share-Code"] = tokens.shareCode;
    if (write && tokens?.editToken) headers["X-Edit-Token"] = tokens.editToken;
    if (write && tokens?.adminToken) headers["X-Admin-Token"] = tokens.adminToken;
  }

  const response = await fetch(`${base}${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  if (!response.ok) {
    let message = `${method} ${path} に失敗しました (HTTP ${response.status})`;
    try {
      const data = (await response.json()) as { error?: unknown };
      if (data?.error) message = String(data.error);
    } catch {
      // ignore
    }
    throw new Error(message);
  }

  if (response.status === 204) {
    return undefined as T;
  }
  return (await response.json()) as T;
}

function emptyState(): LocalState {
  return {
    candidateTickets: [],
    candidateVotes: [],
    fixtureMaster: [],
    generatedTickets: [],
    matches: [],
    officialRoundLibrary: [],
    picks: [],
    researchMemos: [],
    reviewNotes: [],
    roundEvAssumptions: [],
    rounds: [],
    scoutReports: [],
    totoOfficialMatches: [],
    totoOfficialRounds: [],
    users: [],
  };
}

async function fetchState(roundId?: string): Promise<LocalState> {
  // roundId 指定時は Worker 側でそのラウンドの行だけに絞る（ペイロードと D1 読み取りを削減）。
  // ?round= 未対応の旧 Worker はパラメータを無視して全状態を返すが、
  // 利用側の workspaceFromState が roundId で絞るため結果は等価。
  const path = roundId ? `/api/state?round=${enc(roundId)}` : "/api/state";
  const data = await req<{ state?: Partial<LocalState> }>("GET", path);
  return { ...emptyState(), ...(data.state ?? {}) };
}

function sortUsers(users: User[]) {
  return users
    .slice()
    .sort(
      (left, right) =>
        left.role.localeCompare(right.role) || left.name.localeCompare(right.name),
    );
}

// --- reads ------------------------------------------------------------------

export async function getRoundWorkspace(
  roundId: string,
): Promise<RoundWorkspace | null> {
  const state = await fetchState(roundId);
  return workspaceFromState(state, roundId);
}

export async function listDashboardData(): Promise<DashboardData> {
  const state = await fetchState();
  const rounds = state.rounds
    .slice()
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt))
    .flatMap((round) => {
      const workspace = workspaceFromState(state, round.id);
      return workspace ? [summaryFromWorkspace(workspace)] : [];
    });

  return {
    demoUsers: [],
    rounds,
    users: sortUsers(state.users),
  };
}

// --- users ------------------------------------------------------------------

async function listUsers(): Promise<User[]> {
  const data = await req<{ users?: User[] }>("GET", "/api/users");
  return sortUsers(data.users ?? []);
}

export async function createInitialUsers(): Promise<User[]> {
  const existing = await listUsers();
  if (existing.length > 0) {
    return existing;
  }
  for (const user of defaultInitialUsers) {
    await req("POST", "/api/users", {
      body: { name: user.name, role: user.role },
      write: true,
    });
  }
  return listUsers();
}

export async function createUser(input: {
  name: string;
  role?: UserRole;
}): Promise<User[]> {
  await req("POST", "/api/users", {
    body: { name: input.name, role: input.role ?? "member" },
    write: true,
  });
  return listUsers();
}

export async function updateUserProfile(input: {
  name: string;
  role: UserRole;
  userId: string;
}): Promise<User[]> {
  await req("PATCH", `/api/users/${enc(input.userId)}`, {
    body: { name: input.name, role: input.role },
    write: true,
  });
  return listUsers();
}

// --- round writes -----------------------------------------------------------

export async function createRound(input: Record<string, unknown>): Promise<string> {
  const data = await req<{
    round: { id: string };
    shareCode: string;
    editToken: string;
    adminToken?: string;
  }>("POST", "/api/rounds", { body: input, write: true });

  if (data.round?.id) {
    storeRoundTokens(data.round.id, {
      shareCode: data.shareCode,
      editToken: data.editToken,
      adminToken: data.adminToken,
    });
  }
  return data.round.id;
}

export async function updateRound(
  input: { roundId: string } & Record<string, unknown>,
): Promise<void> {
  await req("PATCH", `/api/rounds/${enc(input.roundId)}`, {
    body: input,
    roundId: input.roundId,
    write: true,
  });
}

export async function bulkUpdateRoundMatches(input: {
  roundId: string;
  rows: Array<Record<string, unknown> & { matchNo: number }>;
}): Promise<Match[]> {
  const data = await req<{ matches?: Match[] }>("POST", `/api/rounds/${enc(input.roundId)}/matches`, {
    body: { matches: input.rows },
    roundId: input.roundId,
    write: true,
  });
  return data.matches ?? [];
}

export async function updateMatch(
  input: { roundId: string; matchId: string; matchNo: number } & Record<string, unknown>,
): Promise<void> {
  // matches は matchNo キーで upsert する。matchNo は呼び出し側が既に持っているため
  // そのまま受け取り、解決のためだけの round state フェッチは行わない。
  await req("POST", `/api/rounds/${enc(input.roundId)}/matches`, {
    body: { matches: [{ ...input, id: input.matchId }] },
    roundId: input.roundId,
    write: true,
  });
}

export async function replacePicks(input: {
  roundId: string;
  userId: string;
  picks: Array<Record<string, unknown>>;
}): Promise<void> {
  await req("POST", `/api/rounds/${enc(input.roundId)}/picks`, {
    body: { userId: input.userId, picks: input.picks },
    roundId: input.roundId,
    write: true,
  });
}

export async function replaceScoutReports(input: {
  roundId: string;
  userId: string;
  reports: Array<Record<string, unknown>>;
}): Promise<void> {
  await req("POST", `/api/rounds/${enc(input.roundId)}/scout-reports`, {
    body: { userId: input.userId, reports: input.reports },
    roundId: input.roundId,
    write: true,
  });
}

export async function replaceCandidateTickets(input: {
  roundId: string;
  tickets: Array<Record<string, unknown>>;
}): Promise<void> {
  await req("POST", `/api/rounds/${enc(input.roundId)}/candidate-tickets`, {
    body: { tickets: input.tickets },
    roundId: input.roundId,
    write: true,
  });
}

export async function estimateRoundAiModel(input: {
  overwriteExisting?: boolean;
  roundId: string;
}): Promise<{ skippedCount: number; updatedCount: number }> {
  // 推定ロジックは local と共用の純粋関数。round-scoped state を読み、
  // 更新行だけを matches へ部分 upsert する（Worker 側マージで他フィールド保持）。
  const state = await fetchState(input.roundId);
  const round = state.rounds.find((entry) => entry.id === input.roundId) ?? null;
  if (!round) {
    throw new Error("AI推定の対象ラウンドが見つかりません。");
  }

  const { skippedCount, updates } = estimateModelUpdatesForMatches({
    matches: state.matches.filter((match) => match.roundId === input.roundId),
    overwriteExisting: input.overwriteExisting ?? false,
    round,
  });

  if (updates.length > 0) {
    await bulkUpdateRoundMatches({ roundId: input.roundId, rows: updates });
  }

  return { skippedCount, updatedCount: updates.length };
}

export async function saveResults(input: {
  roundId: string;
  status: string;
  results: Array<{ actualResult: string | null; matchId: string; matchNo: number }>;
}): Promise<void> {
  // matches upsert は matchNo キーの部分マージ（Worker 側が既存フィールドを保持するため
  // actualResult だけ送ればよい）。round status の PATCH も部分マージ。相互独立なので並列。
  await Promise.all([
    req("POST", `/api/rounds/${enc(input.roundId)}/matches`, {
      body: {
        matches: input.results.map((row) => ({
          actualResult: row.actualResult,
          id: row.matchId,
          matchNo: row.matchNo,
        })),
      },
      roundId: input.roundId,
      write: true,
    }),
    req("PATCH", `/api/rounds/${enc(input.roundId)}`, {
      body: { status: input.status },
      roundId: input.roundId,
      write: true,
    }),
  ]);
}

export async function upsertCandidateVote(input: {
  roundId: string;
  candidateTicketId: string;
  userId: string;
  vote: string;
  comment: string | null;
}): Promise<void> {
  await req("POST", `/api/rounds/${enc(input.roundId)}/candidate-votes`, {
    body: input,
    roundId: input.roundId,
    write: true,
  });
}

export async function addReviewNote(input: {
  roundId: string;
  matchId: string | null;
  userId: string | null;
  note: string;
}): Promise<void> {
  await req("POST", `/api/rounds/${enc(input.roundId)}/review-notes`, {
    body: input,
    roundId: input.roundId,
    write: true,
  });
}

export async function saveResearchMemo(
  input: { roundId: string } & Record<string, unknown>,
): Promise<void> {
  await req("POST", `/api/rounds/${enc(input.roundId)}/research-memos`, {
    body: input,
    roundId: input.roundId,
    write: true,
  });
}

export async function deleteResearchMemo(input: {
  memoId: string;
  roundId: string;
}): Promise<void> {
  // Worker 側 DELETE は idempotent（存在しない memo でも ok を返す）なので、
  // roundId 逆引きのためだけの全 state フェッチは行わない。
  await req(
    "DELETE",
    `/api/rounds/${enc(input.roundId)}/research-memos/${enc(input.memoId)}`,
    {
      roundId: input.roundId,
      write: true,
    },
  );
}

export async function saveRoundEvAssumption(
  input: { roundId: string } & Record<string, unknown>,
): Promise<void> {
  await req("POST", `/api/rounds/${enc(input.roundId)}/ev-assumption`, {
    body: input,
    roundId: input.roundId,
    write: true,
  });
}
