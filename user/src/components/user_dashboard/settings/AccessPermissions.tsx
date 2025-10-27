'use client';

import React, { useState } from 'react';
import { SecuritySettings, SessionInfo, ApiKey } from './types';
import { Shield, Key, Monitor, Smartphone, Mail, Plus, Trash2, Download, Copy, Check, X } from 'lucide-react';
import Switch from './Switch';

interface AccessPermissionsProps {
  settings: SecuritySettings;
  onSettingsChange: (settings: SecuritySettings) => void;
}

export default function AccessPermissions({ settings, onSettingsChange }: AccessPermissionsProps) {
  const [showApiKeyModal, setShowApiKeyModal] = useState(false);
  const [showNewKeyModal, setShowNewKeyModal] = useState(false);
  const [newKey, setNewKey] = useState({ name: '', permissions: ['read'] });
  const [newSessionAlert, setNewSessionAlert] = useState(true);
  const [recoveryEmail, setRecoveryEmail] = useState(settings.recoveryEmail);

  const handleCreateApiKey = () => {
    const newApiKey: ApiKey = {
      id: `api-key-${Date.now()}`,
      name: newKey.name,
      permissions: newKey.permissions,
      createdAt: new Date(),
      isActive: true
    };

    const updatedSettings = {
      ...settings,
      apiKeys: [...settings.apiKeys, newApiKey]
    };

    onSettingsChange(updatedSettings);
    setShowNewKeyModal(false);
    setNewKey({ name: '', permissions: ['read'] });
    setShowApiKeyModal(false);
  };

  const handleDeleteApiKey = (keyId: string) => {
    if (confirm('Are you sure you want to delete this API key? This action cannot be undone.')) {
      const updatedSettings = {
        ...settings,
        apiKeys: settings.apiKeys.filter(key => key.id !== keyId)
      };
      onSettingsChange(updatedSettings);
    }
  };

  const handleRevokeSession = (sessionId: string) => {
    if (confirm('Are you sure you want to revoke this session?')) {
      const updatedSettings = {
        ...settings,
        activeSessions: settings.activeSessions.filter(session => session.id !== sessionId)
      };
      onSettingsChange(updatedSettings);
    }
  };

  const handleUpdateRecoveryEmail = () => {
    if (recoveryEmail && recoveryEmail.includes('@')) {
      const updatedSettings = {
        ...settings,
        recoveryEmail
      };
      onSettingsChange(updatedSettings);
      alert('Recovery email updated successfully!');
    }
  };

  return (
    <div className="bg-white p-6">
      {/* Header */}
      <div className="mb-8">
        <h2 className="text-2xl font-bold text-[#1b263b] mb-2">Access & Permissions</h2>
        <p className="text-sm text-[#778da9]">
          Manage your account security, active sessions, and API access
        </p>
      </div>

      <div className="space-y-8">
        {/* Two-Factor Authentication */}
        <div className="bg-gray-50 p-6 rounded-lg">
          <h3 className="text-lg font-semibold text-[#1b263b] mb-4 flex items-center gap-2">
            <Shield className="w-5 h-5 text-[#150578]" />
            Two-Factor Authentication
          </h3>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-[#1b263b]">Enable 2FA</p>
                <p className="text-sm text-[#778da9]">
                  Add an extra layer of security to your account
                </p>
              </div>
              <Switch
                checked={settings.twoFactorEnabled}
                onChange={(enabled) => {
                  onSettingsChange({
                    ...settings,
                    twoFactorEnabled: enabled
                  });
                }}
              />
            </div>
            {settings.twoFactorEnabled && (
              <div className="pl-4 space-y-3">
                <div>
                  <p className="text-sm font-medium text-[#1b263b] mb-2">Authentication Method</p>
                  <div className="flex gap-4">
                    {['app', 'sms', 'email'].map((method) => (
                      <label key={method} className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="radio"
                          name="2fa-method"
                          value={method}
                          checked={settings.twoFactorMethod === method}
                          onChange={() => {
                            onSettingsChange({
                              ...settings,
                              twoFactorMethod: method as 'app' | 'sms' | 'email'
                            });
                          }}
                          className="text-[#150578]"
                        />
                        <span className="text-sm capitalize">{method}</span>
                      </label>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Active Sessions */}
        <div>
          <h3 className="text-lg font-semibold text-[#1b263b] mb-4 flex items-center gap-2">
            <Monitor className="w-5 h-5 text-[#150578]" />
            Active Sessions
          </h3>
          <div className="space-y-3">
            {settings.activeSessions.length === 0 ? (
              <p className="text-sm text-[#778da9]">No active sessions</p>
            ) : (
              settings.activeSessions.map((session) => (
                <div key={session.id} className="bg-gray-50 p-4 rounded-lg border border-gray-200">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <Smartphone className="w-4 h-4 text-[#778da9]" />
                        <div>
                          <p className="font-medium text-[#1b263b]">{session.device}</p>
                          <p className="text-xs text-[#778da9]">{session.browser}</p>
                        </div>
                        <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                          session.isActive
                            ? 'bg-green-100 text-green-800'
                            : 'bg-gray-100 text-gray-800'
                        }`}>
                          {session.isActive ? 'Active now' : `Last active: ${session.lastActive.toLocaleDateString()}`}
                        </span>
                      </div>
                      <div className="text-xs text-[#778da9] space-y-1">
                        <p>{session.location}</p>
                        <p>IP: {session.ipAddress}</p>
                      </div>
                    </div>
                    {session.isActive && (
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleRevokeSession(session.id)}
                          className="px-3 py-1 text-xs text-red-600 hover:bg-red-50 rounded-md transition-colors"
                        >
                          Revoke
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* API Keys */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-[#1b263b] flex items-center gap-2">
              <Key className="w-5 h-5 text-[#150578]" />
              API Keys
            </h3>
            <button
              onClick={() => setShowNewKeyModal(true)}
              className="flex items-center gap-2 px-4 py-2 bg-[#150578] text-white rounded-lg hover:bg-[#0d0342] transition-colors"
            >
              <Plus className="w-4 h-4" />
              Create New Key
            </button>
          </div>
          <p className="text-sm text-[#778da9] mb-4">
            API keys allow external applications to access your account programmatically.
          </p>
          <div className="space-y-3">
            {settings.apiKeys.length === 0 ? (
              <div className="text-center py-8 text-[#778da9]">
                <Key className="w-8 h-8 mx-auto mb-4 text-gray-300" />
                <p>No API keys created yet</p>
              </div>
            ) : (
              settings.apiKeys.map((apiKey) => (
                <div key={apiKey.id} className="bg-gray-50 p-4 rounded-lg border border-gray-200">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                          apiKey.isActive ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                        }`}>
                          <Key className="w-4 h-4" />
                        </div>
                        <div>
                          <p className="font-medium text-[#1b263b]">{apiKey.name}</p>
                          <p className="text-xs text-[#778da9]">Created {apiKey.createdAt.toLocaleDateString()}</p>
                        </div>
                        <div className="flex gap-2">
                          {apiKey.permissions.map((permission) => (
                            <span key={permission} className="px-2 py-1 text-xs bg-[#150578] text-white rounded-md">
                              {permission}
                            </span>
                          ))}
                        </div>
                      </div>
                      <div className="text-xs text-[#778da9]">
                        {apiKey.lastUsed && (
                          <p>Last used: {apiKey.lastUsed.toLocaleDateString()}</p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => {
                          navigator.clipboard.writeText(apiKey.id);
                          alert('API key copied to clipboard!');
                        }}
                        className="p-2 text-[#778da9] hover:text-[#150578] hover:bg-gray-100 rounded-lg transition-colors"
                        title="Copy API key ID"
                      >
                        <Copy className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDeleteApiKey(apiKey.id)}
                        className="p-2 text-red-600 hover:text-red-700 hover:bg-red-50 rounded-lg transition-colors"
                        title="Delete API key"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Recovery Email */}
        <div className="bg-gray-50 p-6 rounded-lg">
          <h3 className="text-lg font-semibold text-[#1b263b] mb-4 flex items-center gap-2">
            <Mail className="w-5 h-5 text-[#150578]" />
            Account Recovery Email
          </h3>
          <div className="space-y-4">
            <div>
              <p className="text-sm text-[#778da9] mb-2">
                Set a recovery email to help regain access to your account if you forget your password.
              </p>
              <div className="flex gap-3">
                <input
                  type="email"
                  value={recoveryEmail}
                  onChange={(e) => setRecoveryEmail(e.target.value)}
                  placeholder="Enter recovery email"
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#150578] focus:border-transparent"
                />
                <button
                  onClick={handleUpdateRecoveryEmail}
                  className="px-4 py-2 bg-[#150578] text-white rounded-lg hover:bg-[#0d0342] transition-colors"
                >
                  Update
                </button>
              </div>
            </div>
            {settings.recoveryEmail && (
              <div className="flex items-center gap-2 text-sm text-[#63d51d]">
                <Check className="w-4 h-4" />
                Recovery email set to: {settings.recoveryEmail}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* New API Key Modal */}
      {showNewKeyModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-[#1b263b]">Create New API Key</h3>
              <button
                onClick={() => setShowNewKeyModal(false)}
                className="text-[#778da9] hover:text-[#1b263b] transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-[#1b263b] mb-2">Key Name</label>
                <input
                  type="text"
                  value={newKey.name}
                  onChange={(e) => setNewKey({ ...newKey, name: e.target.value })}
                  placeholder="Enter a name for this key"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#150578] focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-[#1b263b] mb-2">Permissions</label>
                <div className="space-y-2">
                  {['read', 'write', 'delete', 'admin'].map((permission) => (
                    <label key={permission} className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={newKey.permissions.includes(permission)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setNewKey({ ...newKey, permissions: [...newKey.permissions, permission] });
                          } else {
                            setNewKey({ ...newKey, permissions: newKey.permissions.filter(p => p !== permission) });
                          }
                        }}
                        className="text-[#150578]"
                      />
                      <span className="text-sm capitalize">{permission}</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => setShowNewKeyModal(false)}
                className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateApiKey}
                className="px-4 py-2 bg-[#150578] text-white rounded-lg hover:bg-[#0d0342] transition-colors"
              >
                Create Key
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}