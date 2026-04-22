"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState, type FormEvent } from "react";

import {
  RouteGlossaryCard,
  RoundProgressCallout,
} from "@/components/app/round-guides";
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
  CollapsibleSectionCard,
  cx,
  fieldClassName,
  PageHeader,
  SectionCard,
  secondaryButtonClassName,
} from "@/components/ui";
import {
  buildAdvantageRows,
  drawPolicyLabel,
  formatCurrency,
  formatNumber,
  formatPercent,
  formatSignedPercent,
  productTypeLabel,
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
import {
  budgetFromCandidateLimit,
  candidateLimitCapForMatchCount,
  defaultCandidateLimit,
  defaultMaxContrarianMatches,
  generateAllModeTickets,
  resolveCandidateLimit,
  type GeneratorSettings,
  type TicketPayload,
} from "@/lib/tickets";
import type { RoundWorkspace, TicketMode } from "@/lib/types";
import { useRoundWorkspace } from "@/lib/use-app-data";
import { resolveWorldTotoProductLabel } from "@/lib/world-toto";

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
    summary: "コア候補と低リスク寄りを優先して、最初に見る順番を固めます。",
    fit: "まず土台を作りたいとき、荒れ筋を混ぜすぎたくないとき。",
    emphasis: "コア候補と合成確からしさ",
    caution: "ダークホースは少なめになります。",
    tone: "teal",
  },
  balanced: {
    summary: "AI・予想者・ダークホースをほどよく混ぜて、比較の基準を作ります。",
    fit: "初見の比較、全体像を掴む最初の配分案。",
    emphasis: "コア候補と注目配分のバランス",
    caution: "本線だけに絞るよりはブレ幅が少し増えます。",
    tone: "sky",
  },
  upset: {
    summary: "人気読み替えやダークホースを広めに拾い、別筋の候補を見つけにいきます。",
    fit: "差を作りたいとき、穴候補を多めに見たいとき。",
    emphasis: "ダークホース度と人気読み替え",
    caution: "平均リスクは上がりやすいです。",
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

function resolveRoundMatchCount(round: RoundWorkspace["round"] | null | undefined) {
  if (!round) {
    return null;
  }

  const candidates = [
    round.matches.length,
    round.activeMatchCount,
    round.requiredMatchCount,
  ].filter(
    (value): value is number =>
      typeof value === "number" && Number.isFinite(value) && value > 0,
  );

  return candidates[0] ?? null;
}

function summarizeTicketReasons(ticket: StoredTicket): ReasonChip[] {
  const counts = new Map<string, number>();

  for (const selection of ticket.selections) {
    const reasons = selection.reasons.length > 0 ? selection.reasons : ["AI本線"];

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
        right.attentionShare - left.attentionShare ||
        right.reasons.length - left.reasons.length ||
        right.darkHorseScore - left.darkHorseScore ||
        right.compositeAdvantage - left.compositeAdvantage ||
        left.matchNo - right.matchNo,
    )
    .slice(0, 4);
}

function selectionReasonText(selection: StoredTicket["selections"][number]) {
  if (selection.reasons.length > 0) {
    return selection.reasons.join(" / ");
  }

  return selection.humanAligned ? "予想者と重なる候補" : "AI本線寄り";
}

function selectionReasonTone(selection: StoredTicket["selections"][number]) {
  if (selection.reasons.includes("ダークホース")) {
    return "amber" as const;
  }

  if (selection.reasons.includes("0警戒")) {
    return "sky" as const;
  }

  if (selection.reasons.includes("予想者優位")) {
    return "rose" as const;
  }

  if (selection.reasons.includes("コア候補") || selection.reasons.includes("合成優位")) {
    return "teal" as const;
  }

  return selection.humanAligned ? ("sky" as const) : ("slate" as const);
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
  const roundMatchCount = resolveRoundMatchCount(data?.round);
  const roundProductLabel = data
    ? resolveWorldTotoProductLabel(
        {
          matchCount: data.round.matches.length,
          matches: data.round.matches,
          notes: data.round.notes,
          productType: data.round.productType,
          sourceNote: data.round.sourceNote,
          title: data.round.title,
        },
        productTypeLabel[data.round.productType],
      )
    : null;
  const candidateLimitCap = candidateLimitCapForMatchCount(roundMatchCount);
  const fallbackCandidateLimit = defaultCandidateLimit(roundMatchCount);
  const fallbackBudgetYen = budgetFromCandidateLimit(
    fallbackCandidateLimit,
    roundMatchCount,
  );
  const storedBudgetYen =
    lastSettings?.budgetYen ?? data?.round.budgetYen ?? fallbackBudgetYen;
  const effectiveCandidateLimit = resolveCandidateLimit(
    {
      budgetYen: storedBudgetYen,
      candidateLimit: lastSettings?.candidateLimit,
    },
    roundMatchCount,
  );
  const compatibilityBudgetYen = budgetFromCandidateLimit(
    effectiveCandidateLimit,
    roundMatchCount,
  );
  const maxContrarianMatchesCap = Math.max(roundMatchCount ?? 1, 1);

  const effectiveSettings: GeneratorSettings = {
    budgetYen: compatibilityBudgetYen,
    candidateLimit: effectiveCandidateLimit,
    humanWeight: lastSettings?.humanWeight ?? 0.65,
    maxContrarianMatches: Math.min(
      Math.max(
        lastSettings?.maxContrarianMatches ??
          defaultMaxContrarianMatches(roundMatchCount),
        0,
      ),
      maxContrarianMatchesCap,
    ),
    includeDrawPolicy: lastSettings?.includeDrawPolicy ?? "medium",
  };

  const pushCandidates = data
    ? (() => {
        const seenMatchIds = new Set<string>();

        return buildAdvantageRows({
          matches: data.round.matches,
          picks: data.round.picks,
          users: data.users,
        })
          .filter(
            (row) =>
              row.include &&
              !seenMatchIds.has(row.matchId) &&
              (row.compositeAdvantage ?? 0) >= 0.12 &&
              row.riskScore <= 0.45 &&
              (row.aiProbability ?? row.modelProbability ?? 0) >= 0.38,
          )
          .filter((row) => {
            if (seenMatchIds.has(row.matchId)) {
              return false;
            }

            seenMatchIds.add(row.matchId);
            return true;
          })
          .slice(0, 3);
      })()
    : [];

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
      const candidateLimit = Math.min(
        Math.max(
          parseIntOrNull(stringValue(formData, "candidateLimit")) ??
            fallbackCandidateLimit,
          1,
        ),
        candidateLimitCap,
      );
      const settings: GeneratorSettings = {
        budgetYen: budgetFromCandidateLimit(candidateLimit, roundMatchCount),
        candidateLimit,
        humanWeight: Math.min(
          Math.max(parseFloatOrNull(stringValue(formData, "humanWeight")) ?? 0.6, 0),
          1,
        ),
        maxContrarianMatches: Math.min(
          Math.max(
            parseIntOrNull(stringValue(formData, "maxContrarianMatches")) ??
              defaultMaxContrarianMatches(roundMatchCount),
            0,
          ),
          maxContrarianMatchesCap,
        ),
        includeDrawPolicy:
          stringValue(formData, "includeDrawPolicy") === "low" ||
          stringValue(formData, "includeDrawPolicy") === "high"
            ? (stringValue(formData, "includeDrawPolicy") as GeneratorSettings["includeDrawPolicy"])
            : "medium",
      };
      const focusMode = parseTicketMode(stringValue(formData, "mode"));
      const allTickets = generateAllModeTickets(
        {
          matches: data.round.matches,
          picks: data.round.picks,
          users: data.users,
        },
        settings,
      );
      const maxTickets = resolveCandidateLimit(settings, roundMatchCount);

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
        eyebrow="詳細候補配分"
        title="注目配分ジェネレーター"
        description="候補カードより細かく、AI・予想者・ウォッチ支持の合成優位差から候補の並び順と理由を確認する管理寄り画面です。"
        actions={
          data ? (
            <div className="flex flex-wrap gap-3">
              <Link
                href={buildRoundHref(appRoute.pickRoom, data.round.id, { user: data.users[0]?.id })}
                className={secondaryButtonClassName}
              >
                候補カード
              </Link>
              <Link
                href={buildRoundHref(appRoute.workspace, data.round.id)}
                className={secondaryButtonClassName}
              >
                ラウンド詳細
              </Link>
            </div>
          ) : undefined
        }
      />

      {!isSupabaseConfigured() ? (
        <ConfigurationNotice />
      ) : !roundId ? (
        <RoundRequiredNotice />
      ) : loading && !data ? (
        <LoadingNotice title="候補配分を読み込み中" />
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

          <RoundProgressCallout
            currentPath={appRoute.ticketGenerator}
            matches={data.round.matches}
            picks={data.round.picks}
            roundId={data.round.id}
            scoutReports={data.round.scoutReports}
            users={data.users}
          />

          <RouteGlossaryCard
            currentPath={appRoute.ticketGenerator}
            defaultOpen={parsedTickets.length === 0}
          />

          <SectionCard
            title="最初に見るポイント"
            description="初見なら、まずはバランスで生成して、上位候補の注目配分と理由タグを見る流れで十分です。"
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
                  上位候補では「注目配分」と「理由タグ」を見るだけで、どこから読むべきかがすぐ分かります。
                </p>

                <div className="mt-4 grid gap-3 sm:grid-cols-3">
                  <div className="rounded-[22px] border border-white/75 bg-white/80 p-4">
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                      Step 1
                    </p>
                    <p className="mt-2 text-sm font-medium text-slate-900">
                      上位 {effectiveCandidateLimit} 案を比較する
                    </p>
                  </div>
                  <div className="rounded-[22px] border border-white/75 bg-white/80 p-4">
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                      Step 2
                    </p>
                    <p className="mt-2 text-sm font-medium text-slate-900">
                      配分スコア / 合成確からしさ / 平均リスクを比べる
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
                      上位候補数
                    </dt>
                    <dd className="mt-1 text-sm font-medium text-slate-900">
                      {effectiveCandidateLimit} 案
                    </dd>
                  </div>
                  <div className="rounded-2xl border border-white/70 bg-white/90 p-3">
                    <dt className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                      予想者比重
                    </dt>
                    <dd className="mt-1 text-sm font-medium text-slate-900">
                      {formatNumber(effectiveSettings.humanWeight, 2)}
                    </dd>
                  </div>
                  <div className="rounded-2xl border border-white/70 bg-white/90 p-3">
                    <dt className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                      穴候補上限
                    </dt>
                    <dd className="mt-1 text-sm font-medium text-slate-900">
                      {effectiveSettings.maxContrarianMatches} 試合
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
            {pushCandidates.length > 0 ? (
              <div className="mt-4 rounded-[28px] border border-amber-200 bg-[linear-gradient(145deg,rgba(255,247,237,0.96),rgba(254,249,195,0.9))] p-5 shadow-[0_24px_60px_-42px_rgba(120,53,15,0.22)]">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge tone="amber">全力プッシュ候補</Badge>
                  <h3 className="font-display text-lg font-semibold tracking-[-0.05em] text-slate-950">
                    優位差がかなり強い試合があります
                  </h3>
                </div>
                <p className="mt-3 text-sm leading-6 text-slate-700">
                  造船太郎の一撃みたいに、明らかに押し込みたい筋が出たときの目印です。
                  まずは `本線` か `バランス` を見ながら、この候補が入っている配分案を優先して確認できます。
                </p>
                <div className="mt-4 grid gap-3 lg:grid-cols-3">
                  {pushCandidates.map((candidate) => (
                    <div
                      key={`push-${candidate.matchId}-${candidate.outcome}`}
                      className="rounded-[22px] border border-white/70 bg-white/88 p-4"
                    >
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge tone="amber">#{candidate.matchNo}</Badge>
                        <Badge tone="teal">{candidate.outcome}</Badge>
                      </div>
                      <p className="mt-2 text-sm font-semibold text-slate-900">{candidate.fixture}</p>
                      <div className="mt-3 text-xs leading-5 text-slate-600">
                        合成優位 {formatSignedPercent(candidate.compositeAdvantage ?? 0, 1)} / AI{" "}
                        {formatPercent(candidate.aiProbability ?? candidate.modelProbability ?? 0, 1)} / リスク{" "}
                        {formatNumber(candidate.riskScore, 2)}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
          </SectionCard>

          <SectionCard
            title="生成設定"
            description={`${roundProductLabel ?? productTypeLabel[data.round.productType]} / ${roundMatchCount ?? data.round.matches.length} 試合に合わせて、上位何案まで並べるかと、どこまで穴候補を混ぜるかを調整します。`}
          >
            <div className="rounded-[24px] border border-slate-200 bg-slate-50/90 p-4">
              <div className="flex flex-wrap items-center gap-2">
                <Badge tone="slate">{roundProductLabel ?? productTypeLabel[data.round.productType]}</Badge>
                <Badge tone="sky">{roundMatchCount ?? data.round.matches.length} 試合</Badge>
                <Badge tone="teal">候補上限 {candidateLimitCap} 案</Badge>
              </div>
              <p className="mt-3 text-sm leading-6 text-slate-600">
                保存上の予算値は既存データ互換のための換算値です。生成結果の上位
                {effectiveCandidateLimit} 案を round の budget 欄に
                {formatCurrency(effectiveSettings.budgetYen)} として残しますが、ここで扱うのは実際の購入金額ではなく、
                <span className="font-mono text-[0.92em]">100円 = 1案</span>
                の互換メモです。
              </p>
            </div>
            <form onSubmit={handleGenerate} className="mt-5 grid gap-5 md:grid-cols-2 lg:grid-cols-5">
              <label className="grid gap-2 text-sm font-medium text-slate-700">
                <span className="flex items-center justify-between gap-3">
                  <span>上位候補数</span>
                  <span className="text-xs font-normal text-slate-500">
                    1 - {candidateLimitCap} 案
                  </span>
                </span>
                <input
                  name="candidateLimit"
                  type="number"
                  min={1}
                  max={candidateLimitCap}
                  step={1}
                  defaultValue={effectiveCandidateLimit}
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
                予想者比重
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
                穴候補上限
                <input
                  name="maxContrarianMatches"
                  type="number"
                  min={0}
                  max={maxContrarianMatchesCap}
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

              <div className="flex justify-end md:col-span-2 lg:col-span-5">
                <button type="submit" className={buttonClassName} disabled={saving}>
                  {saving ? "生成中..." : "配分案を更新"}
                </button>
              </div>
            </form>
            {submitError ? <p className="text-sm text-rose-700">{submitError}</p> : null}
          </SectionCard>

          <CollapsibleSectionCard
            title="モードの違い"
            description="まずはバランス、その後にコア重視と穴重視を見比べると差が掴みやすいです。"
            badge={<Badge tone="slate">比較</Badge>}
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
                        <span className="font-semibold text-slate-900">重視:</span> {guide.emphasis}
                      </div>
                      <div className="rounded-2xl bg-slate-950/5 px-4 py-3">
                        <span className="font-semibold text-slate-900">注意:</span> {guide.caution}
                      </div>
                    </div>

                    {hero ? (
                      <div className="mt-4 space-y-3 border-t border-slate-200 pt-4">
                        <div className="flex flex-wrap gap-2">
                          <Badge tone="teal">配分スコア {formatNumber(hero.ticketScore, 2)}</Badge>
                          <Badge tone="sky">
                            注目配分 {formatPercent(hero.parsed.attentionShare, 1)}
                          </Badge>
                          <Badge tone="amber">
                            合成確からしさ {formatPercent(hero.estimatedHitProb, 1)}
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
          </CollapsibleSectionCard>

          <SectionCard
            title={`${ticketModeLabel[selectedMode]}モードの配分案`}
            description={`上位 ${effectiveCandidateLimit} 案を比較して、どこから読むかの目安を表示しています。`}
          >
            <div className="space-y-4">
              {ticketsByMode[selectedMode].length === 0 ? (
                <div className="rounded-[24px] border border-amber-200 bg-amber-50/90 p-5">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge tone="amber">再生成待ち</Badge>
                    <h3 className="font-display text-lg font-semibold tracking-[-0.04em] text-slate-950">
                      まだ最新の配分案がありません
                    </h3>
                  </div>
                  <p className="mt-3 text-sm leading-6 text-slate-700">
                    試合情報、AI確率、支持 / 予想、予想者カード、参加メンバーが変わると、
                    古い候補配分は自動で外れます。最新の内容で見直すには、上の `配分案を更新` を押してください。
                  </p>
                </div>
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
                        {selectedHero ? ` 先頭案のコメントは「${selectedHero.parsed.comment}」です。` : ""}
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
                          上位案でよく出ている理由
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
                    const parsed = ticket.parsed;

                    return (
                      <div
                        key={ticket.id}
                        className="rounded-[26px] border border-slate-200 bg-slate-50/90 p-4"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <div className="flex items-center gap-2">
                            <Badge tone="sky">#{index + 1}</Badge>
                            <span className="text-lg font-semibold text-slate-900">
                              配分スコア {formatNumber(ticket.ticketScore, 2)}
                            </span>
                          </div>
                          <div className="flex flex-wrap gap-2 text-sm">
                            <Badge tone="teal">
                              注目配分 {formatPercent(parsed.attentionShare, 1)}
                            </Badge>
                            <Badge tone="amber">
                              合成確からしさ {formatPercent(ticket.estimatedHitProb, 1)}
                            </Badge>
                            <Badge tone="rose">
                              穴候補度 {formatNumber(ticket.contrarianScore, 2)}
                            </Badge>
                            <Badge tone="slate">
                              平均リスク {formatNumber(parsed.averageRiskScore, 2)}
                            </Badge>
                          </div>
                        </div>

                        <p className="mt-3 text-sm leading-6 text-slate-600">{parsed.comment}</p>

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
                                合成 {formatPercent(selection.compositeProbability, 1)} / 一般人気{" "}
                                {formatPercent(selection.crowdProbability, 1)} / 合成優位{" "}
                                {formatSignedPercent(selection.compositeAdvantage, 1)}
                              </div>
                              <div className="mt-1 text-xs leading-5 text-slate-500">
                                注目配分 {formatPercent(selection.attentionShare, 1)} / リスク{" "}
                                {formatNumber(selection.riskScore, 2)}
                              </div>
                            </div>
                          ))}
                        </div>

                        <div className="mt-4 flex flex-wrap gap-2">
                          {parsed.selections.map((selection) => (
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
    <Suspense fallback={<LoadingNotice title="候補配分を準備中" />}>
      <TicketGeneratorPageContent />
    </Suspense>
  );
}
