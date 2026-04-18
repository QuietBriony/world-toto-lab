import type { Metadata } from "next";
import { Badge, cx } from "@/components/ui";
import "./globals.css";

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
    <html lang="ja" className="h-full antialiased">
      <body className="min-h-full">
        <div className="relative isolate flex min-h-screen flex-col overflow-hidden">
          <div className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[34rem] bg-[radial-gradient(circle_at_top,rgba(20,184,166,0.18),transparent_45%),radial-gradient(circle_at_20%_25%,rgba(14,165,233,0.12),transparent_30%),radial-gradient(circle_at_80%_0%,rgba(251,191,36,0.16),transparent_28%)]" />
          <header className="sticky top-0 z-50 border-b border-white/60 bg-[#f7fbff]/88 backdrop-blur-xl">
            <div className="mx-auto flex w-full max-w-7xl flex-col gap-4 px-4 py-4 sm:px-6 lg:px-8">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
                <div className="space-y-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge tone="sky">World Cup Toto Dashboard</Badge>
                    <Badge tone="amber">Analysis Only</Badge>
                  </div>
                  <div>
                    <p className="text-xs font-medium uppercase tracking-[0.3em] text-teal-700/70">
                      World Toto Lab
                    </p>
                    <h1 className="text-2xl font-semibold tracking-tight text-slate-950 sm:text-3xl">
                      予想・分析・検証に集中するための共有ラボ
                    </h1>
                  </div>
                </div>
                <p className="max-w-xl text-sm leading-6 text-slate-600">
                  友人グループで W杯toto/WINNER の見立てを持ち寄り、
                  人力コンセンサスとモデル差分を振り返るための MVP です。
                </p>
              </div>

              <div
                className={cx(
                  "overflow-x-auto rounded-[24px] border border-white/80 bg-white/78 px-3 py-3",
                  "shadow-[0_24px_80px_-40px_rgba(15,23,42,0.35)]",
                )}
              >
                <div className="flex min-w-max gap-2">
                  {complianceNotes.map((note) => (
                    <span
                      key={note}
                      className="inline-flex items-center rounded-full border border-amber-200 bg-amber-50 px-3 py-1.5 text-xs font-medium text-amber-900"
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
            <div className="mx-auto flex w-full max-w-7xl flex-col gap-3 px-4 py-4 text-sm text-slate-600 sm:px-6 lg:px-8">
              <p>
                このアプリは公式サービスの代替ではなく、分析・投票・記録・振り返りのための共有 UI です。
              </p>
              <p className="text-slate-500">
                購入や利用は各自の責任で行い、金銭の受け渡し・代理購入・配当分配・精算は扱いません。
              </p>
            </div>
          </footer>
        </div>
      </body>
    </html>
  );
}
