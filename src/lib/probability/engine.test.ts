import { describe, expect, it } from "vitest";

import { calculateModelProbabilities } from "@/lib/probability/engine";

describe("calculateModelProbabilities", () => {
  it("uses the world cup fallback prior", () => {
    const result = calculateModelProbabilities({
      competitionType: "world_cup",
      consensusD: null,
      consensusF: null,
      crowdSmoothingWeight: null,
      dataProfile: "worldcup_rich",
      marketProb0: null,
      marketProb1: null,
      marketProb2: null,
      officialVote0: null,
      officialVote1: null,
      officialVote2: null,
      adminAdjust0: null,
      adminAdjust1: null,
      adminAdjust2: null,
      altitudeHumidityAdjust: null,
      availabilityAdjust: null,
      awayStrengthAdjust: null,
      conditionsAdjust: null,
      groupStandingMotivationAdjust: null,
      homeAdvantageAdjust: null,
      homeStrengthAdjust: null,
      injurySuspensionAdjust: null,
      leagueTableMotivationAdjust: null,
      motivationAdjust: null,
      restDaysAdjust: null,
      rotationRiskAdjust: null,
      squadDepthAdjust: null,
      tacticalAdjust: null,
      tournamentPressureAdjust: null,
      travelAdjust: null,
      travelClimateAdjust: null,
    });

    expect(result.modelProb1).toBeCloseTo(0.36, 4);
    expect(result.modelProb0).toBeCloseTo(0.28, 4);
    expect(result.modelProb2).toBeCloseTo(0.36, 4);
    expect(result.probabilityConfidence).toBe("fallback");
  });

  it("uses the domestic fallback prior", () => {
    const result = calculateModelProbabilities({
      competitionType: "domestic_toto",
      consensusD: null,
      consensusF: null,
      crowdSmoothingWeight: null,
      dataProfile: "domestic_standard",
      marketProb0: null,
      marketProb1: null,
      marketProb2: null,
      officialVote0: null,
      officialVote1: null,
      officialVote2: null,
      adminAdjust0: null,
      adminAdjust1: null,
      adminAdjust2: null,
      altitudeHumidityAdjust: null,
      availabilityAdjust: null,
      awayStrengthAdjust: null,
      conditionsAdjust: null,
      groupStandingMotivationAdjust: null,
      homeAdvantageAdjust: null,
      homeStrengthAdjust: null,
      injurySuspensionAdjust: null,
      leagueTableMotivationAdjust: null,
      motivationAdjust: null,
      restDaysAdjust: null,
      rotationRiskAdjust: null,
      squadDepthAdjust: null,
      tacticalAdjust: null,
      tournamentPressureAdjust: null,
      travelAdjust: null,
      travelClimateAdjust: null,
    });

    expect(result.modelProb1).toBeCloseTo(0.4, 4);
    expect(result.modelProb0).toBeCloseTo(0.26, 4);
    expect(result.modelProb2).toBeCloseTo(0.34, 4);
  });

  it("prefers market probabilities when present", () => {
    const result = calculateModelProbabilities({
      competitionType: "domestic_toto",
      consensusD: null,
      consensusF: null,
      crowdSmoothingWeight: null,
      dataProfile: "domestic_standard",
      marketProb0: 0.22,
      marketProb1: 0.5,
      marketProb2: 0.28,
      officialVote0: 0.33,
      officialVote1: 0.34,
      officialVote2: 0.33,
      adminAdjust0: null,
      adminAdjust1: null,
      adminAdjust2: null,
      altitudeHumidityAdjust: null,
      availabilityAdjust: null,
      awayStrengthAdjust: null,
      conditionsAdjust: null,
      groupStandingMotivationAdjust: null,
      homeAdvantageAdjust: null,
      homeStrengthAdjust: null,
      injurySuspensionAdjust: null,
      leagueTableMotivationAdjust: null,
      motivationAdjust: null,
      restDaysAdjust: null,
      rotationRiskAdjust: null,
      squadDepthAdjust: null,
      tacticalAdjust: null,
      tournamentPressureAdjust: null,
      travelAdjust: null,
      travelClimateAdjust: null,
    });

    expect(result.modelProb1).toBeCloseTo(0.5, 4);
    expect(result.modelProb0).toBeCloseTo(0.22, 4);
    expect(result.modelProb2).toBeCloseTo(0.28, 4);
  });

  it("applies Human F and D adjustments", () => {
    const result = calculateModelProbabilities({
      competitionType: "world_cup",
      consensusD: 1.5,
      consensusF: 4,
      crowdSmoothingWeight: null,
      dataProfile: "worldcup_rich",
      marketProb0: 0.2,
      marketProb1: 0.4,
      marketProb2: 0.4,
      officialVote0: 0.3,
      officialVote1: 0.4,
      officialVote2: 0.3,
      adminAdjust0: null,
      adminAdjust1: null,
      adminAdjust2: null,
      altitudeHumidityAdjust: null,
      availabilityAdjust: null,
      awayStrengthAdjust: null,
      conditionsAdjust: null,
      groupStandingMotivationAdjust: null,
      homeAdvantageAdjust: null,
      homeStrengthAdjust: null,
      injurySuspensionAdjust: null,
      leagueTableMotivationAdjust: null,
      motivationAdjust: null,
      restDaysAdjust: null,
      rotationRiskAdjust: null,
      squadDepthAdjust: null,
      tacticalAdjust: null,
      tournamentPressureAdjust: null,
      travelAdjust: null,
      travelClimateAdjust: null,
    });

    expect(result.modelProb1).toBeGreaterThan(0.4);
    expect(result.modelProb0).toBeGreaterThan(0.2);
  });

  it("applies domestic adjustments", () => {
    const result = calculateModelProbabilities({
      competitionType: "domestic_toto",
      consensusD: null,
      consensusF: null,
      crowdSmoothingWeight: null,
      dataProfile: "domestic_standard",
      marketProb0: 0.26,
      marketProb1: 0.37,
      marketProb2: 0.37,
      officialVote0: null,
      officialVote1: null,
      officialVote2: null,
      adminAdjust0: null,
      adminAdjust1: null,
      adminAdjust2: null,
      altitudeHumidityAdjust: null,
      availabilityAdjust: null,
      awayStrengthAdjust: null,
      conditionsAdjust: null,
      groupStandingMotivationAdjust: null,
      homeAdvantageAdjust: 0.05,
      homeStrengthAdjust: null,
      injurySuspensionAdjust: 0.02,
      leagueTableMotivationAdjust: 0.03,
      motivationAdjust: null,
      restDaysAdjust: 0.01,
      rotationRiskAdjust: -0.02,
      squadDepthAdjust: null,
      tacticalAdjust: null,
      tournamentPressureAdjust: null,
      travelAdjust: 0.02,
      travelClimateAdjust: null,
    });

    expect(result.modelProb1).toBeGreaterThan(result.modelProb2);
  });

  it("applies world cup adjustments", () => {
    const result = calculateModelProbabilities({
      competitionType: "world_cup",
      consensusD: null,
      consensusF: null,
      crowdSmoothingWeight: null,
      dataProfile: "worldcup_rich",
      marketProb0: 0.28,
      marketProb1: 0.36,
      marketProb2: 0.36,
      officialVote0: null,
      officialVote1: null,
      officialVote2: null,
      adminAdjust0: null,
      adminAdjust1: null,
      adminAdjust2: null,
      altitudeHumidityAdjust: 0.02,
      availabilityAdjust: null,
      awayStrengthAdjust: null,
      conditionsAdjust: null,
      groupStandingMotivationAdjust: 0.03,
      homeAdvantageAdjust: null,
      homeStrengthAdjust: null,
      injurySuspensionAdjust: null,
      leagueTableMotivationAdjust: null,
      motivationAdjust: null,
      restDaysAdjust: null,
      rotationRiskAdjust: -0.01,
      squadDepthAdjust: 0.04,
      tacticalAdjust: null,
      tournamentPressureAdjust: 0.02,
      travelAdjust: null,
      travelClimateAdjust: 0.03,
    });

    expect(result.modelProb1).toBeGreaterThan(result.modelProb2);
  });

  it("does not mix official vote unless crowd smoothing is explicitly enabled", () => {
    const withoutSmoothing = calculateModelProbabilities({
      competitionType: "domestic_toto",
      consensusD: null,
      consensusF: null,
      crowdSmoothingWeight: null,
      dataProfile: "domestic_standard",
      marketProb0: 0.22,
      marketProb1: 0.46,
      marketProb2: 0.32,
      officialVote0: 0.7,
      officialVote1: 0.1,
      officialVote2: 0.2,
      adminAdjust0: null,
      adminAdjust1: null,
      adminAdjust2: null,
      altitudeHumidityAdjust: null,
      availabilityAdjust: null,
      awayStrengthAdjust: null,
      conditionsAdjust: null,
      groupStandingMotivationAdjust: null,
      homeAdvantageAdjust: null,
      homeStrengthAdjust: null,
      injurySuspensionAdjust: null,
      leagueTableMotivationAdjust: null,
      motivationAdjust: null,
      restDaysAdjust: null,
      rotationRiskAdjust: null,
      squadDepthAdjust: null,
      tacticalAdjust: null,
      tournamentPressureAdjust: null,
      travelAdjust: null,
      travelClimateAdjust: null,
    });

    expect(withoutSmoothing.modelProb1).toBeCloseTo(0.46, 4);
    expect(withoutSmoothing.modelProb0).toBeCloseTo(0.22, 4);
  });

  it("normalizes the final triplet to 1", () => {
    const result = calculateModelProbabilities({
      competitionType: "domestic_toto",
      consensusD: 1.5,
      consensusF: 4,
      crowdSmoothingWeight: 0.1,
      dataProfile: "domestic_standard",
      marketProb0: 0.01,
      marketProb1: 0.9,
      marketProb2: 0.09,
      officialVote0: 0.8,
      officialVote1: 0.1,
      officialVote2: 0.1,
      adminAdjust0: 0.03,
      adminAdjust1: 0.04,
      adminAdjust2: -0.07,
      altitudeHumidityAdjust: null,
      availabilityAdjust: 0.03,
      awayStrengthAdjust: -0.02,
      conditionsAdjust: 0.02,
      groupStandingMotivationAdjust: null,
      homeAdvantageAdjust: 0.05,
      homeStrengthAdjust: 0.05,
      injurySuspensionAdjust: 0.01,
      leagueTableMotivationAdjust: 0.01,
      motivationAdjust: 0.02,
      restDaysAdjust: 0.01,
      rotationRiskAdjust: 0.01,
      squadDepthAdjust: null,
      tacticalAdjust: 0.02,
      tournamentPressureAdjust: null,
      travelAdjust: 0.01,
      travelClimateAdjust: null,
    });

    expect(result.modelProb1 + result.modelProb0 + result.modelProb2).toBeCloseTo(1, 6);
  });
});
