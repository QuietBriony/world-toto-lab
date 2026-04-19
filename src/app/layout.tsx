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
    default: "ワールドtotoラボ",
    template: "%s | ワールドtotoラボ",
  },
  description:
    "W杯toto/WINNERを友人グループで分析・投票・記録・振り返りするためのダッシュボード。",
  applicationName: "ワールドtotoラボ",
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
      <body className="min-h-full bg-[#081810]">
        <div className="relative isolate flex min-h-screen flex-col overflow-hidden">
          <div className="pointer-events-none absolute inset-0 -z-30 bg-[linear-gradient(180deg,#07130d_0%,#0a2116_18%,#0d321f_45%,#0b261a_100%)]" />
          <div className="pointer-events-none absolute inset-0 -z-20 bg-[repeating-linear-gradient(180deg,rgba(255,255,255,0.02)_0px,rgba(255,255,255,0.02)_38px,rgba(3,53,34,0.18)_38px,rgba(3,53,34,0.18)_76px)]" />
          <div className="pointer-events-none absolute inset-0 -z-20 bg-[radial-gradient(circle_at_top,rgba(250,204,21,0.12),transparent_18%),radial-gradient(circle_at_15%_18%,rgba(255,255,255,0.12),transparent_24%),radial-gradient(circle_at_85%_10%,rgba(56,189,248,0.12),transparent_20%)]" />
          <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(circle_at_center,transparent_0%,transparent_16%,rgba(255,255,255,0.08)_16.4%,rgba(255,255,255,0.08)_16.9%,transparent_17.2%),linear-gradient(90deg,transparent_49.7%,rgba(255,255,255,0.12)_49.8%,rgba(255,255,255,0.12)_50.2%,transparent_50.3%)] opacity-55" />
          <div className="pointer-events-none absolute inset-x-[8%] top-[8rem] -z-10 h-[40rem] rounded-[52px] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.06),rgba(255,255,255,0.01))] [mask-image:linear-gradient(180deg,rgba(0,0,0,0.9),transparent_92%)]" />
          <div className="pointer-events-none absolute left-1/2 top-[-10rem] -z-10 h-[26rem] w-[26rem] -translate-x-1/2 rounded-full bg-[radial-gradient(circle,rgba(250,204,21,0.18),rgba(250,204,21,0.03)_55%,transparent_70%)] blur-3xl" />
          <div className="pointer-events-none absolute right-[-8rem] top-[12rem] -z-10 h-[18rem] w-[18rem] rounded-full bg-[radial-gradient(circle,rgba(34,197,94,0.2),rgba(34,197,94,0.02)_68%)] blur-3xl" />
          <header className="sticky top-0 z-50 border-b border-white/10 bg-[rgba(7,19,13,0.62)] backdrop-blur-2xl">
            <div className="mx-auto flex w-full max-w-7xl flex-col gap-4 px-4 py-4 sm:px-6 lg:px-8">
              <div className="flex flex-col gap-4 rounded-[28px] border border-white/12 bg-[linear-gradient(135deg,rgba(6,24,16,0.88),rgba(12,48,31,0.86))] px-4 py-4 shadow-[0_30px_90px_-48px_rgba(0,0,0,0.7)] ring-1 ring-white/5 lg:flex-row lg:items-end lg:justify-between">
                <div className="space-y-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge tone="teal">試合ラボ</Badge>
                    <Badge tone="amber">toto分析</Badge>
                    <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/6 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.28em] text-emerald-50/78">
                      共有MVP
                    </span>
                  </div>
                  <div className="grid gap-3 lg:grid-cols-[auto_1fr] lg:items-end">
                    <div className="relative flex h-16 w-16 items-center justify-center overflow-hidden rounded-[20px] border border-emerald-200/20 bg-[linear-gradient(180deg,rgba(8,32,20,0.95),rgba(10,60,34,0.96))] font-display text-xl font-bold text-white shadow-[0_24px_70px_-38px_rgba(0,0,0,0.9)] before:absolute before:inset-[10px] before:rounded-[14px] before:border before:border-white/35 before:content-[''] after:absolute after:left-1/2 after:top-[10px] after:h-[calc(100%-20px)] after:w-px after:-translate-x-1/2 after:bg-white/30 after:content-['']">
                      <span className="relative z-10">WT</span>
                    </div>
                    <div>
                      <p className="font-display text-[11px] font-medium uppercase tracking-[0.4em] text-emerald-100/62">
                        ワールドtotoラボ
                      </p>
                      <h1 className="max-w-3xl text-2xl font-semibold tracking-[-0.04em] text-white sm:text-3xl lg:text-[2.25rem]">
                        予想票と試合感を並べて読む、
                        <br className="hidden sm:block" />
                        サッカーtotoの共有ラボ
                      </h1>
                    </div>
                  </div>
                </div>
                <div className="grid gap-3 lg:max-w-xl lg:grid-cols-[1fr_auto] lg:items-end">
                  <p className="text-sm leading-6 text-emerald-50/78">
                    友人グループで W杯toto/WINNER の見立てを持ち寄り、
                    人力コンセンサスとモデル優位差を振り返るための MVP です。
                  </p>
                  <div className="rounded-[20px] border border-white/12 bg-[linear-gradient(180deg,rgba(2,8,6,0.88),rgba(12,19,14,0.94))] px-4 py-3 text-right shadow-[0_20px_50px_-36px_rgba(0,0,0,0.8)]">
                    <div className="font-display text-[11px] uppercase tracking-[0.32em] text-emerald-100/52">
                      進行メモ
                    </div>
                    <div className="font-display text-xl font-semibold tracking-[-0.05em] text-white">
                      13試合
                    </div>
                    <div className="mt-1 font-mono text-xs uppercase tracking-[0.22em] text-amber-300/88">
                      AI基準線 / 人力上書き
                    </div>
                  </div>
                </div>
              </div>

              <div
                className={cx(
                  "overflow-x-auto rounded-[24px] border border-white/12 bg-[linear-gradient(135deg,rgba(33,15,4,0.88),rgba(87,48,12,0.78))] px-3 py-3",
                  "shadow-[0_24px_80px_-40px_rgba(0,0,0,0.55)]",
                )}
              >
                <div className="flex min-w-max gap-2">
                  {complianceNotes.map((note) => (
                    <span
                      key={note}
                      className="inline-flex items-center rounded-full border border-amber-300/25 bg-white/8 px-3 py-1.5 text-xs font-medium text-amber-50 shadow-[0_10px_24px_-22px_rgba(120,53,15,0.95)]"
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

          <footer className="border-t border-white/10 bg-[rgba(5,16,11,0.88)]">
            <div className="mx-auto flex w-full max-w-7xl flex-col gap-3 px-4 py-5 text-sm text-slate-600 sm:px-6 lg:px-8">
              <div className="flex flex-col gap-4 rounded-[26px] border border-white/12 bg-[linear-gradient(135deg,rgba(6,24,16,0.84),rgba(15,40,29,0.86))] px-5 py-4 shadow-[0_24px_80px_-46px_rgba(0,0,0,0.6)] sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <div className="font-display text-[11px] uppercase tracking-[0.38em] text-emerald-100/52">
                    共有利用時の注意
                  </div>
                  <p className="mt-2 max-w-2xl leading-6 text-emerald-50/74">
                    このアプリは公式サービスの代替ではなく、分析・投票・記録・振り返りのための共有 UI です。
                  </p>
                </div>
                <p className="max-w-xl text-emerald-50/56">
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
