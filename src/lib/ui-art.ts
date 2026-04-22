import type { CandidateStrategyType } from "@/lib/types";

type CardArt = {
  accentLabel: string;
  description: string;
  src: string;
};

type BoardHeroArt = {
  accentLabel: string;
  description: string;
  src: string;
  title: string;
};

export const candidateStrategyArt: Record<CandidateStrategyType, CardArt> = {
  orthodox_model: {
    accentLabel: "王道ライン",
    description: "芝のセンターラインと安定した光で、本線らしさを出す背景です。",
    src: "/art/strategies/orthodox-model.webp",
  },
  public_favorite: {
    accentLabel: "人気比較",
    description: "人気の集まりをスコアパネル風に見せる背景です。",
    src: "/art/strategies/public-favorite.svg",
  },
  human_consensus: {
    accentLabel: "みんなの声",
    description: "手書きメモと付箋の雰囲気を軽く混ぜた背景です。",
    src: "/art/strategies/human-consensus.webp",
  },
  ev_hunter: {
    accentLabel: "差分サーチ",
    description: "光るレーダーとラインで、期待値探しの雰囲気を出す背景です。",
    src: "/art/strategies/ev-hunter.webp",
  },
  sleeping_value: {
    accentLabel: "人気薄チェック",
    description: "静かな暗色の中に細い光を置いた、人気薄向けの背景です。",
    src: "/art/strategies/sleeping-value.svg",
  },
  draw_alert: {
    accentLabel: "引分警報",
    description: "均衡した2色の帯と青い警報光で、引き分け寄りを表します。",
    src: "/art/strategies/draw-alert.webp",
  },
  upset: {
    accentLabel: "波乱シグナル",
    description: "斜めのスピード線と強めの差し色で、荒れ筋を表します。",
    src: "/art/strategies/upset.svg",
  },
};

export const demoLabArt = {
  description: "流れを見るための体験用デモ。最初の一周を楽しく見せるためのバナーです。",
  src: "/art/banners/demo-lab.webp",
  title: "体験モード",
};

export const boardHeroArt: Record<"big" | "goal3" | "winner", BoardHeroArt> = {
  big: {
    accentLabel: "BIGウォッチ",
    description: "売上とキャリーを見ながら、平時か要確認回かをざっくり見分けるバナーです。",
    src: "/art/banners/big-watch.webp",
    title: "高還元イベントをすばやく確認",
  },
  goal3: {
    accentLabel: "GOAL3ボード",
    description: "6チーム x 0 / 1 / 2 / 3+ の人気分布を、別ボードで軽く追うためのバナーです。",
    src: "/art/banners/goal3-board.webp",
    title: "GOAL3 は別ボードで見る",
  },
  winner: {
    accentLabel: "WINNERボード",
    description: "1試合の 1 / 0 / 2 を、公式人気との差で見比べるためのバナーです。",
    src: "/art/banners/winner-board.webp",
    title: "1試合の見どころを見やすく整理",
  },
};
