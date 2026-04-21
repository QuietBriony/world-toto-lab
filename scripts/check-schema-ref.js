/* eslint-disable @typescript-eslint/no-require-imports */

const fs = require("node:fs");
const path = require("node:path");

function extractTables(filePath, pattern, matchIndex) {
  const text = fs.readFileSync(filePath, "utf8");
  const regex = pattern;
  const matches = [];
  let match = regex.exec(text);

  while (match) {
    matches.push(match[matchIndex]);
    match = regex.exec(text);
  }

  return matches;
}

function uniqueSorted(values) {
  return Array.from(new Set(values)).sort((a, b) => a.localeCompare(b));
}

const repositoryPath = path.join(process.cwd(), "src", "lib", "repository.ts");
const schemaPath = path.join(process.cwd(), "supabase", "schema.sql");

const repoTables = uniqueSorted(
  extractTables(repositoryPath, /\bfrom\(\s*["'`](.*?)["'`]\s*\)/g, 1),
);

const schemaTables = uniqueSorted(
  extractTables(schemaPath, /create table if not exists public\.([a-zA-Z0-9_]+)/g, 1),
);

const schemaSet = new Set(schemaTables);
const missing = repoTables.filter((table) => !schemaSet.has(table));

console.log("[schema-audit] repository query tables:");
console.log(repoTables.join("\n"));
console.log("\n[schema-audit] schema tables:");
console.log(schemaTables.join("\n"));

if (missing.length === 0) {
  console.log("\n[schema-audit] all repository tables are present in schema.sql ✅");
  process.exit(0);
}

console.error("\n[schema-audit] missing tables:");
for (const table of missing) {
  console.error(`- ${table}`);
}
process.exit(1);
