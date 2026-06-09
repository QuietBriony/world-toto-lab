import { describe, expect, it } from "vitest";

import { buildInviteUrl } from "@/lib/invite-link";

describe("buildInviteUrl", () => {
  it("clears the existing query and sets round/edit/share (Cloudflare, no basePath)", () => {
    const url = buildInviteUrl(
      "https://world-toto-lab.pages.dev/pick-room/?round=old&user=u1",
      { roundId: "r1", editToken: "E1", shareCode: "S1" },
    );
    expect(url).toBe(
      "https://world-toto-lab.pages.dev/pick-room/?round=r1&edit=E1&share=S1",
    );
  });

  it("preserves the GitHub Pages basePath in the pathname", () => {
    const url = buildInviteUrl(
      "https://quietbriony.github.io/world-toto-lab/pick-room/",
      { roundId: "r1", editToken: "E1" },
    );
    expect(url).toBe(
      "https://quietbriony.github.io/world-toto-lab/pick-room/?round=r1&edit=E1",
    );
  });

  it("omits share when shareCode is missing or empty", () => {
    const undef = buildInviteUrl("https://x.pages.dev/?round=z", {
      roundId: "r2",
      editToken: "E2",
    });
    expect(undef).toBe("https://x.pages.dev/?round=r2&edit=E2");

    const empty = buildInviteUrl("https://x.pages.dev/", {
      roundId: "r2",
      editToken: "E2",
      shareCode: "",
    });
    expect(empty).toBe("https://x.pages.dev/?round=r2&edit=E2");
  });

  it("never includes an admin token and url-encodes values", () => {
    const url = buildInviteUrl("https://x.pages.dev/pick-room/", {
      roundId: "r3",
      editToken: "a/b",
      shareCode: "s1",
    });
    expect(url).not.toContain("admin");
    expect(url).toContain("edit=a%2Fb");
  });
});
