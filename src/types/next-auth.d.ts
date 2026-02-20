import type { Role } from "@/generated/prisma";

declare module "next-auth" {
  interface User {
    role: Role;
    employeeId: string | null;
  }
  interface Session {
    user: {
      id: string;
      email: string;
      name: string;
      role: Role;
      employeeId: string | null;
    };
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    role: Role;
    employeeId: string | null;
  }
}
