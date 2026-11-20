"use client";

import { useSyncExternalStore } from "react";

// Client side twin of isStoreApp() (see lib/storeApp.ts), for client components that
// must hide a purchase button. The cookie is not secret, so it is readable by the page.
const subscribe = () => () => {};
const read = () => /(?:^|;\s*)fl_app=(?:android|ios)(?:;|$)/.test(document.cookie);

/** true inside the Android / iPhone app from the stores (false on the server and on the web). */
export function useIsStoreApp(): boolean {
  return useSyncExternalStore(subscribe, read, () => false);
}
