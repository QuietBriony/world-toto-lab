"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import {
  getRoundWorkspace,
  listDashboardData,
  listFixtureMaster,
  listTotoOfficialRoundLibrary,
  syncBigOfficialWatchFromOfficial,
} from "@/lib/repository";
import { useDataMode } from "@/components/app/data-mode-provider";
import type { BigOfficialSyncPayload } from "@/lib/big-official";
import type {
  DashboardData,
  FixtureMaster,
  RoundWorkspace,
  TotoOfficialRoundLibraryEntry,
} from "@/lib/types";

type ResourceState<T> = {
  data: T | null;
  error: string | null;
  loading: boolean;
  refresh: () => Promise<void>;
};

type UseAsyncResourceOptions = {
  pollMs?: number | null;
};

function messageFromError(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }

  return "不明なエラーです。";
}

function useAsyncResource<T>(
  loader: () => Promise<T>,
  enabled: boolean,
  deps: unknown[],
  options: UseAsyncResourceOptions = {},
): ResourceState<T> {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(enabled);
  const dataRef = useRef<T | null>(null);

  useEffect(() => {
    dataRef.current = data;
  }, [data]);

  // loader はインラインの filters オブジェクト等を閉じ込めて毎レンダ識別が変わりがち。
  // identity を deps に入れると「render → 新 loader → 新 refresh → effect 発火 →
  // setState → render → …」の無限再フェッチループになる（dashboard が固まる実害）。
  // ref 経由で常に最新の loader を呼び、再フェッチ条件は dependencyKey（内容比較）に集約する。
  const loaderRef = useRef(loader);
  useEffect(() => {
    loaderRef.current = loader;
  });

  const refresh = useCallback(async () => {
    if (!enabled) {
      setData(null);
      setError(null);
      setLoading(false);
      return;
    }

    const hasData = dataRef.current !== null;
    if (!hasData) {
      setLoading(true);
    }

    try {
      const nextData = await loaderRef.current();
      setData(nextData);
      setError(null);
    } catch (nextError) {
      if (dataRef.current === null) {
        setError(messageFromError(nextError));
      } else {
        console.warn("Background refresh failed", nextError);
      }
    } finally {
      setLoading(false);
    }
  }, [enabled]);

  const dependencyKey = JSON.stringify(deps);

  useEffect(() => {
    queueMicrotask(() => {
      void refresh();
    });
  }, [dependencyKey, refresh]);

  useEffect(() => {
    const pollMs = options.pollMs ?? null;
    if (!enabled || !pollMs || pollMs <= 0) {
      return;
    }

    const timer = window.setInterval(() => {
      void refresh();
    }, pollMs);

    return () => window.clearInterval(timer);
  }, [enabled, options.pollMs, refresh]);

  return { data, error, loading, refresh };
}

export function useDashboardData() {
  const { isChecking, mode } = useDataMode();
  const resource = useAsyncResource<DashboardData>(
    listDashboardData,
    !isChecking,
    [mode],
  );

  if (isChecking) {
    return { ...resource, loading: true };
  }

  return resource;
}

export function useRoundWorkspace(roundId: string | null) {
  const { isChecking, mode } = useDataMode();
  const loader = useCallback(async () => {
    if (!roundId) {
      throw new Error("ラウンドが選択されていません。");
    }

    const workspace = await getRoundWorkspace(roundId);

    if (!workspace) {
      throw new Error("選択したラウンドが見つかりません。");
    }

    return workspace;
  }, [roundId]);

  const resource = useAsyncResource<RoundWorkspace>(
    loader,
    !isChecking && Boolean(roundId),
    [mode, roundId],
  );

  if (isChecking) {
    return { ...resource, loading: true };
  }

  return resource;
}

export function useFixtureMaster(filters?: Parameters<typeof listFixtureMaster>[0]) {
  const { isChecking, mode } = useDataMode();
  const loader = useCallback(async () => listFixtureMaster(filters), [filters]);

  const resource = useAsyncResource<FixtureMaster[]>(
    loader,
    !isChecking,
    [mode, filters],
  );

  if (isChecking) {
    return { ...resource, loading: true };
  }

  return resource;
}

export function useTotoOfficialRoundLibrary(
  filters?: Parameters<typeof listTotoOfficialRoundLibrary>[0],
) {
  const { isChecking, mode } = useDataMode();
  const loader = useCallback(async () => listTotoOfficialRoundLibrary(filters), [filters]);

  const resource = useAsyncResource<TotoOfficialRoundLibraryEntry[]>(
    loader,
    !isChecking,
    [mode, filters],
  );

  if (isChecking) {
    return { ...resource, loading: true };
  }

  return resource;
}

// 取得先は Pages Function 側で固定（SSRF ガード）なので、呼び出し側から URL は渡せない。
export function useBigOfficialWatch() {
  const { isChecking, mode } = useDataMode();
  const loader = useCallback(async () => syncBigOfficialWatchFromOfficial(), []);

  const resource = useAsyncResource<BigOfficialSyncPayload>(loader, !isChecking, [mode]);

  if (isChecking) {
    return { ...resource, loading: true };
  }

  return resource;
}
