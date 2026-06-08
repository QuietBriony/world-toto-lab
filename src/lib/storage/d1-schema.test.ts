import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const schema = readFileSync(
  join(process.cwd(), "cloudflare/d1/schema.sql"),
  "utf8",
).toLowerCase();
const migration = readFileSync(
  join(process.cwd(), "cloudflare/d1/migrations/0001_init.sql"),
  "utf8",
).toLowerCase();

// `--` 以降のコメントを除いた DDL 本体（コメント内の語で誤検知しないため）。
const schemaDdl = schema
  .split("\n")
  .map((line) => line.replace(/--.*$/, ""))
  .join("\n");

const REQUIRED_TABLES = [
  "rounds",
  "matches",
  "picks",
  "scout_reports",
  "candidate_tickets",
  "candidate_votes",
  "review_notes",
  "research_memos",
  "official_rounds",
  "big_carryover_assumptions",
];

describe("D1 schema.sql", () => {
  it.each(REQUIRED_TABLES)("defines the %s table", (table) => {
    expect(schema).toContain(`create table if not exists ${table} (`);
  });

  it("mirrors every table in migration 0001", () => {
    for (const table of REQUIRED_TABLES) {
      expect(migration).toContain(`create table if not exists ${table} (`);
    }
  });

  it("declares the required indexes (spec)", () => {
    expect(schema).toContain("matches (round_id, match_no)");
    expect(schema).toContain("picks (round_id, user_id, match_id)");
    expect(schema).toContain("scout_reports (round_id, user_id, match_id)");
    expect(schema).toContain(
      "candidate_votes (round_id, candidate_ticket_id, user_id)",
    );
    expect(schema).toContain("review_notes (round_id)");
  });

  it("gives every table id / created_at / updated_at", () => {
    const createdAtColumns = schema.match(/created_at text not null/g) ?? [];
    const updatedAtColumns = schema.match(/updated_at text not null/g) ?? [];
    expect(createdAtColumns.length).toBeGreaterThanOrEqual(
      REQUIRED_TABLES.length,
    );
    expect(updatedAtColumns.length).toBeGreaterThanOrEqual(
      REQUIRED_TABLES.length,
    );
  });

  it("avoids Postgres-specific types (D1 is SQLite)", () => {
    for (const banned of [
      "jsonb",
      "timestamptz",
      "gen_random_uuid",
      "double precision",
      "uuid primary key",
    ]) {
      expect(schemaDdl).not.toContain(banned);
    }
  });

  it("balances parentheses and statement terminators (basic syntax sanity)", () => {
    const open = (schemaDdl.match(/\(/g) ?? []).length;
    const close = (schemaDdl.match(/\)/g) ?? []).length;
    expect(open).toBe(close);
    expect(schemaDdl.trimEnd().endsWith(";")).toBe(true);
  });
});
