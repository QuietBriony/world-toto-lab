import fs from "node:fs";
import path from "node:path";

const nextDir = path.resolve(process.cwd(), ".next");

fs.rmSync(nextDir, { force: true, recursive: true });
console.log("[world-toto-lab] cleaned .next before build");
