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
    notes:
      normalizeAddress(address) === BLUNTTEDGE_WATCH_CANDIDATE.address
        ? BLUNTTEDGE_WATCH_CANDIDATE.evidence
        : null,
    observedAt: options.observedAt,
    valueRows,
  });
}

export function createBlunttedgeSeedSignal(now = new Date().toISOString()): TraderSignal {
  return {
    id: `polymarket-trader-${idSafe(BLUNTTEDGE_WATCH_CANDIDATE.address)}`,
    source: "polymarket",
    address: BLUNTTEDGE_WATCH_CANDIDATE.address,
    displayName: BLUNTTEDGE_WATCH_CANDIDATE.displayName,
    pseudonym: null,
    profileImageUrl: null,
    profileUrl: `https://polymarket.com/profile/${BLUNTTEDGE_WATCH_CANDIDATE.address}`,
    category: "SPORTS",
    timePeriod: "MONTH",
    rank: null,
    pnl: 3_430_093.5,
    volume: null,
    currentValue: null,
    predictionCount: 3,
    biggestWin: 4_100_000,
    biggestWinTitle: "Will Japan win on 2026-06-25? / No",
    lastActivityAt: null,
    observedAt: now,
    dataConfidence: "medium",
    notes: BLUNTTEDGE_WATCH_CANDIDATE.evidence,
    createdAt: now,
    updatedAt: now,
  };
}
