import type { CandidateStrategyType } from "@/lib/types";
import { appRoute } from "@/lib/round-links";

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

type EmptyStateArt = {
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
    src: "/art/strategies/public-favorite.webp",
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
    src: "/art/strategies/sleeping-value.webp",
  },
  draw_alert: {
    accentLabel: "引分警報",
    description: "均衡した2色の帯と青い警報光で、引き分け寄りを表します。",
    src: "/art/strategies/draw-alert.webp",
  },
  upset: {
    accentLabel: "波乱シグナル",
    description: "斜めのスピード線と強めの差し色で、荒れ筋を表します。",
    src: "/art/strategies/upset.webp",
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

export const emptyStateArt: Record<"bigWatch", EmptyStateArt> = {
  bigWatch: {
    accentLabel: "BIGウォッチ",
    description: "まだ公式 snapshot がない時も、次の更新待ちと比較テンプレを見分けやすくする空状態バナーです。",
    src: "/art/banners/big-empty.webp",
    title: "いまは次の更新を待ちながら比べる",
  },
};

function trimTrailingSlash(pathname: string) {
  if (pathname.length > 1 && pathname.endsWith("/")) {
    return pathname.slice(0, -1);
  }

  return pathname;
}

const routeBaseHints = Object.values(appRoute)
  .filter((route) => route !== "/")
  .map((route) => trimTrailingSlash(route))
  .sort((left, right) => right.length - left.length);

export function detectArtBasePath(pathname: string) {
  const normalizedPathname = trimTrailingSlash(pathname);

  if (!normalizedPathname || normalizedPathname === "/") {
    return "";
  }

  const matchedRoute = routeBaseHints.find(
    (route) =>
      normalizedPathname === route || normalizedPathname.endsWith(route),
  );

  if (!matchedRoute) {
    return normalizedPathname;
  }

  const routeIndex = normalizedPathname.lastIndexOf(matchedRoute);
  return routeIndex > 0 ? normalizedPathname.slice(0, routeIndex) : "";
}

function detectRuntimePathname(pathname: string) {
  if (typeof window === "undefined" || !window.location?.pathname) {
    return pathname;
  }

  const runtimePathname = trimTrailingSlash(window.location.pathname);

  if (!runtimePathname || runtimePathname === "/") {
    return pathname;
  }

  return runtimePathname;
}

export function resolveArtAsset(pathname: string, src: string) {
  if (!src || /^https?:\/\//.test(src) || src.startsWith("data:")) {
    return src;
  }

  const basePath = detectArtBasePath(detectRuntimePathname(pathname));

  if (src.startsWith("/")) {
    return `${basePath}${src}`;
  }

  return basePath ? `${basePath}/${src}` : `/${src}`;
}
