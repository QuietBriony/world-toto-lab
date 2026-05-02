"use client";

import Link from "next/link";

import {
  buttonClassName,
  secondaryButtonClassName,
  SectionCard,
} from "@/components/ui";
import { appRoute, buildRoundHref } from "@/lib/round-links";
import { useDashboardData } from "@/lib/use-app-data";

export function ConfigurationNotice() {
  return (
    <SectionCard
      title="Supabase 設定が必要です"
      description="GitHub Pages から共有利用するため、データ保存先は Supabase を前提にしています。"
      actions={
        <div className="flex flex-wrap gap-2">
          <Link href={appRoute.dashboard} className={secondaryButtonClassName}>
            ダッシュボードへ
          </Link>
          <a
            href="https://github.com/QuietBriony/world-toto-lab/blob/main/docs/DEVELOPMENT.md"
            target="_blank"
            rel="noreferrer"
            className={buttonClassName}
          >
            設定手順を見る
          </a>
        </div>
      }
    >
      <div className="space-y-3 text-sm leading-7 text-slate-700">
        <p>
          `.env.local` に `NEXT_PUBLIC_SUPABASE_URL` と
          `NEXT_PUBLIC_SUPABASE_ANON_KEY` を設定してください。
        </p>
        <p>
          ローカル確認では `npm run check:supabase` が `.env.local` を読みます。
          GitHub Pages の build では同じ値を Actions secrets に入れてください。
        </p>
        <p>
          `NEXT_PUBLIC_*` は public client 用です。`service_role` や secret key は入れないでください。
        </p>
        <p>
          初回セットアップ用 SQL は
          {" "}
          <a
            href="https://github.com/QuietBriony/world-toto-lab/blob/main/supabase/schema.sql"
            target="_blank"
            rel="noreferrer"
            className="font-medium text-teal-700 underline decoration-teal-300 underline-offset-4"
          >
            GitHub 上の `supabase/schema.sql`
          </a>
          {" "}
          にまとめています。
        </p>
      </div>
    </SectionCard>
  );
}

export function LoadingNotice({
  description = "最新データを読み込んでいます。",
  title = "読み込み中",
}: {
  description?: string;
  title?: string;
}) {
  return (
    <SectionCard title={title} description={description}>
      <div className="space-y-3" aria-hidden="true">
        <div className="h-3 w-28 rounded-full bg-slate-200/80" />
        <div className="h-3 w-full max-w-md rounded-full bg-slate-100" />
        <div className="h-3 w-3/4 max-w-sm rounded-full bg-slate-100" />
      </div>
    </SectionCard>
  );
}

export function ErrorNotice({
  error,
  onRetry,
}: {
  error: string;
  onRetry?: () => void;
}) {
  return (
    <SectionCard
      title="読み込みに失敗しました"
      description="接続情報や Supabase 側のテーブル構成を確認してください。"
      actions={
        <div className="flex flex-wrap gap-2">
          <Link href={appRoute.dashboard} className={secondaryButtonClassName}>
            ダッシュボードへ
          </Link>
          {onRetry ? (
            <button type="button" className={buttonClassName} onClick={onRetry}>
              再読み込み
            </button>
          ) : null}
        </div>
      }
    >
      <div className="space-y-3">
        <p className="text-sm text-rose-700">{error}</p>
        <p className="text-sm leading-6 text-slate-600">
          実運用前の切り分けは `npm run check:supabase` と、実 Round ID 付きの
          `npm run check:pages` から見ると早いです。
        </p>
      </div>
    </SectionCard>
  );
}

export function RoundMissingNotice({
  onRetry,
}: {
  onRetry?: () => void;
}) {
  const { data } = useDashboardData();
  const latestRound = data?.rounds[0] ?? null;

  return (
    <SectionCard
      title="このラウンドは見つかりません"
      description="古いリンクを開いたか、削除されたラウンドを見ている可能性があります。"
      actions={
        <div className="flex flex-wrap gap-2">
          <Link href={appRoute.dashboard} className={secondaryButtonClassName}>
            ダッシュボードへ
          </Link>
          {latestRound ? (
            <Link
              href={buildRoundHref(appRoute.workspace, latestRound.id)}
              className={buttonClassName}
            >
              いまの本番回を開く
            </Link>
          ) : null}
          {onRetry ? (
            <button type="button" className={secondaryButtonClassName} onClick={onRetry}>
              再読み込み
            </button>
          ) : null}
        </div>
      }
    >
      <p className="text-sm text-slate-600">
        まずはダッシュボードへ戻り、今あるラウンドから開き直してください。
      </p>
      {latestRound ? (
        <p className="mt-2 text-sm text-slate-500">
          直近の本番回: {latestRound.title}
        </p>
      ) : null}
    </SectionCard>
  );
}

export function RoundRequiredNotice() {
  const { data } = useDashboardData();
  const latestRound = data?.rounds[0] ?? null;

  return (
    <SectionCard
      title="先にラウンドを開いてください"
      description="この画面は単独では使えません。ダッシュボードから対象ラウンドを開くと、そのまま続きに進めます。"
      actions={
        <div className="flex flex-wrap gap-2">
          <Link href={appRoute.dashboard} className={secondaryButtonClassName}>
            ダッシュボードへ
          </Link>
          {latestRound ? (
            <Link
              href={buildRoundHref(appRoute.workspace, latestRound.id)}
              className={buttonClassName}
            >
              直近の回を開く
            </Link>
          ) : (
            <Link href={`${appRoute.dashboard}#create-round`} className={buttonClassName}>
              回を作る
            </Link>
          )}
        </div>
      }
    >
      <p className="text-sm text-slate-600">
        まずダッシュボードでラウンドを作成するか、既存ラウンドの「ラウンド詳細」を開いてください。
      </p>
      {latestRound ? (
        <p className="mt-2 text-sm text-slate-500">
          直近の本番回: {latestRound.title}
        </p>
      ) : (
        <p className="mt-2 text-sm text-slate-500">
          Round ID は URL の `?round=&lt;id&gt;` で引き継ぎます。手で path を足す必要はありません。
        </p>
      )}
    </SectionCard>
  );
}
