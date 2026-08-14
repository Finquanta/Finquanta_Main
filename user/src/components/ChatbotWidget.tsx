"use client";
import { useState, useRef, useEffect } from "react";
import { usePathname } from "next/navigation";
import { useLanguage } from "@/hooks/context/LanguageContext";
import {
  CouncilQuota, CouncilSession, Vote, conveneCouncil, getCouncilOverview,
  getCouncilSession,
} from "@/lib/api/council";
import {
  FinnaConversation, appendFinnaMessages, createFinnaChat, deleteFinnaChat,
  getFinnaChat, listFinnaChats,
} from "@/lib/api/finna";
import { createBrainNode } from "@/lib/api/brain";
import { FINNA_VISIBILITY_EVENT, isFinnaHidden } from "@/lib/finnaVisibility";
import { Nudge, dismissNudge, engageNudge, getNudge } from "@/lib/api/nudges";

/** A write Finna has drafted. Mirrors PendingAction in lib/finna/tools.ts. */
interface PendingAction {
  type: "create_invoice" | "add_entry" | "create_brain_note";
  summary: string;
  payload: Record<string, unknown>;
}

const ACTION_LABEL: Record<PendingAction["type"], string> = {
  create_invoice: "New invoice",
  add_entry: "New bookkeeping entry",
  create_brain_note: "Save to Company Brain",
};

/**
 * Finna answers; the Council deliberates. Two different things that happen to
 * share one window, so the mode is explicit rather than inferred from what the
 * user typed — convening costs real money and quota, and guessing at intent
 * would spend both without being asked.
 */
type Mode = "finna" | "council";

interface Message {
  role: "user" | "assistant";
  content: string;
  /** Set when Finna drafted a write. Nothing happens until the user confirms. */
  pendingAction?: PendingAction;
  /** Once acted on, the card collapses to its outcome. */
  actionState?: "confirmed" | "cancelled";
  /** Set when this message is a Council verdict rather than chat text. */
  council?: CouncilSession;
  /** Manual "save to Brain" state for this answer. */
  savedToBrain?: "saving" | "saved";
}

const VOTE_COLOR: Record<Vote, string> = {
  support: "#22c55e",
  oppose: "#ef4444",
  conditional: "#f59e0b",
};

const BUBBLE_POS_KEY = "finna_bubble_pos";
/** The bubble's resting spot when it has never been dragged. */
const BUBBLE_DEFAULT = { right: 16, bottom: 96 };
const BUBBLE_SIZE = 48;

/**
 * Keep the bubble on screen. Without this, a position saved on a wide monitor
 * would put it off the edge on a laptop, with no way to drag it back.
 */
const clampPos = (p: { right: number; bottom: number }) => {
  const maxRight = Math.max(0, (typeof window !== "undefined" ? window.innerWidth : 1024) - BUBBLE_SIZE);
  const maxBottom = Math.max(0, (typeof window !== "undefined" ? window.innerHeight : 768) - BUBBLE_SIZE);
  return {
    right: Math.min(Math.max(0, p.right), maxRight),
    bottom: Math.min(Math.max(0, p.bottom), maxBottom),
  };
};

/** First line of the opening message, so a chat has a name without asking. */
const titleFrom = (text: string) => {
  const line = text.trim().split("\n")[0].trim();
  return (line.length > 60 ? `${line.slice(0, 57)}…` : line) || "Untitled";
};

const COUNCIL_QUICK = [
  "Should I hire someone this quarter?",
  "Can I afford to raise my prices?",
  "Should I take on debt to grow?",
];

const LANDING_QA: Record<string, string> = {
  "What is Finquanta?": "Finquanta is an AI fintech startup that automates bookkeeping, financial operations, and business insights.",
  "What does Finquanta do?": "It helps businesses manage finances automatically using AI-powered tracking, analytics, and recommendations.",
  "What problem does Finquanta solve?": "It removes manual bookkeeping and helps businesses understand their finances in real time.",
  "Who is Finquanta built for?": "Small businesses, startups, and growing companies that want smarter financial management.",
  "How does Finquanta use AI?": "The AI analyzes business data to provide smarter financial decisions and automate workflows.",
};

const LANDING_QUICK = Object.keys(LANDING_QA);
// Finna can answer these from the user's real books now, so the prompts point at
// their actual data rather than generic personal-finance advice.
const DASHBOARD_QUICK = [
  "What were my expenses this month?",
  "Who owes me money?",
  "How is my business doing?",
  "What was my biggest expense?",
];

const getFallbackReply = (text: string, isDashboard: boolean) => {
  const lower = text.toLowerCase();
  // On the dashboard Finna answers from the user's real books. If the request
  // failed we couldn't read them — so say that, rather than falling back to
  // generic advice that sounds like it might be about their business.
  if (isDashboard) {
    return "I can't reach your books right now, so I'd rather not guess. Please try again in a moment.";
  }
  if (lower.includes("finquanta")) return LANDING_QA["What is Finquanta?"];
  if (lower.includes("ai") || lower.includes("how")) return LANDING_QA["How does Finquanta use AI?"];
  if (lower.includes("who") || lower.includes("for")) return LANDING_QA["Who is Finquanta built for?"];
  if (lower.includes("problem") || lower.includes("solve")) return LANDING_QA["What problem does Finquanta solve?"];
  return "Finquanta is an AI-powered platform that automates bookkeeping and financial operations for businesses. Would you like to know more?";
};

/**
 * `landing` = the marketing site, where Finna answers questions about
 * Finquanta itself and has no access to anyone's books. `product` = signed-in
 * pages, where it reads the user's real data and can convene the Council.
 *
 * Declared by the layout that mounts this rather than inferred from the path.
 * Inference is what broke it last time: the mode came from a hardcoded route
 * allowlist that went stale every time a tab shipped, so Invoices, Customers,
 * Activity, Groups, Referrals and Needs all silently fell outside it. A layout
 * always knows which side of the product it is.
 */
type Variant = "product" | "landing";

export default function ChatbotWidget({ variant = "product" }: { variant?: Variant }) {
  const pathname = usePathname();
  // `t` is only used for the proactive-nudge copy below. The rest of this
  // widget's chrome is still hardcoded English — worth translating one day,
  // but the nudge text ships in all ten languages, so it reads from the
  // translator rather than being the one English string among them.
  const { language, t } = useLanguage();
  const [open, setOpen] = useState(false);
  const [started, setStarted] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState<Mode>("finna");
  const [quota, setQuota] = useState<CouncilQuota | null>(null);
  /** Which saved chat we're in. null = a new one, created on first message. */
  const [chatId, setChatId] = useState<string | null>(null);
  const [chats, setChats] = useState<FinnaConversation[]>([]);
  const [pastCouncil, setPastCouncil] = useState<CouncilSession[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  /**
   * Starts visible and corrects itself on mount rather than reading
   * localStorage during render — the server has no localStorage, so reading it
   * inline would make the first client render disagree with the HTML.
   */
  const [userHidden, setUserHidden] = useState(false);
  /**
   * Where the user has dragged the bubble, as distance from the bottom-right.
   * null = wherever it defaults to. Kept as an offset from that corner rather
   * than absolute x/y so the bubble stays put across window sizes instead of
   * ending up off-screen on a smaller display.
   */
  const [bubblePos, setBubblePos] = useState<{ right: number; bottom: number } | null>(null);
  const [dragging, setDragging] = useState(false);
  /** At most one proactive offer, from deterministic server-side checks. */
  const [nudge, setNudge] = useState<Nudge | null>(null);
  /** Distinguishes a drag from a click, so moving it doesn't also open it. */
  const dragMoved = useRef(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  /**
   * Where Finna deliberately stays out of the way. Settings is a form, not a
   * conversation.
   *
   * The Company Brain used to be listed here too, on the reasoning that it has
   * its own advisor. That stopped being right once the Council moved into this
   * widget — it made the Brain the one product page where a Council couldn't be
   * convened. It's back, and anyone who finds it noisy there can turn it off
   * from the nav bar instead.
   */
  const HIDDEN_PATHS = ["/profile-settings", "/settings"];
  const isHidden = HIDDEN_PATHS.some((p) => pathname?.startsWith(p));

  /**
   * Three states, not two.
   *
   * `isDashboard` means "this Finna can see the user's books" — it drives the
   * system prompt, tool access, Council, nudges and saved chats. On the
   * marketing site none of that applies: there is no session, so it must be
   * false there or an anonymous visitor would get a Finna that tries to read
   * accounts they don't have and calls authenticated endpoints.
   *
   * HIDDEN_PATHS only ever match product routes, so `!isHidden` alone was
   * enough while this mounted from one layout. Now that it mounts from two,
   * the variant is what separates them.
   */
  const isLanding = variant === "landing";
  const isDashboard = !isLanding && !isHidden;
  const isSettings = isHidden;
  /** Anywhere the launcher bubble should appear at all. */
  const isVisible = isDashboard || isLanding;

  /**
   * External open/close hook: anything on the page can toggle Finna by setting
   * `data-chat` on <body> (see SocialSidebar).
   *
   * The guard here used to read `if (isDashboard || isSettings) return`, which
   * is `!isHidden || isHidden` — true for every possible state, so the observer
   * never registered and the hook was dead. It dates from when this widget also
   * mounted on marketing pages and a third "landing" state existed; today it
   * only mounts from the dashboard layout, so the honest condition is simply
   * "register wherever the widget actually renders".
   */
  useEffect(() => {
    if (isSettings) return;
    const observer = new MutationObserver(() => {
      const val = document.body.getAttribute('data-chat');
      setOpen(val === 'open');
    });
    observer.observe(document.body, { attributes: true, attributeFilter: ['data-chat'] });
    return () => observer.disconnect();
  }, [isSettings]);

  /**
   * Read the remaining Council allowance when the user switches to that mode.
   * Free — it's a database count, no AI — and it means the cost of convening is
   * visible before the button is pressed rather than after.
   */
  useEffect(() => {
    if (mode !== "council" || !isDashboard) return;
    getCouncilOverview()
      .then((o) => { setQuota(o.quota); setPastCouncil(o.sessions); })
      .catch(() => setQuota(null));
  }, [mode, isDashboard]);

  /** Restore a dragged position, clamped in case the window has since shrunk. */
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(BUBBLE_POS_KEY);
      if (!raw) return;
      const p = JSON.parse(raw);
      if (typeof p?.right === "number" && typeof p?.bottom === "number") {
        setBubblePos(clampPos(p));
      }
    } catch {
      /* a corrupt value just means the default position */
    }
  }, []);

  /**
   * Drag the bubble. Pointer events rather than mouse events so it works with
   * touch and stylus too, and capture so a fast drag that outruns the cursor
   * doesn't drop the gesture.
   */
  const onBubblePointerDown = (e: React.PointerEvent<HTMLButtonElement>) => {
    const el = e.currentTarget;
    const rect = el.getBoundingClientRect();
    // Where inside the bubble the grab happened, so it doesn't jump under the
    // cursor on the first move.
    const grabX = e.clientX - rect.left;
    const grabY = e.clientY - rect.top;

    dragMoved.current = false;
    el.setPointerCapture(e.pointerId);

    const onMove = (ev: PointerEvent) => {
      // A few pixels of slop: a click with a shaky hand is still a click.
      if (Math.abs(ev.clientX - e.clientX) > 3 || Math.abs(ev.clientY - e.clientY) > 3) {
        dragMoved.current = true;
        setDragging(true);
      }
      if (!dragMoved.current) return;
      setBubblePos(
        clampPos({
          right: window.innerWidth - (ev.clientX - grabX) - rect.width,
          bottom: window.innerHeight - (ev.clientY - grabY) - rect.height,
        })
      );
    };

    const onUp = () => {
      el.releasePointerCapture(e.pointerId);
      el.removeEventListener("pointermove", onMove);
      el.removeEventListener("pointerup", onUp);
      setDragging(false);
      if (dragMoved.current) {
        setBubblePos((p) => {
          if (p) {
            try { window.localStorage.setItem(BUBBLE_POS_KEY, JSON.stringify(p)); } catch {}
          }
          return p;
        });
      }
    };

    el.addEventListener("pointermove", onMove);
    el.addEventListener("pointerup", onUp);
  };

  /**
   * Ask once per mount whether there's anything worth offering. Free — the
   * server runs deterministic checks and returns a message key, never
   * generated text. Skipped while the chat is open so it can't interrupt.
   */
  useEffect(() => {
    if (!isDashboard || userHidden) return;
    getNudge().then((r) => setNudge(r.nudge)).catch(() => setNudge(null));
  }, [isDashboard, userHidden]);

  /**
   * "Not now" — hide it for this page view only, and tell the server nothing.
   * The offer stays outstanding and comes back next time, which is the whole
   * difference between this and Dismiss.
   */
  const laterNudge = () => setNudge(null);

  /** "Dismiss" — gone for good. Retires the trigger on the first press. */
  const rejectNudge = async () => {
    const n = nudge;
    setNudge(null);
    if (n) await dismissNudge(n.key).catch(() => {});
  };

  /**
   * The user took the offer. This is the ONLY point at which a nudge can lead
   * to spending — and even then it just opens the widget; convening still
   * needs a deliberate send.
   */
  const acceptNudge = async () => {
    const n = nudge;
    setNudge(null);
    if (!n) return;
    engageNudge(n.key).catch(() => {});
    setOpen(true);
    setStarted(true);
    if (n.action === "review" && n.sessionId) {
      setMode("council");
      openPastCouncil(n.sessionId);
    } else {
      setMode("council");
    }
  };

  /** Follow the nav-bar toggle, in this tab and across others. */
  useEffect(() => {
    setUserHidden(isFinnaHidden());
    const onChange = () => setUserHidden(isFinnaHidden());
    window.addEventListener(FINNA_VISIBILITY_EVENT, onChange);
    // `storage` only fires in OTHER tabs, which is exactly the gap the custom
    // event above doesn't cover.
    window.addEventListener("storage", onChange);
    return () => {
      window.removeEventListener(FINNA_VISIBILITY_EVENT, onChange);
      window.removeEventListener("storage", onChange);
    };
  }, []);

  /** Load the list only when the history panel is actually opened. */
  useEffect(() => {
    if (!showHistory || !isDashboard) return;
    if (mode === "finna") {
      listFinnaChats().then(setChats).catch(() => setChats([]));
    } else {
      getCouncilOverview().then((o) => setPastCouncil(o.sessions)).catch(() => {});
    }
  }, [showHistory, mode, isDashboard]);

  /**
   * Save any answer straight into the Company Brain, without asking Finna to
   * draft one first. Deterministic — it posts the text as a note, so it costs
   * nothing and can't reword what was actually said.
   *
   * Lands in the Unassigned bucket: a note from open chat has no category, and
   * guessing one would file the user's thinking somewhere they didn't choose.
   */
  const saveToBrain = async (index: number) => {
    const m = messages[index];
    if (!m || m.savedToBrain === "saving") return;
    const body = m.council?.verdict?.verdict || m.content;
    if (!body?.trim()) return;

    // The preceding user turn is what the answer was about, so it makes a
    // better title than the first line of the answer itself.
    const asked = [...messages.slice(0, index)].reverse().find((x) => x.role === "user");

    setMessages((ms) => ms.map((x, i) => (i === index ? { ...x, savedToBrain: "saving" } : x)));
    try {
      await createBrainNode({
        title: titleFrom(asked?.content || body),
        content: `${asked ? `**Asked:** ${asked.content}\n\n` : ""}${body}`,
        type: "note",
        source: "system",
      });
      setMessages((ms) => ms.map((x, i) => (i === index ? { ...x, savedToBrain: "saved" } : x)));
    } catch {
      setMessages((ms) => ms.map((x, i) => (i === index ? { ...x, savedToBrain: undefined } : x)));
    }
  };

  /** Start fresh — the current conversation stays saved and reachable. */
  const startNewChat = () => {
    setChatId(null);
    setMessages([]);
    setStarted(true);
    setShowHistory(false);
  };

  const openChat = async (id: string) => {
    setShowHistory(false);
    try {
      const chat = await getFinnaChat(id);
      setChatId(chat.id);
      setMessages(chat.messages.map((m) => ({ role: m.role, content: m.content })));
      setStarted(true);
    } catch {
      setMessages((ms) => [...ms, { role: "assistant", content: "That chat couldn't be opened." }]);
    }
  };

  const openPastCouncil = async (id: string) => {
    setShowHistory(false);
    try {
      const session = await getCouncilSession(id);
      setMessages([
        { role: "user", content: session.question },
        { role: "assistant", content: "", council: session },
      ]);
      setStarted(true);
    } catch {
      /* leave the thread as it was */
    }
  };

  const removeChat = async (id: string) => {
    await deleteFinnaChat(id).catch(() => {});
    setChats((cs) => cs.filter((c) => c.id !== id));
    if (chatId === id) startNewChat();
  };

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  // After every hook, so the order stays stable across renders.
  if (isSettings || userHidden) return null;

  const quickActions =
    mode === "council" ? COUNCIL_QUICK : isDashboard ? DASHBOARD_QUICK : LANDING_QUICK;

  /** The signed-in user's credentials, so Finna reads only their own books. */
  const creds = () => ({
    token: typeof window !== "undefined" ? localStorage.getItem("accessToken") : null,
    businessId: typeof window !== "undefined" ? localStorage.getItem("activeBusinessId") : null,
  });

  /**
   * The user approved a draft. This is the only path where a chat message can
   * change the books — Finna never writes on its own.
   */
  const confirmAction = async (index: number) => {
    const action = messages[index]?.pendingAction;
    if (!action) return;

    setMessages((ms) => ms.map((m, i) => (i === index ? { ...m, actionState: "confirmed" } : m)));
    setLoading(true);
    try {
      const res = await fetch("/api/chat/execute", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, ...creds() }),
      });
      const data = await res.json();
      setMessages((ms) => [...ms, { role: "assistant", content: data.content }]);
      if (data.dataChanged && typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("finna:dataChanged"));
      }
    } catch {
      setMessages((ms) => [...ms, { role: "assistant", content: "That didn't go through. Please try again." }]);
    } finally {
      setLoading(false);
    }
  };

  const cancelAction = (index: number) => {
    setMessages((ms) => ms.map((m, i) => (i === index ? { ...m, actionState: "cancelled" } : m)));
  };

  /**
   * Convene the Council. Two AI calls behind one send, so it takes far longer
   * than a chat reply — the placeholder message below exists so the widget
   * doesn't just sit there looking broken while it runs.
   */
  const sendCouncil = async (text: string) => {
    if (!text.trim()) return;
    if (text.trim().length < 10) {
      setMessages((ms) => [...ms, { role: "assistant", content: "Give the Council a real question — at least a sentence." }]);
      return;
    }
    setMessages((ms) => [...ms, { role: "user", content: text }]);
    setInput("");
    setLoading(true);
    try {
      const session = await conveneCouncil(text.trim());
      setMessages((ms) => [...ms, { role: "assistant", content: "", council: session }]);
      // Refresh the remaining count — one was just spent.
      getCouncilOverview().then((o) => setQuota(o.quota)).catch(() => {});
    } catch (e) {
      setMessages((ms) => [...ms, {
        role: "assistant",
        content: e instanceof Error ? e.message : "The Council could not finish. Please try again.",
      }]);
    } finally {
      setLoading(false);
    }
  };

  /** One entry point; the mode decides which of the two it is. */
  const send = (text: string) => (mode === "council" ? sendCouncil(text) : sendMessage(text));

  const sendMessage = async (text: string) => {
    if (!text.trim()) return;
    const newMessages: Message[] = [...messages, { role: "user", content: text }];
    setMessages(newMessages);
    setInput("");
    setLoading(true);
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          // Only the text goes to the model — never the local action state.
          messages: newMessages.map((m) => ({ role: m.role, content: m.content })),
          isDashboard,
          ...creds(),
          language
        }),
      });
      const data = await res.json();
      setMessages([...newMessages, {
        role: "assistant",
        content: data.content,
        pendingAction: data.pendingAction,
      }]);

      /**
       * Persist the exchange so the chat survives closing the widget. The
       * conversation is named from its opening message rather than asking the
       * user to title it before they're allowed to type. Best-effort: failing
       * to save history must never look like a failed answer.
       */
      if (isDashboard) {
        try {
          let id = chatId;
          if (!id) {
            const created = await createFinnaChat(titleFrom(text));
            id = created.id;
            setChatId(created.id);
          }
          await appendFinnaMessages(id, [
            { role: "user", content: text },
            { role: "assistant", content: data.content },
          ]);
        } catch {
          /* history is a convenience, not the answer */
        }
      }
      // Finna created/changed data — let the dashboard refresh itself.
      if (data.dataChanged && typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("finna:dataChanged"));
      }
    } catch {
      const fallback = isDashboard
        ? getFallbackReply(text, true)
        : (LANDING_QA[text] || getFallbackReply(text, false));
      setMessages([...newMessages, { role: "assistant", content: fallback }]);
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setOpen(false);
    // Keep the external flag in step with the panel wherever the observer is
    // listening. Leaving it on 'open' after a close means the next unrelated
    // mutation re-reads a stale 'open' and pops the panel back up.
    if (!isSettings) document.body.setAttribute('data-chat', 'closed');
  };

  return (
    <>
      {open && (
        <div style={{
          position: "fixed",
          // Anchored to the bubble so the panel follows it around the screen,
          // and clamped so dragging the bubble into a corner doesn't push the
          // panel off the edge.
          bottom: Math.min(
            bubblePos?.bottom ?? BUBBLE_DEFAULT.bottom,
            typeof window !== "undefined" ? Math.max(0, window.innerHeight - 480) : 96
          ),
          right: Math.min(
            (bubblePos?.right ?? BUBBLE_DEFAULT.right) + (isDashboard ? 64 : 56),
            typeof window !== "undefined" ? Math.max(0, window.innerWidth - 316) : 80
          ),
          zIndex: 9998,
          width: 300,
          background: "#111",
          borderRadius: 20,
          overflow: "hidden",
          border: "0.5px solid #222",
          boxShadow: "0 8px 32px rgba(0,0,0,0.4)",
          display: "flex",
          flexDirection: "column",
          maxHeight: 460,
          fontFamily: "sans-serif",
        }}>
          {/* Header */}
          <div style={{ background: "#111", padding: "13px 14px", display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: "0.5px solid #1f1f1f" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{ width: 30, height: 30, background: "#1a2e1a", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="2"><rect x="3" y="11" width="18" height="10" rx="2"/><circle cx="12" cy="5" r="2"/><path d="M12 7v4"/><line x1="8" y1="15" x2="8" y2="17"/><line x1="16" y1="15" x2="16" y2="17"/></svg>
              </div>
              <div>
                <div style={{ fontSize: 13, fontWeight: 700, color: "#fff" }}>
                  {mode === "council" ? "Finna Council" : "Finna"}
                </div>
                <div style={{ fontSize: 11, color: "#555" }}>
                  {mode === "council"
                    ? "Four specialists debate it"
                    : isDashboard ? "Your Financial Assistant" : "Finquanta AI"}
                </div>
              </div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              {isDashboard && (
                <>
                  {/* Past chats and past Council sessions. */}
                  <button
                    onClick={() => setShowHistory((s) => !s)}
                    title="History"
                    style={{ background: "none", border: "none", color: showHistory ? "#22c55e" : "#555", cursor: "pointer", display: "flex", padding: 0 }}
                  >
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="9"/><polyline points="12 7 12 12 15 14"/></svg>
                  </button>
                  {/* In Council mode this clears the thread so the next
                      question starts clean — a Council session is a one-shot
                      deliberation, so "new" means an empty slate, not a new
                      saved conversation. */}
                  <button
                    onClick={startNewChat}
                    title={mode === "council" ? "New question" : "New chat"}
                    style={{ background: "none", border: "none", color: "#555", cursor: "pointer", display: "flex", padding: 0 }}
                  >
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                  </button>
                </>
              )}
              <button onClick={handleClose} style={{ background: "none", border: "none", color: "#555", cursor: "pointer", fontSize: 20, lineHeight: 1 }}>×</button>
            </div>
          </div>

          {/* Mode switch. Dashboard only — the Council needs a signed-in
              business to read the books of, so it has no landing-page form. */}
          {isDashboard && (
            <div style={{ display: "flex", gap: 4, padding: "8px 14px 0", background: "#111" }}>
              {(["finna", "council"] as Mode[]).map((m) => (
                <button
                  key={m}
                  onClick={() => setMode(m)}
                  style={{
                    flex: 1,
                    background: mode === m ? "#1a2e1a" : "#1a1a1a",
                    border: `0.5px solid ${mode === m ? "#22c55e" : "#2a2a2a"}`,
                    color: mode === m ? "#22c55e" : "#666",
                    borderRadius: 8,
                    padding: "6px 0",
                    fontSize: 11,
                    fontWeight: 600,
                    cursor: "pointer",
                  }}
                >
                  {m === "finna" ? "Finna" : "Council"}
                </button>
              ))}
            </div>
          )}

          {/* What convening costs, before it's spent. Hidden while browsing
              history — you're reading past decisions there, not buying one. */}
          {isDashboard && mode === "council" && quota && !showHistory && (
            <div style={{ padding: "6px 14px 0", background: "#111", fontSize: 10, color: quota.allowed ? "#555" : "#f59e0b" }}>
              {quota.allowed
                ? `${quota.limit - quota.used} of ${quota.limit} sessions left today`
                : quota.scope === "global"
                  ? "The Council has reached today's platform limit."
                  : "No Council sessions left today. They reset tomorrow."}
            </div>
          )}

          {/* History. Sits BELOW the mode switch so that switch stays in the
              same place whether you're chatting or looking back — it moved to
              the bottom of the panel when this block rendered above it.
              Replaces the thread rather than sitting beside it; there is no
              room for two panels at 300px. */}
          {showHistory && isDashboard && (
            <div style={{ flex: 1, overflowY: "auto", padding: 12, background: "#111", minHeight: 280 }}>
              <div style={{ fontSize: 10, color: "#666", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 8 }}>
                {mode === "council" ? "Past decisions" : "Your chats"}
              </div>

              {mode === "finna" ? (
                chats.length === 0 ? (
                  <div style={{ fontSize: 11, color: "#555" }}>No saved chats yet.</div>
                ) : (
                  chats.map((c) => (
                    <div key={c.id} style={{ display: "flex", alignItems: "stretch", gap: 4, marginBottom: 5 }}>
                      <button
                        onClick={() => openChat(c.id)}
                        style={{
                          flex: 1, textAlign: "left", background: c.id === chatId ? "#1a2e1a" : "#1a1a1a",
                          border: `0.5px solid ${c.id === chatId ? "#22c55e" : "#2a2a2a"}`,
                          borderRadius: 8, padding: "7px 9px", cursor: "pointer",
                        }}
                      >
                        <div style={{ fontSize: 11, color: "#ddd", lineHeight: 1.35 }}>{c.title}</div>
                        <div style={{ fontSize: 10, color: "#555" }}>
                          {new Date(c.updatedAt).toLocaleDateString()} · {c.messageCount} messages
                        </div>
                      </button>
                      <button
                        onClick={() => removeChat(c.id)}
                        title="Delete"
                        style={{ background: "#1a1a1a", border: "0.5px solid #2a2a2a", borderRadius: 8, color: "#555", cursor: "pointer", padding: "0 7px" }}
                      >
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/></svg>
                      </button>
                    </div>
                  ))
                )
              ) : pastCouncil.length === 0 ? (
                <div style={{ fontSize: 11, color: "#555" }}>No Council sessions yet.</div>
              ) : (
                pastCouncil.map((s) => (
                  <button
                    key={s.id}
                    onClick={() => openPastCouncil(s.id)}
                    style={{
                      display: "block", width: "100%", textAlign: "left", background: "#1a1a1a",
                      border: "0.5px solid #2a2a2a", borderRadius: 8, padding: "7px 9px",
                      cursor: "pointer", marginBottom: 5,
                    }}
                  >
                    <div style={{ fontSize: 11, color: "#ddd", lineHeight: 1.35 }}>{s.question}</div>
                    <div style={{ fontSize: 10, color: "#555" }}>
                      {new Date(s.createdAt).toLocaleDateString()}
                      {s.status === "failed" && " · failed"}
                    </div>
                  </button>
                ))
              )}
            </div>
          )}

          {/* Body. Hidden rather than unmounted while history is open, so the
              live conversation and its scroll position survive a look back. */}
          <div style={{ flex: 1, overflowY: "auto", padding: 14, display: showHistory ? "none" : "flex", flexDirection: "column", gap: 10, background: "#111", minHeight: showHistory ? 0 : 280 }}>
            {!started ? (
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "100%", gap: 14, textAlign: "center", padding: "0 8px" }}>
                <div style={{ width: 52, height: 52, background: "#1a2e1a", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="2"><rect x="3" y="11" width="18" height="10" rx="2"/><circle cx="12" cy="5" r="2"/><path d="M12 7v4"/><line x1="8" y1="15" x2="8" y2="17"/><line x1="16" y1="15" x2="16" y2="17"/></svg>
                </div>
                <div>
                  <p style={{ fontWeight: 700, fontSize: 14, color: "#fff", marginBottom: 4 }}>
                    {mode === "council" ? "Convene the Council" : "Hi, I'm Finna!"}
                  </p>
                  <p style={{ fontSize: 12, color: "#666", lineHeight: 1.6 }}>
                    {mode === "council"
                      ? "Four specialists argue your decision, then I deliver the verdict — including where they disagreed."
                      : isDashboard ? "Your financial assistant for budgeting, investments, and planning." : "Ask me anything about Finquanta and how we can help your business."}
                  </p>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 6, width: "100%" }}>
                  {quickActions.map(action => (
                    <button key={action} onClick={() => { setStarted(true); send(action); }}
                      style={{ background: "#1a1a1a", border: "0.5px solid #2a2a2a", borderRadius: 8, padding: "8px 10px", fontSize: 11, cursor: "pointer", color: "#22c55e", fontWeight: 500, textAlign: "left" }}>
                      {action}
                    </button>
                  ))}
                </div>
                <button onClick={() => setStarted(true)}
                  style={{ background: "#22c55e", color: "#fff", border: "none", borderRadius: 8, padding: "7px 22px", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
                  Start Chat
                </button>
              </div>
            ) : (
              <>
                <div style={{ background: "#1a1a1a", border: "0.5px solid #222", borderRadius: 12, borderBottomLeftRadius: 4, padding: "9px 12px", fontSize: 12, color: "#ccc", alignSelf: "flex-start", maxWidth: "85%", lineHeight: 1.5 }}>
                  Hello! How can I help you today?
                </div>
                {messages.map((m, i) => (
                  <div key={i} style={{ alignSelf: m.role === "user" ? "flex-end" : "flex-start", maxWidth: m.council ? "100%" : "85%" }}>
                    {m.content && (
                      <div style={{
                        background: m.role === "user" ? "#22c55e" : "#1a1a1a",
                        border: m.role === "user" ? "none" : "0.5px solid #222",
                        color: m.role === "user" ? "#fff" : "#ccc",
                        borderRadius: 12,
                        borderBottomRightRadius: m.role === "user" ? 4 : 12,
                        borderBottomLeftRadius: m.role === "assistant" ? 4 : 12,
                        padding: "9px 12px", fontSize: 12,
                        lineHeight: 1.5, whiteSpace: "pre-wrap",
                      }}>
                        {m.content}
                      </div>
                    )}

                    {/* A Council verdict. Compact here — the widget is 300px —
                        with the full transcript a click away on its own page. */}
                    {m.council?.verdict && (
                      <div style={{
                        background: "#0f0f0f", border: "0.5px solid #2a2a2a",
                        borderRadius: 12, padding: "11px 12px",
                      }}>
                        <div style={{ fontSize: 10, color: "#888", marginBottom: 4, textTransform: "uppercase", letterSpacing: 0.5 }}>
                          Verdict
                        </div>
                        <div style={{ fontSize: 12, color: "#eee", lineHeight: 1.55, marginBottom: 10 }}>
                          {m.council.verdict.verdict}
                        </div>

                        {m.council.verdict.votes.length > 0 && (
                          <div style={{ marginBottom: 10 }}>
                            {m.council.verdict.votes.map((v, vi) => (
                              <div key={vi} style={{ display: "flex", alignItems: "flex-start", gap: 6, marginBottom: 3 }}>
                                <span style={{
                                  width: 6, height: 6, borderRadius: "50%", marginTop: 5, flexShrink: 0,
                                  background: VOTE_COLOR[v.vote] ?? "#666",
                                }} />
                                <span style={{ fontSize: 11, color: "#aaa", lineHeight: 1.45 }}>
                                  <span style={{ color: "#ddd", fontWeight: 600 }}>{v.member}</span> — {v.because}
                                </span>
                              </div>
                            ))}
                          </div>
                        )}

                        {m.council.verdict.keyTension && (
                          <div style={{
                            background: "#1a1408", border: "0.5px solid #4a3a10",
                            borderRadius: 8, padding: "7px 9px", marginBottom: 10,
                          }}>
                            <div style={{ fontSize: 10, color: "#f59e0b", fontWeight: 600, marginBottom: 2 }}>Key tension</div>
                            <div style={{ fontSize: 11, color: "#ccc", lineHeight: 1.45 }}>{m.council.verdict.keyTension}</div>
                          </div>
                        )}

                        {m.council.verdict.nextAction && (
                          <div style={{ fontSize: 11, color: "#ccc", lineHeight: 1.45, marginBottom: 10 }}>
                            <span style={{ color: "#22c55e", fontWeight: 600 }}>Next: </span>
                            {m.council.verdict.nextAction}
                          </div>
                        )}

                        <a
                          href={`/council?session=${m.council.id}`}
                          style={{ fontSize: 11, color: "#22c55e", textDecoration: "none", fontWeight: 600 }}
                        >
                          Full transcript →
                        </a>
                      </div>
                    )}

                    {/* Finna drafted a write. Nothing is recorded until this is confirmed. */}
                    {m.pendingAction && (
                      <div style={{
                        marginTop: 6, background: "#0f0f0f", border: "0.5px solid #2a2a2a",
                        borderRadius: 10, padding: "10px 12px",
                      }}>
                        <div style={{ fontSize: 11, color: "#888", marginBottom: 2 }}>
                          {ACTION_LABEL[m.pendingAction.type] ?? "Pending change"}
                        </div>
                        <div style={{ fontSize: 12, color: "#fff", fontWeight: 600 }}>
                          {m.pendingAction.summary}
                        </div>

                        {m.actionState === "confirmed" ? (
                          <div style={{ fontSize: 11, color: "#22c55e", marginTop: 8 }}>✓ Confirmed</div>
                        ) : m.actionState === "cancelled" ? (
                          <div style={{ fontSize: 11, color: "#666", marginTop: 8 }}>Cancelled — nothing was saved.</div>
                        ) : (
                          <div style={{ display: "flex", gap: 6, marginTop: 8 }}>
                            <button
                              onClick={() => confirmAction(i)}
                              disabled={loading}
                              style={{
                                background: "#22c55e", color: "#fff", border: "none", borderRadius: 6,
                                padding: "5px 12px", fontSize: 11, fontWeight: 700, cursor: "pointer",
                              }}
                            >
                              Confirm
                            </button>
                            <button
                              onClick={() => cancelAction(i)}
                              style={{
                                background: "transparent", color: "#888", border: "0.5px solid #333",
                                borderRadius: 6, padding: "5px 12px", fontSize: 11, cursor: "pointer",
                              }}
                            >
                              Cancel
                            </button>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Keep any answer in the Company Brain, without asking
                        Finna to draft one first. Free — it posts the text as a
                        note. Hidden on drafts, which have their own confirm. */}
                    {isDashboard && m.role === "assistant" && !m.pendingAction &&
                      (m.content?.trim() || m.council?.verdict) && (
                      <button
                        onClick={() => saveToBrain(i)}
                        disabled={m.savedToBrain === "saving" || m.savedToBrain === "saved"}
                        style={{
                          marginTop: 5, background: "transparent", border: "none",
                          color: m.savedToBrain === "saved" ? "#22c55e" : "#555",
                          fontSize: 10, cursor: m.savedToBrain ? "default" : "pointer",
                          padding: 0, display: "flex", alignItems: "center", gap: 4,
                        }}
                      >
                        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M12 2a4 4 0 0 0-4 4v1a3 3 0 0 0 0 6v1a4 4 0 0 0 8 0v-1a3 3 0 0 0 0-6V6a4 4 0 0 0-4-4z"/>
                        </svg>
                        {m.savedToBrain === "saved"
                          ? "Saved to Brain"
                          : m.savedToBrain === "saving"
                            ? "Saving…"
                            : "Save to Brain"}
                      </button>
                    )}
                  </div>
                ))}
                {loading && (
                  <div style={{ background: "#1a1a1a", border: "0.5px solid #222", borderRadius: 12, borderBottomLeftRadius: 4, padding: "9px 12px", fontSize: 12, color: "#555", alignSelf: "flex-start" }}>
                    {/* Convening runs two AI calls, so it is much slower than a
                        chat reply. Saying what's happening beats "Typing…". */}
                    {mode === "council" ? "The Council is deliberating…" : "Typing..."}
                  </div>
                )}
                <div ref={bottomRef} />
              </>
            )}
          </div>

          {/* Input */}
          {started && !showHistory && (
            <div style={{ display: "flex", gap: 6, padding: "10px 12px", borderTop: "0.5px solid #1f1f1f", background: "#111" }}>
              <input
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(input); }}}
                placeholder={mode === "council" ? "What decision are you weighing?" : "Type here..."}
                disabled={mode === "council" && quota ? !quota.allowed : false}
                style={{ flex: 1, background: "#1a1a1a", border: "0.5px solid #2a2a2a", borderRadius: 8, padding: "7px 10px", fontSize: 12, color: "#fff", outline: "none" }}
              />
              <button onClick={() => send(input)} disabled={!input.trim() || loading || (mode === "council" && quota ? !quota.allowed : false)}
                style={{ background: "#22c55e", border: "none", borderRadius: 8, width: 32, height: 32, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", opacity: !input.trim() || loading ? 0.5 : 1, flexShrink: 0 }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
              </button>
            </div>
          )}
        </div>
      )}

      {/* Proactive offer. Non-modal, never blocking, always dismissible — it
          sits beside the bubble and can be ignored entirely (§10.3). Hidden
          while the chat is open so it can never interrupt a conversation. */}
      {isDashboard && nudge && !open && (
        <div style={{
          position: "fixed",
          bottom: (bubblePos?.bottom ?? BUBBLE_DEFAULT.bottom) + BUBBLE_SIZE + 10,
          right: bubblePos?.right ?? BUBBLE_DEFAULT.right,
          zIndex: 9998,
          // The three actions are equal thirds of this row, so the width is set
          // by the LONGEST label: "Ask the Council" needs ~92px with its
          // padding, and a third of 380 (less padding and gaps) is ~112px. At
          // the old 320 a third was only ~92px and the primary button would
          // have overflowed its own share. Capped against the viewport so it
          // stays inside the screen on a narrow phone, where a third still
          // clears 92px.
          width: 380,
          maxWidth: "calc(100vw - 32px)",
          background: "#111",
          border: "0.5px solid #2a2a2a",
          borderRadius: 14,
          padding: "12px 14px",
          boxShadow: "0 8px 32px rgba(0,0,0,0.4)",
          fontFamily: "sans-serif",
        }}>
          <div style={{ fontSize: 12, color: "#ddd", lineHeight: 1.5, marginBottom: 9 }}>
            {t("dashboard", nudge.messageKey)
              .replace("{months}", String(nudge.params?.months ?? ""))
              .replace("{percent}", String(nudge.params?.percent ?? ""))
              .replace("{question}", String(nudge.params?.question ?? ""))}
          </div>
          {/* Three equal thirds spanning the full row. `flex: "1 1 0"` (basis 0,
              not auto) is what makes them MATCH — with basis auto they would
              grow from their own text width and stay unequal. Earlier attempts
              that were rejected: `marginLeft: auto` on Dismiss put all the
              slack into one hole, and space-between left them at natural
              widths. */}
          <div style={{ display: "flex", gap: 8, alignItems: "stretch" }}>
            <button
              onClick={acceptNudge}
              style={{
                flex: "1 1 0", background: "#22c55e", color: "#fff",
                // Transparent rather than none, so all three buttons resolve to
                // the same box width — a missing border would make this one 1px
                // narrower than the other two and break the match.
                border: "0.5px solid transparent", borderRadius: 7,
                padding: "7px 4px", fontSize: 11, fontWeight: 700, cursor: "pointer",
                whiteSpace: "nowrap",
              }}
            >
              {t("dashboard", nudge.action === "review" ? "nudgeReview" : "nudgeOpen")}
            </button>
            {/* Leaves the offer outstanding — it returns next time. */}
            <button
              onClick={laterNudge}
              style={{
                flex: "1 1 0", background: "transparent", color: "#fff",
                border: "0.5px solid #333",
                borderRadius: 7, padding: "7px 4px", fontSize: 11, cursor: "pointer",
                whiteSpace: "nowrap",
              }}
            >
              {t("dashboard", "nudgeLater")}
            </button>
            {/* Retires the trigger for good. */}
            <button
              onClick={rejectNudge}
              title={t("dashboard", "nudgeDismissHint")}
              style={{
                // Red fill: this is the only destructive action of the three —
                // it retires the trigger permanently, where "Not now" only
                // defers. Same transparent border as the green button so all
                // three boxes stay exactly equal thirds.
                flex: "1 1 0", background: "#ef4444", color: "#fff",
                border: "0.5px solid transparent",
                borderRadius: 7, padding: "7px 4px", fontSize: 11, fontWeight: 700,
                cursor: "pointer", whiteSpace: "nowrap",
              }}
            >
              {t("dashboard", "nudgeDismiss")}
            </button>
          </div>
          {/* The offer names its own price before it is taken. */}
          {nudge.action === "convene" && (
            <div style={{ fontSize: 10, color: "#555", marginTop: 7 }}>
              {t("dashboard", "nudgeCostNote")}
            </div>
          )}
        </div>
      )}

      {/* The launcher. Renders on the marketing site too — without this the
          widget mounts there but has no way to be opened. */}
      {isVisible && (
        <button
          data-tour="finna"
          onPointerDown={onBubblePointerDown}
          // Suppressed after a drag so releasing the bubble doesn't also open
          // the chat — moving something and opening it are different intents.
          onClick={() => { if (!dragMoved.current) setOpen(!open); }}
          title="Drag to move"
          style={{
            position: "fixed",
            bottom: bubblePos?.bottom ?? BUBBLE_DEFAULT.bottom,
            right: bubblePos?.right ?? BUBBLE_DEFAULT.right,
            zIndex: 9999,
            width: BUBBLE_SIZE,
            height: BUBBLE_SIZE,
            touchAction: "none",
            cursor: dragging ? "grabbing" : "grab",
            transition: dragging ? "none" : "bottom 120ms ease, right 120ms ease",
            borderRadius: "50%",
            background: "#111",
            border: "none",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="2"><rect x="3" y="11" width="18" height="10" rx="2"/><circle cx="12" cy="5" r="2"/><path d="M12 7v4"/><line x1="8" y1="15" x2="8" y2="17"/><line x1="16" y1="15" x2="16" y2="17"/></svg>
        </button>
      )}
    </>
  );
}