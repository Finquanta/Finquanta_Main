'use client';

import { useEffect, useRef, useState } from 'react';
import { DemoChatMessage } from '@/lib/demo/types';
import { FINNA_MESSAGE_CAP, load, save } from '@/lib/demo/store';
import { DEMO_FINNA_PROMPTS, answerFromDemo } from '@/lib/demo/finna';
import { useLanguage } from '@/hooks/context/LanguageContext';

/**
 * The demo's Finna panel. Deliberately not ChatbotWidget — that one posts to
 * /api/chat with the signed-in user's token, which an anonymous visitor doesn't
 * have. Answers come from lib/demo/finna.ts, computed off this session's ledger.
 */
export default function DemoFinna() {
  const { t } = useLanguage();
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<DemoChatMessage[]>([]);
  const [used, setUsed] = useState(0);
  const [input, setInput] = useState('');
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const state = load();
    setMessages(state.finna.messages);
    setUsed(state.finna.messagesUsed);
  }, []);

  useEffect(() => {
    if (open) bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, open]);

  const atCap = used >= FINNA_MESSAGE_CAP;
  const remaining = Math.max(0, FINNA_MESSAGE_CAP - used);

  /**
   * `text` is what gets matched, `shown` is what appears in the bubble. They
   * differ for the suggestion chips, which must send English for the keyword
   * matching in answerFromDemo to work while displaying the visitor's language.
   */
  const ask = (text: string, shown?: string) => {
    const question = text.trim();
    if (!question || atCap) return;

    const state = load();
    const answer = answerFromDemo(question, state, t);
    const next: DemoChatMessage[] = [
      ...state.finna.messages,
      { role: 'user', content: shown?.trim() || question },
      { role: 'assistant', content: answer },
    ];
    state.finna.messages = next;
    state.finna.messagesUsed += 1;
    // Asking Finna is engagement like any other — the signup triggers read this.
    state.meta.interactionCount += 1;
    state.meta.lastInteractionAt = Date.now();
    save(state);

    setMessages(next);
    setUsed(state.finna.messagesUsed);
    setInput('');
  };

  return (
    <>
      {open && (
        <div className="fixed bottom-24 right-4 z-[55] w-[min(20rem,calc(100vw-2rem))] max-h-[28rem] flex flex-col rounded-2xl overflow-hidden bg-[#111] border border-[#222] shadow-2xl">
          <div className="flex items-center justify-between gap-2 px-3.5 py-3 border-b border-[#1f1f1f]">
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-full bg-[#1a2e1a] flex items-center justify-center">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="2"><rect x="3" y="11" width="18" height="10" rx="2"/><circle cx="12" cy="5" r="2"/><path d="M12 7v4"/><line x1="8" y1="15" x2="8" y2="17"/><line x1="16" y1="15" x2="16" y2="17"/></svg>
              </div>
              <div>
                <p className="text-[13px] font-bold text-white leading-tight">{t("demo","dFinna")}</p>
                <p className="text-[11px] text-[#555] leading-tight">{t("demo","dFinnaReading")}</p>
              </div>
            </div>
            <button onClick={() => setOpen(false)} className="text-[#555] hover:text-white text-xl leading-none px-1">×</button>
          </div>

          <div className="flex-1 overflow-y-auto p-3.5 flex flex-col gap-2.5 min-h-[16rem]">
            {messages.length === 0 ? (
              <div className="flex flex-col gap-3 h-full justify-center">
                <p className="text-[12px] text-[#666] leading-relaxed text-center px-2">
                  {t("demo","dFinnaIntro")}
                </p>
                <div className="flex flex-col gap-1.5">
                  {DEMO_FINNA_PROMPTS.map((p) => {
                    const label = t("demo", p.labelKey);
                    return (
                      <button key={p.labelKey} onClick={() => ask(p.query, label)}
                        className="text-left rounded-lg border border-[#2a2a2a] bg-[#1a1a1a] px-2.5 py-2 text-[11px] font-medium text-[#22c55e] hover:bg-[#222]">
                        {label}
                      </button>
                    );
                  })}
                </div>
              </div>
            ) : (
              messages.map((m, i) => (
                <div key={i}
                  className={`max-w-[85%] rounded-xl px-3 py-2 text-[12px] leading-relaxed whitespace-pre-wrap ${
                    m.role === 'user'
                      ? 'self-end bg-[#22c55e] text-white rounded-br-sm'
                      : 'self-start bg-[#1a1a1a] border border-[#222] text-[#ccc] rounded-bl-sm'
                  }`}>
                  {m.content}
                </div>
              ))
            )}
            <div ref={bottomRef} />
          </div>

          <div className="border-t border-[#1f1f1f] p-2.5">
            {atCap ? (
              <p className="text-[11px] text-[#666] text-center py-1.5 px-2 leading-relaxed">{t("demo","dFinnaLimit")}</p>
            ) : (
              <>
                <div className="flex gap-1.5">
                  <input
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); ask(input); } }}
                    placeholder={t("demo","dFinnaAsk")}
                    className="flex-1 rounded-lg bg-[#1a1a1a] border border-[#2a2a2a] px-2.5 py-1.5 text-[12px] text-white outline-none placeholder:text-[#555]"
                  />
                  <button onClick={() => ask(input)} disabled={!input.trim()}
                    className="w-8 h-8 shrink-0 rounded-lg bg-[#22c55e] disabled:opacity-50 flex items-center justify-center">
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
                  </button>
                </div>
                <p className="text-[10px] text-[#444] mt-1.5 text-center">
                  {t("demo", remaining === 1 ? "dFinnaLeftOne" : "dFinnaLeft").split("{n}").join(String(remaining))}
                </p>
              </>
            )}
          </div>
        </div>
      )}

      <button
        onClick={() => setOpen((o) => !o)}
        aria-label={t("demo","dFinnaBtn")}
        className="fixed bottom-6 right-4 z-[56] w-12 h-12 rounded-full bg-[#111] shadow-lg flex items-center justify-center hover:bg-[#1a1a1a]"
      >
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="2"><rect x="3" y="11" width="18" height="10" rx="2"/><circle cx="12" cy="5" r="2"/><path d="M12 7v4"/><line x1="8" y1="15" x2="8" y2="17"/><line x1="16" y1="15" x2="16" y2="17"/></svg>
      </button>
    </>
  );
}
