import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { cache } from "react";
import { isRateLimited, recordRateLimitEvent } from "@/lib/rateLimit";
import { maskEmail } from "@/lib/logPrivacy";

const LOGIN_MAX_ATTEMPTS = 5;
const LOGIN_WINDOW_MS = 15 * 60 * 1000;

// Compared against when the email doesn't exist, so a wrong email takes as
// long as a wrong password and response times don't reveal which emails
// have an account. (The hash of a random string nobody knows.)
const DUMMY_PASSWORD_HASH = "$2b$12$8qMbXmWtXSeZi1dksqES2ubIC4GfjVxgOm7ggs4wYj1o.OEtCa9Re";

// The account's current session version, once per request (auth() runs the
// jwt callback on every call). Null when the account no longer exists.
const currentSessionVersion = cache(async (userId: string): Promise<number | null> => {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { sessionVersion: true } });
  return user ? user.sessionVersion : null;
});

export const { handlers, auth, signIn, signOut } = NextAuth({
  trustHost: true, // self-hosted deploy behind a reverse proxy; host is validated by our own infra
  // Rolling: an active user stays signed in; 14 idle days signs them out.
  session: { strategy: "jwt", maxAge: 14 * 24 * 60 * 60 },
  pages: { signIn: "/login" },
  providers: [
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      authorize: async (credentials) => {
        const email = credentials?.email as string | undefined;
        const password = credentials?.password as string | undefined;
        if (!email || !password) return null;

        const rateLimitKey = `login:${email.toLowerCase()}`;
        if (await isRateLimited(rateLimitKey, LOGIN_MAX_ATTEMPTS, LOGIN_WINDOW_MS)) {
          console.warn("authentication_failed", { email: maskEmail(email), reason: "rate_limited" });
          return null;
        }

        const user = await prisma.user.findUnique({ where: { email } });
        if (!user) {
          await bcrypt.compare(password, DUMMY_PASSWORD_HASH);
          await recordRateLimitEvent(rateLimitKey);
          console.warn("authentication_failed", { email: maskEmail(email), reason: "no_user" });
          return null;
        }

        const valid = await bcrypt.compare(password, user.passwordHash);
        if (!valid) {
          await recordRateLimitEvent(rateLimitKey);
          console.warn("authentication_failed", { email: maskEmail(email), reason: "bad_password" });
          return null;
        }

        return { id: user.id, email: user.email, name: user.name ?? undefined, sessionVersion: user.sessionVersion };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.sv = (user as { sessionVersion?: number }).sessionVersion ?? 0;
        return token;
      }
      // A password change or reset bumps the account's sessionVersion: every
      // session signed before it (another device, a stolen cookie) ends here.
      // Returning null deletes the session cookie. Sessions from before this
      // check existed carry no sv and count as version 0.
      if (typeof token.id === "string") {
        const current = await currentSessionVersion(token.id);
        if (current === null || current !== ((token.sv as number | undefined) ?? 0)) return null;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user && token.id) session.user.id = token.id as string;
      return session;
    },
  },
});
