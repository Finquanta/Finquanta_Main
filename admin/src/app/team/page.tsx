'use client';

import React from 'react';
import MainLayout from '@/components/MainLayout';
import TeamMetrics from './components/TeamMetrics';
import TeamMembersTable from './components/TeamMembersTable';
import { ChartWidget, ActivityFeed } from '@/components/widgets';
import { TeamMetrics as TeamMetricsType, TeamMember } from './types';

// Mock data
const mockMetrics: TeamMetricsType = {
  totalMembers: 24,
  activeProjects: 12,
  avgProductivity: 87,
  upcomingDeadlines: 5,
  growthTrend: 8,
  productivityTrend: 12
};

const mockMembers: TeamMember[] = [
  {
    id: '1',
    name: 'John Doe',
    email: 'john@example.com',
    role: 'Senior Developer',
    department: 'Engineering',
    status: 'active',
    joinDate: '2022-01-15',
    lastActive: new Date().toISOString(),
    performanceScore: 92
  },
  {
    id: '2',
    name: 'Jane Smith',
    email: 'jane@example.com',
    role: 'Product Manager',
    department: 'Product',
    status: 'active',
    joinDate: '2021-06-01',
    lastActive: new Date(Date.now() - 7200000).toISOString(),
    performanceScore: 88
  }
];

const mockChartData = [
  { date: 'Jan', value: 85 },
  { date: 'Feb', value: 87 },
  { date: 'Mar', value: 86 },
  { date: 'Apr', value: 89 },
  { date: 'May', value: 91 },
  { date: 'Jun', value: 87 }
];

const mockActivities = [
  {
    id: '1',
    name: 'John Doe',
    description: 'Completed performance review',
    date: '2024-06-15',
    time: '10:30 AM',
    category: 'Performance'
  },
  {
    id: '2',
    name: 'Jane Smith',
    description: 'Assigned to new project',
    date: '2024-06-14',
    time: '2:15 PM',
    category: 'Projects'
  }
];

export default function TeamPage() {
  return (
    <MainLayout>
      <div className="p-6 bg-gray-50 min-h-screen">
        <h1 className="text-2xl font-bold mb-6">Team</h1>

        <TeamMetrics metrics={mockMetrics} />

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          <div className="lg:col-span-1">
            <TeamMembersTable members={mockMembers} />
          </div>
          <div className="lg:col-span-1">
            <ChartWidget
              title="Team Performance Trends"
              data={mockChartData}
              type="line"
              height={300}
            />
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <ChartWidget
            title="Department Breakdown"
            data={mockChartData}
            type="bar"
          />
          <ActivityFeed
            title="Recent Team Activity"
            activities={mockActivities}
          />
        </div>
      </div>
    </MainLayout>
  );
}