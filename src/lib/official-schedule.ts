import type { FixtureDataConfidence, FixtureSource } from "@/lib/types";

export type OfficialScheduleDraft = {
  awayTeam: string;
  competition: string;
  dataConfidence: FixtureDataConfidence;
  groupName: string | null;
  homeTeam: string;
  kickoffTime: string | null;
  matchDate: string | null;
  source: FixtureSource;
  sourceText: string | null;
  sourceUrl: string | null;
  stage: string | null;
  timezone: string | null;
  venue: string | null;
};

export type OfficialScheduleParseResult = {
  duplicates: string[];
  fixtures: OfficialScheduleDraft[];
  warnings: string[];
};

const dashPattern = /\s*[‐‑‒–—―-]\s*/;
const teamSeparatorPattern = /\s+(?:v|vs|対)\s+/i;

export const officialScheduleImportSample = [
  "Thursday, 11 June 2026",
  "Mexico v South Africa - Group A – Mexico City Stadium",
  "Korea Republic v Czechia – Group A - Estadio Guadalajara",
  "",
  "Friday, 12 June 2026",
  "Canada v Bosnia and Herzegovina - Group B – Toronto Stadium",
  "USA v Paraguay - Group D – Los Angeles Stadium",
].join("\n");

function normalizeKeyPart(value: string | null | undefined) {
  return (value ?? "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function fixtureKey(entry: Pick<OfficialScheduleDraft, "awayTeam" | "homeTeam" | "matchDate" | "venue">) {
  return [
    entry.matchDate ?? "",
    normalizeKeyPart(entry.homeTeam),
    normalizeKeyPart(entry.awayTeam),
    normalizeKeyPart(entry.venue),
  ].join("|");
}

function parseDateHeader(line: string) {
  const normalized = line.replace(/,/g, "").trim();
  const match = normalized.match(
    /^(?:[A-Za-z]+\s+)?(\d{1,2})\s+([A-Za-z]+)\s+(\d{4})$/,
  );

  if (!match) {
    return null;
  }

  const monthMap: Record<string, string> = {
    january: "01",
    february: "02",
    march: "03",
    april: "04",
    may: "05",
    june: "06",
    july: "07",
    august: "08",
    september: "09",
    october: "10",
    november: "11",
    december: "12",
  };
  const month = monthMap[match[2].toLowerCase()];
  if (!month) {
    return null;
  }

  return `${match[3]}-${month}-${match[1].padStart(2, "0")}`;
}

function parseTimeToken(raw: string, matchDate: string | null) {
  const match = raw.match(/(\d{1,2}):(\d{2})/);
  if (!match || !matchDate) {
    return null;
  }

  const hours = match[1].padStart(2, "0");
  const minutes = match[2];
  return `${matchDate}T${hours}:${minutes}:00`;
}

function parseMetaTokens(tokens: string[], matchDate: string | null) {
  let groupName: string | null = null;
  let stage: string | null = null;
  let venue: string | null = null;
  let kickoffTime: string | null = null;

  tokens.forEach((token) => {
    const value = token.trim();
    if (!value) {
      return;
    }

    if (!kickoffTime) {
      kickoffTime = parseTimeToken(value, matchDate);
      if (kickoffTime) {
        return;
      }
    }

    if (!groupName && /^group\s+[a-z0-9]+/i.test(value)) {
      groupName = value;
      if (!stage) {
        stage = "Group Stage";
      }
      return;
    }

    if (
      !stage &&
      /(round|quarter|semi|final|group stage|playoff|knockout)/i.test(value)
    ) {
      stage = value;
      return;
    }

    if (!venue) {
      venue = value;
    }
  });

  return {
    groupName,
    kickoffTime,
    stage,
    venue,
  };
}

export function parseOfficialScheduleText(input: {
  competition?: string;
  dataConfidence?: FixtureDataConfidence;
  source?: FixtureSource;
  sourceText: string;
  sourceUrl?: string | null;
  timezone?: string | null;
}) {
  const warnings: string[] = [];
  const duplicates: string[] = [];
  const fixtures: OfficialScheduleDraft[] = [];
  const seenKeys = new Set<string>();
  let currentDate: string | null = null;

  input.sourceText
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .forEach((line, index) => {
      const dateHeader = parseDateHeader(line);
      if (dateHeader) {
        currentDate = dateHeader;
        return;
      }

      const [teamsPart, ...metaParts] = line.split(dashPattern);
      const teams = teamsPart.split(teamSeparatorPattern).map((part) => part.trim());

      if (teams.length !== 2) {
        warnings.push(`行 ${index + 1} を試合行として解釈できませんでした。`);
        return;
      }

      const meta = parseMetaTokens(metaParts, currentDate);
      const fixture = {
        awayTeam: teams[1],
        competition: input.competition ?? "fifa_world_cup_2026",
        dataConfidence: input.dataConfidence ?? "manual_official_source",
        groupName: meta.groupName,
        homeTeam: teams[0],
        kickoffTime: meta.kickoffTime,
        matchDate: currentDate,
        source: input.source ?? "fifa_official_manual",
        sourceText: line,
        sourceUrl: input.sourceUrl ?? null,
        stage: meta.stage,
        timezone: input.timezone ?? null,
        venue: meta.venue,
      } satisfies OfficialScheduleDraft;

      const key = fixtureKey(fixture);
      if (seenKeys.has(key)) {
        duplicates.push(`${fixture.homeTeam} vs ${fixture.awayTeam}`);
        return;
      }

      seenKeys.add(key);
      fixtures.push(fixture);
    });

  if (fixtures.length === 0 && warnings.length === 0) {
    warnings.push("貼り付け内容から試合を抽出できませんでした。");
  }

  return {
    duplicates,
    fixtures,
    warnings,
  } satisfies OfficialScheduleParseResult;
}
