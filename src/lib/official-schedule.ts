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

const dashPattern = /\s*[‐‑‒–—―-]\s*/;
const dashTokenPattern = /[‐‑‒–—―-]/;
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

export type FifaOfficialScheduleFetchResult = {
  articleTitle: string | null;
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

function collectFifaRichTextBlocks(
  node: FifaOfficialRichTextNode | undefined,
  blocks: string[],
) {
  if (!node) {
    return;
  }

  if (isBlockNode(node.nodeType)) {
    const text = flattenFifaRichTextInline(node).trim();
    if (text) {
      blocks.push(text);
    }
    return;
  }

  (node.content ?? []).forEach((child) => collectFifaRichTextBlocks(child, blocks));
}

export function extractOfficialScheduleSourceTextFromFifaRichText(
  richText: FifaOfficialRichTextNode | null | undefined,
) {
  const blocks: string[] = [];
  collectFifaRichTextBlocks(richText ?? undefined, blocks);
  return blocks.join("\n");
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

  return {
    articleTitle: article.articleTitle ?? null,
    pageApiUrl,
    sourceText: normalizedSourceText,
    sourceUrl,
    warnings,
  } satisfies FifaOfficialScheduleFetchResult;
}

function isLikelyMatchLine(line: string) {
  return teamSeparatorPattern.test(line) && dashTokenPattern.test(line);
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

export function normalizeOfficialScheduleSourceText(sourceText: string) {
  const lines = sourceText
    .split(/\r?\n/)
    .map(normalizeSourceLine)
    .filter(Boolean);

  const scheduleLines = lines.filter(
    (line) => Boolean(parseDateHeader(line)) || isLikelyMatchLine(line),
  );

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

  return {
    duplicates,
    fixtures,
    warnings,
  } satisfies OfficialScheduleParseResult;
}
