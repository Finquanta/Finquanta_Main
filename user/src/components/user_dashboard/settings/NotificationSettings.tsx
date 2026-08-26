'use client';

import React, { useEffect, useState } from 'react';
import { NotificationSettings as NotificationSettingsType } from './types';
import Switch from './Switch';
import { useLanguage } from '@/hooks/context/LanguageContext';
import { useTheme } from '@/hooks/context/ThemeContext';
import {
  EmailPreferences, NOTIFICATION_KEYS, NOTIFICATION_LABELS,
  PreferenceKey, REMINDER_LABELS, REMINDER_TYPES,
  getEmailPreferences, saveEmailPreferences,
} from '@/lib/api/lifecycle';

interface NotificationSettingsProps {
  settings: NotificationSettingsType;
  onSettingsChange: (settings: NotificationSettingsType) => void;
}

/**
 * Settings → Notifications. Every switch on this screen now persists.
 *
 * They did not before: all of them lived in React state owned by
 * `profile-settings/page.tsx` and were dropped on unmount, so a preference set
 * here survived exactly until you navigated away. Two groups now, both stored:
 *
 *   - what the product shows you, in the app
 *   - the reminder emails it sends when you are not here
 *
 * Kept apart because unsubscribing from mail is not the same as asking the
 * dashboard to go quiet, and the unsubscribe link in an email only touches the
 * second group.
 */
export default function NotificationSettings(_props: NotificationSettingsProps) {
  const { t } = useLanguage();
  const { theme } = useTheme();
  const dark = theme === 'dark';

  const [prefs, setPrefs] = useState<EmailPreferences | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    getEmailPreferences().then(setPrefs).catch(() => setError('Could not load your preferences.'));
  }, []);

  const toggle = async (key: PreferenceKey, enabled: boolean) => {
    // Moved at once, then reconciled with what the server reports. A switch
    // that waits for a round trip reads as broken and gets clicked twice.
    setPrefs((p) => p && { ...p, [key]: enabled });
    setBusy(true); setError(null);
    try {
      setPrefs(await saveEmailPreferences({ [key]: enabled }));
    } catch {
      setPrefs((p) => p && { ...p, [key]: !enabled });
      setError('Could not save that. Please try again.');
    }
    setBusy(false);
  };

  const row = (key: PreferenceKey, title: string, description: string) => (
    <div key={key} className="flex items-start justify-between">
      <div className="flex-1">
        <h3 className={`text-sm font-medium mb-1 ${dark ? 'text-white' : 'text-black'}`}>{title}</h3>
        <p className="text-xs text-gray-500">{description}</p>
      </div>
      <div className="ml-4">
        <Switch
          checked={prefs ? prefs[key] : false}
          onChange={(checked) => { if (prefs && !busy) void toggle(key, checked); }}
        />
      </div>
    </div>
  );

  return (
    <div className={`p-6 ${dark ? 'bg-gray-900' : 'bg-white'}`}>
      <div className="mb-6">
        <h2 className={`text-lg font-semibold mb-1 ${dark ? 'text-white' : 'text-black'}`}>
          {t('settings', 'notificationSettings')}
        </h2>
        <p className="text-sm text-gray-500">{t('settings', 'selectNotificationPreference')}</p>
      </div>

      {error && <p className="mb-4 text-xs text-red-600">{error}</p>}

      {/* Loading rather than defaulting to off: showing every switch off before
          the answer arrives tells people the opposite of the truth, and the
          default is ON. */}
      {!prefs ? (
        <p className="text-sm text-gray-400">Loading…</p>
      ) : (
        <>
          <div className="space-y-4">
            {NOTIFICATION_KEYS.map((k) =>
              row(k, NOTIFICATION_LABELS[k].title, NOTIFICATION_LABELS[k].description)
            )}
          </div>

          <div className="mt-8 pt-6 border-t border-gray-200 dark:border-gray-700">
            <h2 className={`text-lg font-semibold mb-1 ${dark ? 'text-white' : 'text-black'}`}>
              Reminder Emails
            </h2>
            <p className="text-sm text-gray-500 mb-4">
              Occasional emails about your account. Turning one off never affects things you ask
              for, such as password resets.
            </p>
            <div className="space-y-4">
              {REMINDER_TYPES.map((k) =>
                row(k, REMINDER_LABELS[k].title, REMINDER_LABELS[k].description)
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
