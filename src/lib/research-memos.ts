import type { Match, ResearchMemo, ResearchMemoConfidence, ResearchMemoType } from "@/lib/types";

function normalizeOptionalString(value: string | null | undefined) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

export function buildResearchMemoPayload(input: {
  confidence: ResearchMemoConfidence;
  createdBy: string;
  matchId: string | null;
  memoId?: string | null;
  memoType: ResearchMemoType;
  roundId: string;
  sourceDate: string | null;
  sourceName: string | null;
  sourceUrl: string | null;
  summary: string;
  team: string | null;
  title: string;
}) {
  return {
    confidence: input.confidence,
    createdBy: input.createdBy,
    matchId: input.matchId,
    memoId: input.memoId ?? null,
    memoType: input.memoType,
    roundId: input.roundId,
    sourceDate: normalizeOptionalString(input.sourceDate),
    sourceName: normalizeOptionalString(input.sourceName),
    sourceUrl: normalizeOptionalString(input.sourceUrl),
    summary: input.summary.trim(),
    team: normalizeOptionalString(input.team),
    title: input.title.trim(),
  };
}

export function filterResearchMemosForMatch(
  researchMemos: ResearchMemo[],
  match: Pick<Match, "awayTeam" | "homeTeam" | "id"> | null,
) {
  if (!match) {
    return [];
  }

  const teamTokens = new Set(
    [match.homeTeam, match.awayTeam]
      .map((value) => value.trim().toLowerCase())
      .filter(Boolean),
  );

  return researchMemos.filter((memo) => {
    if (memo.matchId === match.id) {
      return true;
    }

    const memoTeam = memo.team?.trim().toLowerCase();
    return memoTeam ? teamTokens.has(memoTeam) : false;
  });
}
