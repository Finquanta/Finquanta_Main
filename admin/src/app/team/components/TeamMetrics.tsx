'use client';

import React from 'react';
import { MetricCard } from '@/components/widgets';
import { TeamMetrics } from '../types';

interface TeamMetricsProps {
  metrics: TeamMetrics;
}

export default function TeamMetrics({ metrics }: TeamMetricsProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
      <MetricCard
        title="Total Members"
        value={metrics.totalMembers}
        change={`+${metrics.growthTrend}%`}
        changeType="positive"
        period="vs last month"
      />
      <MetricCard
        title="Active Projects"
        value={metrics.activeProjects}
        subValue="projects"
      />
      <MetricCard
        title="Avg Productivity"
        value={metrics.avgProductivity}
        subValue="score"
        change={`+${metrics.productivityTrend}%`}
        changeType="positive"
        period="vs last month"
      />
      <MetricCard
        title="Upcoming Deadlines"
        value={metrics.upcomingDeadlines}
        subValue="this week"
      />
    </div>
  );
}