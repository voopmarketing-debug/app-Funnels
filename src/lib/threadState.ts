// The team's own bookkeeping on each Messenger / Instagram conversation (Meta
// only knows the messages): read or unread, answered outside the platform
// (from the phone, in person) and closed, like the "three dots" menu of a CRM
// inbox. A new message from the customer reopens a closed or answered thread.

export type ThreadAction = "read" | "unread" | "answered" | "unanswered" | "close" | "reopen";
export const THREAD_ACTIONS: readonly ThreadAction[] = ["read", "unread", "answered", "unanswered", "close", "reopen"];

export type ThreadStateRow = { readAt: Date | null; resolvedAt: Date | null; answeredAt: Date | null; unreadAt: Date | null };

/** What each menu action writes. Answering or closing also reads the thread. */
export function threadPatch(action: ThreadAction, now: Date): Partial<ThreadStateRow> {
  switch (action) {
    case "read":
      return { readAt: now, unreadAt: null };
    case "unread":
      return { unreadAt: now };
    case "answered":
      return { answeredAt: now, readAt: now, unreadAt: null };
    case "unanswered":
      return { answeredAt: null };
    case "close":
      return { resolvedAt: now, readAt: now, unreadAt: null };
    case "reopen":
      return { resolvedAt: null, answeredAt: null };
  }
}

export type ThreadFlags = {
  unread: boolean;
  answered: boolean;
  closed: boolean;
  /** Unread because the customer wrote (opening the conversation reads it); a hand-made "unread" mark stays until it is cleared. */
  waiting: boolean;
};

/** The thread's flags now, from Meta's last activity and what the team marked. */
export function threadFlags(thread: { lastFromCustomer: boolean; updatedAt: string }, state: ThreadStateRow | null | undefined): ThreadFlags {
  const updated = Date.parse(thread.updatedAt);
  // Marks made before the customer's latest message don't hold anymore.
  const stillValid = (at: Date | null | undefined) => !!at && !(thread.lastFromCustomer && updated > at.getTime());
  const closed = stillValid(state?.resolvedAt);
  const answered = !closed && stillValid(state?.answeredAt);
  const waiting = thread.lastFromCustomer && (!state?.readAt || updated > state.readAt.getTime());
  const forced = !!state?.unreadAt && (!state.readAt || state.unreadAt.getTime() > state.readAt.getTime());
  return { unread: waiting || forced, answered, closed, waiting };
}
