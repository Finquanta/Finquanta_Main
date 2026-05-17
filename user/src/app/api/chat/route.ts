import { NextRequest, NextResponse } from "next/server";

// Add as many keys as you have: GEMINI_API_KEY_1, GEMINI_API_KEY_2, ...
const GEMINI_KEYS = [
  process.env.GEMINI_API_KEY_1,
  process.env.GEMINI_API_KEY_2,
  process.env.GEMINI_API_KEY_3,
  process.env.GEMINI_API_KEY_4,
].filter(Boolean) as string[];

async function callGemini(apiKey: string, systemPrompt: string, geminiMessages: object[]) {
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        system_instruction: { parts: [{ text: systemPrompt }] },
        contents: geminiMessages,
        generationConfig: { maxOutputTokens: 500 },
      }),
    }
  );
  return response;
}

export async function POST(req: NextRequest) {
  const { messages, isDashboard, model = "gemini" } = await req.json();

  const systemPrompt = isDashboard
    ? "You are Fina, Finquanta's AI financial assistant. Help users with budgeting, expenses, investments, and savings. Be friendly and concise."
    : "You are Fina, Finquanta's assistant. Answer questions about Finquanta, an AI fintech platform that automates bookkeeping and financial operations for small businesses.";

  try {
    if (model === "claude") {
      const response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": process.env.ANTHROPIC_API_KEY!,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514",
          max_tokens: 500,
          system: systemPrompt,
          messages,
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        console.error("Claude error:", JSON.stringify(data));
        return NextResponse.json({ content: "Sorry, Claude is unavailable right now." }, { status: 500 });
      }
      return NextResponse.json({ content: data.content[0]?.text || "Sorry, I could not process that." });
    }

    if (model === "chatgpt") {
      const response = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`,
        },
        body: JSON.stringify({
          model: "gpt-4o-mini",
          max_tokens: 500,
          messages: [{ role: "system", content: systemPrompt }, ...messages],
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        console.error("ChatGPT error:", JSON.stringify(data));
        return NextResponse.json({ content: "Sorry, ChatGPT is unavailable right now." }, { status: 500 });
      }
      return NextResponse.json({ content: data.choices[0]?.message?.content || "Sorry, I could not process that." });
    }

    // Default: Gemini with key rotation
    if (GEMINI_KEYS.length === 0) {
      console.error("No Gemini API keys configured.");
      return NextResponse.json({ content: "Sorry, Gemini is not configured." }, { status: 500 });
    }

    const geminiMessages = messages.map((m: { role: string; content: string }) => ({
      role: m.role === "assistant" ? "model" : "user",
      parts: [{ text: m.content }],
    }));

    let lastError: string | null = null;

    for (let i = 0; i < GEMINI_KEYS.length; i++) {
      const key = GEMINI_KEYS[i];
      const response = await callGemini(key, systemPrompt, geminiMessages);
      const data = await response.json();

     if (response.status === 429) {
         console.warn(`Gemini key #${i + 1} is rate limited:`, JSON.stringify(data));
         lastError = "rate_limited";
         await new Promise(res => setTimeout(res, 2000));
         continue;
    }

      if (!response.ok) {
        console.error(`Gemini key #${i + 1} error:`, JSON.stringify(data));
        lastError = "api_error";
        continue;
      }

      const content = data.candidates?.[0]?.content?.parts?.[0]?.text || "Sorry, I could not process that.";
      return NextResponse.json({ content });
    }

    // All keys exhausted
    const message = lastError === "rate_limited"
      ? "Sorry, Fina is a little busy right now. Please try again in a moment."
      : "Sorry, Gemini is unavailable right now.";
    return NextResponse.json({ content: message }, { status: 500 });

  } catch (err) {
    console.error("API route error:", err);
    return NextResponse.json({ content: "Sorry, something went wrong. Please try again." }, { status: 500 });
  }
}