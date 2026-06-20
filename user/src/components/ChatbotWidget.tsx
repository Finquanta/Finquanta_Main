"use client";
import { useState, useRef, useEffect } from "react";
import { usePathname } from "next/navigation";
import { useLanguage } from "@/hooks/context/LanguageContext";

interface Message {
  role: "user" | "assistant";
  content: string;
}

const LANDING_QA: Record<string, string> = {
  "What is Finquanta?": "Finquanta is an AI fintech startup that automates bookkeeping, financial operations, and business insights.",
  "What does Finquanta do?": "It helps businesses manage finances automatically using AI-powered tracking, analytics, and recommendations.",
  "What problem does Finquanta solve?": "It removes manual bookkeeping and helps businesses understand their finances in real time.",
  "Who is Finquanta built for?": "Small businesses, startups, and growing companies that want smarter financial management.",
  "How does Finquanta use AI?": "The AI analyzes business data to provide smarter financial decisions and automate workflows.",
};

const LANDING_QUICK = Object.keys(LANDING_QA);
const DASHBOARD_QUICK = ["Budget Planner", "Track Expenses", "Investment Tips", "Savings Goals"];

const DASHBOARD_RESPONSES: Record<string, string> = {
  "Budget Planner": "I can help you build a budget! Tell me your monthly income and I'll help you allocate it across expenses, savings, and investments.",
  "Track Expenses": "Expense tracking is key to financial health. I can help you categorize and monitor your spending. What categories would you like to track?",
  "Investment Tips": "Here are 3 starter tips:\n\n1. Diversify your portfolio\n2. Invest consistently each month\n3. Focus on long-term growth over short-term gains.",
  "Savings Goals": "Let's set up your savings goals! Whether it's an emergency fund, a home, or retirement — I'll help you create a realistic plan.",
};

const getFallbackReply = (text: string, isDashboard: boolean) => {
  const lower = text.toLowerCase();
  if (!isDashboard) {
    if (lower.includes("finquanta")) return LANDING_QA["What is Finquanta?"];
    if (lower.includes("ai") || lower.includes("how")) return LANDING_QA["How does Finquanta use AI?"];
    if (lower.includes("who") || lower.includes("for")) return LANDING_QA["Who is Finquanta built for?"];
    if (lower.includes("problem") || lower.includes("solve")) return LANDING_QA["What problem does Finquanta solve?"];
    return "Finquanta is an AI-powered platform that automates bookkeeping and financial operations for businesses. Would you like to know more?";
  }
  if (lower.includes("budget")) return "Budgeting is the foundation of financial success. The 50/30/20 rule is a great place to start — 50% needs, 30% wants, 20% savings.";
  if (lower.includes("invest")) return "Investing early is one of the best financial decisions you can make. Even small amounts compound significantly over time.";
  if (lower.includes("save") || lower.includes("saving")) return "A good goal is to save at least 3–6 months of expenses as an emergency fund before investing.";
  if (lower.includes("expense")) return "Tracking your expenses monthly helps you spot patterns and cut unnecessary spending. Would you like tips on specific categories?";
  return "I'm here to help with your finances! Ask me about budgeting, savings, expenses, or investments.";
};

export default function ChatbotWidget() {
  const pathname = usePathname();
  const { language } = useLanguage();
  const [open, setOpen] = useState(false);
  const [started, setStarted] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  const isDashboard =
    pathname?.startsWith("/dashboard") ||
    pathname?.startsWith("/bookkeeping") ||
    pathname?.startsWith("/inbox") ||
    pathname?.startsWith("/payroll") ||
    pathname?.startsWith("/documents") ||
    pathname?.startsWith("/statistics") ||
    pathname?.startsWith("/business-plan");

  const isSettings =
    pathname?.startsWith("/profile-settings") ||
    pathname?.startsWith("/settings");

  useEffect(() => {
    if (isDashboard || isSettings) return;
    const observer = new MutationObserver(() => {
      const val = document.body.getAttribute('data-chat');
      setOpen(val === 'open');
    });
    observer.observe(document.body, { attributes: true, attributeFilter: ['data-chat'] });
    return () => observer.disconnect();
  }, [isDashboard, isSettings]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  if (isSettings) return null;

  const quickActions = isDashboard ? DASHBOARD_QUICK : LANDING_QUICK;

  const sendMessage = async (text: string) => {
    if (!text.trim()) return;
    const newMessages: Message[] = [...messages, { role: "user", content: text }];
    setMessages(newMessages);
    setInput("");
    setLoading(true);
    try {
      const token = typeof window !== "undefined" ? localStorage.getItem("accessToken") : null;
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: newMessages,
          isDashboard,
          token,
          language
        }),
      });
      const data = await res.json();
      setMessages([...newMessages, { role: "assistant", content: data.content }]);
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
    if (!isDashboard) document.body.setAttribute('data-chat', 'closed');
  };

  return (
    <>
      {open && (
        <div style={{
          position: "fixed",
          bottom: 96,
          right: isDashboard ? 80 : 72,
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
                <div style={{ fontSize: 13, fontWeight: 700, color: "#fff" }}>Finna</div>
                <div style={{ fontSize: 11, color: "#555" }}>{isDashboard ? "Your Financial Assistant" : "Finquanta AI"}</div>
              </div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <button onClick={handleClose} style={{ background: "none", border: "none", color: "#555", cursor: "pointer", fontSize: 20, lineHeight: 1 }}>×</button>
            </div>
          </div>

          {/* Body */}
          <div style={{ flex: 1, overflowY: "auto", padding: 14, display: "flex", flexDirection: "column", gap: 10, background: "#111", minHeight: 280 }}>
            {!started ? (
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "100%", gap: 14, textAlign: "center", padding: "0 8px" }}>
                <div style={{ width: 52, height: 52, background: "#1a2e1a", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="2"><rect x="3" y="11" width="18" height="10" rx="2"/><circle cx="12" cy="5" r="2"/><path d="M12 7v4"/><line x1="8" y1="15" x2="8" y2="17"/><line x1="16" y1="15" x2="16" y2="17"/></svg>
                </div>
                <div>
                  <p style={{ fontWeight: 700, fontSize: 14, color: "#fff", marginBottom: 4 }}>Hi, I'm Finna!</p>
                  <p style={{ fontSize: 12, color: "#666", lineHeight: 1.6 }}>
                    {isDashboard ? "Your financial assistant for budgeting, investments, and planning." : "Ask me anything about Finquanta and how we can help your business."}
                  </p>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 6, width: "100%" }}>
                  {quickActions.map(action => (
                    <button key={action} onClick={() => { setStarted(true); sendMessage(action); }}
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
                  <div key={i} style={{
                    alignSelf: m.role === "user" ? "flex-end" : "flex-start",
                    background: m.role === "user" ? "#22c55e" : "#1a1a1a",
                    border: m.role === "user" ? "none" : "0.5px solid #222",
                    color: m.role === "user" ? "#fff" : "#ccc",
                    borderRadius: 12,
                    borderBottomRightRadius: m.role === "user" ? 4 : 12,
                    borderBottomLeftRadius: m.role === "assistant" ? 4 : 12,
                    padding: "9px 12px", fontSize: 12, maxWidth: "85%",
                    lineHeight: 1.5, whiteSpace: "pre-wrap",
                  }}>
                    {m.content}
                  </div>
                ))}
                {loading && (
                  <div style={{ background: "#1a1a1a", border: "0.5px solid #222", borderRadius: 12, borderBottomLeftRadius: 4, padding: "9px 12px", fontSize: 12, color: "#555", alignSelf: "flex-start" }}>
                    Typing...
                  </div>
                )}
                <div ref={bottomRef} />
              </>
            )}
          </div>

          {/* Input */}
          {started && (
            <div style={{ display: "flex", gap: 6, padding: "10px 12px", borderTop: "0.5px solid #1f1f1f", background: "#111" }}>
              <input
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(input); }}}
                placeholder="Type here..."
                style={{ flex: 1, background: "#1a1a1a", border: "0.5px solid #2a2a2a", borderRadius: 8, padding: "7px 10px", fontSize: 12, color: "#fff", outline: "none" }}
              />
              <button onClick={() => sendMessage(input)} disabled={!input.trim() || loading}
                style={{ background: "#22c55e", border: "none", borderRadius: 8, width: 32, height: 32, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", opacity: !input.trim() || loading ? 0.5 : 1, flexShrink: 0 }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
              </button>
            </div>
          )}
        </div>
      )}

      {/* Dashboard-only trigger */}
      {isDashboard && (
        <button
          onClick={() => setOpen(!open)}
          style={{
            position: "fixed",
            bottom: 96,
            right: "1rem",
            zIndex: 9999,
            width: 48,
            height: 48,
            borderRadius: "50%",
            background: "#111",
            border: "none",
            cursor: "pointer",
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