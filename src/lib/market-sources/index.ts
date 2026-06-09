/**
 * Market Sources モジュールの入口。
 *
 * 提供するもの:
 * - 型と既定値（types）
 * - チーム名 EN↔JA マッチング（team-names）
 * - Hyperliquid アダプタ（read-only。売買・wallet・注文は無し）
 * - 上流シグナルのモデル反映（signal、±0.03 上限）
 * - データ品質警告（quality）
 * - localStorage 永続化（store、独立 namespace）
 * - Signal Board 集計（signal-board）
 */
export * from "@/lib/market-sources/types";
export * from "@/lib/market-sources/team-names";
export * from "@/lib/market-sources/hyperliquid";
export * from "@/lib/market-sources/signal";
export * from "@/lib/market-sources/quality";
export * from "@/lib/market-sources/store";
export * from "@/lib/market-sources/signal-board";
