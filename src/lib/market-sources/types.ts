/**
 * Market Source（市場ソース）グラフの共通型。
 *
 * docs/ARCHITECTURE.md「Future Memo: Semantic Trading」で構想されていた
 * `MarketNode` / `MarketRelation` を、W杯toto の上流シグナル取り込み用に最小実装する。
 *
 * 重要思想:
 * - これは read-only な「市場データの観測」レイヤーである。
 * - 売買・wallet 接続・注文は一切持たない（[no-trading] テストで担保）。
 * - 優勝市場（outright_champion）は「個別試合の 1/0/2 を直接決めるもの」ではなく、
 *   チームの地力に対する上流シグナル（upstream_team_prior）として weight 付きで軽く反映する。
 *
 * 保存層には依存しない純粋な型・既定値のみをここに置く（store.ts が永続化を担う）。
 */

/** 市場の出所。 */
export type MarketSource = "polymarket" | "hyperliquid" | "bookmaker" | "manual";

export const MARKET_SOURCES: readonly MarketSource[] = [
  "polymarket",
  "hyperliquid",
  "bookmaker",
  "manual",
] as const;

/** 市場の種類。toto 対象試合との距離（上流〜下流）を意味づける。 */
export type MarketType =
  | "outright_champion"
  | "group_winner"
  | "group_qualification"
  | "individual_match_1x2"
  | "player_availability"
  | "injury_news"
  | "manual_signal";

export const MARKET_TYPES: readonly MarketType[] = [
  "outright_champion",
  "group_winner",
  "group_qualification",
  "individual_match_1x2",
  "player_availability",
  "injury_news",
  "manual_signal",
] as const;

/**
 * シグナルの層。
 * - `upstream_team_prior`     : 優勝市場など。チームの地力に対する上流シグナル。
 * - `midstream_group_signal`  : グループ突破/首位など中流シグナル。
 * - `downstream_match_signal` : 個別試合 1X2 など下流（toto に最も近い）。
 * - `news_signal`             : 怪我/招集ニュースなど。
 * - `manual_signal`           : 手入力の補助シグナル。
 */
export type SignalLayer =
  | "upstream_team_prior"
  | "midstream_group_signal"
  | "downstream_match_signal"
  | "news_signal"
  | "manual_signal";

export const SIGNAL_LAYERS: readonly SignalLayer[] = [
  "upstream_team_prior",
  "midstream_group_signal",
  "downstream_match_signal",
  "news_signal",
  "manual_signal",
] as const;

/** データの信頼度。 */
export type MarketDataConfidence = "high" | "medium" | "low" | "unknown";

/** 価格の取得元。warnings（manual price / API取得失敗）判定に使う。 */
export type MarketPriceSource = "api" | "manual" | "none";

/**
 * 市場ノード。1つの市場アウトカム（例: France Champion YES）を表す観測点。
 *
 * 価格系（probability / mid / spread ...）は「取得できていれば入れる」程度の任意値で、
 * 無くても URL とメタ情報だけのノードとして保存できる（手入力フォールバック）。
 */
export type MarketNode = {
  id: string;
  source: MarketSource;

  externalUrl: string;
  externalSymbol: string | null;
  slug: string | null;

  marketType: MarketType;
  /** 例: "fifa_world_cup_2026"。 */
  competition: string;
  /** 例: "France"（英語正規名）。チームに紐づかない市場は null。 */
  team: string | null;
  /** 例: "YES"。 */
  outcomeLabel: string;

  /** モデル反映に使う 0..1 の確率。価格から導出 or 手入力。 */
  probability: number | null;
  /** 取得した生の価格（板/最終値など、解釈は source 依存）。 */
  rawPrice: number | null;
  bid: number | null;
  ask: number | null;
  mid: number | null;
  spread: number | null;
  /** 流動性の目安（板の厚みなど）。不明なら null。 */
  liquidityScore: number | null;
  volume: number | null;
  openInterest: number | null;

  signalLayer: SignalLayer;
  /** モデルへの寄与の重み。marketType ごとの既定値を持つ。 */
  weight: number;
  dataConfidence: MarketDataConfidence;

  /** 価格を最後に取得/入力した時刻（ISO）。 */
  lastFetchedAt: string | null;
  notes: string | null;

  // --- 運用メタ（warnings/UI 用。spec の中核フィールドではない補助情報） ---
  /** 価格の取得元。api / manual / none。 */
  priceSource: MarketPriceSource;
  /** 直近の API 取得エラー（あれば「API取得失敗」warning を出す）。 */
  lastApiError: string | null;
  createdAt: string;
  updatedAt: string;
};

/** MarketRelation の対象種別。 */
export type MarketRelationTargetType =
  | "team_prior"
  | "match"
  | "round"
  | "candidate_ticket";

/** 関係の種類。 */
export type MarketRelationType =
  | "same_direction"
  | "opposite_direction"
  | "leader_follower"
  | "weak_signal"
  | "causal"
  | "manual";

/** 市場ノード同士、または市場ノードと toto 側エンティティの関係。 */
export type MarketRelation = {
  id: string;
  sourceMarketNodeId: string;
  targetType: MarketRelationTargetType;
  targetId: string | null;
  relationType: MarketRelationType;
  /** 先行指標としての想定ラグ（時間）。不明なら null。 */
  expectedLagHours: number | null;
  confidence: MarketDataConfidence;
  rationale: string | null;
  createdAt: string;
  updatedAt: string;
};

/** Strong-account / trader source. Read-only observation only. */
export type TraderSignalSource = "polymarket";

/** A watched public trader/account signal. This is not an execution account. */
export type TraderSignal = {
  id: string;
  source: TraderSignalSource;
  /** Public proxy address used by the external source. */
  address: string;
  displayName: string | null;
  pseudonym: string | null;
  profileImageUrl: string | null;
  profileUrl: string | null;
  category: string | null;
  timePeriod: string | null;
  rank: number | null;
  pnl: number | null;
  volume: number | null;
  currentValue: number | null;
  predictionCount: number | null;
  biggestWin: number | null;
  biggestWinTitle: string | null;
  lastActivityAt: string | null;
  observedAt: string;
  dataConfidence: MarketDataConfidence;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
};

export type TraderMarketSignalDirection =
  | "supports_outcome"
  | "opposes_outcome"
  | "unknown";

/** A trader's public read-only footprint in one external market. */
export type TraderMarketSignal = {
  id: string;
  traderSignalId: string;
  source: TraderSignalSource;
  address: string;
  title: string;
  slug: string | null;
  eventSlug: string | null;
  outcome: string | null;
  side: string | null;
  price: number | null;
  size: number | null;
  usdcSize: number | null;
  currentValue: number | null;
  cashPnl: number | null;
  initialValue: number | null;
  timestamp: string | null;
  conditionId: string | null;
  asset: string | null;
  signalDirection: TraderMarketSignalDirection;
  observedAt: string;
  createdAt: string;
  updatedAt: string;
};

/**
 * marketType ごとの既定 weight。
 *
 * spec:
 *   outright_champion = 0.20
 *   group (winner/qualification) = 0.50
 *   individual_match_1x2 = 1.00
 *   player_availability = 0.30
 */
export const DEFAULT_MARKET_WEIGHTS: Record<MarketType, number> = {
  outright_champion: 0.2,
  group_winner: 0.5,
  group_qualification: 0.5,
  individual_match_1x2: 1.0,
  player_availability: 0.3,
  injury_news: 0.3,
  manual_signal: 0.5,
};

/** marketType に対する既定 weight を返す。 */
export function defaultWeightForMarketType(marketType: MarketType): number {
  return DEFAULT_MARKET_WEIGHTS[marketType] ?? 0.5;
}

/** marketType に対する既定の signalLayer を返す。 */
export function defaultSignalLayerForMarketType(marketType: MarketType): SignalLayer {
  switch (marketType) {
    case "outright_champion":
      return "upstream_team_prior";
    case "group_winner":
    case "group_qualification":
      return "midstream_group_signal";
    case "individual_match_1x2":
      return "downstream_match_signal";
    case "player_availability":
    case "injury_news":
      return "news_signal";
    case "manual_signal":
    default:
      return "manual_signal";
  }
}

/** UI 表示用の marketType 日本語ラベル。 */
export const MARKET_TYPE_LABEL: Record<MarketType, string> = {
  outright_champion: "優勝市場",
  group_winner: "グループ首位市場",
  group_qualification: "グループ突破市場",
  individual_match_1x2: "個別試合 1X2",
  player_availability: "選手出場市場",
  injury_news: "怪我/招集ニュース",
  manual_signal: "手入力シグナル",
};

/** UI 表示用の signalLayer 日本語ラベル。 */
export const SIGNAL_LAYER_LABEL: Record<SignalLayer, string> = {
  upstream_team_prior: "上流シグナル（チーム地力）",
  midstream_group_signal: "中流シグナル（グループ）",
  downstream_match_signal: "下流シグナル（個別試合）",
  news_signal: "ニュースシグナル",
  manual_signal: "手入力シグナル",
};

/** UI 表示用の source 日本語ラベル。 */
export const MARKET_SOURCE_LABEL: Record<MarketSource, string> = {
  polymarket: "Polymarket",
  hyperliquid: "Hyperliquid",
  bookmaker: "Bookmaker",
  manual: "手入力",
};

/**
 * Hyperliquid の UI slug と API coin 名の対応表エントリ。
 *
 * UI の slug（例: 2026-world-cup-champion-france-yes）と、API の coin 名は
 * 一致しない可能性があるため、明示的な mapping を持つ。最初は手入力で良い。
 */
export const TRADER_SIGNAL_SOURCE_LABEL: Record<TraderSignalSource, string> = {
  polymarket: "Polymarket",
};

export type HyperliquidSymbolMapping = {
  slug: string;
  coin: string;
  /** builder/perp dex の識別子（あれば）。 */
  dex: string | null;
  sourceUrl: string;
  notes: string | null;
};
