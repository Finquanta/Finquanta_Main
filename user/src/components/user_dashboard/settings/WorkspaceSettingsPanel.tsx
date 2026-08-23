"use client";

import { useEffect, useState } from 'react';
import { Building2, Bot, CreditCard } from 'lucide-react';
import BusinessProfileSettings from './BusinessProfileSettings';
import FinnaSettings from './FinnaSettings';
import BillingSettings from './BillingSettings';

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

  const muted = isDark ? 'text-gray-400' : 'text-gray-500';
  const line = isDark ? 'border-gray-700' : 'border-gray-200';

  return (
    <div>
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

      {tab === 'business-profile' && <BusinessProfileSettings isDark={isDark} />}
      {tab === 'finna' && <FinnaSettings isDark={isDark} />}
      {tab === 'billing' && <BillingSettings isDark={isDark} />}
    </div>
  );
}
