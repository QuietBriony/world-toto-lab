"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

import {
  ConfigurationNotice,
  ErrorNotice,
  LoadingNotice,
} from "@/components/app/states";
import { FeedbackBoard } from "@/components/feedback-board";
import {
  Badge,
  buttonClassName,
  CollapsibleSectionCard,
  fieldClassName,
  PageHeader,
  secondaryButtonClassName,
  SectionCard,
  StatCard,
  textAreaClassName,
} from "@/components/ui";
import { demoFocusMatches, demoRoundTitle, demoWalkthroughSteps } from "@/lib/demo-data";
import {
  parseIntOrNull,
  parseRoundStatus,
  stringValue,
  nullableString,
} from "@/lib/forms";
import {
  formatCurrency,
  formatDateTime,
  formatPercent,
  formatSignedPercent,
  roundStatusLabel,
  roundStatusOptions,
} from "@/lib/domain";
import { deriveRoundProgressSummary, matchHasSetupInput } from "@/lib/round-progress";
import { appRoute, buildRoundHref } from "@/lib/round-links";
import {
  createDemoRound,
  createRound,
  createSampleUsers,
  createUser,
  updateUserProfile,
} from "@/lib/repository";
import { parseUserRole, userRoleDescription, userRoleLabel } from "@/lib/users";
import { isSupabaseConfigured } from "@/lib/supabase";
import { useDashboardData } from "@/lib/use-app-data";

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : "不明なエラーです。";
}

function progressValue(done: number, total: number) {
  return total > 0 ? `${done}/${total}` : "未設定";
}

function hasAiInputs(model: { modelProb0: number | null; modelProb1: number | null; modelProb2: number | null }) {
  return model.modelProb1 !== null || model.modelProb0 !== null || model.modelProb2 !== null;
}

export default function DashboardPage() {
  const router = useRouter();
  const { data, error, loading, refresh } = useDashboardData();
  const [busy, setBusy] = useState<"demo" | "members" | "round" | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [addingMember, setAddingMember] = useState(false);
  const [savingMemberId, setSavingMemberId] = useState<string | null>(null);
  const [memberActionError, setMemberActionError] = useState<string | null>(null);

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

  const handleAddMember = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setAddingMember(true);
    setMemberActionError(null);

    try {
      const formData = new FormData(event.currentTarget);
      await createUser({
        name: stringValue(formData, "memberName"),
        role: parseUserRole(stringValue(formData, "memberRole")),
      });
      event.currentTarget.reset();
      await refresh();
    } catch (nextError) {
      setMemberActionError(errorMessage(nextError));
    } finally {
      setAddingMember(false);
    }
  };

  const handleSaveMember = async (
    event: FormEvent<HTMLFormElement>,
    userId: string,
  ) => {
    event.preventDefault();
    setSavingMemberId(userId);
    setMemberActionError(null);

    try {
      const formData = new FormData(event.currentTarget);
      await updateUserProfile({
        userId,
        name: stringValue(formData, "memberName"),
        role: parseUserRole(stringValue(formData, "memberRole")),
      });
      await refresh();
    } catch (nextError) {
      setMemberActionError(errorMessage(nextError));
    } finally {
      setSavingMemberId(null);
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
  const latestRound = data?.rounds[0] ?? null;
  const latestRoundProgress =
    data && latestRound
      ? deriveRoundProgressSummary({
          matches: latestRound.matches,
          picks: latestRound.picks,
          resultedCount: latestRound.resultedCount,
          roundId: latestRound.id,
          scoutReports: latestRound.scoutReports,
          users: data.users,
        })
      : null;
  const upcomingMatches = data
    ? data.rounds
        .flatMap((round) =>
          round.matches
            .filter((match) => {
              if (!match.kickoffTime) {
                return false;
              }

              return new Date(match.kickoffTime).getTime() >= Date.now();
            })
            .map((match) => ({
              round,
              match,
            })),
        )
        .sort((left, right) => {
          const leftTime = left.match.kickoffTime
            ? new Date(left.match.kickoffTime).getTime()
            : Number.POSITIVE_INFINITY;
          const rightTime = right.match.kickoffTime
            ? new Date(right.match.kickoffTime).getTime()
            : Number.POSITIVE_INFINITY;
          return leftTime - rightTime;
        })
        .slice(0, 8)
    : [];

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="ワールドtotoラボ"
        title="W杯totoの予想・分析・記録ダッシュボード"
        description="AI基準線と少数の予想者を見比べながら、他メンバーは支持先を選べる共有 MVP です。"
        actions={
          <div className="flex flex-wrap gap-3">
            {!data || data.users.length === 0 ? (
              <button
                type="button"
                className={buttonClassName}
                onClick={handleCreateSampleUsers}
                disabled={busy === "members"}
              >
                {busy === "members" ? "作成中..." : "共有メンバーを作成"}
              </button>
            ) : latestRoundProgress ? (
              <Link href={latestRoundProgress.nextStep.href} className={buttonClassName}>
                {latestRoundProgress.nextStep.label}
              </Link>
            ) : (
              <a href="#create-round" className={buttonClassName}>
                ラウンドを作成
              </a>
            )}
            <button
              type="button"
              className={secondaryButtonClassName}
              onClick={handleOpenDemo}
              disabled={busy === "demo"}
            >
              {busy === "demo" ? "準備中..." : "デモで体験する"}
            </button>
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
            title="まずここから始める"
            description="初回セットアップ、デモ体験、続きから再開だけを先に見えるようにしています。"
          >
            <div className="grid gap-4 lg:grid-cols-3">
              <div className="rounded-[24px] border border-white/80 bg-white/76 p-5 shadow-[0_18px_44px_-30px_rgba(15,23,42,0.4)]">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge tone={data.users.length > 0 ? "teal" : "amber"}>
                    {data.users.length > 0 ? "準備済み" : "最初の一歩"}
                  </Badge>
                  <h3 className="font-display text-lg font-semibold tracking-[-0.04em] text-slate-950">
                    初回セットアップ
                  </h3>
                </div>
                <p className="mt-3 text-sm leading-6 text-slate-600">
                  共有メンバーを先に作り、1 人以上を予想者にすると、そのまま比較と支持入力へ進めます。
                </p>
                <div className="mt-4 flex flex-wrap gap-2">
                  {data.users.length === 0 ? (
                    <button
                      type="button"
                      className={buttonClassName}
                      onClick={handleCreateSampleUsers}
                      disabled={busy === "members"}
                    >
                      {busy === "members" ? "作成中..." : "サンプル10人を作成"}
                    </button>
                  ) : (
                    <a href="#shared-members" className={secondaryButtonClassName}>
                      メンバーを確認
                    </a>
                  )}
                </div>
              </div>

              <div className="rounded-[24px] border border-white/80 bg-white/76 p-5 shadow-[0_18px_44px_-30px_rgba(15,23,42,0.4)]">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge tone={demoRound ? "teal" : "amber"}>
                    {demoRound ? "すぐ触れる" : "体験用"}
                  </Badge>
                  <h3 className="font-display text-lg font-semibold tracking-[-0.04em] text-slate-950">
                    デモで流れを見る
                  </h3>
                </div>
                <p className="mt-3 text-sm leading-6 text-slate-600">
                  1 ラウンドぶんの入力と振り返りが最初から入っているので、操作の全体感を最短で確認できます。
                </p>
                <div className="mt-4 flex flex-wrap gap-2">
                  <button
                    type="button"
                    className={buttonClassName}
                    onClick={handleOpenDemo}
                    disabled={busy === "demo"}
                  >
                    {busy === "demo" ? "準備中..." : "デモラウンドを開く"}
                  </button>
                </div>
              </div>

              <div className="rounded-[24px] border border-white/80 bg-white/76 p-5 shadow-[0_18px_44px_-30px_rgba(15,23,42,0.4)]">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge tone={latestRoundProgress?.nextStep.tone ?? "sky"}>
                    {latestRound ? "続きから" : "次にやる"}
                  </Badge>
                  <h3 className="font-display text-lg font-semibold tracking-[-0.04em] text-slate-950">
                    今やること
                  </h3>
                </div>
                <p className="mt-3 text-sm leading-6 text-slate-600">
                  {latestRound && latestRoundProgress
                    ? `${latestRound.title} の次アクションは「${latestRoundProgress.nextStep.label}」です。`
                    : "共有メンバーができたら、新しいラウンドを作って試合設定から始めます。"}
                </p>
                <div className="mt-4 flex flex-wrap gap-2">
                  {latestRound && latestRoundProgress ? (
                    <>
                      <Link href={latestRoundProgress.nextStep.href} className={buttonClassName}>
                        {latestRoundProgress.nextStep.label}
                      </Link>
                      <Link
                        href={buildRoundHref(appRoute.workspace, latestRound.id)}
                        className={secondaryButtonClassName}
                      >
                        ラウンド詳細
                      </Link>
                    </>
                  ) : (
                    <a href="#create-round" className={secondaryButtonClassName}>
                      ラウンド作成へ
                    </a>
                  )}
                </div>
              </div>
            </div>
          </SectionCard>

          <SectionCard
            title="迷ったらこのデモラウンドから"
            description="保存済みの 1 ラウンドを置いてあるので、開くだけで全体の流れを追えます。"
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
                {demoWalkthroughSteps.map((item, index) => (
                  <div
                    key={item.key}
                    className="rounded-[22px] border border-white/80 bg-white/74 p-4 shadow-[0_16px_38px_-30px_rgba(15,23,42,0.4)]"
                  >
                    <div className="font-display text-[11px] uppercase tracking-[0.34em] text-teal-800/72">
                      手順 {String(index + 1).padStart(2, "0")}
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
                  このラウンドには試合データ、AI予測、予想者ライン、支持入力、予想者カード、コンセンサス、候補チケット、
                  振り返りが最初から入ります。
                </p>
                {demoRound ? (
                  <div className="mt-4 flex flex-wrap gap-2">
                    <Badge tone="slate">{demoRound.matchCount}試合</Badge>
                    <Badge tone="slate">{data.users.length}人</Badge>
                    <Badge tone="slate">{demoRound.pickCount}予想</Badge>
                    <Badge tone="slate">{demoRound.scoutReports.length}根拠</Badge>
                    <Badge tone="slate">{demoRound.resultedCount}結果</Badge>
                  </div>
                ) : null}
                <div className="mt-4 flex flex-wrap gap-2">
                  {demoFocusMatches.map((item) => (
                    <Badge key={`demo-focus-${item.matchNo}`} tone="sky">
                      #{item.matchNo} {item.label}
                    </Badge>
                  ))}
                </div>
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
                      支持 / 予想
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

          <CollapsibleSectionCard
            title="このサイトは何をするもの？"
            description="友人グループで W杯toto / WINNER の見立てを共有し、AI基準線と少数の予想者ラインを比べながら、他メンバーは支持先を選べる分析ラボです。"
            defaultOpen={false}
            badge={<Badge tone="teal">全体像</Badge>}
          >
            <div className="grid gap-4 lg:grid-cols-3">
              {[
                {
                  eyebrow: "入力",
                  title: "AIと予想者を並べる",
                  body: "まず AI基準線 と予想者ラインを見ます。予想者は 1/0/2 とカードを入れ、他メンバーは支持先を選びます。",
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
          </CollapsibleSectionCard>

          <CollapsibleSectionCard
            title="最初の使い方"
            description="初回はこの順で進めると迷いにくいです。"
            defaultOpen={false}
            badge={<Badge tone="sky">チュートリアル</Badge>}
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
                  title: "支持 / 予想と予想者カードを入力",
                  body: "予想者は 1/0/2 とカードを入れ、ウォッチ担当は AI か予想者のどちらに乗るかを選びます。",
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
          </CollapsibleSectionCard>

          <FeedbackBoard />

          <CollapsibleSectionCard
            title="今どこまで使える？"
            description="共有 MVP としてのコア機能は入っていますが、まだフルプロダクトではありません。"
            defaultOpen={false}
            badge={<Badge tone="amber">到達点</Badge>}
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
          </CollapsibleSectionCard>

          <CollapsibleSectionCard
            title="運用メモと公開時の注意"
            description="公開サイトとして使う前提の注意を、必要なときだけ開けるようにまとめています。"
            defaultOpen={false}
            badge={<Badge tone="slate">注意</Badge>}
          >
            <div className="grid gap-3">
              {[
                {
                  defaultOpen: false,
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
                    <span className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white/84 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500">
                      <svg
                        viewBox="0 0 20 20"
                        fill="none"
                        aria-hidden="true"
                        className="h-3.5 w-3.5 transition-transform duration-200 group-open:rotate-180"
                      >
                        <path
                          d="M5 7.5L10 12.5L15 7.5"
                          stroke="currentColor"
                          strokeWidth="1.75"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                      <span>開閉</span>
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
          </CollapsibleSectionCard>

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
            title="今後の試合予定"
            description="キックオフ時刻が入っている試合を近い順に並べています。AIや試合情報の入力状況もここで確認できます。"
          >
            {upcomingMatches.length === 0 ? (
              <div className="rounded-[24px] border border-dashed border-slate-300 bg-slate-50/88 p-5 text-sm leading-7 text-slate-600">
                まだ今後の試合予定はありません。ラウンド詳細の「試合編集」でキックオフ日時を入れると、ここに次の試合が出ます。
              </div>
            ) : (
              <div className="grid gap-4 xl:grid-cols-2">
                {upcomingMatches.map(({ round, match }) => {
                  const aiReady = hasAiInputs(match);

                  return (
                    <div
                      key={match.id}
                      className="rounded-[24px] border border-white/80 bg-white/76 p-5 shadow-[0_18px_44px_-30px_rgba(15,23,42,0.4)]"
                    >
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge tone="sky">{formatDateTime(match.kickoffTime)}</Badge>
                        <Badge tone="slate">{round.title}</Badge>
                        <Badge tone={aiReady ? "teal" : "amber"}>
                          {aiReady ? "AIあり" : "AI未入力"}
                        </Badge>
                      </div>
                      <h3 className="mt-3 font-display text-xl font-semibold tracking-[-0.05em] text-slate-950">
                        #{match.matchNo} {match.homeTeam} 対 {match.awayTeam}
                      </h3>
                      <p className="mt-2 text-sm leading-6 text-slate-600">
                        {[match.stage, match.venue].filter(Boolean).join(" / ") || "会場・ステージは未入力"}
                      </p>
                      <div className="mt-4 flex flex-wrap gap-2">
                        <Badge tone={aiReady ? "teal" : "amber"}>
                          {aiReady
                            ? `AI ${formatPercent(match.modelProb1)} / ${formatPercent(match.modelProb0)} / ${formatPercent(match.modelProb2)}`
                            : "AI確率はまだ入っていません"}
                        </Badge>
                        <Badge tone={matchHasSetupInput(match) ? "teal" : "amber"}>
                          {matchHasSetupInput(match) ? "試合情報あり" : "試合情報はまだ薄い"}
                        </Badge>
                      </div>
                      <div className="mt-4 flex flex-wrap gap-2">
                        <Link
                          href={buildRoundHref(appRoute.workspace, round.id)}
                          className={secondaryButtonClassName}
                        >
                          ラウンドを見る
                        </Link>
                        <Link
                          href={buildRoundHref(appRoute.matchEditor, round.id, {
                            match: match.id,
                          })}
                          className={secondaryButtonClassName}
                        >
                          試合編集
                        </Link>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </SectionCard>

          <CollapsibleSectionCard
            title="試合データとAI分析の入り方"
            description="今どこまで自動で出ていて、どこから先が手入力かを先に分かるようにしています。"
            defaultOpen={false}
            badge={<Badge tone="sky">データ状況</Badge>}
          >
            <div className="grid gap-4 lg:grid-cols-2">
              <div className="rounded-[24px] border border-emerald-200 bg-emerald-50/85 p-5">
                <div className="flex items-center gap-2">
                  <Badge tone="teal">今できる</Badge>
                  <h3 className="font-display text-lg font-semibold tracking-[-0.04em] text-slate-950">
                    保存済みデータはちゃんと表示できる
                  </h3>
                </div>
                <ul className="mt-4 space-y-2 text-sm leading-7 text-slate-700">
                  <li>デモラウンドには試合情報、AI確率、予想者ライン、支持入力、予想者カード、レビューが最初から入っています。</li>
                  <li>新規ラウンドでも、試合編集に入れた日時、会場、ステージ、公式人気、市場、AI確率は各画面に反映されます。</li>
                  <li>AI分析として見えているのは、いまは `1 / 0 / 2` の確率と、そこから作る AI基準線・差分計算です。</li>
                </ul>
              </div>

              <div className="rounded-[24px] border border-amber-200 bg-amber-50/88 p-5">
                <div className="flex items-center gap-2">
                  <Badge tone="amber">まだない</Badge>
                  <h3 className="font-display text-lg font-semibold tracking-[-0.04em] text-slate-950">
                    自動取得と自動分析は未実装
                  </h3>
                </div>
                <ul className="mt-4 space-y-2 text-sm leading-7 text-slate-700">
                  <li>実試合の日程や対戦カードを外部 API から自動で取る処理はまだありません。</li>
                  <li>AI確率をこのサイト内で自動計算するモデル連携もまだありません。</li>
                  <li>なので現状は、デモを見るか、試合編集で実データを入れて使う MVP です。</li>
                </ul>
              </div>
            </div>
          </CollapsibleSectionCard>

          <SectionCard
            id="shared-members"
            title="共有メンバー"
            description="認証なし MVP なので、ここであだ名と役割を決めます。各行で `あだ名` と `役割` を変えて、右端のボタンで更新します。"
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
                まず共有メンバーを作り、少なくとも 1 人は `予想者` にしてください。
              </p>
            ) : (
              <div className="grid gap-5 xl:grid-cols-[1.1fr_0.9fr]">
                <div className="grid gap-3">
                  <div className="rounded-[22px] border border-slate-200 bg-slate-50/90 p-4 text-sm leading-6 text-slate-600">
                    左側は登録済みメンバーの編集です。
                    文字が入っている行はすでに使っているメンバーなので、名前を変えたいときだけ触ります。
                    新しい人を増やすときは、右側の `新しいあだ名を追加` を使ってください。
                  </div>
                  {data.users.map((user) => (
                    <form
                      key={user.id}
                      onSubmit={(event) => void handleSaveMember(event, user.id)}
                      className="grid gap-3 rounded-[22px] border border-white/80 bg-white/76 p-4 shadow-[0_16px_38px_-30px_rgba(15,23,42,0.4)] sm:grid-cols-[auto_1fr_200px_auto]"
                    >
                      <div className="flex items-center">
                        <Badge tone={user.role === "admin" ? "teal" : "slate"}>
                          {userRoleLabel[user.role]}
                        </Badge>
                      </div>
                      <label className="grid gap-2 text-sm font-medium text-slate-700">
                        あだ名
                        <div className="text-xs font-normal leading-5 text-slate-500">
                          いま登録されている名前です。変更したいときだけ直します。
                        </div>
                        <input
                          name="memberName"
                          defaultValue={user.name}
                          className={fieldClassName}
                          placeholder="ブリオニー / 観戦会A / 友人B"
                        />
                      </label>
                      <label className="grid gap-2 text-sm font-medium text-slate-700">
                        役割
                        <select
                          name="memberRole"
                          defaultValue={user.role}
                          className={fieldClassName}
                          title={userRoleDescription[user.role]}
                        >
                          <option value="admin">予想者</option>
                          <option value="member">ウォッチ</option>
                        </select>
                      </label>
                      <button
                        type="submit"
                        className={secondaryButtonClassName}
                        disabled={savingMemberId === user.id}
                      >
                        {savingMemberId === user.id ? "更新中..." : "名前と役割を更新"}
                      </button>
                    </form>
                  ))}
                </div>

                <div className="rounded-[24px] border border-amber-200 bg-amber-50/90 p-5 shadow-[0_18px_44px_-30px_rgba(15,23,42,0.24)]">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge tone="amber">ここが新規追加</Badge>
                    <h3 className="font-display text-lg font-semibold tracking-[-0.04em] text-slate-950">
                      新しいあだ名を追加
                    </h3>
                  </div>
                  <p className="mt-3 text-sm leading-6 text-slate-600">
                    新しくメンバーを増やす場所です。右下の入力欄が空いていたら、そこに新しいあだ名を入れてください。
                    すでに左側で文字が入っているものは登録済みです。
                  </p>
                  <form onSubmit={handleAddMember} className="mt-4 grid gap-3">
                    <label className="grid gap-2 text-sm font-medium text-slate-700">
                      あだ名
                      <div className="text-xs font-normal leading-5 text-slate-500">
                        ここに新しい人の呼び名を入れます
                      </div>
                      <input
                        name="memberName"
                        className={fieldClassName}
                        placeholder="ここに新しいあだ名を入力"
                      />
                    </label>
                    <label className="grid gap-2 text-sm font-medium text-slate-700">
                      役割
                      <div className="text-xs font-normal leading-5 text-slate-500">
                        予想を直接入れる人なら `予想者`、見るだけなら `ウォッチ`
                      </div>
                      <select name="memberRole" className={fieldClassName} defaultValue="member">
                        <option value="member">ウォッチとして追加</option>
                        <option value="admin">予想者として追加</option>
                      </select>
                    </label>
                    <button
                      type="submit"
                      className={buttonClassName}
                      disabled={addingMember}
                    >
                      {addingMember ? "追加中..." : "このあだ名で追加"}
                    </button>
                  </form>
                  <div className="mt-4 flex flex-wrap gap-2">
                    {data.users.map((user) => (
                      <Badge key={user.id} tone={user.role === "admin" ? "teal" : "slate"}>
                        {user.name} / {userRoleLabel[user.role]}
                      </Badge>
                    ))}
                  </div>
                </div>
              </div>
            )}
            {memberActionError ? <p className="text-sm text-rose-700">{memberActionError}</p> : null}
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
              (() => {
                const progress = deriveRoundProgressSummary({
                  matches: round.matches,
                  picks: round.picks,
                  resultedCount: round.resultedCount,
                  roundId: round.id,
                  scoutReports: round.scoutReports,
                  users: data.users,
                });

                return (
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
                      <StatCard
                        label="試合設定"
                        value={progressValue(progress.configuredMatches, round.matchCount)}
                        compact
                      />
                      <StatCard
                        label="支持 / 予想"
                        value={progressValue(round.pickCount, progress.expectedPickEntries)}
                        compact
                      />
                      <StatCard
                        label="予想者カード"
                        value={progressValue(round.scoutReports.length, progress.expectedScoutEntries)}
                        compact
                      />
                      <StatCard
                        label="結果入力"
                        value={progressValue(round.resultedCount, round.matchCount)}
                        compact
                      />
                    </div>

                    <div className="grid gap-4 xl:grid-cols-[1fr_0.95fr]">
                      <div className="rounded-3xl border border-white/60 bg-white/80 p-4">
                        <div className="flex items-center justify-between gap-3">
                          <h3 className="text-sm font-semibold text-slate-900">
                            AI差分が大きい試合トップ3
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

                      <div className="rounded-3xl border border-slate-200 bg-slate-50/92 p-4">
                        <div className="flex items-center gap-2">
                          <Badge tone={progress.nextStep.tone}>次にやること</Badge>
                          <h3 className="text-sm font-semibold text-slate-900">
                            {progress.nextStep.label}
                          </h3>
                        </div>
                        <p className="mt-3 text-sm leading-6 text-slate-600">
                          {progress.nextStep.description}
                        </p>
                        <div className="mt-4 flex flex-wrap gap-2">
                          <Link href={progress.nextStep.href} className={buttonClassName}>
                            {progress.nextStep.label}
                          </Link>
                          <Link
                            href={buildRoundHref(appRoute.workspace, round.id)}
                            className={secondaryButtonClassName}
                          >
                            ラウンドを開く
                          </Link>
                        </div>
                        <div className="mt-4 flex flex-wrap gap-2 text-xs text-slate-500">
                          <span>設定 {formatPercent(progress.setupCompletion)}</span>
                          <span>予想 {formatPercent(progress.pickCompletion)}</span>
                          <span>根拠 {formatPercent(progress.scoutCompletion)}</span>
                          <span>結果 {formatPercent(progress.resultCompletion)}</span>
                        </div>
                      </div>
                    </div>
                  </SectionCard>
                );
              })()
            ))}
          </section>
        </>
      ) : null}
    </div>
  );
}
