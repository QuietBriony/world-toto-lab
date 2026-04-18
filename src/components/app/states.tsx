import Link from "next/link";

import {
  buttonClassName,
  secondaryButtonClassName,
  SectionCard,
} from "@/components/ui";
import { appRoute } from "@/lib/round-links";

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
  title = "Loading",
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
            Retry
          </button>
        ) : null
      }
    >
      <p className="text-sm text-rose-700">{error}</p>
    </SectionCard>
  );
}

export function RoundRequiredNotice() {
  return (
    <SectionCard
      title="Round を選択してください"
      description="この画面は URL の `?round=` で対象 Round を切り替えます。"
      actions={
        <Link href={appRoute.dashboard} className={secondaryButtonClassName}>
          Dashboard へ
        </Link>
      }
    >
      <p className="text-sm text-slate-600">
        まず Dashboard で Round を作成し、そこから各画面へ移動してください。
      </p>
    </SectionCard>
  );
}
