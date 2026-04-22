import Link from "next/link";

import {
  Badge,
  CollapsibleSectionCard,
  cx,
  secondaryButtonClassName,
  SectionCard,
} from "@/components/ui";
import { appRoute } from "@/lib/round-links";
import { deriveRoundProgressSummary } from "@/lib/round-progress";
import type { HumanScoutReport, Match, Pick, User } from "@/lib/types";

type GuideRoute = (typeof appRoute)[keyof typeof appRoute];
type GuideTone = "amber" | "lime" | "rose" | "sky" | "slate" | "teal";

type GlossaryEntry = {
  body: string;
  term: string;
  tone: GuideTone;
};

const pageGuideMeta: Partial<
  Record<
    GuideRoute,
    {
      badge: string;
      description: string;
      summary: string;
      title: string;
    }
  >
> = {
  [appRoute.dashboard]: {
    badge: "初見向け",
    title: "用語と状態の見方",
    description: "最初だけ開けば十分です。ダッシュボードで出てくる言葉を短く揃えています。",
    summary: "本番とデモ、共有メンバーの状態を見分ける入口です。",
  },
  [appRoute.bigCarryover]: {
    badge: "運用向け",
    title: "BIGウォッチで見る言葉",
    description: "BIG は outcome を選ぶ画面ではないので、売上・キャリー・還元率だけに絞って短くまとめています。",
    summary: "高還元イベントかどうかを、ざっくり判定する段階です。",
  },
  [appRoute.goal3Value]: {
    badge: "別商品",
    title: "GOAL3 Value Board で見る言葉",
    description: "totoGOAL3 は 1/0/2 ではなく 6チームの得点帯を見るので、専用ボードで用語を分けています。",
    summary: "GOAL3 のイベント熱と、6チーム x 0/1/2/3+ の人気分布を見る段階です。",
  },
  [appRoute.workspace]: {
    badge: "全体像",
    title: "ラウンド詳細で見る言葉",
    description: "この画面は全体の土台と不足確認が役目です。迷ったら、まずここに戻れば大丈夫です。",
    summary: "全体の土台を整えながら、次に埋めるべき不足を確認する段階です。",
  },
  [appRoute.play]: {
    badge: "友人向け",
    title: "遊ぼうページで見る言葉",
    description: "友人向けの最小導線です。候補カードと自分の1 / 0 / 2入力だけを前に出しています。",
    summary: "難しい分析をしまって、どれにするかをポチポチ決める段階です。",
  },
  [appRoute.matchEditor]: {
    badge: "試合設定",
    title: "試合設定で見る言葉",
    description: "1試合ずつ整えるための用語です。数字の出どころを混同しないように短くまとめています。",
    summary: "試合ごとの基本情報と確率の土台を入れる段階です。",
  },
  [appRoute.picks]: {
    badge: "入力前",
    title: "支持 / 予想で見る言葉",
    description: "予想者とウォッチの役割をここで揃えておくと、入力がかなり速くなります。",
    summary: "予想者の予想とウォッチの支持先を揃える段階です。",
  },
  [appRoute.scoutCards]: {
    badge: "根拠整理",
    title: "予想者カードで見る言葉",
    description: "予想者がどう考えたかを残す画面です。例外や引き分け警戒の意味を先に揃えています。",
    summary: "予想者の根拠と例外を、後から読める形に残す段階です。",
  },
  [appRoute.consensus]: {
    badge: "差分確認",
    title: "コンセンサスで見る言葉",
    description: "AIと人力がどこで一致し、どこで別筋になったかを見るための短い辞書です。",
    summary: "モデル試算と人力ラインの差分を確認する段階です。",
  },
  [appRoute.edgeBoard]: {
    badge: "比較用",
    title: "優位ボードで見る言葉",
    description: "どの候補が強そうかを比べる画面です。スコア名をここで翻訳しています。",
    summary: "AI・予想者・ウォッチ支持を重ねて注目候補を絞る段階です。",
  },
  [appRoute.winnerValue]: {
    badge: "1試合向け",
    title: "WINNER Value Board で見る言葉",
    description: "1試合の 1 / 0 / 2 を、公式人気との差として読むための短い辞書です。",
    summary: "WINNER や 1試合回で、outcome ごとの差分を比較する段階です。",
  },
  [appRoute.ticketGenerator]: {
    badge: "初見向け",
    title: "候補配分で見る言葉",
    description: "初見なら『どれから見るかの順番表』と思えば十分です。用語を先に短く揃えています。",
    summary: "注目候補を、どの順番で確認するかに並べ替える段階です。",
  },
  [appRoute.review]: {
    badge: "締め",
    title: "振り返りで見る言葉",
    description: "結果入力と学びの切り分けをしやすくするため、見出しの意味を短く揃えています。",
    summary: "結果を埋めて、次回へ残す学びを整理する段階です。",
  },
  [appRoute.practiceLab]: {
    badge: "練習回",
    title: "練習ラボで見る言葉",
    description: "通常toto回や練習回を、W杯本番前の検証用として軽く振り返る画面です。",
    summary: "モデル・人気・人力がどこまで効いたかを確認する段階です。",
  },
};

const pageGlossaryEntries: Partial<Record<GuideRoute, GlossaryEntry[]>> = {
  [appRoute.dashboard]: [
    {
      term: "本番ラウンド",
      body: "実際に回す回です。共有メンバーの状態や入力件数は、基本ここを基準に見ます。",
      tone: "teal",
    },
    {
      term: "体験用デモ",
      body: "流れを試す専用枠です。本番の入力件数や共有メンバー集計には混ぜません。",
      tone: "sky",
    },
    {
      term: "予想者",
      body: "自分で 1 / 0 / 2 を入れて、人力ラインを作る人です。",
      tone: "teal",
    },
    {
      term: "ウォッチ",
      body: "自分で全部は予想せず、AIか予想者を支持して見る人です。",
      tone: "sky",
    },
    {
      term: "空きアカウント",
      body: "初期名のままで未入力の枠です。あとからあだ名を付けて使えます。",
      tone: "slate",
    },
    {
      term: "入力なし",
      body: "名前は付いているけれど、この本番回ではまだ直接入力がありません。",
      tone: "amber",
    },
    {
      term: "支持先で使用中",
      body: "本人の直接入力はないものの、誰かの支持先として参照されています。",
      tone: "lime",
    },
    {
      term: "入力あり",
      body: "この本番回で支持・予想・予想者カード・振り返りのどれかが入っています。",
      tone: "rose",
    },
  ],
  [appRoute.bigCarryover]: [
    {
      term: "概算EV",
      body: "還元率とキャリーから見た簡易期待値です。等級別配分まで再現する厳密値ではありません。",
      tone: "teal",
    },
    {
      term: "還元率からの上振れ",
      body: "平時の還元率から、キャリーがどれだけ上に押し上げているかです。",
      tone: "sky",
    },
    {
      term: "損益分岐",
      body: "概算EVが 100% に届く境目です。ここを超えると理論上はプラス圏です。",
      tone: "amber",
    },
    {
      term: "期待損益",
      body: "投下額に対して、簡易式で見た期待値ベースの損益です。ブレは大きい前提で見ます。",
      tone: "lime",
    },
  ],
  [appRoute.goal3Value]: [
    {
      term: "イベント期待値",
      body: "売上とキャリーから見た、その回全体のざっくり上振れです。選択肢ごとの厳密EVではありません。",
      tone: "teal",
    },
    {
      term: "6チーム x 0/1/2/3+",
      body: "3試合のホーム/アウェイ合計 6 チームについて、90分得点数の人気分布を見ます。",
      tone: "sky",
    },
    {
      term: "配当 proxy",
      body: "イベント期待値を公式投票率で割った参考値です。人気薄ほど大きく出ますが、的中確率モデルは別です。",
      tone: "amber",
    },
    {
      term: "要確認イベント",
      body: "キャリーや売上条件が分岐に近く、まず監視しておきたい回です。",
      tone: "rose",
    },
  ],
  [appRoute.workspace]: [
    {
      term: "参加メンバー",
      body: "この回で実際に使うメンバーです。共有名簿の全員ではありません。",
      tone: "teal",
    },
    {
      term: "次の一手",
      body: "この回で今いちばん先に埋めると進みやすい作業です。",
      tone: "sky",
    },
    {
      term: "試合設定",
      body: "キックオフ、人気、AI確率、メモなど、後続画面の土台になる情報です。",
      tone: "amber",
    },
    {
      term: "モデル試算",
      body: "必要な項目が揃った試合だけ、モデル試算を後からまとめて作れます。",
      tone: "lime",
    },
  ],
  [appRoute.play]: [
    {
      term: "遊ぼうページ",
      body: "候補カードと自分の 1 / 0 / 2 入力だけに絞った、友人向けの共有ページです。",
      tone: "teal",
    },
    {
      term: "王道 / 人力推し / EV狙い",
      body: "細かい分析語を減らした候補カードの並びです。まずはここから見ます。",
      tone: "sky",
    },
    {
      term: "自分の予想を入れる",
      body: "各試合を 1 / 0 / 2 で入れるだけの簡易入力です。",
      tone: "amber",
    },
    {
      term: "Advanced View",
      body: "もっと細かい分析や設定を見たい時だけ戻る先です。",
      tone: "slate",
    },
  ],
  [appRoute.matchEditor]: [
    {
      term: "公式人気",
      body: "toto公式の投票率です。一般人気の見え方として使います。",
      tone: "sky",
    },
    {
      term: "市場",
      body: "オッズなどから見た外部確率です。公式人気とズレが出ることがあります。",
      tone: "teal",
    },
    {
      term: "AI",
      body: "このアプリ側で基準線として扱う確率です。人力比較の土台になります。",
      tone: "amber",
    },
    {
      term: "カテゴリ",
      body: "固定寄り、逆張り候補、引き分け候補など、試合の扱い方メモです。",
      tone: "rose",
    },
  ],
  [appRoute.picks]: [
    {
      term: "1 / 0 / 2",
      body: "1 はホーム勝ち、0 は引き分け、2 はアウェイ勝ちです。",
      tone: "amber",
    },
    {
      term: "試算ライン",
      body: "共通 probability engine が先に出した叩き台です。予想者はここから上書きするかを見ます。",
      tone: "sky",
    },
    {
      term: "予想者",
      body: "自分で 1 / 0 / 2 を決める人です。支持先は使わず、直接予想します。",
      tone: "teal",
    },
    {
      term: "ウォッチ",
      body: "AIか予想者を支持して、採用結果を入れる人です。",
      tone: "sky",
    },
    {
      term: "支持先",
      body: "その試合で誰に乗るかです。AIか予想者を選ぶと、採用結果が入ります。",
      tone: "amber",
    },
    {
      term: "未保存",
      body: "画面上で変えただけの状態です。保存するまでは他画面へ反映されません。",
      tone: "rose",
    },
  ],
  [appRoute.scoutCards]: [
    {
      term: "予想者カード",
      body: "予想者がその試合をどう見たかを、後から読める形で残すメモです。",
      tone: "teal",
    },
    {
      term: "仮コール",
      body: "その時点での 1軸 / 2軸 / 0軸候補 / ダブル / トリプル の見立てです。",
      tone: "sky",
    },
    {
      term: "引き分け警戒",
      body: "0を少し強めに見た試合です。コンセンサス側でも拾いやすくなります。",
      tone: "lime",
    },
    {
      term: "例外フラグ",
      body: "通常ロジックだけでは拾いきれない違和感を残す目印です。",
      tone: "rose",
    },
  ],
  [appRoute.consensus]: [
    {
      term: "試算ライン",
      body: "モデル側が先に見ている本線です。人力ラインとの差分を見る起点になります。",
      tone: "teal",
    },
    {
      term: "人力コンセンサス",
      body: "予想者カードを平均して、人力側がどこを見ているかをまとめたものです。",
      tone: "sky",
    },
    {
      term: "0候補",
      body: "AIか人力のどちらかが引き分けを見ている状態です。",
      tone: "lime",
    },
    {
      term: "AIと別筋",
      body: "人力が AI と違う候補を強く見ている試合です。",
      tone: "rose",
    },
  ],
  [appRoute.edgeBoard]: [
    {
      term: "合成優位",
      body: "一般人気に対して、AI・予想者・ウォッチ支持を重ねた優位差です。",
      tone: "teal",
    },
    {
      term: "コア候補",
      body: "AI・予想者・ウォッチ支持が重なりやすい強めの候補です。",
      tone: "sky",
    },
    {
      term: "ダークホース",
      body: "人気は薄いのに、合成優位が出ている候補です。",
      tone: "amber",
    },
    {
      term: "ウォッチ支持",
      body: "ウォッチ側がどの候補に乗っているかの偏りです。",
      tone: "lime",
    },
  ],
  [appRoute.winnerValue]: [
    {
      term: "edge",
      body: "AIモデル確率と公式人気の差です。プラスなら、公式人気より上に見ている意味です。",
      tone: "teal",
    },
    {
      term: "valueRatio",
      body: "modelProb / officialVote です。1 を大きく超えるほど、人気に対してモデル側が強めに見ています。",
      tone: "sky",
    },
    {
      term: "人気過多",
      body: "公式人気は高いのに、モデル側がそこまで強く見ていない outcome です。",
      tone: "amber",
    },
    {
      term: "引分警報",
      body: "0 が人力やモデル上で相対的に浮いている試合です。",
      tone: "lime",
    },
  ],
  [appRoute.ticketGenerator]: [
    {
      term: "詳細候補配分",
      body: "Friend Pick Room より細かく、先に確認したい候補の並び順と理由を見る管理寄り画面です。",
      tone: "amber",
    },
    {
      term: "本線 / バランス / 荒れ狙い",
      body: "どの見方で候補を並べるかの違いです。最初はバランスで十分です。",
      tone: "teal",
    },
    {
      term: "理由タグ",
      body: "その候補を上に出した理由です。コア候補やダークホースを見ると雰囲気が掴めます。",
      tone: "sky",
    },
    {
      term: "全力プッシュ候補",
      body: "優位差がかなり強い試合です。まずここが入っている案から見ると速いです。",
      tone: "rose",
    },
  ],
  [appRoute.review]: [
    {
      term: "結果入力",
      body: "各試合の実結果です。ここが埋まると AI と人力の振り返りが揃います。",
      tone: "teal",
    },
    {
      term: "的中",
      body: "AI、人力、人気、詳細候補配分などが実結果を拾えたかの確認です。",
      tone: "sky",
    },
    {
      term: "AIと人力",
      body: "一致した時に強かったのか、対立した時に拾えたのかを見ます。",
      tone: "amber",
    },
    {
      term: "振り返りメモ",
      body: "次回も使いたい気づきを短く残す欄です。反省だけでなく再現したい型も含みます。",
      tone: "rose",
    },
  ],
  [appRoute.practiceLab]: [
    {
      term: "通常toto練習回",
      body: "W杯本番前のモデル検証、人力予想の練習、通常回の振り返りをする回です。",
      tone: "teal",
    },
    {
      term: "モデル最大",
      body: "モデルが最も高く見た outcome が、どれだけ結果を拾えたかです。",
      tone: "sky",
    },
    {
      term: "公式人気最大",
      body: "公式人気の最大 outcome が、どれだけ結果を拾えたかです。",
      tone: "amber",
    },
    {
      term: "引き分け警報",
      body: "引き分け寄りシグナルが出た試合が、実際に 0 になったかを見る指標です。",
      tone: "rose",
    },
  ],
};

const routeLabel: Partial<Record<GuideRoute, string>> = {
  [appRoute.workspace]: "ラウンド詳細",
  [appRoute.play]: "遊ぼうページ",
  [appRoute.bigCarryover]: "BIGウォッチ",
  [appRoute.goal3Value]: "GOAL3 Value Board",
  [appRoute.matchEditor]: "試合設定",
  [appRoute.picks]: "支持 / 予想",
  [appRoute.scoutCards]: "予想者カード",
  [appRoute.consensus]: "コンセンサス",
  [appRoute.edgeBoard]: "優位ボード",
  [appRoute.ticketGenerator]: "詳細候補配分",
  [appRoute.review]: "振り返り",
  [appRoute.practiceLab]: "練習ラボ",
};

function toneBarClassName(tone: GuideTone) {
  if (tone === "amber") {
    return "bg-amber-400";
  }

  if (tone === "lime") {
    return "bg-lime-400";
  }

  if (tone === "rose") {
    return "bg-rose-400";
  }

  if (tone === "sky") {
    return "bg-sky-400";
  }

  if (tone === "teal") {
    return "bg-emerald-500";
  }

  return "bg-slate-300";
}

function ratioLabel(done: number, total: number) {
  return total > 0 ? `${done}/${total}` : "未設定";
}

function clampRatio(value: number) {
  if (!Number.isFinite(value)) {
    return 0;
  }

  return Math.min(Math.max(value, 0), 1);
}

function routePathFromHref(href: string) {
  return href.split("#")[0].split("?")[0];
}

export function RouteGlossaryCard({
  currentPath,
  defaultOpen = false,
}: {
  currentPath: GuideRoute;
  defaultOpen?: boolean;
}) {
  const meta = pageGuideMeta[currentPath];
  const entries = pageGlossaryEntries[currentPath];

  if (!meta || !entries || entries.length === 0) {
    return null;
  }

  return (
    <CollapsibleSectionCard
      title={meta.title}
      description={meta.description}
      defaultOpen={defaultOpen}
      badge={<Badge tone="sky">{meta.badge}</Badge>}
    >
      <div className="grid gap-3 lg:grid-cols-2 xl:grid-cols-4">
        {entries.map((entry) => (
          <div
            key={`${currentPath}-${entry.term}`}
            className="rounded-[22px] border border-white/80 bg-white/76 p-4 shadow-[0_16px_38px_-30px_rgba(15,23,42,0.4)]"
          >
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone={entry.tone}>{entry.term}</Badge>
            </div>
            <p className="mt-3 text-sm leading-6 text-slate-600">{entry.body}</p>
          </div>
        ))}
      </div>
    </CollapsibleSectionCard>
  );
}

export function RoundProgressCallout({
  currentPath,
  matches,
  picks,
  roundId,
  scoutReports,
  users,
}: {
  currentPath: GuideRoute;
  matches: Match[];
  picks: Pick[];
  roundId: string;
  scoutReports: HumanScoutReport[];
  users: User[];
}) {
  const meta = pageGuideMeta[currentPath];

  if (!meta) {
    return null;
  }

  const progress = deriveRoundProgressSummary({
    matches,
    picks,
    roundId,
    scoutReports,
    users,
  });

  const matchCount = matches.length;
  const steps = [
    {
      body:
        matchCount > 0 && progress.configuredMatches < matchCount
          ? `あと ${matchCount - progress.configuredMatches} 試合`
          : "土台は揃っています",
      done: progress.configuredMatches,
      label: "試合設定",
      progress: progress.setupCompletion,
      total: matchCount,
      tone: "amber" as const,
    },
    {
      body:
        progress.expectedPickEntries > 0 && progress.missingPickEntries > 0
          ? `あと ${progress.missingPickEntries} 件`
          : "支持 / 予想は揃っています",
      done: progress.expectedPickEntries - progress.missingPickEntries,
      label: "支持 / 予想",
      progress: progress.pickCompletion,
      total: progress.expectedPickEntries,
      tone: "sky" as const,
    },
    {
      body:
        progress.expectedScoutEntries > 0 && progress.missingScoutEntries > 0
          ? `あと ${progress.missingScoutEntries} 件`
          : progress.expectedScoutEntries > 0
            ? "予想者カードは揃っています"
            : "予想者がいません",
      done: progress.expectedScoutEntries - progress.missingScoutEntries,
      label: "予想者カード",
      progress: progress.scoutCompletion,
      total: progress.expectedScoutEntries,
      tone: "teal" as const,
    },
    {
      body:
        matchCount > 0 && progress.missingResultCount > 0
          ? `あと ${progress.missingResultCount} 試合`
          : "結果入力まで完了しています",
      done: matchCount - progress.missingResultCount,
      label: "結果 / 振り返り",
      progress: progress.resultCompletion,
      total: matchCount,
      tone: "rose" as const,
    },
  ];

  const nextStepOnCurrentPage = routePathFromHref(progress.nextStep.href) === currentPath;

  return (
    <SectionCard
      title="今どこまで進んだか"
      description={meta.summary}
      actions={
        nextStepOnCurrentPage ? (
          <Badge tone={progress.nextStep.tone}>この画面で続ける</Badge>
        ) : (
          <Link href={progress.nextStep.href} className={secondaryButtonClassName}>
            次は {progress.nextStep.label}
          </Link>
        )
      }
    >
      <div className="flex flex-wrap items-center gap-2">
        <Badge tone="slate">現在地 {routeLabel[currentPath] ?? "ラウンド画面"}</Badge>
        <Badge tone="teal">予想者 {progress.predictorCount}</Badge>
        <Badge tone="sky">ウォッチ {progress.watcherCount}</Badge>
        <Badge tone={progress.nextStep.tone}>今やること {progress.nextStep.label}</Badge>
      </div>

      <div className="rounded-[24px] border border-emerald-200 bg-[linear-gradient(145deg,rgba(236,253,245,0.94),rgba(239,246,255,0.92))] p-5 shadow-[0_24px_60px_-40px_rgba(15,23,42,0.45)]">
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone={progress.nextStep.tone}>次の一手</Badge>
          <p className="text-sm font-semibold text-slate-900">{progress.nextStep.label}</p>
        </div>
        <p className="mt-3 text-sm leading-6 text-slate-700">{progress.nextStep.description}</p>
      </div>

      <div className="grid gap-4 xl:grid-cols-4">
        {steps.map((step) => (
          <div
            key={`${currentPath}-${step.label}`}
            className="rounded-[24px] border border-white/80 bg-white/82 p-4 shadow-[0_20px_48px_-38px_rgba(15,23,42,0.36)]"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                  {step.label}
                </p>
                <p className="mt-2 font-display text-[1.6rem] font-semibold tracking-[-0.06em] text-slate-950">
                  {ratioLabel(step.done, step.total)}
                </p>
              </div>
              <Badge tone={step.tone}>{Math.round(clampRatio(step.progress) * 100)}%</Badge>
            </div>
            <p className="mt-3 text-sm leading-6 text-slate-600">{step.body}</p>
            <div className="mt-4 h-2 overflow-hidden rounded-full bg-slate-100">
              <div
                className={cx("h-full rounded-full transition-all", toneBarClassName(step.tone))}
                style={{ width: `${Math.round(clampRatio(step.progress) * 100)}%` }}
              />
            </div>
          </div>
        ))}
      </div>
    </SectionCard>
  );
}
