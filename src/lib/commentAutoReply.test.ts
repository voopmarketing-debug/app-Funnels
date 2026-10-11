import { describe, expect, it } from "vitest";
import { commentsInPayload, fillTemplate, hasKeyword, matchRule, normalizeText, parseKeywords } from "./commentAutoReply";

describe("keywords", () => {
  it("normalizes case, accents and spacing", () => {
    expect(normalizeText("  ¡CUÁNTO   Vale!  ")).toBe("¡cuanto vale!");
    expect(parseKeywords("Info, PRECIO\nCuánto vale; info, #promo")).toEqual(["info", "precio", "cuanto vale", "promo"]);
  });

  it("matches whole words and phrases, not parts of words", () => {
    expect(hasKeyword("INFO por favor 🙏", ["info"])).toBe(true);
    expect(hasKeyword("Quiero información", ["info"])).toBe(false);
    expect(hasKeyword("¿Cuánto vale el blanqueamiento?", ["cuanto vale"])).toBe(true);
    expect(hasKeyword("info!!!", ["info"])).toBe(true);
    expect(hasKeyword("@ana mira esto", ["info"])).toBe(false);
  });

  it("picks the oldest enabled rule for the network", () => {
    const rule = (id: string, keywords: string[], networks: string[], created: string, enabled = true) => ({
      id,
      keywords,
      networks,
      enabled,
      createdAt: new Date(created),
    });
    const rules = [
      rule("new", ["info"], ["facebook", "instagram"], "2026-10-05"),
      rule("old", ["info"], ["instagram"], "2026-10-01"),
      rule("off", ["precio"], ["facebook"], "2026-09-01", false),
    ];
    expect(matchRule(rules, "instagram", "info")?.id).toBe("old");
    expect(matchRule(rules, "facebook", "info")?.id).toBe("new");
    expect(matchRule(rules, "facebook", "precio")).toBeNull();
  });

  it("greets by first name or @username", () => {
    expect(fillTemplate("¡Hola {nombre}! Te escribimos", "Laura Gómez")).toBe("¡Hola Laura! Te escribimos");
    expect(fillTemplate("Hola {nombre}, revisa tu DM", "@ana.perez")).toBe("Hola @ana.perez, revisa tu DM");
    expect(fillTemplate("Hola {nombre}, revisa tu DM", null)).toBe("Hola, revisa tu DM");
  });
});

describe("commentsInPayload", () => {
  it("reads new Facebook comments and skips replies and the Page's own", () => {
    const change = (value: Record<string, unknown>) => ({ field: "feed", value: { item: "comment", verb: "add", post_id: "p1", parent_id: "p1", ...value } });
    const found = commentsInPayload({
      object: "page",
      entry: [
        {
          id: "page1",
          changes: [
            change({ comment_id: "c1", message: "INFO", from: { id: "u1", name: "Laura Gómez" }, created_time: 1791700000 }),
            change({ comment_id: "c2", message: "gracias", from: { id: "u2" }, parent_id: "c1" }),
            change({ comment_id: "c3", message: "Link en bio", from: { id: "page1" } }),
            change({ comment_id: "c4", verb: "edited", from: { id: "u3" } }),
            { field: "feed", value: { item: "reaction", verb: "add" } },
          ],
        },
      ],
    });
    expect(found).toEqual([
      {
        where: { fbPageId: "page1" },
        comment: { network: "facebook", commentId: "c1", text: "INFO", authorName: "Laura Gómez", createdAt: new Date(1791700000 * 1000) },
      },
    ]);
  });

  it("reads new Instagram comments and skips replies and the account's own", () => {
    const found = commentsInPayload({
      object: "instagram",
      entry: [
        {
          id: "ig1",
          changes: [
            { field: "comments", value: { id: "ic1", text: "precio?", from: { id: "u9", username: "ana.perez" }, media: { id: "m1" } } },
            { field: "comments", value: { id: "ic2", text: "ok", from: { id: "u9", username: "ana.perez" }, parent_id: "ic1" } },
            { field: "comments", value: { id: "ic3", text: "Te escribimos", from: { id: "ig1", username: "clinica" } } },
          ],
        },
      ],
    });
    expect(found.map((f) => [f.where, f.comment.commentId, f.comment.authorName])).toEqual([[{ igUserId: "ig1" }, "ic1", "@ana.perez"]]);
  });

  it("ignores anything that isn't a comment payload", () => {
    expect(commentsInPayload(null)).toEqual([]);
    expect(commentsInPayload({ object: "whatsapp_business_account", entry: [{ id: "x", changes: [{ field: "messages", value: {} }] }] })).toEqual([]);
  });
});
