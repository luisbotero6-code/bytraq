import type { NextAuthConfig } from "next-auth";

export const authConfig = {
  callbacks: {
    jwt({ token, user }) {
      if (user) {
        token.role = (user as any).role;
        token.employeeId = (user as any).employeeId;
      }
      return token;
    },
    session({ session, token }) {
      if (session.user) {
        session.user.id = token.sub!;
        (session.user as any).role = token.role;
        (session.user as any).employeeId = token.employeeId;
      }
      return session;
    },
    authorized({ auth, request: { nextUrl } }) {
      const isLoggedIn = !!auth?.user;
      const isPublic = nextUrl.pathname.startsWith("/login") || nextUrl.pathname.startsWith("/api/auth");
      const isApi = nextUrl.pathname.startsWith("/api/trpc");

      if (isPublic || isApi) return true;
      if (!isLoggedIn) return false;

      // Admin routes
      if (nextUrl.pathname.startsWith("/admin")) {
        const role = (auth?.user as any)?.role;
        if (!["ADMIN", "BYRALEDNING"].includes(role)) {
          return Response.redirect(new URL("/dashboard", nextUrl));
        }
      }

      return true;
    },
  },
  pages: {
    signIn: "/login",
  },
  session: { strategy: "jwt" },
  providers: [], // Added in auth.ts
} satisfies NextAuthConfig;
