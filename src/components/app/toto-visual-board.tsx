import { formatPercent, OUTCOME_VALUES, type OutcomeValue } from "@/lib/domain";
import { Badge, cx } from "@/components/ui";

export type TotoVisualBoardCall = "axis" | "cover" | "human_decision" | "spread";

export type TotoVisualBoardRow = {
  call: TotoVisualBoardCall;
  confidence: number;
  fixture: string;
  matchNo: number;
  primaryOutcome: OutcomeValue | null;
  secondaryLabel?: string | null;
  selectedOutcomes: OutcomeValue[];
  shares: Record<OutcomeValue, number>;
};

type TotoVisualBoardProps = {
  description?: string;
  metricLabel?: string;
  rows: TotoVisualBoardRow[];
  title?: string;
};

const callStyle: Record<
  TotoVisualBoardCall,
  {
    badge: "amber" | "rose" | "sky" | "teal";
    label: string;
    rail: string;
    surface: string;
  }
> = {
  axis: {
    badge: "teal",
    label: "軸",
    rail: "bg-emerald-600",
    surface: "border-emerald-200 bg-emerald-50/80",
  },
  cover: {
    badge: "amber",
    label: "押さえ",
    rail: "bg-amber-500",
    surface: "border-amber-200 bg-amber-50/80",
  },
  human_decision: {
    badge: "sky",
    label: "人間決め",
    rail: "bg-sky-500",
    surface: "border-sky-200 bg-sky-50/80",
  },
  spread: {
    badge: "rose",
    label: "広げる",
    rail: "bg-rose-500",
    surface: "border-rose-200 bg-rose-50/80",
  },
};

const outcomeStyle: Record<
  OutcomeValue,
  {
    bar: string;
    text: string;
  }
> = {
  "1": {
    bar: "bg-emerald-500",
    text: "text-emerald-800",
  },
  "0": {
    bar: "bg-sky-500",
    text: "text-sky-800",
  },
  "2": {
    bar: "bg-rose-500",
    text: "text-rose-800",
  },
};

function clampPercent(value: number) {
  if (!Number.isFinite(value)) {
    return 0;
  }

  return Math.min(Math.max(value, 0), 1);
}

function sortedRows(rows: TotoVisualBoardRow[]) {
  return [...rows].sort((left, right) => left.matchNo - right.matchNo);
}

function selectedOutcomeLabel(row: TotoVisualBoardRow) {
  const outcomes =
    row.selectedOutcomes.length > 0
      ? row.selectedOutcomes
      : row.primaryOutcome
        ? [row.primaryOutcome]
        : [];

  return outcomes.length > 0 ? outcomes.join("/") : "-";
}

export function TotoVisualBoard({
  description,
  metricLabel = "安定度",
  rows,
  title = "Toto Visual Board",
}: TotoVisualBoardProps) {
  const orderedRows = sortedRows(rows);

  if (orderedRows.length === 0) {
    return null;
  }

  const callCounts = orderedRows.reduce(
    (counts, row) => ({
      ...counts,
      [row.call]: (counts[row.call] ?? 0) + 1,
    }),
    {
      axis: 0,
      cover: 0,
      human_decision: 0,
      spread: 0,
    } satisfies Record<TotoVisualBoardCall, number>,
  );

  return (
    <div className="rounded-[26px] border border-slate-200 bg-[linear-gradient(145deg,rgba(248,250,252,0.96),rgba(255,255,255,0.92))] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.72)]">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
            可視化
          </p>
          <h3 className="mt-1 font-display text-lg font-semibold tracking-[-0.04em] text-slate-950">
            {title}
          </h3>
          {description ? (
            <p className="mt-1 max-w-3xl text-sm leading-6 text-slate-600">{description}</p>
          ) : null}
        </div>
        <div className="flex flex-wrap gap-2">
          {(["axis", "cover", "human_decision", "spread"] as const).map((call) =>
            callCounts[call] > 0 ? (
              <Badge key={call} tone={callStyle[call].badge}>
                {callStyle[call].label} {callCounts[call]}
              </Badge>
            ) : null,
          )}
        </div>
      </div>

      <div
        data-horizontal-scroll
        className="mt-4 min-w-0 max-w-full touch-pan-x overflow-x-auto overscroll-x-contain pb-2 [-webkit-overflow-scrolling:touch]"
      >
        <div className="grid min-w-[980px] grid-flow-col auto-cols-[72px] gap-2">
          {orderedRows.map((row) => {
            const style = callStyle[row.call];

            return (
              <div
                key={`visual-strip-${row.matchNo}`}
                className={cx(
                  "relative min-h-[116px] overflow-hidden rounded-[18px] border px-2 py-2",
                  style.surface,
                )}
              >
                <div className={cx("absolute inset-x-0 top-0 h-1.5", style.rail)} />
                <div className="flex items-center justify-between gap-1">
                  <span className="text-[11px] font-semibold text-slate-500">
                    #{row.matchNo}
                  </span>
                  <span className="text-[10px] font-semibold text-slate-500">
                    {formatPercent(row.confidence, 0)}
                  </span>
                </div>
                <p
                  className={cx(
                    "mt-2 text-center font-display text-3xl font-semibold tracking-[0] leading-none",
                    row.primaryOutcome ? outcomeStyle[row.primaryOutcome].text : "text-slate-500",
                  )}
                >
                  {row.primaryOutcome ?? "-"}
                </p>
                <p className="mt-2 truncate text-center text-[11px] font-semibold text-slate-700">
                  {selectedOutcomeLabel(row)}
                </p>
                <div className="mt-3 space-y-1">
                  {OUTCOME_VALUES.map((outcome) => (
                    <div key={`visual-mini-${row.matchNo}-${outcome}`} className="h-1.5 rounded-full bg-white/82">
                      <div
                        className={cx("h-1.5 rounded-full", outcomeStyle[outcome].bar)}
                        style={{ width: `${clampPercent(row.shares[outcome]) * 100}%` }}
                      />
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="mt-4 grid gap-3 lg:grid-cols-2">
        {orderedRows.map((row) => {
          const style = callStyle[row.call];

          return (
            <div
              key={`visual-row-${row.matchNo}`}
              className="rounded-[22px] border border-slate-200 bg-white/88 px-4 py-3"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge tone={style.badge}>{style.label}</Badge>
                    <Badge tone="slate">#{row.matchNo}</Badge>
                    <Badge tone="sky">{selectedOutcomeLabel(row)}</Badge>
                  </div>
                  <p className="mt-2 text-sm font-semibold text-slate-950">{row.fixture}</p>
                  {row.secondaryLabel ? (
                    <p className="mt-1 text-xs text-slate-500">{row.secondaryLabel}</p>
                  ) : null}
                </div>
                <div className="text-right">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                    {metricLabel}
                  </p>
                  <p className="mt-1 text-base font-semibold text-slate-950">
                    {formatPercent(row.confidence, 0)}
                  </p>
                </div>
              </div>

              <div className="mt-3 grid grid-cols-[24px_1fr_48px] gap-x-2 gap-y-2">
                {OUTCOME_VALUES.map((outcome) => (
                  <div key={`visual-bar-${row.matchNo}-${outcome}`} className="contents">
                    <p className={cx("text-sm font-semibold", outcomeStyle[outcome].text)}>
                      {outcome}
                    </p>
                    <div className="h-3 overflow-hidden rounded-full bg-slate-100">
                      <div
                        className={cx("h-full rounded-full", outcomeStyle[outcome].bar)}
                        style={{ width: `${clampPercent(row.shares[outcome]) * 100}%` }}
                      />
                    </div>
                    <p className="text-right text-xs font-semibold text-slate-600">
                      {formatPercent(row.shares[outcome], 0)}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
