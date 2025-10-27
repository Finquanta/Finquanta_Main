'use client';

import React from 'react';
import { DataTable } from '@/components/widgets';
import { Badge } from '@/components/ui/badge';
import { SecurityEvent } from '../types';

interface SecurityEventsTableProps {
  events: SecurityEvent[];
}

export default function SecurityEventsTable({ events }: SecurityEventsTableProps) {
  const columns = [
    {
      key: 'timestamp',
      label: 'Time',
      sortable: true,
      render: (value: string) => new Date(value).toLocaleString()
    },
    {
      key: 'type',
      label: 'Type',
      render: (value: string) => (
        <Badge variant="outline">{value}</Badge>
      )
    },
    {
      key: 'severity',
      label: 'Severity',
      render: (value: string) => {
        const colors = {
          low: 'bg-green-100 text-green-800',
          medium: 'bg-yellow-100 text-yellow-800',
          high: 'bg-orange-100 text-orange-800',
          critical: 'bg-red-100 text-red-800'
        };
        return (
          <Badge className={colors[value as keyof typeof colors]}>
            {value}
          </Badge>
        );
      }
    },
    {
      key: 'description',
      label: 'Description'
    },
    {
      key: 'ip',
      label: 'IP Address'
    },
    {
      key: 'user',
      label: 'User'
    },
    {
      key: 'status',
      label: 'Status',
      render: (value: string) => (
        <Badge variant={value === 'resolved' ? 'default' : 'secondary'}>
          {value}
        </Badge>
      )
    }
  ];

  const bulkActions = [
    {
      label: 'Mark Resolved',
      action: (selected: string[]) => console.log('Mark resolved:', selected)
    },
    {
      label: 'Investigate',
      action: (selected: string[]) => console.log('Investigate:', selected)
    }
  ];

  return (
    <DataTable
      title="Security Events"
      columns={columns}
      data={events}
      searchable={true}
      bulkActions={bulkActions}
    />
  );
}