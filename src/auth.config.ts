import type { NextAuthConfig } from "next-auth";

type Role = "ADMIN" | "CLIENT";

// Edge-safe config shared with middleware. No Prisma / bcrypt here.
export const authConfig = {
  session: { strategy: "jwt" },
  pages: {
    signIn: "/login",
  },
  providers: [],
  callbacks: {
    jwt({ token, user }) {
      if (user) {
        token.role = (user as { role: Role }).role;
        token.companyId = (user as { companyId: string | null }).companyId;
      }
      return token;
    },
    session({ session, token }) {
      if (session.user) {
        session.user.id = token.sub as string;
        session.user.role = token.role as Role;
        session.user.companyId = token.companyId as string | null;
      }
      return session;
    },
    authorized({ auth, request }) {
      const { pathname } = request.nextUrl;
      const isLoggedIn = !!auth?.user;
      const role = auth?.user?.role;

      const isAdminArea = pathname.startsWith("/admin");
      const isPortalArea = pathname.startsWith("/dashboard") || isAdminArea;

      if (isPortalArea && !isLoggedIn) return false;
      if (isAdminArea && role !== "ADMIN") return false;

      return true;
    },
  },
} satisfies NextAuthConfig;
