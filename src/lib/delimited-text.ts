export type Delimiter = "," | "\t" | "|";

export function detectDelimiter(line: string): Delimiter {
  if (line.includes("\t")) {
    return "\t";
  }

  if (line.includes("|")) {
    return "|";
  }

  return ",";
}

export function splitDelimitedLine(line: string, delimiter: Delimiter = detectDelimiter(line)) {
  const cells: string[] = [];
  let current = "";
  let quoted = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    const next = line[index + 1];

    if (char === "\"") {
      if (quoted && next === "\"") {
        current += "\"";
        index += 1;
      } else {
        quoted = !quoted;
      }
      continue;
    }

    if (!quoted && char === delimiter) {
      cells.push(current.trim());
      current = "";
      continue;
    }

    current += char;
  }

  cells.push(current.trim());
  return cells;
}
