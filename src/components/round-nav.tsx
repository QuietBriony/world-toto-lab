"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { appRoute, buildRoundHref } from "@/lib/round-links";
import { Badge, cx } from "@/components/ui";

export type RoundNavItem = {
  badge?: number | string;
  disabled?: boolean;
  href: string;
  label: string;
  shortLabel?: string;
};

export type RoundNavProps = {
  className?: string;
  currentPath?: string;
  items?: RoundNavItem[];
  roundId?: string | null;
  roundStatus?: string;
  roundTitle?: string;
  userId?: string | null;
};

function isActivePath(pathname: string, href: string) {
  const target = href.split("?")[0];
  return pathname === target;
}

export function RoundNav({
  className,
  currentPath,
  items,
  roundId,
  roundStatus,
  roundTitle,
  userId,
}: RoundNavProps) {
  const pathname = usePathname();
  const resolvedItems =
    items ??
    (roundId
      ? [
          { href: buildRoundHref(appRoute.workspace, roundId), label: "ラウンド詳細" },
          {
            href: buildRoundHref(appRoute.picks, roundId, { user: userId }),
            label: "支持 / 予想",
          },
          {
            href: buildRoundHref(appRoute.scoutCards, roundId, { user: userId }),
            label: "予想者カード",
          },
          { href: buildRoundHref(appRoute.consensus, roundId), label: "コンセンサス" },
          { href: buildRoundHref(appRoute.edgeBoard, roundId), label: "差分ボード" },
          {
            href: buildRoundHref(appRoute.ticketGenerator, roundId),
            label: "候補チケット",
          },
          { href: buildRoundHref(appRoute.review, roundId), label: "振り返り" },
        ]
      : []);
  const activePathname = currentPath ?? pathname;

  return (
    <nav
      aria-label="ラウンド内の移動"
      className={cx(
        "rounded-[28px] border border-white/70 bg-white/88 p-3 shadow-[0_24px_80px_-40px_rgba(15,23,42,0.35)] backdrop-blur-xl sm:p-4",
        className,
      )}
    >
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-wrap items-center gap-3">
          <div>
            <p className="text-xs font-medium uppercase tracking-[0.28em] text-teal-700/70">
              ラウンド画面
            </p>
            <p className="text-base font-semibold tracking-tight text-slate-900">
              {roundTitle ?? "ラウンドメニュー"}
            </p>
          </div>
          {roundStatus ? <Badge tone="info">{roundStatus}</Badge> : null}
        </div>

        <div className="overflow-x-auto pb-1 no-scrollbar">
          <div className="flex min-w-max gap-2">
            <Link
              href={appRoute.dashboard}
              className={cx(
                "inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-medium transition duration-200",
                activePathname === appRoute.dashboard
                  ? "border-teal-300 bg-teal-50 text-teal-900"
                  : "border-slate-200 bg-white text-slate-600 hover:border-teal-200 hover:bg-teal-50 hover:text-teal-900",
              )}
            >
              ダッシュボード
            </Link>

            {resolvedItems.map((item) => {
              const active = isActivePath(activePathname, item.href);
              const label = item.shortLabel ?? item.label;
              const itemClassName = cx(
                "inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-medium transition duration-200",
                active
                  ? "border-teal-300 bg-teal-50 text-teal-900 shadow-[0_12px_30px_-20px_rgba(13,148,136,0.45)]"
                  : "border-slate-200 bg-white text-slate-600 hover:border-teal-200 hover:bg-teal-50 hover:text-teal-900",
                item.disabled && "pointer-events-none opacity-45",
              );

              const badgeClassName = cx(
                "rounded-full px-2 py-0.5 text-[11px] font-semibold",
                active ? "bg-teal-100 text-teal-900" : "bg-slate-100 text-slate-700",
              );

              if (item.disabled) {
                return (
                  <span key={item.href} className={itemClassName}>
                    {label}
                    {item.badge != null ? (
                      <span className={badgeClassName}>{item.badge}</span>
                    ) : null}
                  </span>
                );
              }

              return (
                <Link key={item.href} href={item.href} className={itemClassName}>
                  {label}
                  {item.badge != null ? (
                    <span className={badgeClassName}>{item.badge}</span>
                  ) : null}
                </Link>
              );
            })}
          </div>
        </div>
      </div>
    </nav>
  );
}
