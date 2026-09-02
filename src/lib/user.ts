import { randomBytes } from "node:crypto";
import { currentUser } from "@clerk/nextjs/server";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";

export const GUEST_SESSION_COOKIE = "a1_guest_session";
export const GUEST_SESSION_MAX_AGE = 60 * 60 * 24 * 365;

function guestClerkId(token: string) {
  return `guest:${token}`;
}

function isValidGuestToken(token: string) {
  return /^[a-f0-9]{64}$/.test(token);
}

async function upsertClerkUser(clerkUser: NonNullable<Awaited<ReturnType<typeof currentUser>>>) {
  const email = clerkUser.emailAddresses[0]?.emailAddress;

  if (!email) {
    throw new Error("Authenticated user does not have an email");
  }

  return prisma.user.upsert({
    where: {
      clerkId: clerkUser.id,
    },
    update: {
      email,
      name:
        [clerkUser.firstName, clerkUser.lastName]
          .filter(Boolean)
          .join(" ") || null,
      imageUrl: clerkUser.imageUrl,
    },
    create: {
      clerkId: clerkUser.id,
      email,
      name:
        [clerkUser.firstName, clerkUser.lastName]
          .filter(Boolean)
          .join(" ") || null,
      imageUrl: clerkUser.imageUrl,
    },
  });
}

/**
 * Existing authenticated-user lookup. This intentionally remains strict so
 * authenticated-only APIs do not silently become guest APIs.
 */
export async function getOrCreateUser() {
  const clerkUser = await currentUser();

  if (!clerkUser) {
    throw new Error("User is not authenticated");
  }

  return upsertClerkUser(clerkUser);
}

/**
 * Creates/loads the browser's anonymous guest account. The opaque 256-bit
 * token is stored in an HttpOnly cookie, while all guest usage is persisted
 * in PostgreSQL through the guest User row. Refreshes and new tabs therefore
 * resolve to the same server-side guest account.
 */
export async function getOrCreateGuestUser() {
  const cookieStore = await cookies();
  let token = cookieStore.get(GUEST_SESSION_COOKIE)?.value;
  let shouldSetCookie = false;

  if (!token || !isValidGuestToken(token)) {
    token = randomBytes(32).toString("hex");
    shouldSetCookie = true;
  }

  const clerkId = guestClerkId(token);

  const user = await prisma.user.upsert({
    where: {
      clerkId,
    },
    update: {},
    create: {
      clerkId,
      email: `guest-${token}@guest.a1.ai`,
      name: "Guest",
      imageUrl: null,
    },
  });

  // Backfill usage for any guest records created by an earlier deployment.
  // New sessions start at zero; claimed sessions retain their counters.
  if (user.guestSmartChatMessagesUsed === 0) {
    const existingMessageCount = await prisma.message.count({
      where: {
        role: "USER",
        chat: { userId: user.id },
      },
    });

    if (existingMessageCount > 0) {
      await prisma.user.update({
        where: { id: user.id },
        data: {
          guestSmartChatMessagesUsed: Math.min(2, existingMessageCount),
        },
      });
      user.guestSmartChatMessagesUsed = Math.min(2, existingMessageCount);
    }
  }

  if (user.guestAnalystUploadsUsed === 0) {
    const existingDatasetCount = await prisma.analystDataset.count({
      where: { userId: user.id },
    });

    if (existingDatasetCount > 0) {
      await prisma.user.update({
        where: { id: user.id },
        data: { guestAnalystUploadsUsed: 1 },
      });
      user.guestAnalystUploadsUsed = 1;
    }
  }

  if (shouldSetCookie) {
    cookieStore.set(GUEST_SESSION_COOKIE, token, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: GUEST_SESSION_MAX_AGE,
    });
  }

  return user;
}

export async function getOrCreateRequestUser() {
  const clerkUser = await currentUser();

  if (clerkUser) {
    return upsertClerkUser(clerkUser);
  }

  return getOrCreateGuestUser();
}

export function isGuestUser(user: { clerkId: string }) {
  return user.clerkId.startsWith("guest:");
}
