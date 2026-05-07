'use client';

import React from 'react';
import { NotificationSettings as NotificationSettingsType } from './types';
import Switch from './Switch';

interface NotificationSettingsProps {
  settings: NotificationSettingsType;
  onSettingsChange: (settings: NotificationSettingsType) => void;
}

export default function NotificationSettings({ settings, onSettingsChange }: NotificationSettingsProps) {

  const handleToggle = (setting: keyof typeof settings, checked: boolean) => {
    onSettingsChange({
      ...settings,
      [setting]: checked
    });
  };

  return (
    <div className="bg-white p-6">
      {/* Header */}
      <div className="mb-6">
        <h2 className="text-lg font-semibold text-black mb-1">Notification Settings</h2>
        <p className="text-sm text-gray-500">Select your notification preference</p>
      </div>

      {/* Notification Options */}
      <div className="space-y-4">

        {/* News and Updates */}
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <h3 className="text-sm font-medium text-black mb-1">News and Updates</h3>
            <p className="text-xs text-gray-500">
              News about product and feature updates.
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
            <h3 className="text-sm font-medium text-black mb-1">Reminders</h3>
            <p className="text-xs text-gray-500">
              Get a notification to remind you of updates you might have missed.
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
            <h3 className="text-sm font-medium text-black mb-1">Push Notifications</h3>
            <p className="text-xs text-gray-500">
              Get in-app notification about your savings and investments.
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