import React from 'react';
import MainLayout from '@/components/MainLayout';
import SecurityMetrics from './components/SecurityMetrics';
import SecurityEventsTable from './components/SecurityEventsTable';
import SecurityQuickActions from './components/SecurityQuickActions';
import { ChartWidget } from '@/components/widgets';
import { SecurityMetrics as SecurityMetricsType, SecurityEvent } from './types';

// Mock data
const mockMetrics: SecurityMetricsType = {
  activeAlerts: 3,
  failedLogins: 47,
  blockedThreats: 12,
  securityScore: 87,
  alertTrend: -25,
  loginTrend: 15,
  threatTrend: -8,
  scoreTrend: 2
};

const mockEvents: SecurityEvent[] = [
  {
    id: '1',
    type: 'login',
    severity: 'medium',
    description: 'Failed login attempt from unknown IP',
    timestamp: new Date().toISOString(),
    ip: '192.168.1.100',
    user: 'admin',
    status: 'active'
  },
  {
    id: '2',
    type: 'threat',
    severity: 'high',
    description: 'Suspicious activity detected',
    timestamp: new Date(Date.now() - 3600000).toISOString(),
    ip: '10.0.0.1',
    status: 'investigating'
  }
];

const mockChartData = [
  { date: 'Mon', value: 2 },
  { date: 'Tue', value: 3 },
  { date: 'Wed', value: 1 },
  { date: 'Thu', value: 4 },
  { date: 'Fri', value: 2 },
  { date: 'Sat', value: 1 },
  { date: 'Sun', value: 3 }
];

export default function SecurityPage() {
  return (
    <MainLayout>
      <div className="p-6 bg-gray-50 min-h-screen">
        <h1 className="text-2xl font-bold mb-6">Security</h1>

        <SecurityMetrics metrics={mockMetrics} />

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
          <div className="lg:col-span-2">
            <SecurityEventsTable events={mockEvents} />
          </div>
          <div>
            <SecurityQuickActions />
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <ChartWidget
            title="Access Control Overview"
            data={mockChartData}
            type="bar"
          />
          <ChartWidget
            title="Threat Intelligence"
            data={mockChartData}
            type="line"
          />
        </div>
      </div>
    </MainLayout>
  );
}
