import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { generateText } from "ai";

const google = createGoogleGenerativeAI({
  apiKey: process.env.GEMINI_API_KEY!,
});

export const geminiModel = google("gemini-2.5-flash-lite");

export async function analisarComGemini(prompt: string): Promise<string> {
  const { text } = await generateText({
    model: geminiModel,
    prompt,
    maxTokens: 8192,
  });
  return text;
}
