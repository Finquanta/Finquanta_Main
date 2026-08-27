"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Camera } from "lucide-react";
import { useLanguage } from "@/hooks/context/LanguageContext";
import {
  DocumentCapture, DocumentType, ScanAllowance, getScanAllowance, uploadCapture,
} from "@/lib/api/capture";
import { PaymentRequiredError } from "@/lib/api/client";
import UpgradePromptDialog from "@/components/user_dashboard/billing/UpgradePromptDialog";
import CaptureReviewModal from "./CaptureReviewModal";
import CaptureHandoffDialog from "./CaptureHandoffDialog";
import CaptureSourceDialog from "./CaptureSourceDialog";

/**
 * "Scan a document" — photograph a bill or upload a scan, and review what was
 * read before it reaches the books.
 *
 * Sits inline with Add Data and Create Invoice, because it is a third way to
 * make the same entry rather than a feature of its own. It renders as a bare
 * button for exactly that reason — the scan meter and the phone link used to
 * hang off it in a column, which dropped it out of line with its neighbours.
 * Both now live in the chooser instead.
 *
 * Clicking it opens that chooser rather than a file picker. The two ways in —
 * a file, or your phone — are equally useful and were previously at different
 * levels of prominence, with the phone route demoted to a small link.
 */

interface Props {
  /** Called after an entry is created, so the page can refresh its numbers. */
  onSaved: () => void;
  className?: string;
}

export default function CaptureButton({ onSaved, className }: Props) {
  const { t } = useLanguage();
  // Two inputs, not one. `capture="environment"` asks a phone for its rear
  // camera, and there is no way to drop that attribute at click time — so
  // "take a photo" and "choose a file" need separate elements.
  const cameraRef = useRef<HTMLInputElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const [allowance, setAllowance] = useState<ScanAllowance | null>(null);
  const [busy, setBusy] = useState(false);
  const [capture, setCapture] = useState<DocumentCapture | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [upgrade, setUpgrade] = useState<PaymentRequiredError | null>(null);
  const [chooser, setChooser] = useState(false);
  const [handoff, setHandoff] = useState(false);
  const [hasCamera, setHasCamera] = useState(false);

  const refreshAllowance = useCallback(() => {
    getScanAllowance().then(setAllowance).catch(() => setAllowance(null));
  }, []);
  useEffect(() => { refreshAllowance(); }, [refreshAllowance]);

  /**
   * Is this device one you can photograph with?
   *
   * `pointer: coarse` means a touchscreen, which in practice means a camera is
   * right here. A mouse-driven machine has none, which is the gap the QR
   * handoff exists to close.
   *
   * Read in an effect rather than during render because `matchMedia` does not
   * exist on the server. Defaulting to false means the desktop pair of options
   * is what renders first — the right guess, since a desktop is where this
   * chooser matters and a phone corrects itself before anyone opens it.
   */
  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    setHasCamera(window.matchMedia("(pointer: coarse)").matches);
  }, []);

  const open = () => {
    setError(null);
    // Ask before spending: if there is nothing left, say so now rather than
    // after they have photographed something and waited for it to be read.
    if (allowance && !allowance.allowed) {
      setUpgrade(new PaymentRequiredError(t("dashboard", "captureOutOfScans"), { feature: "documentScans" }));
      return;
    }
    setChooser(true);
  };

  const onFile = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    // Reset immediately so picking the SAME file twice still fires onChange.
    event.target.value = "";
    if (!file) return;

    setBusy(true);
    setError(null);
    try {
      // 'other' rather than a guess: the user picks the destination in the
      // review popup, and the model may suggest a type from the document itself.
      const result = await uploadCapture(file, "other" as DocumentType);
      setCapture(result);
    } catch (e) {
      if (e instanceof PaymentRequiredError) setUpgrade(e);
      else setError(e instanceof Error ? e.message : t("dashboard", "genericError"));
    } finally {
      setBusy(false);
    }
  };

  const saved = () => {
    setCapture(null);
    refreshAllowance();
    onSaved();
  };

  return (
    <>
      <input
        ref={cameraRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/heic,image/heif,application/pdf"
        capture="environment"
        onChange={onFile}
        className="hidden"
      />
      <input
        ref={fileRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/heic,image/heif,application/pdf"
        onChange={onFile}
        className="hidden"
      />

      {/* Nothing wrapping it: a bare button, the same shape and height as Add
          Data and Create Invoice, so the three sit on one line. The scan count
          lives in the chooser, where it is read at the moment it matters. */}
      <button
        onClick={open}
        disabled={busy}
        className={
          className ??
          "flex items-center gap-1.5 bg-purple-500 hover:bg-purple-600 disabled:opacity-60 text-white font-semibold px-4 py-2 rounded-lg text-sm"
        }
      >
        <Camera className="h-4 w-4" />
        {busy ? t("dashboard", "captureReading") : t("dashboard", "captureScan")}
      </button>

      {error && <p className="text-xs text-red-500 mt-1">{error}</p>}

      <CaptureSourceDialog
        open={chooser}
        onClose={() => setChooser(false)}
        hasCamera={hasCamera}
        allowance={allowance}
        onTakePhoto={() => { setChooser(false); cameraRef.current?.click(); }}
        onUploadFile={() => { setChooser(false); fileRef.current?.click(); }}
        onUsePhone={() => { setChooser(false); setHandoff(true); }}
      />

      {/* The phone's photo lands in exactly the same review popup a desktop
          upload does — there is one way into the books, not two. */}
      <CaptureHandoffDialog
        open={handoff}
        onClose={() => setHandoff(false)}
        onCapture={(c) => { setHandoff(false); setCapture(c); }}
        onOutOfScans={(e) => { setHandoff(false); setUpgrade(e); }}
      />

      {capture && (
        <CaptureReviewModal
          capture={capture}
          onClose={() => setCapture(null)}
          onSaved={saved}
          onOutOfScans={(e) => { setCapture(null); setUpgrade(e); }}
        />
      )}

      <UpgradePromptDialog
        open={!!upgrade}
        onClose={() => { setUpgrade(null); refreshAllowance(); }}
        title={t("dashboard", "captureOutOfScansTitle")}
        body={
          allowance?.limit != null
            ? t("dashboard", "captureOutOfScansBody").replace("{limit}", String(allowance.limit))
            : t("dashboard", "captureOutOfScans")
        }
        requiredPlan={upgrade?.requiredPlan ?? null}
      />
    </>
  );
}
