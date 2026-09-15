import type { AuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { rateLimit, clientIp } from "@/lib/rate-limit";

export const authOptions: AuthOptions = {
  session: { strategy: "jwt" },
  pages: {
    signIn: "/login",
  },
  providers: [
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials, req) {
        if (!credentials?.email || !credentials?.password) return null;

        const email = credentials.email.toLowerCase().trim();
        const ip = clientIp(req?.headers);

        // Two independent buckets: one caps attempts from a single IP (blunt
        // brute force), the other caps attempts against a single account
        // regardless of source IP (distributed credential stuffing). Either
        // limit hitting fails the same way a wrong password does — no
        // distinct error, so a blocked attempt can't be told apart from one
        // that just got the password wrong.
        if (!rateLimit(`login:ip:${ip}`, 15, 10 * 60 * 1000) || !rateLimit(`login:email:${email}`, 5, 10 * 60 * 1000)) {
          return null;
        }

        const coach = await prisma.coach.findUnique({ where: { email } });
        if (!coach) return null;

        const valid = await bcrypt.compare(credentials.password, coach.passwordHash);
        if (!valid) return null;

        return {
          id: coach.id,
          email: coach.email,
          name: coach.name,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.name = user.name ?? "";
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
        session.user.name = token.name as string;
      }
      return session;
    },
  },
  secret: process.env.NEXTAUTH_SECRET,
};
