import React from 'react';
import { MetricCard } from '@/components/widgets';
import { HelpMetrics } from '../types';

interface HelpMetricsProps {
  metrics: HelpMetrics;
}

export default function HelpMetrics({ metrics }: HelpMetricsProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
      <MetricCard
        title="Open Tickets"
        value={metrics.openTickets}
        change={`${metrics.ticketTrend > 0 ? '+' : ''}${metrics.ticketTrend}%`}
        changeType={metrics.ticketTrend > 0 ? 'negative' : 'positive'}
        period="vs last week"
      />
      <MetricCard
        title="Avg Resolution Time"
        value={`${metrics.avgResolutionTime}h`}
        change={`${metrics.resolutionTrend > 0 ? '+' : ''}${metrics.resolutionTrend}%`}
        changeType={metrics.resolutionTrend > 0 ? 'negative' : 'positive'}
        period="vs last month"
      />
      <MetricCard
        title="Satisfaction Score"
        value={`${metrics.satisfactionScore}/5`}
        change={`+${metrics.satisfactionTrend}`}
        changeType="positive"
        period="vs last month"
      />
      <MetricCard
        title="Knowledge Base Articles"
        value={metrics.totalArticles}
        subValue={`${metrics.articleViews} views`}
      />
    </div>
  );
}