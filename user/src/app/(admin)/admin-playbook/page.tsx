"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { checkAdmin } from "@/lib/api/admin";
import AdminSidebar, { readAdminDark } from "@/components/admin/AdminSidebar";

type Item = { name: string; purpose: string };
type Group = { title: string; blurb: string; items: Item[] };

// Plain-English rundown of what Finquanta is built with and why each piece exists.
const GROUPS: Group[] = [
  {
    title: "Frontend — what people see",
    blurb: "The website and screens users interact with.",
    items: [
      { name: "Next.js", purpose: "The framework that builds the website and its pages — the dashboard, signup, blog and admin panel all run on it." },
      { name: "React", purpose: "Powers the interactive parts of the screen (buttons, forms, live updates)." },
      { name: "TypeScript", purpose: "The programming language used throughout. It catches mistakes before they reach users." },
    ],
  },
  {
    title: "Backend — the engine",
    blurb: "The part users don't see that does the actual work.",
    items: [
      { name: "Fastify", purpose: "The server that receives requests, applies the rules, and talks to the database." },
      { name: "Node.js", purpose: "Runs the backend code on the server." },
      { name: "JWT (login tokens)", purpose: "Keeps people securely signed in and proves who they are on each request." },
    ],
  },
  {
    title: "Database — where everything is stored",
    blurb: "The permanent record of all app data.",
    items: [
      { name: "PostgreSQL", purpose: "Holds all the data — user accounts, businesses, transactions, blog posts and more." },
      { name: "Neon", purpose: "The cloud service that hosts the PostgreSQL database so it's always available." },
    ],
  },
  {
    title: "Hosting — where it all runs",
    blurb: "The services that put the app online.",
    items: [
      { name: "Vercel", purpose: "Hosts the website (frontend) and serves it to the public." },
      { name: "Render", purpose: "Hosts and runs the backend server." },
    ],
  },
  {
    title: "AI & communications",
    blurb: "The smart and outreach features.",
    items: [
      { name: "Anthropic Claude (Haiku model)", purpose: "The AI that powers Finna, the in-app financial assistant." },
      { name: "Resend", purpose: "Sends automated emails, such as password-reset links." },
    ],
  },
];

export default function AdminPlaybookPage() {
  const router = useRouter();
  const [dark, setDark] = useState(false);

  useEffect(() => { setDark(readAdminDark()); }, []);
  useEffect(() => {
    checkAdmin().catch(() => router.replace("/admin-login"));
  }, [router]);

  const c = {
    bg: dark ? "#0f172a" : "#f4f5f7",
    card: dark ? "#1e293b" : "#fff",
    border: dark ? "#334155" : "#e5e7eb",
    text: dark ? "#f1f5f9" : "#0f172a",
    muted: dark ? "#94a3b8" : "#6b7280",
    chip: dark ? "#0f172a" : "#f3f4f6",
  };

  return (
    <div style={{ display: "flex", height: "100vh", fontFamily: "sans-serif", background: c.bg, color: c.text }}>
      <AdminSidebar active="playbook" dark={dark} setDark={setDark} />
      <div style={{ flex: 1, overflow: "auto" }}>
        <div style={{ maxWidth: 820, margin: "0 auto", padding: "32px 24px" }}>
          <div style={{ marginBottom: 24 }}>
            <h1 style={{ fontSize: 20, fontWeight: 700, margin: 0 }}>Playbook</h1>
            <p style={{ fontSize: 13, color: c.muted, margin: "2px 0 0" }}>What Finquanta is built with, and what each piece does — in plain English.</p>
          </div>

          <div style={{ display: "grid", gap: 16 }}>
            {GROUPS.map((g) => (
              <div key={g.title} style={{ borderRadius: 12, border: `1px solid ${c.border}`, background: c.card, padding: 20 }}>
                <h2 style={{ fontSize: 15, fontWeight: 700, margin: 0 }}>{g.title}</h2>
                <p style={{ fontSize: 12.5, color: c.muted, margin: "3px 0 14px" }}>{g.blurb}</p>
                <div style={{ display: "grid", gap: 10 }}>
                  {g.items.map((it) => (
                    <div key={it.name} style={{ display: "flex", gap: 12, alignItems: "baseline" }}>
                      <span style={{ flexShrink: 0, fontSize: 12.5, fontWeight: 600, background: c.chip, color: c.text, borderRadius: 6, padding: "3px 9px", minWidth: 130 }}>{it.name}</span>
                      <span style={{ fontSize: 13, color: c.muted, lineHeight: 1.5 }}>{it.purpose}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
