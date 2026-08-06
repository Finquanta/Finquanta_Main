'use client';

import React, { useEffect, useState } from 'react';
import { Shield, Loader2, Check, Copy } from 'lucide-react';
import { getMe } from '@/lib/api/me';
import { setupTwoFactor, confirmTwoFactor, disableTwoFactor } from '@/lib/api/twofa';
import { useLanguage } from '@/hooks/context/LanguageContext';

type View = 'loading' | 'off' | 'on' | 'enrolling' | 'backup-codes' | 'disabling';

/**
 * Real two-factor authentication (TOTP) — separate from the surrounding mock
 * Access & Permissions settings (sessions/API keys there are placeholder UI
 * with no backend yet). This component owns its own state and talks straight
 * to the /v1/auth/2fa/* endpoints.
 */
export default function TwoFactorSettings() {
  const { t } = useLanguage();
  const [view, setView] = useState<View>('loading');
  const [error, setError] = useState<string | null>(null);

  // Enrollment
  const [secret, setSecret] = useState('');
  const [qrDataUrl, setQrDataUrl] = useState('');
  const [code, setCode] = useState('');
  const [confirming, setConfirming] = useState(false);
  const [backupCodes, setBackupCodes] = useState<string[]>([]);
  const [copied, setCopied] = useState(false);

  // Disable
  const [disablePassword, setDisablePassword] = useState('');
  const [disabling, setDisabling] = useState(false);

  useEffect(() => {
    getMe()
      .then((me) => setView(me.twoFactorEnabled ? 'on' : 'off'))
      .catch(() => setView('off'));
  }, []);

  const startEnroll = async () => {
    setError(null);
    try {
      const { secret, qrDataUrl } = await setupTwoFactor();
      setSecret(secret);
      setQrDataUrl(qrDataUrl);
      setCode('');
      setView('enrolling');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not start setup.');
    }
  };

  const confirmEnroll = async () => {
    if (!code.trim() || confirming) return;
    setError(null);
    setConfirming(true);
    try {
      const { backupCodes } = await confirmTwoFactor(code.trim());
      setBackupCodes(backupCodes);
      setView('backup-codes');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Incorrect code.');
    } finally {
      setConfirming(false);
    }
  };

  const finishBackupCodes = () => {
    setBackupCodes([]);
    setView('on');
  };

  const confirmDisable = async () => {
    if (!disablePassword.trim() || disabling) return;
    setError(null);
    setDisabling(true);
    try {
      await disableTwoFactor(disablePassword.trim());
      setDisablePassword('');
      setView('off');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not disable two-factor authentication.');
    } finally {
      setDisabling(false);
    }
  };

  const copyBackupCodes = () => {
    navigator.clipboard.writeText(backupCodes.join('\n')).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <div className="bg-gray-50 p-6 rounded-lg">
      <h3 className="text-lg font-semibold text-[#1b263b] mb-4 flex items-center gap-2">
        <Shield className="w-5 h-5 text-[#150578]" />{t("dashboard","spTwoFactor")}</h3>

      {view === 'loading' && (
        <div className="flex items-center gap-2 text-sm text-[#778da9]">
          <Loader2 className="w-4 h-4 animate-spin" />{t("dashboard","spCheckingSecurity")}</div>
      )}

      {view === 'off' && (
        <div className="flex items-center justify-between">
          <div>
            <p className="font-medium text-[#1b263b]">{t("dashboard","spAddAuthApp")}</p>
            <p className="text-sm text-[#778da9]">{t("dashboard","spSixDigit")}</p>
          </div>
          <button
            onClick={startEnroll}
            className="px-4 py-2 bg-[#150578] text-white text-sm font-medium rounded-lg hover:bg-[#0d0342] transition-colors"
          >{t("dashboard","spEnable2fa")}</button>
        </div>
      )}

      {view === 'on' && (
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm text-green-700">
            <Check className="w-4 h-4" />{t("dashboard","sp2faOn")}</div>
          <button
            onClick={() => { setError(null); setDisablePassword(''); setView('disabling'); }}
            className="px-4 py-2 border border-red-300 text-red-600 text-sm font-medium rounded-lg hover:bg-red-50 transition-colors"
          >{t("dashboard","spDisable")}</button>
        </div>
      )}

      {view === 'enrolling' && (
        <div className="space-y-4">
          <p className="text-sm text-[#778da9]">{t("dashboard","spScanThis")}</p>
          {qrDataUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={qrDataUrl} alt="Two-factor QR code" className="w-40 h-40 border border-gray-200 rounded-lg bg-white p-2" />
          )}
          <div>
            <p className="text-xs text-[#778da9] mb-1">{t("dashboard","spCantScan")}</p>
            <code className="text-xs bg-white border border-gray-200 rounded px-2 py-1 break-all">{secret}</code>
          </div>
          <div>
            <label className="block text-sm font-medium text-[#1b263b] mb-1">{t("dashboard","spEnterCode")}</label>
            <input
              type="text"
              inputMode="numeric"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') confirmEnroll(); }}
              placeholder="123456"
              className="w-full max-w-[200px] px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#150578] focus:border-transparent text-center tracking-widest"
            />
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <div className="flex gap-3">
            <button
              onClick={confirmEnroll}
              disabled={confirming || !code.trim()}
              className="px-4 py-2 bg-[#150578] text-white text-sm font-medium rounded-lg hover:bg-[#0d0342] transition-colors disabled:opacity-60"
            >
              {confirming ? 'Verifying…' : 'Verify & Enable'}
            </button>
            <button
              onClick={() => { setView('off'); setError(null); }}
              className="px-4 py-2 border border-gray-300 text-sm rounded-lg hover:bg-gray-100 transition-colors"
            >{t("dashboard","invCancel")}</button>
          </div>
        </div>
      )}

      {view === 'backup-codes' && (
        <div className="space-y-4">
          <div className="flex items-center gap-2 text-sm text-green-700">
            <Check className="w-4 h-4" />{t("dashboard","sp2faOn")}</div>
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
            <p className="text-sm font-medium text-[#1b263b] mb-1">{t("dashboard","spSaveBackupCodes")}</p>
            <p className="text-xs text-[#778da9] mb-3">
              Use one of these to sign in if you lose access to your authenticator app. Each works once. This is the only time they're shown.
            </p>
            <div className="grid grid-cols-2 gap-2 font-mono text-sm bg-white border border-gray-200 rounded-lg p-3">
              {backupCodes.map((c) => <div key={c}>{c}</div>)}
            </div>
            <button
              onClick={copyBackupCodes}
              className="mt-3 flex items-center gap-1.5 text-xs font-medium text-[#150578] hover:underline"
            >
              {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
              {copied ? 'Copied' : 'Copy all'}
            </button>
          </div>
          <button
            onClick={finishBackupCodes}
            className="px-4 py-2 bg-[#150578] text-white text-sm font-medium rounded-lg hover:bg-[#0d0342] transition-colors"
          >{t("dashboard","spSavedThese")}</button>
        </div>
      )}

      {view === 'disabling' && (
        <div className="space-y-3">
          <p className="text-sm text-[#778da9]">{t("dashboard","spEnterPwOff")}</p>
          <input
            type="password"
            value={disablePassword}
            onChange={(e) => setDisablePassword(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') confirmDisable(); }}
            placeholder={t("dashboard","spCurrentPassword")}
            className="w-full max-w-xs px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#150578] focus:border-transparent"
          />
          {error && <p className="text-sm text-red-600">{error}</p>}
          <div className="flex gap-3">
            <button
              onClick={confirmDisable}
              disabled={disabling || !disablePassword.trim()}
              className="px-4 py-2 bg-red-600 text-white text-sm font-medium rounded-lg hover:bg-red-700 transition-colors disabled:opacity-60"
            >
              {disabling ? 'Disabling…' : 'Confirm disable'}
            </button>
            <button
              onClick={() => { setView('on'); setError(null); }}
              className="px-4 py-2 border border-gray-300 text-sm rounded-lg hover:bg-gray-100 transition-colors"
            >{t("dashboard","invCancel")}</button>
          </div>
        </div>
      )}
    </div>
  );
}
