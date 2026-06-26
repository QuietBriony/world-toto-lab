import { describe, expect, it } from "vitest";

import {
  worldCupTotoBacktestRounds,
  worldCupTotoBacktestSummary,
  worldCupTotoInstructionSystem,
  worldCupTotoOptimizationReadiness,
  worldCupTotoOperatingSystemStatus,
  worldCupTotoUniverseBacktestRows,
} from "@/lib/world-cup-toto-backtest";

describe("world cup toto backtest", () => {
  it("turns the instruction history into an auditable operating system", () => {
    expect(worldCupTotoInstructionSystem.map((row) => row.id)).toEqual([
      "plain_answer_first",
      "deadline_snapshot",
      "model_public_split",
      "world_cup_context",
      "tier_ev",
      "backtest_loop",
      "strong_account_weighting",
    ]);
    expect(worldCupTotoOperatingSystemStatus.implementedCount).toBe(5);
    expect(worldCupTotoOperatingSystemStatus.nextCount).toBe(2);
    expect(worldCupTotoOperatingSystemStatus.summary).toContain("過去回");
  });

  it("replays known 1634 and 1635 results with the same portfolio evaluator", () => {
    const round1634 = worldCupTotoBacktestRounds.find((round) => round.roundNumber === 1634);
    const round1635 = worldCupTotoBacktestRounds.find((round) => round.roundNumber === 1635);

    expect(round1634?.actualSignature).toBe("0010001001211");
    expect(round1634?.publicFavoriteMisses).toBe(9);
    expect(round1634?.portfolios.find((portfolio) => portfolio.id === "round-1634-previous-positive-ev")?.bestMisses).toBe(3);
    expect(round1634?.portfolios.find((portfolio) => portfolio.id === "round-1634-previous-positive-ev")?.actualReturnYen).toBe(0);

    expect(round1635?.actualSignature).toBe("1111212011011");
    expect(round1635?.publicFavoriteMisses).toBe(2);
    expect(round1635?.portfolios[0]?.actualReturnYen).toBe(220);
    expect(round1635?.portfolios[0]?.realizedMultiple).toBe(2.2);
  });

  it("checks whether the phase-aware candidate universe contained known results", () => {
    const public1634 = worldCupTotoUniverseBacktestRows.find(
      (row) => row.roundNumber === 1634 && row.strategyKind === "public_favorite",
    );
    const phaseAware1634 = worldCupTotoUniverseBacktestRows.find(
      (row) => row.roundNumber === 1634 && row.strategyKind === "phase_aware",
    );
    const public1635 = worldCupTotoUniverseBacktestRows.find(
      (row) => row.roundNumber === 1635 && row.strategyKind === "public_favorite",
    );
    const phaseAware1635 = worldCupTotoUniverseBacktestRows.find(
      (row) => row.roundNumber === 1635 && row.strategyKind === "phase_aware",
    );

    expect(public1634?.bestMisses).toBe(9);
    expect(public1634?.actualIncluded).toBe(false);
    expect(phaseAware1634?.actualIncluded).toBe(true);
    expect(phaseAware1634?.universeLineCount).toBe(139_968);
    expect(phaseAware1634?.fullCoverageCostYen).toBe(13_996_800);

    expect(public1635?.bestMisses).toBe(2);
    expect(public1635?.actualIncluded).toBe(false);
    expect(phaseAware1635?.actualIncluded).toBe(true);
    expect(phaseAware1635?.universeLineCount).toBe(2_048);
    expect(phaseAware1635?.fullCoverageCostYen).toBe(204_800);
    expect(worldCupTotoOptimizationReadiness.candidateUniverseRows).toBe(4);
  });

  it("keeps the next optimization loop explicit", () => {
    expect(worldCupTotoBacktestSummary.knownResultRoundCount).toBe(2);
    expect(worldCupTotoBacktestSummary.lessons.join(" ")).toContain("第2戦");
    expect(worldCupTotoBacktestSummary.nextOptimizationSteps).toHaveLength(3);
  });
});
