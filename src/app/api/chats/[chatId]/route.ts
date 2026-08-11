import { NextResponse } from "next/server";
import { getOrCreateUser } from "@/lib/user";
import { prisma } from "@/lib/prisma";

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ chatId: string }> }
) {
  try {
    const { chatId } = await params;

    const user = await getOrCreateUser();

    // Make sure this chat belongs to the current user
    const chat = await prisma.chat.findFirst({
      where: {
        id: chatId,
        userId: user.id,
      },
    });

    if (!chat) {
      return NextResponse.json(
        {
          success: false,
          message: "Chat not found",
        },
        { status: 404 }
      );
    }

    // Delete messages first
    await prisma.message.deleteMany({
      where: {
        chatId,
      },
    });

    // Then delete the chat
    await prisma.chat.delete({
      where: {
        id: chatId,
      },
    });

    return NextResponse.json({
      success: true,
      message: "Chat deleted successfully",
    });
  } catch (error) {
    console.error("Delete chat error:", error);

    return NextResponse.json(
      {
        success: false,
        message: "Could not delete chat",
      },
      { status: 500 }
    );
  }
}