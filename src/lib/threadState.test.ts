import { describe, expect, it } from "vitest";
import { threadFlags, threadPatch, type ThreadStateRow } from "./threadState";

const at = (iso: string) => new Date(iso);
const state = (over: Partial<ThreadStateRow> = {}): ThreadStateRow => ({ readAt: null, resolvedAt: null, answeredAt: null, unreadAt: null, ...over });
const thread = (over: Partial<{ lastFromCustomer: boolean; updatedAt: string }> = {}) => ({ lastFromCustomer: true, updatedAt: "2026-10-10T10:00:00Z", ...over });

describe("threadFlags", () => {
  it("is unread while the customer's last message hasn't been read", () => {
    expect(threadFlags(thread(), undefined)).toEqual({ unread: true, answered: false, closed: false, waiting: true });
    expect(threadFlags(thread(), state({ readAt: at("2026-10-10T11:00:00Z") })).unread).toBe(false);
    expect(threadFlags(thread({ lastFromCustomer: false }), undefined).unread).toBe(false);
  });

  it("marking as unread works even when the last message is ours", () => {
    const read = at("2026-10-10T11:00:00Z");
    expect(threadFlags(thread({ lastFromCustomer: false }), state({ readAt: read, unreadAt: at("2026-10-11T09:00:00Z") })).unread).toBe(true);
    // Reading it again clears the mark.
    expect(threadFlags(thread({ lastFromCustomer: false }), state({ readAt: at("2026-10-11T10:00:00Z"), unreadAt: at("2026-10-11T09:00:00Z") })).unread).toBe(false);
  });

  it("closed and answered marks end when the customer writes again", () => {
    const marked = state({ resolvedAt: at("2026-10-10T12:00:00Z"), readAt: at("2026-10-10T12:00:00Z") });
    expect(threadFlags(thread({ lastFromCustomer: false }), marked)).toMatchObject({ closed: true });
    expect(threadFlags(thread({ lastFromCustomer: true, updatedAt: "2026-10-10T10:00:00Z" }), marked)).toMatchObject({ closed: true });
    expect(threadFlags(thread({ lastFromCustomer: true, updatedAt: "2026-10-11T08:00:00Z" }), marked)).toEqual({ unread: true, answered: false, closed: false, waiting: true });

    const answered = state({ answeredAt: at("2026-10-10T12:00:00Z"), readAt: at("2026-10-10T12:00:00Z") });
    expect(threadFlags(thread(), answered)).toEqual({ unread: false, answered: true, closed: false, waiting: false });
    expect(threadFlags(thread({ updatedAt: "2026-10-11T08:00:00Z" }), answered).answered).toBe(false);
  });

  it("a closed thread is not also shown as answered", () => {
    const both = state({ resolvedAt: at("2026-10-10T12:00:00Z"), answeredAt: at("2026-10-10T11:00:00Z"), readAt: at("2026-10-10T12:00:00Z") });
    expect(threadFlags(thread(), both)).toMatchObject({ closed: true, answered: false });
  });
});

describe("threadPatch", () => {
  const now = at("2026-10-12T09:00:00Z");
  it("answering or closing also reads the thread", () => {
    expect(threadPatch("answered", now)).toEqual({ answeredAt: now, readAt: now, unreadAt: null });
    expect(threadPatch("close", now)).toEqual({ resolvedAt: now, readAt: now, unreadAt: null });
  });
  it("reopening clears both marks", () => {
    expect(threadPatch("reopen", now)).toEqual({ resolvedAt: null, answeredAt: null });
    expect(threadPatch("unanswered", now)).toEqual({ answeredAt: null });
  });
});
