import type { ReactNode } from "react";

import { Badge, cx } from "@/components/ui";

type NoticeTone = "amber" | "rose" | "sky" | "teal";

const toneClassName: Record<NoticeTone, string> = {
  amber:
    "border-amber-200 bg-[linear-gradient(145deg,rgba(255,247,237,0.96),rgba(254,243,199,0.9))] text-amber-950",
  rose:
    "border-rose-200 bg-[linear-gradient(145deg,rgba(255,241,242,0.96),rgba(255,228,230,0.9))] text-rose-950",
  sky:
    "border-sky-200 bg-[linear-gradient(145deg,rgba(239,246,255,0.96),rgba(219,234,254,0.9))] text-sky-950",
  teal:
    "border-emerald-200 bg-[linear-gradient(145deg,rgba(236,253,245,0.96),rgba(209,250,229,0.9))] text-emerald-950",
};

type EditingStatusNoticeProps = {
  action?: ReactNode;
  className?: string;
  description: ReactNode;
  title: ReactNode;
  tone: NoticeTone;
};

export function EditingStatusNotice({
  action,
  className,
  description,
  title,
  tone,
}: EditingStatusNoticeProps) {
  return (
    <div
      className={cx(
        "flex flex-col gap-3 rounded-[24px] border px-5 py-4 shadow-[0_18px_48px_-36px_rgba(15,23,42,0.34)] sm:flex-row sm:items-start sm:justify-between",
        toneClassName[tone],
        className,
      )}
    >
      <div className="space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone={tone}>{title}</Badge>
        </div>
        <div className="text-sm leading-6">{description}</div>
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}
