import { generateWithGemini } from "./gemini";
import { generateWithGroq } from "./groq";

export type AIMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

function shouldFallbackToGroq(error: unknown): boolean {
  const message =
    error instanceof Error
      ? error.message.toLowerCase()
      : String(error).toLowerCase();

  return (
    message.includes("429") ||
    message.includes("rate limit") ||
    message.includes("quota") ||
    message.includes("too many requests") ||
    message.includes("503") ||
    message.includes("service unavailable")
  );
}

export async function generateAIResponse(messages: AIMessage[]) {
  try {
    // 1. Try Gemini first
    const content = await generateWithGemini(messages);

    return {
      provider: "gemini",
      content,
    };
  } catch (error) {
    console.error("Gemini failed:", error);

    // 2. Only fallback for quota/rate-limit/temporary service errors
    if (!shouldFallbackToGroq(error)) {
      throw error;
    }

    console.log("Gemini unavailable. Falling back to Groq...");

    // 3. Try Groq
    const content = await generateWithGroq(messages);

    return {
      provider: "groq",
      content,
    };
  }
}