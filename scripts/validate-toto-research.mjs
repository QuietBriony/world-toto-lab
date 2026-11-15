// Node 24 can load this dependency-free TypeScript helper directly.
import { readFile } from "node:fs/promises";
import { summarizeTotoReturns, validateTotoPredictions } from "../src/lib/research/toto-validation.ts";

try {
  const args = process.argv.slice(2);
  if (args.length !== 1) throw new Error("Usage: node scripts/validate-toto-research.mjs <input.json>");
  const input = JSON.parse(await readFile(args[0], "utf8"));
  const report = {
    assessment: "descriptive_only",
    profitability: "not_evaluated",
    scope: "research-only; metadata consistency checks do not prove pre-deadline capture or profitability",
    predictions: validateTotoPredictions(input.protocol, input.predictions),
    returns: summarizeTotoReturns(input.returns),
  };
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  // A report remains inspectable, but automated use must not overlook exclusions.
  if (report.predictions.excludedCount) process.exitCode = 2;
} catch (error) {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
}
