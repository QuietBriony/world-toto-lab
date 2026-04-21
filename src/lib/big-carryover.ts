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

export type BigCarryoverPreset = {
  carryoverYen: number;
  description: string;
  eventLabel: string;
  eventType: BigEventType;
  id: string;
  returnRatePercent: number;
  salesYen: number;
  spendYen: number;
};

export type BigHeatBand = {
  badgeTone: "info" | "positive" | "warning";
  hint: string;
  label: string;
};

export const bigCarryoverPresets: BigCarryoverPreset[] = [
  {
    carryoverYen: 4_000_000_000,
    description: "売上 80億に対して 40億キャリー。分岐ラインを跨ぐかどうかの目安です。",
    eventLabel: "BIG 分岐ライン確認",
    eventType: "carryover_event",
    id: "break-even-check",
    returnRatePercent: 50,
    salesYen: 8_000_000_000,
    spendYen: 10_000,
  },
  {
    carryoverYen: 6_000_000_000,
    description: "かなり厚いキャリーが乗った話題回をざっくり再現します。",
    eventLabel: "BIG 激アツ仮定",
    eventType: "carryover_event",
    id: "hot-event",
    returnRatePercent: 50,
    salesYen: 8_000_000_000,
    spendYen: 10_000,
  },
  {
    carryoverYen: 3_200_000_000,
    description: "高還元ウォッチとして、あと一押しで分岐へ届く水準を見るテンプレです。",
    eventLabel: "BIG 高還元ウォッチ",
    eventType: "high_return_watch",
    id: "high-return-watch",
    returnRatePercent: 50,
    salesYen: 7_000_000_000,
    spendYen: 10_000,
  },
];

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
    if (input.summary.approxEvMultiple >= 1.7) {
      return {
        headline: `${label} は特大上振れ候補です`,
        nextAction:
          input.eventType === "carryover_event"
            ? "キャリーだけでなく、売上の急増や中止・成立条件の扱いまで追加で確認したい強い水準です。"
            : "売上・キャリー由来だけでもかなり強いので、特別回や成立条件の変化がないかを確認します。",
        statusLabel: "特大上振れ",
        status: "plus_ev",
        tone: "positive",
      };
    }

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

export function classifyBigHeatBand(summary: BigCarryoverSummary): BigHeatBand {
  if (summary.approxEvMultiple === null) {
    return {
      badgeTone: "info",
      hint: "売上とキャリーが揃うと、ここで一次判定できます。",
      label: "入力待ち",
    };
  }

  if (summary.approxEvMultiple >= 1.7) {
    return {
      badgeTone: "positive",
      hint: "かなり強い上振れです。売上の急増や成立条件の変更がないかを追加で確認したい水準です。",
      label: "特大上振れ候補",
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
