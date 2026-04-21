import type { ProductType, TotoOfficialRoundLibraryEntry } from "@/lib/types";

type WorldTotoLikeRound = {
  matchCount?: number | null;
  matches?: Array<{
    awayTeam?: string | null;
    homeTeam?: string | null;
    sourceText?: string | null;
    stage?: string | null;
  }>;
  notes?: string | null;
  officialRoundName?: string | null;
  productType?: ProductType | string | null;
  sourceNote?: string | null;
  sourceText?: string | null;
  title?: string | null;
};

const explicitWorldTotoPattern =
  /world\s*toto|worldtoto|ワールド\s*toto|ワールドtoto|ワールドトト|world\s*cup|worldcup|ワールドカップ|w杯|fifa/i;
const worldCupStagePattern =
  /group\s+[a-z]|group stage|round of \d+|quarter|semi|final|グループ|ラウンド|準々決勝|準決勝|決勝/i;
export const worldTotoLabel = "World Toto";

function normalizeText(value: string | null | undefined) {
  return (value ?? "").trim();
}

export function looksLikeWorldTotoText(...values: Array<string | null | undefined>) {
  return values.some((value) => explicitWorldTotoPattern.test(normalizeText(value)));
}

export function isLikelyWorldTotoRound(input: WorldTotoLikeRound) {
  if (
    looksLikeWorldTotoText(
      input.title,
      input.officialRoundName,
      input.sourceNote,
      input.sourceText,
      input.notes,
    )
  ) {
    return true;
  }

  if (input.productType !== "toto13") {
    return false;
  }

  const matchCount = input.matchCount ?? input.matches?.length ?? 0;
  if (matchCount < 10) {
    return false;
  }

  const stageSignalCount = (input.matches ?? []).filter((match) =>
    worldCupStagePattern.test(`${normalizeText(match.stage)} ${normalizeText(match.sourceText)}`),
  ).length;

  return stageSignalCount >= 3;
}

export function isLikelyWorldTotoLibraryEntry(entry: TotoOfficialRoundLibraryEntry) {
  return isLikelyWorldTotoRound({
    matchCount: entry.matchCount,
    matches: entry.matches,
    officialRoundName: entry.officialRoundName,
    productType: entry.productType,
    sourceNote: entry.sourceNote,
    sourceText: entry.sourceText,
    title: entry.title,
  });
}

export function resolveWorldTotoProductLabel(
  input: WorldTotoLikeRound,
  fallbackLabel: string,
) {
  return isLikelyWorldTotoRound(input) ? worldTotoLabel : fallbackLabel;
}
