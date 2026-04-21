/* eslint-disable @typescript-eslint/no-require-imports */

const { createClient } = require("@supabase/supabase-js");

const TABLES = [
  { name: "users", critical: true },
  { name: "rounds", critical: true },
  { name: "matches", critical: true },
  { name: "picks", critical: true },
  { name: "human_scout_reports", critical: true },
  { name: "generated_tickets", critical: false },
  { name: "round_ev_assumptions", critical: true },
  { name: "candidate_tickets", critical: false },
  { name: "candidate_votes", critical: false },
  { name: "fixture_master", critical: true },
  { name: "review_notes", critical: false },
  { name: "toto_official_round_library", critical: false },
  { name: "toto_official_rounds", critical: false },
  { name: "toto_official_matches", critical: false },
];

function getErrorMessage(error) {
  if (!error) {
    return "";
  }

  return (error.message || "").toString();
}

function isMissingRelationError(error) {
  if (!error) {
    return false;
  }

  const code = error.code;
  if (code && ["42P01", "PGRST204", "PGRST205", "PGRST116", "PGRST201"].includes(code)) {
    return true;
  }

  const message = getErrorMessage(error).toLowerCase();
  return (
    message.includes("could not find table") ||
    message.includes("relation") && message.includes("does not exist") ||
    message.includes("schema cache") ||
    message.includes("does not exist")
  );
}

function loadConfig() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anon) {
    console.error("ERROR: NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY must be set.");
    process.exit(2);
  }

  return { url, anon };
}

async function checkTables(supabase) {
  const results = [];

  for (const table of TABLES) {
    const check = { name: table.name, ok: false, critical: table.critical, error: null, count: null };

    try {
      const result = await supabase
        .from(table.name)
        .select("*", { count: "exact", head: true });

      if (result.error) {
        if (isMissingRelationError(result.error)) {
          check.error = `MISSING_RELATION: ${getErrorMessage(result.error)}`;
          results.push(check);
          continue;
        }

        check.error = getErrorMessage(result.error);
        results.push(check);
        continue;
      }

      check.ok = true;
      check.count = result.count;
      results.push(check);
    } catch (error) {
      check.error = error instanceof Error ? error.message : "unexpected error";
      results.push(check);
    }
  }

  return results;
}

function printResult(results) {
  const criticalFailures = results.filter((row) => row.critical && !row.ok);
  const softFailures = results.filter((row) => !row.critical && !row.ok);

  console.log("[world-toto-lab] production supabase table check");
  console.log(`[env] url=${process.env.NEXT_PUBLIC_SUPABASE_URL}`);
  console.log("");

  results.forEach((row) => {
    const status = row.ok ? "OK" : "NG";
    const count = row.count == null ? "-" : String(row.count);
    const level = row.critical ? "critical" : "optional";
    const detail = row.error ? ` // ${row.error}` : "";
    console.log(
      `${status} ${row.name.padEnd(32)} [${level}] count=${count}${detail}`,
    );
  });

  console.log("");
  console.log(`critical failures: ${criticalFailures.length}`);
  console.log(`optional failures: ${softFailures.length}`);

  if (criticalFailures.length > 0) {
    console.log("Please check supabase/sql apply and anon key permissions.");
    process.exit(1);
  }
  process.exit(0);
}

async function main() {
  const { url, anon } = loadConfig();
  const supabase = createClient(url, anon);
  const results = await checkTables(supabase);
  printResult(results);
}

main();
