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

function normalizeFlowPath(pathname: string) {
  return pathname === appRoute.matchEditor ? appRoute.workspace : pathname;
}

function isActivePath(pathname: string, href: string) {
  return normalizeFlowPath(pathname) === normalizeFlowPath(href.split("?")[0]);
}

function isSameDestination(leftHref: string, rightHref: string) {
  return normalizeFlowPath(leftHref.split("?")[0]) === normalizeFlowPath(rightHref.split("?")[0]);
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
          { href: buildRoundHref(appRoute.edgeBoard, roundId), label: "優位ボード" },
          {
            href: buildRoundHref(appRoute.ticketGenerator, roundId),
            label: "候補配分",
          },
          { href: buildRoundHref(appRoute.review, roundId), label: "振り返り" },
        ]
      : []);
  const activePathname = currentPath ?? pathname;
  const activeItemIndex = resolvedItems.findIndex((item) =>
    isSameDestination(item.href, activePathname),
  );
  const previousItem =
    activeItemIndex > 0 ? resolvedItems[activeItemIndex - 1] : null;
  const nextItem =
    activeItemIndex >= 0 && activeItemIndex < resolvedItems.length - 1
      ? resolvedItems[activeItemIndex + 1]
      : null;

  return (
    <nav
      aria-label="ラウンド内の移動"
      className={cx(
        "rounded-[28px] border border-white/70 bg-white/88 p-3 shadow-[0_24px_80px_-40px_rgba(15,23,42,0.35)] backdrop-blur-xl sm:p-4",
        className,
      )}
    >
      <div className="flex flex-col gap-4">
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

        {resolvedItems.length > 0 ? (
          <div className="rounded-[24px] border border-slate-200 bg-slate-50/82 px-4 py-4">
            <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
              <div className="min-w-0">
                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">
                  おすすめ順
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {resolvedItems.map((item, index) => {
                    const active = isActivePath(activePathname, item.href);
                    const stepLabel = item.shortLabel ?? item.label;

                    if (item.disabled) {
                      return (
                        <span
                          key={`step-${item.href}`}
                          className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white/75 px-3 py-2 text-sm font-medium text-slate-400"
                        >
                          <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-slate-100 text-xs font-semibold text-slate-500">
                            {index + 1}
                          </span>
                          {stepLabel}
                        </span>
                      );
                    }

                    return (
                      <Link
                        key={`step-${item.href}`}
                        href={item.href}
                        className={cx(
                          "inline-flex items-center gap-2 rounded-full border px-3 py-2 text-sm font-medium transition",
                          active
                            ? "border-emerald-300 bg-emerald-50 text-emerald-950 shadow-[0_14px_32px_-24px_rgba(5,150,105,0.4)]"
                            : "border-slate-200 bg-white text-slate-700 hover:border-emerald-200 hover:bg-emerald-50/60",
                        )}
                      >
                        <span
                          className={cx(
                            "inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold",
                            active
                              ? "bg-emerald-600 text-white"
                              : "bg-slate-100 text-slate-600",
                          )}
                        >
                          {index + 1}
                        </span>
                        {stepLabel}
                      </Link>
                    );
                  })}
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <Badge tone="sky">
                  現在 {activeItemIndex >= 0 ? activeItemIndex + 1 : 1} / {resolvedItems.length}
                </Badge>
                {previousItem ? (
                  <Link href={previousItem.href} className={cx(
                    "inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
                  )}>
                    前へ
                  </Link>
                ) : null}
                {nextItem ? (
                  <Link
                    href={nextItem.href}
                    className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm font-medium text-emerald-950 transition hover:border-emerald-300 hover:bg-emerald-100/70"
                  >
                    次へ
                  </Link>
                ) : null}
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </nav>
  );
}
