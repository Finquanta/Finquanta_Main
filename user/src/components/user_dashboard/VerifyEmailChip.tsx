"use client";

import { useEffect, useState } from "react";
import { Check, MailCheck } from "lucide-react";
import { getMe } from "@/lib/api/me";
import { resendVerification } from "@/lib/api/verify";

/**
 * "Verify Email" in the sidebar, for accounts that have not confirmed theirs.
 *
 * It disappears the moment the address is verified, which is the point: a
 * permanent banner about a thing most people have already done is noise, and
 * noise beside navigation gets learned and then ignored. Rendering nothing is
 * the normal state.
 *
 * Verification is not cosmetic here — it is worth 7 extra trial days (spec 08
 * §4.1), and an unverified address means password reset cannot reach them. So
 * the prompt sits where they already are rather than waiting in an email they
 * may never have opened.
 */
export default function VerifyEmailChip({ isDark }: { isDark: boolean }) {
  const [email, setEmail] = useState<string | null>(null);
  const [state, setState] = useState<"idle" | "sending" | "sent" | "verified" | "error">("idle");
  /**
   * Seconds until it can be pressed again.
   *
   * Mail is not instant, so the second press usually happens because the first
   * one has not arrived yet — and sending three more copies helps nobody. The
   * server rate-limits this endpoint to 3 anyway; the cooldown is what stops
   * someone burning that allowance in five seconds and then being locked out
   * when they genuinely need it.
   */
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setTimeout(() => setCooldown((n) => n - 1), 1000);
    return () => clearTimeout(timer);
  }, [cooldown]);

  useEffect(() => {
    getMe()
      .then((me) => { if (!me.emailVerified) setEmail(me.email); })
      // A failed lookup hides the button rather than guessing. Telling a
      // verified user to verify is worse than saying nothing.
      .catch(() => setEmail(null));
  }, []);

  if (!email) return null;

  const send = async () => {
    if (cooldown > 0 || state === "sending") return;
    setState("sending");
    try {
      const result = await resendVerification(email);
      // The endpoint reports an already-verified account so we can stop nagging
      // somebody who confirmed in another tab.
      setState(result === "already_verified" ? "verified" : "sent");
      setCooldown(60);
    } catch {
      setState("error");
    }
  };

  if (state === "verified") return null;

  // `mt-2` lives here rather than at the mount points: this button appears in
  // two separate sidebars, and spacing set by each of them drifts apart the
  // moment one is edited.
  const shape =
    "w-full mt-2 rounded-lg border px-3 py-1.5 text-[13px] font-semibold " +
    "flex items-center justify-center gap-1.5 transition-colors disabled:opacity-60";

  // Sent, and still cooling down. Stays button-shaped so the sidebar does not
  // reflow, and keeps the address in the tooltip — on screen it would wrap and
  // push the navigation around.
  if (state === "sent" && cooldown > 0) {
    return (
      <div
        title={`Verification link sent to ${email}. You can send another in ${cooldown}s.`}
        className={`${shape} ${isDark ? "border-green-600 text-green-400" : "border-green-600 text-green-700"}`}
      >
        <Check className="h-3.5 w-3.5" />
        Sent · {cooldown}s
      </div>
    );
  }

  return (
    <button
      onClick={send}
      disabled={state === "sending"}
      title={`Send a verification link to ${email}`}
      className={`${shape} ${
        isDark
          ? "border-amber-500 text-amber-400 hover:bg-amber-500/10"
          : "border-amber-600 text-amber-700 hover:bg-amber-50"
      }`}
    >
      <MailCheck className="h-3.5 w-3.5" />
      {state === "sending"
        ? "Sending…"
        : state === "error"
          ? "Try again"
          // Once one has been sent, the offer changes from "verify" to "send
          // another" — the useful action when the first did not arrive.
          : state === "sent"
            ? "Resend email"
            : "Verify Email"}
    </button>
  );
}
