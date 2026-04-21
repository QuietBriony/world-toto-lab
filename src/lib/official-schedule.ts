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

export type OfficialScheduleTransferPayload = {
  importedAt: string | null;
  kind: string;
  sourceText: string;
  sourceUrl: string | null;
  version: number;
};

export const officialScheduleImportSourceUrl =
  "https://www.fifa.com/en/tournaments/mens/worldcup/canadamexicousa2026/articles/match-schedule-fixtures-results-teams-stadiums";

export const officialScheduleImportSourceLabel = "FIFA World Cup 2026 match schedule";
export const officialScheduleTransferPayloadKind = "world_toto_lab_official_schedule_import";
export const officialScheduleTransferPayloadVersion = 1;
export const fifaOfficialApiBaseUrl = "https://cxm-api.fifa.com/fifaplusweb/api";
export const fifaOfficialCalendarApiBaseUrl = "https://api.fifa.com/api/v3";
export const fifaWorldCup2026SeasonId = "285023";

const dashPattern = /\s+[‐‑‒–—―-]\s+/;
const dashTokenPattern = /[‐‑‒–—―-]/;
const teamSeparatorPattern = /\s+(?:v|vs|対)\s+/i;
const matchPrefixPattern = /Match\s+\d+\s*[‐‑‒–—―-]\s*/giu;
const leadingMatchPrefixPattern = /^Match\s+\d+\s*[‐‑‒–—―-]\s*/iu;
const protectedMatchReferenceToken = "__WTL_MATCH_REF__";

export const officialScheduleImportSample = [
  "Thursday, 11 June 2026",
  "Mexico v South Africa - Group A – Mexico City Stadium",
  "Korea Republic v Czechia – Group A - Estadio Guadalajara",
  "",
  "Friday, 12 June 2026",
  "Canada v Bosnia and Herzegovina - Group B – Toronto Stadium",
  "USA v Paraguay - Group D – Los Angeles Stadium",
].join("\n");

type FifaOfficialPageResponse = {
  pageId?: string;
  sections?: Array<{
    entryEndpoint?: string;
    entryId?: string;
    entryType?: string;
  }>;
};

type FifaOfficialRichTextNode = {
  content?: FifaOfficialRichTextNode[];
  nodeType?: string;
  value?: string;
};

type FifaOfficialArticleResponse = {
  articleTitle?: string;
  richtext?: FifaOfficialRichTextNode;
};

type FifaOfficialCalendarMatch = {
  Date?: string | null;
  Home?: {
    TeamName?: Array<{
      Description?: string;
      Locale?: string;
    }>;
  } | null;
  LocalDate?: string | null;
  MatchNumber?: number | null;
  PlaceHolderA?: string | null;
  PlaceHolderB?: string | null;
  Stadium?: {
    Name?: Array<{
      Description?: string;
      Locale?: string;
    }>;
  } | null;
  Away?: {
    TeamName?: Array<{
      Description?: string;
      Locale?: string;
    }>;
  } | null;
};

type FifaOfficialCalendarMatchesResponse = {
  Results?: FifaOfficialCalendarMatch[];
};

export type FifaOfficialScheduleFetchResult = {
  articleTitle: string | null;
  kickoffMissingCount: number;
  kickoffSupplementedCount: number;
  pageApiUrl: string;
  sourceText: string;
  sourceUrl: string;
  warnings: string[];
};

function normalizeKeyPart(value: string | null | undefined) {
  return (value ?? "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeSourceLine(value: string) {
  return value
    .replace(/\u00a0/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function stripDiacritics(value: string) {
  return value.normalize("NFKD").replace(/\p{Mark}+/gu, "");
}

function isBlockNode(nodeType: string | undefined) {
  return Boolean(
    nodeType &&
      (nodeType === "paragraph" ||
        nodeType === "blockquote" ||
        nodeType === "list-item" ||
        /^heading-/.test(nodeType)),
  );
}

function flattenFifaRichTextInline(node: FifaOfficialRichTextNode | undefined): string {
  if (!node) {
    return "";
  }

  if (node.nodeType === "text") {
    return node.value ?? "";
  }

  return (node.content ?? []).map(flattenFifaRichTextInline).join("");
}

function protectEmbeddedMatchReferences(value: string) {
  return value
    .replace(/Winner\s+match\s+(\d{1,3})/giu, (_, matchNo: string) =>
      `Winner ${protectedMatchReferenceToken}${matchNo}`,
    )
    .replace(/Runner-up\s+match\s+(\d{1,3})/giu, (_, matchNo: string) =>
      `Runner-up ${protectedMatchReferenceToken}${matchNo}`,
    );
}

function restoreEmbeddedMatchReferences(value: string) {
  return value.replace(
    new RegExp(`${protectedMatchReferenceToken}(\\d{1,3})`, "giu"),
    "match $1",
  );
}

function splitMatchPrefixedScheduleLine(line: string) {
  const normalized = normalizeSourceLine(line);
  if (!normalized) {
    return [];
  }

  const protectedLine = protectEmbeddedMatchReferences(normalized);
  const prefixedChunks = protectedLine.match(
    /Match\s+\d+\s*[‐‑‒–—―-]\s*.*?(?=(?:\s+Match\s+\d+\s*[‐‑‒–—―-]\s*)|$)/giu,
  );
  if (!prefixedChunks || prefixedChunks.length <= 1) {
    return [restoreEmbeddedMatchReferences(normalized.replace(leadingMatchPrefixPattern, "")).trim()];
  }

  return prefixedChunks
    .map((chunk) =>
      normalizeSourceLine(
        restoreEmbeddedMatchReferences(chunk.replace(leadingMatchPrefixPattern, "")),
      ),
    )
    .filter(Boolean);
}

function extractScheduleLinesFromFifaBlock(node: FifaOfficialRichTextNode | undefined): string[] {
  if (!node || !isBlockNode(node.nodeType)) {
    return [];
  }

  const text = normalizeSourceLine(flattenFifaRichTextInline(node));
  if (!text) {
    return [];
  }

  if (parseDateHeader(text)) {
    return [text];
  }

  if (node.nodeType !== "paragraph" && node.nodeType !== "list-item" && node.nodeType !== "blockquote") {
    return [];
  }

  const children = node.content ?? [];
  const hyperlinkChildren = children.filter(
    (child) =>
      child.nodeType === "hyperlink" &&
      teamSeparatorPattern.test(normalizeSourceLine(flattenFifaRichTextInline(child))),
  );

  if (hyperlinkChildren.length > 1) {
    const lines: string[] = [];
    let current = "";

    for (const child of children) {
      const childText = normalizeSourceLine(flattenFifaRichTextInline(child));
      if (!childText) {
        continue;
      }

      const startsFixture =
        child.nodeType === "hyperlink" && teamSeparatorPattern.test(childText);

      if (startsFixture) {
        if (current) {
          lines.push(current);
        }
        current = childText;
        continue;
      }

      current = current ? `${current} ${childText}` : childText;
    }

    if (current) {
      lines.push(current);
    }

    return lines.map((line) => normalizeSourceLine(line));
  }

  if (teamSeparatorPattern.test(text) && matchPrefixPattern.test(text)) {
    matchPrefixPattern.lastIndex = 0;
    return splitMatchPrefixedScheduleLine(text);
  }

  if (isLikelyMatchLine(text)) {
    return [text.replace(leadingMatchPrefixPattern, "").trim()];
  }

  return [];
}

function collectFifaScheduleLines(
  node: FifaOfficialRichTextNode | undefined,
  lines: string[],
) {
  if (!node) {
    return;
  }

  if (isBlockNode(node.nodeType)) {
    lines.push(...extractScheduleLinesFromFifaBlock(node));
    return;
  }

  (node.content ?? []).forEach((child) => collectFifaScheduleLines(child, lines));
}

export function extractOfficialScheduleSourceTextFromFifaRichText(
  richText: FifaOfficialRichTextNode | null | undefined,
) {
  const lines: string[] = [];
  collectFifaScheduleLines(richText ?? undefined, lines);
  return normalizeOfficialScheduleSourceText(lines.join("\n"));
}

export function buildFifaOfficialPageApiUrl(sourceUrl: string) {
  const source = new URL(sourceUrl);
  if (!/(^|\.)fifa\.com$/i.test(source.hostname)) {
    throw new Error("FIFA公式URLだけ利用できます。");
  }

  const pathname = source.pathname.replace(/\/+$/, "");
  if (!pathname || !/\/articles\//.test(pathname)) {
    throw new Error("FIFA公式の記事URLを入力してください。");
  }

  return `${fifaOfficialApiBaseUrl}/pages${pathname}`;
}

export async function fetchOfficialScheduleFromFifaArticle(sourceUrl: string) {
  const pageApiUrl = buildFifaOfficialPageApiUrl(sourceUrl);
  const warnings: string[] = [];
  const pageResponse = await fetch(pageApiUrl);
  if (!pageResponse.ok) {
    throw new Error(`FIFA公式ページ情報の取得に失敗しました: ${pageResponse.status}`);
  }

  const page = (await pageResponse.json()) as FifaOfficialPageResponse;
  const articleSection = page.sections?.find((section) => section.entryType === "article");
  const articleEndpoint = articleSection?.entryEndpoint?.replace(/^\/+/, "");
  if (!articleEndpoint) {
    throw new Error("FIFA公式ページから記事本文の取得先を見つけられませんでした。");
  }

  const articleUrl = `${fifaOfficialApiBaseUrl}/${articleEndpoint}`;
  const articleResponse = await fetch(articleUrl);
  if (!articleResponse.ok) {
    throw new Error(`FIFA公式記事本文の取得に失敗しました: ${articleResponse.status}`);
  }

  const article = (await articleResponse.json()) as FifaOfficialArticleResponse;
  const sourceText = extractOfficialScheduleSourceTextFromFifaRichText(article.richtext);
  if (!sourceText.trim()) {
    throw new Error("FIFA公式記事から本文テキストを抽出できませんでした。");
  }

  const normalizedSourceText = normalizeOfficialScheduleSourceText(sourceText);
  if (!normalizedSourceText.trim()) {
    warnings.push("本文は取得できましたが、試合行として解釈できるテキストが見つかりませんでした。");
  }

  let enrichedSourceText = normalizedSourceText;
  let kickoffSupplementedCount = 0;
  let kickoffMissingCount = 0;

  if (normalizedSourceText.trim()) {
    try {
      const calendarMatches = await fetchFifaCalendarMatches();
      const supplemented = supplementOfficialScheduleSourceTextWithCalendarMatches(
        normalizedSourceText,
        calendarMatches,
      );
      enrichedSourceText = supplemented.sourceText;
      kickoffSupplementedCount = supplemented.supplementedCount;
      kickoffMissingCount = supplemented.unsupplementedCount;

      if (kickoffSupplementedCount > 0) {
        warnings.push(
          kickoffMissingCount > 0
            ? `kickoff time を FIFA公式試合API から ${kickoffSupplementedCount} 件補完しました。${kickoffMissingCount} 件は時刻未入力のままです。`
            : `kickoff time を FIFA公式試合API から ${kickoffSupplementedCount} 件補完しました。`,
        );
      }
    } catch {
      warnings.push(
        "kickoff time の補完に使う FIFA公式試合API は取得できませんでした。本文ベースの試合情報だけで続けます。",
      );
    }
  }

  return {
    articleTitle: article.articleTitle ?? null,
    kickoffMissingCount,
    kickoffSupplementedCount,
    pageApiUrl,
    sourceText: enrichedSourceText,
    sourceUrl,
    warnings,
  } satisfies FifaOfficialScheduleFetchResult;
}

function isLikelyMatchLine(line: string) {
  return teamSeparatorPattern.test(line) && dashTokenPattern.test(line);
}

function normalizeFixtureChunk(chunk: string) {
  return chunk
    .replace(leadingMatchPrefixPattern, "")
    .replace(/\s+/g, " ")
    .trim();
}

function expandCompoundScheduleLine(line: string) {
  const normalized = normalizeSourceLine(line);
  if (!normalized) {
    return [];
  }

  if (matchPrefixPattern.test(normalized)) {
    matchPrefixPattern.lastIndex = 0;
    return splitMatchPrefixedScheduleLine(normalized);
  }

  if (isLikelyMatchLine(normalized)) {
    return [normalizeFixtureChunk(normalized)];
  }

  return [];
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

function formatDisplayKickoffTime(isoLikeValue: string) {
  const match = isoLikeValue.match(/T(\d{2}):(\d{2})/);
  if (!match) {
    return null;
  }

  return `${match[1]}:${match[2]}`;
}

function getLocaleDescription(
  values:
    | Array<{
        Description?: string;
        Locale?: string;
      }>
    | null
    | undefined,
) {
  return values?.find((entry) => Boolean(entry?.Description))?.Description ?? null;
}

function normalizeOfficialScheduleParticipant(value: string) {
  const normalized = stripDiacritics(value)
    .toLowerCase()
    .replace(/[’']/g, "")
    .replace(/\band\b/g, " ")
    .replace(/\s*\/\s*/g, "/")
    .replace(/[\u2010-\u2015]/g, "-")
    .replace(/-/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  const compactToken = normalized.replace(/\s+/g, "");
  if (/^(?:[12][a-z]|3[a-z]+|w\d+|ru\d+)$/i.test(compactToken)) {
    return compactToken.toLowerCase();
  }

  const winnerMatch = normalized.match(/^winner match (\d{1,3})$/);
  if (winnerMatch) {
    return `w${winnerMatch[1]}`;
  }

  const runnerUpMatch = normalized.match(/^runner up match (\d{1,3})$/);
  if (runnerUpMatch) {
    return `ru${runnerUpMatch[1]}`;
  }

  const groupWinner = normalized.match(/^group ([a-z]) winners?$/);
  if (groupWinner) {
    return `1${groupWinner[1]}`;
  }

  const groupRunnerUp = normalized.match(/^group ([a-z]) runners? up$/);
  if (groupRunnerUp) {
    return `2${groupRunnerUp[1]}`;
  }

  const thirdPlace = normalized.match(/^group ([a-z](?:\/[a-z])*) third place$/);
  if (thirdPlace) {
    return `3${thirdPlace[1].replace(/\//g, "")}`;
  }

  return normalized.replace(/[^a-z0-9 ]+/g, " ").replace(/\s+/g, " ").trim();
}

function normalizeOfficialScheduleVenue(value: string | null | undefined) {
  return stripDiacritics(value ?? "")
    .toLowerCase()
    .replace(/[’']/g, "")
    .replace(/\b(estadio|stadium)\b/g, "")
    .replace(/[^a-z0-9 ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function resolveCalendarParticipant(
  team:
    | {
        TeamName?: Array<{
          Description?: string;
          Locale?: string;
        }>;
      }
    | null
    | undefined,
  placeholder: string | null | undefined,
) {
  return getLocaleDescription(team?.TeamName) ?? placeholder ?? null;
}

async function fetchFifaCalendarMatches() {
  const response = await fetch(
    `${fifaOfficialCalendarApiBaseUrl}/calendar/matches?language=en&count=500&idSeason=${fifaWorldCup2026SeasonId}`,
  );
  if (!response.ok) {
    throw new Error(`FIFA公式試合APIの取得に失敗しました: ${response.status}`);
  }

  const payload = (await response.json()) as FifaOfficialCalendarMatchesResponse;
  return payload.Results ?? [];
}

export function supplementOfficialScheduleSourceTextWithCalendarMatches(
  sourceText: string,
  calendarMatches: FifaOfficialCalendarMatch[],
) {
  const normalizedSourceText = normalizeOfficialScheduleSourceText(sourceText);
  const preview = parseOfficialScheduleText({
    sourceText: normalizedSourceText,
  });
  const matchesByDateAndPair = new Map<string, FifaOfficialCalendarMatch[]>();
  const matchesByPair = new Map<string, FifaOfficialCalendarMatch[]>();

  calendarMatches.forEach((match) => {
    const homeParticipant = resolveCalendarParticipant(match.Home, match.PlaceHolderA);
    const awayParticipant = resolveCalendarParticipant(match.Away, match.PlaceHolderB);
    const localDate = (match.LocalDate ?? match.Date ?? "").slice(0, 10);
    if (!homeParticipant || !awayParticipant || !localDate) {
      return;
    }

    const pairKey = [
      normalizeOfficialScheduleParticipant(homeParticipant),
      normalizeOfficialScheduleParticipant(awayParticipant),
    ].join("|");
    const datedKey = `${localDate}|${pairKey}`;
    matchesByDateAndPair.set(datedKey, [...(matchesByDateAndPair.get(datedKey) ?? []), match]);
    matchesByPair.set(pairKey, [...(matchesByPair.get(pairKey) ?? []), match]);
  });

  function matchFixture(fixture: OfficialScheduleDraft) {
    const pairKey = [
      normalizeOfficialScheduleParticipant(fixture.homeTeam),
      normalizeOfficialScheduleParticipant(fixture.awayTeam),
    ].join("|");
    const datedCandidates = fixture.matchDate
      ? matchesByDateAndPair.get(`${fixture.matchDate}|${pairKey}`) ?? []
      : [];
    const fallbackCandidates = matchesByPair.get(pairKey) ?? [];
    const candidates = datedCandidates.length > 0 ? datedCandidates : fallbackCandidates;

    if (candidates.length <= 1) {
      return candidates[0] ?? null;
    }

    const normalizedVenue = normalizeOfficialScheduleVenue(fixture.venue);
    if (!normalizedVenue) {
      return candidates[0] ?? null;
    }

    const venueMatches = candidates.filter((candidate) => {
      const candidateVenue = normalizeOfficialScheduleVenue(
        getLocaleDescription(candidate.Stadium?.Name),
      );
      return candidateVenue === normalizedVenue;
    });

    return venueMatches.length === 1 ? venueMatches[0] : candidates[0] ?? null;
  }

  let supplementedCount = 0;
  let unsupplementedCount = 0;
  let fixtureIndex = 0;
  const sourceLines = normalizedSourceText
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  const enrichedSourceText = sourceLines
    .map((line) => {
      if (parseDateHeader(line)) {
        return line;
      }

      const fixture = preview.fixtures[fixtureIndex];
      fixtureIndex += 1;
      if (!fixture || fixture.kickoffTime) {
        return line;
      }

      const matchedCalendarRow = matchFixture(fixture);
      const kickoffSource = matchedCalendarRow?.LocalDate ?? matchedCalendarRow?.Date ?? null;
      const kickoffDisplay = kickoffSource ? formatDisplayKickoffTime(kickoffSource) : null;
      if (!kickoffDisplay) {
        unsupplementedCount += 1;
        return line;
      }

      supplementedCount += 1;
      return `${line} - ${kickoffDisplay}`;
    })
    .join("\n");

  return {
    sourceText: enrichedSourceText,
    supplementedCount,
    unsupplementedCount,
  };
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

export function normalizeOfficialScheduleSourceText(sourceText: string) {
  const lines = sourceText
    .split(/\r?\n/)
    .map(normalizeSourceLine)
    .filter(Boolean);

  const scheduleLines = lines.flatMap((line) => {
    if (parseDateHeader(line)) {
      return [line];
    }

    return expandCompoundScheduleLine(line);
  });

  return (scheduleLines.length > 0 ? scheduleLines : lines).join("\n");
}

export function parseOfficialScheduleTransferPayload(rawValue: string | null | undefined) {
  if (!rawValue?.trim()) {
    return null;
  }

  try {
    const parsed = JSON.parse(rawValue) as Partial<OfficialScheduleTransferPayload>;
    if (
      parsed.kind !== officialScheduleTransferPayloadKind ||
      parsed.version !== officialScheduleTransferPayloadVersion ||
      typeof parsed.sourceText !== "string" ||
      !parsed.sourceText.trim()
    ) {
      return null;
    }

    return {
      importedAt: typeof parsed.importedAt === "string" ? parsed.importedAt : null,
      kind: parsed.kind,
      sourceText: parsed.sourceText,
      sourceUrl: typeof parsed.sourceUrl === "string" ? parsed.sourceUrl : null,
      version: parsed.version,
    } satisfies OfficialScheduleTransferPayload;
  } catch {
    return null;
  }
}

export function buildOfficialScheduleExtractorScript(importPageUrl: string) {
  const basePayload = JSON.stringify({
    kind: officialScheduleTransferPayloadKind,
    version: officialScheduleTransferPayloadVersion,
  });
  const destination = JSON.stringify(importPageUrl);

  return [
    "(() => {",
    "  try {",
    "    const sourceText = document.body?.innerText ?? '';",
    "    if (!sourceText.trim()) {",
    "      alert('FIFAページ本文を取得できませんでした。ページが開き切ってからもう一度試してください。');",
    "      return;",
    "    }",
    `    const payload = ${basePayload};`,
    "    payload.importedAt = new Date().toISOString();",
    "    payload.sourceText = sourceText;",
    "    payload.sourceUrl = window.location.href;",
    "    window.name = JSON.stringify(payload);",
    `    window.location.href = ${destination};`,
    "  } catch (error) {",
    "    alert('抽出に失敗しました: ' + (error && typeof error === 'object' && 'message' in error ? String(error.message) : String(error)));",
    "  }",
    "})();",
  ].join("");
}

export function buildOfficialScheduleBookmarklet(importPageUrl: string) {
  return `javascript:${buildOfficialScheduleExtractorScript(importPageUrl)}`;
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
  const normalizedSourceText = normalizeOfficialScheduleSourceText(input.sourceText);

  normalizedSourceText
    .split(/\r?\n/)
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

  if (fixtures.length > 0 && fixtures.every((fixture) => fixture.kickoffTime === null)) {
    warnings.push("このソースには kickoff time が含まれていないため、時刻は未入力のままです。");
  }

  return {
    duplicates,
    fixtures,
    warnings,
  } satisfies OfficialScheduleParseResult;
}
