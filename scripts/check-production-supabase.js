/* eslint-disable @typescript-eslint/no-require-imports */

const { createClient } = require("@supabase/supabase-js");
const fs = require("node:fs");
const path = require("node:path");

const TABLES = [
  {
    name: "users",
    critical: true,
    columns: ["id", "name", "role", "created_at", "updated_at"],
  },
  {
    name: "rounds",
    critical: true,
    columns: [
      "id",
      "title",
      "status",
      "budget_yen",
      "notes",
      "product_type",
      "competition_type",
      "sport_context",
      "primary_use",
      "required_match_count",
      "active_match_count",
      "data_profile",
      "probability_readiness",
      "round_source",
      "source_note",
      "outcome_set_json",
      "void_handling",
      "created_at",
      "updated_at",
    ],
  },
  {
    name: "matches",
    critical: true,
    columns: [
      "id",
      "round_id",
      "fixture_master_id",
      "official_match_no",
      "match_no",
      "home_team",
      "away_team",
      "kickoff_time",
      "venue",
      "stage",
      "official_vote_1",
      "official_vote_0",
      "official_vote_2",
      "market_prob_1",
      "market_prob_0",
      "market_prob_2",
      "model_prob_1",
      "model_prob_0",
      "model_prob_2",
      "consensus_f",
      "consensus_d",
      "consensus_call",
      "disagreement_score",
      "exception_count",
      "confidence",
      "category",
      "recommended_outcomes",
      "tactical_note",
      "injury_note",
      "motivation_note",
      "admin_note",
      "recent_form_note",
      "availability_info",
      "conditions_info",
      "home_strength_adjust",
      "away_strength_adjust",
      "availability_adjust",
      "conditions_adjust",
      "tactical_adjust",
      "motivation_adjust",
      "admin_adjust_1",
      "admin_adjust_0",
      "admin_adjust_2",
      "home_advantage_adjust",
      "rest_days_adjust",
      "travel_adjust",
      "league_table_motivation_adjust",
      "injury_suspension_adjust",
      "rotation_risk_adjust",
      "group_standing_motivation_adjust",
      "travel_climate_adjust",
      "altitude_humidity_adjust",
      "squad_depth_adjust",
      "tournament_pressure_adjust",
      "actual_result",
      "created_at",
      "updated_at",
    ],
  },
  {
    name: "picks",
    critical: true,
    columns: ["id", "round_id", "match_id", "user_id", "pick", "note", "created_at", "updated_at"],
  },
  {
    name: "human_scout_reports",
    critical: true,
    columns: [
      "id",
      "round_id",
      "match_id",
      "user_id",
      "score_strength_form",
      "note_strength_form",
      "score_availability",
      "note_availability",
      "score_conditions",
      "note_conditions",
      "score_tactical_matchup",
      "note_tactical_matchup",
      "score_micro",
      "note_micro",
      "draw_alert",
      "note_draw_alert",
      "direction_score_f",
      "provisional_call",
      "exception_flag",
      "exception_note",
      "created_at",
      "updated_at",
    ],
  },
  {
    name: "generated_tickets",
    critical: false,
    columns: [
      "id",
      "round_id",
      "mode",
      "ticket_json",
      "ticket_score",
      "estimated_hit_prob",
      "contrarian_score",
      "created_at",
    ],
  },
  {
    name: "round_ev_assumptions",
    critical: true,
    columns: [
      "id",
      "round_id",
      "stake_yen",
      "total_sales_yen",
      "return_rate",
      "first_prize_share",
      "carryover_yen",
      "payout_cap_yen",
      "note",
      "created_at",
      "updated_at",
    ],
  },
  {
    name: "candidate_tickets",
    critical: false,
    columns: [
      "id",
      "round_id",
      "label",
      "strategy_type",
      "picks_json",
      "p_model_combo",
      "p_public_combo",
      "estimated_payout_yen",
      "gross_ev_yen",
      "ev_multiple",
      "ev_percent",
      "proxy_score",
      "hit_probability",
      "public_overlap_score",
      "contrarian_count",
      "draw_count",
      "human_alignment_score",
      "data_quality",
      "rationale",
      "warning",
      "created_at",
      "updated_at",
    ],
  },
  {
    name: "candidate_votes",
    critical: false,
    columns: [
      "id",
      "round_id",
      "candidate_ticket_id",
      "user_id",
      "vote",
      "comment",
      "created_at",
      "updated_at",
    ],
  },
  {
    name: "fixture_master",
    critical: true,
    columns: [
      "id",
      "competition",
      "source",
      "source_url",
      "source_text",
      "external_fixture_id",
      "match_date",
      "kickoff_time",
      "timezone",
      "home_team",
      "away_team",
      "group_name",
      "stage",
      "venue",
      "city",
      "country",
      "data_confidence",
      "created_at",
      "updated_at",
    ],
  },
  {
    name: "review_notes",
    critical: false,
    columns: ["id", "round_id", "match_id", "user_id", "note", "created_at"],
  },
  {
    name: "research_memos",
    critical: true,
    columns: [
      "id",
      "round_id",
      "match_id",
      "team",
      "memo_type",
      "title",
      "summary",
      "source_url",
      "source_name",
      "source_date",
      "confidence",
      "created_by",
      "created_at",
      "updated_at",
    ],
  },
  {
    name: "toto_official_round_library",
    critical: false,
    columns: [
      "id",
      "title",
      "notes",
      "product_type",
      "required_match_count",
      "outcome_set_json",
      "source_note",
      "void_handling",
      "official_round_name",
      "official_round_number",
      "sales_start_at",
      "sales_end_at",
      "result_status",
      "stake_yen",
      "total_sales_yen",
      "return_rate",
      "first_prize_share",
      "carryover_yen",
      "payout_cap_yen",
      "source_url",
      "source_text",
      "matches_json",
      "created_at",
      "updated_at",
    ],
  },
  {
    name: "toto_official_rounds",
    critical: false,
    columns: [
      "id",
      "round_id",
      "product_type",
      "official_round_name",
      "official_round_number",
      "sales_start_at",
      "sales_end_at",
      "result_status",
      "stake_yen",
      "total_sales_yen",
      "return_rate",
      "first_prize_share",
      "carryover_yen",
      "payout_cap_yen",
      "source_url",
      "source_text",
      "created_at",
      "updated_at",
    ],
  },
  {
    name: "toto_official_matches",
    critical: false,
    columns: [
      "id",
      "round_id",
      "match_id",
      "fixture_master_id",
      "official_match_no",
      "home_team",
      "away_team",
      "kickoff_time",
      "venue",
      "stage",
      "official_vote_1",
      "official_vote_0",
      "official_vote_2",
      "actual_result",
      "match_status",
      "source_text",
      "created_at",
      "updated_at",
    ],
  },
];

function getErrorMessage(error) {
  if (!error) {
    return "";
  }

  const parts = [error.code, error.message, error.details, error.hint]
    .filter((value) => value != null && String(value).trim() !== "")
    .map((value) => String(value).trim());

  if (parts.length > 0) {
    return parts.join(" | ");
  }

  try {
    return JSON.stringify(error);
  } catch {
    return String(error);
  }
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

function isMissingColumnError(error) {
  if (!error) {
    return false;
  }

  if (error.code === "42703") {
    return true;
  }

  const message = getErrorMessage(error).toLowerCase();
  return message.includes("column") && message.includes("does not exist");
}

const ENV_FILES = [
  path.join(process.cwd(), ".env.local"),
  path.join(process.cwd(), ".env"),
];

function loadDotEnv(pathName) {
  if (!fs.existsSync(pathName)) {
    return;
  }

  const text = fs.readFileSync(pathName, "utf8");
  text.split(/\r?\n/).forEach((line) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) {
      return;
    }

    const equals = trimmed.indexOf("=");
    if (equals <= 0) {
      return;
    }

    const key = trimmed.slice(0, equals).trim();
    const raw = trimmed.slice(equals + 1).trim();
    const value = raw.replace(/^"(.*)"$/, "$1");

    if (key && !(key in process.env)) {
      process.env[key] = value;
    }
  });
}

function loadConfig() {
  for (const filePath of ENV_FILES) {
    loadDotEnv(filePath);
  }

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
        .select(table.columns.join(","), { count: "exact" })
        .limit(1);

      if (result.error) {
        if (isMissingRelationError(result.error)) {
          check.error = `MISSING_RELATION: ${getErrorMessage(result.error)}`;
          results.push(check);
          continue;
        }

        if (isMissingColumnError(result.error)) {
          check.error = `MISSING_COLUMN: ${getErrorMessage(result.error)}`;
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

async function loadDetailedRestError(url, anonKey, tableName, columns) {
  try {
    const query = encodeURIComponent(columns.join(","));
    const response = await fetch(
      `${url}/rest/v1/${tableName}?select=${query}&limit=1`,
      {
        headers: {
          apikey: anonKey,
          Authorization: `Bearer ${anonKey}`,
        },
      },
    );

    if (response.ok) {
      return null;
    }

    const text = await response.text();
    if (!text) {
      return `${response.status} ${response.statusText}`;
    }

    try {
      const payload = JSON.parse(text);
      return getErrorMessage(payload);
    } catch {
      return `${response.status} ${response.statusText} | ${text}`;
    }
  } catch (error) {
    return error instanceof Error ? error.message : String(error);
  }
}

function printResult(results) {
  const criticalFailures = results.filter((row) => row.critical && !row.ok);
  const softFailures = results.filter((row) => !row.critical && !row.ok);
  const allFailures = results.filter((row) => !row.ok);

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

  if (allFailures.length > 0) {
    console.log("");
    console.log("[details]");
    allFailures.forEach((row) => {
      console.log(`- ${row.name}: ${row.error}`);
    });
  }

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

  for (const row of results) {
    if (row.ok || !row.error) {
      continue;
    }

    const table = TABLES.find((table) => table.name === row.name);
    if (!table) {
      continue;
    }

    const detailedError = await loadDetailedRestError(url, anon, row.name, table.columns);
    if (detailedError && detailedError !== row.error) {
      row.error = detailedError;
    }
  }

  printResult(results);
}

main();
