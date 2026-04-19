"use client";

import { useCallback, useEffect, useState } from "react";

import { listDashboardData, getRoundWorkspace } from "@/lib/repository";
import { isSupabaseConfigured } from "@/lib/supabase";
import type { DashboardData, RoundWorkspace } from "@/lib/types";

type ResourceState<T> = {
  data: T | null;
  error: string | null;
  loading: boolean;
  refresh: () => Promise<void>;
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
): ResourceState<T> {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(enabled);

  const refresh = useCallback(async () => {
    if (!enabled) {
      setData(null);
      setError(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const nextData = await loader();
      setData(nextData);
      setError(null);
    } catch (nextError) {
      setError(messageFromError(nextError));
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
    if (!enabled) {
      return;
    }

    const timer = window.setInterval(() => {
      void refresh();
    }, 20000);

    return () => window.clearInterval(timer);
  }, [enabled, refresh]);

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
