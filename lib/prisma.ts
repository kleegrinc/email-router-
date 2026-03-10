// lib/prisma.ts
import { PrismaClient } from "@prisma/client";

declare global {
    // avoid multiple Prisma instances during hot reload
    var prisma: PrismaClient | undefined;
}

// Fail fast in production if DB URL is missing (e.g. not set on Render)
if (process.env.NODE_ENV === "production" && !process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is not set. Set it in Render → Environment.");
}

export const prisma =
    global.prisma ||
    new PrismaClient({
        log: process.env.NODE_ENV === "production" ? ["error"] : ["query"],
    });

if (process.env.NODE_ENV !== "production") global.prisma = prisma;
