/**
 * Cloudflare D1 保存先の StorageAdapter 実装。
 *
 * ブラウザから D1 へ直接接続はしない。Cloudflare Worker / Pages Functions が公開する
 * REST API（`NEXT_PUBLIC_D1_API_BASE`）へ fetch する。書き込みには Round 作成時に
 * 払い出された editToken / adminToken を添付する（読み取りは shareCode で許可）。
 *
 * トークンはブラウザ localStorage に保管する（`world-toto-lab:v1:d1Tokens`）。
 */
import type {
  CandidateTicket,
  CandidateVote,
  HumanScoutReport,
  Match,
  Pick,
  ReviewNote,
  Round,
} from "@/lib/types";
import type {
  RoundBundle,
  StorageAdapter,
  StorageHealth,
} from "@/lib/storage/types";

export type D1RoundTokens = {
  shareCode: string;
  editToken: string;
  adminToken?: string;
};

const TOKEN_STORE_KEY = "world-toto-lab:v1:d1Tokens";

function canUseStorage() {
  return (
    typeof window !== "undefined" &&
    typeof window.localStorage !== "undefined"
  );
}

function readTokenStore(): Record<string, D1RoundTokens> {
  if (!canUseStorage()) {
    return {};
  }

  try {
    const raw = window.localStorage.getItem(TOKEN_STORE_KEY);
    if (!raw) {
      return {};
    }
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function writeTokenStore(store: Record<string, D1RoundTokens>) {
  if (!canUseStorage()) {
    return;
  }
  window.localStorage.setItem(TOKEN_STORE_KEY, JSON.stringify(store));
}

export function getStoredRoundTokens(roundId: string): D1RoundTokens | null {
  return readTokenStore()[roundId] ?? null;
}

export function storeRoundTokens(roundId: string, tokens: D1RoundTokens) {
  const store = readTokenStore();
  store[roundId] = tokens;
  writeTokenStore(store);
}

function resolveBaseUrl(explicit?: string | null) {
  const base = explicit ?? process.env.NEXT_PUBLIC_D1_API_BASE ?? "";
  return base.replace(/\/+$/, "");
}

function enc(value: string) {
  return encodeURIComponent(value);
}

export type D1ApiAdapterOptions = {
  baseUrl?: string | null;
  fetchImpl?: typeof fetch;
};

type RequestOptions = {
  body?: unknown;
  roundId?: string;
  write?: boolean;
};

export function createD1ApiAdapter(
  options: D1ApiAdapterOptions = {},
): StorageAdapter {
  const baseUrl = resolveBaseUrl(options.baseUrl);
  const doFetch =
    options.fetchImpl ??
    (typeof fetch !== "undefined" ? fetch.bind(globalThis) : undefined);

  async function request<T>(
    method: string,
    path: string,
    { body, roundId, write }: RequestOptions = {},
  ): Promise<T> {
    if (!baseUrl) {
      throw new Error("NEXT_PUBLIC_D1_API_BASE が設定されていません。");
    }
    if (!doFetch) {
      throw new Error("この環境では fetch が利用できません。");
    }

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    const tokens = roundId ? getStoredRoundTokens(roundId) : null;
    if (tokens?.shareCode) {
      headers["X-Share-Code"] = tokens.shareCode;
    }
    if (write && tokens?.editToken) {
      headers["X-Edit-Token"] = tokens.editToken;
    }
    if (write && tokens?.adminToken) {
      headers["X-Admin-Token"] = tokens.adminToken;
    }

    const response = await doFetch(`${baseUrl}${path}`, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });

    if (!response.ok) {
      let message = `${method} ${path} に失敗しました (HTTP ${response.status})`;
      try {
        const data = (await response.json()) as { error?: unknown };
        if (data?.error) {
          message = String(data.error);
        }
      } catch {
        // ignore body parse errors
      }
      throw new Error(message);
    }

    if (response.status === 204) {
      return undefined as T;
    }

    return (await response.json()) as T;
  }

  return {
    mode: "cloudflare_d1",

    async health(): Promise<StorageHealth> {
      const checkedAt = new Date().toISOString();
      if (!baseUrl) {
        return {
          status: "missing_config",
          message: "NEXT_PUBLIC_D1_API_BASE が設定されていません。",
          checkedAt,
        };
      }

      try {
        const data = await request<{ status?: string; message?: string }>(
          "GET",
          "/api/health",
        );
        return {
          status: data?.status === "ok" ? "ok" : "error",
          message: data?.message ?? "Cloudflare D1 API に接続できます。",
          checkedAt,
        };
      } catch (error) {
        return {
          status: "unreachable",
          message:
            error instanceof Error
              ? error.message
              : "Cloudflare D1 API に接続できません。",
          checkedAt,
        };
      }
    },

    async getRounds() {
      const data = await request<{ rounds: Round[] }>("GET", "/api/rounds");
      return data.rounds ?? [];
    },

    async getRound(roundId) {
      try {
        const data = await request<{ round: Round | null }>(
          "GET",
          `/api/rounds/${enc(roundId)}`,
          { roundId },
        );
        return data.round ?? null;
      } catch {
        return null;
      }
    },

    async createRound(input) {
      const data = await request<{
        round: Round;
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
    },

    async updateRound(roundId, patch) {
      await request("PATCH", `/api/rounds/${enc(roundId)}`, {
        body: patch,
        roundId,
        write: true,
      });
    },

    async deleteRound() {
      throw new Error(
        "Cloudflare D1 モードでは Round 削除 API は未実装です（本番データ保護のため adminToken 必須設計）。",
      );
    },

    async getMatches(roundId) {
      const data = await request<{ matches: Match[] }>(
        "GET",
        `/api/rounds/${enc(roundId)}/matches`,
        { roundId },
      );
      return data.matches ?? [];
    },

    async upsertMatches(roundId, matches) {
      await request("POST", `/api/rounds/${enc(roundId)}/matches`, {
        body: { matches },
        roundId,
        write: true,
      });
    },

    async getPicks(roundId) {
      const data = await request<{ picks: Pick[] }>(
        "GET",
        `/api/rounds/${enc(roundId)}/picks`,
        { roundId },
      );
      return data.picks ?? [];
    },

    async upsertPick(roundId, userId, matchId, pick) {
      await request("POST", `/api/rounds/${enc(roundId)}/picks`, {
        body: { userId, matchId, pick },
        roundId,
        write: true,
      });
    },

    async getScoutReports(roundId) {
      const data = await request<{ scoutReports: HumanScoutReport[] }>(
        "GET",
        `/api/rounds/${enc(roundId)}/scout-reports`,
        { roundId },
      );
      return data.scoutReports ?? [];
    },

    async upsertScoutReport(report) {
      await request("POST", `/api/rounds/${enc(report.roundId)}/scout-reports`, {
        body: report,
        roundId: report.roundId,
        write: true,
      });
    },

    async getCandidateTickets(roundId) {
      const data = await request<{ candidateTickets: CandidateTicket[] }>(
        "GET",
        `/api/rounds/${enc(roundId)}/candidate-tickets`,
        { roundId },
      );
      return data.candidateTickets ?? [];
    },

    async upsertCandidateTickets(roundId, tickets) {
      await request("POST", `/api/rounds/${enc(roundId)}/candidate-tickets`, {
        body: { tickets },
        roundId,
        write: true,
      });
    },

    async getCandidateVotes(roundId) {
      const data = await request<{ candidateVotes: CandidateVote[] }>(
        "GET",
        `/api/rounds/${enc(roundId)}/candidate-votes`,
        { roundId },
      );
      return data.candidateVotes ?? [];
    },

    async upsertCandidateVote(vote) {
      await request("POST", `/api/rounds/${enc(vote.roundId)}/candidate-votes`, {
        body: vote,
        roundId: vote.roundId,
        write: true,
      });
    },

    async getReviewNotes(roundId) {
      const data = await request<{ reviewNotes: ReviewNote[] }>(
        "GET",
        `/api/rounds/${enc(roundId)}/review-notes`,
        { roundId },
      );
      return data.reviewNotes ?? [];
    },

    async upsertReviewNote(note) {
      await request("POST", `/api/rounds/${enc(note.roundId)}/review-notes`, {
        body: note,
        roundId: note.roundId,
        write: true,
      });
    },

    async exportRoundBundle(roundId) {
      const data = await request<{ bundle: RoundBundle }>(
        "GET",
        `/api/rounds/${enc(roundId)}/export`,
        { roundId },
      );
      return data.bundle;
    },

    async importRoundBundle(bundle, strategy = "copy") {
      const data = await request<{
        roundId: string;
        shareCode?: string;
        editToken?: string;
        adminToken?: string;
      }>("POST", "/api/import", { body: { bundle, strategy }, write: true });

      if (data.roundId && data.editToken) {
        storeRoundTokens(data.roundId, {
          shareCode: data.shareCode ?? "",
          editToken: data.editToken,
          adminToken: data.adminToken,
        });
      }
      return data.roundId;
    },
  };
}

export const d1ApiAdapter = createD1ApiAdapter();
