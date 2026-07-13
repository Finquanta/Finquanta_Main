import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { FINNA_TOOLS, FinnaAuth, PendingAction, runTool } from "@/lib/finna/tools";

// Finna runs on Claude. Locked to the lower-cost Haiku model to conserve
// credits — intentionally hardcoded (not overridable via ANTHROPIC_MODEL).
const MODEL = "claude-haiku-4-5";

/**
 * Section 12 — Finna, wired to the user's actual finances.
 *
 * On the dashboard Finna gets tools (see lib/finna/tools.ts) and reads the books
 * through the same API the UI uses, on the user's own token. On the marketing
 * site it stays a plain assistant with no tools and no data access.
 *
 * Cost control, in order of how much they save:
 *   - Nothing automatic calls this. The ledger, health score and invoice posting
 *     are deterministic code; Finna only runs when a user types.
 *   - Tools fetch only what a question needs, so cost doesn't grow with the size
 *     of the user's books.
 *   - MAX_TOOL_ROUNDS caps the loop, so one question can't fan out into a dozen
 *     API round trips.
 *   - Haiku, short system prompt, capped output.
 */
const MAX_TOOL_ROUNDS = 3;

const DASHBOARD_SYSTEM = `You are Finna, Finquanta's AI financial assistant, talking to a small-business owner inside their dashboard.

You have tools that read their real books. Use them — never guess at a number, and never state a figure you didn't get from a tool.

Rules:
- Answer with the actual numbers, briefly. No preamble, no visible reasoning.
- If a tool returns nothing, say the data isn't there yet rather than inventing it.
- If the health score isn't ready, say so plainly and do not give financial recommendations from thin data.
- Explain what a number MEANS for their business, not just whether it's "good" or "bad".
- To create an invoice or record an entry, use the propose_ tools. These only draft it — the user must confirm. Say so. Ask for anything you're missing instead of guessing amounts.
- Money is in USD unless the data says otherwise.`;

const LANDING_SYSTEM =
  "You are Finna, Finquanta's assistant. Answer questions about Finquanta, an AI fintech platform that automates bookkeeping and financial operations for small businesses. Be friendly and concise. You have no access to any user's financial data.";

export async function POST(req: NextRequest) {
  const { messages, isDashboard, language, token, businessId } = await req.json();

  // Construct the client lazily (not at module scope): the Anthropic SDK throws
  // if ANTHROPIC_API_KEY is missing, which would crash the build/import.
  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({
      content: "Finna isn't configured yet — no Anthropic API key is set.",
    });
  }

  const client = new Anthropic();
  const auth: FinnaAuth = { token: token ?? null, businessId: businessId ?? null };

  // Tools are only offered where there's a signed-in user to read data for.
  const useTools = Boolean(isDashboard && auth.token);

  let system = isDashboard ? DASHBOARD_SYSTEM : LANDING_SYSTEM;
  if (language && language !== "en") {
    system += `\nReply in the user's language (language code: ${language}).`;
  }

  const history: Anthropic.MessageParam[] = (messages ?? [])
    .filter((m: { content?: string }) => m && typeof m.content === "string" && m.content.trim())
    .map((m: { role: string; content: string }) => ({
      role: m.role === "assistant" ? "assistant" : "user",
      content: m.content,
    }));

  if (history.length === 0) {
    return NextResponse.json({ content: "Hi, I'm Finna! How can I help with your finances today?" });
  }

  try {
    let pending: PendingAction | undefined;

    for (let round = 0; ; round++) {
      const response: Anthropic.Message = await client.messages.create({
        model: MODEL,
        max_tokens: 1024,
        system,
        messages: history,
        ...(useTools && round < MAX_TOOL_ROUNDS ? { tools: FINNA_TOOLS } : {}),
      });

      if (response.stop_reason === "refusal") {
        return NextResponse.json({
          content: "Sorry, I can't help with that one. Try asking me something about your finances.",
        });
      }

      const toolUses = response.content.filter(
        (b): b is Anthropic.ToolUseBlock => b.type === "tool_use"
      );

      // No tools wanted — this is the answer.
      if (toolUses.length === 0) {
        const text = response.content
          .filter((b): b is Anthropic.TextBlock => b.type === "text")
          .map((b) => b.text)
          .join("")
          .trim();

        return NextResponse.json({
          content: text || "Sorry, I couldn't process that.",
          ...(pending ? { pendingAction: pending } : {}),
        });
      }

      // Run what it asked for and feed the results back.
      history.push({ role: "assistant", content: response.content });

      const results: Anthropic.ToolResultBlockParam[] = [];
      for (const use of toolUses) {
        try {
          const { result, pending: p } = await runTool(
            use.name,
            (use.input ?? {}) as Record<string, any>,
            auth
          );
          // Only one write can be pending at a time — the last one drafted wins.
          if (p) pending = p;
          results.push({ type: "tool_result", tool_use_id: use.id, content: result });
        } catch (err) {
          results.push({
            type: "tool_result",
            tool_use_id: use.id,
            content: err instanceof Error ? err.message : "That lookup failed.",
            is_error: true,
          });
        }
      }

      history.push({ role: "user", content: results });
    }
  } catch (err) {
    console.error("Finna (Claude) error:", err);
    return NextResponse.json(
      { content: "Sorry, I'm having trouble right now. Please try again in a moment." },
      { status: 500 }
    );
  }
}
