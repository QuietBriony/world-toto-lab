"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useMemo, useState, type FormEvent } from "react";

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
import { appRoute, buildRoundHref, getSingleSearchParam } from "@/lib/round-links";
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
  const [title, setTitle] = useState("公式日程から作るRound");
  const [productType, setProductType] = useState<ProductType>("toto13");
  const [saving, setSaving] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [createdRoundId, setCreatedRoundId] = useState<string | null>(existingRoundId);
  const fixtures = useFixtureMaster({
    competition,
    groupName,
    stage,
    teamQuery,
  });

  const selectedFixtures = useMemo(
    () => fixtures.data?.filter((fixture) => selectedIds.includes(fixture.id)) ?? [],
    [fixtures.data, selectedIds],
  );

  if (!isSupabaseConfigured()) {
    return <ConfigurationNotice />;
  }

  if (fixtures.error) {
    return <ErrorNotice error={fixtures.error} onRetry={() => void fixtures.refresh()} />;
  }

  if (fixtures.loading && !fixtures.data) {
    return <LoadingNotice title="Fixture Selector を準備中" />;
  }

  const recommendedProductType =
    selectedIds.length === 13
      ? "toto13"
      : selectedIds.length === 5
        ? "mini_toto"
        : selectedIds.length === 1
          ? "winner"
          : "custom";

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (selectedIds.length === 0) {
      setActionError("Round に入れる試合を1件以上選んでください。");
      return;
    }

    setSaving(true);
    setActionError(null);

    try {
      const roundId = await createRoundFromFixtures({
        budgetYen: null,
        fixtureIds: selectedIds,
        notes: null,
        productType,
        requiredMatchCount:
          productType === "custom" ? selectedIds.length : undefined,
        roundId: existingRoundId,
        sourceNote: "Fixture Selector から選択",
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
        title="Fixture Selector"
        description="Fixture Master から試合を選び、遊び用 Round や実運用 Round を作ります。"
        actions={
          <div className="flex flex-wrap gap-3">
            <Link href={appRoute.officialScheduleImport} className={secondaryButtonClassName}>
              公式日程を取り込む
            </Link>
            {createdRoundId ? (
              <Link href={buildRoundHref(appRoute.workspace, createdRoundId)} className={buttonClassName}>
                Round を開く
              </Link>
            ) : null}
          </div>
        }
      />

      <SectionCard title="Filter" description="competition / team / group / stage で絞り込みます。">
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <input
            value={competition}
            onChange={(event) => setCompetition(event.currentTarget.value)}
            className={fieldClassName}
            placeholder="competition"
          />
          <input
            value={teamQuery}
            onChange={(event) => setTeamQuery(event.currentTarget.value)}
            className={fieldClassName}
            placeholder="team"
          />
          <input
            value={groupName}
            onChange={(event) => setGroupName(event.currentTarget.value)}
            className={fieldClassName}
            placeholder="group"
          />
          <input
            value={stage}
            onChange={(event) => setStage(event.currentTarget.value)}
            className={fieldClassName}
            placeholder="stage"
          />
        </div>
      </SectionCard>

      <SectionCard
        title="Round Builder"
        description={`選択数 ${selectedIds.length} 件。おすすめ productType は ${productTypeLabel[recommendedProductType]}`}
      >
        <form className="space-y-4" onSubmit={handleSubmit}>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            <label className="space-y-2 text-sm">
              <span className="font-medium text-slate-700">title</span>
              <input
                value={title}
                onChange={(event) => setTitle(event.currentTarget.value)}
                className={fieldClassName}
              />
            </label>
            <label className="space-y-2 text-sm">
              <span className="font-medium text-slate-700">productType</span>
              <select
                value={productType}
                onChange={(event) => setProductType(event.currentTarget.value as ProductType)}
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
            <Badge tone="info">おすすめ {productTypeLabel[recommendedProductType]}</Badge>
            {existingRoundId ? <Badge tone="warning">既存Roundを置換</Badge> : <Badge tone="teal">新規Round作成</Badge>}
          </div>

          {actionError ? <p className="text-sm text-rose-700">{actionError}</p> : null}

          <button type="submit" className={buttonClassName} disabled={saving || selectedIds.length === 0}>
            {saving ? "保存中..." : existingRoundId ? "このRoundに反映" : "Round を作成"}
          </button>
        </form>
      </SectionCard>

      <SectionCard
        title="Fixtures"
        description={`表示 ${fixtures.data?.length ?? 0} 件 / 選択 ${selectedFixtures.length} 件`}
      >
        <HorizontalScrollTable>
          <table className="min-w-[1100px] text-left text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-slate-500">
                <th className="px-3 py-3">選択</th>
                <th className="px-3 py-3">date</th>
                <th className="px-3 py-3">fixture</th>
                <th className="px-3 py-3">group</th>
                <th className="px-3 py-3">stage</th>
                <th className="px-3 py-3">venue</th>
                <th className="px-3 py-3">source</th>
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
                              ? [...current, fixture.id]
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
      </SectionCard>
    </div>
  );
}

export default function FixtureSelectorPage() {
  return (
    <Suspense fallback={<LoadingNotice title="Fixture Selector を準備中" />}>
      <FixtureSelectorPageContent />
    </Suspense>
  );
}
