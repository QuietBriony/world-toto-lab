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
    >
      <div className="space-y-3 text-sm leading-7 text-slate-700">
        <p>
          `.env.local` に `NEXT_PUBLIC_SUPABASE_URL` と
          `NEXT_PUBLIC_SUPABASE_ANON_KEY` を設定してください。
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
      <p className="text-sm text-slate-600">{description}</p>
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
        onRetry ? (
          <button type="button" className={buttonClassName} onClick={onRetry}>
            再読み込み
          </button>
        ) : null
      }
    >
      <p className="text-sm text-rose-700">{error}</p>
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
  return (
    <SectionCard
      title="先にラウンドを開いてください"
      description="この画面は単独では使えません。ダッシュボードから対象ラウンドを開くと、そのまま続きに進めます。"
      actions={
        <Link href={appRoute.dashboard} className={secondaryButtonClassName}>
          ダッシュボードへ
        </Link>
      }
    >
      <p className="text-sm text-slate-600">
        まずダッシュボードでラウンドを作成するか、既存ラウンドの「ラウンド詳細」を開いてください。
      </p>
    </SectionCard>
  );
}
