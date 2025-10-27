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
      <div className="mb-9">
        <h2 className="text-2xl font-bold text-black mb-1">Notification settings</h2>
        <p className="text-sm font-medium text-black">Select your notification preference</p>
      </div>

      {/* Notification Options */}
      <div className="space-y-6">
        {/* Filter */}
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <h3 className="text-2xl font-medium text-black mb-1">Filter</h3>
            <p className="text-sm font-medium text-black">
              Select the notifications you prefer to receive and those you would like to disable.
            </p>
          </div>
          <div className="ml-4">
            <Switch
              checked={settings.filter}
              onChange={(checked) => handleToggle('filter', checked)}
            />
          </div>
        </div>

        {/* News and updates */}
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <h3 className="text-2xl font-medium text-black mb-1">News and updates</h3>
            <p className="text-sm font-medium text-black">
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
            <h3 className="text-2xl font-medium text-black mb-1">Reminders</h3>
            <p className="text-sm font-medium text-black">
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

        {/* Push notifications */}
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <h3 className="text-2xl font-medium text-black mb-1">Push notifications</h3>
            <p className="text-sm font-medium text-black">
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

      {/* Financial notification section */}
      <div className="mt-10 mb-6">
        <h3 className="text-2xl font-bold text-black mb-1">Financial notification</h3>
        <p className="text-sm font-medium text-black">
          financials notifications keep you informed about your account movement.
        </p>
      </div>

      {/* Financial notification options */}
      <div className="space-y-6">
        {/* Payment update notification */}
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <h3 className="text-2xl font-medium text-black mb-1">Payment update notification</h3>
            <p className="text-sm font-medium text-black">
              Get notified when fund be deposited into your account.
            </p>
          </div>
          <div className="ml-4">
            <Switch
              checked={settings.paymentUpdate}
              onChange={(checked) => handleToggle('paymentUpdate', checked)}
            />
          </div>
        </div>

        {/* Balance notification */}
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <h3 className="text-2xl font-medium text-black mb-1">Balance notification</h3>
            <p className="text-sm font-medium text-black">
              Get notified about your latest account balance
            </p>
          </div>
          <div className="ml-4">
            <Switch
              checked={settings.balanceNotification}
              onChange={(checked) => handleToggle('balanceNotification', checked)}
            />
          </div>
        </div>
      </div>
    </div>
  );
}