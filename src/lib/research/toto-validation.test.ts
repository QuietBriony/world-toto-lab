import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import fixture from "../../../scripts/fixtures/toto-validation.synthetic.json";
import {
  summarizeTotoReturns,
  validateTotoPredictions,
  type TotoValidationPrediction,
  type TotoValidationProtocol,
  type TotoValidationReturn,
} from "./toto-validation";

const protocol: TotoValidationProtocol = fixture.protocol;
const prediction = fixture.predictions[0] as TotoValidationPrediction;
const returns = fixture.returns as TotoValidationReturn[];
const evaluate = (patch: Partial<TotoValidationPrediction> = {}) =>
  validateTotoPredictions(protocol, [{ ...prediction, ...patch }]);

describe("toto research probability audit (synthetic evidence only)", () => {
  it("matches hand-calculated multiclass scores and marks smaller losses as better", () => {
    const report = evaluate();
    expect(report.model).toEqual({ count: 1, logLoss: Math.log(2), brier: 0.38, accuracy: 1 });
    expect(report.marketComparison.baseline?.brier).toBeCloseTo(0.245);
    expect(report.marketComparison.deltaLogLoss).toBeCloseTo(Math.log(0.6 / 0.5));
    expect(report.officialComparison.deltaBrier).toBeCloseTo(0.38 - 0.14);
    expect(report.excludedCount).toBe(0);
  });

  it("compares each baseline only on its shared fixtures, with missingness visible", () => {
    const report = validateTotoPredictions(protocol, [
      prediction,
      { ...prediction, matchId: "synthetic-other", market: null, official: null, actualOutcome: "0" },
    ]);
    expect(report.model?.count).toBe(2);
    expect(report.marketComparison.count).toBe(1);
    expect(report.marketComparison.missingCount).toBe(1);
    expect(report.marketComparison.model?.logLoss).toBe(Math.log(2));
    expect(report.officialComparison.count).toBe(1);
    const absent = evaluate({ market: null, official: null });
    expect(absent.marketComparison.deltaLogLoss).toBeNull();
    expect(absent.officialComparison.baseline).toBeNull();
  });

  it("tracks calibration of the frozen selection and publicly unpopular outcomes", () => {
    const report = evaluate();
    expect(report.calibration.reduce((count, bin) => count + bin.count, 0)).toBe(3);
    expect(report.selectedCalibration.count).toBe(1);
    expect(report.selectedCalibration.bins[3]).toMatchObject({ count: 1, predicted: 0.3, observed: 0 });
    expect(report.publicLongshotCalibration.count).toBe(1);
    expect(evaluate({ selectedOutcome: "1" }).publicLongshotCalibration.count).toBe(0);
    expect(evaluate({ selectedOutcome: null }).selectedCalibration.count).toBe(0);
  });

  it("handles 0 and 1 probability boundaries with finite JSON scores", () => {
    const report = evaluate({ model: { "1": 0, "0": 1, "2": 0 }, selectedOutcome: "0" });
    expect(report.model?.logLoss).toBeCloseTo(-Math.log(1e-15));
    expect(report.model?.brier).toBe(2);
    expect(report.selectedCalibration.bins[9]).toMatchObject({ count: 1, predicted: 1, observed: 0 });
    expect(JSON.stringify(report)).not.toContain("Infinity");
  });

  it("uses the documented 1,0,2 tie order for top-choice accuracy", () => {
    expect(evaluate({ model: { "1": 0.5, "0": 0.5, "2": 0 } }).model?.accuracy).toBe(1);
  });

  it("excludes every duplicate canonical fixture even across two toto rounds", () => {
    const report = validateTotoPredictions(protocol, [prediction, { ...prediction, roundId: "other-round" }]);
    expect(report.evaluatedCount).toBe(0);
    expect(report.excluded.map((row) => row.reasons)).toEqual([["duplicate_fixture"], ["duplicate_fixture"]]);
    expect(report.model).toBeNull();
  });

  it("keeps unconfirmed results pending and separates invalid results", () => {
    const pending = evaluate({ actualOutcome: null, resultConfirmedAt: null });
    expect(pending).toMatchObject({ inputCount: 1, pendingCount: 1, evaluatedCount: 0, excludedCount: 0 });
    expect(evaluate({ actualOutcome: null }).excluded[0].reasons).toContain("invalid_result");
    expect(evaluate({ resultConfirmedAt: "2026-01-03T09:00:00Z" }).excluded[0].reasons).toContain("result_before_kickoff");
  });

  it.each([
    [{ latestInputAt: "2026-01-03T08:02:00Z" }, "input_after_prediction"],
    [{ savedAt: "2026-01-03T09:00:01Z" }, "prediction_after_decision"],
    [{ decisionAt: "2026-01-03T10:00:00Z" }, "decision_not_before_kickoff"],
    [{ savedAt: "2026-01-01T00:00:00Z" }, "rule_not_frozen_before_prediction"],
    [{ decisionAt: "2026-01-03T09:00:00" }, "invalid_timestamp"],
    [{ decisionAt: "2026-02-30T09:00:00Z" }, "invalid_timestamp"],
    [{ decisionAt: "2026-01-03T24:00:00Z" }, "invalid_timestamp"],
  ] as const)("rejects temporal contamination or ambiguous dates: %j", (patch, reason) => {
    const report = evaluate(patch);
    expect(report.excluded[0].reasons).toContain(reason);
    expect(report.evaluatedCount).toBe(0);
  });

  it("compares instants across timezone offsets and allows capture at the declared decision time", () => {
    expect(evaluate({ savedAt: "2026-01-03T18:00:00+09:00" }).evaluatedCount).toBe(1);
  });

  it.each([
    { "1": 50, "0": 30, "2": 20 },
    { "1": -0.1, "0": 0.9, "2": 0.2 },
    { "1": NaN, "0": 0.8, "2": 0.2 },
    { "1": 0.5, "0": 0.2, "2": 0.2 },
  ])("rejects probabilities rather than silently repairing them: %j", (model) => {
    expect(evaluate({ model }).excluded[0].reasons).toContain("invalid_model_probabilities");
  });

  it("rejects malformed optional sources instead of treating them as missing", () => {
    expect(evaluate({ market: { "1": 0.2, "0": 0.2, "2": 0.2 } }).excluded[0].reasons)
      .toContain("invalid_market_probabilities");
  });

  it.each(["model", "market", "official"] as const)("rejects numeric arrays masquerading as %s outcome records", (key) => {
    const patch = { [key]: [0.3, 0.5, 0.2] } as unknown as Partial<TotoValidationPrediction>;
    expect(evaluate(patch).excluded[0].reasons).toContain(`invalid_${key}_probabilities`);
  });

  it("rejects extra outcome keys rather than silently discarding them", () => {
    const model = { ...prediction.model, other: 0.1 };
    expect(evaluate({ model }).excluded[0].reasons).toContain("invalid_model_probabilities");
  });

  it.each(["matchId", "roundId"] as const)("rejects padded %s rather than counting it as a new identity", (key) => {
    expect(evaluate({ [key]: ` ${prediction[key]} ` }).excluded[0].reasons).toContain("invalid_identity");
  });

  it("requires training to precede the frozen rule version", () => {
    expect(() => validateTotoPredictions({ ...protocol, trainingDataThrough: protocol.frozenAt }, [prediction])).toThrow();
    expect(() => validateTotoPredictions({ ...protocol, ruleVersion: "" }, [prediction])).toThrow();
  });

  it("makes an empty cohort explicit", () => {
    const report = validateTotoPredictions(protocol, []);
    expect(report.model).toBeNull();
    expect(report.calibration.every((bin) => bin.predicted === null && bin.observed === null)).toBe(true);
  });
});

describe("toto round-level payout concentration", () => {
  it("separates actual-official and approximate settlements, including no-selection rounds", () => {
    const report = summarizeTotoReturns(returns);
    expect(report.all).toMatchObject({ roundCount: 3, stakedRoundCount: 2, returnRate: 1.5, costYen: 200 });
    expect(report.official.returnRate).toBe(0);
    expect(report.approximate.returnRate).toBe(3);
  });

  it("reports both payout-zeroing and whole-round exclusion without changing their denominators", () => {
    const report = summarizeTotoReturns([
      { roundId: "a", costYen: 100, payoutYen: 600, settlement: "official" },
      { roundId: "b", costYen: 100, payoutYen: 100, settlement: "official" },
      { roundId: "c", costYen: 100, payoutYen: 0, settlement: "official" },
      { roundId: "d", costYen: 100, payoutYen: 0, settlement: "official" },
    ]).all;
    expect(report.returnRate).toBe(1.75);
    expect(report.top1.payoutShare).toBeCloseTo(6 / 7);
    expect(report.top1.zeroedPayoutReturnRate).toBe(0.25);
    expect(report.top1.excludedRoundReturnRate).toBeCloseTo(1 / 3);
    expect(report.top3.zeroedPayoutReturnRate).toBe(0);
  });

  it("defines the top 1% using all staked rounds, rounded up", () => {
    const rows: TotoValidationReturn[] = Array.from({ length: 101 }, (_, index) => ({
      roundId: String(index), costYen: 100, payoutYen: index === 0 ? 1000 : 0, settlement: "official",
    }));
    expect(summarizeTotoReturns(rows).all.top1Percent.roundIds).toHaveLength(2);
  });

  it("returns null for zero-stake rates and zero-total payout shares", () => {
    expect(summarizeTotoReturns([]).all.returnRate).toBeNull();
    expect(summarizeTotoReturns([returns[2]]).all.returnRate).toBeNull();
    expect(summarizeTotoReturns([returns[0]]).all.top1.payoutShare).toBeNull();
    expect(summarizeTotoReturns([returns[0]]).all.top1.excludedRoundReturnRate).toBeNull();
  });

  it.each([
    [returns[0], returns[0]],
    [{ ...returns[0], costYen: -1 }],
    [{ ...returns[0], payoutYen: 0.5 }],
    [{ ...returns[0], costYen: 0, payoutYen: 100 }],
    [{ ...returns[0], costYen: Number.MAX_SAFE_INTEGER }, returns[1]],
    [{ ...returns[0], roundId: ` ${returns[0].roundId} ` }],
  ])("rejects double-counting or invalid settlement amounts: %j", (...rows) => {
    expect(() => summarizeTotoReturns(rows)).toThrow();
  });
});

describe("read-only research CLI", () => {
  it("runs the synthetic input and sets distinct failure codes for excluded or malformed input", () => {
    const directory = mkdtempSync(path.join(tmpdir(), "toto-validation-"));
    try {
      const inputPath = path.join(directory, "input.json");
      const run = (input: unknown) => {
        writeFileSync(inputPath, JSON.stringify(input));
        return spawnSync(process.execPath, ["scripts/validate-toto-research.mjs", inputPath], { encoding: "utf8" });
      };
      const valid = run(fixture);
      expect(valid.status, valid.stderr).toBe(0);
      expect(JSON.parse(valid.stdout)).toMatchObject({ assessment: "descriptive_only", profitability: "not_evaluated" });
      expect(JSON.parse(valid.stdout).predictions.evaluatedCount).toBe(1);
      const empty = run({ ...fixture, predictions: [], returns: [] });
      expect(empty.status, empty.stderr).toBe(0);
      expect(JSON.parse(empty.stdout)).toMatchObject({
        assessment: "descriptive_only", profitability: "not_evaluated", predictions: { evaluatedCount: 0, model: null },
      });
      const invalid = run({ ...fixture, predictions: [{ ...prediction, savedAt: "2026-01-04T00:00:00Z" }] });
      expect(invalid.status).toBe(2);
      expect(JSON.parse(invalid.stdout).predictions.excludedCount).toBe(1);
      expect(run({}).status).toBe(1);
      expect(readFileSync(inputPath, "utf8")).toBe("{}");
    } finally {
      rmSync(path.join(directory, "input.json"), { force: true });
      rmdirSync(directory);
    }
  });
});
