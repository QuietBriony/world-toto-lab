import type { Metadata } from "next";
import Link from "next/link";

import {
  Badge,
  buttonClassName,
  PageHeader,
  secondaryButtonClassName,
  SectionCard,
  StatCard,
} from "@/components/ui";
import { appRoute } from "@/lib/round-links";

const operatingRules = [
  "main へは直接 push せず、必ず branch + PR で進める",
  "1タスク = 1ブランチ、1PR = 1目的を徹底する",
  "Codex を基本実装担当にし、Claude 等は設計レビュー / 仕様レビューを原則にする",
  "別 AI にコードを書かせる場合は、別ブランチ・小PR・限定ファイルで扱う",
  "同じファイルを複数 AI に同時編集させない",
];

const branchStrategy = [
  {
    branch: "main",
    body: "GitHub Pages 本番用です。通常運用では直接 push せず、PR merge だけで更新します。",
  },
  {
    branch: "dev",
    body: "統合確認用の任意 branch です。今は自動 preview は無いので、必要ならローカル build と Pages route check を回します。",
  },
  {
    branch: "feature/*",
    body: "新機能追加用です。画面追加や新しい集計ロジックはここで閉じます。",
  },
  {
    branch: "fix/*",
    body: "バグ修正用です。hotfix でも scope を狭くして PR にします。",
  },
  {
    branch: "docs/*",
    body: "README / docs / template だけを触る変更です。コード差分と混ぜません。",
  },
  {
    branch: "experiment/*",
    body: "試験実装用です。本番 merge 前に仕様を見直す前提で扱います。",
  },
];

const onboardingSteps = [
  "GitHub に招待されたら repo を clone する",
  "`.env.example` をコピーして `NEXT_PUBLIC_SUPABASE_URL` と `NEXT_PUBLIC_SUPABASE_ANON_KEY` を入れる",
  "`npm ci` のあと `npm run dev` でローカル起動する",
  "1タスク 1ブランチを切って、Codex へ狭い scope で依頼する",
  "変更後に `lint / test / build` を回し、PR を出す",
  "人間が UI と deploy 影響を見て merge する",
];

const aiGuardrails = [
  {
    title: "同時編集禁止",
    body: "特に `src/lib/repository.ts`、`supabase/schema.sql`、`next.config.ts`、`src/lib/types.ts` は 1 回に 1 AI だけが触る運用にします。",
    tone: "warning" as const,
  },
  {
    title: "DB は最小差分",
    body: "migration は `alter table` ベースの最小差分を優先し、既存データ削除や全書き換えを避けます。",
    tone: "positive" as const,
  },
  {
    title: "Pages 前提を維持",
    body: "このアプリは GitHub Pages 配信です。`basePath`、`assetPrefix`、static export、query param ルーティングを壊さないことが前提です。",
    tone: "draw" as const,
  },
];

const prChecklist = [
  "目的が 1 つに絞られている",
  "影響範囲を書いた",
  "テスト結果を書いた",
  "スクリーンショットを添付した",
  "Pages / Supabase への影響を確認した",
];

const docsToRead = [
  {
    path: "docs/DEVELOPMENT.md",
    label: "日々の開発フローと運用手順",
  },
  {
    path: "docs/CONTRIBUTING.md",
    label: "友人向けの参加ルール",
  },
  {
    path: "docs/AGENTS.md",
    label: "AI 並走ルールとファイル所有権",
  },
  {
    path: "docs/ARCHITECTURE.md",
    label: "構成、制約、危険変更ポイント",
  },
  {
    path: "docs/IMAGE_ART_DIRECTION.md",
    label: "画像アセットの差し替え方と prompt 方針",
  },
];

const prohibitedAreas = [
  "決済",
  "代理購入",
  "配当",
  "精算",
  "ユーザー間賭博",
];

export const metadata: Metadata = {
  title: "GitHub 共同開発で遊ぼう",
  description:
    "World Toto Lab の開発運用ルール、AI 並走ルール、PR チェックリストをまとめたページ。",
};

export default function DevPlaybookPage() {
  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="共同開発"
        title="GitHub で共同開発を始めよう"
        description="友人を GitHub に招待したあと、初心者でも迷いにくいように、branch 運用・AI 並走・Pages / Supabase の安全ルールをひとつにまとめています。"
        actions={
          <div className="flex flex-wrap gap-3">
            <Link href={appRoute.dashboard} className={secondaryButtonClassName}>
              ダッシュボードへ
            </Link>
            <a href="#docs" className={buttonClassName}>
              はじめに読む順番
            </a>
          </div>
        }
      />

      <div className="grid gap-4 xl:grid-cols-4">
        <StatCard
          label="main"
          value="通常は直pushしない"
          compact
          hint="普段の更新は branch + PR 経由で進めます。"
        />
        <StatCard
          label="ブランチ"
          value="1タスク"
          compact
          hint="1タスクにつき 1 ブランチです。"
          tone="positive"
        />
        <StatCard
          label="PR"
          value="1目的"
          compact
          hint="1PR では目的を 1 つに絞ります。"
          tone="warning"
        />
        <StatCard
          label="AI"
          value="Codex中心"
          compact
          hint="Claude 等は原則レビュー役です。"
          tone="draw"
        />
      </div>

      <SectionCard
        title="基本運用"
        description="まず全員が同じ前提で動くための共通ルールです。"
      >
        <div className="grid gap-3">
          {operatingRules.map((rule) => (
            <div
              key={rule}
              className="flex items-start gap-3 rounded-[24px] border border-slate-200 bg-slate-50/88 px-4 py-4"
            >
              <Badge tone="teal">ルール</Badge>
              <p className="text-sm leading-6 text-slate-700">{rule}</p>
            </div>
          ))}
        </div>
      </SectionCard>

      <SectionCard
        title="参加から merge まで"
        description="GitHub 招待後にどの順で進めるかを、そのままチェックリストにしています。"
      >
        <div className="grid gap-3">
          {onboardingSteps.map((step, index) => (
            <div
              key={step}
              className="flex items-start gap-3 rounded-[24px] border border-slate-200 bg-white/84 px-4 py-4"
            >
              <Badge tone="teal">{index + 1}</Badge>
              <p className="text-sm leading-6 text-slate-700">{step}</p>
            </div>
          ))}
        </div>
      </SectionCard>

      <SectionCard
        title="ブランチ戦略"
        description="main を壊さずに並走するため、用途ごとに branch の役割を分けます。"
      >
        <div className="grid gap-3 lg:grid-cols-2">
          {branchStrategy.map((item) => (
            <div
              key={item.branch}
              className="rounded-[24px] border border-slate-200 bg-slate-50/88 p-5"
            >
              <div className="font-mono text-sm text-slate-900">{item.branch}</div>
              <p className="mt-2 text-sm leading-6 text-slate-600">{item.body}</p>
            </div>
          ))}
        </div>
      </SectionCard>

      <SectionCard
        title="AI ガードレール"
        description="過去のスパゲッティ化を防ぐため、AI には明確な担当境界を持たせます。"
      >
        <div className="grid gap-4 xl:grid-cols-3">
          {aiGuardrails.map((item) => (
            <StatCard
              key={item.title}
              label={item.title}
              value="必須"
              hint={item.body}
              tone={item.tone}
            />
          ))}
        </div>
        <div className="rounded-[28px] border border-amber-200 bg-amber-50/82 p-5 text-sm leading-7 text-slate-700">
          非 Codex 系 AI に直接コードを書かせる場合も、同じ branch に混ぜないでください。
          別 branch で差分を閉じ込め、小さい PR としてレビューするのが前提です。
        </div>
      </SectionCard>

      <SectionCard
        title="危険変更ポイント"
        description="この repo は GitHub Pages と Supabase の制約が強いので、触るときは PR を小さく保ちます。"
      >
        <div className="grid gap-3 lg:grid-cols-2">
          <div className="rounded-[24px] border border-slate-200 bg-white/86 p-5">
            <div className="flex items-center gap-2">
              <Badge tone="warning">Supabase</Badge>
              <h3 className="font-display text-lg font-semibold tracking-[-0.04em] text-slate-950">
                本番データ保護
              </h3>
            </div>
            <ul className="mt-4 space-y-2 text-sm leading-7 text-slate-700">
              <li>本番 Supabase データを消さない</li>
              <li>`schema.sql` は最小差分で更新する</li>
              <li>掃除のための全件 delete を気軽に打たない</li>
              <li>`repository.ts` と schema 変更は特に慎重に扱う</li>
            </ul>
          </div>

          <div className="rounded-[24px] border border-slate-200 bg-white/86 p-5">
            <div className="flex items-center gap-2">
              <Badge tone="sky">Pages</Badge>
              <h3 className="font-display text-lg font-semibold tracking-[-0.04em] text-slate-950">
                ルーティング保護
              </h3>
            </div>
            <ul className="mt-4 space-y-2 text-sm leading-7 text-slate-700">
              <li>`basePath` と `assetPrefix` を壊さない</li>
              <li>dynamic route 前提に戻さない</li>
              <li>route 追加時は `build` と Pages チェックまで見る</li>
              <li>内部リンクは `Link` と route 定数を優先する</li>
            </ul>
          </div>
        </div>
      </SectionCard>

      <SectionCard
        title="PR に必ず書くこと"
        description="差分の大きさより、意図と影響が読めることを重視します。"
      >
        <div className="grid gap-3 lg:grid-cols-2">
          {prChecklist.map((item) => (
            <div
              key={item}
              className="rounded-[22px] border border-slate-200 bg-slate-50/88 px-4 py-4 text-sm font-medium text-slate-700"
            >
              {item}
            </div>
          ))}
        </div>
      </SectionCard>

      <SectionCard
        id="docs"
        title="最初に読むファイル"
        description="新しく参加する人も、AI も、この順で見ると迷いにくいです。"
      >
        <div className="grid gap-3">
          {docsToRead.map((doc) => (
            <div
              key={doc.path}
              className="flex flex-wrap items-center justify-between gap-3 rounded-[24px] border border-slate-200 bg-white/84 px-4 py-4"
            >
              <div>
                <div className="font-mono text-sm text-slate-900">{doc.path}</div>
                <div className="mt-1 text-sm text-slate-600">{doc.label}</div>
              </div>
              <Badge tone="slate">最初に読む</Badge>
            </div>
          ))}
        </div>
      </SectionCard>

      <SectionCard
        title="実装禁止の領域"
        description="World Toto Lab は分析・共有・記録用です。金銭移動に踏み込む機能は追加しません。"
      >
        <div className="flex flex-wrap gap-2">
          {prohibitedAreas.map((item) => (
            <Badge key={item} tone="rose">
              {item}
            </Badge>
          ))}
        </div>
      </SectionCard>
    </div>
  );
}
