import type { HTMLAttributes, ReactNode } from "react";

type ClassDictionary = Record<string, boolean | null | undefined>;
type ClassValue =
  | ClassDictionary
  | ClassValue[]
  | false
  | null
  | number
  | string
  | undefined;

function flattenClasses(input: ClassValue, values: string[]) {
  if (!input) {
    return;
  }

  if (typeof input === "string" || typeof input === "number") {
    values.push(String(input));
    return;
  }

  if (Array.isArray(input)) {
    input.forEach((entry) => flattenClasses(entry, values));
    return;
  }

  Object.entries(input).forEach(([className, enabled]) => {
    if (enabled) {
      values.push(className);
    }
  });
}

export function cx(...inputs: ClassValue[]) {
  const values: string[] = [];
  inputs.forEach((input) => flattenClasses(input, values));
  return values.join(" ");
}

export const buttonClassName =
  "inline-flex h-11 items-center justify-center rounded-full border border-emerald-200/22 bg-[linear-gradient(135deg,#0b2418,#0f5e2d_52%,#d97706_140%)] px-5 text-sm font-semibold text-white shadow-[0_22px_40px_-24px_rgba(0,0,0,0.7)] ring-1 ring-white/6 hover:-translate-y-0.5 hover:shadow-[0_30px_56px_-24px_rgba(0,0,0,0.76)] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-emerald-400/20 disabled:cursor-not-allowed disabled:opacity-50";

export const secondaryButtonClassName =
  "inline-flex h-11 items-center justify-center rounded-full border border-emerald-900/10 bg-[linear-gradient(135deg,rgba(252,255,252,0.96),rgba(239,247,241,0.92))] px-5 text-sm font-semibold text-slate-800 shadow-[0_18px_38px_-28px_rgba(0,0,0,0.35)] hover:-translate-y-0.5 hover:border-emerald-300/70 hover:bg-white focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-emerald-500/15 disabled:cursor-not-allowed disabled:opacity-50";

export const fieldClassName =
  "h-11 w-full rounded-2xl border border-emerald-950/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.94),rgba(244,250,245,0.94))] px-4 text-sm text-slate-900 shadow-[inset_0_1px_0_rgba(255,255,255,0.75)] outline-none placeholder:text-slate-400 focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/12";

export const textAreaClassName =
  "min-h-32 w-full rounded-2xl border border-emerald-950/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.94),rgba(244,250,245,0.94))] px-4 py-3 text-sm text-slate-900 shadow-[inset_0_1px_0_rgba(255,255,255,0.75)] outline-none placeholder:text-slate-400 focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/12";

type BadgeTone =
  | "amber"
  | "default"
  | "danger"
  | "draw"
  | "info"
  | "lime"
  | "muted"
  | "positive"
  | "rose"
  | "sky"
  | "slate"
  | "teal"
  | "warning";

const badgeToneClassName: Record<BadgeTone, string> = {
  amber: "border-amber-300/65 bg-[linear-gradient(135deg,rgba(255,247,237,0.96),rgba(254,243,199,0.92))] text-amber-950",
  default: "border-slate-200 bg-white text-slate-700",
  danger: "border-rose-300/55 bg-[linear-gradient(135deg,rgba(255,241,242,0.96),rgba(255,228,230,0.92))] text-rose-900",
  draw: "border-sky-300/55 bg-[linear-gradient(135deg,rgba(239,246,255,0.96),rgba(219,234,254,0.92))] text-sky-900",
  info: "border-sky-300/55 bg-[linear-gradient(135deg,rgba(239,246,255,0.96),rgba(219,234,254,0.92))] text-sky-900",
  lime: "border-lime-300/55 bg-[linear-gradient(135deg,rgba(247,254,231,0.96),rgba(236,252,203,0.92))] text-lime-900",
  muted: "border-slate-200 bg-slate-100 text-slate-600",
  positive: "border-emerald-300/55 bg-[linear-gradient(135deg,rgba(236,253,245,0.96),rgba(220,252,231,0.92))] text-emerald-900",
  rose: "border-rose-300/55 bg-[linear-gradient(135deg,rgba(255,241,242,0.96),rgba(255,228,230,0.92))] text-rose-900",
  sky: "border-sky-300/55 bg-[linear-gradient(135deg,rgba(239,246,255,0.96),rgba(219,234,254,0.92))] text-sky-900",
  slate: "border-slate-200 bg-[linear-gradient(135deg,rgba(248,250,252,0.96),rgba(241,245,249,0.92))] text-slate-700",
  teal: "border-emerald-300/55 bg-[linear-gradient(135deg,rgba(236,253,245,0.96),rgba(209,250,229,0.92))] text-emerald-950",
  warning: "border-amber-300/65 bg-[linear-gradient(135deg,rgba(255,247,237,0.96),rgba(254,243,199,0.92))] text-amber-950",
};

type BadgeProps = HTMLAttributes<HTMLSpanElement> & {
  tone?: BadgeTone;
};

export function Badge({
  children,
  className,
  tone = "default",
  ...props
}: BadgeProps) {
  return (
    <span
      className={cx(
        "inline-flex items-center gap-1 rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.2em] shadow-[0_12px_24px_-22px_rgba(15,23,42,0.7)]",
        badgeToneClassName[tone],
        className,
      )}
      {...props}
    >
      {children}
    </span>
  );
}

type SectionCardProps = HTMLAttributes<HTMLElement> & {
  action?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  contentClassName?: string;
  description?: ReactNode;
  title?: ReactNode;
};

export function SectionCard({
  action,
  actions,
  children,
  className,
  contentClassName,
  description,
  title,
  ...props
}: SectionCardProps) {
  const resolvedAction = action ?? actions;

  return (
    <section
      className={cx(
        "relative overflow-hidden rounded-[30px] border border-white/55 bg-[linear-gradient(145deg,rgba(255,255,255,0.94),rgba(244,250,246,0.9))] p-5 shadow-[0_28px_90px_-48px_rgba(0,0,0,0.42)] backdrop-blur-xl before:pointer-events-none before:absolute before:inset-x-6 before:top-0 before:h-px before:bg-[linear-gradient(90deg,transparent,rgba(22,128,61,0.48),rgba(245,158,11,0.35),transparent)] after:pointer-events-none after:absolute after:inset-0 after:bg-[repeating-linear-gradient(180deg,rgba(22,128,61,0.018)_0px,rgba(22,128,61,0.018)_26px,transparent_26px,transparent_52px)] after:opacity-85 after:content-[''] sm:p-6",
        className,
      )}
      {...props}
    >
      {(title || description || resolvedAction) && (
        <div className="relative z-10 mb-5 flex flex-col gap-3 border-b border-slate-200 pb-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-1.5">
            {typeof title === "string" ? (
              <h2 className="font-display text-lg font-semibold tracking-[-0.04em] text-slate-950 sm:text-[1.2rem]">
                {title}
              </h2>
            ) : (
              title
            )}
            {typeof description === "string" ? (
              <p className="max-w-2xl text-sm leading-6 text-slate-600">
                {description}
              </p>
            ) : (
              description
            )}
          </div>
          {resolvedAction ? <div className="shrink-0">{resolvedAction}</div> : null}
        </div>
      )}

      <div className={cx("relative z-10 space-y-4", contentClassName)}>{children}</div>
    </section>
  );
}

type StatCardTone = "default" | "draw" | "positive" | "warning";

const statToneClassName: Record<StatCardTone, string> = {
  default: "border-white/70 bg-white/85",
  draw: "border-violet-200 bg-violet-50",
  positive: "border-emerald-200 bg-emerald-50",
  warning: "border-amber-200 bg-amber-50",
};

type StatCardProps = HTMLAttributes<HTMLDivElement> & {
  badge?: ReactNode;
  compact?: boolean;
  hint?: ReactNode;
  label: ReactNode;
  tone?: StatCardTone;
  value: ReactNode;
};

export function StatCard({
  badge,
  className,
  compact = false,
  hint,
  label,
  tone = "default",
  value,
  ...props
}: StatCardProps) {
  return (
    <div
      className={cx(
        "relative overflow-hidden rounded-[26px] border p-4 shadow-[0_20px_54px_-34px_rgba(15,23,42,0.34)] backdrop-blur-xl before:absolute before:right-[-2rem] before:top-[-2rem] before:h-24 before:w-24 before:rounded-full before:bg-white/45 before:blur-2xl sm:p-5",
        statToneClassName[tone],
        "after:absolute after:inset-x-0 after:top-0 after:h-1.5 after:bg-[linear-gradient(90deg,rgba(22,128,61,0.9),rgba(245,158,11,0.7),rgba(2,132,199,0.8))] after:content-['']",
        className,
      )}
      {...props}
    >
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm font-medium text-slate-600">{label}</p>
        {badge ? <div className="shrink-0">{badge}</div> : null}
      </div>
      <div
        className={cx(
          "font-display mt-4 font-semibold tracking-[-0.06em] text-slate-950",
          compact ? "text-[1.9rem]" : "text-[2.4rem]",
        )}
      >
        {value}
      </div>
      {hint ? (
        <div className="mt-2 text-sm leading-6 text-slate-500">{hint}</div>
      ) : null}
    </div>
  );
}

type PageHeaderProps = HTMLAttributes<HTMLElement> & {
  actions?: ReactNode;
  description?: ReactNode;
  eyebrow?: ReactNode;
  title: ReactNode;
};

export function PageHeader({
  actions,
  className,
  description,
  eyebrow,
  title,
  ...props
}: PageHeaderProps) {
  return (
    <header
      className={cx(
        "relative overflow-hidden flex flex-col gap-4 rounded-[32px] border border-white/14 bg-[linear-gradient(125deg,rgba(9,34,22,0.92),rgba(13,70,37,0.88)_42%,rgba(10,22,16,0.94))] p-5 shadow-[0_30px_90px_-50px_rgba(0,0,0,0.62)] backdrop-blur-xl before:pointer-events-none before:absolute before:right-[-4rem] before:top-[-5rem] before:h-40 before:w-40 before:rounded-full before:bg-[radial-gradient(circle,rgba(250,204,21,0.16),transparent_62%)] before:blur-xl after:pointer-events-none after:absolute after:inset-x-8 after:bottom-[-5rem] after:h-28 after:rounded-full after:border after:border-white/12 after:content-[''] sm:p-6 lg:flex-row lg:items-end lg:justify-between",
        className,
      )}
      {...props}
    >
      <div className="relative z-10 space-y-3">
        {eyebrow ? (
          <div className="font-display text-[11px] font-medium uppercase tracking-[0.38em] text-emerald-100/68">
            {eyebrow}
          </div>
        ) : null}
        {typeof title === "string" ? (
          <h1 className="font-display text-3xl font-semibold tracking-[-0.07em] text-white sm:text-4xl lg:text-[3rem]">
            {title}
          </h1>
        ) : (
          title
        )}
        {typeof description === "string" ? (
          <p className="max-w-3xl text-sm leading-6 text-emerald-50/76 sm:text-base">
            {description}
          </p>
        ) : (
          description
        )}
      </div>
      {actions ? <div className="relative z-10 shrink-0">{actions}</div> : null}
    </header>
  );
}
