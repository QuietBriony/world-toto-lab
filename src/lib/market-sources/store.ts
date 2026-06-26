/**
 * Market Source の永続化（ブラウザ localStorage、独立 namespace）。
 *
 * 設計方針:
 * - 既存の StorageAdapter / repository / Supabase / D1 スキーマには一切触れない。
 *   MarketNode / MarketRelation は read-only 分析用のクライアント側アーティファクトとして、
 *   専用の localStorage キーに保存する（既存機能を壊さない追加方式）。
 * - SSR / static export 安全のため、window が無い環境では空配列を返し書き込みは破棄する。
 */
import type {
  MarketNode,
  MarketRelation,
  TraderMarketSignal,
  TraderSignal,
} from "@/lib/market-sources/types";

const NAMESPACE = "world-toto-lab:market-sources:v1";

const KEYS = {
  nodes: `${NAMESPACE}:nodes`,
  relations: `${NAMESPACE}:relations`,
  traderMarketSignals: `${NAMESPACE}:trader-market-signals`,
  traderSignals: `${NAMESPACE}:trader-signals`,
} as const;

function nowIso(): string {
  return new Date().toISOString();
}

function localId(prefix: string): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function readArray<T>(key: string): T[] {
  if (typeof window === "undefined" || typeof window.localStorage === "undefined") {
    return [];
  }
  const raw = window.localStorage.getItem(key);
  if (!raw) {
    return [];
  }
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as T[]) : [];
  } catch {
    return [];
  }
}

function writeArray<T>(key: string, rows: T[]): void {
  if (typeof window === "undefined" || typeof window.localStorage === "undefined") {
    return;
  }
  window.localStorage.setItem(key, JSON.stringify(rows));
}

// --- MarketNode ---------------------------------------------------------------

export function listMarketNodes(): MarketNode[] {
  return readArray<MarketNode>(KEYS.nodes);
}

export function getMarketNode(id: string): MarketNode | null {
  return listMarketNodes().find((node) => node.id === id) ?? null;
}

/** ノードを upsert（id 一致で置換、無ければ追加）。updatedAt を更新する。 */
export function saveMarketNode(node: MarketNode): MarketNode {
  const nodes = listMarketNodes();
  const timestamp = nowIso();
  const next: MarketNode = {
    ...node,
    id: node.id || localId("market-node"),
    createdAt: node.createdAt || timestamp,
    updatedAt: timestamp,
  };
  const index = nodes.findIndex((entry) => entry.id === next.id);
  if (index >= 0) {
    nodes[index] = next;
  } else {
    nodes.push(next);
  }
  writeArray(KEYS.nodes, nodes);
  return next;
}

/** ノードの一部フィールドを更新する。存在しなければ null。 */
export function updateMarketNode(
  id: string,
  patch: Partial<Omit<MarketNode, "id" | "createdAt">>,
): MarketNode | null {
  const nodes = listMarketNodes();
  const index = nodes.findIndex((entry) => entry.id === id);
  if (index < 0) {
    return null;
  }
  const updated: MarketNode = {
    ...nodes[index],
    ...patch,
    id,
    createdAt: nodes[index].createdAt,
    updatedAt: nowIso(),
  };
  nodes[index] = updated;
  writeArray(KEYS.nodes, nodes);
  return updated;
}

export function deleteMarketNode(id: string): void {
  const nodes = listMarketNodes().filter((node) => node.id !== id);
  writeArray(KEYS.nodes, nodes);
}

// --- MarketRelation -----------------------------------------------------------

export function listMarketRelations(): MarketRelation[] {
  return readArray<MarketRelation>(KEYS.relations);
}

export function saveMarketRelation(relation: MarketRelation): MarketRelation {
  const relations = listMarketRelations();
  const timestamp = nowIso();
  const next: MarketRelation = {
    ...relation,
    id: relation.id || localId("market-relation"),
    createdAt: relation.createdAt || timestamp,
    updatedAt: timestamp,
  };
  const index = relations.findIndex((entry) => entry.id === next.id);
  if (index >= 0) {
    relations[index] = next;
  } else {
    relations.push(next);
  }
  writeArray(KEYS.relations, relations);
  return next;
}

export function deleteMarketRelation(id: string): void {
  const relations = listMarketRelations().filter((relation) => relation.id !== id);
  writeArray(KEYS.relations, relations);
}

// --- TraderSignal -------------------------------------------------------------

export function listTraderSignals(): TraderSignal[] {
  return readArray<TraderSignal>(KEYS.traderSignals);
}

export function getTraderSignal(id: string): TraderSignal | null {
  return listTraderSignals().find((signal) => signal.id === id) ?? null;
}

export function saveTraderSignal(signal: TraderSignal): TraderSignal {
  const signals = listTraderSignals();
  const timestamp = nowIso();
  const next: TraderSignal = {
    ...signal,
    id: signal.id || localId("trader-signal"),
    createdAt: signal.createdAt || timestamp,
    updatedAt: timestamp,
  };
  const index = signals.findIndex((entry) => entry.id === next.id);
  if (index >= 0) {
    signals[index] = next;
  } else {
    signals.push(next);
  }
  writeArray(KEYS.traderSignals, signals);
  return next;
}

export function updateTraderSignal(
  id: string,
  patch: Partial<Omit<TraderSignal, "id" | "createdAt">>,
): TraderSignal | null {
  const signals = listTraderSignals();
  const index = signals.findIndex((entry) => entry.id === id);
  if (index < 0) {
    return null;
  }
  const updated: TraderSignal = {
    ...signals[index],
    ...patch,
    id,
    createdAt: signals[index].createdAt,
    updatedAt: nowIso(),
  };
  signals[index] = updated;
  writeArray(KEYS.traderSignals, signals);
  return updated;
}

export function deleteTraderSignal(id: string): void {
  const signals = listTraderSignals().filter((signal) => signal.id !== id);
  const marketSignals = listTraderMarketSignals().filter(
    (signal) => signal.traderSignalId !== id,
  );
  writeArray(KEYS.traderSignals, signals);
  writeArray(KEYS.traderMarketSignals, marketSignals);
}

// --- TraderMarketSignal -------------------------------------------------------

export function listTraderMarketSignals(): TraderMarketSignal[] {
  return readArray<TraderMarketSignal>(KEYS.traderMarketSignals);
}

export function saveTraderMarketSignal(signal: TraderMarketSignal): TraderMarketSignal {
  const signals = listTraderMarketSignals();
  const timestamp = nowIso();
  const next: TraderMarketSignal = {
    ...signal,
    id: signal.id || localId("trader-market-signal"),
    createdAt: signal.createdAt || timestamp,
    updatedAt: timestamp,
  };
  const index = signals.findIndex((entry) => entry.id === next.id);
  if (index >= 0) {
    signals[index] = next;
  } else {
    signals.push(next);
  }
  writeArray(KEYS.traderMarketSignals, signals);
  return next;
}

export function deleteTraderMarketSignal(id: string): void {
  const signals = listTraderMarketSignals().filter((signal) => signal.id !== id);
  writeArray(KEYS.traderMarketSignals, signals);
}

/** テスト/リセット用。保存済みの市場データを全消去する。 */
export function clearMarketSources(): void {
  writeArray(KEYS.nodes, []);
  writeArray(KEYS.relations, []);
  writeArray(KEYS.traderMarketSignals, []);
  writeArray(KEYS.traderSignals, []);
}

/** localStorage キー（デバッグ/テスト参照用）。 */
export const MARKET_SOURCE_STORAGE_KEYS = KEYS;
