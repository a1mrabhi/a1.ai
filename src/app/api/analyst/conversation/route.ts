import { NextResponse } from "next/server";
import { getOrCreateRequestUser } from "@/lib/user";
import { prisma } from "@/lib/prisma";

export async function GET(request: Request) {
  try {
    const datasetId = new URL(request.url).searchParams.get("datasetId")?.trim();
    if (!datasetId) {
      return NextResponse.json({ success: false, error: "A dataset is required." }, { status: 400 });
    }

    const user = await getOrCreateRequestUser();
    const dataset = await prisma.analystDataset.findFirst({
      where: { id: datasetId, userId: user.id },
      select: { id: true },
    });
    if (!dataset) {
      return NextResponse.json({ success: false, error: "Dataset not found or access denied." }, { status: 404 });
    }

    const conversation = await prisma.analystConversation.findFirst({
      where: { datasetId: dataset.id },
      orderBy: { updatedAt: "desc" },
      select: {
        id: true,
        messages: {
          orderBy: { createdAt: "asc" },
          select: { id: true, role: true, content: true, createdAt: true },
        },
      },
    });

    return NextResponse.json({
      success: true,
      conversationId: conversation?.id ?? null,
      messages: conversation?.messages ?? [],
    });
  } catch (error) {
    console.error("Analyst conversation GET error:", error);
    return NextResponse.json({ success: false, error: "Could not load Analyst conversation." }, { status: 500 });
  }
}
