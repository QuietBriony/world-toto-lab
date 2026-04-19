"use client";

import { useEffect, useState, type FormEvent } from "react";

import {
  Badge,
  buttonClassName,
  CollapsibleSectionCard,
  fieldClassName,
  secondaryButtonClassName,
  textAreaClassName,
} from "@/components/ui";
import { stringValue } from "@/lib/forms";

type FeedbackScreen =
  | "consensus"
  | "dashboard"
  | "match-editor"
  | "other"
  | "picks"
  | "review"
  | "scout-cards"
  | "workspace";

type FeedbackEntry = {
  createdAt: string;
  id: string;
  screen: FeedbackScreen;
  suggestion: string;
  wantedAction: string;
};

const storageKey = "world-toto-lab.feedback-board.v1";
const storageEventName = "world-toto-lab-feedback-updated";

const screenLabel: Record<FeedbackScreen, string> = {
  consensus: "コンセンサス",
  dashboard: "ダッシュボード",
  "match-editor": "試合編集",
  other: "その他",
  picks: "人力予想",
  review: "振り返り",
  "scout-cards": "根拠カード",
  workspace: "ラウンド詳細",
};

function readEntries() {
  if (typeof window === "undefined") {
    return [] as FeedbackEntry[];
  }

  try {
    const raw = window.localStorage.getItem(storageKey);
    if (!raw) {
      return [];
    }

    const parsed = JSON.parse(raw) as FeedbackEntry[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeEntries(entries: FeedbackEntry[]) {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(storageKey, JSON.stringify(entries));
  window.dispatchEvent(new Event(storageEventName));
}

function subscribe(callback: () => void) {
  if (typeof window === "undefined") {
    return () => undefined;
  }

  const handler = () => callback();
  window.addEventListener("storage", handler);
  window.addEventListener(storageEventName, handler);

  return () => {
    window.removeEventListener("storage", handler);
    window.removeEventListener(storageEventName, handler);
  };
}

function formatCreatedAt(createdAt: string) {
  return new Date(createdAt).toLocaleString("ja-JP", {
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    month: "numeric",
  });
}

function copyText(entries: FeedbackEntry[]) {
  return entries
    .map((entry, index) => {
      const header = `${index + 1}. [${screenLabel[entry.screen]}] ${entry.suggestion}`;
      const meta = `   ${formatCreatedAt(entry.createdAt)} / やりたかったこと: ${entry.wantedAction}`;
      return `${header}\n${meta}`;
    })
    .join("\n");
}

export function FeedbackBoard() {
  const [entries, setEntries] = useState<FeedbackEntry[]>(() => readEntries());
  const [feedbackMessage, setFeedbackMessage] = useState<string | null>(null);
  const [copyMessage, setCopyMessage] = useState<string | null>(null);

  useEffect(() => {
    return subscribe(() => {
      setEntries(readEntries());
    });
  }, []);

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFeedbackMessage(null);
    setCopyMessage(null);

    const formData = new FormData(event.currentTarget);
    const wantedAction = stringValue(formData, "wantedAction");
    const suggestion = stringValue(formData, "suggestion");

    if (!wantedAction || !suggestion) {
      setFeedbackMessage("やりたかったことと改善メモを入れてください。");
      return;
    }

    const nextEntry: FeedbackEntry = {
      id:
        typeof crypto !== "undefined" && "randomUUID" in crypto
          ? crypto.randomUUID()
          : `${Date.now()}`,
      createdAt: new Date().toISOString(),
      screen: (stringValue(formData, "screen") as FeedbackScreen) || "dashboard",
      suggestion,
      wantedAction,
    };

    const nextEntries = [nextEntry, ...entries];
    setEntries(nextEntries);
    writeEntries(nextEntries);
    event.currentTarget.reset();
    setFeedbackMessage("このブラウザにメモを追加しました。");
  };

  const handleCopy = async () => {
    setFeedbackMessage(null);

    if (entries.length === 0) {
      setCopyMessage("まだメモがありません。");
      return;
    }

    if (!navigator.clipboard) {
      setCopyMessage("このブラウザではコピーに対応していません。");
      return;
    }

    try {
      await navigator.clipboard.writeText(copyText(entries));
      setCopyMessage("一覧をコピーしました。次の要望整理にそのまま使えます。");
    } catch {
      setCopyMessage("コピーに失敗しました。");
    }
  };

  const handleClear = () => {
    setCopyMessage(null);
    setFeedbackMessage(null);

    if (entries.length === 0) {
      return;
    }

    if (!window.confirm("このブラウザに保存した改善メモを全部消しますか？")) {
      return;
    }

    setEntries([]);
    writeEntries([]);
  };

  return (
    <CollapsibleSectionCard
      title="触ってみての改善メモ"
      description="一旦ここで締めたあとに、気づいたことを残しておける控えです。保存先はこのブラウザ内だけなので、最後にコピーして管理者へ渡します。"
      defaultOpen={false}
      badge={<Badge tone="rose">要望メモ</Badge>}
    >
      <div className="grid gap-5">
        <div className="grid gap-3 rounded-[24px] border border-sky-200 bg-sky-50/80 p-4 sm:grid-cols-3">
          {[
            {
              step: "01",
              title: "ここに入れる",
              body: "どこで詰まったかと、やりたかったことを短く残します。",
            },
            {
              step: "02",
              title: "一覧をコピー",
              body: "メモが溜まったら、一覧をまとめてコピーします。",
            },
            {
              step: "03",
              title: "管理者へ送る",
              body: "コピーした内容を、管理者やこの開発チャットへ貼って伝えます。",
            },
          ].map((item) => (
            <div
              key={item.step}
              className="rounded-[18px] border border-white/75 bg-white/82 p-4"
            >
              <div className="font-display text-[11px] uppercase tracking-[0.32em] text-sky-800/70">
                手順 {item.step}
              </div>
              <h3 className="mt-3 font-display text-lg font-semibold tracking-[-0.04em] text-slate-950">
                {item.title}
              </h3>
              <p className="mt-2 text-sm leading-6 text-slate-600">{item.body}</p>
            </div>
          ))}
        </div>

        <div className="grid gap-5 xl:grid-cols-[0.95fr_1.05fr]">
        <div className="rounded-[24px] border border-white/80 bg-white/78 p-5 shadow-[0_18px_44px_-30px_rgba(15,23,42,0.38)]">
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone="sky">入力</Badge>
            <h3 className="font-display text-lg font-semibold tracking-[-0.04em] text-slate-950">
              改善提案を残す
            </h3>
          </div>
          <p className="mt-3 text-sm leading-6 text-slate-600">
            触って詰まった場所と、本当はやりたかったことだけ残せば十分です。あとで一覧コピーして、そのまま次の要望にできます。
          </p>
          <form onSubmit={handleSubmit} className="mt-4 grid gap-3">
            <label className="grid gap-2 text-sm font-medium text-slate-700">
              どこで詰まった？
              <select name="screen" className={fieldClassName} defaultValue="dashboard">
                {Object.entries(screenLabel).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
            <label className="grid gap-2 text-sm font-medium text-slate-700">
              本当は何をしたかった？
              <input
                name="wantedAction"
                className={fieldClassName}
                placeholder="例: まずAI本線だけを一覧で見たかった"
              />
            </label>
            <label className="grid gap-2 text-sm font-medium text-slate-700">
              改善してほしいこと一言
              <textarea
                name="suggestion"
                className={textAreaClassName}
                placeholder="例: 保存ボタンは画面上にも置いてほしい"
              />
            </label>
            <div className="flex flex-wrap gap-2">
              <button type="submit" className={buttonClassName}>
                メモを追加
              </button>
              <button
                type="button"
                className={secondaryButtonClassName}
                onClick={() => void handleCopy()}
              >
                一覧をコピーして送る
              </button>
            </div>
            {feedbackMessage ? (
              <p className="text-sm text-emerald-700">{feedbackMessage}</p>
            ) : null}
            {copyMessage ? (
              <p className="text-sm text-slate-600">{copyMessage}</p>
            ) : null}
            <p className="text-sm leading-6 text-slate-500">
              コピー後は、管理者かこの開発チャットにそのまま貼り付けてください。
            </p>
          </form>
        </div>

        <div className="rounded-[24px] border border-slate-200 bg-slate-50/88 p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone="slate">控え</Badge>
              <h3 className="font-display text-lg font-semibold tracking-[-0.04em] text-slate-950">
                保存済みメモ
              </h3>
              <Badge tone="slate">{entries.length}件</Badge>
            </div>
            <button
              type="button"
              className={secondaryButtonClassName}
              onClick={handleClear}
            >
              全部消す
            </button>
          </div>

          {entries.length === 0 ? (
            <div className="mt-4 rounded-[20px] border border-dashed border-slate-300 bg-white/78 p-5 text-sm leading-7 text-slate-600">
              まだ改善メモはありません。いったん触って、気になったところを短く残していけば十分です。
            </div>
          ) : (
            <div className="mt-4 grid gap-3">
              {entries.map((entry) => (
                <article
                  key={entry.id}
                  className="rounded-[20px] border border-slate-200 bg-white/80 p-4"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge tone="slate">{screenLabel[entry.screen]}</Badge>
                    <span className="text-xs text-slate-500">
                      {formatCreatedAt(entry.createdAt)}
                    </span>
                  </div>
                  <div className="mt-3 rounded-[16px] border border-slate-200 bg-slate-50/84 p-3">
                    <div className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-500">
                      やりたかったこと
                    </div>
                    <p className="mt-2 text-sm leading-7 text-slate-700">{entry.wantedAction}</p>
                  </div>
                  <p className="mt-3 text-sm leading-7 text-slate-700">{entry.suggestion}</p>
                </article>
              ))}
            </div>
          )}

          <p className="mt-4 text-sm leading-6 text-slate-500">
            このメモ欄はブラウザ内保存だけです。共有保存や自動送信はしません。
          </p>
        </div>
      </div>
      </div>
    </CollapsibleSectionCard>
  );
}
