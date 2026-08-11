import { NextResponse } from "next/server";
import { generateAIResponse, type AIMessage } from "@/lib/ai";

export async function GET() {
  try {
    const messages: AIMessage[] = [
      {
        role: "system",
        content: "You are a helpful AI assistant.",
      },
      {
        role: "user",
        content: "Hello! Introduce yourself briefly.",
      },
    ];

    const result = await generateAIResponse(messages);

    return NextResponse.json({
      success: true,
      provider: result.provider,
      response: result.content,
    });
  } catch (error) {
    console.error("AI test error:", error);

    return NextResponse.json(
      {
        success: false,
        message: "AI request failed",
      },
      { status: 500 }
    );
  }
}