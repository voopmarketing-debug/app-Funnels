import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { isRateLimited, recordRateLimitEvent } from "@/lib/rateLimit";

const LOGIN_MAX_ATTEMPTS = 5;
const LOGIN_WINDOW_MS = 15 * 60 * 1000;

export const { handlers, auth, signIn, signOut } = NextAuth({
  trustHost: true, // self-hosted deploy behind a reverse proxy; host is validated by our own infra
  session: { strategy: "jwt" },
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
          console.warn("authentication_failed", { email, reason: "rate_limited" });
          return null;
        }

        const user = await prisma.user.findUnique({ where: { email } });
        if (!user) {
          await recordRateLimitEvent(rateLimitKey);
          console.warn("authentication_failed", { email, reason: "no_user" });
          return null;
        }

        const valid = await bcrypt.compare(password, user.passwordHash);
        if (!valid) {
          await recordRateLimitEvent(rateLimitKey);
          console.warn("authentication_failed", { email, reason: "bad_password" });
          return null;
        }

        return { id: user.id, email: user.email, name: user.name ?? undefined };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) token.id = user.id;
      return token;
    },
    async session({ session, token }) {
      if (session.user && token.id) session.user.id = token.id as string;
      return session;
    },
  },
});
