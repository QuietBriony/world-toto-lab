import { describe, expect, it } from "vitest";

import {
  corsHeaders,
  isOriginAllowed,
  parseAllowedOrigins,
} from "./cors";

describe("parseAllowedOrigins", () => {
  it("returns the default allow-list when unset", () => {
    const allowed = parseAllowedOrigins(undefined);
    expect(allowed).toContain("https://quietbriony.github.io");
    expect(allowed).toContain("http://localhost:3000");
  });

  it("parses a comma-separated override", () => {
    const allowed = parseAllowedOrigins("https://a.example, https://b.example");
    expect(allowed).toEqual(["https://a.example", "https://b.example"]);
  });
});

describe("isOriginAllowed", () => {
  const allowed = parseAllowedOrigins(undefined);

  it("allows configured origins", () => {
    expect(isOriginAllowed("https://quietbriony.github.io", allowed)).toBe(true);
    expect(isOriginAllowed("http://localhost:3000", allowed)).toBe(true);
  });

  it("allows Cloudflare Pages preview/production domains", () => {
    expect(isOriginAllowed("https://world-toto-lab.pages.dev", allowed)).toBe(
      true,
    );
    expect(
      isOriginAllowed("https://abc123.world-toto-lab.pages.dev", allowed),
    ).toBe(true);
  });

  it("rejects unknown origins and empty origins", () => {
    expect(isOriginAllowed("https://evil.example", allowed)).toBe(false);
    expect(isOriginAllowed(null, allowed)).toBe(false);
    expect(isOriginAllowed("http://pages.dev.evil.example", allowed)).toBe(
      false,
    );
  });
});

describe("corsHeaders", () => {
  const allowed = parseAllowedOrigins(undefined);

  it("reflects an allowed origin (never a wildcard)", () => {
    const headers = corsHeaders("https://quietbriony.github.io", allowed);
    expect(headers["Access-Control-Allow-Origin"]).toBe(
      "https://quietbriony.github.io",
    );
    expect(headers["Access-Control-Allow-Origin"]).not.toBe("*");
    expect(headers.Vary).toBe("Origin");
    expect(headers["Access-Control-Allow-Headers"]).toContain("X-Edit-Token");
    expect(headers["Access-Control-Allow-Methods"]).toContain("DELETE");
  });

  it("omits the allow-origin header for disallowed origins", () => {
    const headers = corsHeaders("https://evil.example", allowed);
    expect(headers["Access-Control-Allow-Origin"]).toBeUndefined();
  });
});
