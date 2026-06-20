"use client";
import { useEffect, useRef, useState } from "react";
import { Building2, ChevronDown, Plus, UserPlus, Copy, Check, X, Pencil } from "lucide-react";
import {
  Business, BusinessRole, BUSINESS_ROLES,
  listBusinesses, createBusiness, createInvite, renameBusiness,
} from "@/lib/api/businesses";

const ACTIVE_KEY = "activeBusinessId";
const INVITABLE_ROLES = BUSINESS_ROLES.filter((r) => r !== "Owner");

export default function WorkspaceSwitcher({ isDark }: { isDark: boolean }) {
  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [activeId, setActiveId] = useState<string>("");
  const [open, setOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [inviteOpen, setInviteOpen] = useState(false);
  const [editingId, setEditingId] = useState<string>("");
  const [editName, setEditName] = useState("");
  const ref = useRef<HTMLDivElement>(null);

  const load = () => listBusinesses().then((bs) => {
    setBusinesses(bs);
    const stored = typeof window !== "undefined" ? localStorage.getItem(ACTIVE_KEY) : null;
    const valid = bs.find((b) => b.id === stored);
    const chosen = valid?.id || bs[0]?.id || "";
    setActiveId(chosen);
    if (chosen) localStorage.setItem(ACTIVE_KEY, chosen);
  }).catch(() => setBusinesses([]));

  useEffect(() => { load(); }, []);

  useEffect(() => {
    const handler = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const active = businesses.find((b) => b.id === activeId);

  const switchTo = (id: string) => {
    setActiveId(id);
    localStorage.setItem(ACTIVE_KEY, id);
    setOpen(false);
    window.dispatchEvent(new CustomEvent("finna:businessChanged", { detail: id }));
  };

  const handleCreate = async () => {
    if (!newName.trim()) return;
    try {
      const biz = await createBusiness(newName.trim());
      setNewName("");
      setCreating(false);
      await load();
      switchTo(biz.id);
    } catch (e) {
      alert(e instanceof Error ? e.message : "Could not create business.");
    }
  };

  const startRename = (b: Business) => { setEditingId(b.id); setEditName(b.name); };

  const handleRename = async () => {
    if (!editName.trim() || !editingId) { setEditingId(""); return; }
    try {
      await renameBusiness(editingId, editName.trim());
      setEditingId("");
      setEditName("");
      await load();
      window.dispatchEvent(new CustomEvent("finna:businessChanged", { detail: activeId }));
    } catch (e) {
      alert(e instanceof Error ? e.message : "Could not rename business.");
    }
  };

  const colors = {
    btn: isDark ? "bg-gray-700 text-white border-gray-600" : "bg-gray-100 text-gray-900 border-gray-300",
    menu: isDark ? "bg-gray-800 border-gray-700 text-gray-200" : "bg-white border-gray-200 text-gray-900",
    item: isDark ? "hover:bg-gray-700" : "hover:bg-gray-50",
    input: isDark ? "bg-gray-700 border-gray-600 text-white" : "bg-gray-50 border-gray-300 text-gray-900",
    sub: isDark ? "text-gray-400" : "text-gray-500",
  };

  return (
    <div className="relative" ref={ref}>
      <button onClick={() => setOpen((v) => !v)} className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium border ${colors.btn}`}>
        <Building2 className="h-4 w-4" />
        <span className="max-w-[140px] truncate">{active?.name || "Workspace"}</span>
        <ChevronDown className="h-3 w-3" />
      </button>

      {open && (
        <div className={`absolute left-0 mt-2 w-64 rounded-xl border shadow-xl z-50 overflow-hidden ${colors.menu}`}>
          <div className={`px-3 py-2 text-[10px] uppercase tracking-wide ${colors.sub}`}>Your businesses</div>
          <div className="max-h-56 overflow-y-auto">
            {businesses.map((b) => {
              const canRename = b.role === "Owner" || b.role === "Admin";
              if (editingId === b.id) {
                return (
                  <div key={b.id} className="p-2 flex gap-2">
                    <input autoFocus value={editName} onChange={(e) => setEditName(e.target.value)}
                      onKeyDown={(e) => { if (e.key === "Enter") handleRename(); if (e.key === "Escape") setEditingId(""); }}
                      className={`flex-1 text-xs rounded-lg px-2 py-1.5 border outline-none ${colors.input}`} />
                    <button onClick={handleRename} className="text-green-500 hover:text-green-600" title="Save"><Check className="h-4 w-4" /></button>
                    <button onClick={() => setEditingId("")} className="text-gray-400 hover:text-gray-600" title="Cancel"><X className="h-4 w-4" /></button>
                  </div>
                );
              }
              return (
                <div key={b.id} className={`group w-full px-3 py-2 text-sm flex items-center justify-between ${colors.item}`}>
                  <button onClick={() => switchTo(b.id)} className="flex items-center gap-2 truncate flex-1 text-left">
                    <Building2 className="h-3.5 w-3.5 flex-shrink-0" />
                    <span className="truncate">{b.name}</span>
                  </button>
                  <span className="flex items-center gap-2 flex-shrink-0">
                    {canRename && (
                      <button onClick={() => startRename(b)} className="opacity-0 group-hover:opacity-100 text-gray-400 hover:text-gray-600" title="Rename">
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                    )}
                    <span className={`text-[10px] ${colors.sub}`}>{b.role}</span>
                    {b.id === activeId && <Check className="h-3.5 w-3.5 text-green-500" />}
                  </span>
                </div>
              );
            })}
          </div>

          <div className={`border-t ${isDark ? "border-gray-700" : "border-gray-200"}`}>
            {creating ? (
              <div className="p-2 flex gap-2">
                <input autoFocus value={newName} onChange={(e) => setNewName(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") handleCreate(); if (e.key === "Escape") setCreating(false); }}
                  placeholder="Business name" className={`flex-1 text-xs rounded-lg px-2 py-1.5 border outline-none ${colors.input}`} />
                <button onClick={handleCreate} className="bg-blue-500 text-white text-xs px-3 rounded-lg">Add</button>
              </div>
            ) : (
              <button onClick={() => setCreating(true)} className={`w-full text-left px-3 py-2 text-sm flex items-center gap-2 ${colors.item}`}>
                <Plus className="h-3.5 w-3.5" /> Create business
              </button>
            )}
            <button onClick={() => { setOpen(false); setInviteOpen(true); }} className={`w-full text-left px-3 py-2 text-sm flex items-center gap-2 ${colors.item}`}>
              <UserPlus className="h-3.5 w-3.5" /> Invite team member
            </button>
          </div>
        </div>
      )}

      {inviteOpen && active && (
        <InviteModal business={active} isDark={isDark} onClose={() => setInviteOpen(false)} />
      )}
    </div>
  );
}

function InviteModal({ business, isDark, onClose }: { business: Business; isDark: boolean; onClose: () => void }) {
  const [role, setRole] = useState<BusinessRole>("Viewer");
  const [password, setPassword] = useState("");
  const [link, setLink] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canInvite = business.role === "Owner" || business.role === "Admin";

  const generate = async () => {
    setError(null);
    setBusy(true);
    try {
      const res = await createInvite(business.id, role, password.trim() || undefined);
      setLink(`${window.location.origin}/join/${res.token}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not create invite.");
    } finally {
      setBusy(false);
    }
  };

  const copy = async () => {
    if (!link) return;
    try { await navigator.clipboard.writeText(link); setCopied(true); setTimeout(() => setCopied(false), 2000); } catch { /* ignore */ }
  };

  const card = isDark ? "bg-gray-800 text-white" : "bg-white text-gray-900";
  const input = isDark ? "bg-gray-700 border-gray-600 text-white" : "bg-gray-50 border-gray-300 text-gray-900";

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50" onClick={onClose}>
      <div className={`rounded-2xl p-6 w-full max-w-md mx-4 shadow-2xl ${card}`} onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold">Invite to {business.name}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X className="h-5 w-5" /></button>
        </div>

        {!canInvite ? (
          <p className="text-sm text-gray-500">Only an owner or admin can invite team members.</p>
        ) : !link ? (
          <>
            <label className="block text-sm font-medium mb-1">Role</label>
            <select value={role} onChange={(e) => setRole(e.target.value as BusinessRole)} className={`w-full text-sm rounded-lg px-3 py-2 border outline-none mb-4 ${input}`}>
              {INVITABLE_ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
            </select>

            <label className="block text-sm font-medium mb-1">Password (optional)</label>
            <input type="text" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Set a password the invitee must enter"
              className={`w-full text-sm rounded-lg px-3 py-2 border outline-none mb-2 ${input}`} />
            <p className="text-xs text-gray-500 mb-4">If set, anyone using the link must enter this password to join.</p>

            {error && <p className="text-red-500 text-sm mb-3">{error}</p>}
            <button onClick={generate} disabled={busy} className="w-full bg-blue-500 hover:bg-blue-600 disabled:opacity-60 text-white font-semibold py-2.5 rounded-lg text-sm">
              {busy ? "Generating…" : "Generate invite link"}
            </button>
          </>
        ) : (
          <>
            <p className="text-sm text-gray-500 mb-2">Share this link with your team member (role: <strong>{role}</strong>). It expires in 14 days.</p>
            <div className="flex gap-2">
              <input readOnly value={link} className={`flex-1 text-xs rounded-lg px-3 py-2 border outline-none ${input}`} />
              <button onClick={copy} className="bg-blue-500 hover:bg-blue-600 text-white px-3 rounded-lg flex items-center gap-1 text-sm">
                {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
