"use client";

import { useEffect, useState } from "react";
import { AtSign, Camera, Check, Copy, Smartphone, Upload, X } from "lucide-react";
import { useLanguage } from "@/hooks/context/LanguageContext";
import { useTheme } from "@/hooks/context/ThemeContext";
import { ScanAllowance } from "@/lib/api/capture";
import { getInboundAddress, getPendingFromEmail } from "@/lib/api/inbound";
import Link from "next/link";

/**
 * "How do you want to add this document?"
 *
 * The Scan button used to open a file picker immediately, with the phone option
 * demoted to a small link underneath. That put the two ways of doing the same
 * thing at different levels of importance for no reason — and on a desktop the
 * phone route is usually the one you want, since a desktop cannot photograph
 * anything.
 *
 * The first two options depend on the device, because "upload a file" and "use
 * your phone" mean different things depending on which one you are holding:
 *
 *   - On a phone (`pointer: coarse`) the camera is right here. Offering to
 *     hand off to a phone would be offering someone their own phone, so the
 *     choice is camera vs. files instead.
 *   - On a desktop there is no camera, so the choice is a file vs. the QR
 *     handoff.
 *
 * Email is a third route and is always offered, because it works from any
 * device. It belongs in this list rather than only on the Inbox page: this
 * dialog is titled "Add a document" and enumerates the ways to do that, so
 * leaving one out makes the feature invisible to anyone who never wanders into
 * the Inbox.
 */

interface Props {
  open: boolean;
  onClose: () => void;
  /** Device has a usable camera — changes which two options are shown. */
  hasCamera: boolean;
  /**
   * What is left this month. Shown HERE rather than on the dashboard: the
   * number only matters at the moment somebody is deciding to spend one, and
   * beside the quick-action buttons it was a permanent figure competing with
   * the balance and cashflow cards for attention it did not deserve.
   */
  allowance: ScanAllowance | null;
  onTakePhoto: () => void;
  onUploadFile: () => void;
  onUsePhone: () => void;
}

export default function CaptureSourceDialog({
  open, onClose, hasCamera, allowance, onTakePhoto, onUploadFile, onUsePhone,
}: Props) {
  const { t } = useLanguage();
  const { theme } = useTheme();
  const isDark = theme === "dark";

  /**
   * The email route reveals an address rather than starting something, so it
   * expands in place instead of navigating. You are mid-task with a document in
   * front of you; being thrown onto another page to copy an address and then
   * having to find your way back is worse than a second click here.
   */
  const [showEmail, setShowEmail] = useState(false);
  const [emailAddress, setEmailAddress] = useState<string | null>(null);
  const [emailError, setEmailError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  /**
   * What is already waiting.
   *
   * Somebody opening this is about to add ANOTHER document. If three are
   * already sitting unreviewed — forwarded by email while nobody was looking
   * — that is worth saying before they add a fourth, because none of them are
   * in the books until somebody checks them.
   */
  const [waiting, setWaiting] = useState(0);

  useEffect(() => {
    if (!open) return;
    let alive = true;
    getPendingFromEmail()
      .then((p) => { if (alive) setWaiting(p.length); })
      .catch(() => { /* the chooser still works without the count */ });
    return () => { alive = false; };
  }, [open]);

  const revealEmail = () => {
    setShowEmail(true);
    if (emailAddress || emailError) return;
    // Fetched only when asked for, not every time the chooser opens.
    getInboundAddress()
      .then((a) => setEmailAddress(a.email))
      .catch(() => setEmailError(t("dashboard", "captureSourceEmailUnavailable")));
  };

  const copyEmail = async () => {
    if (!emailAddress) return;
    try {
      await navigator.clipboard.writeText(emailAddress);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setEmailError(t("dashboard", "captureSourceEmailCopyFailed"));
    }
  };

  if (!open) return null;

  const remaining = allowance?.remaining;
  // Warn before the wall, not at it.
  const nearLimit =
    allowance?.limit != null && remaining != null && remaining <= Math.max(1, Math.ceil(allowance.limit * 0.2));

  const options = hasCamera
    ? [
        {
          key: "photo",
          icon: Camera,
          title: t("dashboard", "captureSourcePhoto"),
          body: t("dashboard", "captureSourcePhotoBody"),
          action: onTakePhoto,
        },
        {
          key: "file",
          icon: Upload,
          title: t("dashboard", "captureSourceUpload"),
          body: t("dashboard", "captureSourceUploadBody"),
          action: onUploadFile,
        },
      ]
    : [
        {
          key: "file",
          icon: Upload,
          title: t("dashboard", "captureSourceUpload"),
          body: t("dashboard", "captureSourceUploadBody"),
          action: onUploadFile,
        },
        {
          key: "phone",
          icon: Smartphone,
          title: t("dashboard", "captureSourcePhone"),
          body: t("dashboard", "captureSourcePhoneBody"),
          action: onUsePhone,
        },
      ];

  // Works from any device, so it sits below whichever pair applies.
  const emailOption = {
    key: "email",
    icon: AtSign,
    title: t("dashboard", "captureSourceEmail"),
    body: t("dashboard", "captureSourceEmailBody"),
    action: revealEmail,
  };

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="capture-source-title"
      onClick={onClose}
    >
      <div
        className={`w-full max-w-md rounded-xl ${isDark ? "bg-gray-800" : "bg-white"} shadow-xl`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className={`flex items-start justify-between p-5 border-b ${isDark ? "border-gray-700" : "border-gray-200"}`}>
          <div>
            <h2 id="capture-source-title" className={`text-lg font-bold ${isDark ? "text-white" : "text-gray-900"}`}>
              {t("dashboard", "captureSourceTitle")}
            </h2>
            <p className={`mt-1 text-sm ${isDark ? "text-gray-300" : "text-gray-600"}`}>
              {t("dashboard", "captureSourceBody")}
            </p>
          </div>
          <button
            onClick={onClose}
            aria-label={t("dashboard", "captureHandoffClose")}
            className={`${isDark ? "text-gray-500 hover:text-gray-300" : "text-gray-400 hover:text-gray-600"} flex-shrink-0`}
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {waiting > 0 && (
          <div className={`mx-5 mt-4 rounded-lg border px-3 py-2.5 ${isDark ? "border-amber-800 bg-amber-900/20" : "border-amber-200 bg-amber-50"}`}>
            <p className={`text-xs font-semibold ${isDark ? "text-amber-300" : "text-amber-800"}`}>
              {waiting === 1
                ? t("dashboard", "captureWaitingOne")
                : t("dashboard", "captureWaitingMany").replace("{n}", String(waiting))}
            </p>
            <p className={`mt-0.5 text-[11px] ${isDark ? "text-amber-300/80" : "text-amber-700"}`}>
              {t("dashboard", "captureWaitingBody")}
            </p>
            <Link
              href="/inbox"
              onClick={onClose}
              className={`mt-1.5 inline-block text-[11px] font-semibold underline ${isDark ? "text-amber-300" : "text-amber-800"}`}
            >
              {t("dashboard", "captureWaitingLink")}
            </Link>
          </div>
        )}

        <div className="p-5 space-y-3">
          {[...options, emailOption].map((o) => {
            const Icon = o.icon;
            return (
              <button
                key={o.key}
                onClick={o.action}
                className={`w-full flex items-start gap-3 text-left rounded-lg border ${isDark ? "border-gray-600 hover:border-purple-400 hover:bg-purple-900/20" : "border-gray-200 hover:border-purple-400 hover:bg-purple-50"} px-4 py-3 transition-colors`}
              >
                <span className={`flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg ${isDark ? "bg-purple-900/40" : "bg-purple-100"}`}>
                  <Icon className={`h-4 w-4 ${isDark ? "text-purple-300" : "text-purple-600"}`} />
                </span>
                <span className="min-w-0">
                  <span className={`block text-sm font-semibold ${isDark ? "text-white" : "text-gray-900"}`}>
                    {o.title}
                  </span>
                  <span className={`block text-xs ${isDark ? "text-gray-400" : "text-gray-500"} mt-0.5`}>
                    {o.body}
                  </span>
                </span>
              </button>
            );
          })}
        </div>

        {showEmail && (
          <div className="px-5 pb-4 -mt-1">
            <div className={`rounded-lg border ${isDark ? "border-purple-800 bg-purple-900/20" : "border-purple-200 bg-purple-50"} p-3`}>
              {emailError ? (
                <p className={`text-xs ${isDark ? "text-amber-300" : "text-amber-700"}`}>{emailError}</p>
              ) : (
                <>
                  <div className="flex flex-wrap items-center gap-2">
                    <code className={`flex-1 min-w-[12rem] rounded ${isDark ? "bg-gray-900 text-gray-100" : "bg-white text-gray-900"} px-2 py-1.5 text-xs font-mono break-all`}>
                      {emailAddress ?? "…"}
                    </code>
                    <button
                      onClick={copyEmail}
                      disabled={!emailAddress}
                      className="flex items-center gap-1 px-2.5 py-1.5 rounded text-xs font-semibold bg-purple-500 hover:bg-purple-600 disabled:opacity-60 text-white"
                    >
                      {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                      {copied ? t("dashboard", "captureSourceEmailCopied") : t("dashboard", "captureSourceEmailCopy")}
                    </button>
                  </div>
                  <p className={`mt-2 text-[11px] ${isDark ? "text-gray-300" : "text-gray-600"}`}>
                    {t("dashboard", "captureSourceEmailHint")}
                  </p>
                </>
              )}
            </div>
          </div>
        )}

        {/* The meter. Only where there is a cap to count against — an unlimited
            plan has no number worth printing. */}
        {allowance?.limit != null && (
          <div className="px-5 pb-5 -mt-1">
            <p
              className={`text-xs ${
                nearLimit
                  ? `${isDark ? "text-amber-400" : "text-amber-600"} font-semibold`
                  : isDark ? "text-gray-400" : "text-gray-500"
              }`}
            >
              {t("dashboard", "captureScansLeft").replace("{n}", String(remaining ?? 0))}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
