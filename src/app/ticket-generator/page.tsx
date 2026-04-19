"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState, type FormEvent } from "react";

import {
  ConfigurationNotice,
  ErrorNotice,
  LoadingNotice,
  RoundRequiredNotice,
} from "@/components/app/states";
import { RoundNav } from "@/components/round-nav";
import {
  Badge,
  buttonClassName,
  fieldClassName,
  PageHeader,
  SectionCard,
} from "@/components/ui";
import {
  drawPolicyLabel,
  formatCurrency,
  formatNumber,
  formatPercent,
  roundStatusLabel,
  ticketModeLabel,
  ticketModeOptions,
} from "@/lib/domain";
import {
  parseFloatOrNull,
  parseIntOrNull,
  parseTicketMode,
  stringValue,
} from "@/lib/forms";
import { appRoute, buildRoundHref, getSingleSearchParam } from "@/lib/round-links";
import { replaceGeneratedTickets } from "@/lib/repository";
import { isSupabaseConfigured } from "@/lib/supabase";
import { generateAllModeTickets, type GeneratorSettings, type TicketPayload } from "@/lib/tickets";
import type { TicketMode } from "@/lib/types";
import { useRoundWorkspace } from "@/lib/use-app-data";

type StoredTicket = TicketPayload & {
  settings?: GeneratorSettings;
};

function parseStoredTicket(raw: string): StoredTicket | null {
  try {
    return JSON.parse(raw) as StoredTicket;
  } catch {
    return null;
  }
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : "不明なエラーです。";
}

function TicketGeneratorPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const roundId = getSingleSearchParam(searchParams.get("round"));
  const selectedMode = parseTicketMode(
    getSingleSearchParam(searchParams.get("mode")) ?? "balanced",
  );
  const { data, error, loading, refresh } = useRoundWorkspace(roundId);
  const [saving, setSaving] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const parsedTickets = (data?.round.generatedTickets ?? [])
    .map((ticket) => ({
      ...ticket,
      parsed: parseStoredTicket(ticket.ticketJson),
    }))
    .filter((ticket): ticket is typeof ticket & { parsed: StoredTicket } => ticket.parsed !== null);

  const ticketsByMode: Record<TicketMode, typeof parsedTickets> = {
    conservative: parsedTickets.filter((ticket) => ticket.mode === "conservative"),
    balanced: parsedTickets.filter((ticket) => ticket.mode === "balanced"),
    upset: parsedTickets.filter((ticket) => ticket.mode === "upset"),
  };

  const lastSettings = parsedTickets[0]?.parsed.settings;

  const handleGenerate = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!data) {
      return;
    }

    setSaving(true);
    setSubmitError(null);

    try {
      const formData = new FormData(event.currentTarget);
      const settings: GeneratorSettings = {
        budgetYen: parseIntOrNull(stringValue(formData, "budgetYen")) ?? 1000,
        humanWeight: Math.min(
          Math.max(parseFloatOrNull(stringValue(formData, "humanWeight")) ?? 0.6, 0),
          1,
        ),
        maxContrarianMatches: Math.min(
          Math.max(parseIntOrNull(stringValue(formData, "maxContrarianMatches")) ?? 3, 0),
          13,
        ),
        includeDrawPolicy:
          stringValue(formData, "includeDrawPolicy") === "low" ||
          stringValue(formData, "includeDrawPolicy") === "high"
            ? (stringValue(formData, "includeDrawPolicy") as GeneratorSettings["includeDrawPolicy"])
            : "medium",
      };
      const focusMode = parseTicketMode(stringValue(formData, "mode"));
      const allTickets = generateAllModeTickets(data.round.matches, settings);
      const maxTickets = Math.min(Math.max(Math.floor(settings.budgetYen / 100), 1), 8);

      await replaceGeneratedTickets({
        roundId: data.round.id,
        budgetYen: settings.budgetYen,
        tickets: ticketModeOptions.flatMap((mode) =>
          allTickets[mode].slice(0, maxTickets).map((ticket) => ({
            mode,
            ticketJson: JSON.stringify({
              ...ticket,
              settings,
            }),
            ticketScore: ticket.ticketScore,
            estimatedHitProb: ticket.estimatedHitProb,
            contrarianScore: ticket.contrarianScore,
          })),
        ),
      });

      await refresh();
      router.replace(buildRoundHref(appRoute.ticketGenerator, data.round.id, { mode: focusMode }));
    } catch (nextError) {
      setSubmitError(errorMessage(nextError));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="候補チケット"
        title="買い目候補ジェネレーター"
        description="スコアは厳密な確率最適化ではなく、買い目候補の並び替え用です。金銭管理や配当分配は扱いません。"
      />

      {!isSupabaseConfigured() ? (
        <ConfigurationNotice />
      ) : !roundId ? (
        <RoundRequiredNotice />
      ) : loading && !data ? (
        <LoadingNotice title="候補チケットを読み込み中" />
      ) : error && !data ? (
        <ErrorNotice error={error} onRetry={() => void refresh()} />
      ) : data ? (
        <>
          <RoundNav
            roundId={data.round.id}
            roundTitle={data.round.title}
            roundStatus={roundStatusLabel[data.round.status]}
            currentPath={appRoute.ticketGenerator}
          />

          <SectionCard
            title="生成設定"
            description="予算から候補枚数を 100 円単位で計算します。"
          >
            <form onSubmit={handleGenerate} className="grid gap-5 md:grid-cols-2 lg:grid-cols-5">
              <label className="grid gap-2 text-sm font-medium text-slate-700">
                予算
                <input
                  name="budgetYen"
                  type="number"
                  min={100}
                  step={100}
                  defaultValue={lastSettings?.budgetYen ?? data.round.budgetYen ?? 2000}
                  className={fieldClassName}
                />
              </label>

              <label className="grid gap-2 text-sm font-medium text-slate-700">
                モード
                <select name="mode" defaultValue={selectedMode} className={fieldClassName}>
                  {ticketModeOptions.map((mode) => (
                    <option key={mode} value={mode}>
                      {ticketModeLabel[mode]}
                    </option>
                  ))}
                </select>
              </label>

              <label className="grid gap-2 text-sm font-medium text-slate-700">
                人力比重
                <input
                  name="humanWeight"
                  type="number"
                  min={0}
                  max={1}
                  step={0.05}
                  defaultValue={lastSettings?.humanWeight ?? 0.65}
                  className={fieldClassName}
                />
              </label>

              <label className="grid gap-2 text-sm font-medium text-slate-700">
                逆張り上限試合数
                <input
                  name="maxContrarianMatches"
                  type="number"
                  min={0}
                  max={13}
                  step={1}
                  defaultValue={lastSettings?.maxContrarianMatches ?? 3}
                  className={fieldClassName}
                />
              </label>

              <label className="grid gap-2 text-sm font-medium text-slate-700">
                引き分け方針
                <select
                  name="includeDrawPolicy"
                  defaultValue={lastSettings?.includeDrawPolicy ?? "medium"}
                  className={fieldClassName}
                >
                  <option value="low">{drawPolicyLabel.low}</option>
                  <option value="medium">{drawPolicyLabel.medium}</option>
                  <option value="high">{drawPolicyLabel.high}</option>
                </select>
              </label>

              <div className="md:col-span-2 lg:col-span-5 flex justify-end">
                <button type="submit" className={buttonClassName} disabled={saving}>
                  {saving ? "生成中..." : "候補を生成"}
                </button>
              </div>
            </form>
            {submitError ? <p className="text-sm text-rose-700">{submitError}</p> : null}
          </SectionCard>

          <section className="grid gap-4 lg:grid-cols-3">
            {ticketModeOptions.map((mode) => {
              const hero = ticketsByMode[mode][0];
              return (
                <SectionCard
                  key={mode}
                  title={`${ticketModeLabel[mode]}チケット`}
                  description={hero?.parsed.comment ?? "まだ生成されていません。"}
                >
                  {hero ? (
                    <div className="space-y-3">
                      <div className="flex flex-wrap gap-2">
                        <Badge tone="teal">評価 {formatNumber(hero.ticketScore, 2)}</Badge>
                        <Badge tone="amber">
                          的中見込み {formatPercent(hero.estimatedHitProb, 1)}
                        </Badge>
                        <Badge tone="rose">
                          逆張り度 {formatNumber(hero.contrarianScore, 2)}
                        </Badge>
                      </div>
                      <div className="space-y-2 text-sm text-slate-700">
                        {hero.parsed.selections.slice(0, 5).map((selection) => (
                          <div
                            key={`${mode}-${selection.matchNo}`}
                            className="rounded-2xl bg-slate-950/5 px-3 py-2"
                          >
                            #{selection.matchNo} {selection.outcome} / {selection.fixture}
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <p className="text-sm text-slate-500">
                      設定を入力するとここに候補が表示されます。
                    </p>
                  )}
                </SectionCard>
              );
            })}
          </section>

          <SectionCard
            title={`${ticketModeLabel[selectedMode]}モードの候補一覧`}
            description={`予算 ${formatCurrency(lastSettings?.budgetYen ?? data.round.budgetYen ?? 0)} を基準に上位候補を表示しています。`}
          >
            <div className="space-y-4">
              {ticketsByMode[selectedMode].length === 0 ? (
                <p className="text-sm text-slate-500">まだチケットが生成されていません。</p>
              ) : (
                ticketsByMode[selectedMode].map((ticket, index) => (
                  <div
                    key={ticket.id}
                    className="rounded-[26px] border border-slate-200 bg-slate-50/90 p-4"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div className="flex items-center gap-2">
                        <Badge tone="sky">#{index + 1}</Badge>
                        <span className="text-lg font-semibold text-slate-900">
                          評価 {formatNumber(ticket.ticketScore, 2)}
                        </span>
                      </div>
                      <div className="flex flex-wrap gap-2 text-sm">
                        <Badge tone="amber">
                          的中見込み {formatPercent(ticket.estimatedHitProb, 1)}
                        </Badge>
                        <Badge tone="rose">
                          逆張り度 {formatNumber(ticket.contrarianScore, 2)}
                        </Badge>
                      </div>
                    </div>

                    <p className="mt-3 text-sm text-slate-600">{ticket.parsed.comment}</p>

                    <div className="mt-4 flex flex-wrap gap-2">
                      {ticket.parsed.selections.map((selection) => (
                        <div
                          key={`${ticket.id}-${selection.matchNo}`}
                          className="rounded-2xl bg-white px-3 py-2 text-sm text-slate-700 shadow-sm"
                        >
                          #{selection.matchNo} {selection.outcome}
                        </div>
                      ))}
                    </div>
                  </div>
                ))
              )}
            </div>
          </SectionCard>
        </>
      ) : null}
    </div>
  );
}

export default function TicketGeneratorPage() {
  return (
    <Suspense fallback={<LoadingNotice title="候補チケットを準備中" />}>
      <TicketGeneratorPageContent />
    </Suspense>
  );
}
