import Groq from "groq-sdk";
import type { AIMessage } from "./index";

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY,
});

export async function generateWithGroq(
  messages: AIMessage[]
): Promise<string> {
  const response = await groq.chat.completions.create({
    model: "openai/gpt-oss-120b",
    messages: messages.map((message) => ({
      role: message.role,
      content: message.content,
    })),
  });

  const text = response.choices[0]?.message?.content;

  if (!text) {
    throw new Error("Groq returned an empty response");
  }

  return text;
}