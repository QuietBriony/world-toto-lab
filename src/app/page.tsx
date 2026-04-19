"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

import {
  ConfigurationNotice,
  ErrorNotice,
  LoadingNotice,
} from "@/components/app/states";
import {
  Badge,
  buttonClassName,
  fieldClassName,
  PageHeader,
  secondaryButtonClassName,
  SectionCard,
  StatCard,
  textAreaClassName,
} from "@/components/ui";
import { demoRoundTitle } from "@/lib/demo-data";
import {
  parseIntOrNull,
  parseRoundStatus,
  stringValue,
  nullableString,
} from "@/lib/forms";
import {
  formatCurrency,
  formatPercent,
  formatSignedPercent,
  roundStatusLabel,
  roundStatusOptions,
} from "@/lib/domain";
import { appRoute, buildRoundHref } from "@/lib/round-links";
import { createDemoRound, createRound, createSampleUsers } from "@/lib/repository";
import { isSupabaseConfigured } from "@/lib/supabase";
import { useDashboardData } from "@/lib/use-app-data";

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : "不明なエラーです。";
}

export default function DashboardPage() {
  const router = useRouter();
  const { data, error, loading, refresh } = useDashboardData();
  const [busy, setBusy] = useState<"demo" | "members" | "round" | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const handleCreateSampleUsers = async () => {
    setBusy("members");
    setActionError(null);

    try {
      await createSampleUsers();
      await refresh();
    } catch (nextError) {
      setActionError(errorMessage(nextError));
    } finally {
      setBusy(null);
    }
  };

  const handleCreateRound = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setBusy("round");
    setActionError(null);

    try {
      const formData = new FormData(event.currentTarget);
      const roundId = await createRound({
        title: stringValue(formData, "title") || "新規ラウンド",
        status: parseRoundStatus(stringValue(formData, "status")),
        budgetYen: parseIntOrNull(stringValue(formData, "budgetYen")),
        notes: nullableString(formData, "notes"),
      });

      await refresh();
      router.push(buildRoundHref(appRoute.workspace, roundId));
    } catch (nextError) {
      setActionError(errorMessage(nextError));
    } finally {
      setBusy(null);
    }
  };

  const handleOpenDemo = async () => {
    setBusy("demo");
    setActionError(null);

    try {
      const roundId = await createDemoRound();
      await refresh();
      router.push(buildRoundHref(appRoute.workspace, roundId));
    } catch (nextError) {
      setActionError(errorMessage(nextError));
    } finally {
      setBusy(null);
    }
  };

  const demoRound =
    data?.rounds.find((round) => round.title === demoRoundTitle) ?? null;

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="ワールドtotoラボ"
        title="W杯totoの予想・分析・記録ダッシュボード"
        description="AI基準線を先に見て、その上に人力の別予想をかぶせながら、入力と集計と振り返りを回す MVP です。"
        actions={
          <div className="flex flex-wrap gap-3">
            <a href="#create-round" className={buttonClassName}>
              ラウンドを作成
            </a>
            <a href="#round-list" className={secondaryButtonClassName}>
              ラウンド一覧へ
            </a>
          </div>
        }
      />

      {!isSupabaseConfigured() ? (
        <ConfigurationNotice />
      ) : loading && !data ? (
        <LoadingNotice title="ダッシュボードを読み込み中" />
      ) : error && !data ? (
        <ErrorNotice error={error} onRetry={() => void refresh()} />
      ) : data ? (
        <>
          <SectionCard
            title="迷ったらこのデモラウンドから"
            description="保存済みのデモラウンドを 1 つ置いて、開くと『AI基準線と人力上書きがどういうことか』をそのまま追えるようにしています。"
            actions={
              <button
                type="button"
                className={buttonClassName}
                onClick={handleOpenDemo}
                disabled={busy === "demo"}
              >
                {busy === "demo"
                  ? "準備中..."
                  : demoRound
                    ? "デモラウンドを開く"
                    : "デモラウンドを作成"}
              </button>
            }
          >
            <div className="grid gap-4 lg:grid-cols-[1fr_1fr]">
              <div className="grid gap-3 sm:grid-cols-2">
                {[
                  {
                    step: "01",
                    title: "ラウンド詳細を開く",
                    body: "各試合の AI基準線、人力上書き、差分が同じ表で見えます。",
                  },
                  {
                    step: "02",
                    title: "人力予想を開く",
                    body: "AI 基準線に対して、人力でどう上書きしたかを実例で追えます。",
                  },
                  {
                    step: "03",
                    title: "コンセンサス / 候補チケット",
                    body: "人力が AI に 0 を足したか、別筋へ振ったかを集計と候補で見ます。",
                  },
                  {
                    step: "04",
                    title: "振り返りまで見る",
                    body: "結果と反省ログまで入っているので、一連の流れを 1 ラウンドで確認できます。",
                  },
                ].map((item) => (
                  <div
                    key={item.step}
                    className="rounded-[22px] border border-white/80 bg-white/74 p-4 shadow-[0_16px_38px_-30px_rgba(15,23,42,0.4)]"
                  >
                    <div className="font-display text-[11px] uppercase tracking-[0.34em] text-teal-800/72">
                      Step {item.step}
                    </div>
                    <h3 className="mt-3 font-display text-lg font-semibold tracking-[-0.04em] text-slate-950">
                      {item.title}
                    </h3>
                    <p className="mt-2 text-sm leading-6 text-slate-600">{item.body}</p>
                  </div>
                ))}
              </div>

              <div className="rounded-[24px] border border-slate-200 bg-slate-50/85 p-5">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge tone={demoRound ? "teal" : "amber"}>
                    {demoRound ? "保存済み" : "未作成"}
                  </Badge>
                  <h3 className="font-display text-lg font-semibold tracking-[-0.04em] text-slate-950">
                    {demoRoundTitle}
                  </h3>
                </div>
                <p className="mt-3 text-sm leading-6 text-slate-600">
                  このラウンドには試合データ、AI予測、人力予想、根拠カード、コンセンサス、候補チケット、
                  振り返りが最初から入ります。
                </p>
                {demoRound ? (
                  <div className="mt-4 flex flex-wrap gap-2">
                    <Link
                      href={buildRoundHref(appRoute.workspace, demoRound.id)}
                      className={secondaryButtonClassName}
                    >
                      ラウンド詳細
                    </Link>
                    <Link
                      href={buildRoundHref(appRoute.picks, demoRound.id, {
                        user: data.users[0]?.id,
                      })}
                      className={secondaryButtonClassName}
                    >
                      人力予想
                    </Link>
                    <Link
                      href={buildRoundHref(appRoute.consensus, demoRound.id)}
                      className={secondaryButtonClassName}
                    >
                      コンセンサス
                    </Link>
                    <Link
                      href={buildRoundHref(appRoute.review, demoRound.id)}
                      className={secondaryButtonClassName}
                    >
                      振り返り
                    </Link>
                  </div>
                ) : null}
              </div>
            </div>
            {actionError ? <p className="text-sm text-rose-700">{actionError}</p> : null}
          </SectionCard>

          <SectionCard
            title="このサイトは何をするもの？"
            description="友人グループで W杯toto / WINNER の見立てを共有し、AI基準線と人力上書きを一つの流れで扱う分析ラボです。"
          >
            <div className="grid gap-4 lg:grid-cols-3">
              {[
                {
                  eyebrow: "入力",
                  title: "予想を持ち寄る",
                  body: "まず AI基準線 を見てから、人力予想と根拠カードで 1/0/2 の予想と根拠を重ねます。",
                },
                {
                  eyebrow: "比較",
                  title: "差分を比べる",
                  body: "公式人気 / 市場 / AI / 人力 の差分を、ラウンド詳細・コンセンサス・差分ボードで並べて見ます。",
                },
                {
                  eyebrow: "振り返り",
                  title: "結果を振り返る",
                  body: "振り返りで的中数、対立パターン、反省メモを残して次回に活かします。",
                },
              ].map((item) => (
                <div
                  key={item.title}
                  className="rounded-[24px] border border-white/80 bg-white/76 p-5 shadow-[0_18px_44px_-30px_rgba(15,23,42,0.4)]"
                >
                  <div className="font-display text-[11px] uppercase tracking-[0.34em] text-teal-800/72">
                    {item.eyebrow}
                  </div>
                  <h3 className="mt-3 font-display text-xl font-semibold tracking-[-0.05em] text-slate-950">
                    {item.title}
                  </h3>
                  <p className="mt-3 text-sm leading-6 text-slate-600">{item.body}</p>
                </div>
              ))}
            </div>
          </SectionCard>

          <SectionCard
            title="最初の使い方"
            description="初回はこの順で進めると迷いにくいです。"
          >
            <div className="grid gap-4 lg:grid-cols-2">
              {[
                {
                  step: "01",
                  title: "サンプル10人を作成",
                  body: "共有メンバーを先に用意します。認証なし MVP なので、ここで作った表示名を切り替えて入力します。",
                  tone: data.users.length > 0 ? "teal" : "amber",
                  status: data.users.length > 0 ? "済み" : "次にやる",
                },
                {
                  step: "02",
                  title: "ラウンドを作成",
                  body: "ラウンドを作ると 13 試合のプレースホルダーが自動でできます。まずは対象回を1つ作ります。",
                  tone: data.rounds.length > 0 ? "teal" : "amber",
                  status: data.rounds.length > 0 ? "作成可" : "作成待ち",
                },
                {
                  step: "03",
                  title: "試合編集で試合情報を入れる",
                  body: "ラウンド詳細から各試合の編集に入り、チーム名、確率、カテゴリ、メモを埋めます。",
                  tone: "sky",
                  status: "入力導線あり",
                },
                {
                  step: "04",
                  title: "人力予想 / 根拠カードを入力",
                  body: "ユーザーを切り替えて 1/0/2 と根拠カードを入れます。ここが共有利用の中心です。",
                  tone: "sky",
                  status: "保存対応",
                },
                {
                  step: "05",
                  title: "コンセンサス / 差分 / 候補チケットを見る",
                  body: "入力が集まると、人力コンセンサス、差分、買い目候補の比較が使えるようになります。",
                  tone: "sky",
                  status: "集計対応",
                },
                {
                  step: "06",
                  title: "結果入力と振り返り",
                  body: "試合後に結果を入れて、AI・人力・市場との差や反省ログを残します。",
                  tone: "sky",
                  status: "振り返り対応",
                },
              ].map((item) => (
                <div
                  key={item.step}
                  className="grid gap-3 rounded-[24px] border border-white/80 bg-white/76 p-5 shadow-[0_18px_44px_-30px_rgba(15,23,42,0.4)] sm:grid-cols-[auto_1fr]"
                >
                  <div className="flex h-12 w-12 items-center justify-center rounded-[16px] border border-slate-200 bg-slate-950 text-sm font-semibold text-white">
                    {item.step}
                  </div>
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-display text-lg font-semibold tracking-[-0.04em] text-slate-950">
                        {item.title}
                      </h3>
                      <Badge tone={item.tone as "amber" | "sky" | "teal"}>{item.status}</Badge>
                    </div>
                    <p className="mt-2 text-sm leading-6 text-slate-600">{item.body}</p>
                  </div>
                </div>
              ))}
            </div>
          </SectionCard>

          <SectionCard
            title="今どこまで使える？"
            description="共有 MVP としてのコア機能は入っていますが、まだフルプロダクトではありません。"
          >
            <div className="grid gap-4 lg:grid-cols-2">
              <div className="rounded-[24px] border border-emerald-200 bg-emerald-50/85 p-5">
                <div className="flex items-center gap-2">
                  <Badge tone="teal">今使える</Badge>
                  <h3 className="font-display text-lg font-semibold tracking-[-0.04em] text-slate-950">
                    コア MVP は使用可能
                  </h3>
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  {[
                    "ラウンド一覧",
                    "ラウンド詳細",
                    "試合編集",
                    "人力予想",
                    "根拠カード",
                    "コンセンサス",
                    "差分ボード",
                    "候補チケット",
                    "振り返り",
                    "GitHub Pages公開",
                    "Supabase保存",
                  ].map((item) => (
                    <Badge key={item} tone="teal">
                      {item}
                    </Badge>
                  ))}
                </div>
              </div>

              <div className="rounded-[24px] border border-amber-200 bg-amber-50/88 p-5">
                <div className="flex items-center gap-2">
                  <Badge tone="amber">まだない</Badge>
                  <h3 className="font-display text-lg font-semibold tracking-[-0.04em] text-slate-950">
                    フル機能ではない部分
                  </h3>
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  {[
                    "認証",
                    "権限制御",
                    "CSV取込",
                    "リアルタイム同期",
                    "外部API自動取得",
                    "精密な最適化",
                  ].map((item) => (
                    <Badge key={item} tone="amber">
                      {item}
                    </Badge>
                  ))}
                </div>
                <p className="mt-4 text-sm leading-6 text-slate-600">
                  なので答えとしては、「普通に使える共有 MVP にはなっているが、運用向けの完成版ではない」です。
                </p>
              </div>
            </div>
          </SectionCard>

          <SectionCard
            title="運用メモと公開時の注意"
            description="普段は畳んでおいて、必要なときだけ確認できるメモです。公開サイトとして使う前提の注意をまとめています。"
          >
            <div className="grid gap-3">
              {[
                {
                  defaultOpen: true,
                  eyebrow: "保存先",
                  title: "データはどこに保存される？",
                  summary:
                    "GitHub の repo にメンバー情報や予想が直接書き戻るわけではありません。保存先は Supabase です。",
                  body: "このサイトで作成したメンバー名、ラウンド、人力予想、根拠カード、振り返りメモは Supabase の DB に保存されます。GitHub Pages は画面を配信しているだけで、保存データそのものを GitHub のコード一覧に並べるものではありません。",
                  note: "ただし今の MVP は公開サイト + 匿名アクセス前提なので、公開 URL 経由で読める前提で扱ってください。",
                  tone: "teal" as const,
                },
                {
                  defaultOpen: false,
                  eyebrow: "公開範囲",
                  title: "名前はどう入れる？",
                  summary:
                    "本名や連絡先ではなく、ハンドル名やニックネーム前提で使うのが安全です。",
                  body: "今の構成は 10 人前後の内輪共有 MVP です。メンバー1、観戦会A、Briony みたいな表示名で十分で、メールアドレス、電話番号、精算メモのような個人情報は入れない運用が向いています。",
                  note: "ちゃんと守りたい場合は、将来的に認証と権限制御を入れる前提です。",
                  tone: "amber" as const,
                },
                {
                  defaultOpen: false,
                  eyebrow: "対象外",
                  title: "この MVP でやらないこと",
                  summary:
                    "購入代行、賭け金管理、配当分配、精算は扱いません。分析と記録に限定しています。",
                  body: "この UI は AI基準線と人力上書きを比べて、予想の根拠や振り返りを残すためのものです。金銭の受け渡しや代理購入のフローは入れていませんし、今後も別物として扱う想定です。",
                  note: "公式サービスの利用は各自の判断で行う前提です。",
                  tone: "sky" as const,
                },
              ].map((item) => (
                <details
                  key={item.title}
                  open={item.defaultOpen}
                  className="group overflow-hidden rounded-[24px] border border-white/70 bg-[linear-gradient(145deg,rgba(255,255,255,0.92),rgba(244,250,246,0.88))] shadow-[0_20px_50px_-36px_rgba(0,0,0,0.32)]"
                >
                  <summary className="flex cursor-pointer list-none items-start justify-between gap-4 px-5 py-4 [&::-webkit-details-marker]:hidden">
                    <div className="space-y-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge tone={item.tone}>{item.eyebrow}</Badge>
                        <h3 className="font-display text-lg font-semibold tracking-[-0.04em] text-slate-950">
                          {item.title}
                        </h3>
                      </div>
                      <p className="max-w-3xl text-sm leading-6 text-slate-600">
                        {item.summary}
                      </p>
                    </div>
                    <span className="rounded-full border border-slate-200 bg-white/84 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500">
                      開く
                    </span>
                  </summary>
                  <div className="border-t border-slate-200/80 px-5 py-4">
                    <div className="grid gap-4 lg:grid-cols-[1.3fr_0.7fr]">
                      <p className="text-sm leading-7 text-slate-700">{item.body}</p>
                      <div className="rounded-[20px] border border-slate-200 bg-slate-50/88 p-4 text-sm leading-7 text-slate-600">
                        <div className="font-display text-[11px] uppercase tracking-[0.32em] text-slate-500">
                          補足
                        </div>
                        <p className="mt-2">{item.note}</p>
                      </div>
                    </div>
                  </div>
                </details>
              ))}
            </div>
          </SectionCard>

          <SectionCard
            className="metric-grid"
            title="このラボでできること"
            description="保存、共有、分析を一つの流れで回すための MVP です。単なる紹介ページではなく、実際の入力と集計に寄せています。"
          >
            <div className="grid gap-4 lg:grid-cols-3">
              {[
                {
                  kicker: "集める",
                  title: "人力の見立てを集める",
                  body: "人力予想と根拠カードで、試合ごとの理由つき入力を共有します。",
                },
                {
                  kicker: "比べる",
                  title: "モデル差分を並べる",
                  body: "公式人気 / 市場 / AI / 人力 を同じ面で比較できます。",
                },
                {
                  kicker: "残す",
                  title: "反省を次回に残す",
                  body: "振り返りで的中率だけでなく一致・対立パターンも振り返ります。",
                },
              ].map((item) => (
                <div
                  key={item.kicker}
                  className="rounded-[24px] border border-white/70 bg-white/72 p-4 shadow-[0_18px_44px_-30px_rgba(15,23,42,0.42)]"
                >
                  <div className="font-display text-[11px] uppercase tracking-[0.34em] text-teal-800/72">
                    {item.kicker}
                  </div>
                  <h3 className="mt-3 font-display text-xl font-semibold tracking-[-0.05em] text-slate-950">
                    {item.title}
                  </h3>
                  <p className="mt-3 text-sm leading-6 text-slate-600">{item.body}</p>
                </div>
              ))}
            </div>
          </SectionCard>

          <section className="grid gap-4 md:grid-cols-4">
            <StatCard
              label="ラウンド数"
              value={`${data.rounds.length}`}
              hint="開催回の下書きからレビュー済みまでを一覧表示"
            />
            <StatCard
              label="登録メンバー"
              value={`${data.users.length}`}
              hint="認証なし MVP なので表示名を共有で使います"
            />
            <StatCard
              label="入力済み予想"
              value={`${data.rounds.reduce((sum, round) => sum + round.pickCount, 0)}`}
              hint="友人メンバーの 1 / 0 / 2 入力件数"
            />
            <StatCard
              label="結果確定"
              value={`${data.rounds.reduce((sum, round) => sum + round.resultedCount, 0)}`}
              hint="結果が入力されている試合数"
            />
          </section>

          <SectionCard
            title="共有メンバー"
            description="MVP では認証を入れず、表示名つきの共有入力として運用します。"
            actions={
              data.users.length === 0 ? (
                <button
                  type="button"
                  className={buttonClassName}
                  onClick={handleCreateSampleUsers}
                  disabled={busy === "members"}
                >
                  {busy === "members" ? "作成中..." : "サンプル10人を作成"}
                </button>
              ) : null
            }
          >
            {data.users.length === 0 ? (
              <p className="text-sm text-slate-600">
                人力予想 / 根拠カードを使う前に、まず共有メンバーを作成してください。
              </p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {data.users.map((user) => (
                  <Badge key={user.id} tone={user.role === "admin" ? "teal" : "slate"}>
                    {user.name}
                  </Badge>
                ))}
              </div>
            )}
          </SectionCard>

          <SectionCard
            id="create-round"
            title="ラウンドを作成"
            description="ラウンド作成時に 13 試合ぶんのプレースホルダーも自動で作成します。"
          >
            <form onSubmit={handleCreateRound} className="grid gap-5 md:grid-cols-2">
              <label className="grid gap-2 text-sm font-medium text-slate-700">
                ラウンド名
                <input
                  name="title"
                  className={fieldClassName}
                  placeholder="W杯サンプル回"
                />
              </label>

              <label className="grid gap-2 text-sm font-medium text-slate-700">
                ステータス
                <select name="status" className={fieldClassName} defaultValue="draft">
                  {roundStatusOptions.map((status) => (
                    <option key={status} value={status}>
                      {roundStatusLabel[status]}
                    </option>
                  ))}
                </select>
              </label>

              <label className="grid gap-2 text-sm font-medium text-slate-700">
                予算（円）
                <input
                  name="budgetYen"
                  type="number"
                  min={0}
                  step={100}
                  className={fieldClassName}
                  placeholder="2000"
                />
              </label>

              <div className="rounded-3xl border border-dashed border-slate-300 bg-slate-950/5 p-4 text-sm text-slate-600">
                金銭、配当、代理購入、精算は扱いません。ここでの予算は候補チケットの枚数目安にだけ使います。
              </div>

              <label className="grid gap-2 text-sm font-medium text-slate-700 md:col-span-2">
                メモ
                <textarea
                  name="notes"
                  className={textAreaClassName}
                  placeholder="このラウンドで気にしたいテーマ、友人会の着眼点など"
                />
              </label>

              <div className="md:col-span-2 flex justify-end">
                <button
                  type="submit"
                  className={buttonClassName}
                  disabled={busy === "round"}
                >
                  {busy === "round" ? "作成中..." : "ラウンドを作成"}
                </button>
              </div>
            </form>
            {actionError ? <p className="text-sm text-rose-700">{actionError}</p> : null}
          </SectionCard>

          <section id="round-list" className="grid gap-5 xl:grid-cols-2">
            {data.rounds.map((round) => (
              <SectionCard
                key={round.id}
                title={round.title}
                description={round.notes ?? "ラウンドメモはまだありません。"}
                actions={
                  <div className="flex items-center gap-2">
                    {round.title === demoRoundTitle ? (
                      <Badge tone="amber">デモ</Badge>
                    ) : null}
                    <Badge tone="sky">{roundStatusLabel[round.status]}</Badge>
                    <Link
                      href={buildRoundHref(appRoute.workspace, round.id)}
                      className={secondaryButtonClassName}
                    >
                      ラウンド詳細
                    </Link>
                  </div>
                }
              >
                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                  <StatCard label="試合数" value={`${round.matchCount}`} compact />
                  <StatCard label="予想数" value={`${round.pickCount}`} compact />
                  <StatCard label="結果確定数" value={`${round.resultedCount}`} compact />
                  <StatCard
                    label="人力コンセンサス完成率"
                    value={formatPercent(round.consensusCompletion)}
                    compact
                  />
                </div>

                <div className="rounded-3xl border border-white/60 bg-white/80 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <h3 className="text-sm font-semibold text-slate-900">
                      Edgeが大きい試合トップ3
                    </h3>
                    <span className="text-xs text-slate-500">
                      予算 {formatCurrency(round.budgetYen)}
                    </span>
                  </div>
                  <div className="mt-3 space-y-2">
                    {round.topEdges.length === 0 ? (
                      <p className="text-sm text-slate-500">
                        モデル確率と公式人気が入るとここに表示されます。
                      </p>
                    ) : (
                      round.topEdges.map((edge) => (
                        <div
                          key={edge.matchId}
                          className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-slate-950/5 px-3 py-2"
                        >
                          <span className="text-sm font-medium text-slate-800">
                            #{edge.matchNo} {edge.fixture}
                          </span>
                          <span className="text-sm font-semibold text-emerald-700">
                            {formatSignedPercent(edge.edge)}
                          </span>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </SectionCard>
            ))}
          </section>
        </>
      ) : null}
    </div>
  );
}
