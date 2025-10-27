'use client';

import React, { useState } from 'react';
import { PrivacySettings } from './types';
import { Shield, Download, Trash2, ExternalLink, Cookie, BarChart, Search } from 'lucide-react';
import Switch from './Switch';

interface DataPrivacyProps {
  settings: PrivacySettings;
  onSettingsChange: (settings: PrivacySettings) => void;
}

export default function DataPrivacy({ settings, onSettingsChange }: DataPrivacyProps) {
  const [exportFormat, setExportFormat] = useState('json');
  const [isDeleting, setIsDeleting] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);

  const handleExportData = () => {
    // In a real app, this would trigger data export
    const data = {
      user: {
        profile: "John Mike",
        email: "john.mike@example.com",
        createdAt: "2024-01-01"
      },
      transactions: [],
      documents: [],
      settings: settings,
      exportDate: new Date().toISOString()
    };

    let content = '';
    let filename = '';
    let mimeType = '';

    switch (exportFormat) {
      case 'json':
        content = JSON.stringify(data, null, 2);
        filename = `fundflow-data-${new Date().toISOString().split('T')[0]}.json`;
        mimeType = 'application/json';
        break;
      case 'csv':
        content = 'user_id,email,created_at\njohn.mike@example.com,2024-01-01';
        filename = `fundflow-data-${new Date().toISOString().split('T')[0]}.csv`;
        mimeType = 'text/csv';
        break;
      case 'pdf':
        content = 'Fund Flow AI - User Data Export\\n\\nGenerated: ' + new Date().toLocaleDateString();
        filename = `fundflow-data-${new Date().toISOString().split('T')[0]}.pdf`;
        mimeType = 'application/pdf';
        break;
    }

    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    alert(`Your data has been exported as ${filename}`);
  };

  const handleDeleteAccount = () => {
    setIsDeleting(true);
    // Simulate account deletion
    setTimeout(() => {
      setIsDeleting(false);
      setShowDeleteModal(false);
      alert('Account deletion request submitted. You will receive a confirmation email within 24 hours.');
    }, 2000);
  };

  const cookieOptions = [
    { value: 'all', label: 'All Cookies', description: 'Allow all cookies for optimal experience' },
    { value: 'essential', label: 'Essential Only', description: 'Only necessary cookies for basic functionality' },
    { value: 'none', label: 'No Cookies', description: 'Block all non-essential cookies' }
  ];

  return (
    <div className="bg-white p-6">
      {/* Header */}
      <div className="mb-8">
        <h2 className="text-2xl font-bold text-[#1b263b] mb-2 flex items-center gap-2">
          <Shield className="w-6 h-6 text-[#150578]" />
          Data & Privacy
        </h2>
        <p className="text-sm text-[#778da9]">
          Control your data, privacy settings, and account information
        </p>
      </div>

      <div className="space-y-8">
        {/* Profile Visibility */}
        <div>
          <h3 className="text-lg font-semibold text-[#1b263b] mb-4">Profile Visibility</h3>
          <div className="space-y-4">
            <div>
              <p className="text-sm text-[#778da9] mb-3">
                Control who can see your profile information and activity
              </p>
              <select
                value={settings.profileVisibility}
                onChange={(e) => {
                  onSettingsChange({
                    ...settings,
                    profileVisibility: e.target.value as 'public' | 'private' | 'connections'
                  });
                }}
                className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#150578] focus:border-transparent"
              >
                <option value="public">Public - Anyone can view your profile</option>
                <option value="private">Private - Only you can view your profile</option>
                <option value="connections">Connections - Only connected users can view</option>
              </select>
            </div>
          </div>
        </div>

        {/* Data Sharing */}
        <div>
          <h3 className="text-lg font-semibold text-[#1b263b] mb-4">Data Sharing Preferences</h3>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-[#1b263b]">Share anonymized usage data</p>
                <p className="text-sm text-[#778da9]">
                  Help us improve our services by sharing usage patterns
                </p>
              </div>
              <Switch
                checked={settings.dataSharing}
                onChange={(checked) => {
                  onSettingsChange({
                    ...settings,
                    dataSharing: checked
                  });
                }}
              />
            </div>
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-[#1b263b]">Third-party integrations</p>
                <p className="text-sm text-[#778da9]">
                  Allow secure data sharing with trusted partners
                </p>
              </div>
              <Switch
                checked={settings.thirdPartyDataSharing}
                onChange={(checked) => {
                  onSettingsChange({
                    ...settings,
                    thirdPartyDataSharing: checked
                  });
                }}
              />
            </div>
          </div>
        </div>

        {/* Analytics Tracking */}
        <div>
          <h3 className="text-lg font-semibold text-[#1b263b] mb-4 flex items-center gap-2">
            <BarChart className="w-5 h-5 text-[#150578]" />
            Analytics & Tracking
          </h3>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-[#1b263b]">Usage Analytics</p>
                <p className="text-sm text-[#778da9]">
                  Help us improve Fund Flow AI with anonymous usage data
                </p>
              </div>
              <Switch
                checked={settings.analyticsTracking}
                onChange={(checked) => {
                  onSettingsChange({
                    ...settings,
                    analyticsTracking: checked
                  });
                }}
              />
            </div>
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-[#1b263b]">Search Engine Indexing</p>
                <p className="text-sm text-[#778da9]">
                  Allow search engines to index your public profile
                </p>
              </div>
              <Switch
                checked={settings.searchEngineIndexing}
                onChange={(checked) => {
                  onSettingsChange({
                    ...settings,
                    searchEngineIndexing: checked
                  });
                }}
              />
            </div>
          </div>
        </div>

        {/* Cookie Settings */}
        <div>
          <h3 className="text-lg font-semibold text-[#1b263b] mb-4 flex items-center gap-2">
            <Cookie className="w-5 h-5 text-[#150578]" />
            Cookie Preferences
          </h3>
          <div className="space-y-4">
            <div>
              <p className="text-sm text-[#778da9] mb-3">
                Choose how we use cookies to enhance your experience
              </p>
              <div className="space-y-3">
                {cookieOptions.map((option) => (
                  <label key={option.value} className="flex items-start gap-3 cursor-pointer">
                    <input
                      type="radio"
                      name="cookieConsent"
                      value={option.value}
                      checked={settings.cookieConsent === option.value}
                      onChange={() => {
                        onSettingsChange({
                          ...settings,
                          cookieConsent: option.value as 'all' | 'essential' | 'none'
                        });
                      }}
                      className="text-[#150578] mt-1"
                    />
                    <div>
                      <p className="font-medium text-[#1b263b]">{option.label}</p>
                      <p className="text-sm text-[#778da9]">{option.description}</p>
                    </div>
                  </label>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Data Export */}
        <div>
          <h3 className="text-lg font-semibold text-[#1b263b] mb-4 flex items-center gap-2">
            <Download className="w-5 h-5 text-[#150578]" />
            Export Your Data
          </h3>
          <div className="space-y-4">
            <div>
              <p className="text-sm text-[#778da9] mb-3">
                Download a copy of all your data, including transactions, documents, and settings
              </p>
              <div className="flex gap-3">
                <select
                  value={exportFormat}
                  onChange={(e) => setExportFormat(e.target.value)}
                  className="flex-1 p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#150578] focus:border-transparent"
                >
                  <option value="json">JSON</option>
                  <option value="csv">CSV</option>
                  <option value="pdf">PDF</option>
                </select>
                <button
                  onClick={handleExportData}
                  className="px-6 py-2 bg-[#150578] text-white rounded-lg hover:bg-[#0d0342] transition-colors flex items-center gap-2"
                >
                  <Download className="w-4 h-4" />
                  Export Data
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Account Deletion */}
        <div className="bg-red-50 border border-red-200 p-6 rounded-lg">
          <h3 className="text-lg font-semibold text-[#1b263b] mb-4 flex items-center gap-2 text-red-700">
            <Trash2 className="w-5 h-5" />
            Delete Account
          </h3>
          <div className="space-y-4">
            <div>
              <p className="text-sm text-red-700 mb-3">
                Permanently delete your account and all associated data. This action cannot be undone.
              </p>
              <p className="text-sm text-red-700 mb-4">
                ⚠️ Warning: This will immediately delete:
              </p>
              <ul className="text-sm text-red-700 space-y-2 ml-4">
                <li>• All account information and profile data</li>
                <li>• Transaction history and financial records</li>
                <li>• Uploaded documents and files</li>
                <li>• Settings and preferences</li>
                <li>• API keys and access tokens</li>
                <li>• Backup and recovery options</li>
              </ul>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setShowDeleteModal(true)}
                disabled={isDeleting}
                className="px-6 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isDeleting ? 'Processing...' : 'Delete My Account'}
              </button>
              <button
                onClick={() => setShowDeleteModal(false)}
                className="px-6 py-2 border border-red-300 text-red-600 rounded-lg hover:bg-red-50 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <div className="mb-4">
              <h3 className="text-lg font-semibold text-red-700 mb-2">Delete Account Confirmation</h3>
              <p className="text-sm text-gray-700">
                Are you absolutely sure you want to delete your account? This action is permanent and cannot be undone.
              </p>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setShowDeleteModal(false)}
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteAccount}
                className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
              >
                Yes, Delete My Account
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}