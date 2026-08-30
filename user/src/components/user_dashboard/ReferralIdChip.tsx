"use client";

import { useEffect, useState } from "react";
import { Check, Copy } from "lucide-react";
import { getMyReferrals, referralLink } from "@/lib/api/referrals";
import { useAsk } from "@/components/user_dashboard/ConfirmProvider";

/**
 * The user's Finquanta ID, sitting in the top bar. Clicking it copies their
 * referral link, so sharing is one click from anywhere in the app rather than
 * buried on a page they have to remember exists.
 *
 * The ID and the referral code are the same string on purpose: one thing to
 * remember, and it means "give them my ID" and "use my link" credit the same
 * person.
 *
 * Renders nothing if the code can't be loaded — a chrome element is never worth
 * an error message in the header.
 */
export default function ReferralIdChip({ isDark }: { isDark: boolean }) {
  const [code, setCode] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const { askFor } = useAsk();

  useEffect(() => {
    let alive = true;
    getMyReferrals()
      .then((r) => { if (alive) setCode(r.code); })
      .catch(() => { /* not signed in yet, or offline — just don't show it */ });
    return () => { alive = false; };
  }, []);

  if (!code) return null;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(referralLink(code));
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      // Clipboard blocked (insecure context, or the user said no). Fall back to
      // showing the link in a field it can be selected out of by hand — the
      // same job `window.prompt` was doing, without the browser's box.
      askFor({
        title: "Copy your referral link",
        isDark,
        body: <p>Your browser blocked the clipboard, so here it is to copy by hand.</p>,
        label: "Referral link",
        defaultValue: referralLink(code),
        confirmLabel: "Done",
        onSubmit: () => {},
      });
    }
  };

  return (
    <button
      onClick={copy}
      title="Click to copy your referral link"
      className={`hidden sm:flex items-center gap-1.5 text-xs font-medium px-2.5 py-1.5 rounded-lg border transition-colors ${
        copied
          ? "border-green-500/40 text-green-500 " + (isDark ? "bg-green-500/10" : "bg-green-50")
          : isDark
            ? "border-gray-600 text-gray-300 hover:bg-gray-700"
            : "border-gray-300 text-gray-600 hover:bg-gray-50"
      }`}
    >
      {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5 opacity-60" />}
      <span className="font-mono tracking-wide">{copied ? "Link copied" : code}</span>
    </button>
  );
}
