"use client";

import Link from "next/link";
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
  cx,
  fieldClassName,
  PageHeader,
  SectionCard,
  secondaryButtonClassName,
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

type ReasonChip = {
  count: number;
  label: string;
};

type ModeGuide = {
  emphasis: string;
  fit: string;
  summary: string;
  tone: "amber" | "sky" | "teal";
  caution: string;
};

const modeGuide: Record<TicketMode, ModeGuide> = {
  conservative: {
    summary: "Model本命を大きく崩さず、外しにくい軸を優先します。",
    fit: "まず1枚目を作るとき、寄せすぎたくないとき。",
    emphasis: "AI本命と的中見込み",
    caution: "高配当の跳ねはやや取りにくめです。",
    tone: "teal",
  },
  balanced: {
    summary: "初見向け。AI基準を残しつつ、人力支援と高エッジも拾います。",
    fit: "最初の比較、迷ったときの基準作り。",
    emphasis: "AI・人力・エッジのバランス",
    caution: "本線よりは逆張りが少し増えます。",
    tone: "sky",
  },
  upset: {
    summary: "人気薄や逆張り候補を広めに拾い、荒れ筋を探しにいきます。",
    fit: "差分を作りたいとき、もう一段攻めたいとき。",
    emphasis: "逆張り度と高エッジ候補",
    caution: "的中見込みは下がりやすいです。",
    tone: "amber",
  },
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

function ticketLimitFromBudget(budgetYen: number) {
  return Math.min(Math.max(Math.floor(budgetYen / 100), 1), 8);
}

function summarizeTicketReasons(ticket: StoredTicket): ReasonChip[] {
  const counts = new Map<string, number>();

  for (const selection of ticket.selections) {
    const reasons =
      selection.reasons.length > 0
        ? selection.reasons
        : [selection.humanAligned ? "人力コンセンサス" : "AI本命寄り"];

    for (const reason of reasons) {
      counts.set(reason, (counts.get(reason) ?? 0) + 1);
    }
  }

  return Array.from(counts.entries())
    .map(([label, count]) => ({ label, count }))
    .sort((left, right) => right.count - left.count || left.label.localeCompare(right.label))
    .slice(0, 4);
}

function summarizeModeReasons(tickets: Array<{ parsed: StoredTicket }>): ReasonChip[] {
  const counts = new Map<string, number>();

  for (const ticket of tickets) {
    for (const reason of summarizeTicketReasons(ticket.parsed)) {
      counts.set(reason.label, (counts.get(reason.label) ?? 0) + reason.count);
    }
  }

  return Array.from(counts.entries())
    .map(([label, count]) => ({ label, count }))
    .sort((left, right) => right.count - left.count || left.label.localeCompare(right.label))
    .slice(0, 5);
}

function spotlightSelections(ticket: StoredTicket) {
  return [...ticket.selections]
    .sort(
      (left, right) =>
        right.reasons.length - left.reasons.length ||
        Math.max(right.edge, 0) - Math.max(left.edge, 0) ||
        right.modelProbability - left.modelProbability ||
        left.matchNo - right.matchNo,
    )
    .slice(0, 4);
}

function selectionReasonText(ticket: StoredTicket["selections"][number]) {
  if (ticket.reasons.length > 0) {
    return ticket.reasons.join(" / ");
  }

  return ticket.humanAligned ? "人力コンセンサス寄り" : "AI本命寄り";
}

function selectionReasonTone(ticket: StoredTicket["selections"][number]) {
  if (ticket.reasons.includes("高エッジ")) {
    return "teal" as const;
  }

  if (ticket.reasons.includes("人気薄の分析候補")) {
    return "amber" as const;
  }

  if (ticket.reasons.includes("引き分け警戒") || ticket.outcome === "0") {
    return "sky" as const;
  }

  return ticket.humanAligned ? ("rose" as const) : ("slate" as const);
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

  const effectiveSettings: GeneratorSettings = {
    budgetYen: lastSettings?.budgetYen ?? data?.round.budgetYen ?? 2000,
    humanWeight: lastSettings?.humanWeight ?? 0.65,
    maxContrarianMatches: lastSettings?.maxContrarianMatches ?? 3,
    includeDrawPolicy: lastSettings?.includeDrawPolicy ?? "medium",
  };

  const selectedModeTickets = ticketsByMode[selectedMode];
  const selectedHero = selectedModeTickets[0] ?? null;
  const selectedModeReasons = summarizeModeReasons(selectedModeTickets);
  const selectedHeroReasons = selectedHero ? summarizeTicketReasons(selectedHero.parsed) : [];
  const recommendedStartMode: TicketMode = "balanced";

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
      const maxTickets = ticketLimitFromBudget(settings.budgetYen);

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
            title="最初に見るポイント"
            description="初見なら、まずはバランスで生成してから上位候補の理由を見る流れで十分です。"
          >
            <div className="grid gap-4 xl:grid-cols-[1.15fr_0.85fr]">
              <div className="rounded-[28px] border border-emerald-200 bg-[linear-gradient(145deg,rgba(236,253,245,0.94),rgba(239,246,255,0.92))] p-5 shadow-[0_24px_60px_-40px_rgba(15,23,42,0.45)]">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge tone="teal">おすすめ開始点</Badge>
                  <Badge tone="sky">{ticketModeLabel[recommendedStartMode]}</Badge>
                </div>
                <h3 className="mt-3 font-display text-[1.45rem] font-semibold tracking-[-0.05em] text-slate-950">
                  先に要点を掴むなら「{ticketModeLabel[recommendedStartMode]}」から
                </h3>
                <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-700">
                  {modeGuide[recommendedStartMode].summary}
                  候補一覧では「理由タグ」と「理由が出ている試合」を見れば、
                  そのチケットがなぜ上位に来たかをすぐ追えます。
                </p>

                <div className="mt-4 grid gap-3 sm:grid-cols-3">
                  <div className="rounded-[22px] border border-white/75 bg-white/80 p-4">
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                      Step 1
                    </p>
                    <p className="mt-2 text-sm font-medium text-slate-900">
                      予算 {formatCurrency(effectiveSettings.budgetYen)} なら上位{" "}
                      {ticketLimitFromBudget(effectiveSettings.budgetYen)} 枚を確認
                    </p>
                  </div>
                  <div className="rounded-[22px] border border-white/75 bg-white/80 p-4">
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                      Step 2
                    </p>
                    <p className="mt-2 text-sm font-medium text-slate-900">
                      まずは評価・的中見込み・逆張り度の3つだけ比較
                    </p>
                  </div>
                  <div className="rounded-[22px] border border-white/75 bg-white/80 p-4">
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                      Step 3
                    </p>
                    <p className="mt-2 text-sm font-medium text-slate-900">
                      気になる候補だけ理由タグと注目試合を読む
                    </p>
                  </div>
                </div>
              </div>

              <div className="rounded-[28px] border border-slate-200 bg-slate-50/90 p-5">
                <div className="flex items-center gap-2">
                  <Badge tone={modeGuide[selectedMode].tone}>現在表示中</Badge>
                  <h3 className="font-display text-lg font-semibold tracking-[-0.05em] text-slate-950">
                    {ticketModeLabel[selectedMode]}モード
                  </h3>
                </div>
                <dl className="mt-4 grid gap-3 sm:grid-cols-2">
                  <div className="rounded-2xl border border-white/70 bg-white/90 p-3">
                    <dt className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                      予算
                    </dt>
                    <dd className="mt-1 text-sm font-medium text-slate-900">
                      {formatCurrency(effectiveSettings.budgetYen)}
                    </dd>
                  </div>
                  <div className="rounded-2xl border border-white/70 bg-white/90 p-3">
                    <dt className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                      候補上限
                    </dt>
                    <dd className="mt-1 text-sm font-medium text-slate-900">
                      {ticketLimitFromBudget(effectiveSettings.budgetYen)} 枚 / モード
                    </dd>
                  </div>
                  <div className="rounded-2xl border border-white/70 bg-white/90 p-3">
                    <dt className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                      人力比重
                    </dt>
                    <dd className="mt-1 text-sm font-medium text-slate-900">
                      {formatNumber(effectiveSettings.humanWeight, 2)}
                    </dd>
                  </div>
                  <div className="rounded-2xl border border-white/70 bg-white/90 p-3">
                    <dt className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                      引き分け方針
                    </dt>
                    <dd className="mt-1 text-sm font-medium text-slate-900">
                      {drawPolicyLabel[effectiveSettings.includeDrawPolicy]}
                    </dd>
                  </div>
                </dl>
                <p className="mt-4 text-sm leading-6 text-slate-600">
                  {modeGuide[selectedMode].fit} 重視するのは
                  「{modeGuide[selectedMode].emphasis}」で、注意点は
                  「{modeGuide[selectedMode].caution}」です。
                </p>
              </div>
            </div>
          </SectionCard>

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
                  defaultValue={effectiveSettings.budgetYen}
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
                  defaultValue={effectiveSettings.humanWeight}
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
                  defaultValue={effectiveSettings.maxContrarianMatches}
                  className={fieldClassName}
                />
              </label>

              <label className="grid gap-2 text-sm font-medium text-slate-700">
                引き分け方針
                <select
                  name="includeDrawPolicy"
                  defaultValue={effectiveSettings.includeDrawPolicy}
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

          <SectionCard
            title="モードの違い"
            description="まずはバランス、その後に本線と荒れ狙いを見比べると差が掴みやすいです。"
          >
            <div className="grid gap-4 lg:grid-cols-3">
              {ticketModeOptions.map((mode) => {
                const hero = ticketsByMode[mode][0];
                const guide = modeGuide[mode];
                const reasonSummary = hero ? summarizeTicketReasons(hero.parsed).slice(0, 3) : [];

                return (
                  <article
                    key={mode}
                    className={cx(
                      "rounded-[26px] border bg-white/88 p-5 shadow-[0_24px_60px_-42px_rgba(15,23,42,0.4)]",
                      mode === selectedMode
                        ? "border-emerald-300 ring-2 ring-emerald-200/80"
                        : "border-slate-200",
                    )}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge tone={guide.tone}>
                            {mode === selectedMode ? "表示中" : "比較用"}
                          </Badge>
                          <h3 className="font-display text-[1.35rem] font-semibold tracking-[-0.05em] text-slate-950">
                            {ticketModeLabel[mode]}
                          </h3>
                        </div>
                        <p className="mt-2 text-sm leading-6 text-slate-600">{guide.summary}</p>
                      </div>

                      <Link
                        href={buildRoundHref(appRoute.ticketGenerator, data.round.id, { mode })}
                        className={secondaryButtonClassName}
                      >
                        このモードを見る
                      </Link>
                    </div>

                    <div className="mt-4 grid gap-3 text-sm text-slate-700">
                      <div className="rounded-2xl bg-slate-950/5 px-4 py-3">
                        <span className="font-semibold text-slate-900">向く場面:</span> {guide.fit}
                      </div>
                      <div className="rounded-2xl bg-slate-950/5 px-4 py-3">
                        <span className="font-semibold text-slate-900">重視:</span>{" "}
                        {guide.emphasis}
                      </div>
                      <div className="rounded-2xl bg-slate-950/5 px-4 py-3">
                        <span className="font-semibold text-slate-900">注意:</span>{" "}
                        {guide.caution}
                      </div>
                    </div>

                    {hero ? (
                      <div className="mt-4 space-y-3 border-t border-slate-200 pt-4">
                        <div className="flex flex-wrap gap-2">
                          <Badge tone="teal">評価 {formatNumber(hero.ticketScore, 2)}</Badge>
                          <Badge tone="amber">
                            的中見込み {formatPercent(hero.estimatedHitProb, 1)}
                          </Badge>
                          <Badge tone="rose">
                            逆張り度 {formatNumber(hero.contrarianScore, 2)}
                          </Badge>
                        </div>
                        <p className="text-sm leading-6 text-slate-600">{hero.parsed.comment}</p>
                        <div className="flex flex-wrap gap-2">
                          {reasonSummary.map((reason) => (
                            <Badge key={`${mode}-${reason.label}`} tone={guide.tone}>
                              {reason.label} x{reason.count}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    ) : (
                      <p className="mt-4 border-t border-slate-200 pt-4 text-sm text-slate-500">
                        設定を入力すると、このモードの上位候補がここに出ます。
                      </p>
                    )}
                  </article>
                );
              })}
            </div>
          </SectionCard>

          <SectionCard
            title={`${ticketModeLabel[selectedMode]}モードの候補一覧`}
            description={`予算 ${formatCurrency(effectiveSettings.budgetYen)} を基準に上位候補を表示しています。`}
          >
            <div className="space-y-4">
              {ticketsByMode[selectedMode].length === 0 ? (
                <p className="text-sm text-slate-500">まだチケットが生成されていません。</p>
              ) : (
                <>
                  <div className="grid gap-4 xl:grid-cols-[0.95fr_1.05fr]">
                    <div className="rounded-[24px] border border-slate-200 bg-slate-50/90 p-4">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge tone={modeGuide[selectedMode].tone}>要点</Badge>
                        <h3 className="font-display text-lg font-semibold tracking-[-0.05em] text-slate-950">
                          このモードは何を重視しているか
                        </h3>
                      </div>
                      <p className="mt-3 text-sm leading-6 text-slate-700">
                        {modeGuide[selectedMode].summary}
                        {selectedHero ? ` 上位候補の先頭コメントは「${selectedHero.parsed.comment}」です。` : ""}
                      </p>
                      {selectedHeroReasons.length > 0 ? (
                        <div className="mt-4 flex flex-wrap gap-2">
                          {selectedHeroReasons.map((reason) => (
                            <Badge key={`hero-${reason.label}`} tone={modeGuide[selectedMode].tone}>
                              {reason.label} x{reason.count}
                            </Badge>
                          ))}
                        </div>
                      ) : null}
                    </div>

                    <div className="rounded-[24px] border border-slate-200 bg-slate-50/90 p-4">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge tone="sky">理由タグ</Badge>
                        <h3 className="font-display text-lg font-semibold tracking-[-0.05em] text-slate-950">
                          上位候補でよく出ている理由
                        </h3>
                      </div>
                      <div className="mt-4 flex flex-wrap gap-2">
                        {selectedModeReasons.map((reason) => (
                          <Badge key={`mode-${reason.label}`} tone="sky">
                            {reason.label} x{reason.count}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  </div>

                  {ticketsByMode[selectedMode].map((ticket, index) => {
                    const reasonSummary = summarizeTicketReasons(ticket.parsed);
                    const keySelections = spotlightSelections(ticket.parsed);

                    return (
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

                        <p className="mt-3 text-sm leading-6 text-slate-600">{ticket.parsed.comment}</p>

                        <div className="mt-4 flex flex-wrap gap-2">
                          {reasonSummary.map((reason) => (
                            <Badge key={`${ticket.id}-${reason.label}`} tone={modeGuide[selectedMode].tone}>
                              {reason.label} x{reason.count}
                            </Badge>
                          ))}
                        </div>

                        <div className="mt-4 grid gap-3 lg:grid-cols-2 xl:grid-cols-4">
                          {keySelections.map((selection) => (
                            <div
                              key={`${ticket.id}-${selection.matchNo}`}
                              className="rounded-[22px] border border-white/80 bg-white px-4 py-3 shadow-sm"
                            >
                              <div className="flex items-center justify-between gap-2">
                                <span className="text-sm font-semibold text-slate-900">
                                  #{selection.matchNo} {selection.outcome}
                                </span>
                                <Badge tone={selectionReasonTone(selection)}>注目理由</Badge>
                              </div>
                              <p className="mt-2 text-sm font-medium text-slate-800">
                                {selection.fixture}
                              </p>
                              <p className="mt-2 text-xs leading-5 text-slate-600">
                                {selectionReasonText(selection)}
                              </p>
                              <div className="mt-3 text-xs leading-5 text-slate-500">
                                model {formatPercent(selection.modelProbability, 1)} / official{" "}
                                {formatPercent(selection.officialVoteShare, 1)} / edge{" "}
                                {formatPercent(selection.edge, 1)}
                              </div>
                            </div>
                          ))}
                        </div>

                        <div className="mt-4 flex flex-wrap gap-2">
                          {ticket.parsed.selections.map((selection) => (
                            <div
                              key={`${ticket.id}-all-${selection.matchNo}`}
                              className="rounded-2xl bg-white px-3 py-2 text-sm text-slate-700 shadow-sm"
                            >
                              #{selection.matchNo} {selection.outcome}
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </>
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
