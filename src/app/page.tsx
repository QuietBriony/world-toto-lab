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
import { createRound, createSampleUsers } from "@/lib/repository";
import { isSupabaseConfigured } from "@/lib/supabase";
import { useDashboardData } from "@/lib/use-app-data";

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Unknown error";
}

export default function DashboardPage() {
  const router = useRouter();
  const { data, error, loading, refresh } = useDashboardData();
  const [busy, setBusy] = useState<"members" | "round" | null>(null);
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
        title: stringValue(formData, "title") || "New Round",
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

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="World Toto Lab"
        title="W杯totoの予想・分析・記録ダッシュボード"
        description="GitHub Pages で配信する静的フロントエンドから、Supabase に予想・入力・集計データを保存する MVP です。"
        actions={
          <div className="flex flex-wrap gap-3">
            <a href="#create-round" className={buttonClassName}>
              Roundを作成
            </a>
            <a href="#round-list" className={secondaryButtonClassName}>
              Round一覧へ
            </a>
          </div>
        }
      />

      {!isSupabaseConfigured() ? (
        <ConfigurationNotice />
      ) : loading && !data ? (
        <LoadingNotice title="Dashboard を読み込み中" />
      ) : error && !data ? (
        <ErrorNotice error={error} onRetry={() => void refresh()} />
      ) : data ? (
        <>
          <section className="grid gap-4 md:grid-cols-4">
            <StatCard
              label="Round数"
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
              hint="actualResult が入っている試合数"
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
                  {busy === "members" ? "Creating..." : "サンプル10人を作成"}
                </button>
              ) : null
            }
          >
            {data.users.length === 0 ? (
              <p className="text-sm text-slate-600">
                Human Picks / Scout Card を使う前に、まず共有メンバーを作成してください。
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
            {actionError ? <p className="text-sm text-rose-700">{actionError}</p> : null}
          </SectionCard>

          <SectionCard
            id="create-round"
            title="Roundを作成"
            description="Round 作成時に 13 試合ぶんのプレースホルダーも自動で作成します。"
          >
            <form onSubmit={handleCreateRound} className="grid gap-5 md:grid-cols-2">
              <label className="grid gap-2 text-sm font-medium text-slate-700">
                Title
                <input
                  name="title"
                  className={fieldClassName}
                  placeholder="World Cup Sample Round"
                />
              </label>

              <label className="grid gap-2 text-sm font-medium text-slate-700">
                Status
                <select name="status" className={fieldClassName} defaultValue="draft">
                  {roundStatusOptions.map((status) => (
                    <option key={status} value={status}>
                      {status}
                    </option>
                  ))}
                </select>
              </label>

              <label className="grid gap-2 text-sm font-medium text-slate-700">
                Budget (JPY)
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
                金銭、配当、代理購入、精算は扱いません。ここでの予算は Ticket
                Generator の候補数目安にだけ使います。
              </div>

              <label className="grid gap-2 text-sm font-medium text-slate-700 md:col-span-2">
                Notes
                <textarea
                  name="notes"
                  className={textAreaClassName}
                  placeholder="この Round で気にしたいテーマ、友人会の着眼点など"
                />
              </label>

              <div className="md:col-span-2 flex justify-end">
                <button
                  type="submit"
                  className={buttonClassName}
                  disabled={busy === "round"}
                >
                  {busy === "round" ? "Creating..." : "Create Round"}
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
                description={round.notes ?? "Roundメモはまだありません。"}
                actions={
                  <div className="flex items-center gap-2">
                    <Badge tone="sky">{roundStatusLabel[round.status]}</Badge>
                    <Link
                      href={buildRoundHref(appRoute.workspace, round.id)}
                      className={secondaryButtonClassName}
                    >
                      Round Detail
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
