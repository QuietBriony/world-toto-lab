import { afterEach, describe, expect, it, vi } from "vitest";

import { createD1ApiAdapter } from "@/lib/storage/d1ApiAdapter";

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

type FakeInit = { ok?: boolean; status?: number };

function fakeResponse(body: unknown, init: FakeInit = {}) {
  return {
    ok: init.ok ?? true,
    status: init.status ?? 200,
    json: async () => body,
  } as unknown as Response;
}

function fakeFetch(handler: (url: string, init: RequestInit) => unknown) {
  return vi.fn(async (url: string, init: RequestInit) =>
    handler(url, init),
  ) as unknown as typeof fetch;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("d1ApiAdapter", () => {
  it("fetches the round list from the configured base URL", async () => {
    const fetchImpl = fakeFetch(() => fakeResponse({ rounds: [{ id: "r1" }] }));
    const adapter = createD1ApiAdapter({
      baseUrl: "https://api.test/",
      fetchImpl,
    });

    const rounds = await adapter.getRounds();

    expect(rounds).toEqual([{ id: "r1" }]);
    const mock = fetchImpl as unknown as ReturnType<typeof vi.fn>;
    expect(mock.mock.calls[0][0]).toBe("https://api.test/api/rounds");
    expect(mock.mock.calls[0][1].method).toBe("GET");
  });

  it("posts the round body and persists returned tokens on create", async () => {
    const storage = new MemoryStorage();
    vi.stubGlobal("window", { localStorage: storage });

    const fetchImpl = fakeFetch(() =>
      fakeResponse({
        round: { id: "r2" },
        shareCode: "share",
        editToken: "edit",
        adminToken: "admin",
      }),
    );
    const adapter = createD1ApiAdapter({
      baseUrl: "https://api.test",
      fetchImpl,
    });

    const id = await adapter.createRound({
      budgetYen: null,
      notes: null,
      status: "draft",
      title: "Created",
    });

    expect(id).toBe("r2");
    const mock = fetchImpl as unknown as ReturnType<typeof vi.fn>;
    const [url, init] = mock.mock.calls[0];
    expect(url).toBe("https://api.test/api/rounds");
    expect(init.method).toBe("POST");
    expect(JSON.parse(init.body)).toMatchObject({ title: "Created" });

    const stored = JSON.parse(
      storage.getItem("world-toto-lab:v1:d1Tokens") ?? "{}",
    );
    expect(stored.r2).toMatchObject({ editToken: "edit", shareCode: "share" });
  });

  it("attaches the edit token header for writes", async () => {
    const storage = new MemoryStorage();
    storage.setItem(
      "world-toto-lab:v1:d1Tokens",
      JSON.stringify({
        r3: { shareCode: "share", editToken: "edit", adminToken: "admin" },
      }),
    );
    vi.stubGlobal("window", { localStorage: storage });

    const fetchImpl = fakeFetch(() => fakeResponse({}, { status: 204 }));
    const adapter = createD1ApiAdapter({
      baseUrl: "https://api.test",
      fetchImpl,
    });

    await adapter.upsertPick("r3", "user-1", "match-1", "ONE");

    const mock = fetchImpl as unknown as ReturnType<typeof vi.fn>;
    const [url, init] = mock.mock.calls[0];
    expect(url).toBe("https://api.test/api/rounds/r3/picks");
    expect(init.headers["X-Edit-Token"]).toBe("edit");
    expect(init.headers["X-Share-Code"]).toBe("share");
  });

  it("reports health from the /api/health endpoint", async () => {
    const fetchImpl = fakeFetch(() => fakeResponse({ status: "ok" }));
    const adapter = createD1ApiAdapter({
      baseUrl: "https://api.test",
      fetchImpl,
    });

    expect((await adapter.health()).status).toBe("ok");
  });

  it("surfaces an unreachable health status when the API errors", async () => {
    const fetchImpl = fakeFetch(() =>
      fakeResponse({ error: "boom" }, { ok: false, status: 500 }),
    );
    const adapter = createD1ApiAdapter({
      baseUrl: "https://api.test",
      fetchImpl,
    });

    expect((await adapter.health()).status).toBe("unreachable");
  });

  it("refuses to delete rounds (data-safety design)", async () => {
    const adapter = createD1ApiAdapter({
      baseUrl: "https://api.test",
      fetchImpl: fakeFetch(() => fakeResponse({})),
    });

    await expect(adapter.deleteRound("r1")).rejects.toThrow();
  });

  it("throws a clear error when the base URL is not configured", async () => {
    const adapter = createD1ApiAdapter({
      baseUrl: "",
      fetchImpl: fakeFetch(() => fakeResponse({})),
    });

    await expect(adapter.getRounds()).rejects.toThrow(
      /NEXT_PUBLIC_D1_API_BASE/,
    );
  });
});
