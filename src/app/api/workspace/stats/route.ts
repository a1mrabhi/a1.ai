import { NextResponse } from "next/server";
import { getOrCreateUser } from "@/lib/user";
import { prisma } from "@/lib/prisma";

// GET /api/workspace/stats
// Returns counts for the dashboard's "Your Workspace" card
export async function GET() {
  try {
    const user = await getOrCreateUser();

    const chatsCount = await prisma.chat.count({
      where: {
        userId: user.id,
      },
    });

    // TODO: wire these up once PDF / Study Notes have their own
    // Prisma models and API routes (they don't exist yet — only
    // `chat` is in the schema right now). Returning 0 in the
    // meantime instead of guessing at model names that may not exist.
    const pdfsCount = 0;
    const studyNotesCount = 0;

    return NextResponse.json({
      success: true,
      chats: chatsCount,
      pdfs: pdfsCount,
      studyNotes: studyNotesCount,
    });
  } catch (error) {
    console.error("Get workspace stats error:", error);

    return NextResponse.json(
      {
        success: false,
        message: "Could not load workspace stats",
      },
      { status: 500 },
    );
  }
}