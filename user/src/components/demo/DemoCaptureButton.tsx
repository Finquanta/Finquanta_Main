"use client";

import { useRef, useState } from "react";
import { Camera } from "lucide-react";
import { useLanguage } from "@/hooks/context/LanguageContext";
import { ExtractedFields, uploadDemoCapture } from "@/lib/api/capture";
import { DEMO_SCAN_CAP, load, save } from "@/lib/demo/store";

/**
 * The Try-It Demo's one free scan.
 *
 * The rest of the demo is a convincing fake — its Finna answers are computed
 * from the demo's own data with no model behind them. This one is real: a
 * genuine photograph of a genuine receipt goes to a genuine vision call, and
 * what comes back is what the product would actually read. That honesty is the
 * point. A faked scan would demo beautifully and teach the visitor nothing
 * about whether it works on *their* receipts.
 *
 * ONE, because it costs real money on an unauthenticated endpoint. One is
 * enough to prove it, and the moment right after is the best moment to ask for
 * a signup — which is what the `scanCap` trigger does.
 *
 * The result is NOT written into the demo books automatically. It is shown, and
 * the visitor decides — same review-then-confirm rule the real product follows,
 * so the demo does not teach a habit the product will not honour.
 */
export default function DemoCaptureButton({
  isDark,
  onAdd,
}: {
  isDark: boolean;
  /** Put the read entry into the demo's own books. */
  onAdd: (fields: ExtractedFields) => void;
}) {
  const { t } = useLanguage();
  const inputRef = useRef<HTMLInputElement>(null);

  const used = load().scan?.used ?? 0;
  const [spent, setSpent] = useState(used >= DEMO_SCAN_CAP);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fields, setFields] = useState<ExtractedFields | null>(null);

  const onFile = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    setBusy(true);
    setError(null);
    try {
      const result = await uploadDemoCapture(file);

      /**
       * Charged on SUCCESS only. A visitor whose upload failed has not seen the
       * thing work, so taking their one free look would be the worst possible
       * moment to start asking them to sign up.
       */
      const state = load();
      state.scan = { used: (state.scan?.used ?? 0) + 1 };
      save(state);
      setSpent(true);
      setFields(result.fields);
    } catch (e) {
      setError(e instanceof Error ? e.message : t("dashboard", "genericError"));
    } finally {
      setBusy(false);
    }
  };

  const card = isDark ? "bg-gray-800 border-gray-700" : "bg-white border-gray-200";
  const muted = isDark ? "text-gray-400" : "text-gray-500";
  const heading = isDark ? "text-white" : "text-gray-900";

  return (
    <>
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
        disabled={busy || spent}
        title={spent ? t("demo", "dScanSpent") : undefined}
        className="flex items-center gap-1.5 bg-purple-500 hover:bg-purple-600 disabled:opacity-50 text-white font-semibold px-4 py-2 rounded-lg text-sm"
      >
        <Camera className="h-4 w-4" />
        {busy
          ? t("dashboard", "captureReading")
          : spent
            ? t("demo", "dScanSpent")
            : t("demo", "dScanFree")}
      </button>

      {error && <p className="mt-1 text-xs text-red-500">{error}</p>}

      {/* What was read, and the choice to keep it. */}
      {fields && (
        <div
          className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50 p-4"
          role="dialog"
          aria-modal="true"
          onClick={() => setFields(null)}
        >
          <div
            className={`w-full max-w-sm rounded-xl border p-5 shadow-xl ${card}`}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className={`text-base font-bold ${heading}`}>{t("demo", "dScanReadTitle")}</h3>
            <p className={`mt-1 text-xs ${muted}`}>{t("demo", "dScanReadBody")}</p>

            <dl className="mt-4 space-y-1.5 text-sm">
              {([
                [t("dashboard", "invoiceNameLabel"), fields.vendor ?? "—"],
                [t("dashboard", "dateOfInvoiceLabel"), fields.documentDate ?? "—"],
                [
                  t("dashboard", "invoiceAmountLabel"),
                  fields.total != null ? `${fields.currency ?? ""} ${fields.total}`.trim() : "—",
                ],
              ] as const).map(([k, v]) => (
                <div key={k} className="flex justify-between gap-3">
                  <dt className={muted}>{k}</dt>
                  <dd className={`font-semibold ${heading}`}>{v}</dd>
                </div>
              ))}
            </dl>

            <div className="mt-5 flex gap-2">
              <button
                onClick={() => { onAdd(fields); setFields(null); }}
                disabled={fields.total == null}
                className="flex-1 rounded-lg bg-green-500 hover:bg-green-600 disabled:opacity-50 px-4 py-2.5 text-sm font-semibold text-white"
              >
                {t("demo", "dScanAdd")}
              </button>
              <button
                onClick={() => setFields(null)}
                className={`rounded-lg border px-4 py-2.5 text-sm font-semibold ${
                  isDark ? "border-gray-600 text-gray-200 hover:bg-gray-700" : "border-gray-300 text-gray-700 hover:bg-gray-50"
                }`}
              >
                {t("dashboard", "captureDiscard")}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
