import type {
  MarketDataConfidence,
  TraderMarketSignal,
  TraderMarketSignalDirection,
  TraderSignal,
} from "@/lib/market-sources/types";

export const POLYMARKET_DATA_API_BASE = "https://data-api.polymarket.com";

export const BLUNTTEDGE_WATCH_CANDIDATE = {
  address: "0x664ce9fb97ae1bbd538d7381b2f4e92dab16f49c",
  displayName: "blunttedge",
  evidence:
    "Matched from public Data API: Japan vs Sweden / Japan win No shows about $4.1M cash PnL, matching the screenshot biggest-win clue.",
  sourcePostClue: "Joined Jun 2026 / 3 predictions / biggest win about $4.1M",
} as const;

export type PolymarketStrongAccountRole =
  | "contrarian_sharp"
  | "inverse_caution"
  | "sharp_cluster"
  | "whale_liquidity";

export type PolymarketStrongAccountCandidate = {
  address: string;
  biggestWinEstimate: number | null;
  displayName: string;
  evidence: string;
  pnlEstimate: number | null;
  predictionCountEstimate: number | null;
  priority: number;
  role: PolymarketStrongAccountRole;
  roleLabel: string;
  sourcePostClue: string;
  useInToto: string;
  volumeEstimate: number | null;
};

export const POLYMARKET_STRONG_ACCOUNT_CANDIDATES = [
  {
    address: "0x96cfcb0c30942cfcd1cdf76c7d408794d66b1acb",
    biggestWinEstimate: null,
    displayName: "mintblade",
    evidence:
      "Polymarket Sports MONTH leaderboard rank 1 by PnL during the World Cup window; reported as part of the same high-profit World Cup cluster.",
    pnlEstimate: 9_238_344.62,
    predictionCountEstimate: null,
    priority: 1,
    role: "sharp_cluster",
    roleLabel: "sharp cluster",
    sourcePostClue: "Sports MONTH PnL rank 1 / World Cup cluster candidate",
    useInToto:
      "If this cluster leans against a famous favorite, unlock the public favorite and keep draw/No visible.",
    volumeEstimate: 17_759_922.23,
  },
  {
    address: "0xed64a7bf029040aa331abc87902434d815ef217d",
    biggestWinEstimate: 9_000_000,
    displayName: "fishalive",
    evidence:
      "Public trades showed Spain No and Cabo Verde +2.5 around the Spain shock; strong contrarian clue against famous favorites.",
    pnlEstimate: 9_063_378.18,
    predictionCountEstimate: null,
    priority: 2,
    role: "contrarian_sharp",
    roleLabel: "contrarian sharp",
    sourcePostClue: "Spain No / Cabo Verde +2.5 public footprint",
    useInToto:
      "When official voters overbuy a famous team, treat its No/draw side as a serious hedge candidate.",
    volumeEstimate: 13_281_460.37,
  },
  {
    address: "0xbc11a64ab34a03a043fbe80598fa065ee87eeec6",
    biggestWinEstimate: null,
    displayName: "frostrizz",
    evidence:
      "Polymarket Sports MONTH leaderboard rank 3 by PnL; public trades show large World Cup No exposure.",
    pnlEstimate: 8_928_561.12,
    predictionCountEstimate: null,
    priority: 3,
    role: "contrarian_sharp",
    roleLabel: "contrarian sharp",
    sourcePostClue: "Sports MONTH PnL rank 3 / large World Cup No trades",
    useInToto:
      "Use as a secondary contrarian signal; do not override market price without same-match footprint.",
    volumeEstimate: 23_091_318.16,
  },
  {
    address: BLUNTTEDGE_WATCH_CANDIDATE.address,
    biggestWinEstimate: 4_100_000,
    displayName: BLUNTTEDGE_WATCH_CANDIDATE.displayName,
    evidence: BLUNTTEDGE_WATCH_CANDIDATE.evidence,
    pnlEstimate: 8_474_966.27,
    predictionCountEstimate: 3,
    priority: 4,
    role: "contrarian_sharp",
    roleLabel: "contrarian sharp",
    sourcePostClue: BLUNTTEDGE_WATCH_CANDIDATE.sourcePostClue,
    useInToto:
      "Treat as a Japan/public-bias warning; it can unlock draw/away but stays low-sample until refreshed.",
    volumeEstimate: 19_001_698.93,
  },
  {
    address: "0x3f87d51f27ba6e19ec52aaeebb68559a839c742c",
    biggestWinEstimate: null,
    displayName: "GRIMDRIP",
    evidence:
      "Polymarket Sports MONTH leaderboard rank 5 by PnL during the World Cup window; reported with the same high-profit cluster.",
    pnlEstimate: 7_602_742.06,
    predictionCountEstimate: null,
    priority: 5,
    role: "sharp_cluster",
    roleLabel: "sharp cluster",
    sourcePostClue: "Sports MONTH PnL rank 5 / World Cup cluster candidate",
    useInToto:
      "Cluster agreement with mintblade/endlessFate should increase the confidence of a market-vs-official gap.",
    volumeEstimate: 13_603_969.28,
  },
  {
    address: "0x5e4c3b5b81171e2ca4ab776ac0d6bba787f9dba2",
    biggestWinEstimate: null,
    displayName: "endlessFate",
    evidence:
      "Polymarket Sports MONTH leaderboard rank 6 by PnL; public trades include large World Cup match exposure.",
    pnlEstimate: 7_409_836.65,
    predictionCountEstimate: null,
    priority: 6,
    role: "sharp_cluster",
    roleLabel: "sharp cluster",
    sourcePostClue: "Sports MONTH PnL rank 6 / World Cup cluster candidate",
    useInToto:
      "Use only when it agrees with the broader market or the sharp cluster; avoid single-wallet copy.",
    volumeEstimate: 26_282_164.74,
  },
  {
    address: "0xd6505aab3c6bef32ae6c96dbd8023d7c4df114fb",
    biggestWinEstimate: null,
    displayName: "BAREFLUX",
    evidence:
      "Polymarket Sports MONTH leaderboard rank 10 by PnL; public footprint included United States No exposure.",
    pnlEstimate: 3_440_343.44,
    predictionCountEstimate: null,
    priority: 7,
    role: "contrarian_sharp",
    roleLabel: "contrarian sharp",
    sourcePostClue: "Sports MONTH PnL rank 10 / United States No footprint",
    useInToto:
      "Useful as a public-favorite fade clue when the same match appears in the current toto slate.",
    volumeEstimate: 21_662_777.59,
  },
  {
    address: "0x204f72f35326db932158cba6adff0b9a1da95e14",
    biggestWinEstimate: null,
    displayName: "swisstony",
    evidence:
      "Polymarket Sports ALL leaderboard rank 1 by PnL and MONTH volume rank 1; likely liquidity/large-account signal.",
    pnlEstimate: 4_903_177.84,
    predictionCountEstimate: null,
    priority: 8,
    role: "whale_liquidity",
    roleLabel: "whale / liquidity",
    sourcePostClue: "Sports ALL PnL rank 1 / very high monthly volume",
    useInToto:
      "Do not copy. Use to judge market depth, late price stability, and whether a move is well-funded.",
    volumeEstimate: 359_245_568.66,
  },
  {
    address: "0xf0318c32136c2db7fec88b84869aee6a1106c80c",
    biggestWinEstimate: null,
    displayName: "BreakTheBank",
    evidence:
      "Polymarket Sports MONTH leaderboard top 10 by PnL and high volume; public trades include draw/under style football exposure.",
    pnlEstimate: 3_460_835.4,
    predictionCountEstimate: null,
    priority: 9,
    role: "whale_liquidity",
    roleLabel: "whale / liquidity",
    sourcePostClue: "Sports MONTH PnL top 10 / high-volume football footprint",
    useInToto:
      "Use as a market-depth and disagreement clue, not as a direct pick source.",
    volumeEstimate: 77_600_801.65,
  },
  {
    address: "0xf8831548531d56ad6a4331493243c447a827cd1f",
    biggestWinEstimate: null,
    displayName: "Inaccuratestake",
    evidence:
      "Polymarket Sports MONTH leaderboard top 10 by PnL, but public position history is mixed across sports.",
    pnlEstimate: 3_947_667.26,
    predictionCountEstimate: null,
    priority: 10,
    role: "inverse_caution",
    roleLabel: "inverse caution",
    sourcePostClue: "Sports MONTH PnL top 10 / mixed cross-sport footprint",
    useInToto:
      "Keep as cautionary context only; require same-match evidence before it changes any toto outcome.",
    volumeEstimate: 19_153_210.49,
  },
] satisfies PolymarketStrongAccountCandidate[];

export type PolymarketReadRequest = {
  label: "leaderboard" | "markets" | "activity" | "value";
  method: "GET";
  readOnly: true;
  url: string;
};

export type PolymarketTraderSnapshot = {
  trader: TraderSignal;
  marketSignals: TraderMarketSignal[];
};

type JsonRecord = Record<string, unknown>;

function nowIso(now?: string): string {
  return now ?? new Date().toISOString();
}

function idSafe(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function normalizeAddress(address: string): string {
  return address.trim().toLowerCase();
}

export function findPolymarketStrongAccountCandidate(
  address: string,
): PolymarketStrongAccountCandidate | null {
  const normalized = normalizeAddress(address);
  return (
    POLYMARKET_STRONG_ACCOUNT_CANDIDATES.find(
      (candidate) => normalizeAddress(candidate.address) === normalized,
    ) ?? null
  );
}

function rowsFrom(raw: unknown): JsonRecord[] {
  if (Array.isArray(raw)) {
    return raw.filter((row): row is JsonRecord => Boolean(row) && typeof row === "object");
  }
  if (raw && typeof raw === "object" && Array.isArray((raw as { value?: unknown }).value)) {
    return (raw as { value: unknown[] }).value.filter(
      (row): row is JsonRecord => Boolean(row) && typeof row === "object",
    );
  }
  return [];
}

function stringValue(row: JsonRecord | null | undefined, key: string): string | null {
  const value = row?.[key];
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function numberValue(row: JsonRecord | null | undefined, key: string): number | null {
  const value = row?.[key];
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function timestampToIso(value: unknown): string | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    const milliseconds = value > 10_000_000_000 ? value : value * 1000;
    return new Date(milliseconds).toISOString();
  }
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) {
      return timestampToIso(parsed);
    }
    const time = Date.parse(value);
    return Number.isNaN(time) ? null : new Date(time).toISOString();
  }
  return null;
}

function bestDisplayName(...rows: Array<JsonRecord | null | undefined>): string | null {
  for (const row of rows) {
    const value =
      stringValue(row, "userName") ??
      stringValue(row, "name") ??
      stringValue(row, "pseudonym");
    if (value) {
      return value;
    }
  }
  return null;
}

function bestConfidence(input: {
  leaderboardRow: JsonRecord | null;
  marketRows: JsonRecord[];
  activityRows: JsonRecord[];
}): MarketDataConfidence {
  if (input.leaderboardRow && input.marketRows.length > 0 && input.activityRows.length > 0) {
    return "high";
  }
  if (input.leaderboardRow || input.marketRows.length > 0 || input.activityRows.length > 0) {
    return "medium";
  }
  return "unknown";
}

function directionForOutcome(outcome: string | null): TraderMarketSignalDirection {
  const normalized = outcome?.trim().toLowerCase();
  if (normalized === "yes") {
    return "supports_outcome";
  }
  if (normalized === "no") {
    return "opposes_outcome";
  }
  return "unknown";
}

function marketSignalFromRow(input: {
  address: string;
  observedAt: string;
  row: JsonRecord;
  traderSignalId: string;
  type: "activity" | "market";
}): TraderMarketSignal {
  const { address, observedAt, row, traderSignalId, type } = input;
  const conditionId = stringValue(row, "conditionId");
  const asset = stringValue(row, "asset");
  const timestamp = timestampToIso(row.timestamp);
  const slug = stringValue(row, "slug");
  const id = [
    "polymarket",
    "trader-market",
    idSafe(address),
    idSafe(type),
    idSafe(conditionId ?? slug ?? "unknown"),
    idSafe(asset ?? String(row.timestamp ?? "snapshot")),
  ].join("-");
  const outcome = stringValue(row, "outcome");

  return {
    id,
    traderSignalId,
    source: "polymarket",
    address,
    title: stringValue(row, "title") ?? "(untitled market)",
    slug,
    eventSlug: stringValue(row, "eventSlug"),
    outcome,
    side: stringValue(row, "side"),
    price: numberValue(row, "price") ?? numberValue(row, "avgPrice") ?? numberValue(row, "curPrice"),
    size: numberValue(row, "size"),
    usdcSize: numberValue(row, "usdcSize"),
    currentValue: numberValue(row, "currentValue"),
    cashPnl: numberValue(row, "cashPnl"),
    initialValue: numberValue(row, "initialValue"),
    timestamp,
    conditionId,
    asset,
    signalDirection: directionForOutcome(outcome),
    observedAt,
    createdAt: observedAt,
    updatedAt: observedAt,
  };
}

export function buildPolymarketLeaderboardRequest(options: {
  category?: "OVERALL" | "SPORTS";
  limit?: number;
  timePeriod?: "ALL" | "DAY" | "MONTH" | "WEEK";
} = {}): PolymarketReadRequest {
  const category = options.category ?? "SPORTS";
  const timePeriod = options.timePeriod ?? "MONTH";
  const limit = options.limit ?? 50;
  const params = new URLSearchParams({
    category,
    limit: String(limit),
    orderBy: "PNL",
    timePeriod,
  });
  return {
    label: "leaderboard",
    method: "GET",
    readOnly: true,
    url: `${POLYMARKET_DATA_API_BASE}/v1/leaderboard?${params.toString()}`,
  };
}

export function buildPolymarketTraderSnapshotRequests(
  address: string,
  options: { limit?: number } = {},
): PolymarketReadRequest[] {
  const user = normalizeAddress(address);
  const limit = String(options.limit ?? 50);
  return [
    buildPolymarketLeaderboardRequest(),
    {
      label: "markets",
      method: "GET",
      readOnly: true,
      url: `${POLYMARKET_DATA_API_BASE}/positions?${new URLSearchParams({
        closed: "true",
        limit,
        user,
      }).toString()}`,
    },
    {
      label: "activity",
      method: "GET",
      readOnly: true,
      url: `${POLYMARKET_DATA_API_BASE}/trades?${new URLSearchParams({
        limit,
        user,
      }).toString()}`,
    },
    {
      label: "value",
      method: "GET",
      readOnly: true,
      url: `${POLYMARKET_DATA_API_BASE}/value?${new URLSearchParams({ user }).toString()}`,
    },
  ];
}

export function normalizePolymarketTraderSnapshot(input: {
  activityRows?: unknown;
  address: string;
  category?: string | null;
  leaderboardRows?: unknown;
  marketRows?: unknown;
  notes?: string | null;
  observedAt?: string;
  timePeriod?: string | null;
  valueRows?: unknown;
}): PolymarketTraderSnapshot {
  const address = normalizeAddress(input.address);
  const observedAt = nowIso(input.observedAt);
  const leaderboardRows = rowsFrom(input.leaderboardRows);
  const marketRows = rowsFrom(input.marketRows);
  const activityRows = rowsFrom(input.activityRows);
  const valueRows = rowsFrom(input.valueRows);
  const leaderboardRow =
    leaderboardRows.find((row) => stringValue(row, "proxyWallet")?.toLowerCase() === address) ??
    leaderboardRows[0] ??
    null;
  const firstActivity = activityRows[0] ?? null;
  const firstValue = valueRows.find((row) => stringValue(row, "user")?.toLowerCase() === address) ?? valueRows[0] ?? null;
  const traderSignalId = `polymarket-trader-${idSafe(address)}`;
  const marketSignals = [
    ...marketRows.map((row) =>
      marketSignalFromRow({ address, observedAt, row, traderSignalId, type: "market" }),
    ),
    ...activityRows.map((row) =>
      marketSignalFromRow({ address, observedAt, row, traderSignalId, type: "activity" }),
    ),
  ];
  const uniqueMarkets = new Set(
    marketSignals
      .map((signal) => signal.eventSlug ?? signal.slug ?? signal.conditionId)
      .filter((value): value is string => Boolean(value)),
  );
  const biggest = marketRows
    .map((row) => ({
      cashPnl: numberValue(row, "cashPnl"),
      title: stringValue(row, "title"),
    }))
    .filter((row): row is { cashPnl: number; title: string | null } => row.cashPnl !== null)
    .sort((left, right) => Math.abs(right.cashPnl) - Math.abs(left.cashPnl))[0];
  const lastActivityAt = activityRows
    .map((row) => timestampToIso(row.timestamp))
    .filter((value): value is string => value !== null)
    .sort()
    .at(-1) ?? null;

  return {
    trader: {
      id: traderSignalId,
      source: "polymarket",
      address,
      displayName: bestDisplayName(leaderboardRow, firstActivity),
      pseudonym: stringValue(firstActivity, "pseudonym"),
      profileImageUrl:
        stringValue(leaderboardRow, "profileImage") ??
        stringValue(firstActivity, "profileImage") ??
        stringValue(firstActivity, "profileImageOptimized"),
      profileUrl: `https://polymarket.com/profile/${address}`,
      category: input.category ?? "SPORTS",
      timePeriod: input.timePeriod ?? "MONTH",
      rank: numberValue(leaderboardRow, "rank"),
      pnl: numberValue(leaderboardRow, "pnl"),
      volume: numberValue(leaderboardRow, "vol"),
      currentValue: numberValue(firstValue, "value"),
      predictionCount: uniqueMarkets.size > 0 ? uniqueMarkets.size : null,
      biggestWin: biggest?.cashPnl ?? null,
      biggestWinTitle: biggest?.title ?? null,
      lastActivityAt,
      observedAt,
      dataConfidence: bestConfidence({ activityRows, leaderboardRow, marketRows }),
      notes: input.notes ?? null,
      createdAt: observedAt,
      updatedAt: observedAt,
    },
    marketSignals,
  };
}

async function getJson(url: string): Promise<unknown> {
  const response = await fetch(url, { cache: "no-store" });
  if (!response.ok) {
    throw new Error(`Polymarket read failed (${response.status})`);
  }
  return response.json() as Promise<unknown>;
}

export async function fetchPolymarketLeaderboard(options: {
  category?: "OVERALL" | "SPORTS";
  limit?: number;
  timePeriod?: "ALL" | "DAY" | "MONTH" | "WEEK";
} = {}): Promise<JsonRecord[]> {
  return rowsFrom(await getJson(buildPolymarketLeaderboardRequest(options).url));
}

export async function fetchPolymarketTraderSnapshot(
  address: string,
  options: { limit?: number; observedAt?: string } = {},
): Promise<PolymarketTraderSnapshot> {
  const requests = buildPolymarketTraderSnapshotRequests(address, { limit: options.limit });
  const [leaderboardRows, marketRows, activityRows, valueRows] = await Promise.all(
    requests.map((request) => getJson(request.url)),
  );
  return normalizePolymarketTraderSnapshot({
    activityRows,
    address,
    leaderboardRows,
    marketRows,
    notes: findPolymarketStrongAccountCandidate(address)?.evidence ?? null,
    observedAt: options.observedAt,
    valueRows,
  });
}

export function createPolymarketSeedTraderSignal(
  candidate: PolymarketStrongAccountCandidate,
  now = new Date().toISOString(),
): TraderSignal {
  const notes = [
    `${candidate.roleLabel}: ${candidate.evidence}`,
    `Toto use: ${candidate.useInToto}`,
  ].join(" ");

  return {
    id: `polymarket-trader-${idSafe(candidate.address)}`,
    source: "polymarket",
    address: normalizeAddress(candidate.address),
    displayName: candidate.displayName,
    pseudonym: null,
    profileImageUrl: null,
    profileUrl: `https://polymarket.com/profile/${normalizeAddress(candidate.address)}`,
    category: "SPORTS",
    timePeriod: "MONTH",
    rank: null,
    pnl: candidate.pnlEstimate,
    volume: candidate.volumeEstimate,
    currentValue: null,
    predictionCount: candidate.predictionCountEstimate,
    biggestWin: candidate.biggestWinEstimate,
    biggestWinTitle:
      candidate.address === BLUNTTEDGE_WATCH_CANDIDATE.address
        ? "Will Japan win on 2026-06-25? / No"
        : null,
    lastActivityAt: null,
    observedAt: now,
    dataConfidence: "medium",
    notes,
    createdAt: now,
    updatedAt: now,
  };
}

export function createPolymarketSeedTraderSignals(
  now = new Date().toISOString(),
): TraderSignal[] {
  return POLYMARKET_STRONG_ACCOUNT_CANDIDATES.map((candidate) =>
    createPolymarketSeedTraderSignal(candidate, now),
  );
}

export function createBlunttedgeSeedSignal(now = new Date().toISOString()): TraderSignal {
  return createPolymarketSeedTraderSignal(
    findPolymarketStrongAccountCandidate(BLUNTTEDGE_WATCH_CANDIDATE.address) ??
      POLYMARKET_STRONG_ACCOUNT_CANDIDATES[3],
    now,
  );
}
