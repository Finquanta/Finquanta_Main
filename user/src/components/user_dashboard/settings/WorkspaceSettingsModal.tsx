"use client";

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Settings, X } from 'lucide-react';
import WorkspaceSettingsPanel, { WorkspaceTab } from './WorkspaceSettingsPanel';
import { listBusinesses } from '@/lib/api/businesses';

/**
 * Workspace settings as a popup.
 *
 * A dialog rather than a page because these settings are a detour, not a
 * destination: you open them to change one thing about the workspace you are
 * already working in, and a full navigation throws away whatever you had on
 * screen and makes you find your way back afterwards.
 *
 * Rendered through a portal onto document.body, like the switcher's other
 * modals. The switcher's dropdown sits inside a positioned, scrollable
 * container — a dialog rendered in place would be clipped by it and would
 * inherit its stacking context, so it would appear underneath the very menu
 * that opened it.
 */
export default function WorkspaceSettingsModal({
  businessName,
  isDark,
  initialTab = 'business-profile',
  onClose,
}: {
  businessName: string;
  isDark: boolean;
  initialTab?: WorkspaceTab;
  onClose: () => void;
}) {
  /**
   * Escape closes it, and the page behind does not scroll while it is open.
   *
   * Both restored on unmount — forgetting the overflow reset is how a modal
   * leaves the whole app unscrollable after it closes.
   */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = previous;
    };
  }, [onClose]);

  /**
   * The heading follows the panel's workspace picker.
   *
   * `businessName` is the row the gear was clicked on, which is right when the
   * dialog opens and wrong the moment somebody switches inside it — leaving the
   * title naming one workspace over a form editing another.
   */
  const [shownName, setShownName] = useState(businessName);
  useEffect(() => { setShownName(businessName); }, [businessName]);
  useEffect(() => {
    const onChange = () => {
      listBusinesses()
        .then((list) => {
          const active = localStorage.getItem('activeBusinessId');
          const found = list.find((b) => b.id === active);
          if (found) setShownName(found.name);
        })
        .catch(() => { /* keep the name we have rather than blanking it */ });
    };
    window.addEventListener('finna:businessChanged', onChange);
    return () => window.removeEventListener('finna:businessChanged', onChange);
  }, []);

  if (typeof document === 'undefined') return null;

  const shell = isDark ? 'bg-gray-900 text-gray-100' : 'bg-white text-gray-900';
  const muted = isDark ? 'text-gray-400' : 'text-gray-500';
  const line = isDark ? 'border-gray-700' : 'border-gray-200';

  return createPortal(
    <div
      className="fixed inset-0 z-[100] flex items-start justify-center overflow-y-auto bg-black/50 p-4 sm:p-8"
      // Only a click on the backdrop ITSELF closes. Without the target check a
      // drag that starts inside the dialog and ends on the backdrop would shut
      // it, losing whatever was half-typed in the form.
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      role="dialog"
      aria-modal="true"
      aria-label="Workspace settings"
    >
      <div className={`w-full max-w-4xl rounded-xl shadow-2xl my-auto ${shell}`}>
        <div className={`flex items-start justify-between gap-4 border-b px-6 py-4 ${line}`}>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <Settings className="h-4 w-4 flex-shrink-0" />
              <h2 className="text-base font-semibold">Workspace Settings</h2>
            </div>
            {/* Which workspace, said out loud. These settings look identical
                between workspaces, so without the name there is nothing on
                screen telling you whose books you are about to change. */}
            <p className={`text-xs mt-0.5 truncate ${muted}`}>
              {shownName ? shownName : 'Current workspace'}
            </p>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className={`flex-shrink-0 rounded-lg p-1.5 ${isDark ? 'hover:bg-gray-800' : 'hover:bg-gray-100'} ${muted}`}
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="px-6 py-5">
          <WorkspaceSettingsPanel isDark={isDark} initialTab={initialTab} />
        </div>
      </div>
    </div>,
    document.body
  );
}
