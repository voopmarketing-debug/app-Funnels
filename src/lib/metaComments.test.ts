import { afterEach, describe, expect, it, vi } from "vitest";
import { MetaApiError } from "./metaSocial";
import { adComments, facebookComments, instagramComments, isCommentId, mergeComments, privateReplyToComment, replyToComment, setCommentHidden } from "./metaComments";

function mockFetch(handler: (url: URL, init?: RequestInit) => { status?: number; body: unknown }) {
  const fn = vi.fn(async (input: URL | string, init?: RequestInit) => {
    const { status = 200, body } = handler(new URL(String(input)), init);
    return new Response(JSON.stringify(body), { status });
  });
  vi.stubGlobal("fetch", fn);
  return fn;
}

afterEach(() => vi.unstubAllGlobals());

describe("facebookComments", () => {
  it("lists other people's comments and knows which ones the Page answered", async () => {
    mockFetch((url) => {
      expect(url.pathname).toContain("/page1/posts");
      return {
        body: {
          data: [
            {
              id: "p1",
              message: "Promo de octubre",
              permalink_url: "https://facebook.com/p1",
              full_picture: "https://scontent.xx.fbcdn.net/p1.jpg",
              comments: {
                data: [
                  { id: "c1", message: "¿Precio?", created_time: "2026-10-10T10:00:00+0000", from: { id: "u1", name: "Laura" }, comments: { data: [] } },
                  {
                    id: "c2",
                    message: "Me encanta",
                    created_time: "2026-10-09T10:00:00+0000",
                    from: { id: "u2", name: "Pedro" },
                    is_hidden: true,
                    comments: { data: [{ id: "r1", message: "¡Gracias!", created_time: "2026-10-09T11:00:00+0000", from: { id: "page1" } }] },
                  },
                  { id: "c3", message: "Link en la bio", created_time: "2026-10-08T10:00:00+0000", from: { id: "page1" } },
                ],
              },
            },
          ],
        },
      };
    });
    const comments = await facebookComments("page1", "tok");
    expect(comments.map((c) => c.id)).toEqual(["c1", "c2"]);
    expect(comments[0]).toMatchObject({ authorName: "Laura", answered: false, hidden: false, post: { image: "https://scontent.xx.fbcdn.net/p1.jpg" } });
    expect(comments[1]).toMatchObject({ answered: true, hidden: true, replies: [{ authorName: "Tú", fromUs: true }] });
  });
});

describe("instagramComments", () => {
  it("names people by @username and uses the video thumbnail", async () => {
    mockFetch(() => ({
      body: {
        data: [
          {
            id: "m1",
            caption: "Reel",
            media_type: "VIDEO",
            media_url: "https://cdn/video.mp4",
            thumbnail_url: "https://cdn/thumb.jpg",
            comments: {
              data: [
                {
                  id: "ic1",
                  text: "Info 🙏",
                  username: "ana.perez",
                  timestamp: "2026-10-10T12:00:00+0000",
                  from: { id: "u9" },
                  replies: { data: [{ id: "ir1", text: "Te escribimos", username: "clinica", timestamp: "2026-10-10T12:05:00+0000", from: { id: "ig1" } }] },
                },
              ],
            },
          },
        ],
      },
    }));
    const [c] = await instagramComments("ig1", "tok");
    expect(c).toMatchObject({ authorName: "@ana.perez", answered: true, post: { image: "https://cdn/thumb.jpg" } });
  });
});

describe("actions", () => {
  it("replies on the right edge for each network", async () => {
    const fn = mockFetch(() => ({ body: { id: "new" } }));
    await replyToComment({ network: "facebook", commentId: "c1", text: "Hola", pageToken: "t" });
    await replyToComment({ network: "instagram", commentId: "ic1", text: "Hola", pageToken: "t" });
    expect(String(fn.mock.calls[0][0])).toContain("/c1/comments");
    expect(String(fn.mock.calls[1][0])).toContain("/ic1/replies");
    expect(new URL(String(fn.mock.calls[1][0])).searchParams.get("message")).toBe("Hola");
  });

  it("hides with each network's own field", async () => {
    const fn = mockFetch(() => ({ body: { success: true } }));
    await setCommentHidden({ network: "facebook", commentId: "c1", hidden: true, pageToken: "t" });
    await setCommentHidden({ network: "instagram", commentId: "ic1", hidden: false, pageToken: "t" });
    expect(new URL(String(fn.mock.calls[0][0])).searchParams.get("is_hidden")).toBe("true");
    expect(new URL(String(fn.mock.calls[1][0])).searchParams.get("hide")).toBe("false");
  });

  it("sends a private reply to the comment and explains Meta's one-per-comment rule", async () => {
    const fn = mockFetch(() => ({ body: { recipient_id: "u1", message_id: "mid" } }));
    await privateReplyToComment({ pageId: "page1", commentId: "c1", text: "Te escribo", pageToken: "t" });
    expect(JSON.parse(String(fn.mock.calls[0][1]?.body))).toEqual({ recipient: { comment_id: "c1" }, message: { text: "Te escribo" } });

    mockFetch(() => ({ status: 400, body: { error: { message: "(#10900) Activity already replied to", code: 10900 } } }));
    const err = await privateReplyToComment({ pageId: "page1", commentId: "c1", text: "x", pageToken: "t" }).catch((e) => e);
    expect(err).toBeInstanceOf(MetaApiError);
    expect(err.friendly).toBe(true);
    expect(err.message).toMatch(/solo deja uno/);
  });

  it("only accepts Meta-shaped comment ids", () => {
    expect(isCommentId("1234567890_9876543210")).toBe(true);
    expect(isCommentId("17890000000000001")).toBe(true);
    expect(isCommentId("../me/accounts")).toBe(false);
    expect(isCommentId("1?fields=access_token")).toBe(false);
  });
});

describe("adComments", () => {
  it("reads comments on the ads' own posts and labels them with the campaign", async () => {
    const calls: URL[] = [];
    mockFetch((url) => {
      calls.push(url);
      if (url.pathname.endsWith("/act_1/ads")) {
        expect(url.searchParams.get("access_token")).toBe("user-tok");
        return {
          body: {
            data: [
              { id: "ad1", name: "Promo A", updated_time: "2026-10-10", campaign: { name: "Octubre" }, creative: { effective_object_story_id: "page1_777", effective_instagram_media_id: "ig9" } },
              // Same post reused by a second ad: read once.
              { id: "ad2", name: "Promo B", updated_time: "2026-10-09", campaign: { name: "Octubre" }, creative: { effective_object_story_id: "page1_777" } },
              // Another Page's post (shared ad account): never read with this Page's token.
              { id: "ad3", name: "Otra página", updated_time: "2026-10-08", creative: { effective_object_story_id: "otherpage_1" } },
            ],
          },
        };
      }
      expect(url.searchParams.get("access_token")).toBe("page-tok");
      // Posts are read one by one: the batched `?ids=` form is rejected by current API versions.
      expect(url.searchParams.get("ids")).toBeNull();
      if (url.pathname.endsWith("/page1_777")) {
        return { body: { id: "page1_777", message: "Anuncio", comments: { data: [{ id: "c9", message: "INFO", created_time: "2026-10-10T10:00:00+0000", from: { id: "u1", name: "Ana" } }] } } };
      }
      expect(url.pathname.endsWith("/ig9")).toBe(true);
      return { body: { id: "ig9", caption: "Ad IG", comments: { data: [{ id: "ic9", text: "precio", username: "pepe", timestamp: "2026-10-10T11:00:00+0000" }] } } };
    });
    const comments = await adComments({ adAccountId: "act_1", userToken: "user-tok", pageId: "page1", igUserId: "ig1", pageToken: "page-tok" });
    expect(comments.map((c) => [c.id, c.network, c.ad?.campaign])).toEqual([
      ["c9", "facebook", "Octubre"],
      ["ic9", "instagram", "Octubre"],
    ]);
    expect(calls.some((u) => u.pathname.includes("otherpage"))).toBe(false);
  });

  it("keeps one copy of a boosted post's comment, labelled as an ad", () => {
    const base = { network: "facebook" as const, post: { id: "p", text: "", permalink: null, image: null }, authorName: "Ana", text: "hola", createdAt: "2026-10-10", hidden: false, likeCount: 0, replies: [], answered: false };
    const merged = mergeComments([{ ...base, id: "c1", ad: null }, { ...base, id: "c2", ad: null }], [{ ...base, id: "c1", ad: { name: "Promo", campaign: "Oct" } }]);
    expect(merged).toHaveLength(2);
    expect(merged.find((c) => c.id === "c1")?.ad).toEqual({ name: "Promo", campaign: "Oct" });
  });
});
