import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getOrCreateUser, GUEST_SESSION_COOKIE } from "@/lib/user";
import { prisma } from "@/lib/prisma";

function isValidGuestToken(token: string) {
  return /^[a-f0-9]{64}$/.test(token);
}

export async function POST() {
  try {
    const authenticatedUser = await getOrCreateUser();
    const cookieStore = await cookies();
    const token = cookieStore.get(GUEST_SESSION_COOKIE)?.value;

    if (!token || !isValidGuestToken(token)) {
      return NextResponse.json({
        success: true,
        claimed: false,
        transferredChatIds: [],
        transferredDatasetIds: [],
      });
    }

    const guestUser = await prisma.user.findUnique({
      where: {
        clerkId: `guest:${token}`,
      },
      select: {
        id: true,
        clerkId: true,
      },
    });

    if (!guestUser || !guestUser.clerkId.startsWith("guest:")) {
      return NextResponse.json({
        success: true,
        claimed: false,
        transferredChatIds: [],
        transferredDatasetIds: [],
      });
    }

    if (guestUser.id === authenticatedUser.id) {
      return NextResponse.json({
        success: true,
        claimed: false,
        transferredChatIds: [],
        transferredDatasetIds: [],
      });
    }

    const result = await prisma.$transaction(async (tx) => {
      const chats = await tx.chat.findMany({
        where: { userId: guestUser.id },
        select: { id: true },
      });

      const datasets = await tx.analystDataset.findMany({
        where: { userId: guestUser.id },
        select: { id: true },
      });

      await tx.chat.updateMany({
        where: { userId: guestUser.id },
        data: { userId: authenticatedUser.id },
      });

      await tx.analystDataset.updateMany({
        where: { userId: guestUser.id },
        data: { userId: authenticatedUser.id },
      });

      return {
        transferredChatIds: chats.map((chat) => chat.id),
        transferredDatasetIds: datasets.map((dataset) => dataset.id),
      };
    });

    // Keep the guest-session cookie after claiming. This is intentional:
    // if the user later signs out, the browser must still resolve to the same
    // exhausted guest account instead of receiving another free trial.

    return NextResponse.json({
      success: true,
      claimed: result.transferredChatIds.length > 0 || result.transferredDatasetIds.length > 0,
      ...result,
    });
  } catch (error) {
    console.error("Guest claim error:", error);

    return NextResponse.json(
      {
        success: false,
        error: "Could not transfer the guest session.",
      },
      { status: 500 },
    );
  }
}
