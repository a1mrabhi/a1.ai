import { GoogleGenAI } from "@google/genai";
import type { AIMessage } from "./index";

const gemini = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
});

export async function generateWithGemini(
  messages: AIMessage[]
): Promise<string> {
  const systemMessage = messages.find(
    (message) => message.role === "system"
  );

  const conversation = messages
    .filter((message) => message.role !== "system")
    .map((message) => ({
      role: message.role === "assistant" ? "model" : "user",
      parts: [{ text: message.content }],
    }));

  console.log("Gemini request:", {
  model: "gemini-3.6-flash",
  messageCount: conversation?.length,
  hasSystemMessage: !!systemMessage,
});

const response = await gemini.models.generateContent({
  model: "gemini-3.6-flash",
  contents: conversation,
  config: systemMessage
    ? {
        systemInstruction: systemMessage.content,
      }
    : undefined,
});

  const text = response.text;

  if (!text) {
    throw new Error("Gemini returned an empty response");
  }

  return text;
}