import {
  aiRecommendedOutcomes,
  computeDirectionScore,
  favoriteOutcomeForBucket,
  formatOutcomeSet,
  getEdge,
  getProbability,
  outcomeToEnum,
} from "@/lib/domain";
import { encodePickSupportNote } from "@/lib/pick-support";
import type { GeneratorSettings } from "@/lib/tickets";
import type { Match, MatchCategory, Outcome, ProvisionalCall, User } from "@/lib/types";

type DemoMatchSeed = {
  actualResult: Outcome;
  adminNote: string;
  awayTeam: string;
  category: MatchCategory;
  confidence: number;
  homeTeam: string;
  injuryNote: string;
  kickoffTime: string;
  marketProb0: number;
  marketProb1: number;
  marketProb2: number;
  matchNo: number;
  modelProb0: number;
  modelProb1: number;
  modelProb2: number;
  motivationNote: string;
  officialVote0: number;
  officialVote1: number;
  officialVote2: number;
  recommendedOutcomes: string;
  stage: string;
  tacticalNote: string;
  venue: string;
};

type DemoProfile = {
  drawLift: number;
  edgeTolerance: number;
  key:
    | "anchor"
    | "balanced"
    | "contrarian"
    | "draw"
    | "market_fade"
    | "secondary";
  label: string;
};

type DemoPickInsert = {
  match_id: string;
  note: string | null;
  pick: Outcome;
  round_id: string;
  user_id: string;
};

type DemoScoutReportInsert = {
  direction_score_f: number;
  draw_alert: number;
  exception_flag: boolean;
  exception_note: string | null;
  match_id: string;
  note_availability: string | null;
  note_conditions: string | null;
  note_draw_alert: string | null;
  note_micro: string | null;
  note_strength_form: string | null;
  note_tactical_matchup: string | null;
  provisional_call: ProvisionalCall;
  round_id: string;
  score_availability: number;
  score_conditions: number;
  score_micro: number;
  score_strength_form: number;
  score_tactical_matchup: number;
  user_id: string;
};

type DemoReviewNoteInsert = {
  match_id: string | null;
  note: string;
  round_id: string;
  user_id: string | null;
};

type DemoWatcherPlan = {
  note: string;
  support: { kind: "ai" } | { kind: "predictor"; userId: string };
  user: Pick<User, "id" | "name" | "role">;
};

export const demoRoundTitle = "デモ体験ラウンド";
export const demoRoundNotes =
  "チュートリアル用の仮ラウンドです。AI基準線、人力上書き、コンセンサス、優位差、候補配分、振り返りまで一通り入っています。金銭、配当、代理購入、精算は扱いません。";
export const legacyDemoRoundTitles = ["Demo Tour Round"] as const;

export const demoWalkthroughSteps = [
  {
    key: "overview",
    title: "確認カード",
    body: "AI基準線、人力上書き、優位差の大きい試合を最初にざっと見ます。",
  },
  {
    key: "picks",
    title: "支持 / 予想",
    body: "予想者が AI とどう違うか、ウォッチ担当がどちらに乗るかを実例で確認します。",
  },
  {
    key: "consensus",
    title: "コンセンサス",
    body: "全員の上書きが、0 候補や別筋にどう集まるかを見ます。",
  },
  {
    key: "review",
    title: "振り返り",
    body: "結果と反省ログまで見て、情報待ちカードの扱いを確認します。",
  },
] as const;

export const demoFocusMatches = [
  {
    matchNo: 1,
    label: "AI本線",
    title: "まず #1 で AI基準線を見る",
    body: "AI本線と人力一致が、いちばん素直に見える教材です。",
  },
  {
    matchNo: 2,
    label: "0追加",
    title: "#2 で引き分けを足す流れを見る",
    body: "AI が 0/2 を出している試合に、人力が 0 を重ねる見方を追えます。",
  },
  {
    matchNo: 5,
    label: "別筋",
    title: "#5 で人気と別筋を作る",
    body: "人気先行の 1 に対して、2 を差し込む読み替えの例です。",
  },
  {
    matchNo: 11,
    label: "情報待ち",
    title: "#11 で例外カードを見る",
    body: "広く持つ判断と、振り返りでの扱いがつながる試合です。",
  },
] as const;

export function isDemoRoundTitle(title: string | null | undefined) {
  return title === demoRoundTitle || legacyDemoRoundTitles.includes(title as (typeof legacyDemoRoundTitles)[number]);
}

export const demoTicketSettings: GeneratorSettings = {
  budgetYen: 2000,
  humanWeight: 0.68,
  includeDrawPolicy: "medium",
  maxContrarianMatches: 3,
};

const demoProfiles: DemoProfile[] = [
  { key: "anchor", label: "AI本線", drawLift: 0, edgeTolerance: 0.08 },
  { key: "balanced", label: "AI寄り", drawLift: 0, edgeTolerance: 0.05 },
  { key: "draw", label: "引き分け警戒", drawLift: 1, edgeTolerance: 0.04 },
  { key: "contrarian", label: "逆張り", drawLift: 0, edgeTolerance: 0.03 },
  { key: "secondary", label: "第2候補", drawLift: 0, edgeTolerance: 0.05 },
  { key: "market_fade", label: "人気読み替え", drawLift: 0, edgeTolerance: 0.04 },
];

const demoPredictorProfileIndexes = [0, 5] as const;

const demoMatchSeeds: DemoMatchSeed[] = [
  {
    matchNo: 1,
    homeTeam: "Japan",
    awayTeam: "Australia",
    kickoffTime: "2026-06-12T19:00:00+09:00",
    venue: "Saitama",
    stage: "グループステージ",
    officialVote1: 0.52,
    officialVote0: 0.24,
    officialVote2: 0.24,
    marketProb1: 0.5,
    marketProb0: 0.25,
    marketProb2: 0.25,
    modelProb1: 0.58,
    modelProb0: 0.22,
    modelProb2: 0.2,
    confidence: 0.82,
    category: "fixed",
    recommendedOutcomes: "1",
    tacticalNote: "Japan の内外可変と前進速度が効きやすい想定。",
    injuryNote: "主力の大きな離脱想定なし。",
    motivationNote: "初戦で主導権を取りたいカード。",
    adminNote: "AI本線を確認しやすいホーム寄りの例。",
    actualResult: "ONE",
  },
  {
    matchNo: 2,
    homeTeam: "Korea Republic",
    awayTeam: "Iran",
    kickoffTime: "2026-06-12T22:00:00+09:00",
    venue: "Osaka",
    stage: "グループステージ",
    officialVote1: 0.34,
    officialVote0: 0.29,
    officialVote2: 0.37,
    marketProb1: 0.33,
    marketProb0: 0.3,
    marketProb2: 0.37,
    modelProb1: 0.31,
    modelProb0: 0.34,
    modelProb2: 0.35,
    confidence: 0.64,
    category: "draw_candidate",
    recommendedOutcomes: "0,2",
    tacticalNote: "中盤の潰し合いでテンポが上がり切らない前提。",
    injuryNote: "前線のコンディション情報がやや読みにくい。",
    motivationNote: "勝点1でも許容しやすい組み合わせ。",
    adminNote: "0 を重ねるチュートリアル向け。",
    actualResult: "DRAW",
  },
  {
    matchNo: 3,
    homeTeam: "Spain",
    awayTeam: "Morocco",
    kickoffTime: "2026-06-13T01:00:00+09:00",
    venue: "Tokyo",
    stage: "グループステージ",
    officialVote1: 0.6,
    officialVote0: 0.21,
    officialVote2: 0.19,
    marketProb1: 0.57,
    marketProb0: 0.23,
    marketProb2: 0.2,
    modelProb1: 0.49,
    modelProb0: 0.25,
    modelProb2: 0.26,
    confidence: 0.66,
    category: "contrarian",
    recommendedOutcomes: "1,0",
    tacticalNote: "Spain 優位だが、Morocco の強度で押し返す時間も長い。",
    injuryNote: "Spain 側の最終ラインに軽い不安。",
    motivationNote: "人気先行を少し疑いたいカード。",
    adminNote: "人気過多の読み替え用。",
    actualResult: "DRAW",
  },
  {
    matchNo: 4,
    homeTeam: "Argentina",
    awayTeam: "United States",
    kickoffTime: "2026-06-13T10:00:00+09:00",
    venue: "Yokohama",
    stage: "グループステージ",
    officialVote1: 0.55,
    officialVote0: 0.23,
    officialVote2: 0.22,
    marketProb1: 0.53,
    marketProb0: 0.24,
    marketProb2: 0.23,
    modelProb1: 0.51,
    modelProb0: 0.23,
    modelProb2: 0.26,
    confidence: 0.71,
    category: "fixed",
    recommendedOutcomes: "1",
    tacticalNote: "Argentina の保持局面優位だが、US の推進力で一時的に振れる。",
    injuryNote: "アルゼンチンの前線ローテに注意。",
    motivationNote: "堅く1で寄せたいが 2 の穴も確認したい。",
    adminNote: "AI本線と人力逆張りの両方が出るようにした例。",
    actualResult: "ONE",
  },
  {
    matchNo: 5,
    homeTeam: "Germany",
    awayTeam: "Mexico",
    kickoffTime: "2026-06-13T13:00:00+09:00",
    venue: "Nagoya",
    stage: "グループステージ",
    officialVote1: 0.47,
    officialVote0: 0.25,
    officialVote2: 0.28,
    marketProb1: 0.45,
    marketProb0: 0.26,
    marketProb2: 0.29,
    modelProb1: 0.42,
    modelProb0: 0.25,
    modelProb2: 0.33,
    confidence: 0.62,
    category: "contrarian",
    recommendedOutcomes: "1,2",
    tacticalNote: "Mexico の遷移で Germany の高い位置の背後を突く想定。",
    injuryNote: "Germany 側のボランチ構成に流動性あり。",
    motivationNote: "1人気だが 2 の筋も厚めに確認したい。",
    adminNote: "AI の第2候補を人力が拾う例。",
    actualResult: "TWO",
  },
  {
    matchNo: 6,
    homeTeam: "Brazil",
    awayTeam: "Serbia",
    kickoffTime: "2026-06-13T16:00:00+09:00",
    venue: "Fukuoka",
    stage: "グループステージ",
    officialVote1: 0.64,
    officialVote0: 0.19,
    officialVote2: 0.17,
    marketProb1: 0.61,
    marketProb0: 0.2,
    marketProb2: 0.19,
    modelProb1: 0.57,
    modelProb0: 0.21,
    modelProb2: 0.22,
    confidence: 0.78,
    category: "fixed",
    recommendedOutcomes: "1",
    tacticalNote: "Brazil の個で押し切る筋が最も素直。",
    injuryNote: "Brazil 側の主力は概ね可動想定。",
    motivationNote: "大勢は 1 だが、人気過多かは確認。",
    adminNote: "AI本線の素直な例。",
    actualResult: "ONE",
  },
  {
    matchNo: 7,
    homeTeam: "France",
    awayTeam: "Denmark",
    kickoffTime: "2026-06-13T19:00:00+09:00",
    venue: "Sapporo",
    stage: "グループステージ",
    officialVote1: 0.46,
    officialVote0: 0.27,
    officialVote2: 0.27,
    marketProb1: 0.44,
    marketProb0: 0.28,
    marketProb2: 0.28,
    modelProb1: 0.4,
    modelProb0: 0.31,
    modelProb2: 0.29,
    confidence: 0.59,
    category: "draw_candidate",
    recommendedOutcomes: "1,0",
    tacticalNote: "互いの保持耐性が高く、先制後も開きにくい。",
    injuryNote: "France の前線起用は試合直前まで見たい。",
    motivationNote: "0 追加が説明しやすいカード。",
    adminNote: "AIに 0 を足す導線向け。",
    actualResult: "DRAW",
  },
  {
    matchNo: 8,
    homeTeam: "Netherlands",
    awayTeam: "Senegal",
    kickoffTime: "2026-06-13T22:00:00+09:00",
    venue: "Kobe",
    stage: "グループステージ",
    officialVote1: 0.49,
    officialVote0: 0.24,
    officialVote2: 0.27,
    marketProb1: 0.47,
    marketProb0: 0.24,
    marketProb2: 0.29,
    modelProb1: 0.43,
    modelProb0: 0.24,
    modelProb2: 0.33,
    confidence: 0.61,
    category: "contrarian",
    recommendedOutcomes: "1,2",
    tacticalNote: "Senegal のスプリント強度が終盤に効く前提。",
    injuryNote: "オランダの最終ラインに軽いローテ想定。",
    motivationNote: "1人気でも 2 の差し込みを残したい。",
    adminNote: "人力別筋の例。",
    actualResult: "TWO",
  },
  {
    matchNo: 9,
    homeTeam: "Portugal",
    awayTeam: "Uruguay",
    kickoffTime: "2026-06-14T01:00:00+09:00",
    venue: "Hiroshima",
    stage: "グループステージ",
    officialVote1: 0.38,
    officialVote0: 0.29,
    officialVote2: 0.33,
    marketProb1: 0.37,
    marketProb0: 0.3,
    marketProb2: 0.33,
    modelProb1: 0.35,
    modelProb0: 0.31,
    modelProb2: 0.34,
    confidence: 0.55,
    category: "draw_candidate",
    recommendedOutcomes: "0,1",
    tacticalNote: "中盤密度が高く、終盤まで引き締まる展開想定。",
    injuryNote: "両軍とも前線の組み合わせは直前確認。",
    motivationNote: "0 本線を置けるかを見る例。",
    adminNote: "振り返りで drawAlert を見返しやすい。",
    actualResult: "DRAW",
  },
  {
    matchNo: 10,
    homeTeam: "England",
    awayTeam: "Croatia",
    kickoffTime: "2026-06-14T10:00:00+09:00",
    venue: "Sendai",
    stage: "グループステージ",
    officialVote1: 0.51,
    officialVote0: 0.25,
    officialVote2: 0.24,
    marketProb1: 0.49,
    marketProb0: 0.26,
    marketProb2: 0.25,
    modelProb1: 0.47,
    modelProb0: 0.27,
    modelProb2: 0.26,
    confidence: 0.68,
    category: "fixed",
    recommendedOutcomes: "1",
    tacticalNote: "England のセットプレー優位をやや強めに評価。",
    injuryNote: "Croatia 側の運動量低下を警戒。",
    motivationNote: "ここは 1 本線が多くなるサンプル。",
    adminNote: "AIと人力一致が増える例。",
    actualResult: "ONE",
  },
  {
    matchNo: 11,
    homeTeam: "Belgium",
    awayTeam: "Croatia B",
    kickoffTime: "2026-06-14T13:00:00+09:00",
    venue: "Niigata",
    stage: "グループステージ",
    officialVote1: 0.41,
    officialVote0: 0.27,
    officialVote2: 0.32,
    marketProb1: 0.39,
    marketProb0: 0.28,
    marketProb2: 0.33,
    modelProb1: 0.36,
    modelProb0: 0.29,
    modelProb2: 0.35,
    confidence: 0.53,
    category: "info_wait",
    recommendedOutcomes: "1,0,2",
    tacticalNote: "両軍とも強みがぶつかり、情報待ちの色が濃い。",
    injuryNote: "先発想定に幅があるので直前確認前提。",
    motivationNote: "情報待ちのまま広く見る例。",
    adminNote: "info_wait と exception のサンプル。",
    actualResult: "TWO",
  },
  {
    matchNo: 12,
    homeTeam: "Colombia",
    awayTeam: "Poland",
    kickoffTime: "2026-06-14T16:00:00+09:00",
    venue: "Chiba",
    stage: "グループステージ",
    officialVote1: 0.43,
    officialVote0: 0.26,
    officialVote2: 0.31,
    marketProb1: 0.42,
    marketProb0: 0.26,
    marketProb2: 0.32,
    modelProb1: 0.46,
    modelProb0: 0.24,
    modelProb2: 0.3,
    confidence: 0.67,
    category: "fixed",
    recommendedOutcomes: "1",
    tacticalNote: "Colombia の前進パターンが噛み合う前提。",
    injuryNote: "Poland の守備陣の可動率はやや不安。",
    motivationNote: "終盤に向けて 1 優位を維持しやすい。",
    adminNote: "AI本線を人力が維持する例。",
    actualResult: "ONE",
  },
  {
    matchNo: 13,
    homeTeam: "Switzerland",
    awayTeam: "Cameroon",
    kickoffTime: "2026-06-14T19:00:00+09:00",
    venue: "Kyoto",
    stage: "グループステージ",
    officialVote1: 0.39,
    officialVote0: 0.28,
    officialVote2: 0.33,
    marketProb1: 0.38,
    marketProb0: 0.28,
    marketProb2: 0.34,
    modelProb1: 0.37,
    modelProb0: 0.3,
    modelProb2: 0.33,
    confidence: 0.57,
    category: "draw_candidate",
    recommendedOutcomes: "1,0",
    tacticalNote: "守備配置が整いやすく、1点勝負になりやすい。",
    injuryNote: "終盤のカード管理次第で流れが変わる。",
    motivationNote: "最後に 0 をどう扱うかが分かる例。",
    adminNote: "チュートリアルの締めに使いやすいカード。",
    actualResult: "DRAW",
  },
];

function profileForUser(userIndex: number) {
  return demoProfiles[userIndex % demoProfiles.length];
}

function shouldDraw(match: Match) {
  return (
    match.category === "draw_candidate" ||
    (match.modelProb0 ?? 0) >= 0.28 ||
    (match.officialVote0 ?? 0) >= 0.28
  );
}

function bestContrarianOutcome(match: Match) {
  const officialFavorite = favoriteOutcomeForBucket(match, "official");

  return (["1", "0", "2"] as const)
    .filter((outcome) => outcome !== officialFavorite)
    .map((outcome) => ({
      edge: getEdge(match, outcome) ?? Number.NEGATIVE_INFINITY,
      modelProbability: getProbability(match, "model", outcome) ?? 0,
      outcome,
    }))
    .sort((left, right) => {
      if (right.edge !== left.edge) {
        return right.edge - left.edge;
      }

      return right.modelProbability - left.modelProbability;
    })[0];
}

function pickOutcomeForProfile(match: Match, userIndex: number) {
  const profile = profileForUser(userIndex);
  const aiSet = aiRecommendedOutcomes(match);
  const aiPrimary = aiSet[0] ?? favoriteOutcomeForBucket(match, "model") ?? "1";
  const contrarian = bestContrarianOutcome(match);

  if (profile.key === "draw" && shouldDraw(match)) {
    return "0";
  }

  if (
    profile.key === "contrarian" &&
    contrarian &&
    (contrarian.edge >= profile.edgeTolerance || contrarian.modelProbability >= 0.3)
  ) {
    return contrarian.outcome;
  }

  if (
    profile.key === "market_fade" &&
    contrarian &&
    (contrarian.edge >= profile.edgeTolerance ||
      (contrarian.modelProbability >= 0.28 &&
        contrarian.outcome !== favoriteOutcomeForBucket(match, "official")))
  ) {
    return contrarian.outcome;
  }

  if (profile.key === "secondary" && aiSet[1]) {
    return aiSet[1];
  }

  if (profile.key === "balanced" && shouldDraw(match) && aiSet.includes("0")) {
    return "0";
  }

  return aiPrimary;
}

function directionBreakdown(directionScoreF: number) {
  const sign = Math.sign(directionScoreF);
  const absolute = Math.abs(directionScoreF);

  const positive =
    absolute >= 7
      ? [3, 2, 1, 1, 0]
      : absolute === 6
        ? [2, 2, 1, 1, 0]
        : absolute === 5
          ? [2, 1, 1, 1, 0]
          : absolute === 4
            ? [2, 1, 1, 0, 0]
            : absolute === 3
              ? [1, 1, 1, 0, 0]
              : absolute === 2
                ? [1, 1, 0, 0, 0]
                : absolute === 1
                  ? [1, 0, 0, 0, 0]
                  : [0, 0, 0, 0, 0];

  return {
    scoreAvailability: positive[1] * sign,
    scoreConditions: positive[2] * sign,
    scoreMicro: positive[4] * sign,
    scoreStrengthForm: positive[0] * sign,
    scoreTacticalMatchup: positive[3] * sign,
  };
}

function directionScoreForPick(match: Match, outcome: "1" | "0" | "2", userIndex: number) {
  const profile = profileForUser(userIndex);

  if (outcome === "0") {
    if (profile.key === "draw") {
      return 0;
    }

    return (match.matchNo + userIndex) % 2 === 0 ? 1 : -1;
  }

  const homeAwayGap = Math.abs((match.modelProb1 ?? 0) - (match.modelProb2 ?? 0));
  const raw = Math.round(homeAwayGap * 10) + (match.confidence !== null && match.confidence >= 0.72 ? 1 : 0);
  const tuned = Math.max(
    2,
    Math.min(7, raw + (profile.key === "contrarian" ? -1 : 0)),
  );

  return outcome === "1" ? tuned : -tuned;
}

function provisionalCallForOutcome(match: Match, outcome: "1" | "0" | "2") {
  if (outcome === "0") {
    return "draw_axis";
  }

  if (aiRecommendedOutcomes(match).length >= 2) {
    return "double";
  }

  return outcome === "1" ? "axis_1" : "axis_2";
}

function noteForOutcome(match: Match, outcome: "1" | "0" | "2") {
  if (outcome === "1") {
    return {
      availability: `${match.homeTeam} 側の主力可動率をプラス評価。`,
      conditions: `${match.homeTeam} 側に休養と移動面の軽い追い風。`,
      draw: shouldDraw(match)
        ? "終盤に膠着する筋は残るので 0 の保険も少し意識。"
        : "0 警戒は薄めでよいと見ています。",
      micro: `${match.homeTeam} のセットプレー期待値を小さく上乗せ。`,
      strengthForm: `${match.homeTeam} の直近内容と保持の安定感を上に取る。`,
      tactical: `${match.homeTeam} が相手の背後を取りやすい組み合わせ。`,
    };
  }

  if (outcome === "2") {
    return {
      availability: `${match.awayTeam} 側の先発強度を上に見ています。`,
      conditions: `${match.awayTeam} の遷移局面が開催条件と噛み合いそう。`,
      draw: shouldDraw(match)
        ? "長く均衡する可能性はあるが、終盤は 2 の刺さり筋を評価。"
        : "0 よりも 2 の一撃を強く見ています。",
      micro: `${match.awayTeam} の交代カードまで含めて上積みを評価。`,
      strengthForm: `${match.awayTeam} の直近強度と前進回数を高く評価。`,
      tactical: `${match.awayTeam} の遷移がこの相手には刺さりやすい。`,
    };
  }

  return {
    availability: "両軍の可動戦力差は大きく広がらない見立てです。",
    conditions: "移動や休養差が決定打になりにくいカードです。",
    draw: "引き分け警戒を強めに置いています。",
    micro: "終盤のカード管理で均衡が崩れにくい想定です。",
    strengthForm: "地力差はあるが、90分で決着差まで伸びにくいと見ています。",
    tactical: "互いの良さを消し合いやすく、試合が固まりやすい組み合わせ。",
  };
}

export function buildDemoMatchRows(roundId: string) {
  return demoMatchSeeds.map((match) => ({
    round_id: roundId,
    match_no: match.matchNo,
    home_team: match.homeTeam,
    away_team: match.awayTeam,
    kickoff_time: match.kickoffTime,
    venue: match.venue,
    stage: match.stage,
    official_vote_1: match.officialVote1,
    official_vote_0: match.officialVote0,
    official_vote_2: match.officialVote2,
    market_prob_1: match.marketProb1,
    market_prob_0: match.marketProb0,
    market_prob_2: match.marketProb2,
    model_prob_1: match.modelProb1,
    model_prob_0: match.modelProb0,
    model_prob_2: match.modelProb2,
    confidence: match.confidence,
    category: match.category,
    recommended_outcomes: match.recommendedOutcomes,
    tactical_note: match.tacticalNote,
    injury_note: match.injuryNote,
    motivation_note: match.motivationNote,
    admin_note: match.adminNote,
    actual_result: match.actualResult,
  }));
}

function demoAiPrimaryOutcome(match: Match) {
  return aiRecommendedOutcomes(match)[0] ?? favoriteOutcomeForBucket(match, "model") ?? "1";
}

export function buildDemoPickRows(
  roundId: string,
  matches: Match[],
  users: Array<Pick<User, "id" | "name" | "role">>,
) {
  const predictors = users.filter((user) => user.role === "admin").slice(0, 2);
  const watchers = users.filter((user) => user.role === "member").slice(0, 3);
  const rows: DemoPickInsert[] = [];
  const predictorPickByMatch = new Map<string, "1" | "0" | "2">();

  predictors.forEach((user, userIndex) => {
    const profileIndex = demoPredictorProfileIndexes[userIndex] ?? demoPredictorProfileIndexes[0];

    matches.forEach((match) => {
      const outcome = pickOutcomeForProfile(match, profileIndex);
      const aiSet = aiRecommendedOutcomes(match);
      const profile = profileForUser(profileIndex);
      predictorPickByMatch.set(`${match.id}:${user.id}`, outcome);

      rows.push({
        round_id: roundId,
        user_id: user.id,
        match_id: match.id,
        pick: outcomeToEnum(outcome),
        note: `AI ${formatOutcomeSet(aiSet)} を見たうえで ${profile.label} として ${outcome} を選択。`,
      });
    });
  });

  const primaryPredictor = predictors[0] ?? null;
  const secondaryPredictor = predictors[1] ?? primaryPredictor;
  const watcherPlans: DemoWatcherPlan[] = [];

  if (watchers[0]) {
    watcherPlans.push(
      primaryPredictor
        ? {
            note: `${primaryPredictor.name} のラインをそのまま支持。`,
            support: { kind: "predictor", userId: primaryPredictor.id },
            user: watchers[0],
          }
        : {
            note: "AI基準線をそのまま支持。",
            support: { kind: "ai" },
            user: watchers[0],
          },
    );
  }

  if (watchers[1]) {
    watcherPlans.push({
      note: "AI基準線をそのまま支持。",
      support: { kind: "ai" },
      user: watchers[1],
    });
  }

  if (watchers[2]) {
    watcherPlans.push(
      secondaryPredictor
        ? {
            note: `${secondaryPredictor.name} の別筋ラインを支持。`,
            support: { kind: "predictor", userId: secondaryPredictor.id },
            user: watchers[2],
          }
        : {
            note: "AI基準線を参考に支持。",
            support: { kind: "ai" },
            user: watchers[2],
          },
    );
  }

  watcherPlans.forEach((plan) => {
    matches.forEach((match) => {
      const supportedOutcome =
        plan.support.kind === "ai"
          ? demoAiPrimaryOutcome(match)
          : predictorPickByMatch.get(`${match.id}:${plan.support.userId}`) ?? demoAiPrimaryOutcome(match);

      rows.push({
        round_id: roundId,
        user_id: plan.user.id,
        match_id: match.id,
        pick: outcomeToEnum(supportedOutcome),
        note: encodePickSupportNote(plan.note, plan.support),
      });
    });
  });

  return rows;
}

export function buildDemoScoutReportRows(
  roundId: string,
  matches: Match[],
  userIds: string[],
) {
  const rows: DemoScoutReportInsert[] = [];

  userIds.forEach((userId, userIndex) => {
    const profileIndex = demoPredictorProfileIndexes[userIndex] ?? demoPredictorProfileIndexes[0];

    matches.forEach((match) => {
      const outcome = pickOutcomeForProfile(match, profileIndex);
      const directionScoreF = directionScoreForPick(match, outcome, profileIndex);
      const breakdown = directionBreakdown(directionScoreF);
      const drawAlert = Math.min(
        2,
        outcome === "0"
          ? 2
          : shouldDraw(match)
            ? 1 + profileForUser(profileIndex).drawLift
            : profileForUser(profileIndex).drawLift,
      );
      const notes = noteForOutcome(match, outcome);
      const exceptionFlag =
        match.category === "info_wait" ||
        (profileForUser(profileIndex).key === "contrarian" && match.category === "contrarian");

      rows.push({
        round_id: roundId,
        user_id: userId,
        match_id: match.id,
        score_strength_form: breakdown.scoreStrengthForm,
        note_strength_form: notes.strengthForm,
        score_availability: breakdown.scoreAvailability,
        note_availability: notes.availability,
        score_conditions: breakdown.scoreConditions,
        note_conditions: notes.conditions,
        score_tactical_matchup: breakdown.scoreTacticalMatchup,
        note_tactical_matchup: notes.tactical,
        score_micro: breakdown.scoreMicro,
        note_micro: notes.micro,
        draw_alert: drawAlert,
        note_draw_alert: notes.draw,
        direction_score_f: computeDirectionScore({
          scoreStrengthForm: breakdown.scoreStrengthForm,
          scoreAvailability: breakdown.scoreAvailability,
          scoreConditions: breakdown.scoreConditions,
          scoreTacticalMatchup: breakdown.scoreTacticalMatchup,
          scoreMicro: breakdown.scoreMicro,
        }),
        provisional_call: provisionalCallForOutcome(match, outcome),
        exception_flag: exceptionFlag,
        exception_note: exceptionFlag
          ? "情報待ちや逆張り要因が強く、例外カードとして残しています。"
          : null,
      });
    });
  });

  return rows;
}

export function buildDemoReviewNotes(
  roundId: string,
  matches: Match[],
  users: Array<Pick<User, "id" | "role">>,
) {
  const matchByNo = new Map(matches.map((match) => [match.matchNo, match]));
  const predictors = users.filter((user) => user.role === "admin");
  const watchers = users.filter((user) => user.role === "member");
  const reporterA = predictors[0]?.id ?? null;
  const reporterB = watchers[0]?.id ?? null;
  const reporterC = predictors[1]?.id ?? predictors[0]?.id ?? null;

  return [
    {
      round_id: roundId,
      match_id: matchByNo.get(2)?.id ?? null,
      user_id: reporterA,
      note: "AI が 0/2 を出している試合では、人力で 0 を足したメンバーの視点が振り返りでも効いていました。",
    },
    {
      round_id: roundId,
      match_id: matchByNo.get(5)?.id ?? null,
      user_id: reporterB,
      note: "人気先行の 1 に対して 2 を差し込んだ判断が刺さった例。AI基準線を見たうえで別筋を作る意義が分かります。",
    },
    {
      round_id: roundId,
      match_id: matchByNo.get(11)?.id ?? null,
      user_id: reporterC,
      note: "情報待ちは広く持つのが正解でした。デモでは例外フラグと振り返りのつながりを確認できます。",
    },
    {
      round_id: roundId,
      match_id: null,
      user_id: reporterA,
      note: "このデモラウンドは、AI基準線 -> 人力上書き -> コンセンサス -> 候補配分 -> 振り返り の順で触ると全体像が掴みやすいです。",
    },
  ] satisfies DemoReviewNoteInsert[];
}
