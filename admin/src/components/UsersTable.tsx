"use client";

import React from 'react';
import { Search, ChevronLeft, ChevronRight } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

export type AdminUser = {
  id: string;
  name: string;
  company: string;
  avatarUrl?: string;
  createdDate: string; // e.g., May 1, 2024
  createdTime: string; // e.g., 08:00 AM
  plan: string; // Entrepreneur | Business | Corporate | Free
  country: string; // e.g., USA
  region: string; // e.g., Florida
};

interface UsersTableProps {
  users: AdminUser[];
}

export default function UsersTable({ users }: UsersTableProps) {
  const [query, setQuery] = React.useState('');
  const [page, setPage] = React.useState(1);
  const pageSize = 10;

  const filtered = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return users;
    return users.filter((u) =>
      [u.name, u.company, u.plan, u.country, u.region]
        .join(' ')
        .toLowerCase()
        .includes(q)
    );
  }, [query, users]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const startIndex = (safePage - 1) * pageSize;
  const pageItems = filtered.slice(startIndex, startIndex + pageSize);

  React.useEffect(() => {
    // If the filter reduces the set, keep page in range
    setPage(1);
  }, [query]);

  const handlePrev = () => setPage((p) => Math.max(1, p - 1));
  const handleNext = () => setPage((p) => Math.min(totalPages, p + 1));

  const renderAvatar = (u: AdminUser) => {
    if (u.avatarUrl) {
      return (
        <img
          src={u.avatarUrl}
          alt={u.name}
          className="w-8 h-8 rounded-full object-cover"
        />
      );
    }
    const initials = u.name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .slice(0, 2)
      .toUpperCase();
    return (
      <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-xs font-semibold">
        {initials}
      </div>
    );
  };

  return (
    <div className="bg-white rounded-lg border border-gray-200">
      {/* Header */}
      <div className="px-6 py-4 flex items-center gap-4">
        <h2 className="text-lg font-semibold text-gray-900">Users</h2>
        <div className="mx-auto w-full max-w-md relative">
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search"
            className="pl-10 rounded-full h-9"
          />
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        </div>
        <button className="text-sm text-blue-600 hover:text-blue-700 font-medium">
          See All
        </button>
      </div>

      {/* List header (spacer) */}
      <div className="px-6">
        <div className="grid grid-cols-[1.4fr_1fr_1fr_1fr_auto] py-2 text-xs text-gray-400">
          <div></div>
          <div></div>
          <div></div>
          <div></div>
          <div></div>
        </div>
      </div>

      {/* Rows */}
      <ul className="divide-y divide-gray-100">
        {pageItems.map((u) => (
          <li key={u.id} className="px-6 py-3">
            <div className="grid grid-cols-[1.4fr_1fr_1fr_1fr_auto] items-center gap-4">
              {/* Name + company */}
              <div className="flex items-center gap-3 min-w-0">
                {renderAvatar(u)}
                <div className="min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">{u.name}</p>
                  <p className="text-xs text-gray-500 truncate">{u.company}</p>
                </div>
              </div>

              {/* Date/time */}
              <div>
                <p className="text-sm font-medium text-gray-900">{u.createdDate}</p>
                <p className="text-xs text-gray-500">{u.createdTime}</p>
              </div>

              {/* Plan */}
              <div>
                <p className="text-sm font-medium text-gray-900">{u.plan}</p>
                <p className="text-xs text-gray-500">Plan</p>
              </div>

              {/* Country/Region */}
              <div>
                <p className="text-sm font-medium text-gray-900">{u.country}</p>
                <p className="text-xs text-gray-500">{u.region}</p>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-2 justify-end">
                <Button variant="outline" size="sm" className="rounded-full px-4 h-8">Modify</Button>
                <Button variant="outline" size="sm" className="rounded-full px-4 h-8">View</Button>
              </div>
            </div>
          </li>
        ))}
      </ul>

      {/* Footer / Pagination */}
      <div className="px-6 py-3 flex items-center justify-end gap-6 text-xs text-gray-500">
        <div className="mr-auto">Items per pages: <span className="text-gray-900">10</span></div>
        <div>
          {startIndex + 1}-{Math.min(startIndex + pageSize, filtered.length)} of {filtered.length}
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={handlePrev}
            disabled={safePage === 1}
            className="p-1 rounded hover:bg-gray-100 disabled:opacity-40"
            aria-label="Previous"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <button
            onClick={handleNext}
            disabled={safePage === totalPages}
            className="p-1 rounded hover:bg-gray-100 disabled:opacity-40"
            aria-label="Next"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

