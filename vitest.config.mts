import path from "node:path";
import { fileURLToPath } from "node:url";

import { defineConfig } from "vitest/config";

const rootDir = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(rootDir, "src"),
    },
  },
  test: {
    environment: "node",
    // src のロジックに加え、Cloudflare Worker / Pages Functions 共有ロジック
    // （workers/api/src 配下。外部型に依存しない純 TS）も実行対象にする。
    include: ["src/**/*.test.ts", "workers/**/*.test.ts"],
  },
});
