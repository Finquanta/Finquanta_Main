import React from 'react';
import { MetricCard } from '@/components/widgets';
import { SecurityMetrics } from '../types';

interface SecurityMetricsProps {
  metrics: SecurityMetrics;
}

export default function SecurityMetrics({ metrics }: SecurityMetricsProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
      <MetricCard
        title="Active Alerts"
        value={metrics.activeAlerts}
        change={`${metrics.alertTrend > 0 ? '+' : ''}${metrics.alertTrend}%`}
        changeType={metrics.alertTrend > 0 ? 'negative' : 'positive'}
        period="vs last 24h"
      />
      <MetricCard
        title="Failed Logins"
        value={metrics.failedLogins}
        change={`${metrics.loginTrend > 0 ? '+' : ''}${metrics.loginTrend}%`}
        changeType={metrics.loginTrend > 0 ? 'negative' : 'positive'}
        period="vs last 24h"
      />
      <MetricCard
        title="Blocked Threats"
        value={metrics.blockedThreats}
        change={`${metrics.threatTrend > 0 ? '+' : ''}${metrics.threatTrend}%`}
        changeType={metrics.threatTrend > 0 ? 'positive' : 'negative'}
        period="vs last 7 days"
      />
      <MetricCard
        title="Security Score"
        value={metrics.securityScore}
        subValue="out of 100"
        change={`${metrics.scoreTrend > 0 ? '+' : ''}${metrics.scoreTrend}`}
        changeType={metrics.scoreTrend > 0 ? 'positive' : 'negative'}
        period="vs last month"
      />
    </div>
  );
}