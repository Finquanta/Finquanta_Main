"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { checkAdmin } from "@/lib/api/admin";
import { listAllBlogPosts, createBlogPost, updateBlogPost, deleteBlogPost, BlogPost } from "@/lib/api/blog";
import AdminSidebar, { readAdminDark } from "@/components/admin/AdminSidebar";

type Draft = { id?: string; title: string; excerpt: string; content: string; coverImageUrl: string; published: boolean };
const EMPTY: Draft = { title: "", excerpt: "", content: "", coverImageUrl: "", published: false };

export default function AdminBlogPage() {
  const router = useRouter();
  const [dark, setDark] = useState(false);
  const [posts, setPosts] = useState<BlogPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = () =>
    listAllBlogPosts().then(setPosts).catch((e) => setError(e instanceof Error ? e.message : "Could not load posts."));

  useEffect(() => { setDark(readAdminDark()); }, []);
  useEffect(() => {
    checkAdmin().then(load).catch(() => router.replace("/admin-login")).finally(() => setLoading(false));
  }, [router]);

  const save = async () => {
    if (!draft || !draft.title.trim()) { setError("Title is required."); return; }
    setBusy(true); setError(null);
    const payload = {
      title: draft.title.trim(), excerpt: draft.excerpt, content: draft.content,
      coverImageUrl: draft.coverImageUrl.trim() || null, published: draft.published,
    };
    try {
      if (draft.id) await updateBlogPost(draft.id, payload);
      else await createBlogPost(payload);
      setDraft(null);
      await load();
    } catch (e) { setError(e instanceof Error ? e.message : "Could not save."); }
    finally { setBusy(false); }
  };

  const edit = (p: BlogPost) =>
    setDraft({ id: p.id, title: p.title, excerpt: p.excerpt, content: p.content, coverImageUrl: p.coverImageUrl || "", published: p.published });

  const remove = async (p: BlogPost) => {
    if (!window.confirm(`Delete "${p.title}"? This cannot be undone.`)) return;
    setBusy(true);
    try { await deleteBlogPost(p.id); await load(); }
    catch (e) { setError(e instanceof Error ? e.message : "Could not delete."); }
    finally { setBusy(false); }
  };

  const togglePublish = async (p: BlogPost) => {
    setBusy(true);
    try { await updateBlogPost(p.id, { published: !p.published }); await load(); }
    catch (e) { setError(e instanceof Error ? e.message : "Could not update."); }
    finally { setBusy(false); }
  };

  // Theme
  const c = {
    bg: dark ? "#0f172a" : "#f4f5f7",
    card: dark ? "#1e293b" : "#fff",
    border: dark ? "#334155" : "#e5e7eb",
    text: dark ? "#f1f5f9" : "#0f172a",
    muted: dark ? "#94a3b8" : "#6b7280",
    input: dark ? "#0f172a" : "#f9fafb",
  };
  const inputStyle = { width: "100%", borderRadius: 8, border: `1px solid ${c.border}`, padding: "8px 12px", fontSize: 13, outline: "none", background: c.input, color: c.text } as const;

  return (
    <div style={{ display: "flex", height: "100vh", fontFamily: "sans-serif", background: c.bg, color: c.text }}>
      <AdminSidebar active="blog" dark={dark} setDark={setDark} />
      <div style={{ flex: 1, overflow: "auto" }}>
        <div style={{ maxWidth: 960, margin: "0 auto", padding: "32px 24px" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24 }}>
            <div>
              <h1 style={{ fontSize: 20, fontWeight: 700, margin: 0 }}>Blog</h1>
              <p style={{ fontSize: 13, color: c.muted, margin: "2px 0 0" }}>{loading ? "Loading…" : `${posts.length} post${posts.length === 1 ? "" : "s"}`}</p>
            </div>
            <button onClick={() => { setDraft({ ...EMPTY }); setError(null); }}
              style={{ borderRadius: 8, background: "#22c55e", color: "#fff", border: "none", padding: "9px 16px", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
              + New post
            </button>
          </div>

          {error && <p style={{ color: "#dc2626", fontSize: 13, marginBottom: 16 }}>{error}</p>}

          {draft && (
            <div style={{ marginBottom: 28, borderRadius: 12, border: `1px solid ${c.border}`, background: c.card, padding: 20 }}>
              <h2 style={{ fontSize: 14, fontWeight: 600, color: c.muted, margin: "0 0 14px" }}>{draft.id ? "Edit post" : "New post"}</h2>
              <div style={{ display: "grid", gap: 12 }}>
                <input style={inputStyle} placeholder="Title" value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} />
                <input style={inputStyle} placeholder="Cover image URL (optional)" value={draft.coverImageUrl} onChange={(e) => setDraft({ ...draft, coverImageUrl: e.target.value })} />
                <input style={inputStyle} placeholder="Short excerpt (shown on the blog list)" value={draft.excerpt} onChange={(e) => setDraft({ ...draft, excerpt: e.target.value })} />
                <textarea style={{ ...inputStyle, minHeight: 220, resize: "vertical" }} placeholder="Write your post here…" value={draft.content} onChange={(e) => setDraft({ ...draft, content: e.target.value })} />
                <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: c.text }}>
                  <input type="checkbox" checked={draft.published} onChange={(e) => setDraft({ ...draft, published: e.target.checked })} style={{ width: 16, height: 16, accentColor: "#22c55e" }} />
                  Published (visible on the public blog)
                </label>
                <div style={{ display: "flex", gap: 8 }}>
                  <button onClick={save} disabled={busy} style={{ borderRadius: 8, background: "#22c55e", color: "#fff", border: "none", padding: "9px 16px", fontSize: 13, fontWeight: 700, cursor: "pointer", opacity: busy ? 0.6 : 1 }}>{busy ? "Saving…" : "Save"}</button>
                  <button onClick={() => setDraft(null)} style={{ borderRadius: 8, background: c.input, color: c.text, border: `1px solid ${c.border}`, padding: "9px 16px", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>Cancel</button>
                </div>
              </div>
            </div>
          )}

          {loading ? (
            <p style={{ fontSize: 13, color: c.muted }}>Loading…</p>
          ) : posts.length === 0 ? (
            <p style={{ fontSize: 13, color: c.muted }}>No posts yet. Click “New post” to write one.</p>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 16 }}>
              {posts.map((p) => (
                <div key={p.id} style={{ borderRadius: 12, border: `1px solid ${c.border}`, background: c.card, overflow: "hidden", display: "flex", flexDirection: "column" }}>
                  <div style={{ height: 120, background: dark ? "#0f172a" : "#f1f5f9", overflow: "hidden" }}>
                    {p.coverImageUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={p.coverImageUrl} alt={p.title} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                    ) : (
                      <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", color: c.muted, fontWeight: 600, fontSize: 13 }}>Finquanta</div>
                    )}
                  </div>
                  <div style={{ padding: 14, display: "flex", flexDirection: "column", gap: 8, flex: 1 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span style={{ fontSize: 11, fontWeight: 600, padding: "2px 8px", borderRadius: 999, background: p.published ? "#dcfce7" : (dark ? "#334155" : "#f3f4f6"), color: p.published ? "#16a34a" : c.muted }}>
                        {p.published ? "Published" : "Draft"}
                      </span>
                      <span style={{ fontSize: 11, color: c.muted }}>{new Date(p.createdAt).toLocaleDateString()}</span>
                    </div>
                    <p style={{ fontWeight: 600, margin: 0, lineHeight: 1.3 }}>{p.title}</p>
                    <p style={{ fontSize: 13, color: c.muted, margin: 0, flex: 1, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{p.excerpt || "—"}</p>
                    <div style={{ display: "flex", gap: 14, fontSize: 13, paddingTop: 4 }}>
                      <button onClick={() => togglePublish(p)} disabled={busy} style={{ background: "none", border: "none", padding: 0, cursor: "pointer", color: c.muted }}>{p.published ? "Unpublish" : "Publish"}</button>
                      <button onClick={() => edit(p)} style={{ background: "none", border: "none", padding: 0, cursor: "pointer", color: "#2563eb", fontWeight: 600 }}>Edit</button>
                      <button onClick={() => remove(p)} disabled={busy} style={{ background: "none", border: "none", padding: 0, cursor: "pointer", color: "#dc2626", fontWeight: 600 }}>Delete</button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
