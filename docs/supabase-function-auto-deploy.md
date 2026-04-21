# Supabase Edge Function Auto Deploy

`sync-big-official-watch` と `sync-toto-official-round-list` は、`main` に function 変更が入ったときだけ GitHub Actions から自動 deploy できます。

## 1. 先にやること

GitHub のこの repo に、Actions secret `SUPABASE_ACCESS_TOKEN` を 1 個だけ追加します。

手順:

1. Supabase Dashboard の [Access Tokens](https://supabase.com/dashboard/account/tokens) で新しい Personal Access Token を作る
2. GitHub repo の `Settings > Secrets and variables > Actions`
3. `New repository secret`
4. Name: `SUPABASE_ACCESS_TOKEN`
5. Value: さっき作った `sbp_...` token

`PROJECT_ID` は workflow 側で `jtypbwgdtqeznhxffpgo` を固定しているので、追加 secret は不要です。

## 2. 何が自動になるか

以下の変更が `main` に push されたときだけ、自動で Supabase Edge Functions を deploy します。

- `supabase/functions/**`
- `supabase/config.toml`
- `.github/workflows/deploy-supabase-functions.yml`

対象 workflow:

- [deploy-supabase-functions.yml](/C:/workspace/world-toto-lab/.github/workflows/deploy-supabase-functions.yml)

## 3. いまの用途

この repo では主に次を live 反映するために使います。

- `sync-big-official-watch`
- `sync-toto-official-round-list`

## 4. 最初の1回

secret を入れたあと、GitHub Actions の `Deploy Supabase Edge Functions` を `Run workflow` で 1 回流せば、現在の `main` にある function 群がまとめて deploy されます。

以後は `main` に function 変更が入った時だけ自動 deploy されます。

## 5. セキュリティメモ

- この token は deploy 用です。通常のアプリ利用では使いません。
- 期限付き token を使って大丈夫です。
- もし token を会話やメモに貼ってしまったら revoke して作り直します。
