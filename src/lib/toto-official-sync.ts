export type ParsedTotoOfficialMatch = {
  awayTeam: string;
  goal3FixtureNo?: number | null;
  goal3TeamRole?: "home" | "away" | null;
  homeTeam: string;
  kickoffTime: string | null;
  matchStatus: "scheduled" | "played" | "cancelled" | "postponed" | "void" | "unknown";
  officialMatchNo: number;
  officialVote0: number | null;
  officialVote1: number | null;
  officialVote2: number | null;
  officialVote3?: number | null;
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

function htmlRowToCells(rowHtml: string) {
  const normalized = rowHtml
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, "|");

  return normalizeText(normalized)
    .split("|")
    .map((cell) => normalizeText(cell))
    .filter(Boolean);
}

function htmlToTableRows(rawHtml: string) {
  return [...rawHtml.matchAll(/<tr[\s\S]*?<\/tr>/gi)]
    .map((match) => htmlRowToCells(match[0]))
    .filter((cells) => cells.length > 0);
}

function extractHoldCountId(value: string | null | undefined) {
  if (!value) {
    return null;
  }

  try {
    const url = new URL(value);
    return normalizeText(url.searchParams.get("holdCntId") ?? "") || null;
  } catch {
    const match = value.match(/holdCntId=(\d+)/i);
    return match?.[1] ?? null;
  }
}

function buildGoal3VoteRateUrl(rawHtml: string, sourceUrl: string) {
  const explicitMatch = rawHtml.match(
    /https:\/\/store\.toto-dream\.com\/dcs\/subos\/screen\/pi09\/spin003\/PGSPIN00301InitVoteRate\.form\?holdCntId=\d+&commodityId=02|(?:\.\/)?PGSPIN00301InitVoteRate\.form\?holdCntId=\d+&commodityId=02/i,
  );

  if (explicitMatch?.[0]) {
    const rawPath = explicitMatch[0];
    if (rawPath.startsWith("http")) {
      return rawPath;
    }

    return new URL(rawPath.replace(/^\.\//, ""), sourceUrl).toString();
  }

  const holdCntId = extractHoldCountId(sourceUrl);
  if (!holdCntId) {
    return null;
  }

  return `https://store.toto-dream.com/dcs/subos/screen/pi09/spin003/PGSPIN00301InitVoteRate.form?holdCntId=${holdCntId}&commodityId=02`;
}

function isGoal3Label(normalizedLabel: string) {
  return normalizedLabel.startsWith("totogoal3") || normalizedLabel.startsWith("toto goal3");
}

function compactProductLabel(value: string) {
  return value
    .replace(/[‐‑‒–—―−-]/g, "")
    .replace(/\s+/g, "")
    .trim()
    .toLowerCase();
}

function isToto13Label(label: string) {
  const compact = compactProductLabel(label);
  return compact === "toto" || compact === "worldtoto" || compact === "ワールドtoto";
}

function displayProductLabel(label: string, fallback: string) {
  const normalized = label
    .replace(/[‐‑‒–—―−-]/g, "-")
    .replace(/\s+/g, " ")
    .trim();

  return normalized || fallback;
}

function isGoal3VoteRateHtml(rawHtml: string) {
  return /totoGOAL3[\s\S]*投票状況|0点[\s\S]*1点[\s\S]*2点[\s\S]*3点以上/.test(rawHtml);
}

function isGoal3VoteRateUnavailableHtml(rawHtml: string) {
  return rawHtml.includes("ご指定の投票状況は表示できません");
}

function parseGoal3VoteRatePercent(value: string) {
  const match = value.match(/([\d.]+)%/);
  if (!match) {
    return null;
  }

  return Number.parseFloat(match[1] ?? "0") / 100;
}

function parseGoal3VoteRateRowsFromTable(
  rawHtml: string,
  kickoffYear: number | null,
) {
  const teamRows: ParsedTotoOfficialMatch[] = [];
  let currentKickoff: string | null = null;

  for (const cells of htmlToTableRows(rawHtml)) {
    if (
      cells.length >= 9 &&
      /^\d{2}\/\d{2}$/.test(cells[0] ?? "") &&
      /^[0-2]?\d[:：][0-5]\d$/.test(cells[1] ?? "") &&
      /^\d+$/.test(cells[2] ?? "") &&
      /^(ホーム|アウェイ)$/.test(cells[4] ?? "")
    ) {
      currentKickoff = parseMatchKickoff(kickoffYear, cells[0] ?? "", cells[1] ?? "");
      const officialMatchNo = Number.parseInt(cells[2] ?? "0", 10);
      teamRows.push({
        awayTeam: "",
        goal3FixtureNo: Math.ceil(officialMatchNo / 2),
        goal3TeamRole: cells[4] === "ホーム" ? "home" : "away",
        homeTeam: cells[3] ?? "未設定",
        kickoffTime: currentKickoff,
        matchStatus: "scheduled",
        officialMatchNo,
        officialVote0: parseGoal3VoteRatePercent(cells[5] ?? ""),
        officialVote1: parseGoal3VoteRatePercent(cells[6] ?? ""),
        officialVote2: parseGoal3VoteRatePercent(cells[7] ?? ""),
        officialVote3: parseGoal3VoteRatePercent(cells[8] ?? ""),
        sourceText: cells.join(" | "),
        stage: cells[4] ?? null,
        venue: null,
      });
      continue;
    }

    if (
      cells.length >= 7 &&
      /^\d+$/.test(cells[0] ?? "") &&
      /^(ホーム|アウェイ)$/.test(cells[2] ?? "")
    ) {
      const officialMatchNo = Number.parseInt(cells[0] ?? "0", 10);
      teamRows.push({
        awayTeam: "",
        goal3FixtureNo: Math.ceil(officialMatchNo / 2),
        goal3TeamRole: cells[2] === "ホーム" ? "home" : "away",
        homeTeam: cells[1] ?? "未設定",
        kickoffTime: currentKickoff,
        matchStatus: "scheduled",
        officialMatchNo,
        officialVote0: parseGoal3VoteRatePercent(cells[3] ?? ""),
        officialVote1: parseGoal3VoteRatePercent(cells[4] ?? ""),
        officialVote2: parseGoal3VoteRatePercent(cells[5] ?? ""),
        officialVote3: parseGoal3VoteRatePercent(cells[6] ?? ""),
        sourceText: cells.join(" | "),
        stage: cells[2] ?? null,
        venue: null,
      });
    }
  }

  return teamRows;
}

function parseGoal3SalesPeriod(value: string) {
  const match = value.match(
    /(\d{4})年\s*(\d{1,2})月\s*(\d{1,2})日.*?[～~]\s*(\d{4})年\s*(\d{1,2})月\s*(\d{1,2})日/,
  );

  if (!match) {
    return {
      salesEndAt: null,
      salesStartAt: null,
    };
  }

  return {
    salesStartAt: toIsoTimestamp(
      Number.parseInt(match[1] ?? "0", 10),
      Number.parseInt(match[2] ?? "0", 10),
      Number.parseInt(match[3] ?? "0", 10),
      null,
      "00:00",
    ),
    salesEndAt: toIsoTimestamp(
      Number.parseInt(match[4] ?? "0", 10),
      Number.parseInt(match[5] ?? "0", 10),
      Number.parseInt(match[6] ?? "0", 10),
      null,
      "23:59",
    ),
  };
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
    .replace(/[‐‑‒–—―−-]/g, "-")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();

  if (isToto13Label(label)) {
    const displayLabel = displayProductLabel(label, "toto");
    return {
      officialRoundName: `第${roundNumber}回 ${displayLabel}`,
      officialRoundNumber: roundNumber,
      outcomeSetJson: ["1", "0", "2"],
      productType: "toto13",
      requiredMatchCount: 13,
      title: `第${roundNumber}回 ${displayLabel}`,
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

  if (isGoal3Label(normalized)) {
    return {
      officialRoundName: `第${roundNumber}回 totoGOAL3`,
      officialRoundNumber: roundNumber,
      outcomeSetJson: ["0", "1", "2", "3+"],
      productType: "custom",
      requiredMatchCount: 6,
      title: `第${roundNumber}回 totoGOAL3`,
      voidHandling: "manual",
    };
  }

  return null;
}

function parseGoal3VoteRateHtml(rawHtml: string, sourceUrl: string) {
  if (isGoal3VoteRateUnavailableHtml(rawHtml) || !isGoal3VoteRateHtml(rawHtml)) {
    return null;
  }

  const lines = htmlToLines(rawHtml);
  const titleLine =
    lines.find((line) => /^第\s*\d+\s*回\s*totoGOAL3\s+投票状況$/.test(line)) ?? null;

  if (!titleLine) {
    return null;
  }

  const roundNumber = Number.parseInt(
    titleLine.match(/^第\s*(\d+)\s*回/)?.[1] ?? "0",
    10,
  );

  if (!Number.isFinite(roundNumber)) {
    return null;
  }

  const salesPeriodLine =
    lines.find((line) => line.startsWith("販売期間") && line.includes("～")) ?? null;
  const salesPeriod = salesPeriodLine ? parseGoal3SalesPeriod(salesPeriodLine) : {
    salesEndAt: null,
    salesStartAt: null,
  };
  const kickoffYear =
    inferKickoffYear({
      salesEndAt: salesPeriod.salesEndAt,
      salesStartAt: salesPeriod.salesStartAt,
    }) ?? new Date().getFullYear();

  const teamRows = parseGoal3VoteRateRowsFromTable(rawHtml, kickoffYear);

  if (teamRows.length === 0) {
    let currentKickoff: string | null = null;

    for (const line of lines) {
      const withDate =
        line.match(
          /^(\d{2}\/\d{2})\s+([0-2]?\d[:：][0-5]\d)\s+(\d+)\s+(.+?)\s+(ホーム|アウェイ)\s+[\d,]+[（(]([\d.]+)%[）)]\s+[\d,]+[（(]([\d.]+)%[）)]\s+[\d,]+[（(]([\d.]+)%[）)]\s+[\d,]+[（(]([\d.]+)%[）)]/,
        ) ??
        line.match(
          /^(\d{2}\/\d{2})\s+([0-2]?\d[:：][0-5]\d)\s+(\d+)\s+(.+?)\s+(ホーム|アウェイ)\s+([\d.]+)%\s+([\d.]+)%\s+([\d.]+)%\s+([\d.]+)%/,
        );

      const withoutDate =
        line.match(
          /^(\d+)\s+(.+?)\s+(ホーム|アウェイ)\s+[\d,]+[（(]([\d.]+)%[）)]\s+[\d,]+[（(]([\d.]+)%[）)]\s+[\d,]+[（(]([\d.]+)%[）)]\s+[\d,]+[（(]([\d.]+)%[）)]/,
        ) ??
        line.match(
          /^(\d+)\s+(.+?)\s+(ホーム|アウェイ)\s+([\d.]+)%\s+([\d.]+)%\s+([\d.]+)%\s+([\d.]+)%/,
        );

      if (withDate) {
        currentKickoff = parseMatchKickoff(kickoffYear, withDate[1] ?? "", withDate[2] ?? "");
        const officialMatchNo = Number.parseInt(withDate[3] ?? "0", 10);
        teamRows.push({
          awayTeam: "",
          goal3FixtureNo: Math.ceil(officialMatchNo / 2),
          goal3TeamRole: withDate[5] === "ホーム" ? "home" : "away",
          homeTeam: withDate[4] ?? "未設定",
          kickoffTime: currentKickoff,
          matchStatus: "scheduled",
          officialMatchNo,
          officialVote0: Number.parseFloat(withDate[6] ?? "0") / 100,
          officialVote1: Number.parseFloat(withDate[7] ?? "0") / 100,
          officialVote2: Number.parseFloat(withDate[8] ?? "0") / 100,
          officialVote3: Number.parseFloat(withDate[9] ?? "0") / 100,
          sourceText: line,
          stage: withDate[5] ?? null,
          venue: null,
        });
        continue;
      }

      if (withoutDate) {
        const officialMatchNo = Number.parseInt(withoutDate[1] ?? "0", 10);
        teamRows.push({
          awayTeam: "",
          goal3FixtureNo: Math.ceil(officialMatchNo / 2),
          goal3TeamRole: withoutDate[3] === "ホーム" ? "home" : "away",
          homeTeam: withoutDate[2] ?? "未設定",
          kickoffTime: currentKickoff,
          matchStatus: "scheduled",
          officialMatchNo,
          officialVote0: Number.parseFloat(withoutDate[4] ?? "0") / 100,
          officialVote1: Number.parseFloat(withoutDate[5] ?? "0") / 100,
          officialVote2: Number.parseFloat(withoutDate[6] ?? "0") / 100,
          officialVote3: Number.parseFloat(withoutDate[7] ?? "0") / 100,
          sourceText: line,
          stage: withoutDate[3] ?? null,
          venue: null,
        });
      }
    }
  }

  for (const row of teamRows) {
    const counterpart = teamRows.find(
      (candidate) =>
        candidate.goal3FixtureNo === row.goal3FixtureNo &&
        candidate.officialMatchNo !== row.officialMatchNo,
    );
    row.awayTeam = counterpart?.homeTeam ?? "";
  }

  const salesLine = lines.find((line) => line.startsWith("売上金額"));
  const totalSalesYen = salesLine
    ? Number.parseInt((salesLine.match(/売上金額\s+([\d,]+)円/)?.[1] ?? "0").replaceAll(",", ""), 10)
    : null;
  const round: ParsedTotoOfficialRoundEntry = {
    title: `第${roundNumber}回 totoGOAL3`,
    notes: null,
    officialRoundName: `第${roundNumber}回 totoGOAL3`,
    officialRoundNumber: roundNumber,
    productType: "custom",
    requiredMatchCount: 6,
    outcomeSetJson: ["0", "1", "2", "3+"],
    sourceNote: "スポーツくじオフィシャルサイト 投票状況 / totoGOAL3 Value Board",
    voidHandling: "manual",
    resultStatus: "selling",
    salesStartAt: salesPeriod.salesStartAt,
    salesEndAt: salesPeriod.salesEndAt,
    stakeYen: 100,
    totalSalesYen: Number.isFinite(totalSalesYen) ? totalSalesYen : null,
    returnRate: 0.5,
    firstPrizeShare: 0.6,
    carryoverYen: 0,
    payoutCapYen: null,
    sourceUrl,
    sourceText: lines.join("\n").slice(0, 4000) || null,
    matches: teamRows,
  };

  return {
    rounds: [round],
    warnings: [] as string[],
  };
}

function mergeGoal3FixtureContext(
  baseRound: ParsedTotoOfficialRoundEntry,
  voteRound: ParsedTotoOfficialRoundEntry,
) {
  const enrichedMatches = voteRound.matches.map((row) => {
    const fixture = baseRound.matches[(row.goal3FixtureNo ?? Math.ceil(row.officialMatchNo / 2)) - 1];
    const role = row.goal3TeamRole ?? (row.stage === "ホーム" ? "home" : row.stage === "アウェイ" ? "away" : null);

    return {
      ...row,
      awayTeam:
        row.awayTeam ||
        (fixture
          ? role === "home"
            ? fixture.awayTeam
            : role === "away"
              ? fixture.homeTeam
              : row.awayTeam
          : row.awayTeam),
      kickoffTime: row.kickoffTime ?? fixture?.kickoffTime ?? null,
      venue: row.venue ?? fixture?.venue ?? null,
    };
  });

  return {
    ...baseRound,
    firstPrizeShare: voteRound.firstPrizeShare,
    matches: enrichedMatches,
    sourceNote: "スポーツくじオフィシャルサイト くじ情報 / totoGOAL3 Value Board",
    sourceText: voteRound.sourceText ?? baseRound.sourceText,
    totalSalesYen: voteRound.totalSalesYen ?? baseRound.totalSalesYen,
  } satisfies ParsedTotoOfficialRoundEntry;
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
  const tableRows = htmlToTableRows(rawHtml);
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
    if (current.matches.length > 0 && !current.outcomeSetJson?.includes("3+")) {
      current.requiredMatchCount = current.matches.length;
    }
    rounds.push(current);
  };

  const parseSectionTitle = (titleLine: string) => {
    const sectionMatch = titleLine.match(/^第\s*(\d+)\s*回\s*(.+?)\s*くじ情報$/);
    if (!sectionMatch) {
      return false;
    }

    finalizeCurrent();
    sectionLines = [titleLine];

    const roundNumber = Number.parseInt(sectionMatch[1] ?? "0", 10);
    const label = sectionMatch[2] ?? "";
    const product = mapLotInfoProduct(label, roundNumber);

    if (!product) {
      current = null;
      warnings.push(`${titleLine} は現在の主導線に載せていない商品なので、今回は一覧同期だけを見送りました。`);
      return true;
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
      sourceNote:
        product.outcomeSetJson?.includes("3+")
          ? "スポーツくじオフィシャルサイト くじ情報 / totoGOAL3 Value Board"
          : "スポーツくじオフィシャルサイト くじ情報",
      matches: [],
    };
    return true;
  };

  for (const row of tableRows) {
    const rowText = row.join(" ");

    if (row.length === 1 && parseSectionTitle(row[0] ?? "")) {
      continue;
    }

    if (current === null) {
      continue;
    }
    const currentRound = current as ParsedTotoOfficialRoundEntry;

    sectionLines.push(rowText);

    if (row[0] === "販売開始日" && row[1]) {
      currentRound.salesStartAt = parseJapaneseDateTime(row[1], "00:00");
      continue;
    }

    if (row[0] === "販売終了日" && row[1]) {
      currentRound.salesEndAt = parseJapaneseDateTime(row[1], "23:59");
      continue;
    }

    if (row[0] === "売上金額" && row[1] && currentRound.totalSalesYen === null) {
      currentRound.totalSalesYen = Number.parseInt(row[1].replaceAll(",", "").replace("円", ""), 10);
      continue;
    }

    if (currentRound.totalSalesYen === null) {
      const salesMatch = rowText.match(/売上金額\s+([\d,]+)円/);
      if (salesMatch) {
        currentRound.totalSalesYen = Number.parseInt((salesMatch[1] ?? "0").replaceAll(",", ""), 10);
        continue;
      }
    }

    if (
      row.length >= 7 &&
      /^\d+$/.test(row[0] ?? "") &&
      /^\d{2}\/\d{2}$/.test(row[1] ?? "") &&
      /^[0-2]?\d[:：][0-5]\d$/.test(row[2] ?? "") &&
      /^(VS|vs|v)$/.test(row[5] ?? "")
    ) {
      const kickoffYear = inferKickoffYear(currentRound);
      currentRound.matches.push({
        awayTeam: row[6] ?? "未設定",
        homeTeam: row[4] ?? "未設定",
        kickoffTime: parseMatchKickoff(kickoffYear, row[1] ?? "", row[2] ?? ""),
        matchStatus: resultStatus === "resulted" ? "played" : "scheduled",
        officialMatchNo: Number.parseInt(row[0] ?? "0", 10),
        officialVote0: null,
        officialVote1: null,
        officialVote2: null,
        sourceText: rowText,
        stage: null,
        venue: row[3] ?? null,
      });
      continue;
    }

    const matchLine = rowText.match(
      /^(\d+)\s+(\d{2}\/\d{2})\s+([0-2]?\d[:：][0-5]\d)\s+(\S+)\s+(.+?)\s+(?:VS|vs|v)\s+(.+?)(?:\s+データ)?$/,
    );
    if (matchLine) {
      const kickoffYear = inferKickoffYear(currentRound);
      currentRound.matches.push({
        awayTeam: matchLine[6] ?? "未設定",
        homeTeam: matchLine[5] ?? "未設定",
        kickoffTime: parseMatchKickoff(kickoffYear, matchLine[2] ?? "", matchLine[3] ?? ""),
        matchStatus: resultStatus === "resulted" ? "played" : "scheduled",
        officialMatchNo: Number.parseInt(matchLine[1] ?? "0", 10),
        officialVote0: null,
        officialVote1: null,
        officialVote2: null,
        sourceText: rowText,
        stage: null,
        venue: matchLine[4] ?? null,
      });
    }
  }

  if (rounds.length === 0 && tableRows.length === 0) {
    for (const line of lines) {
      if (parseSectionTitle(line)) {
        continue;
      }

      if (current === null) {
        continue;
      }
      const currentRound = current as ParsedTotoOfficialRoundEntry;

      sectionLines.push(line);

      if (line.startsWith("販売開始日")) {
        currentRound.salesStartAt = parseJapaneseDateTime(line, "00:00");
        continue;
      }

      if (line.startsWith("販売終了日")) {
        currentRound.salesEndAt = parseJapaneseDateTime(line, "23:59");
        continue;
      }

      if (line.startsWith("売上金額") && currentRound.totalSalesYen === null) {
        const salesMatch = line.match(/売上金額\s+([\d,]+)円/);
        if (salesMatch) {
          currentRound.totalSalesYen = Number.parseInt((salesMatch[1] ?? "0").replaceAll(",", ""), 10);
        }
        continue;
      }

      const matchLine = line.match(
        /^(\d+)\s+(\d{2}\/\d{2})\s+([0-2]?\d[:：][0-5]\d)\s+(\S+)\s+(.+?)\s+(?:VS|vs|v)\s+(.+?)(?:\s+データ)?$/,
      );
      if (!matchLine) {
        continue;
      }

      const kickoffYear = inferKickoffYear(currentRound);
      currentRound.matches.push({
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
  }

  finalizeCurrent();

  return {
    rounds,
    warnings,
  };
}

export async function parseTotoOfficialHtmlSource(input: ParseHtmlInput) {
  const goal3VoteRate = parseGoal3VoteRateHtml(input.rawText, input.sourceUrl);
  if (goal3VoteRate) {
    return goal3VoteRate;
  }

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

          const goal3HydratedRounds = await Promise.all(
            detailed.rounds.map(async (round) => {
              if (!round.outcomeSetJson?.includes("3+")) {
                return round;
              }

              const voteRateUrl = buildGoal3VoteRateUrl(detailHtml, summary.detailUrl ?? input.sourceUrl);
              if (!voteRateUrl) {
                warnings.push(`${round.title} の投票状況URLを見つけられませんでした。`);
                return round;
              }

              try {
                const voteHtml = await fetchText(voteRateUrl);
                if (isGoal3VoteRateUnavailableHtml(voteHtml)) {
                  return round;
                }

                const voteRate = parseGoal3VoteRateHtml(voteHtml, voteRateUrl);
                if (!voteRate?.rounds[0] || voteRate.rounds[0].matches.length === 0) {
                  if (round.resultStatus !== "draft") {
                    warnings.push(`${round.title} の投票状況詳細はまだ整っていないため、くじ情報だけ取り込みました。`);
                  }
                  return round;
                }

                return mergeGoal3FixtureContext(round, voteRate.rounds[0]);
              } catch (error) {
                warnings.push(
                  `${round.title} の投票状況取得に失敗しました: ${(error as Error).message}`,
                );
                return round;
              }
            }),
          );

          if (goal3HydratedRounds.length > 0) {
            rounds.push(...goal3HydratedRounds);
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
  return /scheduleResultList|scheduleResultItem|指定試合（ホームvsアウェイ）|くじ情報|投票状況|0点[\s\S]*3点以上/.test(rawText);
}
