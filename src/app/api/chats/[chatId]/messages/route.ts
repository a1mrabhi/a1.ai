import { NextResponse } from "next/server";
import { getOrCreateRequestUser, isGuestUser } from "@/lib/user";
import { prisma } from "@/lib/prisma";
import { generateAIResponse } from "@/lib/ai";

// GET /api/chats/[chatId]/messages
// Load previous messages
export async function GET(
  request: Request,
  { params }: { params: Promise<{ chatId: string }> },
) {
  try {
    const { chatId } = await params;

    const user = await getOrCreateRequestUser();

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
        { status: 404 },
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
      { status: 500 },
    );
  }
}

// POST /api/chats/[chatId]/messages
// Send message + generate AI response
class GuestLimitError extends Error {
  constructor() {
    super("Guest Smart Chat limit reached");
    this.name = "GuestLimitError";
  }
}

const SMART_CHAT_GUEST_LIMIT = 2;

const SMART_CHAT_SYSTEM_PROMPT = `You are the AI assistant inside a smart chat application. Respond naturally, clearly, and helpfully, like a high-quality general-purpose AI assistant.

RESPONSE STYLE:
- Let the user's actual request determine the response length. Never make every answer long.
- SIMPLE QUESTIONS: For simple factual questions, short definitions, quick calculations, yes/no questions, greetings, or straightforward requests, answer briefly and directly—usually 1-3 sentences.
- NORMAL CONVERSATION: Respond naturally and concisely. Use a short heading or bullet points when they genuinely make the answer easier to read, but do not force a list onto a conversational response.
- COMPLEX / HOW-TO / PLANNING / TROUBLESHOOTING: Give enough detail to be genuinely useful. Use headings, numbered steps, and bullet points when they improve clarity. Do not stop at a generic one-sentence answer when the user needs a solution.
- DEFINITIONS AND LEARNING: If the user asks to "define", "explain", "what does X mean", or asks about a concept/word that benefits from explanation, give an appropriately clear explanation. Include an example or brief context when useful. The answer can be longer when the concept actually requires it, but do not add unnecessary detail.
- "HOW" DOES NOT ALWAYS MEAN LONG: A simple "how do I do X?" can be answered briefly if the task is straightforward. Increase detail when the task has multiple steps, decisions, caveats, or troubleshooting needs.
- Match the response to the complexity and intent of the question—not to a fixed response length.
- Use Markdown naturally. Bold key terms and use bullets/headings when they improve readability.
- Never repeat the user's question back to them.
- Avoid filler such as "Great question!", "Sure, here's...", or "Absolutely!" unless it genuinely fits the conversation.

FOLLOW-UP SUGGESTIONS:
- Try to give one useful, natural follow-up suggestion at the end of responses when there is a meaningful next step.
- The suggestion must be relevant to what the user just asked and should feel helpful, not promotional or repetitive.
- Examples: "If you want, I can give you a simple example." "If you want, I can help you apply this to your project." "If you need this tailored to your situation, I can help with that."
- Do NOT force a suggestion when there is genuinely no useful next step (for example, a pure yes/no answer or a completed calculation).
- Keep the suggestion short—normally one sentence.
- Never use the suggestion as filler to make a response longer.

CONVERSATION:
- Remember and use context from earlier messages in the same conversation.
- For short follow-ups such as "what about X?", "and Y?", or "ok then what?", infer the relevant context instead of treating the message as a brand-new question.
- If something is ambiguous, ask a concise clarifying question rather than inventing details.
- For health, legal, financial, or other high-stakes topics, be careful, transparent about uncertainty, and encourage appropriate professional help when needed.

IMPORTANT:
- There is no fixed minimum or maximum answer length.
- Be as short as the question deserves and as detailed as the question requires.
- A response should become long only when the user's request, the complexity of the topic, or the need for explanation genuinely calls for it.`;


const A1_AI_ABOUT_RESPONSE = `**A1.ai** is an AI workspace that brings **AI Smart Chat** and **AI Data Analyst** into one place.

- **AI Smart Chat:** Ask questions, get explanations, brainstorm, plan, troubleshoot, and work with documents.
- **AI Data Analyst:** Upload CSV/Excel data and get patterns, trends, anomalies, summaries, and actionable insights.
- Built to give you one focused workspace instead of switching between multiple AI tools.

A1.ai is **free to start**.`;

const A1_AI_FOUNDER_RESPONSE = `The founder of **A1.ai is Abhishek Kumar Tiwari**, a software developer.

You can contact him here:
- 💼 LinkedIn: https://www.linkedin.com/in/abhishek-tiwari-b248a63a6/
- 💻 GitHub: https://github.com/a1mrabhi
- 📸 Instagram: https://instagram.com/abhishektiwari._.1
- ✉️ Email: abhirta1@gmail.com`;

const A1_AI_FAQ_RESPONSES: Array<{ pattern: RegExp; response: string }> = [
  {
    pattern: /\b(features?|capabilities|what\s+can\s+(?:a1(?:\.ai)?|a1\s*ai)\s+do)\b/i,
    response: `A1.ai combines two main experiences:

- **AI Smart Chat** — natural AI conversations for questions, explanations, brainstorming, planning, troubleshooting, and document-based work.
- **AI Data Analyst** — upload CSV/Excel datasets to discover patterns, trends, anomalies, summaries, comparisons, and actionable business insights.

The goal is to keep these AI workflows in one focused workspace.`,
  },
  {
    pattern: /\bhow\s+does\s+(?:a1(?:\.ai)?|a1\s*ai)\s+work\b/i,
    response: `A1.ai works as a focused AI workspace:

1. Use **AI Smart Chat** for conversations, questions, explanations, planning, and document work.
2. Use **AI Data Analyst** when you have CSV/Excel data.
3. A1.ai analyzes the information and turns it into useful answers, patterns, trends, and insights.

You can start with the workflow that matches what you're trying to do.`,
  },
  {
    pattern: /\bis\s+(?:a1(?:\.ai)?|a1\s*ai)\s+(?:free|free\s+to\s+use)\b/i,
    response: `Yes. **A1.ai is free to start**, so you can try the core experience without a paid subscription.`,
  },
  {
    pattern: /\bhow\s+can\s+i\s+use\s+(?:the\s+)?(?:ai\s+)?smart\s+chat\b/i,
    response: `Open **AI Smart Chat** and type what you need help with. You can ask questions, request explanations, brainstorm ideas, plan tasks, troubleshoot problems, or work with supported documents.

Just describe what you want in natural language and continue the conversation with follow-up questions.`,
  },
  {
    pattern: /\bwhat\s+is\s+(?:the\s+)?ai\s+data\s+analyst\b|\bwhat\s+is\s+a\s+data\s+analyst\s+in\s+(?:a1(?:\.ai)?|a1\s*ai)\b/i,
    response: `**AI Data Analyst** is A1.ai's data-analysis workspace. You upload a CSV or Excel dataset, and it can help you understand the data through **patterns, trends, anomalies, comparisons, summaries, and actionable insights**.

It is designed to turn raw business data into answers you can actually use.`,
  },
  {
    pattern: /\bwhat\s+(?:file\s+types?|formats?)\s+can\s+i\s+upload\b|\bwhat\s+files?\s+can\s+i\s+upload\s+to\s+(?:a1(?:\.ai)?|a1\s*ai)\b/i,
    response: `For **AI Data Analyst**, A1.ai supports **CSV and Excel files** for dataset analysis.

Upload your dataset and the analyst can work with the available columns and rows to answer questions and find useful insights.`,
  },
  {
    pattern: /\bhow\s+can\s+i\s+contact\s+(?:the\s+)?founder\b|\bcontact\s+(?:the\s+)?founder\b/i,
    response: A1_AI_FOUNDER_RESPONSE,
  },
];

function normalizeA1Question(value: string) {
  return value
    .toLowerCase()
    .replace(/\ba1\s*\.?\s*ai\b/g, "a1.ai")
    .replace(/\s+/g, " ")
    .trim();
}

function getHardcodedA1Response(content: string): string | null {
  const normalized = normalizeA1Question(content);

  const mentionsA1 =
    /\ba1\.ai\b|\ba1\s*ai\b/i.test(normalized);

  if (!mentionsA1) return null;

  if (
    /\b(founder|founding|created|creator|who\s+(?:is|was)|who\s+founded|owner)\b/i.test(
      normalized,
    ) &&
    /\ba1\.ai\b/i.test(normalized)
  ) {
    return A1_AI_FOUNDER_RESPONSE;
  }

  for (const item of A1_AI_FAQ_RESPONSES) {
    if (item.pattern.test(normalized)) {
      return item.response;
    }
  }

  // Catch direct "what is A1.ai" variations, including longer wording.
  if (
    /\bwhat\s+(?:exactly\s+)?is\b/i.test(normalized) &&
    /\ba1\.ai\b/i.test(normalized)
  ) {
    return A1_AI_ABOUT_RESPONSE;
  }

  // If a user asks a broad product question containing A1.ai, keep the answer
  // deterministic instead of sending it to the model.
  if (
    /\b(a1\.ai|a1\s*ai)\b/i.test(normalized) &&
    /\b(product|platform|app|application|workspace|software|tool|service|company)\b/i.test(
      normalized,
    )
  ) {
    return A1_AI_ABOUT_RESPONSE;
  }

  return null;
}

async function reserveGuestMessage(
  userId: string,
  chatId: string,
  content: string,
) {
  return prisma.$transaction(async (tx) => {
    // Serialize guest message requests for this anonymous account. This is
    // what prevents two browser tabs from spending the same final slot at
    // the same time.
    await tx.$queryRaw`SELECT id FROM "User" WHERE id = ${userId} FOR UPDATE`;

    const guestUser = await tx.user.findUnique({
      where: { id: userId },
      select: { guestSmartChatMessagesUsed: true },
    });

    if (!guestUser || guestUser.guestSmartChatMessagesUsed >= SMART_CHAT_GUEST_LIMIT) {
      throw new GuestLimitError();
    }

    const usedMessages = guestUser.guestSmartChatMessagesUsed;

    const chat = await tx.chat.findFirst({
      where: {
        id: chatId,
        userId,
      },
    });

    if (!chat) {
      throw new Error("Chat not found");
    }

    const userMessage = await tx.message.create({
      data: {
        role: "USER",
        content,
        chatId,
      },
    });

    await tx.user.update({
      where: { id: userId },
      data: {
        guestSmartChatMessagesUsed: { increment: 1 },
      },
    });

    if (chat.title === "New Chat") {
      const title = content.length > 40 ? `${content.substring(0, 40)}...` : content;

      await tx.chat.update({
        where: { id: chatId },
        data: { title },
      });
    }

    return {
      userMessage,
      usedMessages: usedMessages + 1,
    };
  });
}

// POST /api/chats/[chatId]/messages
// Send message + generate AI response.
export async function POST(
  request: Request,
  { params }: { params: Promise<{ chatId: string }> },
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
        { status: 400 },
      );
    }

    const user = await getOrCreateRequestUser();

    if (isGuestUser(user)) {
      let reservation: Awaited<ReturnType<typeof reserveGuestMessage>>;

      try {
        reservation = await reserveGuestMessage(user.id, chatId, content);
      } catch (error) {
        if (error instanceof GuestLimitError) {
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

        if (error instanceof Error && error.message === "Chat not found") {
          return NextResponse.json(
            {
              success: false,
              message: "Chat not found",
            },
            { status: 404 },
          );
        }

        throw error;
      }

      try {
        const messages = await prisma.message.findMany({
          where: { chatId },
          orderBy: { createdAt: "asc" },
        });

        const hardcodedResponse = getHardcodedA1Response(content);

        if (hardcodedResponse) {
          const assistantMessage = await prisma.message.create({
            data: {
              role: "ASSISTANT",
              content: hardcodedResponse,
              chatId,
            },
          });

          return NextResponse.json({
            success: true,
            provider: "hardcoded",
            usedMessages: reservation.usedMessages,
            remainingMessages: Math.max(
              0,
              SMART_CHAT_GUEST_LIMIT - reservation.usedMessages,
            ),
            userMessage: reservation.userMessage,
            assistantMessage,
          });
        }

        const aiMessages = [
          {
            role: "system" as const,
            content: SMART_CHAT_SYSTEM_PROMPT,
          },
          ...messages.map((message) => ({
            role:
              message.role === "USER"
                ? ("user" as const)
                : ("assistant" as const),
            content: message.content,
          })),
        ];

        const aiResponse = await generateAIResponse(aiMessages);

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
          usedMessages: reservation.usedMessages,
          remainingMessages: Math.max(
            0,
            SMART_CHAT_GUEST_LIMIT - reservation.usedMessages,
          ),
          userMessage: reservation.userMessage,
          assistantMessage,
        });
      } catch (error) {
        // AI generation failed after reserving a slot. Remove the reservation
        // so a failed request does not permanently consume guest usage.
        await prisma.$transaction([
          prisma.message.deleteMany({
            where: {
              id: reservation.userMessage.id,
              chatId,
              role: "USER",
            },
          }),
          prisma.user.update({
            where: { id: user.id },
            data: {
              guestSmartChatMessagesUsed: { decrement: 1 },
            },
          }),
        ]);
        throw error;
      }
    }

    // ------------------------------------------------------------
    // Existing authenticated flow — intentionally unchanged.
    // ------------------------------------------------------------

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
        { status: 404 },
      );
    }

    const userMessage = await prisma.message.create({
      data: {
        role: "USER",
        content,
        chatId,
      },
    });

    if (chat.title === "New Chat") {
      const title =
        content.length > 40 ? `${content.substring(0, 40)}...` : content;

      await prisma.chat.update({
        where: {
          id: chatId,
        },
        data: {
          title,
        },
      });
    }

    const messages = await prisma.message.findMany({
      where: {
        chatId,
      },
      orderBy: {
        createdAt: "asc",
      },
    });

    const hardcodedResponse = getHardcodedA1Response(content);

    if (hardcodedResponse) {
      const assistantMessage = await prisma.message.create({
        data: {
          role: "ASSISTANT",
          content: hardcodedResponse,
          chatId,
        },
      });

      return NextResponse.json({
        success: true,
        provider: "hardcoded",
        userMessage,
        assistantMessage,
      });
    }

    const aiMessages = [
      {
        role: "system" as const,
        content: SMART_CHAT_SYSTEM_PROMPT,
      },
      ...messages.map((message) => ({
        role:
          message.role === "USER" ? ("user" as const) : ("assistant" as const),
        content: message.content,
      })),
    ];

    const aiResponse = await generateAIResponse(aiMessages);

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
      { status: 500 },
    );
  }
}