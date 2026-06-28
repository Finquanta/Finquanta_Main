"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { checkAdmin } from "@/lib/api/admin";
import AdminSidebar, { readAdminDark } from "@/components/admin/AdminSidebar";

interface Commit { hash: string; author: string; date: string; subject: string }
interface PatchNotes { generatedAt: string; commits: Commit[] }

export default function AdminPatchNotesPage() {
  const router = useRouter();
  const [dark, setDark] = useState(false);
  const [data, setData] = useState<PatchNotes | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => { setDark(readAdminDark()); }, []);
  useEffect(() => {
    checkAdmin()
      .then(() =>
        fetch("/patch-notes.json", { cache: "no-store" })
          .then((r) => (r.ok ? r.json() : { commits: [] }))
          .then(setData)
          .finally(() => setLoading(false))
      )
      .catch(() => router.replace("/admin-login"));
  }, [router]);

  const fmt = (iso: string) => {
    const d = new Date(iso);
    return {
      date: d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" }),
      time: d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" }),
    };
  };

  // Categorise by the conventional-commit prefix for a small coloured tag.
  const tagFor = (subject: string): { label: string; color: string } => {
    const m = subject.match(/^(\w+)(?:\([^)]*\))?:/);
    const type = (m?.[1] || "").toLowerCase();
    if (type === "feat") return { label: "feature", color: "#16a34a" };
    if (type === "fix") return { label: "fix", color: "#dc2626" };
    if (type === "refactor") return { label: "refactor", color: "#7c3aed" };
    if (type === "docs") return { label: "docs", color: "#0891b2" };
    return { label: "update", color: "#6b7280" };
  };

  const c = {
    bg: dark ? "#0f172a" : "#f4f5f7",
    card: dark ? "#1e293b" : "#fff",
    border: dark ? "#334155" : "#e5e7eb",
    text: dark ? "#f1f5f9" : "#0f172a",
    muted: dark ? "#94a3b8" : "#6b7280",
    chip: dark ? "#0f172a" : "#f3f4f6",
  };

  const commits = data?.commits ?? [];

  return (
    <div style={{ display: "flex", height: "100vh", fontFamily: "sans-serif", background: c.bg, color: c.text }}>
      <AdminSidebar active="patch" dark={dark} setDark={setDark} />
      <div style={{ flex: 1, overflow: "auto" }}>
        <div style={{ maxWidth: 820, margin: "0 auto", padding: "32px 24px" }}>
          <div style={{ marginBottom: 20 }}>
            <h1 style={{ fontSize: 20, fontWeight: 700, margin: 0 }}>Patch Notes</h1>
            <p style={{ fontSize: 13, color: c.muted, margin: "2px 0 0" }}>
              Everything pushed to the repository — what changed, when, and who pushed it. Updates each time the site is deployed.
            </p>
          </div>

          {loading ? (
            <p style={{ fontSize: 13, color: c.muted }}>Loading…</p>
          ) : commits.length === 0 ? (
            <p style={{ fontSize: 13, color: c.muted }}>No patch notes available (generated at deploy time).</p>
          ) : (
            <div style={{ display: "grid", gap: 10 }}>
              {commits.map((cm) => {
                const t = fmt(cm.date);
                const tag = tagFor(cm.subject);
                return (
                  <div key={cm.hash} style={{ borderRadius: 10, border: `1px solid ${c.border}`, background: c.card, padding: "12px 16px", display: "flex", gap: 12, alignItems: "flex-start" }}>
                    <span style={{ flexShrink: 0, fontSize: 11, fontWeight: 700, color: "#fff", background: tag.color, borderRadius: 6, padding: "2px 8px", marginTop: 2 }}>{tag.label}</span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ margin: 0, fontSize: 14, fontWeight: 500, wordBreak: "break-word" }}>{cm.subject}</p>
                      <p style={{ margin: "4px 0 0", fontSize: 12, color: c.muted }}>
                        {t.date} · {t.time} · {cm.author} · <code style={{ background: c.chip, borderRadius: 4, padding: "1px 5px" }}>{cm.hash}</code>
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
