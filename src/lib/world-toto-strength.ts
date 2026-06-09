/**
 * W杯toto の「軽量モデルシード」（純粋・保存層非依存）。
 *
 * 各試合のモデル材料（market 確率）を決める:
 *  - 公式人気（officialVote）が揃っていれば、それを市場確率として使う。
 *  - 無ければ「国別強度モデル」（teamStrengthByName）の強度差から推定する。
 *
 * ここで作った market 確率を `calculateModelProbabilities`（probability/engine）に渡すと、
 * W杯らしいモデル本命が出る。/hazi 軽量ページ（hazi-lite-local）と共有D1の featured
 * 取り込み（featured-world-toto-d1）の両方が同じモデルを使えるよう、ここに集約する。
 */

export const teamStrengthByName: Record<string, number> = {
  "アイスランド": 74,
  "アルジェリア": 78,
  "アルゼンチン": 96,
  "イングランド": 93,
  "ウズベキスタン": 73,
  "ウルグアイ": 87,
  "エクアドル": 82,
  "エジプト": 80,
  "オーストラリア": 77,
  "オーストリア": 83,
  "オランダ": 91,
  "カーボベルデ": 70,
  "カタール": 72,
  "カナダ": 77,
  "ガーナ": 79,
  "キュラソー": 67,
  "クロアチア": 86,
  "コロンビア": 86,
  "コンゴ民主共和国": 72,
  "コートジボワール": 80,
  "サウジアラビア": 72,
  "スイス": 84,
  "スウェーデン": 82,
  "スコットランド": 78,
  "スペイン": 94,
  "セネガル": 83,
  "チュニジア": 76,
  "チェコ": 79,
  "チリ": 76,
  "ドイツ": 90,
  "ニュージーランド": 67,
  "日本": 83,
  "ノルウェー": 80,
  "ハイチ": 66,
  "パナマ": 70,
  "パラグアイ": 77,
  "ブラジル": 94,
  "フランス": 95,
  "ベルギー": 88,
  "ボスニア": 75,
  "ボスニア・ヘルツェゴビナ": 75,
  "ポルトガル": 92,
  "南アフリカ": 72,
  "メキシコ": 81,
  "モロッコ": 84,
  "ヨルダン": 69,
  "韓国": 80,
};

export function teamStrength(teamName: string) {
  return teamStrengthByName[teamName] ?? 75;
}

export function teamStrengthPrior(input: { awayTeam: string; homeTeam: string }) {
  const homeStrength = teamStrength(input.homeTeam);
  const awayStrength = teamStrength(input.awayTeam);
  const diff = homeStrength - awayStrength;
  const draw = Math.max(0.19, Math.min(0.31, 0.29 - Math.abs(diff) * 0.003));
  const homeShare = 1 / (1 + Math.exp(-diff / 10));
  const winMass = 1 - draw;

  return {
    modelRationale: `${input.homeTeam} ${homeStrength} / ${input.awayTeam} ${awayStrength} の国別強度差から軽量推定。`,
    modelSource: "team_strength" as const,
    marketProb0: draw,
    marketProb1: winMass * homeShare,
    marketProb2: winMass * (1 - homeShare),
  };
}

export function modelSeed(input: {
  awayTeam: string;
  homeTeam: string;
  officialVote0: number | null;
  officialVote1: number | null;
  officialVote2: number | null;
}) {
  const hasOfficialVote =
    input.officialVote1 !== null &&
    input.officialVote0 !== null &&
    input.officialVote2 !== null;

  if (hasOfficialVote) {
    return {
      modelRationale: "公式人気を市場確率として軽量推定。",
      modelSource: "official_vote" as const,
      marketProb0: input.officialVote0,
      marketProb1: input.officialVote1,
      marketProb2: input.officialVote2,
    };
  }

  return teamStrengthPrior(input);
}
