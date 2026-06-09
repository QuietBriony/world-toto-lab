import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  dataModePreferenceKey,
  getRuntimeDataMode,
  getStoredDataModePreference,
  isCloudflareD1Mode,
  setRuntimeDataMode,
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

    setStoredDataModePreference("cloudflare_d1");

    expect(storage.getItem(dataModePreferenceKey)).toBe("cloudflare_d1");
    expect(getStoredDataModePreference()).toBe("cloudflare_d1");
  });

  it("keeps demo and local modes on the local repository", () => {
    setRuntimeDataMode("demo");
    expect(shouldUseLocalRepository()).toBe(true);

    setRuntimeDataMode("local");
    expect(shouldUseLocalRepository()).toBe(true);
    expect(getRuntimeDataMode()).toBe("local");
  });

  it("treats cloudflare_d1 mode as local repository for non-D1-wired functions", () => {
    setRuntimeDataMode("cloudflare_d1");

    // 共有保存は D1。D1 未配線の関数は local へ落とすため shouldUseLocalRepository は true。
    expect(shouldUseLocalRepository()).toBe(true);
    expect(isCloudflareD1Mode()).toBe(true);
    expect(getRuntimeDataMode()).toBe("cloudflare_d1");
  });
});
