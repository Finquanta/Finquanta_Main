'use client';

import React, { useState } from 'react';
import { BackupSettings, BackupEntry } from './types';
import { Cloud, Download, RefreshCw, Calendar, Clock, CheckCircle, AlertCircle, Trash2, Upload } from 'lucide-react';
import Switch from './Switch';

interface BackupRecoveryProps {
  settings: BackupSettings;
  onSettingsChange: (settings: BackupSettings) => void;
}

export default function BackupRecovery({ settings, onSettingsChange }: BackupRecoveryProps) {
  const [isCreatingBackup, setIsCreatingBackup] = useState(false);
  const [showRestoreModal, setShowRestoreModal] = useState(false);
  const [selectedRestorePoint, setSelectedRestorePoint] = useState<BackupEntry | null>(null);

  const handleCreateManualBackup = async () => {
    setIsCreatingBackup(true);
    try {
      // Simulate backup creation
      await new Promise(resolve => setTimeout(resolve, 2000));

      const newBackup: BackupEntry = {
        id: `backup-${Date.now()}`,
        timestamp: new Date(),
        size: Math.floor(Math.random() * 10000000) + 5000000, // Random size 5-15MB
        type: 'manual',
        status: 'completed'
      };

      const updatedSettings = {
        ...settings,
        lastBackup: new Date(),
        backupHistory: [newBackup, ...settings.backupHistory]
      };

      onSettingsChange(updatedSettings);
      alert('Backup completed successfully!');
    } catch (error) {
      alert('Backup failed. Please try again.');
    } finally {
      setIsCreatingBackup(false);
    }
  };

  const handleRestoreBackup = (backup: BackupEntry) => {
    setSelectedRestorePoint(backup);
    setShowRestoreModal(true);
  };

  const confirmRestore = async () => {
    if (!selectedRestorePoint) return;

    setShowRestoreModal(false);

    // Simulate restore process
    alert(`Restoring from backup created on ${selectedRestorePoint.timestamp.toLocaleDateString()}...`);

    await new Promise(resolve => setTimeout(resolve, 3000));
    alert('Account restored successfully!');
    setSelectedRestorePoint(null);
  };

  const handleDeleteBackup = (backupId: string) => {
    if (confirm('Are you sure you want to delete this backup?')) {
      const updatedSettings = {
        ...settings,
        backupHistory: settings.backupHistory.filter(backup => backup.id !== backupId)
      };
      onSettingsChange(updatedSettings);
    }
  };

  const getBackupStatusIcon = (backup: BackupEntry) => {
    switch (backup.status) {
      case 'completed':
        return <CheckCircle className="w-4 h-4 text-green-500" />;
      case 'failed':
        return <AlertCircle className="w-4 h-4 text-red-500" />;
      default:
        return <Clock className="w-4 h-4 text-blue-500" />;
    }
  };

  const formatBackupSize = (bytes: number) => {
    if (bytes >= 1000000) {
      return `${(bytes / 1000000).toFixed(1)} MB`;
    }
    return `${(bytes / 1000).toFixed(0)} KB`;
  };

  return (
    <div className="bg-white p-6">
      {/* Header */}
      <div className="mb-8">
        <h2 className="text-2xl font-bold text-[#1b263b] mb-2 flex items-center gap-2">
          <Cloud className="w-6 h-6 text-[#150578]" />
          Backup & Recovery
        </h2>
        <p className="text-sm text-[#778da9]">
          Configure automatic backups and manage your data recovery options
        </p>
      </div>

      <div className="space-y-8">
        {/* Auto Backup Settings */}
        <div className="bg-gray-50 p-6 rounded-lg">
          <h3 className="text-lg font-semibold text-[#1b263b] mb-4">Automatic Backups</h3>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-[#1b263b]">Enable automatic backups</p>
                <p className="text-sm text-[#778da9]">
                  Schedule regular backups of your account data
                </p>
              </div>
              <Switch
                checked={settings.autoBackup}
                onChange={(checked) => {
                  onSettingsChange({
                    ...settings,
                    autoBackup: checked
                  });
                }}
              />
            </div>
            {settings.autoBackup && (
              <div className="pl-4 space-y-4">
                <div>
                  <p className="font-medium text-[#1b263b] mb-2">Backup Frequency</p>
                  <div className="flex gap-3">
                    {['daily', 'weekly', 'monthly'].map((frequency) => (
                      <label key={frequency} className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="radio"
                          name="backup-frequency"
                          value={frequency}
                          checked={settings.backupFrequency === frequency}
                          onChange={() => {
                            onSettingsChange({
                              ...settings,
                              backupFrequency: frequency as 'daily' | 'weekly' | 'monthly'
                            });
                          }}
                          className="text-[#150578]"
                        />
                        <span className="text-sm capitalize">{frequency}</span>
                      </label>
                    ))}
                  </div>
                </div>
                <div>
                  <p className="font-medium text-[#1b263b] mb-2">Retention Period</p>
                  <div className="flex items-center gap-3">
                    <select
                      value={settings.backupRetention}
                      onChange={(e) => {
                        onSettingsChange({
                          ...settings,
                          backupRetention: parseInt(e.target.value)
                        });
                      }}
                      className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#150578] focus:border-transparent"
                    >
                      <option value={30}>30 days</option>
                      <option value={60}>60 days</option>
                      <option value={90}>90 days</option>
                      <option value={180}>180 days</option>
                      <option value={365}>1 year</option>
                    </select>
                    <span className="text-sm text-[#778da9]">Keep backups for</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Manual Backup */}
        <div>
          <h3 className="text-lg font-semibold text-[#1b263b] mb-4">Manual Backup</h3>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-[#1b263b]">Create instant backup</p>
                <p className="text-sm text-[#778da9]">
                  Download a complete backup of your account data now
                </p>
              </div>
              <button
                onClick={handleCreateManualBackup}
                disabled={isCreatingBackup}
                className="px-6 py-2 bg-[#150578] text-white rounded-lg hover:bg-[#0d0342] transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {isCreatingBackup ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    Creating Backup...
                  </>
                ) : (
                  <>
                    <Upload className="w-4 h-4" />
                    Create Backup
                  </>
                )}
              </button>
            </div>
            {settings.lastBackup && (
              <div className="mt-3 text-sm text-[#778da9]">
                Last backup: {settings.lastBackup.toLocaleDateString()}
              </div>
            )}
          </div>
        </div>

        {/* Backup History */}
        <div>
          <h3 className="text-lg font-semibold text-[#1b263b] mb-4">Backup History</h3>
          {settings.backupHistory.length === 0 ? (
            <div className="text-center py-8 text-[#778da9]">
              <Cloud className="w-12 h-12 mx-auto mb-4 text-gray-300" />
              <p>No backup history available</p>
            </div>
          ) : (
            <div className="space-y-3">
              {settings.backupHistory.slice(0, 5).map((backup) => (
                <div key={backup.id} className="bg-gray-50 p-4 rounded-lg border border-gray-200">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        {getBackupStatusIcon(backup)}
                        <div>
                          <p className="font-medium text-[#1b263b]">
                            {backup.type === 'automatic' ? 'Automatic' : 'Manual'} Backup
                          </p>
                          <p className="text-xs text-[#778da9]">
                            {backup.timestamp.toLocaleDateString()} at {backup.timestamp.toLocaleTimeString()}
                          </p>
                        </div>
                      </div>
                      <div className="text-sm text-[#778da9]">
                        Size: {formatBackupSize(backup.size)}
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleRestoreBackup(backup)}
                        className="px-3 py-1 text-sm bg-blue-500 text-white rounded-md hover:bg-blue-600 transition-colors"
                      >
                        Restore
                      </button>
                      <button
                        onClick={() => {
                          // Simulate download
                          alert(`Downloading backup from ${backup.timestamp.toLocaleDateString()}...`);
                        }}
                        className="px-3 py-1 text-sm border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
                      >
                        <Download className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDeleteBackup(backup.id)}
                        className="px-3 py-1 text-sm text-red-600 hover:bg-red-50 transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Recovery Options */}
        <div className="bg-blue-50 p-6 rounded-lg">
          <h3 className="text-lg font-semibold text-[#1b263b] mb-4">Recovery Options</h3>
          <div className="space-y-4">
            <div>
              <p className="font-medium text-[#1b263b] mb-2">Account Recovery</p>
              <p className="text-sm text-[#778da9] mb-3">
                Set up account recovery options to regain access if you forget your password
              </p>
              <div className="bg-white p-4 rounded-lg border border-blue-200">
                <div className="space-y-3">
                  <div>
                    <label className="block text-sm font-medium text-[#1b263b] mb-2">
                      Recovery Email Address
                    </label>
                    <input
                      type="email"
                      placeholder="recovery@example.com"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#150578] focus:border-transparent"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-[#1b263b] mb-2">
                      Two-Factor Recovery
                    </label>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="radio"
                          name="2fa-recovery"
                          value="app"
                          className="text-[#150578]"
                        />
                        <span className="text-sm">Authenticator App</span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="radio"
                          name="2fa-recovery"
                          value="sms"
                          className="text-[#150578]"
                        />
                        <span className="text-sm">SMS Messages</span>
                      </label>
                    </div>
                  </div>
                </div>
                <button className="w-full px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors">
                  Save Recovery Settings
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Restore Confirmation Modal */}
      {showRestoreModal && selectedRestorePoint && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <div className="mb-4">
              <h3 className="text-lg font-semibold text-[#1b263b] mb-2">Restore from Backup</h3>
              <div className="bg-yellow-50 p-4 rounded-lg border border-yellow-200">
                <p className="text-sm text-yellow-800 mb-2">
                  ⚠️ Restoring will replace all current data with data from:
                </p>
                <p className="font-medium text-[#1b263b]">
                  {selectedRestorePoint.timestamp.toLocaleDateString()} at {selectedRestorePoint.timestamp.toLocaleTimeString()}
                </p>
                <p className="text-sm text-[#778da9]">
                  Size: {formatBackupSize(selectedRestorePoint.size)}
                </p>
              </div>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setShowRestoreModal(false)}
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={confirmRestore}
                className="flex-1 px-4 py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 transition-colors"
              >
                Yes, Restore
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}