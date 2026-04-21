import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import {
  looksLikeTotoOfficialHtml,
  parseTotoOfficialHtmlSource,
} from "./toto-official-sync.ts";

const corsHeaders = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "POST, OPTIONS",
  "access-control-allow-headers": "authorization, x-client-info, apikey, content-type",
};

type SyncRoundResult = {
  title: string;
  notes: string | null;
  officialRoundName: string | null;
  officialRoundNumber: number | null;
  productType: "toto13" | "mini_toto" | "winner" | "custom";
  requiredMatchCount: number | null;
  outcomeSetJson: string[] | null;
  sourceNote: string | null;
  voidHandling: "manual" | "all_outcomes_valid" | "exclude_from_combo" | "keep_as_pending";
  resultStatus: "draft" | "selling" | "closed" | "resulted" | "cancelled" | "unknown";
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
  matches: SyncMatchResult[];
};

type SyncMatchResult = {
  officialMatchNo: number;
  homeTeam: string;
  awayTeam: string;
  kickoffTime: string | null;
  venue: string | null;
  stage: string | null;
  officialVote0: number | null;
  officialVote1: number | null;
  officialVote2: number | null;
  sourceText: string | null;
  matchStatus: "scheduled" | "played" | "cancelled" | "postponed" | "void" | "unknown";
};

type SyncPayload = {
  fetchedAt: string | null;
  rounds: SyncRoundResult[];
  sourceText: string | null;
  sourceUrl: string;
  warnings: string[];
};

type SyncRequestBody = {
  sourceUrl?: string;
  includeMatches?: boolean;
};

const defaultSourceUrl = "https://toto.yahoo.co.jp/schedule/toto";

function trimText(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function parseRate(raw: unknown, fieldName: string, warnings: string[]) {
  const normalized = trimText(raw);
  if (!normalized) {
    return null;
  }

  const numberText = normalized.endsWith("%") ? normalized.slice(0, -1) : normalized;
  const parsed = Number(numberText);
  if (!Number.isFinite(parsed)) {
    warnings.push(`${fieldName} を数値に変換できませんでした: ${normalized}`);
    return null;
  }

  if (parsed > 1 && parsed <= 100) {
    warnings.push(`${fieldName} は ${normalized} とみなし、0〜1 に換算しました。`);
    return parsed / 100;
  }

  if (parsed < 0 || parsed > 1) {
    warnings.push(`${fieldName} は想定範囲外です: ${normalized}`);
    return null;
  }

  return parsed;
}

function parseMatch(raw: Record<string, unknown>, warnings: string[]): SyncMatchResult | null {
  const noRaw = trimText(raw.officialMatchNo ?? raw.no ?? raw.matchNo ?? raw.match_no);
  const officialMatchNo = Number(noRaw);
  if (!Number.isFinite(officialMatchNo)) {
    return null;
  }

  return {
    awayTeam: trimText(raw.awayTeam ?? raw.away_team) || "未設定",
    homeTeam: trimText(raw.homeTeam ?? raw.home_team) || "未設定",
    kickoffTime: trimText(raw.kickoffTime ?? raw.kickoff_time) || null,
    venue: trimText(raw.venue) || null,
    stage: trimText(raw.stage) || null,
    officialVote0: parseRate(
      raw.officialVote0 ?? raw.official_vote_0 ?? raw.vote0 ?? raw.draw ?? raw.drawRate,
      "公式投票率 0",
      warnings,
    ),
    officialVote1: parseRate(
      raw.officialVote1 ?? raw.official_vote_1 ?? raw.vote1 ?? raw.home ?? raw.homeRate,
      "公式投票率 1",
      warnings,
    ),
    officialVote2: parseRate(
      raw.officialVote2 ?? raw.official_vote_2 ?? raw.vote2 ?? raw.away ?? raw.awayRate,
      "公式投票率 2",
      warnings,
    ),
    sourceText: trimText(raw.sourceText ?? raw.raw) || null,
    matchStatus: raw.matchStatus === "played" || raw.matchStatus === "cancelled" ||
      raw.matchStatus === "postponed" || raw.matchStatus === "void" || raw.matchStatus === "unknown"
      ? raw.matchStatus
      : "scheduled",
    officialMatchNo,
  };
}

function normalizeLine(line: string) {
  return line.replace(/\s+/g, " ").trim();
}

function splitLine(value: string) {
  if (value.includes("\t")) {
    return value.split("\t").map((cell) => cell.trim());
  }
  return value.split(",").map((cell) => cell.trim());
}

function parseVetoTextLine(value: string) {
  const pair = value.match(/(.+?)\s+(?:v|vs|対)\s+(.+?)\s*[-–—]\s*(.+?)\s*[-–—]\s*(.+)$/);
  if (!pair) {
    return null;
  }

  return {
    homeTeam: pair[1],
    awayTeam: pair[2],
    venue: pair[3],
    groupName: "Group TBD",
  };
}

function parseCsvOrTsvPayload(raw: string, warnings: string[], sourceUrl: string): SyncRoundResult[] {
  const lines = raw.split(/\r?\n/).map(normalizeLine).filter(Boolean);
  if (lines.length === 0) {
    return [];
  }

  const header = splitLine(lines[0] || "").map((value) => value.toLowerCase());
  const hasOfficialMatchNo = header.includes("official_match_no");
  const hasHomeTeam = header.includes("home_team") || header.includes("home");
  const hasAwayTeam = header.includes("away_team") || header.includes("away");
  const isMatchLike = hasOfficialMatchNo && hasHomeTeam && hasAwayTeam;
  if (!isMatchLike) {
    return [];
  }

  const groupColumnIdx = {
    no: header.indexOf("official_match_no"),
    home: header.indexOf("home_team"),
    away: header.indexOf("away_team"),
    kick: header.findIndex((value) => value === "kickoff_time" || value === "kickoff" || value === "time"),
    stage: header.findIndex((value) => value === "stage"),
    venue: header.findIndex((value) => value === "venue"),
    vote1: header.indexOf("official_vote_1"),
    vote0: header.indexOf("official_vote_0"),
    vote2: header.indexOf("official_vote_2"),
    roundNo: header.findIndex((value) =>
      value === "official_round_number" || value === "round_no" || value === "round"
    ),
    roundName: header.findIndex((value) =>
      value === "official_round_name" || value === "round_name" || value === "title"
    ),
    product: header.findIndex((value) => value === "product_type"),
  };

  const rowsByRound = new Map<string, Omit<SyncRoundResult, "matches"> & { matches: SyncMatchResult[] }>();

  lines.slice(1).forEach((line) => {
    const cells = splitLine(line);
    if (cells.length < Math.max(groupColumnIdx.no + 1, groupColumnIdx.home + 1, groupColumnIdx.away + 1)) {
      return;
    }

    const getAt = (index: number, fallback: string = "") => cells[index] ?? fallback;
    const no = Number.parseInt(getAt(groupColumnIdx.no), 10);
    if (!Number.isFinite(no)) {
      return;
    }

    const roundNumber = Number.parseInt(getAt(groupColumnIdx.roundNo), 10);
    const roundKeyRaw = getAt(groupColumnIdx.roundNo) || getAt(groupColumnIdx.roundName) || "unknown_round";
    const roundKey = roundNumber ? `round_${roundNumber}` : `round_${roundKeyRaw}`;
    const roundRecord = rowsByRound.get(roundKey) ?? {
      title: getAt(groupColumnIdx.roundName) || "公式回",
      notes: null,
      officialRoundName: getAt(groupColumnIdx.roundName) || null,
      officialRoundNumber: Number.isFinite(roundNumber) ? roundNumber : null,
      productType: (getAt(groupColumnIdx.product) as SyncRoundResult["productType"]) || "toto13",
      requiredMatchCount: null,
      outcomeSetJson: null,
      sourceNote: `source:${sourceUrl}`,
      voidHandling: "manual",
      resultStatus: "unknown",
      salesStartAt: null,
      salesEndAt: null,
      stakeYen: 100,
      totalSalesYen: null,
      returnRate: 0.5,
      firstPrizeShare: 0.7,
      carryoverYen: 0,
      payoutCapYen: null,
      sourceUrl,
      sourceText: null,
      matches: [],
    };

    const roundWarnings: string[] = [];
    const homeTeam = getAt(groupColumnIdx.home, "ホーム");
    const awayTeam = getAt(groupColumnIdx.away, "アウェイ");
    const match: SyncMatchResult | null = {
      awayTeam,
      homeTeam,
      kickoffTime: getAt(groupColumnIdx.kick, "") || null,
      venue: getAt(groupColumnIdx.venue, "") || null,
      stage: getAt(groupColumnIdx.stage, ""),
      officialVote0: parseRate(getAt(groupColumnIdx.vote0), `第${roundRecord.officialRoundNumber ?? ""}回${no}試合 vote0`, roundWarnings),
      officialVote1: parseRate(getAt(groupColumnIdx.vote1), `第${roundRecord.officialRoundNumber ?? ""}回${no}試合 vote1`, roundWarnings),
      officialVote2: parseRate(getAt(groupColumnIdx.vote2), `第${roundRecord.officialRoundNumber ?? ""}回${no}試合 vote2`, roundWarnings),
      sourceText: line,
      matchStatus: "scheduled",
      officialMatchNo: no,
    };

    warnings.push(...roundWarnings);
    roundRecord.matches.push(match);
    rowsByRound.set(roundKey, roundRecord);
  });

  return Array.from(rowsByRound.values());
}

function coerceNumber(value: unknown): number | null {
  const parsed = Number(trimText(value));
  if (!Number.isFinite(parsed)) {
    return null;
  }
  return Math.trunc(parsed);
}

function coerceDecimal(value: unknown): number | null {
  if (value === null || value === undefined) {
    return null;
  }

  const parsed = Number(trimText(value));
  return Number.isFinite(parsed) ? parsed : null;
}

function parseAsJson(rawText: string) {
  if (!/^\s*[\[{]/.test(rawText)) {
    return null;
  }

  try {
    return JSON.parse(rawText);
  } catch {
    return null;
  }
}

function normalizeJsonRound(raw: Record<string, unknown>): SyncRoundResult | null {
  if (!raw || typeof raw !== "object") {
    return null;
  }

  const required = [
    trimText(raw.official_round_name),
    trimText(raw.title),
    trimText(raw.officialRoundName),
  ].find(Boolean);
  const productType = ["toto13", "mini_toto", "winner", "custom"].includes(trimText(raw.productType))
    ? (trimText(raw.productType) as SyncRoundResult["productType"])
    : "toto13";
  const voidHandling = trimText(raw.voidHandling) || "manual";

  return {
    title: required || "公式回",
    notes: trimText(raw.notes) || null,
    officialRoundName: trimText(raw.officialRoundName ?? raw.official_round_name) || required || null,
    officialRoundNumber: coerceNumber(raw.officialRoundNumber ?? raw.official_round_number) || null,
    productType,
    requiredMatchCount: coerceNumber(raw.requiredMatchCount ?? raw.required_match_count),
    outcomeSetJson: Array.isArray(raw.outcomeSetJson) ? raw.outcomeSetJson.filter(
      (value): value is string => typeof value === "string",
    ) : null,
    sourceNote: trimText(raw.sourceNote ?? raw.source_note),
    voidHandling:
      voidHandling === "all_outcomes_valid" || voidHandling === "exclude_from_combo" || voidHandling === "keep_as_pending"
        ? (voidHandling as SyncRoundResult["voidHandling"])
        : "manual",
    resultStatus:
      (trimText(raw.resultStatus ?? raw.result_status) as SyncRoundResult["resultStatus"]) || "unknown",
    salesStartAt: trimText(raw.salesStartAt ?? raw.sales_start_at) || null,
    salesEndAt: trimText(raw.salesEndAt ?? raw.sales_end_at) || null,
    stakeYen: coerceNumber(raw.stakeYen ?? raw.stake_yen) ?? 100,
    totalSalesYen: coerceDecimal(raw.totalSalesYen ?? raw.total_sales_yen),
    returnRate: parseRate(raw.returnRate ?? raw.return_rate, "returnRate", []) ?? 0.5,
    firstPrizeShare:
      trimText(raw.firstPrizeShare ?? raw.first_prize_share) ? parseRate(
        raw.firstPrizeShare ?? raw.first_prize_share,
        "firstPrizeShare",
        [],
      ) : null,
    carryoverYen: coerceNumber(raw.carryoverYen ?? raw.carryover_yen) ?? 0,
    payoutCapYen: coerceDecimal(raw.payoutCapYen ?? raw.payout_cap_yen),
    sourceUrl: trimText(raw.sourceUrl ?? raw.source_url) || null,
    sourceText: trimText(raw.sourceText ?? raw.source_text) || null,
    matches:
      Array.isArray(raw.matches)
        ? raw.matches
          .map((entry) => parseMatch(entry as Record<string, unknown>, []))
          .filter((match): match is SyncMatchResult => Boolean(match))
        : [],
  };
}

function coerceStringToRoundNo(value: string) {
  const match = value.match(/第?\s*(\d+)\s*回/);
  return match ? Number.parseInt(match[1] ?? "0", 10) : null;
}

function parseScheduleText(raw: string, sourceUrl: string, warnings: string[]) {
  const lines = raw.split(/\r?\n/).map(normalizeLine).filter(Boolean);
  if (lines.length === 0) {
    return [];
  }

  const rounds = new Map<string, Omit<SyncRoundResult, "matches"> & { matches: SyncMatchResult[] }>();
  let current: (Omit<SyncRoundResult, "matches"> & { matches: SyncMatchResult[] }) | null = null;
  let currentNo = 0;

  lines.forEach((line) => {
    const roundNo = coerceStringToRoundNo(line);
    if (roundNo !== null) {
      currentNo = roundNo;
      current = {
        title: `第${roundNo}回`,
        notes: null,
        officialRoundName: `第${roundNo}回`,
        officialRoundNumber: roundNo,
        productType: "toto13",
        requiredMatchCount: null,
        outcomeSetJson: null,
        sourceNote: "official schedule parse",
        voidHandling: "manual",
        resultStatus: "unknown",
        salesStartAt: null,
        salesEndAt: null,
        stakeYen: 100,
        totalSalesYen: null,
        returnRate: 0.5,
        firstPrizeShare: null,
        carryoverYen: 0,
        payoutCapYen: null,
        sourceUrl,
        sourceText: null,
        matches: [],
      };
      rounds.set(`round_${roundNo}`, current);
      return;
    }

    const parsed = parseVetoTextLine(line);
    if (!parsed || !current) {
      return;
    }

    currentNo += 1;
    current.matches.push({
      awayTeam: parsed.awayTeam,
      homeTeam: parsed.homeTeam,
      kickoffTime: null,
      venue: parsed.venue,
      stage: parsed.groupName,
      officialVote0: null,
      officialVote1: null,
      officialVote2: null,
      sourceText: line,
      matchStatus: "scheduled",
      officialMatchNo: currentNo,
    });
  });

  if (rounds.size === 0) {
    warnings.push("公式一覧本文から回情報を見つけられませんでした。CSV/JSON形式を使うか、後続CSV手入力を利用してください。");
  }

  return Array.from(rounds.values());
}

function parseRoundsFromPayload(rawText: string, sourceUrl: string, warnings: string[]): SyncRoundResult[] {
  const parsedJson = parseAsJson(rawText);
  if (parsedJson && typeof parsedJson === "object") {
    const obj = parsedJson as Record<string, unknown>;
    const roundsSource =
      Array.isArray(obj.rounds) ? obj.rounds
      : Array.isArray(obj.data) ? obj.data
      : Array.isArray(obj.results) ? obj.results
      : Array.isArray(parsedJson) ? parsedJson
      : [];

    if (Array.isArray(roundsSource) && roundsSource.length > 0) {
      const normalized = roundsSource
        .map((entry) => normalizeJsonRound(typeof entry === "object" ? entry as Record<string, unknown> : {}))
        .filter((round): round is SyncRoundResult => Boolean(round));
      if (normalized.length > 0) {
        return normalized;
      }
    }
  }

  const csvRounds = parseCsvOrTsvPayload(rawText, warnings, sourceUrl);
  if (csvRounds.length > 0) {
    return csvRounds;
  }

  return parseScheduleText(rawText, sourceUrl, warnings);
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(
      JSON.stringify({ error: "POST only" }),
      { headers: { ...corsHeaders, "content-type": "application/json" }, status: 405 },
    );
  }

  let body: SyncRequestBody = {};
  try {
    body = (await req.json()) as SyncRequestBody;
  } catch {
    body = {};
  }

  const sourceUrl = normalizeSourceUrl(body.sourceUrl || defaultSourceUrl);
  const includeMatches = body.includeMatches !== false;
  const headers = {
    ...corsHeaders,
    "content-type": "application/json",
  };

  try {
    const fetchResponse = await fetch(sourceUrl, {
      headers: {
        "user-agent": "world-toto-lab-sync-bot",
      },
    });
    const rawText = await fetchResponse.text();
    const warnings: string[] = [];

    if (!fetchResponse.ok) {
      warnings.push(
        `公式一覧の取得に失敗しました: ${fetchResponse.status} ${fetchResponse.statusText}`,
      );
      return new Response(
        JSON.stringify({
          fetchedAt: new Date().toISOString(),
          rounds: [],
          sourceText: rawText?.slice(0, 20000) || null,
          sourceUrl,
          warnings,
        } satisfies SyncPayload),
        { headers, status: 200 },
      );
    }

    const htmlParsed = looksLikeTotoOfficialHtml(rawText)
      ? await parseTotoOfficialHtmlSource({
        fetchText: async (url) => {
          const detailResponse = await fetch(url, {
            headers: {
              "user-agent": "world-toto-lab-sync-bot",
            },
          });

          if (!detailResponse.ok) {
            throw new Error(`${detailResponse.status} ${detailResponse.statusText}`);
          }

          return await detailResponse.text();
        },
        includeMatches,
        rawText,
        sourceUrl,
      })
      : null;
    const rounds = htmlParsed && htmlParsed.rounds.length > 0
      ? htmlParsed.rounds
      : parseRoundsFromPayload(rawText, sourceUrl, warnings);
    warnings.push(...(htmlParsed?.warnings ?? []));
    if (rounds.length === 0) {
      return new Response(
        JSON.stringify({
          fetchedAt: new Date().toISOString(),
          rounds: [],
          sourceText: rawText.slice(0, 20000) || null,
          sourceUrl,
          warnings:
            warnings.length > 0
              ? warnings
              : ["取得できる回情報がありませんでした。CSV/TSVを貼り付けるか、別ページを指定してください。"],
        } satisfies SyncPayload),
        { headers, status: 200 },
      );
    }

    const normalized = rounds.map((round) => ({
      ...round,
      matches: includeMatches ? round.matches : [],
    }));

    return new Response(
      JSON.stringify({
        fetchedAt: new Date().toISOString(),
        rounds: normalized,
        sourceText: rawText.slice(0, 20000),
        sourceUrl,
        warnings,
      } satisfies SyncPayload),
      { headers, status: 200 },
    );
  } catch (error) {
    return new Response(
      JSON.stringify({
        fetchedAt: new Date().toISOString(),
        rounds: [],
        sourceText: null,
        sourceUrl,
        warnings: [`同期処理で例外が発生しました: ${(error as Error).message}`],
      } satisfies SyncPayload),
      { headers, status: 200 },
    );
  }
});

function normalizeSourceUrl(value: string) {
  if (!value) {
    return defaultSourceUrl;
  }

  const normalized = value.trim();
  return normalized || defaultSourceUrl;
}
