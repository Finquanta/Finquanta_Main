"use client";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { InviteInfo, getInviteInfo, acceptInvite } from "@/lib/api/businesses";

export default function JoinPage() {
  const params = useParams<{ token: string }>();
  const token = params?.token as string;
  const router = useRouter();

  const [info, setInfo] = useState<InviteInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loggedIn, setLoggedIn] = useState(false);

  useEffect(() => {
    setLoggedIn(typeof window !== "undefined" && !!localStorage.getItem("accessToken"));
    if (typeof window !== "undefined" && token) {
      localStorage.setItem("pendingInvite", token); // so they can return after login
    }
    getInviteInfo(token)
      .then(setInfo)
      .catch((e) => setError(e instanceof Error ? e.message : "Invite not found"))
      .finally(() => setLoading(false));
  }, [token]);

  const join = async () => {
    setError(null);
    setBusy(true);
    try {
      await acceptInvite(token, password.trim() || undefined);
      localStorage.removeItem("pendingInvite");
      router.push("/dashboard");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not join. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-100 flex items-center justify-center px-4">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-sm p-8 text-center">
        <img src="/images/finquanta_logo.svg" alt="Finquanta" className="w-28 h-auto mx-auto mb-6" />

        {loading ? (
          <p className="text-gray-500">Loading invite…</p>
        ) : !info ? (
          <p className="text-red-500">{error || "This invite is invalid."}</p>
        ) : info.expired ? (
          <p className="text-red-500">This invite has expired. Ask the owner for a new link.</p>
        ) : (
          <>
            <h1 className="text-xl font-bold text-gray-900 mb-1">Join {info.businessName}</h1>
            <p className="text-sm text-gray-500 mb-6">You&apos;ve been invited as <strong>{info.role}</strong>.</p>

            {!loggedIn ? (
              <div className="space-y-3">
                <p className="text-sm text-gray-600">Log in or create an account to join this workspace.</p>
                <div className="flex gap-3 justify-center">
                  <Link href="/login" className="bg-blue-500 hover:bg-blue-600 text-white font-medium px-5 py-2.5 rounded-lg text-sm">Log in</Link>
                  <Link href="/signup" className="border border-gray-300 text-gray-700 font-medium px-5 py-2.5 rounded-lg text-sm">Sign up</Link>
                </div>
                <p className="text-xs text-gray-400">After signing in, open this link again to finish joining.</p>
              </div>
            ) : (
              <>
                {info.requiresPassword && (
                  <div className="text-left mb-4">
                    <label className="block text-sm font-medium text-gray-700 mb-1">Invite password</label>
                    <input type="password" value={password} onChange={(e) => setPassword(e.target.value)}
                      className="w-full bg-gray-50 border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 outline-none focus:border-blue-500"
                      placeholder="Enter the password from your invite" />
                  </div>
                )}
                {error && <p className="text-red-500 text-sm mb-3">{error}</p>}
                <button onClick={join} disabled={busy} className="w-full bg-blue-500 hover:bg-blue-600 disabled:opacity-60 text-white font-semibold py-2.5 rounded-lg text-sm">
                  {busy ? "Joining…" : "Join workspace"}
                </button>
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}
