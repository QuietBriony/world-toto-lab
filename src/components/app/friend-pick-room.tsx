import { EditingStatusNotice } from "@/components/app/editing-status";
import {
  Badge,
  buttonClassName,
  CollapsibleSectionCard,
  cx,
  HorizontalScrollTable,
  SectionCard,
  secondaryButtonClassName,
} from "@/components/ui";
import { formatCurrency, formatPercent } from "@/lib/domain";
import type { RoundDataQualitySummary } from "@/lib/candidate-tickets";
import type {
  CandidateDataQuality,
  CandidateStrategyType,
  CandidateTicket,
  CandidateVote,
  CandidateVoteValue,
} from "@/lib/types";

export type CandidateVoteSummary = {
  boughtMyself: number;
  comments: number;
  like: number;
  maybe: number;
  pass: number;
};

const voteLabel: Record<CandidateVoteValue, string> = {
  like: "これ推し",
  maybe: "迷う",
  pass: "パス",
  bought_myself: "自分はこれで買った",
};

const candidateStrategyLabel: Record<CandidateStrategyType, string> = {
  orthodox_model: "AI本線",
  public_favorite: "公式人気",
  human_consensus: "人力集約",
  ev_hunter: "EV狙い",
  sleeping_value: "人気薄狙い",
  draw_alert: "引分警報",
  upset: "荒れ狙い",
};

const candidateStrategyTone: Record<
  CandidateStrategyType,
  "amber" | "draw" | "info" | "lime" | "rose" | "sky" | "teal"
> = {
  orthodox_model: "teal",
  public_favorite: "sky",
  human_consensus: "info",
  ev_hunter: "amber",
  sleeping_value: "lime",
  draw_alert: "draw",
  upset: "rose",
};

const candidateOriginCue: Record<CandidateStrategyType, string> = {
  orthodox_model: "AIの本線寄り。モデル確率を主軸にした比較用の並びです。",
  public_favorite: "公式人気の並びを土台にした王道比較用です。",
  human_consensus: "管理者の手入力予想を寄せて固めた人力ベースです。",
  ev_hunter: "AI確率と公式人気のズレから期待値を探す候補です。",
  sleeping_value: "人気薄でも拾う価値がありそうな目を厚めに入れています。",
  draw_alert: "引き分けシグナルが強い試合を優先した候補です。",
  upset: "人気サイドから外して遊び筋を混ぜた逆張り候補です。",
};

const candidateDataQualityLabel: Record<CandidateDataQuality, string> = {
  complete: "実EV",
  missing_official_vote: "公式不足",
  missing_model_prob: "AI不足",
  proxy_only: "Proxy",
  demo_data: "デモ",
};

const candidateDataQualityTone: Record<
  CandidateDataQuality,
  "amber" | "sky" | "slate" | "teal" | "warning"
> = {
  complete: "teal",
  missing_official_vote: "amber",
  missing_model_prob: "sky",
  proxy_only: "sky",
  demo_data: "warning",
};

export function buildCandidateVoteSummaryMap(votes: CandidateVote[]) {
  const map = new Map<string, CandidateVoteSummary>();

  votes.forEach((vote) => {
    const current = map.get(vote.candidateTicketId) ?? {
      boughtMyself: 0,
      comments: 0,
      like: 0,
      maybe: 0,
      pass: 0,
    };

    if (vote.vote === "like") {
      current.like += 1;
    } else if (vote.vote === "maybe") {
      current.maybe += 1;
    } else if (vote.vote === "pass") {
      current.pass += 1;
    } else {
      current.boughtMyself += 1;
    }

    if (vote.comment) {
      current.comments += 1;
    }

    map.set(vote.candidateTicketId, current);
  });

  return map;
}

function warningTone(warning: string | null | undefined) {
  if (!warning) {
    return null;
  }

  if (warning.includes("デモ")) {
    return "warning" as const;
  }

  if (warning.includes("Proxy")) {
    return "sky" as const;
  }

  return "amber" as const;
}

export function DataQualityCard(props: {
  extraLines?: string[];
  summary: RoundDataQualitySummary;
}) {
  return (
    <SectionCard
      title="データ状態"
      description="EV候補や参考値は入力データに強く依存します。"
    >
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
        {props.summary.metrics.map((metric) => (
          <div
            key={metric.label}
            className="rounded-[22px] border border-slate-200 bg-white/88 px-4 py-3 shadow-[0_18px_36px_-30px_rgba(15,23,42,0.32)]"
          >
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">
              {metric.label}
            </p>
            <p className="mt-2 text-lg font-semibold tracking-tight text-slate-950">
              {metric.filled}/{metric.total}
            </p>
          </div>
        ))}
      </div>

      <EditingStatusNotice
        className="mt-4"
        tone={props.summary.strictEvReady ? "teal" : "amber"}
        title={props.summary.strictEvReady ? "実EVベース" : "Proxy / 要確認"}
        description={
          <div className="space-y-2">
            <p>{props.summary.message}</p>
            {props.extraLines?.map((line) => <p key={line}>{line}</p>)}
          </div>
        }
      />
    </SectionCard>
  );
}

export function CandidateCard(props: {
  activeVote: CandidateVoteValue | null;
  busyVote: CandidateVoteValue | "comment" | null;
  candidate: CandidateTicket;
  onComment: () => void;
  onVote: (vote: CandidateVoteValue) => void;
  voteSummary: CandidateVoteSummary;
}) {
  const warning = props.candidate.warning;
  const warningBadgeTone = warningTone(warning);

  return (
    <article className="flex w-[86vw] max-w-[360px] shrink-0 snap-start flex-col gap-4 rounded-[28px] border border-white/70 bg-[linear-gradient(145deg,rgba(255,255,255,0.96),rgba(242,250,245,0.9))] p-5 shadow-[0_28px_72px_-44px_rgba(15,23,42,0.42)] sm:w-auto sm:min-w-[320px]">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold uppercase tracking-[0.26em] text-emerald-700/70">
            Candidate Card
          </p>
          <h3 className="mt-2 text-xl font-semibold tracking-tight text-slate-950">
            {props.candidate.label}
          </h3>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            {candidateOriginCue[props.candidate.strategyType]}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Badge tone={candidateStrategyTone[props.candidate.strategyType]}>
            {candidateStrategyLabel[props.candidate.strategyType]}
          </Badge>
          <Badge tone={candidateDataQualityTone[props.candidate.dataQuality]}>
            {candidateDataQualityLabel[props.candidate.dataQuality]}
          </Badge>
          {warningBadgeTone ? <Badge tone={warningBadgeTone}>注意あり</Badge> : null}
        </div>
      </div>

      <div className="rounded-[22px] border border-slate-200 bg-slate-950 px-4 py-3 text-center font-mono text-base font-semibold tracking-[0.24em] text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.08)] sm:text-lg sm:tracking-[0.35em]">
        <div className="overflow-x-auto">{props.candidate.picks.map((pick) => pick.pick).join(" ")}</div>
      </div>

      <div className="grid grid-cols-2 gap-3 text-sm">
        <div className="rounded-[20px] border border-emerald-100 bg-emerald-50/80 px-3 py-3">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-700/70">
            推定EV / Proxy
          </p>
          <p className="mt-2 text-lg font-semibold text-slate-950">
            {props.candidate.evPercent !== null
              ? `${props.candidate.evPercent.toFixed(0)}%`
              : props.candidate.proxyScore?.toFixed(2) ?? "—"}
          </p>
        </div>
        <div className="rounded-[20px] border border-sky-100 bg-sky-50/80 px-3 py-3">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-sky-700/70">
            的中確率目安
          </p>
          <p className="mt-2 text-lg font-semibold text-slate-950">
            {formatPercent(props.candidate.hitProbability, 3)}
          </p>
        </div>
        <div className="rounded-[20px] border border-amber-100 bg-amber-50/80 px-3 py-3">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-amber-700/70">
            推定配当目安
          </p>
          <p className="mt-2 text-base font-semibold text-slate-950">
            {formatCurrency(props.candidate.estimatedPayoutYen)}
          </p>
        </div>
        <div className="rounded-[20px] border border-slate-200 bg-slate-50/90 px-3 py-3">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
            逆張り / 引分
          </p>
          <p className="mt-2 text-base font-semibold text-slate-950">
            {props.candidate.contrarianCount} / {props.candidate.drawCount}
          </p>
        </div>
      </div>

      {props.candidate.rationale ? (
        <p className="rounded-[18px] border border-slate-200 bg-slate-50/90 px-3 py-3 text-sm leading-6 text-slate-700">
          {props.candidate.rationale}
        </p>
      ) : null}

      <div className="flex flex-wrap gap-2 text-xs">
        <Badge tone="info">人力一致 {formatPercent(props.candidate.humanAlignmentScore, 0)}</Badge>
        <Badge tone="slate">推し {props.voteSummary.like}</Badge>
        <Badge tone="slate">迷い {props.voteSummary.maybe}</Badge>
        <Badge tone="slate">パス {props.voteSummary.pass}</Badge>
        <Badge tone="slate">購入済 {props.voteSummary.boughtMyself}</Badge>
        <Badge tone="slate">コメント {props.voteSummary.comments}</Badge>
      </div>

      {warning ? (
        <p className="rounded-[18px] border border-amber-200 bg-amber-50 px-3 py-3 text-sm leading-6 text-amber-950">
          {warning}
        </p>
      ) : null}

      <div className="grid gap-2 sm:grid-cols-2">
        {(["like", "maybe", "pass", "bought_myself"] as const).map((vote) => (
          <button
            key={vote}
            type="button"
            onClick={() => props.onVote(vote)}
            disabled={Boolean(props.busyVote)}
            className={cx(
              props.activeVote === vote ? buttonClassName : secondaryButtonClassName,
              "w-full text-center text-xs",
              props.busyVote === vote && "opacity-70",
            )}
          >
            {voteLabel[vote]}
          </button>
        ))}
      </div>

      <button type="button" onClick={props.onComment} className={secondaryButtonClassName}>
        コメントを残す
      </button>
    </article>
  );
}

export function CandidateComparisonTable(props: {
  summaries: Map<string, CandidateVoteSummary>;
  tickets: CandidateTicket[];
}) {
  return (
    <CollapsibleSectionCard
      title="Candidate Comparison"
      description="王道・人力・EV候補の出どころと注意点までまとめて比較できます。"
      defaultOpen={false}
      badge={<Badge tone="slate">比較表</Badge>}
    >
      <HorizontalScrollTable>
        <table className="min-w-[1320px] text-left text-sm">
          <thead>
            <tr className="border-b border-slate-200 text-slate-500">
              <th className="px-3 py-3">候補名</th>
              <th className="px-3 py-3">タイプ</th>
              <th className="px-3 py-3">由来</th>
              <th className="px-3 py-3">並び</th>
              <th className="px-3 py-3">推定EV</th>
              <th className="px-3 py-3">的中確率</th>
              <th className="px-3 py-3">推定配当</th>
              <th className="px-3 py-3">逆張り</th>
              <th className="px-3 py-3">引分</th>
              <th className="px-3 py-3">人力一致</th>
              <th className="px-3 py-3">注意</th>
              <th className="px-3 py-3">投票</th>
              <th className="px-3 py-3">コメント</th>
            </tr>
          </thead>
          <tbody>
            {props.tickets.map((ticket) => {
              const summary = props.summaries.get(ticket.id) ?? {
                boughtMyself: 0,
                comments: 0,
                like: 0,
                maybe: 0,
                pass: 0,
              };
              const totalVotes =
                summary.like + summary.maybe + summary.pass + summary.boughtMyself;

              return (
                <tr key={ticket.id} className="border-b border-slate-100 align-top">
                  <td className="px-3 py-3 font-semibold text-slate-950">{ticket.label}</td>
                  <td className="px-3 py-3 text-slate-600">
                    {candidateStrategyLabel[ticket.strategyType]}
                  </td>
                  <td className="px-3 py-3 text-slate-600">
                    {candidateOriginCue[ticket.strategyType]}
                  </td>
                  <td className="px-3 py-3 font-medium tracking-[0.2em] text-slate-950">
                    {ticket.picks.map((pick) => pick.pick).join(" ")}
                  </td>
                  <td className="px-3 py-3">
                    {ticket.evPercent !== null
                      ? `${ticket.evPercent.toFixed(0)}%`
                      : ticket.proxyScore?.toFixed(2) ?? "—"}
                  </td>
                  <td className="px-3 py-3">{formatPercent(ticket.hitProbability, 3)}</td>
                  <td className="px-3 py-3">{formatCurrency(ticket.estimatedPayoutYen)}</td>
                  <td className="px-3 py-3">{ticket.contrarianCount}</td>
                  <td className="px-3 py-3">{ticket.drawCount}</td>
                  <td className="px-3 py-3">{formatPercent(ticket.humanAlignmentScore, 0)}</td>
                  <td className="px-3 py-3 text-slate-600">
                    {ticket.warning ??
                      ticket.rationale ??
                      candidateDataQualityLabel[ticket.dataQuality]}
                  </td>
                  <td className="px-3 py-3">{totalVotes}</td>
                  <td className="px-3 py-3">{summary.comments}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </HorizontalScrollTable>
    </CollapsibleSectionCard>
  );
}
