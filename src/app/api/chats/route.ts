import { NextResponse } from "next/server";
import { getOrCreateUser } from "@/lib/user";
import { prisma } from "@/lib/prisma";

// GET /api/chats
// Load all chats for the current user
export async function GET() {
  try {
    const user = await getOrCreateUser();

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

    return NextResponse.json({
      success: true,
      chats,
    });
  } catch (error) {
    console.error("Get chats error:", error);

    return NextResponse.json(
      {
        success: false,
        message: "Could not load chats",
      },
      { status: 500 }
    );
  }
}

// POST /api/chats
// Create a new chat
export async function POST() {
  try {
    const user = await getOrCreateUser();

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
      { status: 500 }
    );
  }
}