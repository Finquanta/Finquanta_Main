import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { ADVISOR_TOOLS, FINNA_TOOLS, FinnaAuth, PendingAction, runTool } from "@/lib/finna/tools";
import { serverApiUrl } from "@/lib/api/client";

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
- The user's Company Brain is where their business knowledge lives. When something in the conversation is worth keeping — a decision, a reason, a plan, something they asked you to remember — use propose_brain_note to draft it. It only drafts; they must confirm. Don't propose a note for a passing lookup like "what did I spend last month".
- Money is in USD unless the data says otherwise.`;

const LANDING_SYSTEM =
  "You are Finna, Finquanta's assistant. Answer questions about Finquanta, an AI fintech platform that automates bookkeeping and financial operations for small businesses. Be friendly and concise. You have no access to any user's financial data.";

/**
 * The guided-category advisor (Company Brain spec §6b).
 *
 * Finquanta has no social posting, no ad platform and no CRM, so this advisor
 * must never imply it can act. It suggests, asks, and records — nothing else.
 *
 * The specificity rule is the heart of it: a vague answer earns a general
 * suggestion, a precise one earns a precise one, and the user is told this
 * plainly rather than left to wonder why the advice is generic.
 */
const ADVISOR_SYSTEM: Record<string, string> = {
  marketing: `You are Finna, acting as a marketing advisor inside this business's Company Brain.

You CANNOT post, schedule, publish, run ads, or contact anyone. Never imply otherwise. You suggest what the owner could do, and you ask the questions that make your suggestions worth acting on.

Rules:
- Ask at most ONE question per reply, and only when the answer would genuinely sharpen your advice. Never interrogate.
- Your suggestions must be as specific as what you've been told. If the brief is thin, say plainly that you're being general because you don't know enough yet, and name the one thing that would help most.
- Be concrete: a suggestion they could act on this week beats a principle.
- Never invent a number about their business. Use only the figures given below.
- When an exchange contains something worth keeping — a suggestion they reacted to, something they tried, a result — use propose_brain_note to draft it. It saves only if they confirm. Don't propose a note for small talk or for a question you just asked.`,

  sales: `You are Finna, acting as a sales advisor inside this business's Company Brain.

You CANNOT contact leads, send outreach, or close deals — there is no outreach tooling behind you. You help the owner think through turning interest into paying customers.

Rules:
- Ask at most ONE question per reply, and only when it would sharpen your advice.
- Ground your advice in their real customers and outstanding invoices; use your tools to look those up rather than guessing.
- Where marketing has surfaced something that's working, carry it into the sales thinking explicitly.
- Never invent a number about their business.
- When an exchange contains something worth keeping, use propose_brain_note to draft it. It saves only if they confirm.`,
};

/** How much the advisor has been told, spelled out for the model. */
const SPECIFICITY_BRIEF: Record<string, string> = {
  none: "You have been told NOTHING specific yet. Your first job is to ask for the single most useful missing piece, and to say openly that your advice stays general until you know more.",
  thin: "You have very little to work with. Keep suggestions general, say so, and ask for the most useful missing piece.",
  partial: "You have a partial picture. You may be moderately specific, but flag where you're guessing.",
  rich: "You have a detailed picture. Be concrete and specific — this is what the user answered all those questions for.",
};

/**
 * Assemble the advisor's brief from the Brain. One request, deterministic, and
 * it costs nothing — the AI call happens after this, already briefed.
 */
async function advisorContext(
  category: string,
  token: string | null,
  businessId: string | null,
  threadId: string | null
): Promise<{ system: string; categoryId: string | null } | null> {
  // hasOwnProperty, not a bare index: `advisor: "constructor"` off the request
  // body would otherwise return a truthy function and get stringified into the
  // system prompt as JS source.
  if (!Object.prototype.hasOwnProperty.call(ADVISOR_SYSTEM, category)) return null;
  const base = ADVISOR_SYSTEM[category];
  if (typeof base !== "string") return null;

  try {
    const res = await fetch(
      serverApiUrl(
        `/v1/brain/advisor/context?category=${encodeURIComponent(category)}` +
          (threadId ? `&threadId=${encodeURIComponent(threadId)}` : "")
      ),
      {
        headers: {
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
          ...(businessId ? { "X-Business-Id": businessId } : {}),
        },
      }
    );
    if (!res.ok) return { system: base, categoryId: null };
    const ctx = (await res.json())?.data;
    if (!ctx) return { system: base, categoryId: null };

    // The "" entries pushed below are deliberate blank lines that separate the
    // sections of the prompt, so they must survive to the join. Only the
    // specificity brief can legitimately be missing, so guard that one slot
    // here rather than filtering the whole array at the end and flattening
    // every paragraph break with it.
    const parts: string[] = [base];
    const brief = SPECIFICITY_BRIEF[ctx.specificity];
    if (brief) parts.push("", brief);

    // The thread's own framing. This is what stops advice being generic across
    // two campaigns run by the same business, and it's what makes a note read
    // back usefully later: "at this stage, on this budget, we decided X".
    const th = ctx.thread;
    if (th) {
      parts.push("", `This conversation is specifically about: ${th.title}`);
      if (th.stage) parts.push(`Stage: ${th.stage}`);
      if (th.budget) parts.push(`Budget: ${th.budget}`);
      if (th.situation) parts.push(`Situation: ${th.situation}`);
      parts.push(
        "Keep your advice scoped to this subject. When you draft a note, state the stage, the budget and the situation it was made under, so it still makes sense when it's read back months from now."
      );
    }

    const answers = Object.entries(ctx.answers ?? {});
    if (answers.length) {
      parts.push("", "What the owner has told you:");
      for (const [k, v] of answers) parts.push(`- ${k}: ${v}`);
    }

    if (Array.isArray(ctx.notes) && ctx.notes.length) {
      parts.push("", "Notes already in this category (don't repeat advice they've recorded):");
      for (const n of ctx.notes.slice(0, 12)) {
        parts.push(`- ${n.title}${n.summary ? `: ${n.summary}` : ""}`);
      }
    }

    // The live pin — real figures from the ledger, so the advisor can reason
    // about actual spend instead of asking the user what they spent.
    const metrics = ctx.pin?.metrics;
    if (Array.isArray(metrics) && metrics.length) {
      parts.push("", "Live figures for this area (these are real — use them, don't restate them mechanically):");
      for (const m of metrics) parts.push(`- ${m.label ?? m.key}: ${m.value}`);
    }

    return { system: parts.join("\n"), categoryId: ctx.categoryId ?? null };
  } catch {
    // A context failure shouldn't kill the conversation — it just makes the
    // advisor a general one, which is still better than an error message.
    return { system: base, categoryId: null };
  }
}

/**
 * Daily cost cap, checked before every Anthropic call. This route has no auth
 * gate of its own (the landing-page assistant must work for signed-out
 * visitors too), so without a cap anyone can script requests against it and
 * run up spend for free. The backend keys the cap to the user when a valid
 * token is present, else to the caller's IP (see ai-usage.routes.ts).
 *
 * Fails OPEN on a backend hiccup — a cap check failing shouldn't take down the
 * one thing Finna is actually for, and this is a cost guard, not a security
 * boundary.
 */
/**
 * Claim one message against the workspace's MONTHLY PLAN allowance.
 *
 * Distinct from checkAiUsageAllowed below, and both have to pass. That one is
 * a daily cost guard protecting the prepaid Anthropic balance no matter who is
 * asking; this is what the customer actually bought — 50 messages a month on
 * Freemium, 500 on Entrepreneur, 2000 on Business.
 *
 * Signed-out visitors skip it entirely: there is no workspace to meter and no
 * plan to meter against, so the landing-page chat is governed by the daily
 * per-IP cap alone.
 *
 * Fails open on a network error, matching the helper below — an unreachable
 * backend should not be the thing that stops Finna answering.
 */
async function claimPlanAllowance(
  token: string | null,
  businessId: string | null
): Promise<{ allowed: boolean; limit: number | null }> {
  if (!token || !businessId) return { allowed: true, limit: null };
  try {
    const res = await fetch(serverApiUrl("/v1/billing/usage/finna"), {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "X-Business-Id": businessId,
      },
    });
    if (!res.ok) return { allowed: true, limit: null };
    const json = await res.json().catch(() => null);
    return {
      allowed: json?.data?.allowed !== false,
      limit: json?.data?.limit ?? null,
    };
  } catch {
    return { allowed: true, limit: null };
  }
}

async function checkAiUsageAllowed(
  token: string | null,
  clientIp: string | null
): Promise<{ allowed: boolean; scope: string | null }> {
  try {
    const res = await fetch(serverApiUrl("/v1/ai/usage/check"), {
      method: "POST",
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(clientIp ? { "X-Forwarded-For": clientIp } : {}),
      },
    });
    if (!res.ok) return { allowed: true, scope: null };
    const json = await res.json().catch(() => null);
    return {
      allowed: json?.data?.allowed !== false,
      scope: json?.data?.scope ?? null,
    };
  } catch {
    return { allowed: true, scope: null };
  }
}

export async function POST(req: NextRequest) {
  const { messages, isDashboard, language, token, businessId, advisor, threadId } = await req.json();

  // The real client IP, forwarded so the backend's per-IP cap (used when
  // there's no token) doesn't collapse every anonymous visitor onto this
  // server's own address.
  const clientIp = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || null;

  /**
   * The PLAN allowance is checked first, before the daily cost cap below.
   *
   * Order matters twice over. The daily check CHARGES the caller's counter as
   * it runs, so asking it first would spend one of today's messages on a reply
   * that was never going to be sent. And someone who has simply used up their
   * monthly allowance should be told that — being shown a platform message
   * about tomorrow would send them back to try again, when what they need is a
   * bigger plan. Same ordering, for the same reasons, as the Council route.
   */
  const plan = await claimPlanAllowance(
    isDashboard ? token ?? null : null,
    isDashboard ? businessId ?? null : null
  );
  if (!plan.allowed) {
    return NextResponse.json({
      content:
        plan.limit === 0
          ? "Finna messages aren't included on your current plan. You can upgrade in Settings → Billing."
          : `You've used all ${plan.limit} Finna messages on your plan this month — they reset on the 1st. You can upgrade any time in Settings → Billing.`,
    });
  }

  const usage = await checkAiUsageAllowed(token ?? null, clientIp);
  if (!usage.allowed) {
    return NextResponse.json({
      content:
        usage.scope === "global"
          ? "Finna's hit today's limit across the whole platform, not just your account. It resets tomorrow — sorry about that."
          : "Finna's hit today's usage limit for this account. It resets tomorrow — thanks for your patience!",
    });
  }

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

  // Guided-category advisor (§6b), when the user is chatting from inside
  // Marketing or Sales in the Brain. Falls back to ordinary dashboard Finna if
  // the category isn't a guided one or there's no signed-in user to brief for.
  const guided =
    useTools && typeof advisor === "string"
      ? await advisorContext(advisor, auth.token, auth.businessId, threadId ?? null)
      : null;

  let system = guided ? guided.system : isDashboard ? DASHBOARD_SYSTEM : LANDING_SYSTEM;
  if (language && language !== "en") {
    system += `\nReply in the user's language (language code: ${language}).`;
  }

  const tools = guided ? ADVISOR_TOOLS : FINNA_TOOLS;

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
        ...(useTools && round < MAX_TOOL_ROUNDS ? { tools } : {}),
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
          if (p) {
            // Stamp the category server-side rather than trusting the model to
            // name one: the advisor writes where it is running, nowhere else.
            if (p.type === "create_brain_note" && guided?.categoryId) {
              p.payload = { ...p.payload, categoryId: guided.categoryId };
            }
            pending = p;
          }
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
