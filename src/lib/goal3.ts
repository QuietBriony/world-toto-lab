import {
  buildBigCarryoverEventSnapshot,
  calculateBigCarryoverSummary,
} from "@/lib/big-carryover";
import type { SyncedTotoOfficialRoundEntry } from "@/lib/repository";
import type {
  Goal3TeamRole,
  TotoOfficialRoundLibraryEntry,
  TotoOfficialRoundLibraryMatch,
} from "@/lib/types";

export type Goal3OutcomeValue = "0" | "1" | "2" | "3+";

export type Goal3VoteRow = {
  fixtureNo: number;
  kickoffTime: string | null;
  leanWatchOutcome: Goal3OutcomeValue | null;
  officialMatchNo: number;
  opponentTeam: string | null;
  payoutProxy: Record<Goal3OutcomeValue, number | null>;
  teamName: string;
  teamRole: Goal3TeamRole | null;
  topPublicOutcome: Goal3OutcomeValue | null;
  venue: string | null;
  votes: Record<Goal3OutcomeValue, number | null>;
};

type Goal3LikeEntry = Pick<
  TotoOfficialRoundLibraryEntry,
  | "carryoverYen"
  | "officialRoundNumber"
  | "officialRoundName"
  | "outcomeSetJson"
  | "productType"
  | "returnRate"
  | "sourceNote"
  | "title"
  | "totalSalesYen"
>;

type Goal3LikeMatch = Pick<
  TotoOfficialRoundLibraryMatch,
  | "awayTeam"
  | "homeTeam"
  | "kickoffTime"
  | "officialMatchNo"
  | "officialVote0"
  | "officialVote1"
  | "officialVote2"
  | "stage"
  | "venue"
> & {
  goal3FixtureNo?: number | null;
  goal3TeamRole?: Goal3TeamRole | null;
  officialVote3?: number | null;
};

export function isGoal3LibraryEntry(entry: Goal3LikeEntry) {
  const outcomeSet = entry.outcomeSetJson ?? [];
  const text = [entry.title, entry.officialRoundName, entry.sourceNote]
    .map((value) => value?.toLowerCase() ?? "")
    .join(" ");

  return (
    entry.productType === "custom" &&
    (outcomeSet.includes("3+") || text.includes("goal3"))
  );
}

export function deriveGoal3VoteRateUrl(sourceUrl: string | null) {
  if (!sourceUrl) {
    return null;
  }

  if (sourceUrl.includes("PGSPIN00301InitVoteRate.form")) {
    return sourceUrl;
  }

  try {
    const parsed = new URL(sourceUrl);
    const holdCntId = parsed.searchParams.get("holdCntId");
    if (!holdCntId) {
      return null;
    }

    return `https://store.toto-dream.com/dcs/subos/screen/pi09/spin003/PGSPIN00301InitVoteRate.form?holdCntId=${holdCntId}&commodityId=02`;
  } catch {
    const holdCntId = sourceUrl.match(/holdCntId=(\d+)/i)?.[1] ?? null;
    if (!holdCntId) {
      return null;
    }

    return `https://store.toto-dream.com/dcs/subos/screen/pi09/spin003/PGSPIN00301InitVoteRate.form?holdCntId=${holdCntId}&commodityId=02`;
  }
}

export function buildGoal3EventWatch(entry: Goal3LikeEntry) {
  const summary = calculateBigCarryoverSummary({
    carryoverYen: entry.carryoverYen,
    returnRate: entry.returnRate,
    salesYen: entry.totalSalesYen,
    spendYen: null,
  });
  const snapshot = buildBigCarryoverEventSnapshot({
    eventLabel: entry.title || "totoGOAL3",
    eventType: "carryover_event",
    summary,
  });

  return {
    requiresAttention:
      snapshot.status === "plus_ev" || snapshot.status === "near_break_even",
    snapshot,
    summary,
  };
}

export function pickFeaturedGoal3Entry(entries: TotoOfficialRoundLibraryEntry[]) {
  return [...entries]
    .filter(isGoal3LibraryEntry)
    .sort((left, right) => {
      const leftWatch = buildGoal3EventWatch(left);
      const rightWatch = buildGoal3EventWatch(right);
      if (leftWatch.requiresAttention !== rightWatch.requiresAttention) {
        return leftWatch.requiresAttention ? -1 : 1;
      }

      const leftRound = left.officialRoundNumber ?? 0;
      const rightRound = right.officialRoundNumber ?? 0;
      if (leftRound !== rightRound) {
        return rightRound - leftRound;
      }

      return right.updatedAt.localeCompare(left.updatedAt);
    })[0] ?? null;
}

function resolveTeamRole(match: Goal3LikeMatch) {
  if (match.goal3TeamRole) {
    return match.goal3TeamRole;
  }

  if (match.stage === "ホーム") {
    return "home" satisfies Goal3TeamRole;
  }

  if (match.stage === "アウェイ") {
    return "away" satisfies Goal3TeamRole;
  }

  return match.officialMatchNo % 2 === 1 ? ("home" as const) : ("away" as const);
}

function maxOutcome(
  values: Record<Goal3OutcomeValue, number | null>,
  mode: "largest" | "smallest",
) {
  const ranked = (["0", "1", "2", "3+"] as Goal3OutcomeValue[])
    .map((outcome) => ({
      outcome,
      value: values[outcome],
    }))
    .filter((entry): entry is { outcome: Goal3OutcomeValue; value: number } => entry.value !== null)
    .sort((left, right) =>
      mode === "largest" ? right.value - left.value : left.value - right.value,
    );

  return ranked[0]?.outcome ?? null;
}

export function buildGoal3VoteRows(input: {
  entry: Pick<TotoOfficialRoundLibraryEntry, "matches" | "carryoverYen" | "returnRate" | "title" | "totalSalesYen">;
  liveEntry?: Pick<SyncedTotoOfficialRoundEntry, "matches"> | null;
}) {
  const summary = calculateBigCarryoverSummary({
    carryoverYen: input.entry.carryoverYen,
    returnRate: input.entry.returnRate,
    salesYen: input.entry.totalSalesYen,
    spendYen: null,
  });
  const eventEvMultiple = summary.approxEvMultiple;
  const sourceRows = (input.liveEntry?.matches.length ? input.liveEntry.matches : input.entry.matches) as Goal3LikeMatch[];

  const teamRows = sourceRows.filter((row) => {
    const hasGoal3Votes = typeof row.officialVote3 === "number" || row.officialVote3 === null;
    return hasGoal3Votes && row.officialMatchNo >= 1;
  });

  return teamRows.map((row) => {
    const fixtureNo = row.goal3FixtureNo ?? Math.ceil(row.officialMatchNo / 2);
    const baseFixture = input.entry.matches[fixtureNo - 1];
    const teamRole = resolveTeamRole(row);
    const opponentTeam =
      row.awayTeam ||
      (baseFixture
        ? teamRole === "home"
          ? baseFixture.awayTeam
          : baseFixture.homeTeam
        : null);
    const votes = {
      "0": row.officialVote0,
      "1": row.officialVote1,
      "2": row.officialVote2,
      "3+": row.officialVote3 ?? null,
    } satisfies Record<Goal3OutcomeValue, number | null>;

    return {
      fixtureNo,
      kickoffTime: row.kickoffTime ?? baseFixture?.kickoffTime ?? null,
      leanWatchOutcome: maxOutcome(votes, "smallest"),
      officialMatchNo: row.officialMatchNo,
      opponentTeam,
      payoutProxy: {
        "0":
          eventEvMultiple !== null && votes["0"] && votes["0"] > 0
            ? eventEvMultiple / votes["0"]
            : null,
        "1":
          eventEvMultiple !== null && votes["1"] && votes["1"] > 0
            ? eventEvMultiple / votes["1"]
            : null,
        "2":
          eventEvMultiple !== null && votes["2"] && votes["2"] > 0
            ? eventEvMultiple / votes["2"]
            : null,
        "3+":
          eventEvMultiple !== null && votes["3+"] && votes["3+"] > 0
            ? eventEvMultiple / votes["3+"]
            : null,
      } satisfies Record<Goal3OutcomeValue, number | null>,
      teamName: row.homeTeam,
      teamRole,
      topPublicOutcome: maxOutcome(votes, "largest"),
      venue: row.venue ?? baseFixture?.venue ?? null,
      votes,
    } satisfies Goal3VoteRow;
  });
}
