import type { ProductRule, ProductType, VoidHandling } from "@/lib/types";

const DEFAULT_OUTCOME_SET = ["1", "0", "2"] as const;

export const productTypeLabel: Record<ProductType, string> = {
  toto13: "toto",
  mini_toto: "mini toto",
  winner: "WINNER",
  custom: "カスタム",
};

export const productTypeOptions: ProductType[] = [
  "toto13",
  "mini_toto",
  "winner",
  "custom",
];

export const primaryProductTypeOptions: ProductType[] = ["toto13", "mini_toto"];

export const voidHandlingLabel: Record<VoidHandling, string> = {
  manual: "要公式確認",
  all_outcomes_valid: "全 outcome 有効",
  exclude_from_combo: "組み合わせから除外",
  keep_as_pending: "保留のまま維持",
};

export const voidHandlingOptions: VoidHandling[] = [
  "manual",
  "all_outcomes_valid",
  "exclude_from_combo",
  "keep_as_pending",
];

export function defaultRequiredMatchCount(productType: ProductType) {
  if (productType === "toto13") {
    return 13;
  }

  if (productType === "mini_toto") {
    return 5;
  }

  if (productType === "winner") {
    return 1;
  }

  return null;
}

export function defaultOutcomeSetForProductType() {
  return [...DEFAULT_OUTCOME_SET];
}

export function normalizeRequiredMatchCount(
  productType: ProductType,
  requestedCount?: number | null,
) {
  const fixed = defaultRequiredMatchCount(productType);
  if (fixed !== null) {
    return fixed;
  }

  if (requestedCount === null || requestedCount === undefined || Number.isNaN(requestedCount)) {
    return null;
  }

  return Math.min(Math.max(Math.floor(requestedCount), 1), 20);
}

export function normalizeOutcomeSet(
  _productType: ProductType,
  outcomeSet?: string[] | null,
) {
  const base = outcomeSet?.map((value) => value.trim()).filter(Boolean) ?? [];
  if (base.length > 0) {
    return Array.from(new Set(base));
  }

  return defaultOutcomeSetForProductType();
}

export function buildProductRule(input: {
  outcomeSetJson?: string[] | null;
  productType: ProductType;
  requiredMatchCount?: number | null;
  voidHandling?: VoidHandling | null;
}): ProductRule {
  return {
    outcomeSetJson: normalizeOutcomeSet(input.productType, input.outcomeSetJson),
    productType: input.productType,
    requiredMatchCount: normalizeRequiredMatchCount(
      input.productType,
      input.requiredMatchCount,
    ),
    voidHandling: input.voidHandling ?? "manual",
  };
}
