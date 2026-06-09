/**
 * Hyperliquid Market Source アダプタ（read-only）。
 *
 * 役割:
 *  1. URL から slug を抽出する。
 *  2. slug から市場の意味（competition / marketType / team / outcomeLabel / signalLayer）を推定する。
 *  3. UI slug ⇄ API coin の対応表（HyperliquidSymbolMapping）を引く。
 *  4. info endpoint への read-only リクエスト（allMids / l2Book / candleSnapshot）を組み立てる。
 *  5. URL から MarketNode を生成する（mapping が無ければ価格は manual input 扱い）。
 *
 * 重要: ここには売買・wallet 接続・注文・署名は一切無い。Hyperliquid の info endpoint
 * （公開・read-only）だけを使う。取引系の関数を足さないこと（hyperliquid.test.ts の
 * [no-trading] テストで担保している）。
 */
import {
  defaultSignalLayerForMarketType,
  defaultWeightForMarketType,
  type HyperliquidSymbolMapping,
  type MarketDataConfidence,
  type MarketNode,
  type MarketType,
  type SignalLayer,
} from "@/lib/market-sources/types";
import { canonicalTeamName } from "@/lib/market-sources/team-names";

/** Hyperliquid 公開 UI のベース URL。 */
export const HYPERLIQUID_APP_BASE_URL = "https://app.hyperliquid.xyz";

/** Hyperliquid 公開 info endpoint（read-only）。 */
export const HYPERLIQUID_INFO_ENDPOINT = "https://api.hyperliquid.xyz/info";

/** UI slug ⇄ API coin の対応表。最初は手入力で良い（空でも動く）。 */
export const HYPERLIQUID_SYMBOL_MAP: readonly HyperliquidSymbolMapping[] = [
  // 例（coin 名は要確認のため既定では未登録）:
  // {
  //   slug: "2026-world-cup-champion-france-yes",
  //   coin: "<verify-on-hyperliquid>",
  //   dex: null,
  //   sourceUrl: "https://app.hyperliquid.xyz/trade/2026-world-cup-champion-france-yes",
  //   notes: "France 優勝 YES。coin 名は API で要確認。",
  // },
];

function nowIso(now?: string): string {
  return now ?? new Date().toISOString();
}

function localId(prefix: string): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

/**
 * URL（または素の slug）から Hyperliquid の slug を取り出す。
 * 例: https://app.hyperliquid.xyz/trade/2026-world-cup-champion-france-yes
 *     → 2026-world-cup-champion-france-yes
 */
export function extractHyperliquidSlug(input: string): string | null {
  const trimmed = (input ?? "").trim();
  if (!trimmed) {
    return null;
  }

  const fromPath = (pathname: string): string | null => {
    const parts = pathname.split("/").filter(Boolean);
    const tradeIndex = parts.indexOf("trade");
    const segment =
      tradeIndex >= 0 && parts[tradeIndex + 1]
        ? parts[tradeIndex + 1]
        : parts[parts.length - 1];
    if (!segment) {
      return null;
    }
    return decodeURIComponent(segment).trim().toLowerCase();
  };

  try {
    const url = new URL(trimmed);
    return fromPath(url.pathname);
  } catch {
    // URL ではない: "app.hyperliquid.xyz/trade/<slug>" 形や素の slug を許容する。
    const tradeMatch = trimmed.match(/trade\/([^/?#\s]+)/i);
    if (tradeMatch) {
      return decodeURIComponent(tradeMatch[1]).trim().toLowerCase();
    }
    if (/^[a-z0-9]+(?:[-_][a-z0-9]+)*$/i.test(trimmed)) {
      return trimmed.toLowerCase();
    }
    return null;
  }
}

/** slug から推定した市場の意味。 */
export type ParsedHyperliquidMarket = {
  slug: string;
  /** 例: "fifa_world_cup_2026"。判定できなければ "unknown"。 */
  competition: string;
  marketType: MarketType;
  /** 既知チームは正規英語名、未知は素のタイトルケース。チーム不明は null。 */
  team: string | null;
  /** 例: "YES"。 */
  outcomeLabel: string;
  signalLayer: SignalLayer;
  /** competition + marketType を確信を持って認識できたか。 */
  recognized: boolean;
  rawTokens: string[];
};

const OUTCOME_TOKENS = new Set(["yes", "no", "over", "under", "draw"]);

// チーム名の抽出時に取り除くキーワード。
const NON_TEAM_TOKENS = new Set([
  "world",
  "cup",
  "worldcup",
  "fifa",
  "champion",
  "champions",
  "championship",
  "winner",
  "winners",
  "win",
  "wins",
  "to",
  "the",
  "of",
  "outright",
  "futures",
  "future",
  "market",
  "markets",
  "group",
  "groups",
  "qualify",
  "qualifies",
  "qualification",
  "qualifying",
  "advance",
  "advances",
  "knockout",
  "mens",
  "men",
  "womens",
  "women",
  "soccer",
  "football",
  "yes",
  "no",
  "over",
  "under",
  "draw",
]);

function isYearToken(token: string): boolean {
  return /^(19|20)\d{2}$/.test(token);
}

function titleCase(value: string): string {
  return value
    .split(" ")
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

/** slug から市場の意味を推定する。 */
export function parseHyperliquidSlug(rawSlug: string): ParsedHyperliquidMarket {
  const slug = rawSlug.trim().toLowerCase();
  const tokens = slug.split(/[-_]/).filter(Boolean);
  const tokenSet = new Set(tokens);

  // competition
  const hasWorldCup =
    tokenSet.has("worldcup") || (tokenSet.has("world") && tokenSet.has("cup"));
  const year = tokens.find(isYearToken) ?? null;
  const competition = hasWorldCup
    ? `fifa_world_cup_${year ?? "2026"}`
    : "unknown";

  // outcomeLabel（末尾の yes/no などを優先、無ければ YES 既定）
  const lastToken = tokens[tokens.length - 1] ?? "";
  const outcomeLabel = OUTCOME_TOKENS.has(lastToken)
    ? lastToken.toUpperCase()
    : "YES";

  // marketType
  const hasChampion =
    tokenSet.has("champion") ||
    tokenSet.has("champions") ||
    tokenSet.has("championship");
  const hasWinner = tokenSet.has("winner") || tokenSet.has("winners") || tokenSet.has("win");
  const hasGroup = tokenSet.has("group");
  const hasQualify =
    tokenSet.has("qualify") ||
    tokenSet.has("qualifies") ||
    tokenSet.has("qualification") ||
    tokenSet.has("qualifying") ||
    tokenSet.has("advance") ||
    tokenSet.has("advances");
  const hasVersus = tokenSet.has("vs") || tokenSet.has("v");

  let marketType: MarketType;
  let recognized = true;
  if (hasGroup && hasQualify) {
    marketType = "group_qualification";
  } else if (hasGroup && (hasWinner || hasChampion)) {
    marketType = "group_winner";
  } else if (hasChampion || (hasWorldCup && hasWinner)) {
    marketType = "outright_champion";
  } else if (hasVersus) {
    marketType = "individual_match_1x2";
  } else if (hasWorldCup && hasWinner) {
    marketType = "outright_champion";
  } else {
    marketType = "manual_signal";
    recognized = false;
  }

  // team: キーワード/年/vs を除いた残りトークンを結合して照合する。
  const teamTokens = tokens.filter(
    (token) =>
      !NON_TEAM_TOKENS.has(token) &&
      !isYearToken(token) &&
      token !== "vs" &&
      token !== "v",
  );
  const teamCandidate = teamTokens.join(" ").trim();
  let team: string | null = null;
  if (teamCandidate) {
    team = canonicalTeamName(teamCandidate) ?? titleCase(teamCandidate);
  }

  return {
    slug,
    competition,
    marketType,
    team,
    outcomeLabel,
    signalLayer: defaultSignalLayerForMarketType(marketType),
    recognized,
    rawTokens: tokens,
  };
}

/** slug に対応する symbol mapping を引く。無ければ null。 */
export function findHyperliquidMapping(
  slug: string,
  mappings: readonly HyperliquidSymbolMapping[] = HYPERLIQUID_SYMBOL_MAP,
): HyperliquidSymbolMapping | null {
  const normalized = slug.trim().toLowerCase();
  return mappings.find((entry) => entry.slug.trim().toLowerCase() === normalized) ?? null;
}

// --- read-only info API リクエストビルダー -------------------------------------

export type HyperliquidInfoRequest = {
  url: string;
  method: "POST";
  headers: Record<string, string>;
  body: string;
};

function infoRequest(payload: unknown): HyperliquidInfoRequest {
  return {
    url: HYPERLIQUID_INFO_ENDPOINT,
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  };
}

/** allMids: 全 coin の mid 価格。 */
export function buildAllMidsRequest(): HyperliquidInfoRequest {
  return infoRequest({ type: "allMids" });
}

/** l2Book: 指定 coin の板。 */
export function buildL2BookRequest(coin: string): HyperliquidInfoRequest {
  return infoRequest({ type: "l2Book", coin });
}

/** candleSnapshot: 指定 coin のローソク足。 */
export function buildCandleSnapshotRequest(params: {
  coin: string;
  interval: string;
  startTime: number;
  endTime: number;
}): HyperliquidInfoRequest {
  return infoRequest({
    type: "candleSnapshot",
    req: {
      coin: params.coin,
      interval: params.interval,
      startTime: params.startTime,
      endTime: params.endTime,
    },
  });
}

// --- read-only 価格取得（fetch 注入可能・失敗に強い） --------------------------

export type HyperliquidPriceSnapshot = {
  bid: number | null;
  ask: number | null;
  mid: number | null;
  spread: number | null;
  /** 板の最良気配の数量合計（流動性の目安）。不明なら null。 */
  liquidityScore: number | null;
};

export type HyperliquidPriceResult =
  | ({ ok: true } & HyperliquidPriceSnapshot)
  | { ok: false; error: string };

type FetchLike = (
  input: string,
  init: { method: string; headers: Record<string, string>; body: string; signal?: AbortSignal },
) => Promise<{ ok: boolean; status: number; json: () => Promise<unknown> }>;

function toNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function parseL2Book(payload: unknown): HyperliquidPriceSnapshot | null {
  if (!payload || typeof payload !== "object") {
    return null;
  }
  const levels = (payload as { levels?: unknown }).levels;
  if (!Array.isArray(levels) || levels.length < 2) {
    return null;
  }
  const bids = Array.isArray(levels[0]) ? (levels[0] as unknown[]) : [];
  const asks = Array.isArray(levels[1]) ? (levels[1] as unknown[]) : [];
  const bestBid = bids[0] as { px?: unknown; sz?: unknown } | undefined;
  const bestAsk = asks[0] as { px?: unknown; sz?: unknown } | undefined;
  const bid = toNumber(bestBid?.px);
  const ask = toNumber(bestAsk?.px);
  const mid = bid !== null && ask !== null ? (bid + ask) / 2 : bid ?? ask;
  const spread = bid !== null && ask !== null ? ask - bid : null;
  const bidSize = toNumber(bestBid?.sz) ?? 0;
  const askSize = toNumber(bestAsk?.sz) ?? 0;
  const liquidityScore = bidSize + askSize > 0 ? bidSize + askSize : null;
  return { bid, ask, mid, spread, liquidityScore };
}

/**
 * 指定 coin の板から最良気配を read-only で取得する。
 * fetch は注入可能（テスト/SSR 安全のため）。失敗時は ok:false を返す（throw しない）。
 */
export async function fetchHyperliquidL2Book(
  coin: string,
  options: { fetchImpl?: FetchLike; signal?: AbortSignal } = {},
): Promise<HyperliquidPriceResult> {
  const fetchImpl =
    options.fetchImpl ??
    (typeof fetch !== "undefined"
      ? (fetch as unknown as FetchLike)
      : undefined);
  if (!fetchImpl) {
    return { ok: false, error: "この環境では fetch が利用できません。" };
  }

  const request = buildL2BookRequest(coin);
  try {
    const response = await fetchImpl(request.url, {
      method: request.method,
      headers: request.headers,
      body: request.body,
      signal: options.signal,
    });
    if (!response.ok) {
      return { ok: false, error: `Hyperliquid API がエラーを返しました（HTTP ${response.status}）。` };
    }
    const payload = await response.json();
    const snapshot = parseL2Book(payload);
    if (!snapshot) {
      return { ok: false, error: "板データを解釈できませんでした。" };
    }
    return { ok: true, ...snapshot };
  } catch (error) {
    const message = error instanceof Error ? error.message : "不明なエラー";
    return { ok: false, error: `Hyperliquid API 取得に失敗しました: ${message}` };
  }
}

// --- MarketNode 生成 -----------------------------------------------------------

/** URL から推定したプレビュー（MarketNode を作る前の確認用）。 */
export type HyperliquidUrlPreview = {
  slug: string;
  externalUrl: string;
  parsed: ParsedHyperliquidMarket;
  mapping: HyperliquidSymbolMapping | null;
  /** mapping があれば "mapped"、無ければ "missing"（= 価格は手入力扱い）。 */
  mappingStatus: "mapped" | "missing";
  weight: number;
};

function canonicalUrl(input: string, slug: string): string {
  const trimmed = (input ?? "").trim();
  if (/^https?:\/\//i.test(trimmed)) {
    return trimmed;
  }
  return `${HYPERLIQUID_APP_BASE_URL}/trade/${slug}`;
}

/** URL を解析して、MarketNode を作る前のプレビューを返す。解析不能なら null。 */
export function previewHyperliquidUrl(
  input: string,
  mappings: readonly HyperliquidSymbolMapping[] = HYPERLIQUID_SYMBOL_MAP,
): HyperliquidUrlPreview | null {
  const slug = extractHyperliquidSlug(input);
  if (!slug) {
    return null;
  }
  const parsed = parseHyperliquidSlug(slug);
  const mapping = findHyperliquidMapping(slug, mappings);
  return {
    slug,
    externalUrl: canonicalUrl(input, slug),
    parsed,
    mapping,
    mappingStatus: mapping ? "mapped" : "missing",
    weight: defaultWeightForMarketType(parsed.marketType),
  };
}

export type CreateMarketNodeOptions = {
  mappings?: readonly HyperliquidSymbolMapping[];
  /** 手入力の価格（probability は 0..1）。指定すると priceSource = "manual"。 */
  manualPrice?: {
    probability?: number | null;
    mid?: number | null;
    bid?: number | null;
    ask?: number | null;
    liquidityScore?: number | null;
    volume?: number | null;
    openInterest?: number | null;
  } | null;
  weightOverride?: number | null;
  dataConfidence?: MarketDataConfidence;
  notes?: string | null;
  id?: string;
  now?: string;
};

/**
 * Hyperliquid URL から MarketNode を生成する。
 * - mapping が無く手入力価格も無い場合: 価格は null（priceSource = "none"）。UI で手入力を促す。
 * - 解析不能な URL の場合: null を返す。
 */
export function createMarketNodeFromHyperliquidUrl(
  input: string,
  options: CreateMarketNodeOptions = {},
): MarketNode | null {
  const preview = previewHyperliquidUrl(input, options.mappings ?? HYPERLIQUID_SYMBOL_MAP);
  if (!preview) {
    return null;
  }

  const timestamp = nowIso(options.now);
  const manual = options.manualPrice ?? null;
  const hasManualPrice =
    manual !== null &&
    [manual.probability, manual.mid, manual.bid, manual.ask].some(
      (value) => typeof value === "number" && Number.isFinite(value),
    );

  const spread =
    manual && typeof manual.bid === "number" && typeof manual.ask === "number"
      ? manual.ask - manual.bid
      : null;

  return {
    id: options.id ?? localId("market-node"),
    source: "hyperliquid",
    externalUrl: preview.externalUrl,
    externalSymbol: preview.mapping?.coin ?? null,
    slug: preview.slug,
    marketType: preview.parsed.marketType,
    competition: preview.parsed.competition,
    team: preview.parsed.team,
    outcomeLabel: preview.parsed.outcomeLabel,
    probability: manual?.probability ?? null,
    rawPrice: manual?.mid ?? null,
    bid: manual?.bid ?? null,
    ask: manual?.ask ?? null,
    mid: manual?.mid ?? null,
    spread,
    liquidityScore: manual?.liquidityScore ?? null,
    volume: manual?.volume ?? null,
    openInterest: manual?.openInterest ?? null,
    signalLayer: preview.parsed.signalLayer,
    weight: options.weightOverride ?? preview.weight,
    dataConfidence: options.dataConfidence ?? (hasManualPrice ? "low" : "unknown"),
    lastFetchedAt: hasManualPrice ? timestamp : null,
    notes: options.notes ?? null,
    priceSource: hasManualPrice ? "manual" : "none",
    lastApiError: null,
    createdAt: timestamp,
    updatedAt: timestamp,
  };
}
