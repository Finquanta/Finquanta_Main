'use client';

import React from 'react';
import { NotificationSettings as NotificationSettingsType } from './types';
import Switch from './Switch';
import { useLanguage } from '@/hooks/context/LanguageContext';
import { useTheme } from '@/hooks/context/ThemeContext';

interface NotificationSettingsProps {
  settings: NotificationSettingsType;
  onSettingsChange: (settings: NotificationSettingsType) => void;
}

export default function NotificationSettings({ settings, onSettingsChange }: NotificationSettingsProps) {
  const { t } = useLanguage();
  const { theme } = useTheme();
  const dark = theme === 'dark';

  const handleToggle = (setting: keyof typeof settings, checked: boolean) => {
    onSettingsChange({
      ...settings,
      [setting]: checked
    });
  };

  return (
    <div className={`p-6 ${dark ? 'bg-gray-900' : 'bg-white'}`}>
      {/* Header */}
      <div className="mb-6">
        <h2 className={`text-lg font-semibold mb-1 ${dark ? 'text-white' : 'text-black'}`}>{t('settings', 'notificationSettings')}</h2>
        <p className="text-sm text-gray-500">{t('settings', 'selectNotificationPreference')}</p>
      </div>

      {/* Notification Options */}
      <div className="space-y-4">

        {/* News and Updates */}
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <h3 className={`text-sm font-medium mb-1 ${dark ? 'text-white' : 'text-black'}`}>{t('settings', 'newsAndUpdates')}</h3>
            <p className="text-xs text-gray-500">
              {t('settings', 'newsAboutProducts')}
            </p>
          </div>
          <div className="ml-4">
            <Switch
              checked={settings.newsUpdates}
              onChange={(checked) => handleToggle('newsUpdates', checked)}
            />
          </div>
        </div>

        {/* Reminders */}
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <h3 className={`text-sm font-medium mb-1 ${dark ? 'text-white' : 'text-black'}`}>{t('settings', 'reminders')}</h3>
            <p className="text-xs text-gray-500">
              {t('settings', 'getRemindersDescription')}
            </p>
          </div>
          <div className="ml-4">
            <Switch
              checked={settings.reminders}
              onChange={(checked) => handleToggle('reminders', checked)}
            />
          </div>
        </div>

        {/* Push Notifications */}
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <h3 className={`text-sm font-medium mb-1 ${dark ? 'text-white' : 'text-black'}`}>{t('settings', 'pushNotifications')}</h3>
            <p className="text-xs text-gray-500">
              {t('settings', 'pushNotificationsDescription')}
            </p>
          </div>
          <div className="ml-4">
            <Switch
              checked={settings.pushNotifications}
              onChange={(checked) => handleToggle('pushNotifications', checked)}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
