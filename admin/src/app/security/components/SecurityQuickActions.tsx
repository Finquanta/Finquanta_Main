'use client';

import React from 'react';
import { QuickActions } from '@/components/widgets';
import { Shield, Key, Lock, AlertTriangle } from 'lucide-react';

export default function SecurityQuickActions() {
  const actions = [
    {
      id: 'block-ip',
      label: 'Block IP Address',
      action: () => console.log('Block IP'),
      icon: <Shield className="w-4 h-4 mr-2" />
    },
    {
      id: 'reset-password',
      label: 'Reset Password',
      action: () => console.log('Reset password'),
      icon: <Key className="w-4 h-4 mr-2" />
    },
    {
      id: 'enable-2fa',
      label: 'Enable 2FA',
      action: () => console.log('Enable 2FA'),
      icon: <Lock className="w-4 h-4 mr-2" />
    },
    {
      id: 'security-scan',
      label: 'Run Security Scan',
      action: () => console.log('Run security scan'),
      icon: <AlertTriangle className="w-4 h-4 mr-2" />
    }
  ];

  return <QuickActions actions={actions} />;
}