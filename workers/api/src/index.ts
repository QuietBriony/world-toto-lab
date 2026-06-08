/**
 * World Toto Lab — Cloudflare Worker API（D1 backend）
 *
 * GitHub Pages / Cloudflare Pages のブラウザから叩く REST API。
 * ブラウザは D1 へ直接接続せず、この Worker 経由でアクセスする。
 *
 * 認可（MVP の最低限）:
 *  - 読み取り: public（誰でも GET 可）
 *  - 書き込み: Round 作成時に払い出した editToken または adminToken が必要
 *  - Round 削除 API は提供しない（本番データ保護。adminToken でも未実装）
 *
 * セキュリティ:
 *  - editToken / adminToken は平文を保存せず SHA-256 hex で照合
 *  - CORS は許可 origin のみ反射（ワイルドカード不使用）
 *
 * 注意: 将来 Cloudflare Pages Functions へ移す場合も、この fetch ハンドラの
 * ルーティング/SQL をほぼそのまま `functions/api/[[path]].ts` へ移植できる構成。
 */
import { corsHeaders, parseAllowedOrigins } from "./cors";
import { generateRoundTokens, sha256Hex, timingSafeEqual } from "./tokens";

export interface Env {
  DB: D1Database;
  ALLOWED_ORIGINS?: string;
}

type AnyRecord = Record<string, unknown>;

const nowIso = () => new Date().toISOString();
const newId = () => crypto.randomUUID();

function parseJson(text: string | null): AnyRecord {
  if (!text) return {};
  try {
    const parsed = JSON.parse(text);
    return parsed && typeof parsed === "object" ? (parsed as AnyRecord) : {};
  } catch {
    return {};
  }
}

function jsonResponse(
  data: unknown,
  status: number,
  cors: Record<string, string>,
) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json", ...cors },
  });
}

function errorResponse(
  message: string,
  status: number,
  cors: Record<string, string>,
) {
  return jsonResponse({ error: message }, status, cors);
}

// --- row <-> domain ---------------------------------------------------------

type RoundRow = {
  id: string;
  title: string;
  status: string;
  share_code: string | null;
  edit_token_hash: string | null;
  admin_token_hash: string | null;
  data: string;
  created_at: string;
  updated_at: string;
};

type EntityRow = {
  id: string;
  round_id: string;
  data: string;
  created_at: string;
  updated_at: string;
};

function roundExtras(row: RoundRow): AnyRecord {
  const extras = parseJson(row.data).__extras;
  return extras && typeof extras === "object" ? (extras as AnyRecord) : {};
}

function roundRowToDomain(row: RoundRow): AnyRecord {
  const data = parseJson(row.data);
  delete data.__extras;
  return {
    ...data,
    id: row.id,
    title: row.title,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function entityRowToDomain(row: EntityRow): AnyRecord {
  return {
    ...parseJson(row.data),
    id: row.id,
    roundId: row.round_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function buildRoundFromInput(id: string, input: AnyRecord): AnyRecord {
  const timestamp = nowIso();
  const matchCount =
    (input.matchCount as number | null | undefined) ??
    (input.requiredMatchCount as number | null | undefined) ??
    null;
  return {
    id,
    title: String(input.title ?? "Round"),
    status: (input.status as string) ?? "draft",
    budgetYen: (input.budgetYen as number | null) ?? null,
    notes: (input.notes as string | null) ?? null,
    competitionType: (input.competitionType as string) ?? "custom",
    productType: (input.productType as string) ?? "toto13",
    sportContext: (input.sportContext as string) ?? "other",
    primaryUse: (input.primaryUse as string) ?? "friend_game",
    requiredMatchCount:
      (input.requiredMatchCount as number | null) ?? matchCount,
    activeMatchCount: matchCount,
    dataProfile: (input.dataProfile as string) ?? "manual_light",
    probabilityReadiness:
      (input.probabilityReadiness as string) ?? "not_ready",
    roundSource: (input.roundSource as string) ?? "user_manual",
    sourceNote: (input.sourceNote as string | null) ?? null,
    outcomeSetJson:
      (input.outcomeSetJson as string[] | null) ?? ["1", "0", "2"],
    voidHandling: (input.voidHandling as string) ?? "manual",
    participantIds: (input.participantIds as string[]) ?? [],
    createdAt: timestamp,
    updatedAt: timestamp,
  };
}

// --- auth -------------------------------------------------------------------

async function isAuthorized(
  request: Request,
  round: RoundRow,
  level: "edit" | "admin",
): Promise<boolean> {
  const adminHeader = request.headers.get("X-Admin-Token");
  if (round.admin_token_hash && adminHeader) {
    if (timingSafeEqual(await sha256Hex(adminHeader), round.admin_token_hash)) {
      return true;
    }
  }
  if (level === "edit") {
    const editHeader = request.headers.get("X-Edit-Token");
    if (round.edit_token_hash && editHeader) {
      if (timingSafeEqual(await sha256Hex(editHeader), round.edit_token_hash)) {
        return true;
      }
    }
  }
  return false;
}

// --- D1 helpers -------------------------------------------------------------

function getRoundRow(env: Env, id: string): Promise<RoundRow | null> {
  return env.DB.prepare("SELECT * FROM rounds WHERE id = ?")
    .bind(id)
    .first<RoundRow>();
}

async function listChildren(
  env: Env,
  table: string,
  roundId: string,
): Promise<AnyRecord[]> {
  const result = await env.DB.prepare(
    `SELECT * FROM ${table} WHERE round_id = ? ORDER BY created_at ASC`,
  )
    .bind(roundId)
    .all<EntityRow>();
  return (result.results ?? []).map(entityRowToDomain);
}

async function insertDataRow(
  env: Env,
  table: string,
  roundId: string,
  domain: AnyRecord,
  extraColumns: AnyRecord = {},
): Promise<string> {
  const id = (domain.id as string) ?? newId();
  const createdAt = (domain.createdAt as string) ?? nowIso();
  const updatedAt = (domain.updatedAt as string) ?? createdAt;
  const stored = { ...domain, id, roundId, createdAt, updatedAt };

  const extraKeys = Object.keys(extraColumns);
  const columns = ["id", "round_id", ...extraKeys, "data", "created_at", "updated_at"];
  const placeholders = columns.map(() => "?").join(", ");
  const values = [
    id,
    roundId,
    ...extraKeys.map((key) => extraColumns[key]),
    JSON.stringify(stored),
    createdAt,
    updatedAt,
  ];

  await env.DB.prepare(
    `INSERT OR REPLACE INTO ${table} (${columns.join(", ")}) VALUES (${placeholders})`,
  )
    .bind(...values)
    .run();
  return id;
}

// --- route handlers ---------------------------------------------------------

async function handleCreateRound(
  request: Request,
  env: Env,
  cors: Record<string, string>,
) {
  const input = (await request.json().catch(() => ({}))) as AnyRecord;
  const id = newId();
  const tokens = generateRoundTokens();
  const round = buildRoundFromInput(id, input);

  await env.DB.prepare(
    `INSERT INTO rounds (id, title, status, share_code, edit_token_hash, admin_token_hash, data, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  )
    .bind(
      id,
      round.title,
      round.status,
      tokens.shareCode,
      await sha256Hex(tokens.editToken),
      await sha256Hex(tokens.adminToken),
      JSON.stringify({ ...round, __extras: {} }),
      round.createdAt,
      round.updatedAt,
    )
    .run();

  const matchCount = Number(round.activeMatchCount ?? 0);
  for (let matchNo = 1; matchNo <= matchCount; matchNo += 1) {
    const matchId = newId();
    const match = {
      id: matchId,
      roundId: id,
      matchNo,
      homeTeam: "",
      awayTeam: "",
      actualResult: null,
      createdAt: round.createdAt,
      updatedAt: round.updatedAt,
    };
    await insertDataRow(env, "matches", id, match, {
      match_no: matchNo,
      home_team: "",
      away_team: "",
      actual_result: null,
    });
  }

  return jsonResponse(
    { round, shareCode: tokens.shareCode, editToken: tokens.editToken, adminToken: tokens.adminToken },
    201,
    cors,
  );
}

async function handlePatchRound(
  request: Request,
  env: Env,
  roundId: string,
  cors: Record<string, string>,
) {
  const row = await getRoundRow(env, roundId);
  if (!row) return errorResponse("Round が見つかりません。", 404, cors);
  if (!(await isAuthorized(request, row, "edit"))) {
    return errorResponse("編集トークンが必要です。", 403, cors);
  }

  const patch = (await request.json().catch(() => ({}))) as AnyRecord;
  const current = roundRowToDomain(row);
  const extras = roundExtras(row);
  const next = { ...current, ...patch, id: roundId, updatedAt: nowIso() };

  await env.DB.prepare(
    "UPDATE rounds SET title = ?, status = ?, data = ?, updated_at = ? WHERE id = ?",
  )
    .bind(
      next.title,
      next.status,
      JSON.stringify({ ...next, __extras: extras }),
      next.updatedAt,
      roundId,
    )
    .run();

  return jsonResponse({ round: next }, 200, cors);
}

async function handleUpsertMatches(
  request: Request,
  env: Env,
  roundId: string,
  cors: Record<string, string>,
) {
  const row = await getRoundRow(env, roundId);
  if (!row) return errorResponse("Round が見つかりません。", 404, cors);
  if (!(await isAuthorized(request, row, "edit"))) {
    return errorResponse("編集トークンが必要です。", 403, cors);
  }

  const body = (await request.json().catch(() => ({}))) as AnyRecord;
  const matches = Array.isArray(body.matches) ? (body.matches as AnyRecord[]) : [];

  for (const incoming of matches) {
    const matchNo = Number(incoming.matchNo);
    if (!Number.isFinite(matchNo)) continue;

    const existing = await env.DB.prepare(
      "SELECT * FROM matches WHERE round_id = ? AND match_no = ?",
    )
      .bind(roundId, matchNo)
      .first<EntityRow>();

    const base = existing ? entityRowToDomain(existing) : { matchNo, roundId };
    const merged = {
      ...base,
      matchNo,
      homeTeam: incoming.homeTeam ?? base.homeTeam ?? "",
      awayTeam: incoming.awayTeam ?? base.awayTeam ?? "",
      kickoffTime: incoming.kickoffTime ?? base.kickoffTime ?? null,
      venue: incoming.venue ?? base.venue ?? null,
      stage: incoming.stage ?? base.stage ?? null,
      adminNote: incoming.adminNote ?? base.adminNote ?? null,
      id: existing?.id ?? newId(),
    };

    await insertDataRow(env, "matches", roundId, merged, {
      match_no: matchNo,
      home_team: merged.homeTeam,
      away_team: merged.awayTeam,
      actual_result: merged.actualResult ?? null,
    });
  }

  const refreshed = await listChildren(env, "matches", roundId);
  return jsonResponse({ matches: refreshed }, 200, cors);
}

async function handleUpsertPick(
  request: Request,
  env: Env,
  roundId: string,
  cors: Record<string, string>,
) {
  const row = await getRoundRow(env, roundId);
  if (!row) return errorResponse("Round が見つかりません。", 404, cors);
  if (!(await isAuthorized(request, row, "edit"))) {
    return errorResponse("編集トークンが必要です。", 403, cors);
  }

  const body = (await request.json().catch(() => ({}))) as AnyRecord;
  const userId = String(body.userId ?? "");
  const matchId = String(body.matchId ?? "");
  const pick = String(body.pick ?? "");
  if (!userId || !matchId || !["ONE", "DRAW", "TWO"].includes(pick)) {
    return errorResponse("userId / matchId / pick が不正です。", 400, cors);
  }

  const id = newId();
  const timestamp = nowIso();
  const domain = {
    id,
    roundId,
    matchId,
    userId,
    pick,
    note: (body.note as string | null) ?? null,
    support: body.support ?? { kind: "manual" },
    createdAt: timestamp,
    updatedAt: timestamp,
  };

  await env.DB.prepare(
    `INSERT INTO picks (id, round_id, user_id, match_id, pick, note, data, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT (round_id, user_id, match_id)
     DO UPDATE SET pick = excluded.pick, note = excluded.note, data = excluded.data, updated_at = excluded.updated_at`,
  )
    .bind(
      id,
      roundId,
      userId,
      matchId,
      pick,
      domain.note,
      JSON.stringify(domain),
      timestamp,
      timestamp,
    )
    .run();

  return jsonResponse({ ok: true }, 200, cors);
}

async function handleUpsertScoutReport(
  request: Request,
  env: Env,
  roundId: string,
  cors: Record<string, string>,
) {
  const row = await getRoundRow(env, roundId);
  if (!row) return errorResponse("Round が見つかりません。", 404, cors);
  if (!(await isAuthorized(request, row, "edit"))) {
    return errorResponse("編集トークンが必要です。", 403, cors);
  }

  const report = (await request.json().catch(() => ({}))) as AnyRecord;
  const userId = String(report.userId ?? "");
  const matchId = String(report.matchId ?? "");
  if (!userId || !matchId) {
    return errorResponse("userId / matchId が必要です。", 400, cors);
  }

  const id = newId();
  const timestamp = nowIso();
  const domain = { ...report, id, roundId, userId, matchId, createdAt: timestamp, updatedAt: timestamp };

  await env.DB.prepare(
    `INSERT INTO scout_reports (id, round_id, user_id, match_id, data, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT (round_id, user_id, match_id)
     DO UPDATE SET data = excluded.data, updated_at = excluded.updated_at`,
  )
    .bind(id, roundId, userId, matchId, JSON.stringify(domain), timestamp, timestamp)
    .run();

  return jsonResponse({ ok: true }, 200, cors);
}

async function handleUpsertCandidateTickets(
  request: Request,
  env: Env,
  roundId: string,
  cors: Record<string, string>,
) {
  const row = await getRoundRow(env, roundId);
  if (!row) return errorResponse("Round が見つかりません。", 404, cors);
  if (!(await isAuthorized(request, row, "edit"))) {
    return errorResponse("編集トークンが必要です。", 403, cors);
  }

  const body = (await request.json().catch(() => ({}))) as AnyRecord;
  const tickets = Array.isArray(body.tickets) ? (body.tickets as AnyRecord[]) : [];
  const labels = tickets.map((ticket) => String(ticket.label));

  // セットを置き換える: 今回含まれない label の行を削除
  const existing = await env.DB.prepare(
    "SELECT id, label FROM candidate_tickets WHERE round_id = ?",
  )
    .bind(roundId)
    .all<{ id: string; label: string }>();
  for (const stale of existing.results ?? []) {
    if (!labels.includes(stale.label)) {
      await env.DB.prepare("DELETE FROM candidate_tickets WHERE id = ?")
        .bind(stale.id)
        .run();
    }
  }

  for (const ticket of tickets) {
    const id = newId();
    const timestamp = nowIso();
    const domain = { ...ticket, id, roundId, createdAt: timestamp, updatedAt: timestamp };
    await env.DB.prepare(
      `INSERT INTO candidate_tickets (id, round_id, label, data, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?)
       ON CONFLICT (round_id, label)
       DO UPDATE SET data = excluded.data, updated_at = excluded.updated_at`,
    )
      .bind(id, roundId, String(ticket.label), JSON.stringify(domain), timestamp, timestamp)
      .run();
  }

  const refreshed = await listChildren(env, "candidate_tickets", roundId);
  return jsonResponse({ candidateTickets: refreshed }, 200, cors);
}

async function handleUpsertCandidateVote(
  request: Request,
  env: Env,
  roundId: string,
  cors: Record<string, string>,
) {
  const row = await getRoundRow(env, roundId);
  if (!row) return errorResponse("Round が見つかりません。", 404, cors);
  if (!(await isAuthorized(request, row, "edit"))) {
    return errorResponse("編集トークンが必要です。", 403, cors);
  }

  const vote = (await request.json().catch(() => ({}))) as AnyRecord;
  const candidateTicketId = String(vote.candidateTicketId ?? "");
  const userId = String(vote.userId ?? "");
  if (!candidateTicketId || !userId) {
    return errorResponse("candidateTicketId / userId が必要です。", 400, cors);
  }

  const id = newId();
  const timestamp = nowIso();
  const domain = { ...vote, id, roundId, candidateTicketId, userId, createdAt: timestamp, updatedAt: timestamp };

  await env.DB.prepare(
    `INSERT INTO candidate_votes (id, round_id, candidate_ticket_id, user_id, vote, comment, data, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT (round_id, candidate_ticket_id, user_id)
     DO UPDATE SET vote = excluded.vote, comment = excluded.comment, data = excluded.data, updated_at = excluded.updated_at`,
  )
    .bind(
      id,
      roundId,
      candidateTicketId,
      userId,
      String(vote.vote ?? "maybe"),
      (vote.comment as string | null) ?? null,
      JSON.stringify(domain),
      timestamp,
      timestamp,
    )
    .run();

  return jsonResponse({ ok: true }, 200, cors);
}

async function handleAddReviewNote(
  request: Request,
  env: Env,
  roundId: string,
  cors: Record<string, string>,
) {
  const row = await getRoundRow(env, roundId);
  if (!row) return errorResponse("Round が見つかりません。", 404, cors);
  if (!(await isAuthorized(request, row, "edit"))) {
    return errorResponse("編集トークンが必要です。", 403, cors);
  }

  const note = (await request.json().catch(() => ({}))) as AnyRecord;
  const id = newId();
  const timestamp = nowIso();
  const domain = {
    id,
    roundId,
    matchId: (note.matchId as string | null) ?? null,
    userId: (note.userId as string | null) ?? null,
    note: String(note.note ?? ""),
    createdAt: timestamp,
    updatedAt: timestamp,
  };

  await env.DB.prepare(
    `INSERT INTO review_notes (id, round_id, match_id, user_id, note, data, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
  )
    .bind(
      id,
      roundId,
      domain.matchId,
      domain.userId,
      domain.note,
      JSON.stringify(domain),
      timestamp,
      timestamp,
    )
    .run();

  return jsonResponse({ ok: true }, 200, cors);
}

async function handleExport(
  env: Env,
  roundId: string,
  cors: Record<string, string>,
) {
  const row = await getRoundRow(env, roundId);
  if (!row) return errorResponse("Round が見つかりません。", 404, cors);

  const round = roundRowToDomain(row);
  const extras = roundExtras(row);
  const official = await env.DB.prepare(
    "SELECT * FROM official_rounds WHERE round_id = ? LIMIT 1",
  )
    .bind(roundId)
    .first<EntityRow>();
  const officialData = official ? parseJson(official.data) : {};
  const evRow = await env.DB.prepare(
    "SELECT * FROM big_carryover_assumptions WHERE round_id = ? LIMIT 1",
  )
    .bind(roundId)
    .first<EntityRow>();

  const bundle = {
    round,
    matches: await listChildren(env, "matches", roundId),
    picks: await listChildren(env, "picks", roundId),
    scoutReports: await listChildren(env, "scout_reports", roundId),
    reviewNotes: await listChildren(env, "review_notes", roundId),
    researchMemos: await listChildren(env, "research_memos", roundId),
    candidateTickets: await listChildren(env, "candidate_tickets", roundId),
    candidateVotes: await listChildren(env, "candidate_votes", roundId),
    generatedTickets: (extras.generatedTickets as unknown[]) ?? [],
    roundEvAssumption: evRow ? parseJson(evRow.data) : null,
    totoOfficialRound: (officialData.round as unknown) ?? null,
    totoOfficialMatches: (officialData.matches as unknown[]) ?? [],
    users: (extras.users as unknown[]) ?? [],
    metadata: {
      appVersion: "cloudflare_d1",
      dataMode: "shared",
      exportedAt: nowIso(),
    },
  };

  return jsonResponse({ bundle }, 200, cors);
}

async function handleImport(
  request: Request,
  env: Env,
  cors: Record<string, string>,
) {
  const body = (await request.json().catch(() => ({}))) as AnyRecord;
  const bundle = (body.bundle as AnyRecord) ?? {};
  const strategy = body.strategy === "overwrite" ? "overwrite" : "copy";
  const copy = strategy === "copy";
  const sourceRound = (bundle.round as AnyRecord) ?? {};

  const roundId = copy ? newId() : String(sourceRound.id ?? newId());
  const tokens = generateRoundTokens();
  const timestamp = nowIso();

  if (!copy) {
    // overwrite: 既存の子レコードを掃除（round 自体は INSERT OR REPLACE で上書き）
    for (const table of [
      "matches",
      "picks",
      "scout_reports",
      "candidate_tickets",
      "candidate_votes",
      "review_notes",
      "research_memos",
      "official_rounds",
      "big_carryover_assumptions",
    ]) {
      await env.DB.prepare(`DELETE FROM ${table} WHERE round_id = ?`)
        .bind(roundId)
        .run();
    }
  }

  const round = {
    ...sourceRound,
    id: roundId,
    createdAt: (sourceRound.createdAt as string) ?? timestamp,
    updatedAt: timestamp,
  };
  const extras = {
    users: (bundle.users as unknown[]) ?? [],
    generatedTickets: (bundle.generatedTickets as unknown[]) ?? [],
  };

  await env.DB.prepare(
    `INSERT OR REPLACE INTO rounds (id, title, status, share_code, edit_token_hash, admin_token_hash, data, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  )
    .bind(
      roundId,
      String(round.title ?? "Round"),
      String(round.status ?? "draft"),
      tokens.shareCode,
      await sha256Hex(tokens.editToken),
      await sha256Hex(tokens.adminToken),
      JSON.stringify({ ...round, __extras: extras }),
      round.createdAt,
      round.updatedAt,
    )
    .run();

  // matches（id 再採番）
  const matchIdMap = new Map<string, string>();
  for (const match of (bundle.matches as AnyRecord[]) ?? []) {
    const oldId = String(match.id ?? "");
    const matchId = copy ? newId() : oldId || newId();
    if (oldId) matchIdMap.set(oldId, matchId);
    await insertDataRow(
      env,
      "matches",
      roundId,
      { ...match, id: matchId, roundId },
      {
        match_no: Number(match.matchNo ?? 0),
        home_team: (match.homeTeam as string) ?? "",
        away_team: (match.awayTeam as string) ?? "",
        actual_result: (match.actualResult as string | null) ?? null,
      },
    );
  }

  const remapMatchId = (id: unknown) => {
    const key = String(id ?? "");
    return matchIdMap.get(key) ?? key;
  };

  for (const pick of (bundle.picks as AnyRecord[]) ?? []) {
    const id = copy ? newId() : String(pick.id ?? newId());
    const matchId = remapMatchId(pick.matchId);
    await env.DB.prepare(
      `INSERT OR REPLACE INTO picks (id, round_id, user_id, match_id, pick, note, data, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
      .bind(
        id,
        roundId,
        String(pick.userId ?? ""),
        matchId,
        String(pick.pick ?? "ONE"),
        (pick.note as string | null) ?? null,
        JSON.stringify({ ...pick, id, roundId, matchId }),
        (pick.createdAt as string) ?? timestamp,
        timestamp,
      )
      .run();
  }

  for (const report of (bundle.scoutReports as AnyRecord[]) ?? []) {
    const id = copy ? newId() : String(report.id ?? newId());
    const matchId = remapMatchId(report.matchId);
    await insertDataRow(
      env,
      "scout_reports",
      roundId,
      { ...report, id, roundId, matchId },
      { user_id: String(report.userId ?? ""), match_id: matchId },
    );
  }

  const ticketIdMap = new Map<string, string>();
  for (const ticket of (bundle.candidateTickets as AnyRecord[]) ?? []) {
    const oldId = String(ticket.id ?? "");
    const id = copy ? newId() : oldId || newId();
    if (oldId) ticketIdMap.set(oldId, id);
    await insertDataRow(
      env,
      "candidate_tickets",
      roundId,
      { ...ticket, id, roundId },
      { label: String(ticket.label ?? "") },
    );
  }

  for (const vote of (bundle.candidateVotes as AnyRecord[]) ?? []) {
    const id = copy ? newId() : String(vote.id ?? newId());
    const ticketId =
      ticketIdMap.get(String(vote.candidateTicketId ?? "")) ??
      String(vote.candidateTicketId ?? "");
    await insertDataRow(
      env,
      "candidate_votes",
      roundId,
      { ...vote, id, roundId, candidateTicketId: ticketId },
      {
        candidate_ticket_id: ticketId,
        user_id: String(vote.userId ?? ""),
        vote: String(vote.vote ?? "maybe"),
        comment: (vote.comment as string | null) ?? null,
      },
    );
  }

  for (const note of (bundle.reviewNotes as AnyRecord[]) ?? []) {
    const id = copy ? newId() : String(note.id ?? newId());
    await insertDataRow(
      env,
      "review_notes",
      roundId,
      { ...note, id, roundId, matchId: remapMatchId(note.matchId) },
      {
        match_id: note.matchId ? remapMatchId(note.matchId) : null,
        user_id: (note.userId as string | null) ?? null,
        note: String(note.note ?? ""),
      },
    );
  }

  for (const memo of (bundle.researchMemos as AnyRecord[]) ?? []) {
    const id = copy ? newId() : String(memo.id ?? newId());
    await insertDataRow(
      env,
      "research_memos",
      roundId,
      { ...memo, id, roundId, matchId: remapMatchId(memo.matchId) },
      { match_id: memo.matchId ? remapMatchId(memo.matchId) : null },
    );
  }

  if (bundle.totoOfficialRound || (bundle.totoOfficialMatches as unknown[])?.length) {
    await insertDataRow(env, "official_rounds", roundId, {
      id: newId(),
      roundId,
      round: bundle.totoOfficialRound ?? null,
      matches: (bundle.totoOfficialMatches as unknown[]) ?? [],
    });
  }

  if (bundle.roundEvAssumption) {
    await insertDataRow(env, "big_carryover_assumptions", roundId, {
      ...(bundle.roundEvAssumption as AnyRecord),
      id: newId(),
      roundId,
    });
  }

  return jsonResponse(
    { roundId, shareCode: tokens.shareCode, editToken: tokens.editToken, adminToken: tokens.adminToken },
    201,
    cors,
  );
}

// --- router -----------------------------------------------------------------

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const allowed = parseAllowedOrigins(env.ALLOWED_ORIGINS);
    const cors = corsHeaders(request.headers.get("Origin"), allowed);

    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: cors });
    }

    const url = new URL(request.url);
    const segments = url.pathname.split("/").filter(Boolean); // ["api", "rounds", ":id", ...]
    const method = request.method;

    try {
      if (segments[0] !== "api") {
        return errorResponse("Not found", 404, cors);
      }

      // /api/health
      if (segments.length === 2 && segments[1] === "health") {
        return jsonResponse({ status: "ok", time: nowIso() }, 200, cors);
      }

      // /api/import
      if (segments.length === 2 && segments[1] === "import" && method === "POST") {
        return await handleImport(request, env, cors);
      }

      // /api/rounds ...
      if (segments[1] === "rounds") {
        // /api/rounds
        if (segments.length === 2) {
          if (method === "GET") {
            const result = await env.DB.prepare(
              "SELECT * FROM rounds ORDER BY created_at DESC",
            ).all<RoundRow>();
            const rounds = (result.results ?? []).map(roundRowToDomain);
            return jsonResponse({ rounds }, 200, cors);
          }
          if (method === "POST") {
            return await handleCreateRound(request, env, cors);
          }
        }

        // /api/rounds/:id ...
        const roundId = segments[2];
        if (roundId && segments.length === 3) {
          if (method === "GET") {
            const row = await getRoundRow(env, roundId);
            if (!row) return errorResponse("Round が見つかりません。", 404, cors);
            return jsonResponse({ round: roundRowToDomain(row) }, 200, cors);
          }
          if (method === "PATCH") {
            return await handlePatchRound(request, env, roundId, cors);
          }
          // 削除 API は提供しない（本番データ保護）
          if (method === "DELETE") {
            return errorResponse("削除 API は未提供です。", 405, cors);
          }
        }

        // /api/rounds/:id/<child>
        const child = segments[3];
        if (roundId && child && segments.length === 4) {
          if (method === "GET") {
            switch (child) {
              case "matches":
                return jsonResponse({ matches: await listChildren(env, "matches", roundId) }, 200, cors);
              case "picks":
                return jsonResponse({ picks: await listChildren(env, "picks", roundId) }, 200, cors);
              case "scout-reports":
                return jsonResponse({ scoutReports: await listChildren(env, "scout_reports", roundId) }, 200, cors);
              case "candidate-tickets":
                return jsonResponse({ candidateTickets: await listChildren(env, "candidate_tickets", roundId) }, 200, cors);
              case "candidate-votes":
                return jsonResponse({ candidateVotes: await listChildren(env, "candidate_votes", roundId) }, 200, cors);
              case "review-notes":
                return jsonResponse({ reviewNotes: await listChildren(env, "review_notes", roundId) }, 200, cors);
              case "export":
                return await handleExport(env, roundId, cors);
              default:
                return errorResponse("Not found", 404, cors);
            }
          }
          if (method === "POST") {
            switch (child) {
              case "matches":
                return await handleUpsertMatches(request, env, roundId, cors);
              case "picks":
                return await handleUpsertPick(request, env, roundId, cors);
              case "scout-reports":
                return await handleUpsertScoutReport(request, env, roundId, cors);
              case "candidate-tickets":
                return await handleUpsertCandidateTickets(request, env, roundId, cors);
              case "candidate-votes":
                return await handleUpsertCandidateVote(request, env, roundId, cors);
              case "review-notes":
                return await handleAddReviewNote(request, env, roundId, cors);
              default:
                return errorResponse("Not found", 404, cors);
            }
          }
        }
      }

      return errorResponse("Not found", 404, cors);
    } catch (error) {
      return errorResponse(
        error instanceof Error ? error.message : "Worker error",
        500,
        cors,
      );
    }
  },
};
