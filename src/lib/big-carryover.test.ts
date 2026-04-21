import { describe, expect, it } from "vitest";

import {
  bigCarryoverPresets,
  buildBigCarryoverEventSnapshot,
  buildBigCarryoverScenarioRows,
  calculateBigCarryoverSummary,
  classifyBigHeatBand,
  normalizeBigEventType,
} from "@/lib/big-carryover";

describe("big carryover monitor", () => {
  it("calculates approximate EV from carryover and sales", () => {
    const summary = calculateBigCarryoverSummary({
      carryoverYen: 6_000_000_000,
      returnRate: 0.5,
      salesYen: 8_000_000_000,
      spendYen: 10_000,
    });

    expect(summary.carryoverUplift).toBe(0.75);
    expect(summary.approxEvMultiple).toBe(1.25);
    expect(summary.overBreakEven).toBe(0.25);
    expect(summary.expectedProfitYen).toBe(2_500);
  });

  it("calculates break-even carryover gap", () => {
    const summary = calculateBigCarryoverSummary({
      carryoverYen: 3_200_000_000,
      returnRate: 0.5,
      salesYen: 7_000_000_000,
      spendYen: 50_000,
    });

    expect(summary.breakEvenCarryoverYen).toBe(3_500_000_000);
    expect(summary.breakEvenGapYen).toBe(-300_000_000);
  });

  it("builds scenario rows from the approximate EV multiple", () => {
    const rows = buildBigCarryoverScenarioRows({
      approxEvMultiple: 1.12,
      spendOptionsYen: [1_000, 5_000],
    });

    expect(rows).toEqual([
      { expectedProfitYen: 120, spendYen: 1_000 },
      { expectedProfitYen: 600, spendYen: 5_000 },
    ]);
  });

  it("supports a smaller default scenario ladder for high-return watch mode", () => {
    const rows = buildBigCarryoverScenarioRows({
      approxEvMultiple: 1.05,
      eventType: "high_return_watch",
    });

    expect(rows.map((row) => row.spendYen)).toEqual([1_000, 5_000, 10_000, 30_000]);
  });

  it("builds an event snapshot headline from the current EV state", () => {
    const summary = calculateBigCarryoverSummary({
      carryoverYen: 6_000_000_000,
      returnRate: 0.5,
      salesYen: 8_000_000_000,
      spendYen: 10_000,
    });
    const snapshot = buildBigCarryoverEventSnapshot({
      eventLabel: "BIG 話題回",
      eventType: "carryover_event",
      summary,
    });

    expect(snapshot.status).toBe("plus_ev");
    expect(snapshot.headline).toContain("プラス期待値圏");
  });

  it("normalizes unknown event types to carryover_event", () => {
    expect(normalizeBigEventType("high_return_watch")).toBe("high_return_watch");
    expect(normalizeBigEventType("other")).toBe("carryover_event");
  });

  it("classifies heat bands from the summary", () => {
    const plusBand = classifyBigHeatBand(
      calculateBigCarryoverSummary({
        carryoverYen: 6_000_000_000,
        returnRate: 0.5,
        salesYen: 8_000_000_000,
        spendYen: 10_000,
      }),
    );
    const watchBand = classifyBigHeatBand(
      calculateBigCarryoverSummary({
        carryoverYen: 1_000_000_000,
        returnRate: 0.5,
        salesYen: 8_000_000_000,
        spendYen: 10_000,
      }),
    );

    expect(plusBand.label).toBe("期待値大");
    expect(watchBand.label).toBe("監視中");
  });

  it("provides reusable presets for common BIG watch scenarios", () => {
    expect(bigCarryoverPresets).toHaveLength(3);
    expect(bigCarryoverPresets[0]?.eventLabel).toBe("BIG 分岐ライン確認");
    expect(bigCarryoverPresets[1]?.eventType).toBe("carryover_event");
    expect(bigCarryoverPresets[2]?.eventType).toBe("high_return_watch");
  });
});
