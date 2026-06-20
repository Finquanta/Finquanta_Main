import { NextRequest, NextResponse } from "next/server";

// Finna runs on Gemini with rotation across up to 3 keys (stored in env).
const GEMINI_KEYS = [
  process.env.GEMINI_API_KEY_1,
  process.env.GEMINI_API_KEY_2,
  process.env.GEMINI_API_KEY_3,
].filter(Boolean) as string[];

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001/api";

// --- Key rotation: round-robin start + per-key usage tracking -----------------
let rotationCursor = 0;
const keyUsage: number[] = GEMINI_KEYS.map(() => 0);

interface GeminiPart { text?: string; functionCall?: unknown }
interface GeminiResult { text: string }

async function geminiGenerate(systemPrompt: string, contents: object[]): Promise<GeminiResult> {
  if (GEMINI_KEYS.length === 0) {
    return { text: "Finna isn't configured yet (no Gemini API keys set). Add GEMINI_API_KEY_1..3 to enable me." };
  }

  let lastError: "rate_limited" | "api_error" | null = null;

  // Try each key once, starting from the round-robin cursor, so load is spread.
  for (let attempt = 0; attempt < GEMINI_KEYS.length; attempt++) {
    const i = (rotationCursor + attempt) % GEMINI_KEYS.length;
    const key = GEMINI_KEYS[i];

    let response: Response;
    try {
      response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${key}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            system_instruction: { parts: [{ text: systemPrompt }] },
            contents,
            generationConfig: { maxOutputTokens: 800, temperature: 0.5 },
          }),
        }
      );
    } catch {
      lastError = "api_error";
      continue;
    }

    const data = await response.json().catch(() => ({}));

    if (response.status === 429) {
      lastError = "rate_limited";
      continue; // immediately try the next key
    }
    if (!response.ok) {
      lastError = "api_error";
      continue;
    }

    keyUsage[i] += 1;
    rotationCursor = (i + 1) % GEMINI_KEYS.length; // next request starts on the next key

    const parts: GeminiPart[] = data.candidates?.[0]?.content?.parts ?? [];
    const text = parts.map((p) => p.text ?? "").join("").trim();
    return { text: text || "Sorry, I couldn't process that." };
  }

  return {
    text: lastError === "rate_limited"
      ? "I'm a little busy right now — please try again in a moment."
      : "Sorry, I'm unavailable right now.",
  };
}

// --- Backend helpers (call the API with the user's token) ---------------------
async function authedGet(path: string, token: string) {
  try {
    const res = await fetch(`${API_BASE}${path}`, { headers: { Authorization: `Bearer ${token}` } });
    if (!res.ok) return null;
    const json = await res.json();
    return json && typeof json === "object" && "data" in json ? json.data : json;
  } catch {
    return null;
  }
}

async function createTransaction(token: string, body: object) {
  const res = await fetch(`${API_BASE}/v1/financial/transactions`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json?.message || json?.error || "Could not create the entry");
  return json?.data ?? json;
}

function buildBusinessContext(me: any, overview: any): string {
  if (!me && !overview) return "";
  const lines: string[] = [];
  if (me) {
    const name = `${me.firstName ?? ""} ${me.lastName ?? ""}`.trim();
    if (name) lines.push(`User: ${name}`);
    const p = me.profile ?? {};
    if (p.company) lines.push(`Business: ${p.company}`);
    if (p.industry) lines.push(`Industry: ${p.industry}`);
    if (p.jobTitle) lines.push(`Role: ${p.jobTitle}`);
    if (p.country) lines.push(`Country: ${p.country}`);
  }
  if (overview?.summaryCards) {
    for (const c of overview.summaryCards) lines.push(`${c.title}: ${c.amount}`);
  }
  if (overview?.latestTransactions?.length) {
    lines.push("Recent transactions:");
    for (const t of overview.latestTransactions.slice(0, 5)) {
      lines.push(`- ${t.date} ${t.type} ${t.name || t.detail} ${t.amount < 0 ? "-" : "+"}$${Math.abs(t.amount).toFixed(2)}`);
    }
  }
  if (overview?.goalsData?.goals?.length) {
    lines.push("Goals:");
    for (const g of overview.goalsData.goals) lines.push(`- ${g.name}: ${g.current}/${g.target}`);
  }
  return lines.length ? `\n\nThe user's current business & financial data:\n${lines.join("\n")}` : "";
}

function extractAction(text: string): { json: any; cleaned: string } | null {
  // Finna emits a JSON object when it wants to record an entry.
  const match = text.match(/\{[\s\S]*"action"[\s\S]*\}/);
  if (!match) return null;
  try {
    const json = JSON.parse(match[0]);
    const cleaned = text.replace(match[0], "").replace(/```json|```/g, "").trim();
    return { json, cleaned };
  } catch {
    return null;
  }
}

const today = () => new Date().toISOString().slice(0, 10);

export async function POST(req: NextRequest) {
  const { messages, isDashboard, token, language } = await req.json();

  let systemPrompt = isDashboard
    ? `You are Finna, Finquanta's AI financial assistant for a business owner. Be friendly, concise and practical. Use the user's real data below to answer questions about revenue, expenses, cashflow, profit, balance, goals and transactions. When the user clearly wants to record a bookkeeping entry (e.g. "I spent $200 on office supplies today" or "received $500 from a client"), respond with a single JSON object and nothing else, in this exact shape: {"action":"create_transaction","type":"expense|income","category":"short name","amount":number,"date":"YYYY-MM-DD","description":"optional"}. Use today's date (${today()}) if none is given. "spent/paid/bought" = expense; "received/earned/got paid" = income. For all other messages, reply normally as Finna.`
    : `You are Finna, Finquanta's assistant. Answer questions about Finquanta, an AI fintech platform that automates bookkeeping and financial operations for small businesses. Be friendly and concise.`;

  if (language && language !== "en") {
    systemPrompt += `\n\nReply in the user's language (code: ${language}).`;
  }

  // Pull real data for logged-in dashboard users.
  if (isDashboard && token) {
    const [me, overview] = await Promise.all([
      authedGet("/v1/me", token),
      authedGet("/v1/dashboard/overview", token),
    ]);
    systemPrompt += buildBusinessContext(me, overview);
  }

  const contents = (messages ?? []).map((m: { role: string; content: string }) => ({
    role: m.role === "assistant" ? "model" : "user",
    parts: [{ text: m.content }],
  }));

  try {
    const first = await geminiGenerate(systemPrompt, contents);

    // Did Finna ask to create a bookkeeping entry?
    const action = isDashboard && token ? extractAction(first.text) : null;
    if (action?.json?.action === "create_transaction") {
      const a = action.json;
      try {
        await createTransaction(token, {
          type: a.type === "income" ? "income" : "expense",
          category: String(a.category || "General").slice(0, 100),
          amount: Number(a.amount),
          date: /^\d{4}-\d{2}-\d{2}$/.test(a.date) ? a.date : today(),
          description: a.description ? String(a.description) : undefined,
        });
        const verb = a.type === "income" ? "income" : "expense";
        return NextResponse.json({
          content: `✅ Logged a $${Number(a.amount).toFixed(2)} ${verb} for "${a.category}" on ${/^\d{4}-\d{2}-\d{2}$/.test(a.date) ? a.date : today()}. ${action.cleaned}`.trim(),
          dataChanged: true,
        });
      } catch (e) {
        return NextResponse.json({
          content: `I tried to log that but it didn't go through: ${e instanceof Error ? e.message : "unknown error"}. Want to try again?`,
        });
      }
    }

    return NextResponse.json({ content: first.text });
  } catch (err) {
    console.error("Finna route error:", err);
    return NextResponse.json({ content: "Sorry, something went wrong. Please try again." }, { status: 500 });
  }
}
