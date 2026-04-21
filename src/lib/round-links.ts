import type { ProductType } from "@/lib/types";

type QueryValue = number | null | string | undefined;

function appendQuery(params: URLSearchParams, key: string, value: QueryValue) {
  if (value === null || value === undefined || value === "") {
    return;
  }

  params.set(key, String(value));
}

export function buildHref(pathname: string, query: Record<string, QueryValue> = {}) {
  const params = new URLSearchParams();

  Object.entries(query).forEach(([key, value]) => appendQuery(params, key, value));

  const queryString = params.toString();
  return queryString ? `${pathname}?${queryString}` : pathname;
}

export function buildRoundHref(
  pathname: string,
  roundId?: string | null,
  query: Record<string, QueryValue> = {},
) {
  return buildHref(pathname, {
    round: roundId,
    ...query,
  });
}

export function getSingleSearchParam(value: string | null) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

export function buildOfficialRoundImportHref(
  roundId?: string | null,
  options: {
    autoApply?: boolean;
    autoSync?: boolean;
    productType?: ProductType;
    sourcePreset?: string;
  } = {},
) {
  return buildRoundHref(appRoute.totoOfficialRoundImport, roundId, {
    autoApply: options.autoApply ? 1 : undefined,
    autoSync: options.autoSync ? 1 : undefined,
    productType: options.productType,
    sourcePreset: options.sourcePreset,
  });
}

export const appRoute = {
  dashboard: "/",
  workspace: "/workspace",
  bigCarryover: "/big-carryover",
  goal3Value: "/goal3-value",
  simpleView: "/simple-view",
  pickRoom: "/pick-room",
  winnerValue: "/winner-value",
  picks: "/picks",
  scoutCards: "/scout-cards",
  consensus: "/consensus",
  edgeBoard: "/edge-board",
  ticketGenerator: "/ticket-generator",
  review: "/review",
  matchEditor: "/match-editor",
  officialScheduleImport: "/official-schedule-import",
  fixtureSelector: "/fixture-selector",
  totoOfficialRoundImport: "/toto-official-round-import",
} as const;
