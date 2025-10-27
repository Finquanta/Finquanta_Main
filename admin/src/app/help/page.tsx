'use client';

import React from 'react';
import MainLayout from '@/components/MainLayout';
import HelpMetrics from './components/HelpMetrics';
import { DataTable, ChartWidget, QuickActions } from '@/components/widgets';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { HelpMetrics as HelpMetricsType, SupportTicket, KnowledgeArticle } from './types';
import { Plus, Edit, Eye } from 'lucide-react';

// Mock data
const mockMetrics: HelpMetricsType = {
  openTickets: 18,
  avgResolutionTime: 4.2,
  satisfactionScore: 4.6,
  totalArticles: 45,
  ticketTrend: -12,
  resolutionTrend: -8,
  satisfactionTrend: 0.2,
  articleViews: 1250
};

const mockTickets: SupportTicket[] = [
  {
    id: '1',
    title: 'Login issue reported',
    description: 'User cannot access account',
    priority: 'high',
    status: 'open',
    assignee: 'John Doe',
    requester: 'user@example.com',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    id: '2',
    title: 'Feature request',
    description: 'Add export functionality',
    priority: 'medium',
    status: 'in-progress',
    requester: 'customer@example.com',
    createdAt: new Date(Date.now() - 86400000).toISOString(),
    updatedAt: new Date(Date.now() - 3600000).toISOString()
  }
];

const mockArticles: KnowledgeArticle[] = [
  {
    id: '1',
    title: 'Getting Started Guide',
    category: 'Onboarding',
    views: 234,
    lastUpdated: '2024-06-01',
    status: 'published'
  },
  {
    id: '2',
    title: 'Troubleshooting Login Issues',
    category: 'Support',
    views: 156,
    lastUpdated: '2024-06-10',
    status: 'published'
  }
];

export default function HelpPage() {
  const ticketColumns = [
    {
      key: 'title',
      label: 'Title',
      sortable: true
    },
    {
      key: 'priority',
      label: 'Priority',
      render: (value: string) => {
        const colors = {
          low: 'bg-gray-100 text-gray-800',
          medium: 'bg-blue-100 text-blue-800',
          high: 'bg-orange-100 text-orange-800',
          urgent: 'bg-red-100 text-red-800'
        };
        return (
          <Badge className={colors[value as keyof typeof colors]}>
            {value}
          </Badge>
        );
      }
    },
    {
      key: 'status',
      label: 'Status',
      render: (value: string) => {
        const colors = {
          open: 'bg-red-100 text-red-800',
          'in-progress': 'bg-yellow-100 text-yellow-800',
          resolved: 'bg-green-100 text-green-800',
          closed: 'bg-gray-100 text-gray-800'
        };
        return (
          <Badge className={colors[value as keyof typeof colors]}>
            {value}
          </Badge>
        );
      }
    },
    {
      key: 'assignee',
      label: 'Assignee'
    },
    {
      key: 'requester',
      label: 'Requester'
    },
    {
      key: 'createdAt',
      label: 'Created',
      render: (value: string) => new Date(value).toLocaleDateString()
    }
  ];

  const articleColumns = [
    {
      key: 'title',
      label: 'Title',
      sortable: true
    },
    {
      key: 'category',
      label: 'Category'
    },
    {
      key: 'views',
      label: 'Views',
      sortable: true
    },
    {
      key: 'status',
      label: 'Status',
      render: (value: string) => (
        <Badge variant={value === 'published' ? 'default' : 'secondary'}>
          {value}
        </Badge>
      )
    },
    {
      key: 'lastUpdated',
      label: 'Last Updated',
      render: (value: string) => new Date(value).toLocaleDateString()
    }
  ];

  const quickActions = [
    {
      id: 'create-article',
      label: 'Create Article',
      action: () => console.log('Create article'),
      icon: <Plus className="w-4 h-4 mr-2" />
    },
    {
      id: 'manage-templates',
      label: 'Manage Templates',
      action: () => console.log('Manage templates'),
      icon: <Edit className="w-4 h-4 mr-2" />
    }
  ];

  const chartData = [
    { date: 'Mon', value: 12 },
    { date: 'Tue', value: 15 },
    { date: 'Wed', value: 8 },
    { date: 'Thu', value: 18 },
    { date: 'Fri', value: 14 },
    { date: 'Sat', value: 6 },
    { date: 'Sun', value: 4 }
  ];

  return (
    <MainLayout>
      <div className="p-6 bg-gray-50 min-h-screen">
        <h1 className="text-2xl font-bold mb-6">Help</h1>

        <HelpMetrics metrics={mockMetrics} />

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 mb-6">
          <div className="lg:col-span-3">
            <DataTable
              title="Knowledge Base"
              columns={articleColumns}
              data={mockArticles}
              searchable={true}
              bulkActions={[
                {
                  label: 'Edit',
                  action: (selected: string[]) => console.log('Edit:', selected)
                }
              ]}
            />
          </div>
          <div>
            <QuickActions actions={quickActions} />
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <DataTable
            title="Support Tickets"
            columns={ticketColumns}
            data={mockTickets}
            searchable={true}
            bulkActions={[
              {
                label: 'Assign to Me',
                action: (selected: string[]) => console.log('Assign:', selected)
              },
              {
                label: 'Mark Resolved',
                action: (selected: string[]) => console.log('Resolve:', selected)
              }
            ]}
          />
          <ChartWidget
            title="Help Center Analytics"
            data={chartData}
            type="line"
          />
        </div>
      </div>
    </MainLayout>
  );
}
