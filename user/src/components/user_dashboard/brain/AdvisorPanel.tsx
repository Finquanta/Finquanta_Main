"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  Archive, BrainCircuit, Check, Loader2, MoreHorizontal, Pencil, Plus, Send, Sparkles, Trash2, X,
} from "lucide-react";
import { useLanguage } from "@/hooks/context/LanguageContext";
import {
  AdvisorContext, AdvisorMessage, AdvisorThread, GuidedCategory, ThreadStatus,
  appendAdvisorMessages, createAdvisorThread, deleteAdvisorThread, getAdvisorContext,
  getAdvisorThread, listAdvisorThreads, saveAdvisorAnswers, saveAdvisorThreadAsNote,
  updateAdvisorThread,
} from "@/lib/api/brain";

/**
 * The guided-category advisor (Company Brain spec §6b).
 *
 * Marketing and Sales can't be data pins — Finquanta has no posting, ad or CRM
 * integration — and leaving them as silent notebooks wastes the category. So
 * Finna advises here instead, and the category gets more useful the more it is
 * told. That bargain is stated to the user rather than hidden: the specificity
 * banner says outright how much the advice has to work with.
 *
 * Conversations are saved per subject. A business promoting two things at once
 * — say a trading platform and an NFT drop — needs two threads, because those
 * carry different budgets, stages and audiences, and merging them makes both
 * the advice and the record worse.
 *
 * Cost rule (§6b): this is ordinary Finna chat against the normal message
 * quota. It is not a background job — nothing runs until the user types.
 */

interface Msg extends AdvisorMessage {
  pendingAction?: { type: string; summary: string; payload: Record<string, unknown> };
  actionState?: "confirmed" | "cancelled";
}

const creds = () => ({
  token: typeof window !== "undefined" ? localStorage.getItem("accessToken") : null,
  businessId: typeof window !== "undefined" ? localStorage.getItem("activeBusinessId") : null,
});

/** First line of the opening message, so a thread has a name without asking. */
const titleFrom = (text: string) => {
  const line = text.trim().split("\n")[0].trim();
  return (line.length > 60 ? `${line.slice(0, 57)}…` : line) || "Untitled";
};

export default function AdvisorPanel({
  isDark, category, onNoteSaved,
}: {
  isDark: boolean;
  category: GuidedCategory;
  /** A note was written into the Brain — refresh the category behind us. */
  onNoteSaved: () => void;
}) {
  const { t, language } = useLanguage();
  const [ctx, setCtx] = useState<AdvisorContext | null>(null);
  const [threads, setThreads] = useState<AdvisorThread[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);

  const [draft, setDraft] = useState<Record<string, string>>({});
  const [savingAnswer, setSavingAnswer] = useState<string | null>(null);
  const [editingAnswer, setEditingAnswer] = useState<string | null>(null);
  const [showAnswers, setShowAnswers] = useState(false);
  const [editingContext, setEditingContext] = useState(false);
  const [menuFor, setMenuFor] = useState<string | null>(null);
  const [viewArchived, setViewArchived] = useState(false);
  const [savedToBrain, setSavedToBrain] = useState(false);
  const [ctxDraft, setCtxDraft] = useState({ title: "", stage: "", budget: "", situation: "" });
  const threadRef = useRef<HTMLDivElement>(null);

  const sub = isDark ? "text-gray-400" : "text-gray-500";
  const text = isDark ? "text-white" : "text-gray-900";
  const card = isDark ? "bg-gray-800/60 border-gray-700" : "bg-white border-gray-200";
  const field = `w-full rounded-lg border px-3 py-2 text-sm outline-none ${
    isDark
      ? "bg-gray-900 border-gray-700 text-gray-100 placeholder-gray-500"
      : "bg-white border-gray-300 text-gray-900 placeholder-gray-400"
  }`;

  const loadCtx = useCallback(
    (threadId: string | null) => {
      getAdvisorContext(category, threadId).then(setCtx).catch(() => setCtx(null));
    },
    [category]
  );

  // Switching category is a different advisor with different threads.
  useEffect(() => {
    setMessages([]);
    setDraft({});
    setActiveId(null);
    setShowAnswers(false);
    loadCtx(null);
  }, [category, loadCtx]);

  // Re-listed whenever the category or the archived/active view changes.
  useEffect(() => {
    listAdvisorThreads(category, viewArchived ? "archived" : "active")
      .then(setThreads)
      .catch(() => setThreads([]));
  }, [category, viewArchived]);

  useEffect(() => {
    threadRef.current?.scrollTo({ top: threadRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, loading]);

  const openThread = async (id: string) => {
    setActiveId(id);
    setMessages([]);
    setSavedToBrain(false);
    setMenuFor(null);
    try {
      const detail = await getAdvisorThread(id);
      setMessages(detail.messages ?? []);
      setCtxDraft({
        title: detail.title, stage: detail.stage ?? "",
        budget: detail.budget ?? "", situation: detail.situation ?? "",
      });
    } catch {
      setMessages([]);
    }
    loadCtx(id);
  };

  const startNew = () => {
    setActiveId(null);
    setMessages([]);
    setEditingContext(false);
    setSavedToBrain(false);
    setMenuFor(null);
    setCtxDraft({ title: "", stage: "", budget: "", situation: "" });
    loadCtx(null);
  };

  const removeThread = async (id: string) => {
    await deleteAdvisorThread(id).catch(() => {});
    setThreads((ts) => ts.filter((x) => x.id !== id));
    if (activeId === id) startNew();
  };

  /** Archive or restore. The thread drops out of whichever list we're viewing. */
  const setThreadStatus = async (th: AdvisorThread, status: ThreadStatus) => {
    setMenuFor(null);
    await updateAdvisorThread(th.id, { status }).catch(() => {});
    setThreads((ts) => ts.filter((x) => x.id !== th.id));
    if (activeId === th.id) startNew();
  };

  /**
   * Keep the whole conversation in the Brain, not just the one decision Finna
   * offers to note. Deterministic on the server — no AI call, no cost.
   */
  const saveConversation = async () => {
    if (!activeId) return;
    setSavedToBrain(false);
    const ok = await saveAdvisorThreadAsNote(activeId).catch(() => null);
    if (ok) {
      setSavedToBrain(true);
      onNoteSaved();
    }
  };

  const saveAnswer = async (id: string) => {
    const value = (draft[id] ?? "").trim();
    if (!value) return;
    setSavingAnswer(id);
    try {
      await saveAdvisorAnswers(category, { [id]: value });
      setDraft((d) => ({ ...d, [id]: "" }));
      setEditingAnswer(null);
      loadCtx(activeId);
    } finally {
      setSavingAnswer(null);
    }
  };

  const saveThreadContext = async () => {
    if (!activeId) return;
    const updated = await updateAdvisorThread(activeId, ctxDraft).catch(() => null);
    if (updated) {
      setThreads((ts) => ts.map((x) => (x.id === activeId ? updated : x)));
      loadCtx(activeId);
    }
    setEditingContext(false);
  };

  const send = async (raw: string) => {
    const textIn = raw.trim();
    if (!textIn || loading) return;

    // No thread yet: name one from the opening message rather than making the
    // user fill in a form before they're allowed to ask anything.
    let threadId = activeId;
    if (!threadId) {
      const created = await createAdvisorThread(category, { title: titleFrom(textIn) }).catch(() => null);
      if (created) {
        threadId = created.id;
        setActiveId(created.id);
        setThreads((ts) => [created, ...ts]);
      }
    }

    const next: Msg[] = [...messages, { role: "user", content: textIn }];
    setMessages(next);
    setInput("");
    setLoading(true);
    // The saved copy is now out of date — stop claiming otherwise.
    setSavedToBrain(false);
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: next.map((m) => ({ role: m.role, content: m.content })),
          isDashboard: true,
          advisor: category,
          threadId,
          language,
          ...creds(),
        }),
      });
      const data = await res.json();
      setMessages([...next, {
        role: "assistant",
        content: data.content,
        pendingAction: data.pendingAction,
      }]);

      if (threadId) {
        await appendAdvisorMessages(threadId, [
          { role: "user", content: textIn },
          { role: "assistant", content: data.content },
        ]).catch(() => {});
      }
    } catch {
      setMessages([...next, { role: "assistant", content: t("dashboard", "brainAdvisorError") }]);
    } finally {
      setLoading(false);
    }
  };

  /** The only path that writes a note — Finna drafts, the user approves. */
  const confirmNote = async (index: number) => {
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
      onNoteSaved();
      loadCtx(activeId);
    } catch {
      setMessages((ms) => [...ms, { role: "assistant", content: t("dashboard", "brainAdvisorError") }]);
    } finally {
      setLoading(false);
    }
  };

  if (!ctx) return null;

  const specificityTone =
    ctx.specificity === "rich"
      ? "text-emerald-500"
      : ctx.specificity === "partial"
        ? "text-amber-500"
        : sub;

  // One at a time. A wall of questions reads like a form; one reads like a
  // conversation, which is what this is meant to be.
  const nextQuestion = ctx.questions.find((q) => ctx.unanswered.includes(q.id)) ?? null;
  const answered = ctx.questions.filter((q) => !ctx.unanswered.includes(q.id));
  const activeThread = threads.find((x) => x.id === activeId) ?? null;

  const chip = `text-[11px] px-2 py-1 rounded-md ${
    isDark ? "bg-gray-900 text-gray-300" : "bg-gray-100 text-gray-700"
  }`;

  return (
    <div className={`rounded-xl border ${card} p-4 mb-6`}>
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-purple-500" />
          <h3 className={`text-sm font-semibold ${text}`}>
            {t("dashboard", `brainAdvisorTitle_${category}`)}
          </h3>
        </div>
        <div className="flex items-center gap-3">
          {/* Keep the whole thread, not just the one decision Finna offers to
              note. Free — the server formats the stored transcript. */}
          {activeId && messages.length > 0 && (
            <button
              onClick={saveConversation}
              className={`flex items-center gap-1 text-[11px] ${
                savedToBrain ? "text-emerald-500" : sub
              } hover:text-purple-500`}
            >
              {savedToBrain ? <Check className="w-3 h-3" /> : <BrainCircuit className="w-3 h-3" />}
              {t("dashboard", savedToBrain ? "brainAdvisorSavedToBrain" : "brainAdvisorSaveToBrain")}
            </button>
          )}
          <button
            onClick={startNew}
            className={`flex items-center gap-1 text-[11px] ${sub} hover:text-purple-500`}
          >
            <Plus className="w-3 h-3" /> {t("dashboard", "brainAdvisorNewChat")}
          </button>
        </div>
      </div>
      <p className={`text-[11px] ${sub} mb-3`}>{t("dashboard", "brainAdvisorCannotAct")}</p>

      {/* Saved conversations, one per subject being advertised or sold. */}
      <div className="flex flex-wrap items-center gap-1.5 mb-3">
        {threads.map((th) => (
          <div key={th.id} className="relative flex items-center">
            <button
              onClick={() => openThread(th.id)}
              className={`text-[11px] px-2 py-1 rounded-l-md border-y border-l ${
                th.id === activeId
                  ? "bg-purple-600 text-white border-purple-600"
                  : isDark
                    ? "bg-gray-900 text-gray-300 border-gray-700"
                    : "bg-gray-50 text-gray-700 border-gray-200"
              }`}
            >
              {th.title}
            </button>
            <button
              onClick={() => setMenuFor(menuFor === th.id ? null : th.id)}
              className={`px-1.5 py-1 rounded-r-md border-y border-r ${
                th.id === activeId
                  ? "bg-purple-600 text-white border-purple-600"
                  : isDark
                    ? "bg-gray-900 text-gray-500 border-gray-700"
                    : "bg-gray-50 text-gray-400 border-gray-200"
              } hover:text-purple-400`}
            >
              <MoreHorizontal className="w-3 h-3" />
            </button>

            {menuFor === th.id && (
              <div
                className={`absolute z-20 top-full right-0 mt-1 w-40 rounded-lg border shadow-lg overflow-hidden ${card}`}
              >
                <button
                  onClick={() => { openThread(th.id); setEditingContext(true); setMenuFor(null); }}
                  className={`w-full text-left px-3 py-2 text-xs flex items-center gap-2 ${text} hover:bg-purple-600/10`}
                >
                  <Pencil className="w-3 h-3" /> {t("dashboard", "brainAdvisorRenameChat")}
                </button>
                <button
                  onClick={() => setThreadStatus(th, viewArchived ? "active" : "archived")}
                  className={`w-full text-left px-3 py-2 text-xs flex items-center gap-2 ${text} hover:bg-purple-600/10`}
                >
                  <Archive className="w-3 h-3" />
                  {t("dashboard", viewArchived ? "brainAdvisorUnarchiveChat" : "brainAdvisorArchiveChat")}
                </button>
                <button
                  onClick={() => { removeThread(th.id); setMenuFor(null); }}
                  className="w-full text-left px-3 py-2 text-xs flex items-center gap-2 text-red-500 hover:bg-red-500/10"
                >
                  <Trash2 className="w-3 h-3" /> {t("dashboard", "brainAdvisorDeleteChat")}
                </button>
              </div>
            )}
          </div>
        ))}

        {/* Archived conversations aren't gone — they're just out of the way. */}
        <button
          onClick={() => setViewArchived((v) => !v)}
          className={`text-[11px] ${sub} hover:text-purple-500 flex items-center gap-1`}
        >
          <Archive className="w-3 h-3" />
          {t("dashboard", viewArchived ? "brainAdvisorShowActive" : "brainAdvisorShowArchived")}
        </button>
      </div>

      {/* Stage, budget and situation for THIS subject — the framing that makes a
          note still readable months later. */}
      {activeThread && (
        <div className="mb-3">
          {editingContext ? (
            <div className="space-y-2">
              {/* Renaming lives here too: one form for everything about this
                  conversation, rather than a separate rename affordance. */}
              {(["title", "stage", "budget", "situation"] as const).map((k) => (
                <input
                  key={k}
                  value={ctxDraft[k]}
                  onChange={(e) => setCtxDraft((d) => ({ ...d, [k]: e.target.value }))}
                  placeholder={t("dashboard", `brainAdvisor${k[0].toUpperCase()}${k.slice(1)}Placeholder`)}
                  className={field}
                />
              ))}
              <div className="flex gap-2">
                <button
                  onClick={saveThreadContext}
                  className="px-3 py-1.5 rounded-lg bg-purple-600 text-white text-xs"
                >
                  {t("dashboard", "brainAdvisorSaveEdit")}
                </button>
                <button onClick={() => setEditingContext(false)} className={`px-3 py-1.5 text-xs ${sub}`}>
                  {t("dashboard", "brainAdvisorCancelEdit")}
                </button>
              </div>
            </div>
          ) : (
            <div className="flex flex-wrap items-center gap-1.5">
              {activeThread.stage && (
                <span className={chip}>{t("dashboard", "brainAdvisorStage")}: {activeThread.stage}</span>
              )}
              {activeThread.budget && (
                <span className={chip}>{t("dashboard", "brainAdvisorBudget")}: {activeThread.budget}</span>
              )}
              {activeThread.situation && (
                <span className={chip}>{activeThread.situation}</span>
              )}
              <button
                onClick={() => setEditingContext(true)}
                className={`text-[11px] ${sub} hover:text-purple-500 flex items-center gap-1`}
              >
                <Pencil className="w-3 h-3" />
                {activeThread.stage || activeThread.budget || activeThread.situation
                  ? t("dashboard", "brainAdvisorEditContext")
                  : t("dashboard", "brainAdvisorAddContext")}
              </button>
            </div>
          )}
        </div>
      )}

      {/* The bargain, stated plainly (§6b): specific answers earn specific advice. */}
      <p className={`text-[11px] mb-2 ${specificityTone}`}>
        {t("dashboard", `brainAdvisorSpecificity_${ctx.specificity}`)}
      </p>

      {/* Everything already told to the advisor, reviewable and editable. */}
      {answered.length > 0 && (
        <div className="mb-3">
          <button
            onClick={() => setShowAnswers((s) => !s)}
            className={`text-[11px] ${sub} hover:text-purple-500`}
          >
            {showAnswers ? "▾" : "▸"} {t("dashboard", "brainAdvisorYourAnswers")} ({answered.length})
          </button>

          {showAnswers && (
            <div className="mt-2 space-y-2">
              {answered.map((q) => (
                <div key={q.id} className={`rounded-lg border p-2 ${card}`}>
                  <p className={`text-[11px] ${sub} mb-1`}>{t("dashboard", q.promptKey)}</p>
                  {editingAnswer === q.id ? (
                    <div className="flex gap-2">
                      <input
                        value={draft[q.id] ?? ""}
                        onChange={(e) => setDraft((d) => ({ ...d, [q.id]: e.target.value }))}
                        onKeyDown={(e) => { if (e.key === "Enter") saveAnswer(q.id); }}
                        className={field}
                        autoFocus
                      />
                      <button
                        onClick={() => saveAnswer(q.id)}
                        disabled={savingAnswer === q.id}
                        className="px-3 rounded-lg bg-purple-600 text-white text-sm disabled:opacity-40"
                      >
                        {savingAnswer === q.id
                          ? <Loader2 className="w-4 h-4 animate-spin" />
                          : <Check className="w-4 h-4" />}
                      </button>
                      <button onClick={() => setEditingAnswer(null)} className={`px-2 ${sub}`}>
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-start justify-between gap-2">
                      <p className={`text-sm ${text}`}>{ctx.answers[q.id]}</p>
                      <button
                        onClick={() => {
                          setDraft((d) => ({ ...d, [q.id]: ctx.answers[q.id] ?? "" }));
                          setEditingAnswer(q.id);
                        }}
                        className={`${sub} hover:text-purple-500 shrink-0`}
                      >
                        <Pencil className="w-3 h-3" />
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* One question at a time. Answering is optional — the advisor works
          without it, just more generally. */}
      {nextQuestion && (
        <div className="mb-4">
          <label className={`block text-[11px] mb-1 ${sub}`}>
            {t("dashboard", nextQuestion.promptKey)}
          </label>
          <div className="flex gap-2">
            <input
              value={draft[nextQuestion.id] ?? ""}
              onChange={(e) => setDraft((d) => ({ ...d, [nextQuestion.id]: e.target.value }))}
              onKeyDown={(e) => { if (e.key === "Enter") saveAnswer(nextQuestion.id); }}
              placeholder={t("dashboard", "brainAdvisorAnswerPlaceholder")}
              className={field}
            />
            <button
              onClick={() => saveAnswer(nextQuestion.id)}
              disabled={!((draft[nextQuestion.id] ?? "").trim()) || savingAnswer === nextQuestion.id}
              className="px-3 rounded-lg bg-purple-600 text-white text-sm disabled:opacity-40"
            >
              {savingAnswer === nextQuestion.id
                ? <Loader2 className="w-4 h-4 animate-spin" />
                : <Check className="w-4 h-4" />}
            </button>
          </div>
        </div>
      )}

      {messages.length > 0 && (
        <div ref={threadRef} className="max-h-80 overflow-y-auto space-y-3 mb-3 pr-1">
          {messages.map((m, i) => (
            <div key={i}>
              <div
                className={`text-sm whitespace-pre-wrap rounded-lg px-3 py-2 ${
                  m.role === "user"
                    ? "bg-purple-600 text-white ml-8"
                    : isDark ? "bg-gray-900 text-gray-100 mr-8" : "bg-gray-100 text-gray-900 mr-8"
                }`}
              >
                {m.content}
              </div>

              {/* A drafted note. Nothing is in the Brain until this is confirmed. */}
              {m.pendingAction && !m.actionState && (
                <div className={`mt-2 mr-8 rounded-lg border p-3 ${card}`}>
                  <p className={`text-[11px] ${sub} mb-1`}>{t("dashboard", "brainAdvisorSaveNote")}</p>
                  <p className={`text-sm font-medium mb-2 ${text}`}>{m.pendingAction.summary}</p>
                  <div className="flex gap-2">
                    <button
                      onClick={() => confirmNote(i)}
                      className="px-3 py-1.5 rounded-lg bg-emerald-600 text-white text-xs"
                    >
                      {t("dashboard", "brainAdvisorConfirmNote")}
                    </button>
                    <button
                      onClick={() =>
                        setMessages((ms) =>
                          ms.map((x, xi) => (xi === i ? { ...x, actionState: "cancelled" } : x))
                        )
                      }
                      className={`px-3 py-1.5 rounded-lg text-xs ${sub}`}
                    >
                      {t("dashboard", "brainAdvisorDiscardNote")}
                    </button>
                  </div>
                </div>
              )}
              {m.actionState === "cancelled" && (
                <p className={`text-[11px] mt-1 mr-8 ${sub}`}>
                  <X className="w-3 h-3 inline" /> {t("dashboard", "brainAdvisorNoteDiscarded")}
                </p>
              )}
            </div>
          ))}
          {loading && <Loader2 className={`w-4 h-4 animate-spin ${sub}`} />}
        </div>
      )}

      <div className="flex gap-2">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") send(input); }}
          placeholder={t("dashboard", `brainAdvisorPlaceholder_${category}`)}
          className={field}
        />
        <button
          onClick={() => send(input)}
          disabled={!input.trim() || loading}
          className="px-3 rounded-lg bg-purple-600 text-white disabled:opacity-40"
        >
          <Send className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
