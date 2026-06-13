import { describe, expect, it } from "vitest";

import { handleApiRequest, type D1Like, type Env } from "./handler";
import { sha256Hex } from "./tokens";

type DbHandlers = {
  first?: (sql: string) => unknown;
  all?: (sql: string) => { results?: unknown[] };
};

// SQL を実行しない軽量フェイク D1。使う API（prepare/bind/first/all/run）だけ満たす。
function makeDb(handlers: DbHandlers = {}): D1Like {
  const prepared = (sql: string) => ({
    bind: () => prepared(sql),
    first: async () => (handlers.first ? handlers.first(sql) : null),
    all: async () => (handlers.all ? handlers.all(sql) : { results: [] }),
    run: async () => ({ success: true }),
  });
  return { prepare: (sql: string) => prepared(sql) } as unknown as D1Like;
}

// bind 値を捕捉するフェイク D1（書き込み内容を検証するテスト用）。
type CapturedRun = { sql: string; args: unknown[] };
function makeCapturingDb(handlers: DbHandlers = {}) {
  const runs: CapturedRun[] = [];
  const prepared = (sql: string, boundArgs: unknown[] = []) => ({
    bind: (...args: unknown[]) => prepared(sql, args),
    first: async () => (handlers.first ? handlers.first(sql) : null),
    all: async () => (handlers.all ? handlers.all(sql) : { results: [] }),
    run: async () => {
      runs.push({ sql, args: boundArgs });
      return { success: true };
    },
  });
  const db = { prepare: (sql: string) => prepared(sql) } as unknown as D1Like;
  return { db, runs };
}

const ALLOWED = "https://quietbriony.github.io";

function makeEnv(handlers?: DbHandlers): Env {
  return { DB: makeDb(handlers), ALLOWED_ORIGINS: ALLOWED };
}

function request(
  method: string,
  path: string,
  options: { origin?: string; headers?: Record<string, string>; body?: unknown } = {},
) {
  const headers: Record<string, string> = { ...(options.headers ?? {}) };
  if (options.origin) {
    headers.Origin = options.origin;
  }
  if (options.body !== undefined) {
    headers["Content-Type"] = "application/json";
  }
  return new Request(`https://api.test${path}`, {
    method,
    headers,
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
  });
}

describe("handleApiRequest", () => {
  it("answers /api/health without touching D1", async () => {
    const res = await handleApiRequest(request("GET", "/api/health"), makeEnv());
    expect(res.status).toBe(200);
    const body = (await res.json()) as { status: string };
    expect(body.status).toBe("ok");
  });

  it("handles CORS preflight and reflects an allowed origin", async () => {
    const res = await handleApiRequest(
      request("OPTIONS", "/api/rounds", { origin: ALLOWED }),
      makeEnv(),
    );
    expect(res.status).toBe(204);
    expect(res.headers.get("Access-Control-Allow-Origin")).toBe(ALLOWED);
  });

  it("does not reflect a disallowed origin", async () => {
    const res = await handleApiRequest(
      request("OPTIONS", "/api/rounds", { origin: "https://evil.example" }),
      makeEnv(),
    );
    expect(res.headers.get("Access-Control-Allow-Origin")).toBeNull();
  });

  it("creates a round and returns share/edit/admin tokens", async () => {
    const res = await handleApiRequest(
      request("POST", "/api/rounds", {
        origin: ALLOWED,
        body: { title: "Test", status: "draft", budgetYen: null, notes: null, matchCount: 2 },
      }),
      makeEnv(),
    );
    expect(res.status).toBe(201);
    const body = (await res.json()) as {
      round: { id: string; title: string };
      shareCode: string;
      editToken: string;
      adminToken: string;
    };
    expect(body.round.id).toBeTruthy();
    expect(body.round.title).toBe("Test");
    expect(body.editToken).toBeTruthy();
    expect(body.adminToken).toBeTruthy();
    expect(body.shareCode).toBeTruthy();
  });

  it("rejects writes without an edit/admin token (403)", async () => {
    const env = makeEnv({
      first: (sql) =>
        sql.includes("FROM rounds WHERE id")
          ? { id: "r1", edit_token_hash: "deadbeef", admin_token_hash: "cafe", data: "{}" }
          : null,
    });
    const res = await handleApiRequest(
      request("PATCH", "/api/rounds/r1", { origin: ALLOWED, body: { title: "Y" } }),
      env,
    );
    expect(res.status).toBe(403);
  });

  it("deletes a user via DELETE /api/users/:id", async () => {
    const res = await handleApiRequest(
      request("DELETE", "/api/users/u1", { origin: ALLOWED }),
      makeEnv(),
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as { ok: boolean };
    expect(body.ok).toBe(true);
  });

  it("does not expose a round delete endpoint", async () => {
    const env = makeEnv({
      first: (sql) =>
        sql.includes("FROM rounds WHERE id") ? { id: "r1", data: "{}" } : null,
    });
    const res = await handleApiRequest(request("DELETE", "/api/rounds/r1"), env);
    expect(res.status).toBe(405);
  });

  it("lists rounds from D1 rows", async () => {
    const env = makeEnv({
      all: (sql) =>
        sql.includes("FROM rounds")
          ? {
              results: [
                {
                  id: "r1",
                  title: "Round 1",
                  status: "draft",
                  data: "{}",
                  created_at: "2026-01-01T00:00:00.000Z",
                  updated_at: "2026-01-01T00:00:00.000Z",
                },
              ],
            }
          : { results: [] },
    });
    const res = await handleApiRequest(request("GET", "/api/rounds"), env);
    expect(res.status).toBe(200);
    const body = (await res.json()) as { rounds: Array<{ id: string; title: string }> };
    expect(body.rounds).toHaveLength(1);
    expect(body.rounds[0].id).toBe("r1");
    expect(body.rounds[0].title).toBe("Round 1");
  });

  // /api/state: round 行を r1/r2 の2件持つフェイク。?round= 付きはフィルタ済み SQL
  // （rounds は WHERE id、entity は WHERE round_id）にだけ r1 分を返す。
  function makeStateEnv() {
    const roundRow = (id: string) => ({
      id,
      title: `Round ${id}`,
      status: "draft",
      data: "{}",
      created_at: "2026-01-01T00:00:00.000Z",
      updated_at: "2026-01-01T00:00:00.000Z",
    });
    const entityRow = (id: string, roundId: string) => ({
      id,
      round_id: roundId,
      data: "{}",
      created_at: "2026-01-01T00:00:00.000Z",
      updated_at: "2026-01-01T00:00:00.000Z",
    });
    return makeEnv({
      all: (sql) => {
        if (sql.includes("FROM rounds")) {
          return sql.includes("WHERE id = ?")
            ? { results: [roundRow("r1")] }
            : { results: [roundRow("r1"), roundRow("r2")] };
        }
        if (sql.includes("FROM users")) {
          return { results: [] };
        }
        return sql.includes("WHERE round_id = ?")
          ? { results: [entityRow("m1", "r1")] }
          : { results: [entityRow("m1", "r1"), entityRow("m2", "r2")] };
      },
    });
  }

  type StateBody = {
    state: {
      rounds: Array<{ id: string }>;
      matches: Array<{ id: string; roundId: string }>;
      picks: Array<{ id: string }>;
    };
  };

  it("returns the full state without a round filter", async () => {
    const res = await handleApiRequest(request("GET", "/api/state"), makeStateEnv());
    expect(res.status).toBe(200);
    const body = (await res.json()) as StateBody;
    expect(body.state.rounds.map((round) => round.id)).toEqual(["r1", "r2"]);
    expect(body.state.matches).toHaveLength(2);
    expect(body.state.picks).toHaveLength(2);
  });

  it("scopes /api/state?round= to that round via round_id-filtered queries", async () => {
    const res = await handleApiRequest(
      request("GET", "/api/state?round=r1"),
      makeStateEnv(),
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as StateBody;
    expect(body.state.rounds.map((round) => round.id)).toEqual(["r1"]);
    expect(body.state.matches).toHaveLength(1);
    expect(body.state.matches[0].roundId).toBe("r1");
    expect(body.state.picks).toHaveLength(1);
  });

  it("advances match updated_at on partial upsert (candidate staleness)", async () => {
    const OLD = "2020-01-01T00:00:00.000Z";
    const token = "edit-secret";
    const editHash = await sha256Hex(token);
    const { db, runs } = makeCapturingDb({
      first: (sql) => {
        if (sql.includes("FROM rounds WHERE id")) {
          return {
            id: "r1",
            title: "R",
            status: "analyzing",
            edit_token_hash: editHash,
            admin_token_hash: null,
            data: "{}",
            created_at: OLD,
            updated_at: OLD,
          };
        }
        if (sql.includes("FROM matches WHERE round_id")) {
          // 既存の試合行（古い updatedAt とフルのチーム名を保持）。
          return {
            id: "m1",
            round_id: "r1",
            data: JSON.stringify({
              matchNo: 1,
              homeTeam: "A",
              awayTeam: "B",
              modelProb1: null,
              updatedAt: OLD,
            }),
            created_at: OLD,
            updated_at: OLD,
          };
        }
        return null;
      },
    });
    const env: Env = { DB: db, ALLOWED_ORIGINS: ALLOWED };

    // estimateRoundAiModel/saveResults と同じく updatedAt を含まない部分行。
    const res = await handleApiRequest(
      request("POST", "/api/rounds/r1/matches", {
        origin: ALLOWED,
        headers: { "X-Edit-Token": token },
        body: { matches: [{ matchNo: 1, modelProb1: 0.55 }] },
      }),
      env,
    );
    expect(res.status).toBe(200);

    const insert = runs.find((run) =>
      run.sql.includes("INSERT OR REPLACE INTO matches"),
    );
    expect(insert).toBeTruthy();
    const args = insert!.args;
    const updatedAtColumn = args[args.length - 1] as string;
    const storedJson = args[args.length - 3] as string;
    const stored = JSON.parse(storedJson) as Record<string, unknown>;

    // updated_at カラムと JSON 内 updatedAt が前進している（OLD のままでない）。
    expect(updatedAtColumn).not.toBe(OLD);
    expect(stored.updatedAt).toBe(updatedAtColumn);
    // createdAt と既存フィールド（チーム名）は保持される。
    expect(stored.createdAt).toBe(OLD);
    expect(stored.homeTeam).toBe("A");
    expect(stored.awayTeam).toBe("B");
    expect(stored.modelProb1).toBe(0.55);
  });
});
