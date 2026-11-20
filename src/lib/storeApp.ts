import { cookies } from "next/headers";

// The platform running inside the Android / iPhone app from the stores. Both stores
// forbid selling or collecting payment for the service inside their apps, so in this
// mode every purchase screen (prices, renewals, packs, sign-up and trial card) is
// hidden: the app is only for people who already have an account.
//
// The app opens the platform with ?app=android (or ios); the proxy turns that into a
// cookie, which lasts 12 hours and is renewed on every launch of the app. (On Android
// the app shares Chrome's cookies, so it is deliberately short-lived.)

export const STORE_APP_COOKIE = "fl_app";
export const STORE_APP_COOKIE_MAX_AGE = 12 * 60 * 60;

/** Paths of the public sales/sign-up pages: inside the store app they go straight to the login. */
export const STORE_APP_HIDDEN_PATHS = new Set(["/", "/oferta", "/register", "/gracias"]);

export function storeAppFromValue(value: string | null | undefined): value is "android" | "ios" {
  return value === "android" || value === "ios";
}

/** Whether this request comes from the store app (server side). */
export async function isStoreApp(): Promise<boolean> {
  return storeAppFromValue((await cookies()).get(STORE_APP_COOKIE)?.value);
}
