<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

## Project-Specific Rules

Before substantial edits, also read:

- `docs/AGENTS.md`
- `docs/ARCHITECTURE.md`
- `docs/DEVELOPMENT.md`

This repo runs on `GitHub Pages + static export + Supabase`. Do not break `next.config.ts`, `basePath`, `assetPrefix`, or the query-param routing model.
