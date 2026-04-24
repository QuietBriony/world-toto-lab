"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useMemo, useState, type FormEvent } from "react";

import { RoundContextCard } from "@/components/app/round-context-card";
import {
  ConfigurationNotice,
  ErrorNotice,
  LoadingNotice,
} from "@/components/app/states";
import {
  Badge,
  buttonClassName,
  fieldClassName,
  HorizontalScrollTable,
  PageHeader,
  SectionCard,
  secondaryButtonClassName,
} from "@/components/ui";
import { productTypeLabel } from "@/lib/domain";
import { productTypeOptions } from "@/lib/product-rules";
import {
  appRoute,
  buildOfficialRoundImportHref,
  buildRoundHref,
  getSingleSearchParam,
} from "@/lib/round-links";
import { createRoundFromFixtures } from "@/lib/repository";
import { isSupabaseConfigured } from "@/lib/supabase";
import type { ProductType } from "@/lib/types";
import { useFixtureMaster } from "@/lib/use-app-data";

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : "不明なエラーです。";
}

function FixtureSelectorPageContent() {
  const searchParams = useSearchParams();
  const existingRoundId = getSingleSearchParam(searchParams.get("round"));
  const [competition, setCompetition] = useState("fifa_world_cup_2026");
  const [teamQuery, setTeamQuery] = useState("");
  const [stage, setStage] = useState("");
  const [groupName, setGroupName] = useState("");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [title, setTitle] = useState("公式日程から作るラウンド");
  const [productTypeOverride, setProductTypeOverride] = useState<ProductType | null>(null);
  const [saving, setSaving] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [createdRoundId, setCreatedRoundId] = useState<string | null>(existingRoundId);
  const fixtures = useFixtureMaster({
    competition,
    groupName,
    stage,
    teamQuery,
  });
  const officialScheduleHref = buildRoundHref(appRoute.officialScheduleImport, existingRoundId);
  const officialRoundImportHref = buildOfficialRoundImportHref(existingRoundId, {
    autoApply: true,
    autoSync: true,
    productType: "toto13",
    sourcePreset: "yahoo_toto_schedule",
  });
  const roundDetailHref = existingRoundId
    ? buildRoundHref(appRoute.workspace, existingRoundId)
    : createdRoundId
      ? buildRoundHref(appRoute.workspace, createdRoundId)
      : null;

  const selectedFixtures = useMemo(
    () => fixtures.data?.filter((fixture) => selectedIds.includes(fixture.id)) ?? [],
    [fixtures.data, selectedIds],
  );
  const visibleFixtureIds = useMemo(
    () => fixtures.data?.map((fixture) => fixture.id) ?? [],
    [fixtures.data],
  );
  const visibleSelectedCount = useMemo(
    () => visibleFixtureIds.filter((id) => selectedIds.includes(id)).length,
    [selectedIds, visibleFixtureIds],
  );
  const hiddenSelectedCount = Math.max(selectedIds.length - visibleSelectedCount, 0);

  const addVisibleFixtures = () => {
    setSelectedIds((current) => Array.from(new Set([...current, ...visibleFixtureIds])));
  };

  const removeVisibleFixtures = () => {
    const visibleIdSet = new Set(visibleFixtureIds);
    setSelectedIds((current) => current.filter((id) => !visibleIdSet.has(id)));
  };

  const removeHiddenFixtures = () => {
    const visibleIdSet = new Set(visibleFixtureIds);
    setSelectedIds((current) => current.filter((id) => visibleIdSet.has(id)));
  };

  if (!isSupabaseConfigured()) {
    return <ConfigurationNotice />;
  }

  if (fixtures.error) {
    return <ErrorNotice error={fixtures.error} onRetry={() => void fixtures.refresh()} />;
  }

  if (fixtures.loading && !fixtures.data) {
    return <LoadingNotice title="試合選択を準備中" />;
  }

  const recommendedProductType =
    selectedIds.length === 13
      ? "toto13"
      : selectedIds.length === 5
        ? "mini_toto"
        : selectedIds.length === 1
          ? "winner"
          : "custom";
  const selectedProductType = productTypeOverride ?? recommendedProductType;

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (selectedIds.length === 0) {
      setActionError("ラウンドに入れる試合を1件以上選んでください。");
      return;
    }

    setSaving(true);
    setActionError(null);

    try {
      const roundId = await createRoundFromFixtures({
        budgetYen: null,
        fixtureIds: selectedIds,
        notes: null,
        productType: selectedProductType,
        requiredMatchCount:
          selectedProductType === "custom" ? selectedIds.length : undefined,
        roundId: existingRoundId,
        sourceNote: "13試合を選ぶ から選択",
        status: "analyzing",
        title,
      });
      setCreatedRoundId(roundId);
    } catch (nextError) {
      setActionError(errorMessage(nextError));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Admin"
        title="13試合を選ぶ"
        description="販売前の手動準備として、全試合リストに入った大会全体の試合から今回遊ぶ13試合を選んで1回分を作ります。公式対象13試合が出たあとは `公式toto回から作る` の方が本番向きです。"
        actions={
          <div className="flex flex-wrap gap-3">
            <Link href={officialScheduleHref} className={secondaryButtonClassName}>
              公式日程を取り込む
            </Link>
            <Link href={officialRoundImportHref} className={secondaryButtonClassName}>
              公式toto回を見る
            </Link>
            {roundDetailHref ? (
              <Link href={roundDetailHref} className={secondaryButtonClassName}>
                ラウンド詳細へ戻る
              </Link>
            ) : null}
            {createdRoundId ? (
              <Link href={buildRoundHref(appRoute.workspace, createdRoundId)} className={buttonClassName}>
                ラウンドを開く
              </Link>
            ) : null}
          </div>
        }
      />

      <RoundContextCard
        roundId={existingRoundId}
        backHref={roundDetailHref}
        description="既存の回を置き換えるのか、新しく作るのかをこのカードで見分けられるようにしています。"
      />

      <SectionCard
        title="この画面の役割"
        description="発売前と発売後で、13試合の決め方を分けています。"
      >
        <div className="grid gap-3 lg:grid-cols-3">
          <div className="rounded-[22px] border border-slate-200 bg-slate-50/90 px-4 py-4">
            <Badge tone="slate">1. 全試合は保存済み</Badge>
            <p className="mt-3 text-sm leading-6 text-slate-700">
              `公式日程を取り込む` では大会全体の全試合リストを作ります。
            </p>
          </div>
          <div className="rounded-[22px] border border-teal-200 bg-teal-50/80 px-4 py-4">
            <Badge tone="teal">2. ここで13試合を選ぶ</Badge>
            <p className="mt-3 text-sm leading-6 text-slate-700">
              発売前の段階では、この画面で今回遊ぶ13試合を手で選んでラウンドにします。
            </p>
          </div>
          <div className="rounded-[22px] border border-sky-200 bg-sky-50/80 px-4 py-4">
            <Badge tone="info">3. 本番は公式toto回から作る</Badge>
            <p className="mt-3 text-sm leading-6 text-slate-700">
              公式対象13試合が出たあとは、自動で取り込みやすい `公式toto回を見る`
              を使う方が自然です。
            </p>
          </div>
        </div>
      </SectionCard>

      <SectionCard title="絞り込み" description="大会 / チーム / 組 / ステージで絞り込みます。">
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <input
            value={competition}
            onChange={(event) => setCompetition(event.currentTarget.value)}
            className={fieldClassName}
            placeholder="大会ID"
          />
          <input
            value={teamQuery}
            onChange={(event) => setTeamQuery(event.currentTarget.value)}
            className={fieldClassName}
            placeholder="チーム名"
          />
          <input
            value={groupName}
            onChange={(event) => setGroupName(event.currentTarget.value)}
            className={fieldClassName}
            placeholder="組"
          />
          <input
            value={stage}
            onChange={(event) => setStage(event.currentTarget.value)}
            className={fieldClassName}
            placeholder="ステージ"
          />
        </div>
      </SectionCard>

      <SectionCard
        title="ラウンド化して保存"
        description={`保存対象 ${selectedIds.length} 件。13件で toto、5件で mini toto、1件で WINNER の目安です。公式未発表の段階では自動13試合化はしません。`}
      >
        <form className="space-y-4" onSubmit={handleSubmit}>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            <label className="space-y-2 text-sm">
              <span className="font-medium text-slate-700">ラウンド名</span>
              <input
                value={title}
                onChange={(event) => setTitle(event.currentTarget.value)}
                className={fieldClassName}
              />
            </label>
            <label className="space-y-2 text-sm">
              <span className="font-medium text-slate-700">商品タイプ</span>
              <select
                value={selectedProductType}
                onChange={(event) =>
                  setProductTypeOverride(event.currentTarget.value as ProductType)
                }
                className={fieldClassName}
              >
                {productTypeOptions.map((option) => (
                  <option key={option} value={option}>
                    {productTypeLabel[option]}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="flex flex-wrap gap-2">
            <Badge tone="slate">選択 {selectedIds.length}</Badge>
            <Badge tone="sky">表示中で選択 {visibleSelectedCount}</Badge>
            {hiddenSelectedCount > 0 ? (
              <Badge tone="warning">フィルタ外で保持 {hiddenSelectedCount}</Badge>
            ) : null}
            <Badge tone="info">おすすめ {productTypeLabel[recommendedProductType]}</Badge>
            {existingRoundId ? <Badge tone="warning">既存ラウンドを置換</Badge> : <Badge tone="teal">新規ラウンド作成</Badge>}
          </div>

          {hiddenSelectedCount > 0 ? (
            <div className="rounded-[22px] border border-amber-200 bg-amber-50 px-4 py-4 text-sm leading-6 text-amber-950">
              いまのフィルタでは見えていない試合が {hiddenSelectedCount} 件、保存対象に残っています。
              今見えている試合だけでラウンドを作りたいときは、下のボタンで整理してください。
            </div>
          ) : null}

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={addVisibleFixtures}
              className={secondaryButtonClassName}
              disabled={visibleFixtureIds.length === 0}
            >
              表示中を全部選択
            </button>
            <button
              type="button"
              onClick={removeVisibleFixtures}
              className={secondaryButtonClassName}
              disabled={visibleSelectedCount === 0}
            >
              表示中を解除
            </button>
            <button
              type="button"
              onClick={removeHiddenFixtures}
              className={secondaryButtonClassName}
              disabled={hiddenSelectedCount === 0}
            >
              フィルタ外の選択を解除
            </button>
            <button
              type="button"
              onClick={() => setSelectedIds([])}
              className={secondaryButtonClassName}
              disabled={selectedIds.length === 0}
            >
              選択をクリア
            </button>
          </div>

          {actionError ? <p className="text-sm text-rose-700">{actionError}</p> : null}

          <button type="submit" className={buttonClassName} disabled={saving || selectedIds.length === 0}>
            {saving ? "保存中..." : existingRoundId ? "このラウンドに反映" : "ラウンドを作成"}
          </button>
        </form>
      </SectionCard>

      <SectionCard
        title="試合一覧"
        description={`表示 ${fixtures.data?.length ?? 0} 件 / 現在見えている選択 ${selectedFixtures.length} 件`}
      >
        {(fixtures.data?.length ?? 0) === 0 ? (
          <div className="rounded-[24px] border border-dashed border-slate-300 bg-slate-50/90 px-5 py-5 text-sm leading-7 text-slate-600">
            <p>いまの条件では試合が見つかりません。</p>
            <p className="mt-2">
              チーム名 / 組 / ステージ を少しゆるめるか、まだ日程が入っていなければ先に `公式日程を取り込む`
              へ戻るのが最短です。
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => {
                  setTeamQuery("");
                  setGroupName("");
                  setStage("");
                }}
                className={secondaryButtonClassName}
              >
                フィルタをゆるめる
              </button>
              <Link href={officialScheduleHref} className={secondaryButtonClassName}>
                公式日程を取り込む
              </Link>
            </div>
          </div>
        ) : (
          <HorizontalScrollTable>
          <table className="min-w-[1100px] text-left text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-slate-500">
                <th className="px-3 py-3">選択</th>
                <th className="px-3 py-3">日付</th>
                <th className="px-3 py-3">カード</th>
                <th className="px-3 py-3">組</th>
                <th className="px-3 py-3">ステージ</th>
                <th className="px-3 py-3">会場</th>
                <th className="px-3 py-3">元データ</th>
              </tr>
            </thead>
            <tbody>
              {fixtures.data?.map((fixture) => {
                const checked = selectedIds.includes(fixture.id);
                return (
                  <tr key={fixture.id} className="border-b border-slate-100">
                    <td className="px-3 py-3">
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={(event) =>
                          setSelectedIds((current) =>
                            event.currentTarget.checked
                              ? Array.from(new Set([...current, fixture.id]))
                              : current.filter((id) => id !== fixture.id),
                          )
                        }
                      />
                    </td>
                    <td className="px-3 py-3">{fixture.matchDate ?? "—"}</td>
                    <td className="px-3 py-3 font-medium text-slate-950">
                      {fixture.homeTeam} vs {fixture.awayTeam}
                    </td>
                    <td className="px-3 py-3">{fixture.groupName ?? "—"}</td>
                    <td className="px-3 py-3">{fixture.stage ?? "—"}</td>
                    <td className="px-3 py-3">{fixture.venue ?? "—"}</td>
                    <td className="px-3 py-3">{fixture.source}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          </HorizontalScrollTable>
        )}
      </SectionCard>
    </div>
  );
}

export default function FixtureSelectorPage() {
  return (
    <Suspense fallback={<LoadingNotice title="試合選択を準備中" />}>
      <FixtureSelectorPageContent />
    </Suspense>
  );
}
