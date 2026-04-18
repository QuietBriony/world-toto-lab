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
  "inline-flex h-11 items-center justify-center rounded-full bg-teal-600 px-5 text-sm font-semibold text-white transition duration-200 hover:bg-teal-500 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-teal-500/25 disabled:cursor-not-allowed disabled:opacity-50";

export const secondaryButtonClassName =
  "inline-flex h-11 items-center justify-center rounded-full border border-slate-300 bg-white px-5 text-sm font-semibold text-slate-800 transition duration-200 hover:border-teal-300 hover:bg-teal-50 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-teal-500/15 disabled:cursor-not-allowed disabled:opacity-50";

export const fieldClassName =
  "h-11 w-full rounded-2xl border border-slate-300 bg-white px-4 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-teal-400 focus:ring-4 focus:ring-teal-500/15";

export const textAreaClassName =
  "min-h-32 w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-teal-400 focus:ring-4 focus:ring-teal-500/15";

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
  amber: "border-amber-200 bg-amber-50 text-amber-900",
  default: "border-slate-200 bg-white text-slate-700",
  danger: "border-rose-200 bg-rose-50 text-rose-900",
  draw: "border-violet-200 bg-violet-50 text-violet-900",
  info: "border-sky-200 bg-sky-50 text-sky-900",
  lime: "border-lime-200 bg-lime-50 text-lime-900",
  muted: "border-slate-200 bg-slate-100 text-slate-600",
  positive: "border-emerald-200 bg-emerald-50 text-emerald-900",
  rose: "border-rose-200 bg-rose-50 text-rose-900",
  sky: "border-sky-200 bg-sky-50 text-sky-900",
  slate: "border-slate-200 bg-slate-100 text-slate-700",
  teal: "border-teal-200 bg-teal-50 text-teal-900",
  warning: "border-amber-200 bg-amber-50 text-amber-900",
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
        "inline-flex items-center gap-1 rounded-full border px-3 py-1 text-xs font-semibold tracking-[0.16em]",
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
        "rounded-[28px] border border-white/70 bg-white/88 p-5 shadow-[0_24px_80px_-40px_rgba(15,23,42,0.35)] backdrop-blur-xl sm:p-6",
        className,
      )}
      {...props}
    >
      {(title || description || resolvedAction) && (
        <div className="mb-5 flex flex-col gap-3 border-b border-slate-200 pb-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-1.5">
            {typeof title === "string" ? (
              <h2 className="text-lg font-semibold tracking-tight text-slate-950">
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

      <div className={cx("space-y-4", contentClassName)}>{children}</div>
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
        "rounded-[24px] border p-4 shadow-[0_16px_40px_-28px_rgba(15,23,42,0.28)] backdrop-blur-xl sm:p-5",
        statToneClassName[tone],
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
          "mt-4 font-semibold tracking-tight text-slate-950",
          compact ? "text-2xl" : "text-3xl",
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
        "flex flex-col gap-4 rounded-[28px] border border-white/70 bg-[linear-gradient(135deg,rgba(236,253,245,0.95),rgba(240,249,255,0.92))] p-5 shadow-[0_24px_80px_-40px_rgba(15,23,42,0.35)] backdrop-blur-xl sm:p-6 lg:flex-row lg:items-end lg:justify-between",
        className,
      )}
      {...props}
    >
      <div className="space-y-3">
        {eyebrow ? (
          <div className="text-xs font-medium uppercase tracking-[0.3em] text-teal-700/70">
            {eyebrow}
          </div>
        ) : null}
        {typeof title === "string" ? (
          <h1 className="text-3xl font-semibold tracking-tight text-slate-950 sm:text-4xl">
            {title}
          </h1>
        ) : (
          title
        )}
        {typeof description === "string" ? (
          <p className="max-w-3xl text-sm leading-6 text-slate-600 sm:text-base">
            {description}
          </p>
        ) : (
          description
        )}
      </div>
      {actions ? <div className="shrink-0">{actions}</div> : null}
    </header>
  );
}
