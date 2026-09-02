import { NextResponse } from "next/server";
import { getOrCreateRequestUser } from "@/lib/user";
import { prisma } from "@/lib/prisma";

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ chatId: string }> },
) {
  try {
    const { chatId } = await params;
    const user = await getOrCreateRequestUser();

    const chat = await prisma.chat.findFirst({
      where: {
        id: chatId,
        userId: user.id,
      },
      select: { id: true },
    });

    if (!chat) {
      return NextResponse.json(
        {
          success: false,
          message: "Chat not found",
        },
        { status: 404 },
      );
    }

    await prisma.chat.delete({
      where: { id: chat.id },
    });

    return NextResponse.json({
      success: true,
    });
  } catch (error) {
    console.error("Delete chat error:", error);

    return NextResponse.json(
      {
        success: false,
        message: "Could not delete chat",
      },
      { status: 500 },
    );
  }
}
