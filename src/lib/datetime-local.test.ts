import { describe, expect, it } from "vitest";

import { isoToTokyoDateTimeLocal, tokyoDateTimeLocalToIso } from "@/lib/datetime-local";

describe("datetime-local Tokyo helpers", () => {
  it("renders a stored UTC instant as a Tokyo wall-clock datetime-local value", () => {
    // 2026-06-11T19:00:00Z = 2026-06-12 04:00 JST
    expect(isoToTokyoDateTimeLocal("2026-06-11T19:00:00.000Z")).toBe("2026-06-12T04:00");
  });

  it("interprets a datetime-local value as Tokyo time when converting back to UTC", () => {
    expect(tokyoDateTimeLocalToIso("2026-06-12T04:00")).toBe("2026-06-11T19:00:00.000Z");
  });

  it("round-trips without drifting the stored instant (no -9h regression)", () => {
    const stored = "2026-06-11T19:00:00.000Z";
    const shown = isoToTokyoDateTimeLocal(stored);
    // 無編集保存に相当：初期化→保存で元の instant が変わらないこと。
    expect(tokyoDateTimeLocalToIso(shown)).toBe(stored);
  });

  it("round-trips a midnight-JST boundary", () => {
    const stored = "2026-06-10T15:00:00.000Z"; // 2026-06-11 00:00 JST
    const shown = isoToTokyoDateTimeLocal(stored);
    expect(shown).toBe("2026-06-11T00:00");
    expect(tokyoDateTimeLocalToIso(shown)).toBe(stored);
  });

  it("returns empty / null for missing or invalid values", () => {
    expect(isoToTokyoDateTimeLocal(null)).toBe("");
    expect(isoToTokyoDateTimeLocal("")).toBe("");
    expect(isoToTokyoDateTimeLocal("not-a-date")).toBe("");
    expect(tokyoDateTimeLocalToIso("")).toBeNull();
    expect(tokyoDateTimeLocalToIso(null)).toBeNull();
    expect(tokyoDateTimeLocalToIso("garbage")).toBeNull();
  });

  it("accepts a value that already includes seconds", () => {
    expect(tokyoDateTimeLocalToIso("2026-06-12T04:00:00")).toBe("2026-06-11T19:00:00.000Z");
  });
});
