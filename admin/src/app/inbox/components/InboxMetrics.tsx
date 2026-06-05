// src/app/inbox/components/InboxMetrics.tsx
import React from 'react';
import { MetricCard } from '@/components/widgets';
import { InboxMetrics } from '../types';

interface InboxMetricsProps {
  metrics: InboxMetrics;
}

export default function InboxMetrics({ metrics }: InboxMetricsProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
      <MetricCard
        title="Unread Messages"
        value={metrics.unreadMessages}
        change={`${metrics.volumeTrend > 0 ? '+' : ''}${metrics.volumeTrend}%`}
        changeType={metrics.volumeTrend > 0 ? 'negative' : 'positive'}
        period="vs yesterday"
      />
      <MetricCard
        title="Response Rate"
        value={`${metrics.responseRate}%`}
        change={`+${metrics.responseTrend}%`}
        changeType="positive"
        period="vs last month"
      />
      <MetricCard
        title="Avg Response Time"
        value={`${metrics.avgResponseTime}h`}
        subValue="hours"
      />
      <MetricCard
        title="Message Volume"
        value={metrics.messageVolume}
        subValue="this week"
      />
    </div>
  );
}