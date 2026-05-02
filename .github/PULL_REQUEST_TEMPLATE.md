## Summary

<!-- この PR の目的を一文で書く -->

## Why

<!-- なぜ必要か -->

## Workflow

- [ ] この PR は 1 つの目的だけを扱っています
- [ ] branch で作業し、`main` へは PR 経由で反映する想定です
- [ ] 同じファイルを複数人または複数 AI で同時編集していません

`main` は today の deploy branch です。  
設定上 push できてしまう場合でも、通常運用は branch + PR を前提にしてください。

## Changes

- 

## Files / Scope

- Main files touched:
- Files intentionally left untouched:

## Impact

- UI / route:
- Supabase schema / data:
- GitHub Pages / `basePath` / static export:
- Edge Functions:
- Docs / templates:

## Validation

- CI:
  - [ ] Pull request CI passed (`lint` / `test` / `audit:schema` / `build`)
- [ ] Docs only
- [ ] `npm run lint`
- [ ] `npm run test`
- [ ] `npm run build`
- [ ] `npm run audit:schema`
- [ ] `npm run check:pages`
- [ ] `npm run check:supabase`
- [ ] 未実施または N/A の項目は下に理由を書いた

Operational smoke, when applicable:

```bash
WORLD_TOTO_LAB_BASE_URL=https://quietbriony.github.io/world-toto-lab
WORLD_TOTO_LAB_ROUND_ID=<round-id>
WORLD_TOTO_LAB_USER_ID=<optional-user-id>
WORLD_TOTO_LAB_REQUIRE_ROUND=1
npm run check:pages
```

Validation notes:

<!-- 実行結果、未実施理由、追加の手動確認 -->

## Screenshots / Logs

<!-- UI変更や運用変更がある場合は before / after やログを貼る -->

## AI Usage

- Primary implementer:
- Review AI / reviewer:
- 他 AI が直接コードを書いた場合の branch / PR:

## Risk Checklist

- [ ] `repository.ts` / `schema.sql` / `next.config.ts` の変更は必要最小限です
- [ ] route / link 変更が query-param routing と static export を壊していません
- [ ] Supabase 本番データ削除を伴いません
- [ ] 決済、代理購入、配当、精算、ユーザー間賭博は実装していません
- [ ] 残リスクや未確認項目を Notes に書きました

## Notes

<!-- レビューしてほしい点、残課題、判断メモ -->
