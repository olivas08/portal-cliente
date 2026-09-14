import type { NextAuthConfig } from "next-auth";
import type { Role } from "@/lib/roles";
import { isAdminRole } from "@/lib/roles";

// Edge-safe config shared with middleware. No Prisma / bcrypt here.
export const authConfig = {
  session: { strategy: "jwt" },
  pages: {
    signIn: "/login",
  },
  // Vercel + custom domain (test.operonfactory.com). Without this, Auth.js
  // waits on host checks when AUTH_URL / AUTH_TRUST_HOST are missing.
  trustHost: true,
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

      if (!isLoggedIn) return false;

      const isAdminSide = role ? isAdminRole(role) : false;

      // Logged in but wrong area for role → send to their own area.
      // Fine-grained per-section access (e.g. a Warehouse manager hitting
      // /admin/orcamentos) is enforced closer to the data, in each
      // page/action via requireAdminArea(), not here.
      if (pathname.startsWith("/admin") && !isAdminSide) {
        return Response.redirect(new URL("/dashboard", request.nextUrl));
      }
      if (pathname.startsWith("/dashboard") && isAdminSide) {
        return Response.redirect(new URL("/admin", request.nextUrl));
      }

      return true;
    },
  },
} satisfies NextAuthConfig;
