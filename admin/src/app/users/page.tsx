import React from 'react';
import MainLayout from '@/components/MainLayout';
import UsersTable, { AdminUser } from '@/components/UsersTable';

const mockUsers: AdminUser[] = Array.from({ length: 30 }).map((_, i) => {
  const plans = [
    { plan: 'Entrepreneur', country: 'USA', region: 'Florida' },
    { plan: 'Business', country: 'China', region: 'Hong Kong' },
    { plan: 'Corporate', country: 'India', region: 'Mumbai' },
    { plan: 'Free', country: 'Jamaica', region: 'Kingston' },
  ];
  const p = plans[i % plans.length];
  return {
    id: String(i + 1),
    name: 'Mickey Mike',
    company: 'MM Real Estate',
    createdDate: 'May 1, 2024',
    createdTime: '08:00 AM',
    plan: p.plan,
    country: p.country,
    region: p.region,
  } as AdminUser;
});

export default function UsersPage() {
  return (
    <MainLayout>
      <div className="p-6">
        <UsersTable users={mockUsers} />
      </div>
    </MainLayout>
  );
}
