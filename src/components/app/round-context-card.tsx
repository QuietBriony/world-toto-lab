"use client";

import Link from "next/link";

import {
  buttonClassName,
  secondaryButtonClassName,
  SectionCard,
  StatCard,
  Badge,
} from "@/components/ui";
import { roundSourceLabel } from "@/lib/domain";
import { useRoundWorkspace } from "@/lib/use-app-data";

function countMatchesWithOfficialVotes(
  matches: Array<{
    officialVote0: number | null;
    officialVote1: number | null;
    officialVote2: number | null;
  }>,
) {
  return matches.filter(
    (match) =>
      match.officialVote1 !== null &&
      match.officialVote0 !== null &&
      match.officialVote2 !== null,
  ).length;
}

function countMatchesWithModelProbabilities(
  matches: Array<{
    modelProb0: number | null;
    modelProb1: number | null;
    modelProb2: number | null;
  }>,
) {
  return matches.filter(
    (match) =>
      match.modelProb1 !== null &&
      match.modelProb0 !== null &&
      match.modelProb2 !== null,
  ).length;
}

export function RoundContextCard({
  backHref,
  backLabel = "Round Detailへ戻る",
  description = "いま開いている導線が、どの Round に紐づいているかを最初に確認します。",
  roundId,
  title = "対象Round",
}: {
  backHref?: string | null;
  backLabel?: string;
  description?: string;
  roundId: string | null;
  title?: string;
}) {
  const { data, error, loading, refresh } = useRoundWorkspace(roundId);

  if (!roundId) {
    return (
      <SectionCard
        title={title}
        description={
          backHref
            ? "まだ特定の Round には紐づいていません。新規作成の導線としてこのまま進めて大丈夫です。既存 Round に戻りたいときだけ下のリンクを使ってください。"
            : "まだ特定の Round には紐づいていません。新規作成の導線としてこのまま進めて大丈夫です。"
        }
        actions={
          backHref ? (
            <Link href={backHref} className={secondaryButtonClassName}>
              {backLabel}
            </Link>
          ) : null
        }
      >
        <div className="flex flex-wrap gap-2">
          <Badge tone="slate">新規Round向け</Badge>
        </div>
      </SectionCard>
    );
  }

  if (loading && !data) {
    return (
      <SectionCard title={title} description="Round コンテキストを確認しています。">
        <div className="flex flex-wrap gap-2">
          <Badge tone="slate">Round ID {roundId}</Badge>
          <Badge tone="info">読み込み中</Badge>
        </div>
      </SectionCard>
    );
  }

  if (error || !data) {
    return (
      <SectionCard
        title={title}
        description="Roundデータを取得できませんでした。round idまたはSupabase接続を確認してください。"
        actions={
          <div className="flex flex-wrap gap-3">
            {backHref ? (
              <Link href={backHref} className={secondaryButtonClassName}>
                {backLabel}
              </Link>
            ) : null}
            <button type="button" onClick={() => void refresh()} className={buttonClassName}>
              再読み込み
            </button>
          </div>
        }
      >
        <div className="flex flex-wrap gap-2">
          <Badge tone="warning">Round ID {roundId}</Badge>
          <Badge tone="danger">取得失敗</Badge>
        </div>
        {error ? <p className="text-sm text-rose-700">{error}</p> : null}
      </SectionCard>
    );
  }

  const officialReadyCount = countMatchesWithOfficialVotes(data.round.matches);
  const aiReadyCount = countMatchesWithModelProbabilities(data.round.matches);
  const humanPickUserCount = new Set(data.round.picks.map((pick) => pick.userId)).size;

  return (
    <SectionCard
      title={title}
      description={description}
      actions={
        backHref ? (
          <Link href={backHref} className={secondaryButtonClassName}>
            {backLabel}
          </Link>
        ) : null
      }
    >
      <div className="flex flex-wrap gap-2">
        <Badge tone="slate">Round ID {data.round.id}</Badge>
        <Badge tone="teal">{roundSourceLabel[data.round.roundSource]}</Badge>
        <Badge tone={data.round.totoOfficialRound ? "teal" : "warning"}>
          {data.round.totoOfficialRound ? "公式人気あり" : "公式人気不足"}
        </Badge>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-6">
        <StatCard label="Round" value={data.round.title} compact />
        <StatCard label="試合数" value={data.round.matches.length} compact />
        <StatCard
          label="公式人気入力"
          value={`${officialReadyCount}/${data.round.matches.length}`}
          compact
        />
        <StatCard
          label="AI試算"
          value={`${aiReadyCount}/${data.round.matches.length}`}
          compact
        />
        <StatCard label="人力予想人数" value={humanPickUserCount} compact />
        <StatCard label="データ種別" value={roundSourceLabel[data.round.roundSource]} compact />
      </div>
    </SectionCard>
  );
}
