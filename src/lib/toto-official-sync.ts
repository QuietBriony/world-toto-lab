export type ParsedTotoOfficialMatch = {
  awayTeam: string;
  homeTeam: string;
  kickoffTime: string | null;
  matchStatus: "scheduled" | "played" | "cancelled" | "postponed" | "void" | "unknown";
  officialMatchNo: number;
  officialVote0: number | null;
  officialVote1: number | null;
  officialVote2: number | null;
  sourceText: string | null;
  stage: string | null;
  venue: string | null;
};

export type ParsedTotoOfficialRoundEntry = {
  title: string;
  notes: string | null;
  officialRoundName: string | null;
  officialRoundNumber: number | null;
  productType: "toto13" | "mini_toto" | "winner" | "custom";
  requiredMatchCount: number | null;
  outcomeSetJson: string[] | null;
  sourceNote: string | null;
  voidHandling: "manual" | "all_outcomes_valid" | "exclude_from_combo" | "keep_as_pending";
  resultStatus: "draft" | "selling" | "closed" | "resulted" | "cancelled" | "unknown";
  salesStartAt: string | null;
  salesEndAt: string | null;
  stakeYen: number;
  totalSalesYen: number | null;
  returnRate: number;
  firstPrizeShare: number | null;
  carryoverYen: number;
  payoutCapYen: number | null;
  sourceUrl: string | null;
  sourceText: string | null;
  matches: ParsedTotoOfficialMatch[];
};

type ScheduleSummary = {
  actionLabel: string | null;
  detailUrl: string | null;
  officialRoundNumber: number;
  resultStatus: ParsedTotoOfficialRoundEntry["resultStatus"];
  salesEndAt: string | null;
  salesStartAt: string | null;
  sourceNote: string;
  sourceText: string | null;
  title: string;
};

type ParseHtmlInput = {
  fetchText?: (url: string) => Promise<string>;
  includeMatches?: boolean;
  rawText: string;
  sourceUrl: string;
};

function normalizeText(value: string) {
  return value
    .replace(/\u00a0/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&#xFF5C;/gi, "|")
    .replace(/&#65293;/gi, "-")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/[\t\r]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function toIsoTimestamp(
  year: number,
  month: number,
  day: number,
  time: string | null,
  fallbackTime: string,
) {
  const normalizedTime = (time ?? fallbackTime).replace("：", ":");
  const [hoursRaw, minutesRaw] = normalizedTime.split(":");
  const hours = Number.parseInt(hoursRaw ?? "0", 10);
  const minutes = Number.parseInt(minutesRaw ?? "0", 10);

  return `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}T${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:00+09:00`;
}

function parseScheduleDate(value: string, fallbackTime: string) {
  const match = value.match(/(\d{4})\/(\d{1,2})\/(\d{1,2})/);
  if (!match) {
    return null;
  }

  return toIsoTimestamp(
    Number.parseInt(match[1] ?? "0", 10),
    Number.parseInt(match[2] ?? "0", 10),
    Number.parseInt(match[3] ?? "0", 10),
    null,
    fallbackTime,
  );
}

function parseJapaneseDateTime(value: string, fallbackTime: string) {
  const dateMatch = value.match(/(\d{4})年\s*(\d{1,2})月\s*(\d{1,2})日/);
  if (!dateMatch) {
    return null;
  }

  const explicitTime = value.match(/([0-2]?\d[:：][0-5]\d)/)?.[1] ?? null;

  return toIsoTimestamp(
    Number.parseInt(dateMatch[1] ?? "0", 10),
    Number.parseInt(dateMatch[2] ?? "0", 10),
    Number.parseInt(dateMatch[3] ?? "0", 10),
    explicitTime,
    fallbackTime,
  );
}

function inferKickoffYear(round: Pick<ParsedTotoOfficialRoundEntry, "salesEndAt" | "salesStartAt">) {
  const source = round.salesEndAt ?? round.salesStartAt;
  if (!source) {
    return null;
  }

  const match = source.match(/^(\d{4})-/);
  return match ? Number.parseInt(match[1] ?? "0", 10) : null;
}

function parseMatchKickoff(year: number | null, monthDay: string, time: string) {
  if (year === null) {
    return null;
  }

  const [monthRaw, dayRaw] = monthDay.split("/");
  const month = Number.parseInt(monthRaw ?? "0", 10);
  const day = Number.parseInt(dayRaw ?? "0", 10);

  if (!Number.isFinite(month) || !Number.isFinite(day)) {
    return null;
  }

  return toIsoTimestamp(year, month, day, time, "00:00");
}

function htmlToLines(rawHtml: string) {
  return rawHtml
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<(?:br|\/tr|\/li|\/p|\/div|\/table|\/tbody|\/thead|\/section|\/article|\/ul|\/ol)[^>]*>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/\r/g, "")
    .split("\n")
    .map((line) => normalizeText(line))
    .filter(Boolean);
}

function mapScheduleStatus(value: string): ParsedTotoOfficialRoundEntry["resultStatus"] {
  if (value.includes("販売中")) {
    return "selling";
  }
  if (value.includes("これから")) {
    return "draft";
  }
  if (value.includes("終了")) {
    return "closed";
  }
  return "unknown";
}

function buildRoundEntryFromSchedule(summary: ScheduleSummary): ParsedTotoOfficialRoundEntry {
  return {
    title: summary.title,
    notes: null,
    officialRoundName: summary.title,
    officialRoundNumber: summary.officialRoundNumber,
    productType: "toto13",
    requiredMatchCount: 13,
    outcomeSetJson: ["1", "0", "2"],
    sourceNote: summary.sourceNote,
    voidHandling: "manual",
    resultStatus: summary.resultStatus,
    salesStartAt: summary.salesStartAt,
    salesEndAt: summary.salesEndAt,
    stakeYen: 100,
    totalSalesYen: null,
    returnRate: 0.5,
    firstPrizeShare: 0.7,
    carryoverYen: 0,
    payoutCapYen: null,
    sourceUrl: summary.detailUrl,
    sourceText: summary.sourceText,
    matches: [],
  };
}

function mapLotInfoProduct(
  label: string,
  roundNumber: number,
): Omit<
  ParsedTotoOfficialRoundEntry,
  | "carryoverYen"
  | "firstPrizeShare"
  | "matches"
  | "notes"
  | "payoutCapYen"
  | "resultStatus"
  | "returnRate"
  | "salesEndAt"
  | "salesStartAt"
  | "sourceNote"
  | "sourceText"
  | "sourceUrl"
  | "stakeYen"
  | "totalSalesYen"
> | null {
  const normalized = label
    .replace(/[‐‑‒–—―ー−]/g, "-")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();

  if (normalized === "toto") {
    return {
      officialRoundName: `第${roundNumber}回 toto`,
      officialRoundNumber: roundNumber,
      outcomeSetJson: ["1", "0", "2"],
      productType: "toto13",
      requiredMatchCount: 13,
      title: `第${roundNumber}回 toto`,
      voidHandling: "manual",
    };
  }

  if (normalized.startsWith("mini toto-a組") || normalized.startsWith("mini toto a組")) {
    return {
      officialRoundName: `第${roundNumber}回 mini toto-A組`,
      officialRoundNumber: roundNumber,
      outcomeSetJson: ["1", "0", "2"],
      productType: "mini_toto",
      requiredMatchCount: 5,
      title: `第${roundNumber}回 mini toto-A組`,
      voidHandling: "manual",
    };
  }

  if (normalized.startsWith("mini toto-b組") || normalized.startsWith("mini toto b組")) {
    return {
      officialRoundName: `第${roundNumber}回 mini toto-B組`,
      officialRoundNumber: roundNumber,
      outcomeSetJson: ["1", "0", "2"],
      productType: "mini_toto",
      requiredMatchCount: 5,
      title: `第${roundNumber}回 mini toto-B組`,
      voidHandling: "manual",
    };
  }

  if (normalized.startsWith("winner")) {
    return {
      officialRoundName: `第${roundNumber}回 ${label}`,
      officialRoundNumber: roundNumber,
      outcomeSetJson: ["1", "0", "2"],
      productType: "winner",
      requiredMatchCount: 1,
      title: `第${roundNumber}回 ${label}`,
      voidHandling: "manual",
    };
  }

  return null;
}

export function parseYahooTotoScheduleHtml(rawHtml: string) {
  const summaries: ScheduleSummary[] = [];
  const itemRegex = /<li class="scheduleResultItem">([\s\S]*?)<\/li>/gi;

  for (const match of rawHtml.matchAll(itemRegex)) {
    const block = match[1] ?? "";
    const roundNumberMatch = block.match(/第\s*(\d+)\s*回/i);
    if (!roundNumberMatch) {
      continue;
    }

    const roundNumber = Number.parseInt(roundNumberMatch[1] ?? "0", 10);
    if (!Number.isFinite(roundNumber)) {
      continue;
    }

    const statusText = normalizeText(block.match(/<p class="ico[^"]*">([\s\S]*?)<\/p>/i)?.[1] ?? "");
    const periodMatch = block.match(/（(\d{4}\/\d{1,2}\/\d{1,2})-(\d{4}\/\d{1,2}\/\d{1,2})）/);
    const linkMatch = block.match(/<a href="([^"]+)" class="scheduleResultLink">([\s\S]*?)<\/a>/i);
    const detailUrl = linkMatch ? normalizeText(linkMatch[1] ?? "") : null;
    const actionLabel = linkMatch ? normalizeText(linkMatch[2] ?? "") : null;

    summaries.push({
      actionLabel,
      detailUrl,
      officialRoundNumber: roundNumber,
      resultStatus: mapScheduleStatus(statusText),
      salesEndAt: periodMatch ? parseScheduleDate(periodMatch[2] ?? "", "23:59") : null,
      salesStartAt: periodMatch ? parseScheduleDate(periodMatch[1] ?? "", "00:00") : null,
      sourceNote: `Yahoo! toto 販売スケジュール / ${statusText || "状態不明"}`,
      sourceText: normalizeText(block),
      title: `第${roundNumber}回 toto`,
    });
  }

  return summaries;
}

export function parseOfficialTotoLotInfoHtml(
  rawHtml: string,
  sourceUrl: string,
  resultStatus: ParsedTotoOfficialRoundEntry["resultStatus"] = "unknown",
) {
  const lines = htmlToLines(rawHtml);
  const rounds: ParsedTotoOfficialRoundEntry[] = [];
  const warnings: string[] = [];
  let current: ParsedTotoOfficialRoundEntry | null = null;
  let sectionLines: string[] = [];

  const finalizeCurrent = () => {
    if (!current) {
      return;
    }

    current.sourceText = sectionLines.join("\n").slice(0, 4000) || null;
    current.requiredMatchCount = current.matches.length > 0
      ? current.matches.length
      : current.requiredMatchCount;
    rounds.push(current);
  };

  for (const line of lines) {
    const sectionMatch = line.match(/^第\s*(\d+)\s*回\s*(.+?)\s*くじ情報$/);
    if (sectionMatch) {
      finalizeCurrent();
      sectionLines = [line];

      const roundNumber = Number.parseInt(sectionMatch[1] ?? "0", 10);
      const label = sectionMatch[2] ?? "";
      const product = mapLotInfoProduct(label, roundNumber);

      if (!product) {
        current = null;
        warnings.push(`${line} は現在の Round Builder では未対応のため同期対象から外しました。`);
        continue;
      }

      current = {
        ...product,
        notes: null,
        resultStatus,
        salesStartAt: null,
        salesEndAt: null,
        stakeYen: 100,
        totalSalesYen: null,
        returnRate: 0.5,
        firstPrizeShare: 0.7,
        carryoverYen: 0,
        payoutCapYen: null,
        sourceUrl,
        sourceText: null,
        sourceNote: "スポーツくじオフィシャルサイト くじ情報",
        matches: [],
      };
      continue;
    }

    if (!current) {
      continue;
    }

    sectionLines.push(line);

    if (line.startsWith("販売開始日")) {
      current.salesStartAt = parseJapaneseDateTime(line, "00:00");
      continue;
    }

    if (line.startsWith("販売終了日")) {
      current.salesEndAt = parseJapaneseDateTime(line, "23:59");
      continue;
    }

    if (line.startsWith("売上金額") && current.totalSalesYen === null) {
      const salesMatch = line.match(/売上金額\s+([\d,]+)円/);
      if (salesMatch) {
        current.totalSalesYen = Number.parseInt((salesMatch[1] ?? "0").replaceAll(",", ""), 10);
      }
      continue;
    }

    const matchLine = line.match(
      /^(\d+)\s+(\d{2}\/\d{2})\s+([0-2]?\d[:：][0-5]\d)\s+(\S+)\s+(.+?)\s+(?:VS|vs|v)\s+(.+?)(?:\s+データ)?$/,
    );
    if (!matchLine) {
      continue;
    }

    const kickoffYear = inferKickoffYear(current);
    current.matches.push({
      awayTeam: matchLine[6] ?? "未設定",
      homeTeam: matchLine[5] ?? "未設定",
      kickoffTime: parseMatchKickoff(kickoffYear, matchLine[2] ?? "", matchLine[3] ?? ""),
      matchStatus: resultStatus === "resulted" ? "played" : "scheduled",
      officialMatchNo: Number.parseInt(matchLine[1] ?? "0", 10),
      officialVote0: null,
      officialVote1: null,
      officialVote2: null,
      sourceText: line,
      stage: null,
      venue: matchLine[4] ?? null,
    });
  }

  finalizeCurrent();

  return {
    rounds,
    warnings,
  };
}

export async function parseTotoOfficialHtmlSource(input: ParseHtmlInput) {
  const scheduleSummaries = parseYahooTotoScheduleHtml(input.rawText);
  if (scheduleSummaries.length > 0) {
    const warnings: string[] = [];
    const rounds: ParsedTotoOfficialRoundEntry[] = [];
    const fetchText = input.fetchText;

    for (const summary of scheduleSummaries) {
      const canHydrateDetail = Boolean(
        input.includeMatches &&
          fetchText &&
          summary.detailUrl &&
          summary.actionLabel?.includes("くじ情報を見る"),
      );

      if (canHydrateDetail && summary.detailUrl && fetchText) {
        try {
          const detailHtml = await fetchText(summary.detailUrl);
          const detailed = parseOfficialTotoLotInfoHtml(
            detailHtml,
            summary.detailUrl,
            summary.resultStatus,
          );

          if (detailed.rounds.length > 0) {
            rounds.push(...detailed.rounds);
            warnings.push(...detailed.warnings);
            continue;
          }

          warnings.push(`第${summary.officialRoundNumber}回の公式くじ情報ページを解釈できませんでした。`);
        } catch (error) {
          warnings.push(
            `第${summary.officialRoundNumber}回の公式くじ情報ページ取得に失敗しました: ${(error as Error).message}`,
          );
        }
      }

      rounds.push(buildRoundEntryFromSchedule(summary));
    }

    return { rounds, warnings };
  }

  return parseOfficialTotoLotInfoHtml(input.rawText, input.sourceUrl);
}

export function looksLikeTotoOfficialHtml(rawText: string) {
  return /scheduleResultList|scheduleResultItem|指定試合（ホームvsアウェイ）|くじ情報/.test(rawText);
}
