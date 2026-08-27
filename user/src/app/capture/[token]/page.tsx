"use client";

import { useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import { Camera, CheckCircle2, XCircle } from "lucide-react";
import { getHandoffInfo, uploadViaHandoff } from "@/lib/api/capture";

/**
 * The phone half of the QR handoff.
 *
 * Reached by scanning a QR code shown on a desktop. Deliberately works LOGGED
 * OUT — the token in the URL is the credential, the same shape as the
 * unsubscribe page. Requiring a login here would defeat the entire point: the
 * reason to scan a code instead of picking up your phone normally is that you
 * did not want to sign in on it.
 *
 * Sits at the top level of the app rather than inside (landing_routes), so it
 * gets no marketing navbar, footer or chat widget. This is a page you look at
 * for eight seconds with a receipt in your other hand.
 *
 * DELIBERATELY LIGHT-THEMED, and not a `dark:` variant in sight. Two reasons:
 * this app's Tailwind uses the "class" dark strategy and nothing ever sets that
 * class, so those variants would be dead code; and a logged-out visitor has no
 * saved theme to read anyway. A white page for the eight seconds this takes is
 * better than a half-styled one.
 *
 * What it deliberately does NOT do: show anything about the workspace, or
 * anything read off the document. A page whose only credential is a URL should
 * not be able to display someone's finances, so the extraction goes back to the
 * desktop and this page only ever learns whether the send worked.
 */

type Stage = "checking" | "ready" | "sending" | "sent" | "dead";

export default function CaptureHandoffPage() {
  const params = useParams<{ token: string }>();
  const token = (params?.token as string) || "";

  const [stage, setStage] = useState<Stage>("checking");
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!token) {
      setStage("dead");
      setError("This link is missing its code.");
      return;
    }
    let alive = true;
    getHandoffInfo(token)
      .then(() => { if (alive) setStage("ready"); })
      .catch((e) => {
        if (!alive) return;
        setStage("dead");
        setError(e instanceof Error ? e.message : "This code has expired or has already been used.");
      });
    return () => { alive = false; };
  }, [token]);

  const onFile = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    // Cleared immediately so retrying with the same photo still fires onChange.
    event.target.value = "";
    if (!file) return;

    setStage("sending");
    setError(null);
    try {
      await uploadViaHandoff(token, file);
      setStage("sent");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not send that photo.");
      // Back to ready, not dead: a failed send is usually a bad signal in a
      // stockroom, and the token is still good. Let them try again.
      setStage("ready");
    }
  };

  return (
    <main className="min-h-screen flex flex-col items-center justify-center bg-gray-50 px-6 py-12">
      <div className="w-full max-w-sm text-center">
        {stage === "checking" && (
          <span className="inline-block h-8 w-8 rounded-full border-2 border-purple-500 border-t-transparent animate-spin" />
        )}

        {stage === "dead" && (
          <>
            <XCircle className="h-12 w-12 text-red-400 mx-auto mb-4" />
            <h1 className="text-xl font-bold text-gray-900 mb-2">
              This code is no longer good
            </h1>
            <p className="text-sm text-gray-600">
              {error} Go back to your computer and show a new one.
            </p>
          </>
        )}

        {stage === "sent" && (
          <>
            <CheckCircle2 className="h-12 w-12 text-green-500 mx-auto mb-4" />
            <h1 className="text-xl font-bold text-gray-900 mb-2">Sent</h1>
            <p className="text-sm text-gray-600">
              It is on your computer now. Check the details there before it goes into your books —
              you can close this page.
            </p>
          </>
        )}

        {(stage === "ready" || stage === "sending") && (
          <>
            <Camera className="h-12 w-12 text-purple-500 mx-auto mb-4" />
            <h1 className="text-xl font-bold text-gray-900 mb-2">
              Photograph your document
            </h1>
            <p className="text-sm text-gray-600 mb-8">
              Take a picture of the receipt or bill. It will appear on the computer you scanned
              this from, and nothing is saved until you check it there.
            </p>

            <input
              ref={inputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/heic,image/heif,application/pdf"
              capture="environment"
              onChange={onFile}
              className="hidden"
            />

            <button
              onClick={() => inputRef.current?.click()}
              disabled={stage === "sending"}
              className="w-full flex items-center justify-center gap-2 bg-purple-500 hover:bg-purple-600 disabled:opacity-60 text-white font-semibold px-6 py-4 rounded-xl text-base"
            >
              <Camera className="h-5 w-5" />
              {stage === "sending" ? "Sending…" : "Take a photo"}
            </button>

            {error && <p className="mt-4 text-sm text-red-500">{error}</p>}
          </>
        )}
      </div>
    </main>
  );
}
