"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { Phone, X } from "lucide-react";
import { useTheme } from "@/hooks/context/ThemeContext";
import { themeClasses } from "@/lib/theme";
import { DIAL_CODES } from "@/lib/countries";
import { saveMyPhone } from "@/lib/api/me";

/**
 * Adding a phone number, as a proper dialog.
 *
 * This was a bare text input that expanded inside the sidebar, which asked
 * somebody to know and type their own country code into a box captioned only by
 * a placeholder. Picking the country and typing the digits are two different
 * decisions, and a 56-pixel-wide sidebar is the wrong place to make either.
 *
 * The country list is the SHARED one in lib/countries.ts, extended with dialling
 * codes rather than given a second list of its own — that file exists precisely
 * because the country list had been written out three times and drifted.
 *
 * RENDERED THROUGH A PORTAL, and it has to be.
 *
 * This is opened from PhoneChip, which lives in the sidebar — and the sidebar
 * carries `transform` for its mobile slide-in. A transformed ancestor becomes
 * the containing block for `position: fixed` descendants, so `fixed inset-0`
 * resolved against a 56-pixel column instead of the viewport, and the
 * sidebar's `overflow-y-auto` clipped whatever was left. The dialog appeared
 * squeezed inside the sidebar. Nothing about the markup was wrong; CSS simply
 * gave it nowhere else to go. A portal to <body> escapes that ancestor.
 *
 * Any future dialog opened from inside the sidebar needs the same treatment.
 */
export default function PhoneDialog({
  open, onClose, onSaved, defaultCountry,
}: {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  /** The workspace's country, when known — a sensible first guess. */
  defaultCountry?: string;
}) {
  const { theme } = useTheme();
  const isDark = theme === "dark";
  const c = themeClasses(isDark);

  const [country, setCountry] = useState("");
  const [number, setNumber] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  /** `document` does not exist during the server render. */
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);

  /**
   * Pre-select from the workspace's country when we have one.
   *
   * A guess somebody can change beats an empty box: most people are adding
   * their own number from the country their business is registered in.
   */
  useEffect(() => {
    if (!open) return;
    setError(null);
    setCountry((prev) => prev || (defaultCountry && DIAL_CODES.some((d) => d.country === defaultCountry)
      ? defaultCountry
      : ""));
  }, [open, defaultCountry]);

  const dial = useMemo(
    () => DIAL_CODES.find((d) => d.country === country)?.code ?? "",
    [country]
  );

  if (!open || !mounted) return null;

  const save = async () => {
    // Digits only, so "(555) 123 4567" and "5551234567" store identically.
    const digits = number.replace(/[^\d]/g, "");
    if (!dial) return setError("Pick a country first.");
    if (digits.length < 4) return setError("That number looks too short.");

    setSaving(true);
    setError(null);
    try {
      await saveMyPhone(`${dial} ${digits}`);
      onSaved();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save that number.");
    } finally {
      setSaving(false);
    }
  };

  const field = `w-full rounded-lg border px-3 py-2 text-sm outline-none ${c.input}`;

  return createPortal(
    <div
      className="fixed inset-0 z-[75] flex items-center justify-center bg-black/50 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="phone-dialog-title"
      onClick={onClose}
    >
      <div
        className={`w-full max-w-sm rounded-xl shadow-xl ${c.surface}`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className={`flex items-start justify-between p-5 border-b ${c.line}`}>
          <div className="flex items-center gap-2">
            <Phone className="h-5 w-5 text-blue-500" />
            <h2 id="phone-dialog-title" className={`text-lg font-bold ${c.heading}`}>
              Add your phone number
            </h2>
          </div>
          <button onClick={onClose} aria-label="Close" className={`flex-shrink-0 ${c.quietControl}`}>
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-5 space-y-3">
          <p className={`text-xs ${c.body}`}>
            This is your personal number, not the business one. It is only used to reach you about
            your own account.
          </p>

          <div>
            <label className={`block text-xs font-semibold mb-1 ${c.label}`}>Country</label>
            <select
              value={country}
              onChange={(e) => setCountry(e.target.value)}
              className={field}
            >
              <option value="">Select a country…</option>
              {DIAL_CODES.map((d) => (
                // Country + code, keyed on both: several countries share a code,
                // so the name alone is what makes each row distinguishable.
                <option key={`${d.country}${d.code}`} value={d.country}>
                  {d.country} ({d.code})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className={`block text-xs font-semibold mb-1 ${c.label}`}>Phone number</label>
            <div className="flex gap-2">
              <span
                className={`flex items-center rounded-lg border px-3 text-sm font-mono ${c.input} ${dial ? "" : c.muted}`}
              >
                {dial || "+—"}
              </span>
              <input
                type="tel"
                inputMode="tel"
                autoFocus
                value={number}
                onChange={(e) => setNumber(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") save(); }}
                placeholder="555 123 4567"
                className={`${field} flex-1`}
              />
            </div>
            <p className={`mt-1 text-[11px] ${c.muted}`}>
              Without the country code — that is the box on the left.
            </p>
          </div>

          {error && <p className="text-sm text-red-500">{error}</p>}

          <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 pt-1">
            <button
              onClick={onClose}
              className={`px-4 py-2.5 rounded-lg text-sm font-medium ${c.body} ${c.hover}`}
            >
              Cancel
            </button>
            <button
              onClick={save}
              disabled={saving || !dial || !number.trim()}
              className="px-5 py-2.5 rounded-lg text-sm font-semibold text-white bg-blue-500 hover:bg-blue-600 disabled:opacity-60"
            >
              {saving ? "Saving…" : "Save number"}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
