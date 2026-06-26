"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { checkAdmin } from "@/lib/api/admin";
import { listAllBlogPosts, createBlogPost, updateBlogPost, deleteBlogPost, BlogPost } from "@/lib/api/blog";

type Draft = { id?: string; title: string; excerpt: string; content: string; coverImageUrl: string; published: boolean };
const EMPTY: Draft = { title: "", excerpt: "", content: "", coverImageUrl: "", published: false };

export default function AdminBlogPage() {
  const router = useRouter();
  const [posts, setPosts] = useState<BlogPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = () =>
    listAllBlogPosts().then(setPosts).catch((e) => setError(e instanceof Error ? e.message : "Could not load posts."));

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

  const input = "w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-green-500 text-gray-900 bg-gray-50";

  return (
    <div className="min-h-screen bg-[#f4f5f7] text-gray-900">
      <div className="mx-auto max-w-5xl px-6 py-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-xl font-bold">Blog</h1>
            <p className="text-sm text-gray-500">{loading ? "Loading…" : `${posts.length} post${posts.length === 1 ? "" : "s"}`}</p>
          </div>
          <div className="flex items-center gap-3">
            <button onClick={() => router.push("/admin-users")} className="text-sm text-gray-600 hover:underline">← Users</button>
            <button onClick={() => { setDraft({ ...EMPTY }); setError(null); }} className="rounded-lg bg-green-500 px-4 py-2 text-sm font-semibold text-white hover:bg-green-600">
              New post
            </button>
          </div>
        </div>

        {error && <p className="mb-4 text-sm text-red-600">{error}</p>}

        {draft && (
          <div className="mb-8 rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
            <h2 className="mb-4 text-sm font-semibold text-gray-700">{draft.id ? "Edit post" : "New post"}</h2>
            <div className="grid gap-3">
              <input className={input} placeholder="Title" value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} />
              <input className={input} placeholder="Cover image URL (optional)" value={draft.coverImageUrl} onChange={(e) => setDraft({ ...draft, coverImageUrl: e.target.value })} />
              <input className={input} placeholder="Short excerpt (shown on the blog list)" value={draft.excerpt} onChange={(e) => setDraft({ ...draft, excerpt: e.target.value })} />
              <textarea className={input + " min-h-[220px] resize-y"} placeholder="Write your post here…" value={draft.content} onChange={(e) => setDraft({ ...draft, content: e.target.value })} />
              <label className="flex items-center gap-2 text-sm text-gray-700">
                <input type="checkbox" checked={draft.published} onChange={(e) => setDraft({ ...draft, published: e.target.checked })} className="h-4 w-4 accent-green-500" />
                Published (visible on the public blog)
              </label>
              <div className="flex gap-2">
                <button onClick={save} disabled={busy} className="rounded-lg bg-green-500 px-4 py-2 text-sm font-semibold text-white hover:bg-green-600 disabled:opacity-60">
                  {busy ? "Saving…" : "Save"}
                </button>
                <button onClick={() => setDraft(null)} className="rounded-lg bg-gray-200 px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-300">Cancel</button>
              </div>
            </div>
          </div>
        )}

        <div className="rounded-xl border border-gray-200 bg-white">
          {loading ? (
            <p className="p-5 text-sm text-gray-500">Loading…</p>
          ) : posts.length === 0 ? (
            <p className="p-5 text-sm text-gray-500">No posts yet. Click “New post” to write one.</p>
          ) : (
            <div className="divide-y divide-gray-100">
              {posts.map((p) => (
                <div key={p.id} className="flex items-center justify-between gap-4 px-5 py-3">
                  <div className="min-w-0">
                    <p className="truncate font-medium text-gray-900">{p.title}</p>
                    <p className="text-xs text-gray-500">
                      {new Date(p.createdAt).toLocaleDateString()} ·{" "}
                      <span className={p.published ? "text-green-600" : "text-gray-400"}>{p.published ? "Published" : "Draft"}</span>
                    </p>
                  </div>
                  <div className="flex flex-shrink-0 items-center gap-3 text-sm">
                    <button onClick={() => togglePublish(p)} disabled={busy} className="text-gray-600 hover:underline">{p.published ? "Unpublish" : "Publish"}</button>
                    <button onClick={() => edit(p)} className="text-blue-600 hover:underline">Edit</button>
                    <button onClick={() => remove(p)} disabled={busy} className="text-red-600 hover:underline">Delete</button>
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
