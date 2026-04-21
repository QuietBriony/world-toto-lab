export type BigEventType = "carryover_event" | "high_return_watch";

export type BigCarryoverInput = {
  carryoverYen: number | null;
  returnRate: number;
  salesYen: number | null;
  spendYen: number | null;
};

export type BigCarryoverSummary = {
  approxEvMultiple: number | null;
  breakEvenCarryoverYen: number | null;
  breakEvenGapYen: number | null;
  carryoverUplift: number | null;
  expectedProfitYen: number | null;
  overBreakEven: number | null;
  overReturnRate: number | null;
};

export const bigEventTypeLabel: Record<BigEventType, string> = {
  carryover_event: "キャリーイベント",
  high_return_watch: "高還元ウォッチ",
};

export const bigEventTypeDescription: Record<BigEventType, string> = {
  carryover_event: "大きなキャリーで平時よりどれだけアッパーかを見る管理モードです。",
  high_return_watch: "売上減速や還元上振れを見張る管理モードです。損益分岐までの距離を追います。",
};

export type BigCarryoverEventSnapshot = {
  headline: string;
  nextAction: string;
  statusLabel: string;
  status: "missing" | "near_break_even" | "plus_ev" | "watch";
  tone: "info" | "positive" | "warning";
};

function isKnownPositiveNumber(value: number | null | undefined): value is number {
  return typeof value === "number" && Number.isFinite(value) && value > 0;
}

function isKnownNumber(value: number | null | undefined): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

export function calculateBigCarryoverSummary(
  input: BigCarryoverInput,
): BigCarryoverSummary {
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

export function buildBigCarryoverScenarioRows(input: {
  approxEvMultiple: number | null;
  eventType?: BigEventType;
  spendOptionsYen?: number[];
}) {
  const spendOptions =
    input.spendOptionsYen ??
    (input.eventType === "high_return_watch"
      ? [1_000, 5_000, 10_000, 30_000]
      : [1_000, 10_000, 50_000, 100_000]);

  return spendOptions.map((spendYen) => ({
    expectedProfitYen:
      input.approxEvMultiple !== null
        ? Math.round(spendYen * (input.approxEvMultiple - 1))
        : null,
    spendYen,
  }));
}

export function normalizeBigEventType(value: string | null | undefined): BigEventType {
  return value === "high_return_watch" ? "high_return_watch" : "carryover_event";
}

export function buildBigCarryoverEventSnapshot(input: {
  eventLabel: string;
  eventType: BigEventType;
  summary: BigCarryoverSummary;
}) : BigCarryoverEventSnapshot {
  const label = input.eventLabel.trim() || bigEventTypeLabel[input.eventType];

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
