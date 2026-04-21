"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import {
  getRoundWorkspace,
  listDashboardData,
  listFixtureMaster,
  listTotoOfficialRoundLibrary,
  syncBigOfficialWatchFromOfficial,
} from "@/lib/repository";
import { isSupabaseConfigured } from "@/lib/supabase";
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
      const nextData = await loader();
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
  }, [enabled, loader]);

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
  return useAsyncResource<DashboardData>(
    listDashboardData,
    isSupabaseConfigured(),
    [],
  );
}

export function useRoundWorkspace(roundId: string | null) {
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

  return useAsyncResource<RoundWorkspace>(
    loader,
    isSupabaseConfigured() && Boolean(roundId),
    [roundId],
  );
}

export function useFixtureMaster(filters?: Parameters<typeof listFixtureMaster>[0]) {
  const loader = useCallback(async () => listFixtureMaster(filters), [filters]);

  return useAsyncResource<FixtureMaster[]>(
    loader,
    isSupabaseConfigured(),
    [filters],
  );
}

export function useTotoOfficialRoundLibrary(
  filters?: Parameters<typeof listTotoOfficialRoundLibrary>[0],
) {
  const loader = useCallback(async () => listTotoOfficialRoundLibrary(filters), [filters]);

  return useAsyncResource<TotoOfficialRoundLibraryEntry[]>(
    loader,
    isSupabaseConfigured(),
    [filters],
  );
}

export function useBigOfficialWatch(sourceUrl?: string | null) {
  const loader = useCallback(
    async () => syncBigOfficialWatchFromOfficial({ sourceUrl: sourceUrl ?? undefined }),
    [sourceUrl],
  );

  return useAsyncResource<BigOfficialSyncPayload>(
    loader,
    isSupabaseConfigured(),
    [sourceUrl],
  );
}
