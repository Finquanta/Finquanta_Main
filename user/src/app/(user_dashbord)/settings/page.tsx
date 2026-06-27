'use client';

import React, { useState, useCallback, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAppState } from '@/hooks/context/useAppState';
import SettingsMenu from '@/components/user_dashboard/settings/SettingsMenu';
import NotificationSettingsComponent from '@/components/user_dashboard/settings/NotificationSettings';
import AccessPermissions from '@/components/user_dashboard/settings/AccessPermissions';
import LanguageSettings from '@/components/user_dashboard/settings/LanguageSettings';
import DataPrivacy from '@/components/user_dashboard/settings/DataPrivacy';
import BackupRecovery from '@/components/user_dashboard/settings/BackupRecovery';
import HelpSupport from '@/components/user_dashboard/settings/HelpSupport';
import AccountProfile from '@/components/user_dashboard/settings/AccountProfile';
import { defaultSettings, UserSettings } from '@/components/user_dashboard/settings/types';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';

export default function SettingsPage() {
  const router = useRouter();
  const logout = useAppState((s) => s.logout);
  const [activeSection, setActiveSection] = useState('notification-preference');
  const [settings, setSettings] = useState<UserSettings>(defaultSettings);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [showLogoutDialog, setShowLogoutDialog] = useState(false);

  const handleSectionChange = useCallback((section: string) => {
    setActiveSection(section);
  }, []);

  const handleLogout = useCallback(() => {
    setIsLoggingOut(true);
    setShowLogoutDialog(false);
    setTimeout(() => {
      logout();
      router.push('/login');
    }, 1500);
  }, [logout, router]);

  const handleLogoutClick = useCallback(() => {
    setShowLogoutDialog(true);
  }, []);

  useEffect(() => {
    if (activeSection === 'log-out') {
      handleLogoutClick();
    }
  }, [activeSection, handleLogoutClick]);

  const renderSettingsContent = useCallback(() => {
    if (isLoggingOut) {
      return (
        <div className="bg-white p-6 h-full flex items-center justify-center overflow-hidden">
          <h2 className="text-2xl font-bold text-red-600 mb-4 flex items-center gap-2">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-red-600"></div>
            Logging Out...
          </h2>
          <p className="text-center text-sm text-[#778da9]">
            Thank you for using Fund Flow AI. You are being securely logged out.
          </p>
        </div>
      );
    }

    switch (activeSection) {
      case 'notification-preference':
        return <NotificationSettingsComponent settings={settings.notifications} onSettingsChange={(notifications) => setSettings({ ...settings, notifications })} />;
      case 'access-permission':
        return <AccessPermissions settings={settings.security} onSettingsChange={(securitySettings) => setSettings({ ...settings, security: securitySettings })} />;
      case 'languages':
        return <LanguageSettings settings={settings.language} onSettingsChange={(languageSettings) => setSettings({ ...settings, language: languageSettings })} />;
      case 'data-privacy':
        return <DataPrivacy settings={settings.privacy} onSettingsChange={(privacySettings) => setSettings({ ...settings, privacy: privacySettings })} />;
      case 'backup-recovery':
        return <BackupRecovery settings={settings.backup} onSettingsChange={(backupSettings) => setSettings({ ...settings, backup: backupSettings })} />;
      case 'help-support':
        return <HelpSupport settings={settings.help} onSettingsChange={(helpSettings) => setSettings({ ...settings, help: helpSettings })} />;
      case 'account-profile':
        return <AccountProfile settings={settings.profile} onSettingsChange={(profileSettings) => setSettings({ ...settings, profile: profileSettings })} />;
      case 'log-out':
        return null;
      default:
        return <NotificationSettingsComponent settings={settings.notifications} onSettingsChange={(notifications) => setSettings({ ...settings, notifications })} />;
    }
  }, [activeSection, settings, isLoggingOut]);

  return (
    <>
      <div className="grid grid-cols-1 md:grid-cols-2 bg-[#f2f3f4] h-[calc(100%)] overflow-hidden">
        {/* Middle Column - Settings Menu */}
        <div className="h-full overflow-y-auto">
          <SettingsMenu
            activeSection={activeSection}
            onSectionChange={setActiveSection}
          />
        </div>

        {/* Right Column - Settings Content */}
        <div className="h-full overflow-hidden">
          {renderSettingsContent()}
        </div>
      </div>

      {/* Logout Confirmation Dialog */}
      <Dialog open={showLogoutDialog} onOpenChange={setShowLogoutDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm Logout</DialogTitle>
            <DialogDescription>
              Are you sure you want to log out of your account?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowLogoutDialog(false)}
            >
              Cancel
            </Button>
            <Button
              variant="default"
              onClick={handleLogout}
              className="bg-red-600 hover:bg-red-700"
            >
              Yes, Log Out
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
