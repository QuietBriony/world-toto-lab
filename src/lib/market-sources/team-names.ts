/**
 * チーム名の正規化と EN↔JA マッチング。
 *
 * Hyperliquid / Polymarket の slug は英語（例: "france"）だが、本アプリの試合
 * （match.homeTeam / awayTeam）や強度モデル（world-toto-strength）は日本語名
 * （例: "フランス"）を使う。上流シグナルを個別試合へ紐づけるには、英語名と
 * 日本語名を同一チームとして照合できる必要がある。
 *
 * ここでは「別名（alias）→ 正規英語名」の索引を作り、任意の表記同士が同じチームを
 * 指すかを判定できるようにする。strength テーブルに載っている代表チームを網羅する。
 */

type TeamEntry = {
  /** 正規英語名（表示・照合の基準）。 */
  en: string;
  /** 本アプリの日本語名（strength テーブル等で使う表記）。 */
  ja: string;
  /** その他の別名（英語表記ゆれなど）。 */
  aliases?: string[];
};

const TEAMS: readonly TeamEntry[] = [
  { en: "France", ja: "フランス" },
  { en: "Argentina", ja: "アルゼンチン" },
  { en: "Brazil", ja: "ブラジル" },
  { en: "Spain", ja: "スペイン" },
  { en: "England", ja: "イングランド" },
  { en: "Portugal", ja: "ポルトガル" },
  { en: "Germany", ja: "ドイツ" },
  { en: "Netherlands", ja: "オランダ", aliases: ["holland"] },
  { en: "Belgium", ja: "ベルギー" },
  { en: "Croatia", ja: "クロアチア" },
  { en: "Uruguay", ja: "ウルグアイ" },
  { en: "Colombia", ja: "コロンビア" },
  { en: "Morocco", ja: "モロッコ" },
  { en: "Switzerland", ja: "スイス" },
  { en: "Senegal", ja: "セネガル" },
  { en: "Japan", ja: "日本" },
  { en: "Austria", ja: "オーストリア" },
  { en: "Sweden", ja: "スウェーデン" },
  { en: "Ecuador", ja: "エクアドル" },
  { en: "Mexico", ja: "メキシコ" },
  { en: "Ivory Coast", ja: "コートジボワール", aliases: ["cote divoire", "cote d ivoire"] },
  { en: "Egypt", ja: "エジプト" },
  { en: "Ghana", ja: "ガーナ" },
  { en: "Norway", ja: "ノルウェー" },
  { en: "Czechia", ja: "チェコ", aliases: ["czech republic", "czech"] },
  { en: "Scotland", ja: "スコットランド" },
  { en: "Algeria", ja: "アルジェリア" },
  { en: "Paraguay", ja: "パラグアイ" },
  { en: "Canada", ja: "カナダ" },
  { en: "Australia", ja: "オーストラリア" },
  { en: "Chile", ja: "チリ" },
  { en: "Tunisia", ja: "チュニジア" },
  { en: "South Africa", ja: "南アフリカ" },
  { en: "Saudi Arabia", ja: "サウジアラビア" },
  { en: "Qatar", ja: "カタール" },
  { en: "Bosnia and Herzegovina", ja: "ボスニア・ヘルツェゴビナ", aliases: ["bosnia"] },
  { en: "DR Congo", ja: "コンゴ民主共和国", aliases: ["congo dr", "democratic republic of congo", "congo"] },
  { en: "Uzbekistan", ja: "ウズベキスタン" },
  { en: "Iceland", ja: "アイスランド" },
  { en: "Cape Verde", ja: "カーボベルデ" },
  { en: "Curacao", ja: "キュラソー" },
  { en: "New Zealand", ja: "ニュージーランド" },
  { en: "Haiti", ja: "ハイチ" },
  { en: "Panama", ja: "パナマ" },
  { en: "Jordan", ja: "ヨルダン" },
  { en: "South Korea", ja: "韓国", aliases: ["korea republic", "korea", "republic of korea"] },
  // host / 追加の代表（strength テーブル外でも slug 照合に有用）
  { en: "United States", ja: "アメリカ", aliases: ["usa", "us", "america", "united states of america"] },
  { en: "Italy", ja: "イタリア" },
  { en: "Nigeria", ja: "ナイジェリア" },
  { en: "Cameroon", ja: "カメルーン" },
  { en: "Denmark", ja: "デンマーク" },
  { en: "Serbia", ja: "セルビア" },
  { en: "Poland", ja: "ポーランド" },
  { en: "Turkey", ja: "トルコ", aliases: ["turkiye"] },
];

function hasCjk(value: string): boolean {
  // ひらがな/カタカナ（中黒「・」含む）/CJK統合漢字/全角。
  return /[぀-ヿ㐀-鿿＀-￯]/.test(value);
}

function stripAccents(value: string): string {
  // ラテン文字の結合ダイアクリティカルマーク（U+0300–U+036F）を除去。
  return value.normalize("NFKD").replace(/[̀-ͯ]/g, "");
}

/**
 * 照合用キーへ正規化する。
 * - 日本語（CJK を含む）: trim のみ（NFKD で濁点が壊れるため触らない）。
 * - 英語など: 小文字化・アクセント除去・区切り（空白/ハイフン/アンダースコア）を空白に統一。
 */
export function normalizeTeamKey(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) {
    return "";
  }
  if (hasCjk(trimmed)) {
    return trimmed;
  }
  return stripAccents(trimmed)
    .toLowerCase()
    .replace(/[\s_\-.'’]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const aliasIndex: Map<string, string> = (() => {
  const index = new Map<string, string>();
  for (const team of TEAMS) {
    const keys = [team.en, team.ja, ...(team.aliases ?? [])];
    for (const key of keys) {
      const normalized = normalizeTeamKey(key);
      if (normalized) {
        index.set(normalized, team.en);
      }
      // 区切り無し版も登録（"southkorea" / "newzealand" 等の slug 連結に対応）。
      const condensed = normalized.replace(/\s+/g, "");
      if (condensed && condensed !== normalized) {
        index.set(condensed, team.en);
      }
    }
  }
  return index;
})();

/**
 * 任意のチーム表記から正規英語名を返す。未知なら null。
 * 例: canonicalTeamName("france") === "France"、canonicalTeamName("フランス") === "France"。
 */
export function canonicalTeamName(value: string | null | undefined): string | null {
  if (!value) {
    return null;
  }
  const normalized = normalizeTeamKey(value);
  if (!normalized) {
    return null;
  }
  return (
    aliasIndex.get(normalized) ??
    aliasIndex.get(normalized.replace(/\s+/g, "")) ??
    null
  );
}

/** 正規英語名 or 任意表記から、本アプリの日本語名を返す。未知なら null。 */
export function japaneseTeamName(value: string | null | undefined): string | null {
  const canonical = canonicalTeamName(value);
  if (!canonical) {
    return null;
  }
  return TEAMS.find((team) => team.en === canonical)?.ja ?? null;
}

/**
 * 2つのチーム表記が同一チームを指すか。
 * 既知チームは正規英語名で比較、未知同士は正規化キーで比較する。
 */
export function teamNameMatches(
  left: string | null | undefined,
  right: string | null | undefined,
): boolean {
  if (!left || !right) {
    return false;
  }
  const leftCanonical = canonicalTeamName(left);
  const rightCanonical = canonicalTeamName(right);
  if (leftCanonical && rightCanonical) {
    return leftCanonical === rightCanonical;
  }
  return normalizeTeamKey(left) === normalizeTeamKey(right);
}
