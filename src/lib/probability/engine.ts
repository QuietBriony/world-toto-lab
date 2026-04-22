import { clamp } from "@/lib/domain";
import type {
  CompetitionType,
  DataProfile,
  Match,
  ModelProfile,
  ProbabilityConfidence,
} from "@/lib/types";

export type ProbabilityEngineInput = Pick<
  Match,
  | "adminAdjust0"
  | "adminAdjust1"
  | "adminAdjust2"
  | "altitudeHumidityAdjust"
  | "availabilityAdjust"
  | "awayStrengthAdjust"
  | "conditionsAdjust"
  | "groupStandingMotivationAdjust"
  | "homeAdvantageAdjust"
  | "homeStrengthAdjust"
  | "injurySuspensionAdjust"
  | "leagueTableMotivationAdjust"
  | "marketProb0"
  | "marketProb1"
  | "marketProb2"
  | "motivationAdjust"
  | "officialVote0"
  | "officialVote1"
  | "officialVote2"
  | "restDaysAdjust"
  | "rotationRiskAdjust"
  | "squadDepthAdjust"
  | "tacticalAdjust"
  | "tournamentPressureAdjust"
  | "travelAdjust"
  | "travelClimateAdjust"
  | "consensusD"
  | "consensusF"
> & {
  competitionType: CompetitionType;
  crowdSmoothingWeight?: number | null;
  dataProfile: DataProfile;
};

export type ProbabilityEngineResult = {
  missingDataWarnings: string[];
  modelProb0: number;
  modelProb1: number;
  modelProb2: number;
  modelProfile: ModelProfile;
  probabilityConfidence: ProbabilityConfidence;
  probabilityRationale: string;
};

type Triplet = {
  "0": number;
  "1": number;
  "2": number;
};

const WORLD_CUP_FALLBACK: Triplet = {
  "1": 0.36,
  "0": 0.28,
  "2": 0.36,
};

const DOMESTIC_FALLBACK: Triplet = {
  "1": 0.4,
  "0": 0.26,
  "2": 0.34,
};

function completeMarketTriplet(input: ProbabilityEngineInput) {
  return (
    input.marketProb1 !== null && input.marketProb0 !== null && input.marketProb2 !== null
  );
}

function normalizeTriplet(input: Triplet) {
  const clipped = {
    "1": Math.max(input["1"], 0.01),
    "0": Math.max(input["0"], 0.01),
    "2": Math.max(input["2"], 0.01),
  } satisfies Triplet;
  const total = clipped["1"] + clipped["0"] + clipped["2"];

  return {
    "1": clipped["1"] / total,
    "0": clipped["0"] / total,
    "2": clipped["2"] / total,
  } satisfies Triplet;
}

function fallbackPrior(competitionType: CompetitionType) {
  if (competitionType === "domestic_toto") {
    return DOMESTIC_FALLBACK;
  }

  return WORLD_CUP_FALLBACK;
}

function tiltHomeAway(triplet: Triplet, delta: number) {
  if (!delta) {
    return triplet;
  }

  return {
    "1": triplet["1"] + delta,
    "0": triplet["0"],
    "2": triplet["2"] - delta,
  };
}

function addDraw(triplet: Triplet, delta: number) {
  if (!delta) {
    return triplet;
  }

  return {
    "1": triplet["1"] - delta / 2,
    "0": triplet["0"] + delta,
    "2": triplet["2"] - delta / 2,
  };
}

function sumDefined(values: Array<number | null | undefined>) {
  let total = 0;

  values.forEach((value) => {
    total += value ?? 0;
  });

  return total;
}

function scoutTilt(consensusF: number | null) {
  if (consensusF === null) {
    return 0;
  }

  if (consensusF >= 4) {
    return 0.08;
  }

  if (consensusF >= 2) {
    return 0.04;
  }

  if (consensusF <= -4) {
    return -0.08;
  }

  if (consensusF <= -2) {
    return -0.04;
  }

  return 0;
}

function scoutDrawBoost(consensusD: number | null) {
  if (consensusD === null) {
    return 0;
  }

  if (consensusD >= 1.5) {
    return 0.08;
  }

  if (consensusD >= 1.2) {
    return 0.04;
  }

  return 0;
}

function probabilityConfidence(input: {
  hasContextMemo: boolean;
  hasManualAdjustments: boolean;
  hasMarket: boolean;
  hasScout: boolean;
  usedFallback: boolean;
}): ProbabilityConfidence {
  if (input.usedFallback && !input.hasScout && !input.hasManualAdjustments) {
    return "fallback";
  }

  if (input.hasMarket && input.hasScout && (input.hasContextMemo || input.hasManualAdjustments)) {
    return "high";
  }

  if (input.hasMarket || (input.hasScout && input.hasManualAdjustments)) {
    return "medium";
  }

  if (input.hasScout || input.hasManualAdjustments) {
    return "low";
  }

  return "fallback";
}

export function calculateModelProbabilities(
  input: ProbabilityEngineInput,
): ProbabilityEngineResult {
  const hasMarket = completeMarketTriplet(input);
  const base = hasMarket
    ? normalizeTriplet({
        "1": input.marketProb1 ?? 0,
        "0": input.marketProb0 ?? 0,
        "2": input.marketProb2 ?? 0,
      })
    : fallbackPrior(input.competitionType);
  const missingDataWarnings: string[] = [];

  if (!hasMarket) {
    missingDataWarnings.push("市場確率がないため fallback prior を使っています。");
  }

  const hasScout = input.consensusF !== null || input.consensusD !== null;
  const scoutHomeTilt = scoutTilt(input.consensusF);
  const scoutDraw = scoutDrawBoost(input.consensusD);
  const genericHomeAwayTilt = sumDefined([
    input.homeStrengthAdjust,
    input.awayStrengthAdjust !== null ? -input.awayStrengthAdjust : null,
    input.availabilityAdjust,
    input.conditionsAdjust,
    input.tacticalAdjust,
    input.motivationAdjust,
  ]);
  const domesticHomeAwayTilt =
    input.competitionType === "domestic_toto"
      ? sumDefined([
          input.homeAdvantageAdjust,
          input.restDaysAdjust,
          input.travelAdjust,
          input.leagueTableMotivationAdjust,
          input.injurySuspensionAdjust,
          input.rotationRiskAdjust,
        ])
      : 0;
  const worldCupHomeAwayTilt =
    input.competitionType === "world_cup"
      ? sumDefined([
          input.groupStandingMotivationAdjust,
          input.travelClimateAdjust,
          input.altitudeHumidityAdjust,
          input.squadDepthAdjust,
          input.rotationRiskAdjust,
          input.tournamentPressureAdjust,
        ])
      : 0;

  const manualAdjustments = [
    input.homeStrengthAdjust,
    input.awayStrengthAdjust,
    input.availabilityAdjust,
    input.conditionsAdjust,
    input.tacticalAdjust,
    input.motivationAdjust,
    input.adminAdjust1,
    input.adminAdjust0,
    input.adminAdjust2,
    input.homeAdvantageAdjust,
    input.restDaysAdjust,
    input.travelAdjust,
    input.leagueTableMotivationAdjust,
    input.injurySuspensionAdjust,
    input.rotationRiskAdjust,
    input.groupStandingMotivationAdjust,
    input.travelClimateAdjust,
    input.altitudeHumidityAdjust,
    input.squadDepthAdjust,
    input.tournamentPressureAdjust,
  ].some((value) => typeof value === "number" && Math.abs(value) > 0.001);

  let working = normalizeTriplet(base);
  working = normalizeTriplet(tiltHomeAway(working, scoutHomeTilt));
  working = normalizeTriplet(addDraw(working, scoutDraw));
  working = normalizeTriplet(
    tiltHomeAway(
      working,
      clamp(genericHomeAwayTilt + domesticHomeAwayTilt + worldCupHomeAwayTilt, -0.2, 0.2),
    ),
  );
  working = normalizeTriplet({
    "1": working["1"] + (input.adminAdjust1 ?? 0),
    "0": working["0"] + (input.adminAdjust0 ?? 0),
    "2": working["2"] + (input.adminAdjust2 ?? 0),
  });

  const smoothingWeight = clamp(input.crowdSmoothingWeight ?? 0, 0, 0.1);
  const hasOfficialVote =
    input.officialVote1 !== null && input.officialVote0 !== null && input.officialVote2 !== null;

  if ((input.crowdSmoothingWeight ?? 0) > 0.1) {
    missingDataWarnings.push("crowd smoothing は 10% 上限で clip しました。");
  }

  if (smoothingWeight > 0 && hasOfficialVote) {
    const official = normalizeTriplet({
      "1": input.officialVote1 ?? 0,
      "0": input.officialVote0 ?? 0,
      "2": input.officialVote2 ?? 0,
    });
    working = normalizeTriplet({
      "1": working["1"] * (1 - smoothingWeight) + official["1"] * smoothingWeight,
      "0": working["0"] * (1 - smoothingWeight) + official["0"] * smoothingWeight,
      "2": working["2"] * (1 - smoothingWeight) + official["2"] * smoothingWeight,
    });
    missingDataWarnings.push("公式人気の crowd smoothing を実験的に適用しています。");
  }

  const hasContextMemo = input.dataProfile === "worldcup_rich" || input.dataProfile === "domestic_standard" || manualAdjustments;
  const confidence = probabilityConfidence({
    hasContextMemo,
    hasManualAdjustments: manualAdjustments,
    hasMarket,
    hasScout,
    usedFallback: !hasMarket,
  });
  const modelProfile: ModelProfile = hasMarket
    ? hasScout || manualAdjustments
      ? hasScout
        ? "market_plus_scout"
        : "market_plus_adjustments"
      : "market_plus_adjustments"
    : hasScout || manualAdjustments
      ? "scout_only"
      : "fallback_prior";

  const rationaleParts = [
    hasMarket ? "市場確率を土台にしています。" : "市場確率がないため competition fallback を土台にしています。",
    hasScout
      ? `Human Scout 補正を反映しました（F=${input.consensusF ?? "—"} / D=${input.consensusD ?? "—"}）。`
      : "Human Scout 補正は未入力です。",
    manualAdjustments
      ? `${input.competitionType === "world_cup" ? "W杯向け" : input.competitionType === "domestic_toto" ? "通常toto向け" : "手入力"}補正を反映しました。`
      : "追加の手入力補正はまだ少なめです。",
    "公式人気は Edge/EV 比較用で、デフォルトではモデルへ混ぜていません。",
  ];

  if (!hasOfficialVote) {
    missingDataWarnings.push("公式人気が不足しているため Edge/EV 比較は限定的です。");
  }

  return {
    missingDataWarnings,
    modelProb1: working["1"],
    modelProb0: working["0"],
    modelProb2: working["2"],
    modelProfile,
    probabilityConfidence: confidence,
    probabilityRationale: rationaleParts.join(" "),
  };
}
