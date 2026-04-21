import type {
  FixtureMaster,
  TotoOfficialMatchStatus,
} from "@/lib/types";

export type TotoOfficialImportRow = {
  actualResult: "ONE" | "DRAW" | "TWO" | null;
  awayTeam: string;
  fixtureCandidates: FixtureMaster[];
  fixtureMasterId: string | null;
  homeTeam: string;
  kickoffTime: string | null;
  matchStatus: TotoOfficialMatchStatus;
  officialMatchNo: number;
  officialVote0: number | null;
  officialVote1: number | null;
  officialVote2: number | null;
  sourceText: string | null;
  stage: string | null;
  venue: string | null;
  warnings: string[];
};

export type TotoOfficialImportResult = {
  rows: TotoOfficialImportRow[];
  warnings: string[];
};

export const multipleFixtureCandidatesWarning =
  "Fixture候補が複数あります。管理者確認をおすすめします。";

function normalizeSearch(value: string | null | undefined) {
  return (value ?? "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/[‐‑‒–—―-]/g, "-")
    .trim();
}

function splitLine(line: string) {
  if (line.includes("\t")) {
    return line.split("\t").map((part) => part.trim());
  }

  return line.split(",").map((part) => part.trim());
}

export function normalizeVote(raw: string) {
  const value = raw.trim();
  if (!value) {
    return {
      normalized: null,
      warning: null,
    };
  }

  if (value.endsWith("%")) {
    const parsed = Number(value.slice(0, -1));
    if (Number.isFinite(parsed)) {
      return {
        normalized: parsed / 100,
        warning: null,
      };
    }
  }

  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return {
      normalized: null,
      warning: `投票率「${raw}」を解釈できませんでした。`,
    };
  }

  if (parsed > 1 && parsed <= 100) {
    return {
      normalized: parsed / 100,
      warning: `${raw} は百分率とみなして ${parsed / 100} に変換しました。`,
    };
  }

  return {
    normalized: parsed,
    warning: null,
  };
}

function parseActualResult(raw: string) {
  if (raw === "1") {
    return "ONE";
  }

  if (raw === "0") {
    return "DRAW";
  }

  if (raw === "2") {
    return "TWO";
  }

  return null;
}

function parseKickoff(raw: string) {
  const value = raw.trim();
  if (!value) {
    return null;
  }

  const normalized = value
    .replace(/\//g, "-")
    .replace(/\s+/, "T")
    .replace(/T(\d{2}):(\d{2})$/, "T$1:$2:00");
  const parsed = Date.parse(normalized);
  return Number.isNaN(parsed) ? null : new Date(parsed).toISOString();
}

function fixtureScore(input: {
  fixture: FixtureMaster;
  row: Pick<TotoOfficialImportRow, "awayTeam" | "homeTeam" | "kickoffTime" | "venue">;
}) {
  let score = 0;

  if (normalizeSearch(input.fixture.homeTeam) === normalizeSearch(input.row.homeTeam)) {
    score += 5;
  }

  if (normalizeSearch(input.fixture.awayTeam) === normalizeSearch(input.row.awayTeam)) {
    score += 5;
  }

  if (
    input.fixture.kickoffTime &&
    input.row.kickoffTime &&
    input.fixture.kickoffTime.slice(0, 10) === input.row.kickoffTime.slice(0, 10)
  ) {
    score += 2;
  } else if (
    input.fixture.matchDate &&
    input.row.kickoffTime &&
    input.fixture.matchDate === input.row.kickoffTime.slice(0, 10)
  ) {
    score += 2;
  }

  if (
    input.fixture.venue &&
    input.row.venue &&
    normalizeSearch(input.fixture.venue).includes(normalizeSearch(input.row.venue))
  ) {
    score += 2;
  }

  return score;
}

export function matchOfficialRowsToFixtures(
  rows: TotoOfficialImportRow[],
  fixtures: FixtureMaster[],
) {
  return rows.map((row) => {
    const baseWarnings = row.warnings.filter(
      (warning) => warning !== multipleFixtureCandidatesWarning,
    );
    const candidates = fixtures
      .map((fixture) => ({
        fixture,
        score: fixtureScore({ fixture, row }),
      }))
      .filter((entry) => entry.score >= 8)
      .sort((left, right) => right.score - left.score)
      .map((entry) => entry.fixture);

    return {
      ...row,
      fixtureCandidates: candidates.slice(0, 3),
      fixtureMasterId: candidates.some((candidate) => candidate.id === row.fixtureMasterId)
        ? row.fixtureMasterId
        : (candidates[0]?.id ?? null),
      warnings:
        candidates.length > 1
          ? [...baseWarnings, multipleFixtureCandidatesWarning]
          : baseWarnings,
    } satisfies TotoOfficialImportRow;
  });
}

export function parseTotoOfficialRoundCsv(input: {
  fixtures?: FixtureMaster[];
  sourceText: string;
}) {
  const warnings: string[] = [];
  const lines = input.sourceText
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length === 0) {
    return {
      rows: [],
      warnings: ["貼り付け内容が空です。"],
    } satisfies TotoOfficialImportResult;
  }

  const rows: TotoOfficialImportRow[] = [];

  lines.forEach((line, index) => {
    const cells = splitLine(line);
    if (index === 0 && cells.join(",").toLowerCase().includes("official_match_no")) {
      return;
    }

    if (cells.length < 9) {
      warnings.push(`行 ${index + 1} は列数が足りないためスキップしました。`);
      return;
    }

    const vote1 = normalizeVote(cells[6] ?? "");
    const vote0 = normalizeVote(cells[7] ?? "");
    const vote2 = normalizeVote(cells[8] ?? "");
    const rowWarnings = [vote1.warning, vote0.warning, vote2.warning].filter(
      (warning): warning is string => Boolean(warning),
    );
    const officialMatchNo = Number.parseInt(cells[0] ?? "", 10);

    if (!Number.isFinite(officialMatchNo)) {
      warnings.push(`行 ${index + 1} の official_match_no が不正です。`);
      return;
    }

    const row = {
      actualResult: parseActualResult(cells[9] ?? ""),
      awayTeam: cells[2] ?? "",
      fixtureCandidates: [],
      fixtureMasterId: null,
      homeTeam: cells[1] ?? "",
      kickoffTime: parseKickoff(cells[3] ?? ""),
      matchStatus: "scheduled" as const,
      officialMatchNo,
      officialVote0: vote0.normalized,
      officialVote1: vote1.normalized,
      officialVote2: vote2.normalized,
      sourceText: line,
      stage: cells[5] ?? null,
      venue: cells[4] ?? null,
      warnings: rowWarnings,
    } satisfies TotoOfficialImportRow;

    const sum =
      (row.officialVote1 ?? 0) + (row.officialVote0 ?? 0) + (row.officialVote2 ?? 0);
    if (sum > 0 && Math.abs(sum - 1) > 0.04) {
      row.warnings.push("公式投票率1/0/2の合計が1から大きくズレています。");
    }

    rows.push(row);
  });

  return {
    rows: matchOfficialRowsToFixtures(rows, input.fixtures ?? []),
    warnings,
  } satisfies TotoOfficialImportResult;
}
