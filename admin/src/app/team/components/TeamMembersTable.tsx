'use client';

import React from 'react';
import { DataTable } from '@/components/widgets';
import { Badge } from '@/components/ui/badge';
import { TeamMember } from '../types';

interface TeamMembersTableProps {
  members: TeamMember[];
}

export default function TeamMembersTable({ members }: TeamMembersTableProps) {
  const columns = [
    {
      key: 'name',
      label: 'Name',
      sortable: true
    },
    {
      key: 'email',
      label: 'Email'
    },
    {
      key: 'role',
      label: 'Role'
    },
    {
      key: 'department',
      label: 'Department'
    },
    {
      key: 'status',
      label: 'Status',
      render: (value: string) => {
        const colors = {
          active: 'bg-green-100 text-green-800',
          inactive: 'bg-gray-100 text-gray-800',
          'on-leave': 'bg-yellow-100 text-yellow-800'
        };
        return (
          <Badge className={colors[value as keyof typeof colors]}>
            {value}
          </Badge>
        );
      }
    },
    {
      key: 'performanceScore',
      label: 'Performance',
      render: (value: number) => `${value}/100`
    },
    {
      key: 'lastActive',
      label: 'Last Active',
      render: (value: string) => new Date(value).toLocaleDateString()
    }
  ];

  return (
    <DataTable
      title="Team Members"
      columns={columns}
      data={members}
      searchable={true}
      filterable={true}
    />
  );
}