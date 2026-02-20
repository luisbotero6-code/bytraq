import { initTRPC, TRPCError } from "@trpc/server";
import superjson from "superjson";
import { auth } from "../auth";
import { db } from "../db";
import type { Role } from "@/generated/prisma";

export async function createTRPCContext() {
  const session = await auth();
  return { db, session };
}

export type TRPCContext = Awaited<ReturnType<typeof createTRPCContext>>;

const t = initTRPC.context<TRPCContext>().create({
  transformer: superjson,
});

export const router = t.router;
export const publicProcedure = t.procedure;
export const createCallerFactory = t.createCallerFactory;

const isAuthed = t.middleware(({ ctx, next }) => {
  if (!ctx.session?.user) {
    throw new TRPCError({ code: "UNAUTHORIZED" });
  }
  return next({
    ctx: {
      session: ctx.session,
      user: ctx.session.user,
    },
  });
});

export const protectedProcedure = t.procedure.use(isAuthed);

export function requireRole(...roles: Role[]) {
  return t.middleware(({ ctx, next }) => {
    if (!ctx.session?.user) {
      throw new TRPCError({ code: "UNAUTHORIZED" });
    }
    if (!roles.includes((ctx.session.user as any).role)) {
      throw new TRPCError({ code: "FORBIDDEN" });
    }
    return next({
      ctx: {
        session: ctx.session,
        user: ctx.session.user,
      },
    });
  });
}
