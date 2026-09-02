import { NextResponse } from "next/server";
import { getOrCreateRequestUser, isGuestUser } from "@/lib/user";
import { prisma } from "@/lib/prisma";

const GUEST_SMART_CHAT_LIMIT = 2;

// GET /api/chats
// Load all chats for the current authenticated or guest session.
export async function GET() {
  try {
    const user = await getOrCreateRequestUser();
    const guest = isGuestUser(user);

    const chats = await prisma.chat.findMany({
      where: {
        userId: user.id,
      },
      orderBy: {
        updatedAt: "desc",
      },
      select: {
        id: true,
        title: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    const guestMessageCount = guest
      ? user.guestSmartChatMessagesUsed
      : 0;

    return NextResponse.json({
      success: true,
      chats,
      guest: guest
        ? {
            messageCount: guestMessageCount,
            remainingMessages: Math.max(
              0,
              GUEST_SMART_CHAT_LIMIT - guestMessageCount,
            ),
            limitReached: guestMessageCount >= GUEST_SMART_CHAT_LIMIT,
          }
        : null,
    });
  } catch (error) {
    console.error("Get chats error:", error);

    return NextResponse.json(
      {
        success: false,
        message: "Could not load chats",
      },
      { status: 500 },
    );
  }
}

// POST /api/chats
// Create a new chat for the current authenticated or guest session.
export async function POST() {
  try {
    const user = await getOrCreateRequestUser();

    if (isGuestUser(user)) {
      if (user.guestSmartChatMessagesUsed >= GUEST_SMART_CHAT_LIMIT) {
        return NextResponse.json(
          {
            success: false,
            code: "GUEST_LIMIT_REACHED",
            message:
              "You have used your 2 free AI Smart Chat messages. Please log in or sign up to continue.",
          },
          { status: 429 },
        );
      }
    }

    const chat = await prisma.chat.create({
      data: {
        userId: user.id,
        title: "New Chat",
      },
    });

    return NextResponse.json({
      success: true,
      chat,
    });
  } catch (error) {
    console.error("Create chat error:", error);

    return NextResponse.json(
      {
        success: false,
        message: "Could not create chat",
      },
      { status: 500 },
    );
  }
}
