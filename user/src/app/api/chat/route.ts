import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";

// Basic Finna runs on Claude (Anthropic / Claude Console).
// Default to Opus 4.8; override with ANTHROPIC_MODEL if desired.
const MODEL = process.env.ANTHROPIC_MODEL || "claude-opus-4-8";

const client = new Anthropic(); // reads ANTHROPIC_API_KEY from the environment

export async function POST(req: NextRequest) {
  const { messages, isDashboard, language } = await req.json();

  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({
      content: "Finna isn't configured yet — no Anthropic API key is set.",
    });
  }

  let system = isDashboard
    ? "You are Finna, Finquanta's AI financial assistant. Help small-business owners with budgeting, expenses, cash flow, bookkeeping and general financial questions. Be friendly, practical and concise. Respond directly with the answer — no preamble and no visible step-by-step reasoning."
    : "You are Finna, Finquanta's assistant. Answer questions about Finquanta, an AI fintech platform that automates bookkeeping and financial operations for small businesses. Be friendly and concise.";

  if (language && language !== "en") {
    system += ` Reply in the user's language (language code: ${language}).`;
  }

  const anthropicMessages: Anthropic.MessageParam[] = (messages ?? [])
    .filter((m: { content?: string }) => m && typeof m.content === "string" && m.content.trim())
    .map((m: { role: string; content: string }) => ({
      role: m.role === "assistant" ? "assistant" : "user",
      content: m.content,
    }));

  if (anthropicMessages.length === 0) {
    return NextResponse.json({ content: "Hi, I'm Finna! How can I help with your finances today?" });
  }

  try {
    const response = await client.messages.create({
      model: MODEL,
      max_tokens: 1024,
      system,
      messages: anthropicMessages,
    });

    if (response.stop_reason === "refusal") {
      return NextResponse.json({ content: "Sorry, I can't help with that one. Try asking me something about your finances." });
    }

    const text = response.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join("")
      .trim();

    return NextResponse.json({ content: text || "Sorry, I couldn't process that." });
  } catch (err) {
    console.error("Finna (Claude) error:", err);
    return NextResponse.json(
      { content: "Sorry, I'm having trouble right now. Please try again in a moment." },
      { status: 500 }
    );
  }
}
