import {
  buildBigCarryoverEventSnapshot,
  calculateBigCarryoverSummary,
  classifyBigHeatBand,
  type BigCarryoverEventSnapshot,
  type BigCarryoverSummary,
  type BigEventType,
  type BigHeatBand,
} from "./big-carryover";

export type BigOfficialProductKey =
  | "big"
  | "mega_big"
  | "hyakuen_big"
  | "big1000"
  | "mini_big";

export type BigOfficialSnapshot = {
  carryoverYen: number;
  fetchedAt: string | null;
  officialRoundName: string | null;
  officialRoundNumber: number | null;
  productKey: BigOfficialProductKey;
  productLabel: string;
  resultDate: string | null;
  returnRate: number;
  salesEndAt: string | null;
  salesStartAt: string | null;
  snapshotAt: string | null;
  sourceText: string;
  sourceUrl: string;
  stakeYen: number;
  totalSalesYen: number | null;
};

export type BigOfficialSyncPayload = {
  fetchedAt: string | null;
  snapshots: BigOfficialSnapshot[];
  sourceUrl: string;
  warnings: string[];
};

export type BigOfficialWatch = {
  eventSnapshot: BigCarryoverEventSnapshot;
  eventType: BigEventType;
  heatBand: BigHeatBand;
  label: string;
  snapshot: BigOfficialSnapshot;
  summary: BigCarryoverSummary;
};

export const bigOfficialDefaultSourceUrl =
  "https://store.toto-dream.com/dcs/subos/screen/pi02/spin005/PGSPIN00501InitBIGLotInfo.form";

export const bigOfficialProductLabel: Record<BigOfficialProductKey, string> = {
  big: "BIG",
  mega_big: "MEGA BIG",
  hyakuen_big: "100円BIG",
  big1000: "BIG1000",
  mini_big: "mini BIG",
};

const bigOfficialProductStakeYen: Record<BigOfficialProductKey, number> = {
  big: 300,
  mega_big: 300,
  hyakuen_big: 100,
  big1000: 200,
  mini_big: 200,
};

const anchorToProductKey: Record<string, BigOfficialProductKey> = {
  BIG: "big",
  MegaBig: "mega_big",
  HyakuenBig: "hyakuen_big",
  BIG1000: "big1000",
  miniBIG: "mini_big",
};

function decodeBasicHtmlEntities(value: string) {
  return value
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&#39;/g, "'")
    .replace(/&quot;/gi, '"');
}

function stripHtmlToText(value: string) {
  return decodeBasicHtmlEntities(
    value
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<\/(?:p|div|tr|table|tbody|thead|section|li|ul|ol|h[1-6]|td|th)>/gi, "\n")
      .replace(/<[^>]+>/g, " "),
  )
    .replace(/\u3000/g, " ")
    .replace(/\r/g, "")
    .split("\n")
    .map((line) => line.replace(/\s+/g, " ").trim())
    .filter(Boolean)
    .join("\n");
}

function parseYenAmount(value: string | null) {
  if (!value || value === "-") {
    return 0;
  }

  const parsed = Number(value.replace(/[^\d.-]/g, ""));
  return Number.isFinite(parsed) ? parsed : 0;
}

function parseRoundNumber(value: string | null) {
  const match = value?.match(/第\s*(\d+)\s*回/);
  if (!match) {
    return null;
  }

  const parsed = Number.parseInt(match[1] ?? "", 10);
  return Number.isFinite(parsed) ? parsed : null;
}

function parseJapaneseDate(value: string | null) {
  const match = value?.match(/(\d{4})年(\d{2})月(\d{2})日/);
  if (!match) {
    return null;
  }

  return `${match[1]}-${match[2]}-${match[3]}`;
}

function parseJapaneseDateTime(value: string | null) {
  const match = value?.match(/(\d{4})年(\d{2})月(\d{2})日.*?(\d{1,2})時(\d{2})分/);
  if (!match) {
    return null;
  }

  const hours = String(match[4] ?? "").padStart(2, "0");
  return `${match[1]}-${match[2]}-${match[3]}T${hours}:${match[5]}:00+09:00`;
}

function extractFirstMatch(text: string, pattern: RegExp) {
  const match = text.match(pattern);
  return match?.[1]?.trim() ?? null;
}

function buildSnapshotFromBlock(input: {
  blockHtml: string;
  fetchedAt: string | null;
  productKey: BigOfficialProductKey;
  sourceUrl: string;
}) {
  const text = stripHtmlToText(input.blockHtml);
  const productLabel = bigOfficialProductLabel[input.productKey];
  const roundTitle =
    extractFirstMatch(
      text,
      /((?:第\s*\d+\s*回)\s*(?:MEGA BIG|100円BIG|BIG1000|mini BIG|BIG)\s*くじ情報)/u,
    ) ?? null;

  return {
    carryoverYen: parseYenAmount(
      extractFirstMatch(text, /前開催回からの繰越金\s*（キャリーオーバー）\s*([0-9,]+円|-)/u),
    ),
    fetchedAt: input.fetchedAt,
    officialRoundName: roundTitle,
    officialRoundNumber: parseRoundNumber(roundTitle),
    productKey: input.productKey,
    productLabel,
    resultDate: parseJapaneseDate(
      extractFirstMatch(text, /結果発表日\s*(\d{4}年\d{2}月\d{2}日（[^）]+）)/u),
    ),
    returnRate: 0.5,
    salesEndAt: parseJapaneseDate(
      extractFirstMatch(text, /販売終了日\s*(\d{4}年\d{2}月\d{2}日（[^）]+）)/u),
    ),
    salesStartAt: parseJapaneseDate(
      extractFirstMatch(text, /販売開始日\s*(\d{4}年\d{2}月\d{2}日（[^）]+）)/u),
    ),
    snapshotAt: parseJapaneseDateTime(
      extractFirstMatch(text, /\((\d{4}年\d{2}月\d{2}日（[^）]+）\d{1,2}時\d{2}分時点)\)/u),
    ),
    sourceText: text,
    sourceUrl: input.sourceUrl,
    stakeYen: bigOfficialProductStakeYen[input.productKey],
    totalSalesYen: parseYenAmount(
      extractFirstMatch(text, /売上金額\s*([0-9,]+円|-)/u),
    ),
  } satisfies BigOfficialSnapshot;
}

export function parseBigOfficialWatchHtml(input: {
  fetchedAt?: string | null;
  html: string;
  sourceUrl?: string;
}) {
  const sourceUrl = input.sourceUrl?.trim() || bigOfficialDefaultSourceUrl;
  const warnings: string[] = [];
  const sections: Array<{
    html: string;
    productKey: BigOfficialProductKey;
  }> = [];
  const anchorPattern = /<a\s+name="(BIG|MegaBig|HyakuenBig|BIG1000|miniBIG)"[^>]*><\/a>/gi;
  const matches = Array.from(input.html.matchAll(anchorPattern));

  matches.forEach((match, index) => {
    const anchor = match[1] ?? "";
    const productKey = anchorToProductKey[anchor];
    const start = match.index ?? 0;
    const end = index + 1 < matches.length ? matches[index + 1]?.index ?? input.html.length : input.html.length;
    if (!productKey) {
      return;
    }
    sections.push({
      html: input.html.slice(start, end),
      productKey,
    });
  });

  if (sections.length === 0) {
    warnings.push("BIG公式ページから商品ブロックを抽出できませんでした。");
  }

  const snapshots = sections
    .map((section) =>
      buildSnapshotFromBlock({
        blockHtml: section.html,
        fetchedAt: input.fetchedAt ?? null,
        productKey: section.productKey,
        sourceUrl,
      }),
    )
    .filter((snapshot) => {
      const hasCoreFields =
        snapshot.officialRoundNumber !== null &&
        snapshot.totalSalesYen !== null &&
        snapshot.sourceText.length > 0;
      if (!hasCoreFields) {
        warnings.push(`${snapshot.productLabel} の商品情報を十分に抽出できなかったためスキップしました。`);
      }
      return hasCoreFields;
    });

  return {
    fetchedAt: input.fetchedAt ?? null,
    snapshots,
    sourceUrl,
    warnings,
  } satisfies BigOfficialSyncPayload;
}

export function buildBigOfficialWatch(
  snapshot: BigOfficialSnapshot,
  options: {
    spendYen?: number;
  } = {},
) {
  const eventType: BigEventType =
    snapshot.carryoverYen > 0 ? "carryover_event" : "high_return_watch";
  const label = snapshot.officialRoundName ?? snapshot.productLabel;
  const summary = calculateBigCarryoverSummary({
    carryoverYen: snapshot.carryoverYen,
    returnRate: snapshot.returnRate,
    salesYen: snapshot.totalSalesYen,
    spendYen: options.spendYen ?? 10_000,
  });
  const heatBand = classifyBigHeatBand(summary);
  const eventSnapshot = buildBigCarryoverEventSnapshot({
    eventLabel: label,
    eventType,
    summary,
  });

  return {
    eventSnapshot,
    eventType,
    heatBand,
    label,
    snapshot,
    summary,
  } satisfies BigOfficialWatch;
}

export function pickFeaturedBigOfficialSnapshot(snapshots: BigOfficialSnapshot[]) {
  return snapshots
    .slice()
    .sort((left, right) => {
      const leftWatch = buildBigOfficialWatch(left);
      const rightWatch = buildBigOfficialWatch(right);
      const leftEv = leftWatch.summary.approxEvMultiple ?? -1;
      const rightEv = rightWatch.summary.approxEvMultiple ?? -1;
      if (leftEv !== rightEv) {
        return rightEv - leftEv;
      }

      if (left.carryoverYen !== right.carryoverYen) {
        return right.carryoverYen - left.carryoverYen;
      }

      return (right.totalSalesYen ?? 0) - (left.totalSalesYen ?? 0);
    })[0] ?? null;
}

export function buildBigCarryoverQueryFromOfficialSnapshot(
  snapshot: BigOfficialSnapshot,
  options: {
    spendYen?: number;
  } = {},
) {
  const watch = buildBigOfficialWatch(snapshot, options);

  return {
    carryover: snapshot.carryoverYen || undefined,
    eventType: watch.eventType,
    label: watch.label,
    returnRate: Math.round(snapshot.returnRate * 100),
    sales: snapshot.totalSalesYen ?? undefined,
    snapshotDate: (snapshot.snapshotAt ?? snapshot.salesStartAt ?? undefined)?.slice(0, 10),
    sourceUrl: snapshot.sourceUrl,
    spend: options.spendYen ?? 10_000,
  };
}
