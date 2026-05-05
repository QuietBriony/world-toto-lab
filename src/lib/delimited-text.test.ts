import { describe, expect, it } from "vitest";

import { detectDelimiter, splitDelimitedLine } from "@/lib/delimited-text";

describe("delimited text parser", () => {
  it("detects the existing supported delimiter priority", () => {
    expect(detectDelimiter("a\tb,c")).toBe("\t");
    expect(detectDelimiter("a|b,c")).toBe("|");
    expect(detectDelimiter("a,b")).toBe(",");
  });

  it("keeps delimiters inside quoted cells", () => {
    expect(splitDelimitedLine('1,"Mexico City, Stadium",Group A')).toEqual([
      "1",
      "Mexico City, Stadium",
      "Group A",
    ]);
  });

  it("unescapes doubled quotes in quoted cells", () => {
    expect(splitDelimitedLine('1,"Team ""A""",Team B')).toEqual([
      "1",
      'Team "A"',
      "Team B",
    ]);
  });

  it("preserves empty trailing cells", () => {
    expect(splitDelimitedLine("1,Team A,")).toEqual(["1", "Team A", ""]);
  });
});
