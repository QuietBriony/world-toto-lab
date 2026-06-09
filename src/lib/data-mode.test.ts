import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  dataModePreferenceKey,
  getRuntimeDataMode,
  getRuntimeSupabaseHealth,
  getStoredDataModePreference,
  setRuntimeDataMode,
  setRuntimeSupabaseHealth,
  setStoredDataModePreference,
  shouldUseLocalRepository,
} from "@/lib/data-mode";

class MemoryStorage implements Storage {
  private values = new Map<string, string>();

  get length() {
    return this.values.size;
  }

  clear() {
    this.values.clear();
  }

  getItem(key: string) {
    return this.values.get(key) ?? null;
  }

  key(index: number) {
    return Array.from(this.values.keys())[index] ?? null;
  }

  removeItem(key: string) {
    this.values.delete(key);
  }

  setItem(key: string, value: string) {
    this.values.set(key, value);
  }
}

function installWindow(storage = new MemoryStorage()) {
  vi.stubGlobal("window", { localStorage: storage });
  return storage;
}

describe("data mode", () => {
  beforeEach(() => {
    setRuntimeDataMode("local");
    setRuntimeSupabaseHealth(null);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("falls back to auto preference when browser storage is unavailable or invalid", () => {
    expect(getStoredDataModePreference()).toBe("auto");

    const storage = installWindow();
    storage.setItem(dataModePreferenceKey, "surprise-mode");

    expect(getStoredDataModePreference()).toBe("auto");
  });

  it("persists valid browser data-mode preferences", () => {
    const storage = installWindow();

    setStoredDataModePreference("shared");

    expect(storage.getItem(dataModePreferenceKey)).toBe("shared");
    expect(getStoredDataModePreference()).toBe("shared");
  });

  it("keeps demo and local modes on the local repository", () => {
    setRuntimeDataMode("demo");
    expect(shouldUseLocalRepository()).toBe(true);

    setRuntimeDataMode("local");
    expect(shouldUseLocalRepository()).toBe(true);
    expect(getRuntimeDataMode()).toBe("local");
  });

  it("keeps shared mode on the local repository now that Supabase is removed", () => {
    setRuntimeDataMode("shared");
    setRuntimeSupabaseHealth({
      checkedAt: "2026-01-01T00:00:00.000Z",
      message: "paused",
      status: "paused_or_unreachable",
    });

    expect(shouldUseLocalRepository()).toBe(true);
    expect(getRuntimeSupabaseHealth()?.status).toBe("paused_or_unreachable");

    // Supabase 廃止後は health が ok でも shared は local を使う（共有保存は D1 に統一）。
    setRuntimeSupabaseHealth({
      checkedAt: "2026-01-01T00:00:00.000Z",
      message: "ok",
      status: "ok",
    });

    expect(shouldUseLocalRepository()).toBe(true);
  });
});
