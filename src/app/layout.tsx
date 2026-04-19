import type { Metadata } from "next";
import { JetBrains_Mono, Space_Grotesk } from "next/font/google";
import { Badge, cx } from "@/components/ui";
import "./globals.css";

const displayFont = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-display-ui",
});

const monoFont = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono-ui",
});

export const metadata: Metadata = {
  title: {
    default: "World Toto Lab",
    template: "%s | World Toto Lab",
  },
  description:
    "W杯toto/WINNERを友人グループで分析・投票・記録・振り返りするためのダッシュボード。",
  applicationName: "World Toto Lab",
};

const complianceNotes = [
  "このサイトは娯楽・分析・記録用です",
  "的中や利益を保証するものではありません",
  "公式totoの購入代行、賭け金管理、配当分配は行いません",
  "19歳未満の利用・購入を想定しません",
  "各自の判断で公式サービスを利用してください",
];

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="ja"
      className={cx("h-full antialiased", displayFont.variable, monoFont.variable)}
    >
      <body className="min-h-full">
        <div className="relative isolate flex min-h-screen flex-col overflow-hidden">
          <div className="pointer-events-none absolute inset-0 -z-20 bg-[linear-gradient(180deg,rgba(247,250,255,0.96),rgba(233,239,246,0.96))]" />
          <div className="pointer-events-none absolute inset-0 -z-10 bg-[linear-gradient(rgba(15,23,42,0.04)_1px,transparent_1px),linear-gradient(90deg,rgba(15,23,42,0.04)_1px,transparent_1px)] bg-[size:30px_30px] [mask-image:linear-gradient(180deg,rgba(0,0,0,0.72),transparent_88%)]" />
          <div className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[38rem] bg-[radial-gradient(circle_at_top,rgba(19,78,74,0.22),transparent_38%),radial-gradient(circle_at_18%_20%,rgba(14,116,144,0.18),transparent_28%),radial-gradient(circle_at_82%_0%,rgba(245,158,11,0.22),transparent_24%),linear-gradient(180deg,rgba(255,255,255,0),rgba(255,255,255,0.78))]" />
          <div className="pointer-events-none absolute right-[-10rem] top-[-8rem] -z-10 h-[24rem] w-[24rem] rounded-full border border-white/50 bg-[radial-gradient(circle,rgba(255,255,255,0.55),rgba(255,255,255,0.02)_68%)] blur-2xl" />
          <div className="pointer-events-none absolute left-[-8rem] top-[18rem] -z-10 h-[18rem] w-[18rem] rounded-full bg-[radial-gradient(circle,rgba(20,184,166,0.16),rgba(20,184,166,0.02)_72%)] blur-3xl" />
          <header className="sticky top-0 z-50 border-b border-white/60 bg-[rgba(245,248,252,0.82)] backdrop-blur-2xl">
            <div className="mx-auto flex w-full max-w-7xl flex-col gap-4 px-4 py-4 sm:px-6 lg:px-8">
              <div className="flex flex-col gap-4 rounded-[28px] border border-white/70 bg-[linear-gradient(135deg,rgba(255,255,255,0.86),rgba(245,247,250,0.88))] px-4 py-4 shadow-[0_30px_90px_-48px_rgba(15,23,42,0.55)] lg:flex-row lg:items-end lg:justify-between">
                <div className="space-y-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge tone="sky">World Cup Toto Dashboard</Badge>
                    <Badge tone="amber">Analysis Only</Badge>
                    <span className="inline-flex items-center gap-2 rounded-full border border-slate-200/80 bg-white/70 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.28em] text-slate-500">
                      Shared MVP
                    </span>
                  </div>
                  <div className="grid gap-3 lg:grid-cols-[auto_1fr] lg:items-end">
                    <div className="flex h-14 w-14 items-center justify-center rounded-[18px] border border-slate-200 bg-[linear-gradient(135deg,rgba(15,23,42,0.98),rgba(19,78,74,0.95))] font-display text-xl font-bold text-white shadow-[0_24px_70px_-38px_rgba(15,23,42,0.9)]">
                      WT
                    </div>
                    <div>
                      <p className="font-display text-[11px] font-medium uppercase tracking-[0.4em] text-teal-800/70">
                      World Toto Lab
                      </p>
                      <h1 className="max-w-3xl text-2xl font-semibold tracking-[-0.04em] text-slate-950 sm:text-3xl lg:text-[2.25rem]">
                        予想・分析・検証に集中するための共有ラボ
                      </h1>
                    </div>
                  </div>
                </div>
                <div className="grid gap-3 lg:max-w-xl lg:grid-cols-[1fr_auto] lg:items-end">
                  <p className="text-sm leading-6 text-slate-600">
                    友人グループで W杯toto/WINNER の見立てを持ち寄り、
                    人力コンセンサスとモデル差分を振り返るための MVP です。
                  </p>
                  <div className="rounded-[20px] border border-emerald-200/70 bg-[linear-gradient(135deg,rgba(236,253,245,0.92),rgba(240,249,255,0.88))] px-4 py-3 text-right shadow-[0_20px_50px_-36px_rgba(13,148,136,0.55)]">
                    <div className="font-display text-[11px] uppercase tracking-[0.32em] text-teal-800/70">
                      Mode
                    </div>
                    <div className="font-display text-xl font-semibold tracking-[-0.05em] text-slate-950">
                      Analysis
                    </div>
                  </div>
                </div>
              </div>

              <div
                className={cx(
                  "overflow-x-auto rounded-[24px] border border-white/80 bg-[linear-gradient(135deg,rgba(255,247,237,0.9),rgba(255,255,255,0.72))] px-3 py-3",
                  "shadow-[0_24px_80px_-40px_rgba(15,23,42,0.35)]",
                )}
              >
                <div className="flex min-w-max gap-2">
                  {complianceNotes.map((note) => (
                    <span
                      key={note}
                      className="inline-flex items-center rounded-full border border-amber-200/90 bg-white/78 px-3 py-1.5 text-xs font-medium text-amber-950 shadow-[0_10px_24px_-22px_rgba(180,83,9,0.8)]"
                    >
                      {note}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </header>

          <main className="mx-auto flex w-full max-w-7xl flex-1 flex-col px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
            <div className="flex flex-1 flex-col gap-6">{children}</div>
          </main>

          <footer className="border-t border-white/60 bg-[#f7fbff]/88">
            <div className="mx-auto flex w-full max-w-7xl flex-col gap-3 px-4 py-5 text-sm text-slate-600 sm:px-6 lg:px-8">
              <div className="flex flex-col gap-4 rounded-[26px] border border-white/70 bg-[linear-gradient(135deg,rgba(255,255,255,0.82),rgba(243,246,249,0.84))] px-5 py-4 shadow-[0_24px_80px_-46px_rgba(15,23,42,0.45)] sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <div className="font-display text-[11px] uppercase tracking-[0.38em] text-slate-500">
                    Shared Usage Notice
                  </div>
                  <p className="mt-2 max-w-2xl leading-6">
                    このアプリは公式サービスの代替ではなく、分析・投票・記録・振り返りのための共有 UI です。
                  </p>
                </div>
                <p className="max-w-xl text-slate-500">
                  購入や利用は各自の責任で行い、金銭の受け渡し・代理購入・配当分配・精算は扱いません。
                </p>
              </div>
            </div>
          </footer>
        </div>
      </body>
    </html>
  );
}
