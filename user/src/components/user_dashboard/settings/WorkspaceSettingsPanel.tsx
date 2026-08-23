"use client";

import { useEffect, useState } from 'react';
import { Building2, Bot, CreditCard } from 'lucide-react';
import BusinessProfileSettings from './BusinessProfileSettings';
import FinnaSettings from './FinnaSettings';
import BillingSettings from './BillingSettings';
import { Business, listBusinesses } from '@/lib/api/businesses';

/** Where apiFetch reads the workspace it scopes every request to. */
const ACTIVE_KEY = 'activeBusinessId';

/**
 * The three workspace-scoped settings tabs, with no chrome around them.
 *
 * Split out so the popup and the standalone page render exactly the same
 * thing. Two copies of a tab list is how one of them quietly ends up missing a
 * tab — and here the two surfaces are the same feature reached two ways, so
 * there is nothing to gain from letting them differ.
 *
 * Scoping is by the active workspace: every request the tabs make already
 * carries X-Business-Id, so none of them needs to know a workspace exists.
 */

export type WorkspaceTab = 'business-profile' | 'finna' | 'billing';

export const WORKSPACE_TABS: { id: WorkspaceTab; label: string; icon: typeof Building2 }[] = [
  { id: 'business-profile', label: 'Business Profile', icon: Building2 },
  { id: 'finna', label: 'Finna Overview', icon: Bot },
  { id: 'billing', label: 'Billing', icon: CreditCard },
];

export default function WorkspaceSettingsPanel({
  isDark,
  initialTab = 'business-profile',
}: {
  isDark: boolean;
  initialTab?: WorkspaceTab;
}) {
  const [tab, setTab] = useState<WorkspaceTab>(initialTab);

  // Follows the caller when it changes which tab it wants (the popup can be
  // reopened on a different tab without being remounted).
  useEffect(() => { setTab(initialTab); }, [initialTab]);

  /**
   * Switch workspace WITHOUT leaving settings.
   *
   * These tabs all edit "the active workspace", so comparing two workspaces or
   * fixing the same field on several of them otherwise meant closing settings,
   * switching in the sidebar and coming back in — once per workspace.
   */
  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [activeId, setActiveId] = useState<string>('');

  useEffect(() => {
    setActiveId(localStorage.getItem(ACTIVE_KEY) ?? '');
    listBusinesses()
      .then((list) => {
        setBusinesses(list);
        // Nothing stored yet: adopt whichever workspace the API layer would
        // have fallen back to, so the picker cannot show a blank selection.
        setActiveId((cur) => cur || list[0]?.id || '');
      })
      .catch(() => setBusinesses([]));
  }, []);

  /**
   * Same handoff the sidebar switcher performs: the key apiFetch reads, then
   * the event everything else listens for. Changing `activeId` also re-keys the
   * tab below, which remounts it — the tabs load their data once on mount, so
   * without that the header would say one workspace while the form still held
   * the previous one's values.
   */
  const switchTo = (id: string) => {
    if (!id || id === activeId) return;
    localStorage.setItem(ACTIVE_KEY, id);
    setActiveId(id);
    window.dispatchEvent(new CustomEvent('finna:businessChanged', { detail: id }));
  };

  const muted = isDark ? 'text-gray-400' : 'text-gray-500';
  const line = isDark ? 'border-gray-700' : 'border-gray-200';

  return (
    <div>
      {/* Only worth showing when there is somewhere to switch TO. */}
      {businesses.length > 1 && (
        <div className="flex items-center gap-2 mb-4">
          <label htmlFor="ws-switch" className={`text-sm ${muted}`}>Workspace</label>
          <select
            id="ws-switch"
            value={activeId}
            onChange={(e) => switchTo(e.target.value)}
            className={`rounded-lg border px-3 py-1.5 text-sm ${
              isDark
                ? 'bg-gray-700 border-gray-600 text-white'
                : 'bg-white border-gray-200 text-gray-900'
            }`}
          >
            {businesses.map((b) => (
              <option key={b.id} value={b.id}>{b.name}</option>
            ))}
          </select>
        </div>
      )}

      <div className={`flex flex-wrap gap-1 border-b mb-6 ${line}`}>
        {WORKSPACE_TABS.map((x) => {
          const Icon = x.icon;
          const on = tab === x.id;
          return (
            <button
              key={x.id}
              onClick={() => setTab(x.id)}
              className={`flex items-center gap-2 px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
                on ? 'border-blue-500 text-blue-500' : `border-transparent ${muted} hover:text-blue-400`
              }`}
            >
              <Icon className="h-4 w-4" />
              {x.label}
            </button>
          );
        })}
      </div>

      {/* Keyed by workspace: the tabs fetch on mount, so switching has to
          remount them or they would keep showing the previous workspace's
          data under the new workspace's name. */}
      <div key={activeId}>
        {tab === 'business-profile' && <BusinessProfileSettings isDark={isDark} />}
        {tab === 'finna' && <FinnaSettings isDark={isDark} />}
        {tab === 'billing' && <BillingSettings isDark={isDark} />}
      </div>
    </div>
  );
}
