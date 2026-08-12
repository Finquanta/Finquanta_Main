import type Anthropic from "@anthropic-ai/sdk";

/**
 * Section 12 — the tools that let Finna actually see the user's finances.
 *
 * Finna reads the books through the same API the dashboard uses, on the user's
 * own token, so it can never see a business the user can't. Nothing here is
 * cached across users.
 *
 * Cost: tool results are trimmed to the few fields an answer needs, so a
 * question costs roughly the same whether the business has 10 transactions or
 * 10,000. The alternative — pasting the ledger into the prompt — gets more
 * expensive every month a user stays.
 *
 * Writes are NOT executed here. `propose_*` tools only draft an action; the user
 * confirms it in the UI, and /api/chat/execute performs it. An AI that can
 * silently post to a double-entry ledger is a bad idea.
 */

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001/api";

export interface FinnaAuth {
  token: string | null;
  businessId: string | null;
}

/** A write Finna has drafted and the user has not yet approved. */
export interface PendingAction {
  type: "create_invoice" | "add_entry" | "create_brain_note";
  /** What the user is being asked to approve, in plain language. */
  summary: string;
  /** The payload /api/chat/execute will send to the backend. */
  payload: Record<string, unknown>;
}

async function api<T>(path: string, auth: FinnaAuth): Promise<T> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (auth.token) headers.Authorization = `Bearer ${auth.token}`;
  if (auth.businessId) headers["X-Business-Id"] = auth.businessId;

  const res = await fetch(`${API_BASE}${path}`, { headers });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json?.error || `Request failed (${res.status})`);
  return (json && typeof json === "object" && "data" in json ? json.data : json) as T;
}

const money = (n: unknown) => Math.round((Number(n) || 0) * 100) / 100;
const today = () => new Date().toISOString().slice(0, 10);

/**
 * The one tool the guided advisor adds (spec §6b): it records what was
 * suggested and what the user said back, so the category accumulates a real
 * history instead of a single answer that goes stale.
 */
const PROPOSE_BRAIN_NOTE: Anthropic.Tool = {
  name: "propose_brain_note",
  description:
    "Draft a note capturing a suggestion and the user's response, to save into the Company Brain category you are advising on. Use this once the exchange contains something worth keeping — a suggestion they reacted to, something they tried, or a result. Never use it for small talk or for a question you just asked. The note is only drafted; the user must confirm it.",
  input_schema: {
    type: "object",
    properties: {
      title: {
        type: "string",
        description: "Short, specific title. What this note is about, in a few words.",
      },
      content: {
        type: "string",
        description:
          "The body: what was suggested, what the user said, and what they decided to try. Write it so it still makes sense in three months.",
      },
    },
    required: ["title", "content"],
  },
};

/**
 * The tool list Claude sees. Descriptions matter — they are how it picks.
 *
 * `propose_brain_note` is appended after this array so the same definition
 * serves both dashboard Finna and the guided advisor — see below.
 */
export const FINNA_TOOLS: Anthropic.Tool[] = [
  {
    name: "get_summary",
    description:
      "The business's revenue, expenses and net income over a period. Use for questions about income, expenses, profit or cash flow in a time range.",
    input_schema: {
      type: "object",
      properties: {
        period: {
          type: "string",
          enum: ["this_month", "last_month", "this_year", "all_time"],
          description: "Which period to total up. Defaults to this month.",
        },
      },
    },
  },
  {
    name: "get_health_score",
    description:
      "The Financial Health Score (0-100) and its four ratios: liquidity, profitability, debt risk and cash flow. Use when asked how the business is doing overall, or to explain the score or any of the ratios.",
    input_schema: { type: "object", properties: {} },
  },
  {
    name: "get_runway",
    description:
      "How fast the business is spending cash and how many months of cash are left at that rate. Use for 'how long can we last', 'what's my burn rate', 'can I afford to hire', or any decision that turns on how much time the money buys. Burn is measured from operating cash flow, so borrowing does not disguise it.",
    input_schema: { type: "object", properties: {} },
  },
  {
    name: "list_invoices",
    description:
      "The business's invoices. Use for 'who owes me money', 'which invoices are overdue', 'what have I been paid'.",
    input_schema: {
      type: "object",
      properties: {
        status: {
          type: "string",
          enum: ["all", "unpaid", "overdue", "paid", "draft"],
          description: "Filter by status. 'unpaid' means sent but not yet paid.",
        },
      },
    },
  },
  {
    name: "list_transactions",
    description:
      "Recent bookkeeping entries, newest first, with amounts and categories. Use for 'biggest expense', 'what did I spend on X', or listing recent activity.",
    input_schema: {
      type: "object",
      properties: {
        limit: { type: "number", description: "How many to return. Default 30, max 100." },
      },
    },
  },
  {
    name: "get_loans",
    description:
      "Loans the business owes or has lent out, with balances and interest rates. Use for any question about debt or loans.",
    input_schema: { type: "object", properties: {} },
  },
  {
    name: "list_customers",
    description: "The business's customers. Use to look up a customer before drafting an invoice.",
    input_schema: { type: "object", properties: {} },
  },
  {
    name: "propose_invoice",
    description:
      "Draft an invoice for the user to review and confirm. This does NOT create it — the user must approve it. Look up the customer first with list_customers. Ask for anything you're missing rather than guessing amounts.",
    input_schema: {
      type: "object",
      properties: {
        customerId: { type: "string", description: "The customer's id from list_customers." },
        customerName: { type: "string", description: "The customer's name, for the confirmation message." },
        items: {
          type: "array",
          description: "The line items being billed.",
          items: {
            type: "object",
            properties: {
              description: { type: "string" },
              quantity: { type: "number" },
              unitPrice: { type: "number" },
            },
            required: ["description", "quantity", "unitPrice"],
          },
        },
        dueDate: { type: "string", description: "YYYY-MM-DD. Optional." },
      },
      required: ["items"],
    },
  },
  {
    name: "propose_entry",
    description:
      "Draft a bookkeeping entry (money in or money out) for the user to review and confirm. This does NOT record it — the user must approve it.",
    input_schema: {
      type: "object",
      properties: {
        type: { type: "string", enum: ["income", "expense"], description: "Money in or money out." },
        amount: { type: "number", description: "A positive amount." },
        category: { type: "string", description: "e.g. 'Software', 'Client payment', 'Travel'." },
        date: { type: "string", description: "YYYY-MM-DD. Defaults to today." },
        description: { type: "string", description: "Optional note." },
      },
      required: ["type", "amount", "category"],
    },
  },
];

/**
 * What the guided advisor can reach (spec §6b).
 *
 * Deliberately a small set. The category's live pin and its existing notes are
 * already injected as context, so these reads exist for the Sales side — who
 * the customers are, what's still outstanding — rather than to let the advisor
 * wander the whole ledger. Every extra tool is another possible round trip.
 */
export const ADVISOR_TOOLS: Anthropic.Tool[] = [
  PROPOSE_BRAIN_NOTE,
  ...FINNA_TOOLS.filter((t) =>
    ["get_summary", "list_customers", "list_invoices"].includes(t.name)
  ),
];

/**
 * Dashboard Finna can write to the Company Brain too.
 *
 * Pushed on after the array literal rather than declared inside it because
 * ADVISOR_TOOLS above filters FINNA_TOOLS by name, and a note tool in that
 * source list would be picked up twice. Same draft-then-confirm rule as the
 * money tools: nothing reaches the Brain until the user presses save.
 */
FINNA_TOOLS.push(PROPOSE_BRAIN_NOTE);

function periodRange(period?: string): { startDate: string; endDate: string } {
  const now = new Date();
  const end = today();
  const iso = (d: Date) => d.toISOString().slice(0, 10);

  switch (period) {
    case "last_month": {
      const start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const last = new Date(now.getFullYear(), now.getMonth(), 0);
      return { startDate: iso(start), endDate: iso(last) };
    }
    case "this_year":
      return { startDate: `${now.getFullYear()}-01-01`, endDate: end };
    case "all_time":
      return { startDate: "2000-01-01", endDate: end };
    case "this_month":
    default: {
      const start = new Date(now.getFullYear(), now.getMonth(), 1);
      return { startDate: iso(start), endDate: end };
    }
  }
}

/**
 * Run one tool call. Returns the text handed back to Claude, plus a pending
 * action when the tool was a `propose_*`.
 */
export async function runTool(
  name: string,
  input: Record<string, any>,
  auth: FinnaAuth
): Promise<{ result: string; pending?: PendingAction }> {
  if (!auth.token) {
    return { result: "The user isn't signed in, so their financial data isn't available." };
  }

  switch (name) {
    case "get_summary": {
      const { startDate, endDate } = periodRange(input.period);
      const s = await api<any>(`/v1/financial/summary?startDate=${startDate}&endDate=${endDate}`, auth);
      return {
        result: JSON.stringify({
          period: input.period ?? "this_month",
          from: startDate,
          to: endDate,
          revenue: money(s.totalIncome),
          expenses: money(s.totalExpenses),
          netIncome: money(s.netIncome),
          transactions: s.transactionCount,
        }),
      };
    }

    case "get_health_score": {
      const h = await api<any>("/v1/health-score", auth);
      if (!h.ready) {
        return {
          result: JSON.stringify({
            ready: false,
            daysOfData: h.daysOfData,
            daysRequired: h.daysRequired,
            note: "Not enough data for a score yet. Do not invent one or give financial recommendations.",
          }),
        };
      }
      return {
        result: JSON.stringify({
          score: h.score,
          trend: h.trend,
          summary: h.summary,
          ratios: (h.ratios ?? []).map((r: any) => ({
            name: r.name,
            value: r.value,
            score: r.score,
            insight: r.insight,
          })),
        }),
      };
    }

    case "get_runway": {
      const r = await api<{
        monthlyBurn: number | null; runwayMonths: number | null; cash: number;
        basedOnDays: number; status: string;
      }>("/v1/health-score/runway", auth);

      // Returned as a sentence rather than raw JSON so the model can't
      // misread a null as zero and tell someone they have no runway when the
      // truth is that they aren't burning at all.
      if (r.status === "insufficient_data") {
        return {
          result: `Not enough history to work out a burn rate — only ${r.basedOnDays} days recorded, and at least 30 are needed. Cash on hand is $${r.cash}. Do not estimate a runway.`,
        };
      }
      if (r.status === "profitable") {
        return {
          result: `The business is NOT burning cash — operations were cash-positive over the last ${r.basedOnDays} days. Cash on hand is $${r.cash}. There is no runway figure to give; say that rather than inventing one.`,
        };
      }
      return {
        result: `Monthly burn is $${r.monthlyBurn} of operating cash. With $${r.cash} on hand that is about ${r.runwayMonths} months of runway, averaged over the last ${r.basedOnDays} days. This excludes borrowing and lending, so a loan would not extend it.`,
      };
    }

    case "list_invoices": {
      const all = await api<any[]>("/v1/invoices", auth);
      const want = input.status ?? "all";
      const filtered = all.filter((i) => {
        if (want === "all") return true;
        if (want === "unpaid") return ["sent", "viewed", "overdue"].includes(i.status);
        return i.status === want;
      });
      return {
        result: JSON.stringify({
          count: filtered.length,
          totalOutstanding: money(
            filtered
              .filter((i) => ["sent", "viewed", "overdue"].includes(i.status))
              .reduce((sum, i) => sum + Number(i.total || 0), 0)
          ),
          invoices: filtered.slice(0, 30).map((i) => ({
            number: i.number,
            customer: i.customerName ?? null,
            total: money(i.total),
            status: i.status,
            dueDate: i.dueDate ?? null,
          })),
        }),
      };
    }

    case "list_transactions": {
      const limit = Math.min(Number(input.limit) || 30, 100);
      const txs = await api<any[]>(`/v1/accounting/transactions?basis=accrual&limit=${limit}`, auth);
      return {
        result: JSON.stringify(
          txs.map((t) => ({
            date: String(t.date).slice(0, 10),
            description: t.description,
            amount: money(t.signedAmount),
            direction: t.direction,
          }))
        ),
      };
    }

    case "get_loans": {
      const loans = await api<any[]>("/v1/loans", auth);
      return {
        result: JSON.stringify(
          loans.map((l) => ({
            name: l.name,
            kind: l.type,
            balance: money(l.balance ?? l.remainingBalance),
            annualRate: l.annualRate ?? l.interestRate ?? null,
          }))
        ),
      };
    }

    case "list_customers": {
      const customers = await api<any[]>("/v1/customers", auth);
      return {
        result: JSON.stringify(
          customers.map((c) => ({ id: c.id, name: c.name, email: c.email ?? null }))
        ),
      };
    }

    /* ---- Drafts. Nothing is written until the user says yes. ---- */

    case "propose_invoice": {
      // Shape must match InvoiceItem on the server: `name` is required, and
      // `amount` is the line total, which the backend does not derive for us.
      const items = (input.items ?? []).map((it: any) => {
        const quantity = Number(it.quantity) || 1;
        const unitPrice = money(it.unitPrice);
        return {
          name: String(it.description ?? "").slice(0, 200) || "Item",
          description: null,
          quantity,
          unitPrice,
          amount: money(quantity * unitPrice),
        };
      });
      if (items.length === 0) {
        return { result: "No line items were given, so there's nothing to invoice. Ask the user what to bill for." };
      }
      const total = money(items.reduce((s: number, i: any) => s + i.amount, 0));
      const who = input.customerName ? ` for ${input.customerName}` : "";

      return {
        result: `Draft prepared and shown to the user for confirmation. It has NOT been created. Tell them what's in it and that they need to confirm.`,
        pending: {
          type: "create_invoice",
          summary: `Invoice${who} — $${total.toFixed(2)} (${items.length} item${items.length === 1 ? "" : "s"})`,
          payload: {
            customerId: input.customerId ?? null,
            issueDate: today(),
            dueDate: input.dueDate ?? null,
            items,
          },
        },
      };
    }

    case "propose_entry": {
      const amount = money(input.amount);
      if (!(amount > 0)) {
        return { result: "The amount must be greater than zero. Ask the user for the amount." };
      }
      const type = input.type === "income" ? "income" : "expense";
      const category = String(input.category ?? "Uncategorised").slice(0, 100);
      const date = input.date ?? today();

      return {
        result: `Draft prepared and shown to the user for confirmation. It has NOT been recorded. Tell them what it is and that they need to confirm.`,
        pending: {
          type: "add_entry",
          summary: `${type === "income" ? "Money in" : "Money out"}: $${amount.toFixed(2)} — ${category} (${date})`,
          payload: { type, amount, category, date, description: input.description ?? category },
        },
      };
    }

    case "propose_brain_note": {
      // The advisor's record of what was suggested and what the user said back
      // (spec §6b). Drafted, never written directly — same rule as the money
      // tools, so the Brain can't fill up with notes the user didn't want.
      const title = String(input.title ?? "").trim().slice(0, 300);
      const content = String(input.content ?? "").trim();
      if (!title || !content) {
        return { result: "A note needs both a title and a body. Draft them before proposing." };
      }

      return {
        result: `Draft prepared and shown to the user for confirmation. It has NOT been saved. Tell them what it captures and that they need to confirm.`,
        pending: {
          type: "create_brain_note",
          summary: title,
          payload: {
            type: "note",
            title,
            content,
            // Left null on purpose. The chat route stamps the category the
            // advisor is actually running in, so the model can't file a note
            // into a category it wasn't invited to.
            categoryId: null,
            source: "system",
          },
        },
      };
    }

    default:
      return { result: `Unknown tool: ${name}` };
  }
}

/** Perform a write the user has explicitly confirmed. */
export async function executeAction(action: PendingAction, auth: FinnaAuth): Promise<string> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (auth.token) headers.Authorization = `Bearer ${auth.token}`;
  if (auth.businessId) headers["X-Business-Id"] = auth.businessId;

  const path =
    action.type === "create_invoice"
      ? "/v1/invoices"
      : action.type === "create_brain_note"
        ? "/v1/brain/nodes"
        : "/v1/financial/transactions";

  const res = await fetch(`${API_BASE}${path}`, {
    method: "POST",
    headers,
    body: JSON.stringify(action.payload),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json?.error || "That didn't work.");

  const data = json?.data ?? json;
  switch (action.type) {
    case "create_invoice":
      return `Done — invoice ${data?.number ?? ""} created as a draft. Open it from the Invoices tab to send it.`;
    case "create_brain_note":
      return `Saved to your Company Brain.`;
    default:
      return `Done — recorded in your books.`;
  }
}
