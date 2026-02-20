"use client";

import { useSession } from "next-auth/react";
import type { Role } from "@/generated/prisma";

export function useCurrentUser() {
  const { data: session, status } = useSession();

  return {
    user: session?.user
      ? {
          id: session.user.id,
          name: session.user.name ?? "",
          email: session.user.email ?? "",
          role: (session.user as any).role as Role,
          employeeId: (session.user as any).employeeId as string | null,
        }
      : null,
    isLoading: status === "loading",
    isAuthenticated: status === "authenticated",
  };
}
