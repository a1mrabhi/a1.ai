import { NextResponse } from "next/server";
import { getOrCreateUser } from "@/lib/user";
import { prisma } from "@/lib/prisma";
import { generateAIResponse } from "@/lib/ai";

// GET /api/chats/[chatId]/messages
// Load previous messages
export async function GET(
  request: Request,
  { params }: { params: Promise<{ chatId: string }> }
) {
  try {
    const { chatId } = await params;

    const user = await getOrCreateUser();

    // Make sure chat belongs to current user
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

    const messages = await prisma.message.findMany({
      where: {
        chatId,
      },
      orderBy: {
        createdAt: "asc",
      },
    });

    return NextResponse.json({
      success: true,
      messages,
    });
  } catch (error) {
    console.error("Get messages error:", error);

    return NextResponse.json(
      {
        success: false,
        message: "Could not load messages",
      },
      { status: 500 }
    );
  }
}

// POST /api/chats/[chatId]/messages
// Send message + generate AI response
export async function POST(
  request: Request,
  { params }: { params: Promise<{ chatId: string }> }
) {
  try {
    const { chatId } = await params;

    const body = await request.json();
    const content = body.content?.trim();

    if (!content) {
      return NextResponse.json(
        {
          success: false,
          message: "Message content is required",
        },
        { status: 400 }
      );
    }

    const user = await getOrCreateUser();

    // Make sure chat belongs to current user
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

    // Save user's message
    const userMessage = await prisma.message.create({
      data: {
        role: "USER",
        content,
        chatId,
      },
    });

    // Give chat a title based on first message
    if (chat.title === "New Chat") {
      const title =
        content.length > 40
          ? `${content.substring(0, 40)}...`
          : content;

      await prisma.chat.update({
        where: {
          id: chatId,
        },
        data: {
          title,
        },
      });
    }

    // Get complete conversation history
    const messages = await prisma.message.findMany({
      where: {
        chatId,
      },
      orderBy: {
        createdAt: "asc",
      },
    });

    // Convert DB messages to AI messages
const aiMessages = [
  {
    role: "system" as const,
    content: `
You are the AI assistant inside a smart chat application.

Be helpful, natural, and concise.

Rules:
- For simple greetings, give a short friendly response.
- For simple questions, answer directly without unnecessary detail.
- Do not give long introductions unless the user asks for one.
- Do not list everything you can do unless the user asks "what can you do?"
- Match the length of your answer to the user's question.
- Give detailed explanations only when the user asks for details.
- Use bullets or short paragraphs when they improve readability.
- Never repeat the user's question unnecessarily.
`,
  },

  ...messages.map((message) => ({
    role:
      message.role === "USER"
        ? ("user" as const)
        : ("assistant" as const),
    content: message.content,
  })),
];

// Gemini → Groq fallback
const aiResponse = await generateAIResponse(aiMessages);

    // Save AI response
    const assistantMessage = await prisma.message.create({
      data: {
        role: "ASSISTANT",
        content: aiResponse.content,
        chatId,
      },
    });

    return NextResponse.json({
      success: true,
      provider: aiResponse.provider,
      userMessage,
      assistantMessage,
    });
  } catch (error) {
    console.error("Send message error:", error);

    return NextResponse.json(
      {
        success: false,
        message: "Could not send message",
      },
      { status: 500 }
    );
  }
}