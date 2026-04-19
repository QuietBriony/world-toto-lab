export type FixtureImportRow = {
  adminNote: string | null;
  awayTeam: string;
  homeTeam: string;
  kickoffTime: string | null;
  matchNo: number;
  stage: string | null;
  venue: string | null;
};

type ParseFixtureImportResult = {
  rows: FixtureImportRow[];
  warnings: string[];
};

const headerNames = new Set([
  "no",
  "matchno",
  "match",
  "番号",
  "試合",
  "kickoff",
  "date",
  "time",
  "日時",
  "開始",
  "ホーム",
  "home",
  "アウェイ",
  "away",
  "会場",
  "venue",
  "ステージ",
  "stage",
  "メモ",
  "note",
]);

function splitLine(line: string) {
  if (line.includes("\t")) {
    return line.split("\t").map((part) => part.trim());
  }

  if (line.includes("|")) {
    return line.split("|").map((part) => part.trim());
  }

  return line.split(",").map((part) => part.trim());
}

function looksLikeHeader(cells: string[]) {
  return cells.every((cell) => headerNames.has(cell.toLowerCase().replace(/\s+/g, "")));
}

function normalizeKickoff(raw: string) {
  const value = raw.trim();
  if (!value) {
    return null;
  }

  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return `${value}T00:00:00`;
  }

  const normalized = value
    .replace(/\//g, "-")
    .replace(/\s+/, "T")
    .replace(/T(\d{2}):(\d{2})$/, "T$1:$2:00");

  const timestamp = Date.parse(normalized);
  if (Number.isNaN(timestamp)) {
    return null;
  }

  return new Date(timestamp).toISOString();
}

function emptyToNull(value: string | undefined) {
  const trimmed = (value ?? "").trim();
  return trimmed ? trimmed : null;
}

export const fixtureImportTemplate = [
  "番号\t開始日時\tホーム\tアウェイ\t会場\tステージ\tメモ",
  "1\t2026-06-11 19:00\tチームA\tチームB\t会場A\tグループA\t公式日程から貼り付け",
  "2\t2026-06-11 22:00\tチームC\tチームD\t会場B\tグループA\t",
].join("\n");

export function parseFixtureImportText(input: string): ParseFixtureImportResult {
  const warnings: string[] = [];
  const rows: FixtureImportRow[] = [];
  const lines = input
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && !line.startsWith("#"));

  if (lines.length === 0) {
    return {
      rows: [],
      warnings: ["貼り付け内容が空です。"],
    };
  }

  let sequenceMatchNo = 1;

  lines.forEach((line, index) => {
    const cells = splitLine(line);

    if (index === 0 && looksLikeHeader(cells)) {
      return;
    }

    let matchNo = sequenceMatchNo;
    let kickoffCell = "";
    let homeCell = "";
    let awayCell = "";
    let venueCell = "";
    let stageCell = "";
    let noteCell = "";

    if (cells.length >= 7 && /^\d+$/.test(cells[0] ?? "")) {
      matchNo = Number.parseInt(cells[0] ?? "", 10);
      kickoffCell = cells[1] ?? "";
      homeCell = cells[2] ?? "";
      awayCell = cells[3] ?? "";
      venueCell = cells[4] ?? "";
      stageCell = cells[5] ?? "";
      noteCell = cells.slice(6).join(" / ");
    } else if (cells.length >= 6) {
      kickoffCell = cells[0] ?? "";
      homeCell = cells[1] ?? "";
      awayCell = cells[2] ?? "";
      venueCell = cells[3] ?? "";
      stageCell = cells[4] ?? "";
      noteCell = cells.slice(5).join(" / ");
    } else if (cells.length >= 4) {
      kickoffCell = cells[0] ?? "";
      homeCell = cells[1] ?? "";
      awayCell = cells[2] ?? "";
      venueCell = cells[3] ?? "";
      stageCell = cells[4] ?? "";
      noteCell = cells.slice(5).join(" / ");
    } else {
      warnings.push(`行 ${index + 1} は列が足りないため読み込めませんでした。`);
      return;
    }

    const kickoffTime = normalizeKickoff(kickoffCell);
    if (kickoffCell && !kickoffTime) {
      warnings.push(`行 ${index + 1} の開始日時を読めませんでした。YYYY-MM-DD HH:mm 形式で入れてください。`);
      return;
    }

    if (!homeCell || !awayCell) {
      warnings.push(`行 ${index + 1} のホーム / アウェイが不足しています。`);
      return;
    }

    rows.push({
      adminNote: emptyToNull(noteCell),
      awayTeam: awayCell,
      homeTeam: homeCell,
      kickoffTime,
      matchNo,
      stage: emptyToNull(stageCell),
      venue: emptyToNull(venueCell),
    });

    sequenceMatchNo += 1;
  });

  return { rows, warnings };
}
