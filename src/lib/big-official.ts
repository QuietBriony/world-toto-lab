export type BigEventType = "carryover_event" | "high_return_watch";

export type BigCarryoverSummary = {
  approxEvMultiple: number | null;
  breakEvenCarryoverYen: number | null;
  breakEvenGapYen: number | null;
  carryoverUplift: number | null;
  expectedProfitYen: number | null;
  overBreakEven: number | null;
  overReturnRate: number | null;
};

export type BigCarryoverEventSnapshot = {
  headline: string;
  nextAction: string;
  statusLabel: string;
  status: "missing" | "near_break_even" | "plus_ev" | "watch";
  tone: "info" | "positive" | "warning";
};

export type BigHeatBand = {
  badgeTone: "info" | "positive" | "warning";
  hint: string;
  label: string;
};

export function formatBigCarryoverDisplay(value: number | null | undefined) {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return "—";
  }

  if (value <= 0) {
    return "なし";
  }

  return `${value.toLocaleString("ja-JP")}円`;
}

function isKnownPositiveNumber(value: number | null | undefined): value is number {
  return typeof value === "number" && Number.isFinite(value) && value > 0;
}

function isKnownNumber(value: number | null | undefined): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function calculateBigCarryoverSummary(input: {
  carryoverYen: number | null;
  returnRate: number;
  salesYen: number | null;
  spendYen: number | null;
}): BigCarryoverSummary {
  const salesYen = isKnownPositiveNumber(input.salesYen) ? input.salesYen : null;
  const carryoverYen = isKnownNumber(input.carryoverYen) ? input.carryoverYen : null;
  const spendYen = isKnownNumber(input.spendYen) ? input.spendYen : null;
  const returnRate = isKnownNumber(input.returnRate) ? input.returnRate : 0.5;

  if (salesYen === null || carryoverYen === null) {
    return {
      approxEvMultiple: null,
      breakEvenCarryoverYen: salesYen !== null ? salesYen * (1 - returnRate) : null,
      breakEvenGapYen: null,
      carryoverUplift: null,
      expectedProfitYen: null,
      overBreakEven: null,
      overReturnRate: null,
    };
  }

  const carryoverUplift = carryoverYen / salesYen;
  const approxEvMultiple = returnRate + carryoverUplift;
  const breakEvenCarryoverYen = salesYen * (1 - returnRate);
  const breakEvenGapYen = carryoverYen - breakEvenCarryoverYen;
  const overBreakEven = approxEvMultiple - 1;
  const overReturnRate = approxEvMultiple - returnRate;
  const expectedProfitYen =
    spendYen !== null ? spendYen * (approxEvMultiple - 1) : null;

  return {
    approxEvMultiple,
    breakEvenCarryoverYen,
    breakEvenGapYen,
    carryoverUplift,
    expectedProfitYen,
    overBreakEven,
    overReturnRate,
  };
}

function buildBigCarryoverEventSnapshot(input: {
  eventLabel: string;
  eventType: BigEventType;
  summary: BigCarryoverSummary;
}): BigCarryoverEventSnapshot {
  const label = input.eventLabel.trim() || "BIG";

  if (input.summary.approxEvMultiple === null) {
    return {
      headline: `${label} の材料がまだ足りません`,
      nextAction: "売上とキャリーが揃ったら、もう一度 snapshot を更新します。",
      statusLabel: "入力待ち",
      status: "missing",
      tone: "info",
    };
  }

  if (input.summary.approxEvMultiple >= 1) {
    return {
      headline: `${label} はプラス期待値圏です`,
      nextAction:
        input.eventType === "carryover_event"
          ? "売上の伸びで薄まる前に、次のキャリー更新と売上推移を続けて確認します。"
          : "高還元ウォッチとして、売上急増で期待値が崩れていないかを見張ります。",
      statusLabel: "プラス圏",
      status: "plus_ev",
      tone: "positive",
    };
  }

  if (input.summary.overBreakEven !== null && input.summary.overBreakEven >= -0.08) {
    return {
      headline: `${label} は損益分岐にかなり近いです`,
      nextAction:
        input.eventType === "carryover_event"
          ? "あと少しのキャリー積み増しか売上減速で分岐を超えるので、更新頻度を上げて監視します。"
          : "売上の鈍化や還元率条件の変化があれば、一気にプラス圏へ寄る可能性があります。",
      statusLabel: "分岐付近",
      status: "near_break_even",
      tone: "warning",
    };
  }

  if (input.eventType === "high_return_watch" && input.summary.carryoverUplift === 0) {
    return {
      headline: `${label} はキャリーなしの平時回です`,
      nextAction: "キャリー発生や特別回の告知が出るまでは、通常還元の監視メモとして見ます。",
      statusLabel: "キャリーなし",
      status: "watch",
      tone: "info",
    };
  }

  return {
    headline: `${label} はまだ監視段階です`,
    nextAction:
      input.eventType === "carryover_event"
        ? "キャリーがどれだけ積み上がるか、損益分岐との差分を追いかけます。"
        : "高還元ウォッチとして、売上見込みと話題回の勢いを比較しながら様子見します。",
    statusLabel: "監視中",
    status: "watch",
    tone: "info",
  };
}

function classifyBigHeatBand(summary: BigCarryoverSummary): BigHeatBand {
  if (summary.approxEvMultiple === null) {
    return {
      badgeTone: "info",
      hint: "売上とキャリーが揃うと、ここで一次判定できます。",
      label: "入力待ち",
    };
  }

  if (summary.approxEvMultiple >= 1) {
    return {
      badgeTone: "positive",
      hint: "平時還元を超えていて、概算ではプラス圏です。",
      label: "期待値大",
    };
  }

  if (summary.overBreakEven !== null && summary.overBreakEven >= -0.08) {
    return {
      badgeTone: "warning",
      hint: "あと少しのキャリー増や売上減速で分岐を超える近さです。",
      label: "分岐付近",
    };
  }

  return {
    badgeTone: "info",
    hint: "まだ監視段階ですが、比較材料として残す価値があります。",
    label: "監視中",
  };
}

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
