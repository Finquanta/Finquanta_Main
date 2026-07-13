"use client";

import { useEffect, useState } from "react";
import { Check, Copy, Gift, Mail, Share2 } from "lucide-react";
import { useTheme } from "@/hooks/context/ThemeContext";
import DashboardShell from "@/components/user_dashboard/DashboardShell";
import { MyReferrals, ReferredUser, getMyReferrals, referralLink } from "@/lib/api/referrals";

/**
 * Section 13 — the referral program, user side.
 *
 * Deliberately honest about what counts: an invite only becomes a qualified
 * referral once the person verifies their email AND actually uses the product.
 * Showing all three stages means nobody is left wondering why their "10 signups"
 * aren't counting.
 */
export default function ReferralsPage() {
  const { theme } = useTheme();
  const isDark = theme === "dark";

  const [data, setData] = useState<MyReferrals | null>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    getMyReferrals()
      .then(setData)
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, []);

  const card = `rounded-2xl border ${isDark ? "bg-[#1e1e2e] border-gray-700" : "bg-white border-gray-200"}`;
  const text = isDark ? "text-white" : "text-gray-900";
  const sub = isDark ? "text-gray-400" : "text-gray-500";

  const link = data ? referralLink(data.code) : "";

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard blocked — the link is on screen to copy by hand */
    }
  };

  const shareByEmail = () => {
    const subject = encodeURIComponent("You should try Finquanta");
    const body = encodeURIComponent(
      `I've been using Finquanta to keep on top of my business finances — bookkeeping, invoices and a health score that actually explains itself.\n\nSign up here: ${link}`
    );
    window.location.href = `mailto:?subject=${subject}&body=${body}`;
  };

  return (
    <DashboardShell>
      <div className="p-4 sm:p-6 max-w-4xl">
        <div className="flex items-center gap-2 mb-1">
          <Gift className="h-5 w-5 text-blue-500" />
          <h1 className={`text-xl font-bold ${text}`}>Refer a business</h1>
        </div>
        <p className={`text-sm mb-6 ${sub}`}>
          Share your link. You&apos;ll see every business you bring in, and how far along they are.
        </p>

        {loading ? (
          <p className={`text-sm ${sub}`}>Loading…</p>
        ) : !data ? (
          <p className="text-sm text-red-500">Couldn&apos;t load your referrals. Please try again.</p>
        ) : (
          <>
            {/* The link */}
            <div className={`${card} p-5 mb-4`}>
              <label className={`text-xs font-semibold ${sub}`}>YOUR REFERRAL LINK</label>
              <div className="flex gap-2 mt-2 flex-wrap sm:flex-nowrap">
                <input
                  readOnly
                  value={link}
                  onFocus={(e) => e.currentTarget.select()}
                  className={`flex-1 min-w-0 text-sm rounded-lg px-3 py-2 border outline-none ${
                    isDark ? "bg-gray-800 border-gray-600 text-gray-200" : "bg-gray-50 border-gray-300 text-gray-700"
                  }`}
                />
                <button
                  onClick={copy}
                  className="flex items-center gap-1.5 bg-blue-500 hover:bg-blue-600 text-white text-sm font-semibold px-4 py-2 rounded-lg shrink-0"
                >
                  {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                  {copied ? "Copied" : "Copy"}
                </button>
                <button
                  onClick={shareByEmail}
                  className={`flex items-center gap-1.5 text-sm font-semibold px-4 py-2 rounded-lg border shrink-0 ${
                    isDark ? "border-gray-600 text-gray-200 hover:bg-gray-700" : "border-gray-300 text-gray-700 hover:bg-gray-50"
                  }`}
                >
                  <Mail className="h-4 w-4" /> Email
                </button>
              </div>
              <p className={`text-xs mt-2 ${sub}`}>
                Your code is <strong className={text}>{data.code}</strong>.
              </p>
            </div>

            {/* The three stages */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
              <Stat label="Signed up" value={data.signedUp} hint="Made an account" isDark={isDark} />
              <Stat label="Verified" value={data.verified} hint="Confirmed their email" isDark={isDark} />
              <Stat
                label="Qualified"
                value={data.qualified}
                hint="Verified and actually using it"
                isDark={isDark}
                highlight
              />
            </div>

            <div className={`${card} p-4 mb-6`}>
              <p className={`text-xs ${sub}`}>
                <Share2 className="inline h-3.5 w-3.5 mr-1" />
                A referral only counts as <strong className={text}>qualified</strong> once the business
                verifies its email <em>and</em> records real activity — an entry or an invoice. That keeps the
                numbers honest: a throwaway signup earns nothing.
              </p>
            </div>

            {/* Who you brought in */}
            <h2 className={`text-sm font-bold mb-2 ${text}`}>Businesses you&apos;ve referred</h2>
            {data.referred.length === 0 ? (
              <div className={`${card} p-8 text-center`}>
                <p className={`text-sm ${sub}`}>
                  Nobody yet. Share your link above and they&apos;ll show up here.
                </p>
              </div>
            ) : (
              <div className={`${card} overflow-hidden`}>
                {data.referred.map((r, i) => (
                  <Row key={i} r={r} isDark={isDark} last={i === data.referred.length - 1} />
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </DashboardShell>
  );
}

function Stat({
  label, value, hint, isDark, highlight,
}: { label: string; value: number; hint: string; isDark: boolean; highlight?: boolean }) {
  const card = `rounded-2xl border p-4 ${
    highlight
      ? "border-green-500/40 " + (isDark ? "bg-green-500/5" : "bg-green-50")
      : isDark ? "bg-[#1e1e2e] border-gray-700" : "bg-white border-gray-200"
  }`;
  const sub = isDark ? "text-gray-400" : "text-gray-500";

  return (
    <div className={card}>
      <p className={`text-xs font-medium ${sub}`}>{label}</p>
      <p className={`text-2xl font-bold mt-0.5 ${highlight ? "text-green-500" : isDark ? "text-white" : "text-gray-900"}`}>
        {value}
      </p>
      <p className={`text-[11px] mt-0.5 ${sub}`}>{hint}</p>
    </div>
  );
}

const STAGE_LABEL: Record<string, { text: string; color: string }> = {
  signed_up: { text: "Signed up", color: "#9ca3af" },
  verified: { text: "Verified", color: "#3b82f6" },
  qualified: { text: "Qualified", color: "#10b981" },
};

function Row({ r, isDark, last }: { r: ReferredUser; isDark: boolean; last: boolean }) {
  const text = isDark ? "text-white" : "text-gray-900";
  const sub = isDark ? "text-gray-400" : "text-gray-500";
  const stage = STAGE_LABEL[r.stage] ?? STAGE_LABEL.signed_up!;

  return (
    <div className={`flex items-center justify-between gap-3 px-4 py-3 ${last ? "" : `border-b ${isDark ? "border-gray-700" : "border-gray-100"}`}`}>
      <div className="min-w-0">
        <p className={`text-sm font-medium truncate ${text}`}>{r.name}</p>
        <p className={`text-xs truncate ${sub}`}>{r.email}</p>
      </div>
      <span
        className="text-[11px] font-semibold px-2 py-1 rounded-full shrink-0"
        style={{ color: stage.color, backgroundColor: `${stage.color}1a` }}
      >
        {stage.text}
      </span>
    </div>
  );
}
