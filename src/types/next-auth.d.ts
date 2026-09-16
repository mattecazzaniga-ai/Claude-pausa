import type { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      selfCoaching: boolean;
    } & DefaultSession["user"];
  }

  interface User {
    selfCoaching: boolean;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string;
    selfCoaching: boolean;
  }
}
