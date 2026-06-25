import Link from "next/link";

import {
  Badge,
  buttonClassName,
  cx,
  secondaryButtonClassName,
  SectionCard,
} from "@/components/ui";
import { appRoute, buildRoundHref } from "@/lib/round-links";

type AppFlowShortcutsProps = {
  className?: string;
  currentPath?: string;
  latestRoundId?: null | string;
  variant?: "compact" | "panel";
};

function buildFlowItems(latestRoundId?: null | string) {
  return [
    {
      body: "W杯totoの購入前判断、PDF、推奨買い目を見る。",
      cta: "W杯戦略",
      href: appRoute.worldCupStrategy,
      label: "買う前",
      tone: "teal" as const,
    },
    {
      body: "toto、BIG、GOAL3、WINNERの熱いネタを横断する。",
      cta: "EV一覧",
      href: appRoute.evOpportunities,
      label: "EV探し",
      tone: "positive" as const,
    },
    {
      body: "友人と候補カードを見て、1/0/2を軽く決める。",
      cta: "予想入力",
      href: latestRoundId ? buildRoundHref(appRoute.play, latestRoundId) : appRoute.play,
      label: "友人用",
      tone: "sky" as const,
    },
    {
      body: "結果、当たり方、次回改善メモを残す。",
      cta: "感想戦",
      href: latestRoundId ? buildRoundHref(appRoute.review, latestRoundId) : appRoute.review,
      label: "振り返り",
      tone: "amber" as const,
    },
  ];
}

export function AppFlowShortcuts({
  className,
  currentPath,
  latestRoundId,
  variant = "panel",
}: AppFlowShortcutsProps) {
  const items = buildFlowItems(latestRoundId);

  if (variant === "compact") {
    return (
      <nav
        aria-label="主要導線"
        className={cx(
          "rounded-[24px] border border-emerald-100 bg-white/82 px-4 py-4 shadow-[0_18px_44px_-36px_rgba(15,23,42,0.34)]",
          className,
        )}
      >
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone="teal">次に見る</Badge>
          <span className="text-sm font-semibold text-slate-900">
            迷ったらこの4つから選びます
          </span>
        </div>
        <div className="mt-3 grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
          {items.map((item) => {
            const active = currentPath === item.href;

            return (
              <Link
                key={item.href}
                href={item.href}
                className={cx(
                  "min-h-[44px] justify-center text-center",
                  active ? buttonClassName : secondaryButtonClassName,
                )}
              >
                {item.label}
              </Link>
            );
          })}
        </div>
      </nav>
    );
  }

  return (
    <SectionCard
      className={className}
      title="まず見る場所を選ぶ"
      description="このアプリは画面が多いので、最初は目的別に4つだけ見れば十分です。細かい分析画面は、必要になったら下層で開きます。"
      actions={<Badge tone="teal">主要導線</Badge>}
    >
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {items.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="group flex min-h-[190px] flex-col justify-between rounded-[24px] border border-slate-200 bg-white/86 px-4 py-4 shadow-[0_18px_44px_-36px_rgba(15,23,42,0.34)] transition hover:-translate-y-0.5 hover:border-emerald-200 hover:bg-emerald-50/70"
          >
            <div>
              <Badge tone={item.tone}>{item.label}</Badge>
              <h3 className="mt-3 text-base font-semibold text-slate-950">{item.cta}</h3>
              <p className="mt-2 text-sm leading-6 text-slate-600">{item.body}</p>
            </div>
            <span className="mt-4 text-sm font-semibold text-emerald-700 group-hover:text-emerald-900">
              開く
            </span>
          </Link>
        ))}
      </div>
    </SectionCard>
  );
}
