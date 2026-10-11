import { MetaApiError, graph } from "@/lib/metaSocial";
import { safeMediaUrl } from "@/lib/metaInbox";

// Comments on the connected Page's Facebook posts and Instagram media, read
// live from the Graph API and answered by people on the team (publicly, or
// with Meta's one-time private reply). Needs pages_read_user_content +
// pages_manage_engagement (Facebook) and instagram_manage_comments.

export type CommentNetwork = "facebook" | "instagram";

export type CommentReply = { id: string; text: string; createdAt: string; fromUs: boolean; authorName: string };

export type SocialComment = {
  id: string;
  network: CommentNetwork;
  post: { id: string; text: string; permalink: string | null; image: string | null };
  authorName: string;
  text: string;
  createdAt: string;
  hidden: boolean;
  likeCount: number;
  replies: CommentReply[];
  /** The Page / account already answered it publicly. */
  answered: boolean;
};

/** Meta allows one private reply per comment, within this window. */
export const PRIVATE_REPLY_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;

const POSTS = "12";
const COMMENTS = "25";

type FbComment = {
  id: string;
  message?: string;
  created_time: string;
  from?: { id: string; name?: string };
  is_hidden?: boolean;
  like_count?: number;
  comments?: { data: FbComment[] };
};
type FbPost = { id: string; message?: string; permalink_url?: string; full_picture?: string; comments?: { data: FbComment[] } };

export async function facebookComments(pageId: string, pageToken: string): Promise<SocialComment[]> {
  const res = await graph<{ data: FbPost[] }>(
    `${pageId}/posts`,
    {
      fields: `id,message,permalink_url,full_picture,comments.order(reverse_chronological).limit(${COMMENTS}){id,message,created_time,from,is_hidden,like_count,comments.limit(10){id,message,created_time,from}}`,
      limit: POSTS,
    },
    pageToken,
  );
  return res.data.flatMap((p) =>
    (p.comments?.data ?? [])
      // The Page's own top-level comments (e.g. a pinned "link en la bio") aren't questions to answer.
      .filter((c) => c.from?.id !== pageId)
      .map((c) => {
        const replies = (c.comments?.data ?? []).map((r) => ({
          id: r.id,
          text: r.message ?? "",
          createdAt: r.created_time,
          fromUs: r.from?.id === pageId,
          authorName: r.from?.id === pageId ? "Tú" : r.from?.name ?? "Alguien",
        }));
        return {
          id: c.id,
          network: "facebook" as const,
          post: { id: p.id, text: p.message ?? "", permalink: p.permalink_url ?? null, image: safeMediaUrl(p.full_picture) },
          // Without pages_read_user_content Meta leaves out who wrote it.
          authorName: c.from?.name ?? "Alguien en Facebook",
          text: c.message ?? "",
          createdAt: c.created_time,
          hidden: !!c.is_hidden,
          likeCount: c.like_count ?? 0,
          replies,
          answered: replies.some((r) => r.fromUs),
        };
      }),
  );
}

type IgComment = {
  id: string;
  text?: string;
  username?: string;
  timestamp: string;
  hidden?: boolean;
  like_count?: number;
  from?: { id: string; username?: string };
  replies?: { data: IgComment[] };
};
type IgMedia = {
  id: string;
  caption?: string;
  permalink?: string;
  media_type?: string;
  media_url?: string;
  thumbnail_url?: string;
  comments?: { data: IgComment[] };
};

export async function instagramComments(igUserId: string, pageToken: string): Promise<SocialComment[]> {
  const res = await graph<{ data: IgMedia[] }>(
    `${igUserId}/media`,
    {
      fields: `id,caption,permalink,media_type,media_url,thumbnail_url,comments.limit(${COMMENTS}){id,text,username,timestamp,hidden,like_count,from,replies.limit(10){id,text,username,timestamp,from}}`,
      limit: POSTS,
    },
    pageToken,
  );
  const isUs = (c: IgComment) => c.from?.id === igUserId;
  return res.data.flatMap((m) =>
    (m.comments?.data ?? [])
      .filter((c) => !isUs(c))
      .map((c) => {
        const replies = (c.replies?.data ?? [])
          .map((r) => ({
            id: r.id,
            text: r.text ?? "",
            createdAt: r.timestamp,
            fromUs: isUs(r),
            authorName: isUs(r) ? "Tú" : r.username ? `@${r.username}` : "Alguien",
          }))
          .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
        return {
          id: c.id,
          network: "instagram" as const,
          post: {
            id: m.id,
            text: m.caption ?? "",
            permalink: m.permalink ?? null,
            image: safeMediaUrl(m.media_type === "VIDEO" ? m.thumbnail_url : m.media_url ?? m.thumbnail_url),
          },
          authorName: c.username ? `@${c.username}` : c.from?.username ? `@${c.from.username}` : "Alguien en Instagram",
          text: c.text ?? "",
          createdAt: c.timestamp,
          hidden: !!c.hidden,
          likeCount: c.like_count ?? 0,
          replies,
          answered: replies.some((r) => r.fromUs),
        };
      }),
  );
}

/** Comment ids are opaque Meta ids: digits, letters and "_". */
export const isCommentId = (id: string) => /^[A-Za-z0-9_]{4,120}$/.test(id);

async function graphPost(path: string, params: Record<string, string>, token: string, body?: unknown): Promise<Record<string, unknown>> {
  const url = new URL(`https://graph.facebook.com/v21.0/${path}`);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  url.searchParams.set("access_token", token);
  const res = await fetch(url, {
    method: "POST",
    ...(body ? { headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) } : {}),
    cache: "no-store",
  });
  const json = (await res.json().catch(() => ({}))) as { error?: { message?: string; code?: number; error_subcode?: number; error_user_msg?: string } };
  if (!res.ok || json.error) {
    const err = json.error ?? {};
    throw new MetaApiError(err.error_user_msg || err.message || `Meta respondió ${res.status}`, err.code);
  }
  return json as Record<string, unknown>;
}

/** Public answer under the comment, as the Page / Instagram account. */
export async function replyToComment(params: { network: CommentNetwork; commentId: string; text: string; pageToken: string }): Promise<void> {
  const edge = params.network === "facebook" ? "comments" : "replies";
  await graphPost(`${params.commentId}/${edge}`, { message: params.text }, params.pageToken);
}

/** Hidden comments stay visible only to their author and their friends. */
export async function setCommentHidden(params: { network: CommentNetwork; commentId: string; hidden: boolean; pageToken: string }): Promise<void> {
  const field = params.network === "facebook" ? "is_hidden" : "hide";
  await graphPost(params.commentId, { [field]: String(params.hidden) }, params.pageToken);
}

/**
 * Meta's "private reply": one Messenger / Instagram Direct message to the
 * person who commented, allowed once per comment and within 7 days of it.
 */
export async function privateReplyToComment(params: { pageId: string; commentId: string; text: string; pageToken: string }): Promise<void> {
  try {
    await graphPost(`${params.pageId}/messages`, {}, params.pageToken, { recipient: { comment_id: params.commentId }, message: { text: params.text } });
  } catch (err) {
    if (err instanceof MetaApiError && /already|ya se/i.test(err.message)) {
      throw new MetaApiError("Ya le enviaste un mensaje privado por este comentario: Meta solo deja uno.", err.code, true);
    }
    if (err instanceof MetaApiError && /7 days|7 días|too old|expired/i.test(err.message)) {
      throw new MetaApiError("Meta solo deja escribir por privado durante los 7 días siguientes al comentario.", err.code, true);
    }
    throw err;
  }
}
