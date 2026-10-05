import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Cloudflare Worker / Pages Functions / D1 は Cloudflare 側でビルド/型検査するため除外。
    "workers/**",
    "cloudflare/**",
    "functions/**",
    // Claude Code の git worktree（入れ子の別チェックアウト）は各自の .next ビルド出力まで拾うため除外。
    ".claude/worktrees/**",
  ]),
]);

export default eslintConfig;
