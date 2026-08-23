"use client";

import { useEffect, useState } from 'react';
import { Settings } from 'lucide-react';
import DashboardShell from '@/components/user_dashboard/DashboardShell';
import { useTheme } from '@/hooks/context/ThemeContext';
import WorkspaceSettingsPanel, {
  WorkspaceTab, WORKSPACE_TABS,
} from '@/components/user_dashboard/settings/WorkspaceSettingsPanel';
import { Business, listBusinesses } from '@/lib/api/businesses';

/**
 * Workspace settings as a full page.
 *
 * The gear in the workspace switcher opens these as a POPUP — that is the
 * normal way in, and it is the better one: changing a setting is a detour from
 * whatever you were doing, not a destination worth losing your place for.
 *
 * This page is kept for the cases a dialog cannot serve: a bookmark, a link
 * someone pastes to a colleague, and a phone screen where a modal this tall is
 * worse than a page. It renders the SAME panel component, so the two can never
 * drift into showing different tabs.
 */
export default function WorkspaceSettingsPage() {
  const { theme } = useTheme();
  const isDark = theme === 'dark';

  const [tab, setTab] = useState<WorkspaceTab>('business-profile');

  /**
   * Deep-linkable via ?tab=, read from `window.location` in an effect rather
   * than with `useSearchParams`.
   *
   * Not a style choice: `useSearchParams` opts the route into dynamic
   * rendering, and without a `<Suspense>` boundary `next build` fails outright
   * with "useSearchParams() should be wrapped in a suspense boundary" — a
   * failure typecheck does not catch, because it only appears at build time.
   */
  useEffect(() => {
    const requested = new URLSearchParams(window.location.search).get('tab');
    if (requested && WORKSPACE_TABS.some((x) => x.id === requested)) {
      setTab(requested as WorkspaceTab);
    }
  }, []);

  /**
   * Which workspace this is, named so it is clear whose books are being edited.
   *
   * Re-read whenever the workspace changes, because the panel below can now
   * switch it in place. A heading naming one workspace over a form editing
   * another is worse than no heading at all.
   */
  const [name, setName] = useState<string>('');
  useEffect(() => {
    const refresh = () => {
      listBusinesses()
        .then((list: Business[]) => {
          // The same key the API layer sends as X-Business-Id, so the name shown
          // is guaranteed to be the workspace these tabs actually edit.
          const active = typeof window !== 'undefined'
            ? localStorage.getItem('activeBusinessId')
            : null;
          const found = list.find((b) => b.id === active) ?? list[0];
          setName(found?.name ?? '');
        })
        .catch(() => setName(''));
    };
    refresh();
    window.addEventListener('finna:businessChanged', refresh);
    return () => window.removeEventListener('finna:businessChanged', refresh);
  }, []);

  const muted = isDark ? 'text-gray-400' : 'text-gray-500';

  return (
    <DashboardShell>
      <div className="p-6 max-w-5xl mx-auto">
        <div className="flex items-center gap-3 mb-1">
          <Settings className={isDark ? 'h-5 w-5 text-gray-300' : 'h-5 w-5 text-gray-700'} />
          <h1 className={`text-xl font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>
            Workspace Settings
          </h1>
        </div>
        <p className={`text-sm mb-6 ${muted}`}>
          {name
            ? <>Settings for <span className="font-medium">{name}</span>. Each workspace has its own.</>
            : 'These settings apply to the workspace you are currently in.'}
        </p>

        <WorkspaceSettingsPanel isDark={isDark} initialTab={tab} />
      </div>
    </DashboardShell>
  );
}
