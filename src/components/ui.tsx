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
  "relative inline-flex h-11 items-center justify-center overflow-hidden rounded-full border border-emerald-200/22 bg-[linear-gradient(135deg,#0b2418,#0f5e2d_52%,#d97706_140%)] px-5 text-sm font-semibold text-white shadow-[0_22px_40px_-24px_rgba(0,0,0,0.7)] ring-1 ring-white/6 before:pointer-events-none before:absolute before:inset-y-0 before:left-[-35%] before:w-16 before:-skew-x-12 before:bg-white/16 before:blur-xl before:transition-[left] before:duration-500 hover:-translate-y-0.5 hover:shadow-[0_30px_56px_-24px_rgba(0,0,0,0.76)] hover:before:left-[120%] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-emerald-400/20 disabled:cursor-not-allowed disabled:opacity-50";

export const secondaryButtonClassName =
  "relative inline-flex h-11 items-center justify-center overflow-hidden rounded-full border border-emerald-900/10 bg-[linear-gradient(135deg,rgba(252,255,252,0.96),rgba(239,247,241,0.92))] px-5 text-sm font-semibold text-slate-800 shadow-[0_18px_38px_-28px_rgba(0,0,0,0.35)] before:pointer-events-none before:absolute before:inset-y-0 before:left-[-40%] before:w-14 before:-skew-x-12 before:bg-white/45 before:blur-xl before:transition-[left] before:duration-500 hover:-translate-y-0.5 hover:border-emerald-300/70 hover:bg-white hover:before:left-[120%] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-emerald-500/15 disabled:cursor-not-allowed disabled:opacity-50";

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

type HorizontalScrollTableProps = HTMLAttributes<HTMLDivElement> & {
  children: ReactNode;
  hint?: ReactNode;
};

export function HorizontalScrollTable({
  children,
  className,
  hint = "横にスワイプで続きを見られます。",
  ...props
}: HorizontalScrollTableProps) {
  return (
    <div className={cx("space-y-3", className)} {...props}>
      <div className="flex items-center justify-between gap-3">
        <div className="sm:hidden">
          <Badge tone="slate">横にスワイプ</Badge>
        </div>
        <p className="text-xs leading-5 text-slate-500 sm:ml-auto">{hint}</p>
      </div>

      <div className="relative">
        <div className="pointer-events-none absolute inset-y-0 left-0 z-10 w-6 bg-[linear-gradient(90deg,rgba(248,250,252,0.96),rgba(248,250,252,0))] sm:hidden" />
        <div className="pointer-events-none absolute inset-y-0 right-0 z-10 w-6 bg-[linear-gradient(270deg,rgba(248,250,252,0.96),rgba(248,250,252,0))] sm:hidden" />
        <div className="overflow-x-auto overscroll-x-contain pb-2">{children}</div>
      </div>
    </div>
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
        <div className="relative z-10 mb-5 flex flex-col gap-3 border-b border-slate-200 pb-4 xl:flex-row xl:items-start xl:justify-between">
          <div className="min-w-0 flex-1 space-y-1.5">
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
          {resolvedAction ? <div className="w-full max-w-full xl:w-auto xl:shrink-0">{resolvedAction}</div> : null}
        </div>
      )}

  <div className={cx("relative z-10 space-y-4", contentClassName)}>{children}</div>
      </section>
  );
}

type CollapsibleSectionCardProps = HTMLAttributes<HTMLDetailsElement> & {
  action?: ReactNode;
  actions?: ReactNode;
  badge?: ReactNode;
  children: ReactNode;
  contentClassName?: string;
  defaultOpen?: boolean;
  description?: ReactNode;
  title: ReactNode;
};

export function CollapsibleSectionCard({
  action,
  actions,
  badge,
  children,
  className,
  contentClassName,
  defaultOpen = false,
  description,
  title,
  ...props
}: CollapsibleSectionCardProps) {
  const resolvedAction = action ?? actions;

  return (
    <details
      open={defaultOpen}
      className={cx(
        "group relative overflow-hidden rounded-[30px] border border-white/55 bg-[linear-gradient(145deg,rgba(255,255,255,0.94),rgba(244,250,246,0.9))] shadow-[0_28px_90px_-48px_rgba(0,0,0,0.42)] backdrop-blur-xl before:pointer-events-none before:absolute before:inset-x-6 before:top-0 before:h-px before:bg-[linear-gradient(90deg,transparent,rgba(22,128,61,0.48),rgba(245,158,11,0.35),transparent)] after:pointer-events-none after:absolute after:inset-0 after:bg-[repeating-linear-gradient(180deg,rgba(22,128,61,0.018)_0px,rgba(22,128,61,0.018)_26px,transparent_26px,transparent_52px)] after:opacity-85 after:content-['']",
        className,
      )}
      {...props}
    >
      <summary className="relative z-10 flex cursor-pointer list-none items-start justify-between gap-4 px-5 py-5 [&::-webkit-details-marker]:hidden sm:px-6 sm:py-6">
        <div className="flex min-w-0 flex-1 flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              {badge ? <div>{badge}</div> : null}
              {typeof title === "string" ? (
                <h2 className="font-display text-lg font-semibold tracking-[-0.04em] text-slate-950 sm:text-[1.2rem]">
                  {title}
                </h2>
              ) : (
                title
              )}
            </div>
            {typeof description === "string" ? (
              <p className="max-w-2xl text-sm leading-6 text-slate-600">{description}</p>
            ) : (
              description
            )}
          </div>
          {resolvedAction ? <div className="shrink-0">{resolvedAction}</div> : null}
        </div>
        <span className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white/88 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500 shadow-[0_12px_24px_-22px_rgba(15,23,42,0.55)]">
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

      <div
        className={cx(
          "relative z-10 border-t border-slate-200 px-5 py-5 sm:px-6 sm:py-6",
          contentClassName,
        )}
      >
        {children}
      </div>
    </details>
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
        "relative overflow-hidden rounded-[26px] border p-4 shadow-[0_20px_54px_-34px_rgba(15,23,42,0.34)] backdrop-blur-xl before:absolute before:right-[-2rem] before:top-[-2rem] before:h-24 before:w-24 before:rounded-full before:bg-white/45 before:blur-2xl sm:p-5 hover:-translate-y-1 hover:shadow-[0_28px_64px_-36px_rgba(15,23,42,0.42)]",
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
        "scoreboard-glow pitch-stripes relative overflow-hidden flex flex-col gap-4 rounded-[32px] border border-white/14 bg-[linear-gradient(125deg,rgba(9,34,22,0.92),rgba(13,70,37,0.88)_42%,rgba(10,22,16,0.94))] p-5 shadow-[0_30px_90px_-50px_rgba(0,0,0,0.62)] backdrop-blur-xl before:pointer-events-none before:absolute before:right-[-4rem] before:top-[-5rem] before:h-40 before:w-40 before:rounded-full before:bg-[radial-gradient(circle,rgba(250,204,21,0.16),transparent_62%)] before:blur-xl after:pointer-events-none after:absolute after:inset-x-8 after:bottom-[-5rem] after:h-28 after:rounded-full after:border after:border-white/12 after:content-[''] sm:p-6 xl:flex-row xl:items-end xl:justify-between",
        className,
      )}
      {...props}
    >
      <div className="relative z-10 min-w-0 flex-1 space-y-3">
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
      {actions ? <div className="relative z-10 w-full max-w-full xl:w-auto xl:shrink-0">{actions}</div> : null}
    </header>
  );
}

type ArtBannerPanelProps = HTMLAttributes<HTMLElement> & {
  actions?: ReactNode;
  badge?: ReactNode;
  contentClassName?: string;
  description: ReactNode;
  eyebrow?: ReactNode;
  footer?: ReactNode;
  imageSrc: string;
  title: ReactNode;
};

export function ArtBannerPanel({
  actions,
  badge,
  className,
  contentClassName,
  description,
  eyebrow,
  footer,
  imageSrc,
  title,
  ...props
}: ArtBannerPanelProps) {
  return (
    <section
      className={cx(
        "relative overflow-hidden rounded-[28px] border border-slate-200 bg-slate-950 shadow-[0_28px_80px_-40px_rgba(15,23,42,0.62)]",
        className,
      )}
      style={{
        backgroundImage: `linear-gradient(90deg,rgba(7,12,18,0.88),rgba(7,12,18,0.56)_44%,rgba(7,12,18,0.36)), url(${imageSrc})`,
        backgroundPosition: "center",
        backgroundSize: "cover",
      }}
      {...props}
    >
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.22),transparent_28%)]" />
      <div
        className={cx(
          "relative z-10 flex min-h-[176px] flex-col justify-between gap-6 p-5 sm:p-6",
          contentClassName,
        )}
      >
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            {eyebrow ? (
              <span className="text-xs font-semibold uppercase tracking-[0.24em] text-white/72">
                {eyebrow}
              </span>
            ) : null}
            {badge ? <div>{badge}</div> : null}
          </div>
          {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
        </div>
        <div className="max-w-2xl space-y-2">
          {typeof title === "string" ? (
            <h2 className="font-display text-[1.45rem] font-semibold tracking-[-0.05em] text-white sm:text-[1.7rem]">
              {title}
            </h2>
          ) : (
            title
          )}
          {typeof description === "string" ? (
            <p className="text-sm leading-6 text-white/82 sm:text-[0.95rem]">
              {description}
            </p>
          ) : (
            description
          )}
        </div>
        {footer ? <div>{footer}</div> : null}
      </div>
    </section>
  );
}
