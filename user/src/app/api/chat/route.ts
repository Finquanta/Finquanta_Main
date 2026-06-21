import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";

// Basic Finna runs on Claude (Anthropic / Claude Console).
// Default to the lower-cost Haiku model to conserve credits; override with
// ANTHROPIC_MODEL (e.g. claude-sonnet-4-6 or claude-opus-4-8) if desired.
const MODEL = process.env.ANTHROPIC_MODEL || "claude-haiku-4-5";

export async function POST(req: NextRequest) {
  const { messages, isDashboard, language } = await req.json();

  // Construct the client lazily (not at module scope): the Anthropic SDK throws
  // if ANTHROPIC_API_KEY is missing, which would crash the build/import. Guard
  // first, then instantiate, so a missing key degrades gracefully at runtime.
  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({
      content: "Finna isn't configured yet — no Anthropic API key is set.",
    });
  }

  const client = new Anthropic(); // reads ANTHROPIC_API_KEY from the environment

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
