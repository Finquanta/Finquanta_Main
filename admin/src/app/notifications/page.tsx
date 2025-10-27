"use client";

import React from 'react';
import MainLayout from '@/components/MainLayout';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Search, ChevronLeft, ChevronRight } from 'lucide-react';

interface NotificationItem {
  id: number;
  title: string;
  description: string;
}

const BASE_NOTIFICATIONS: NotificationItem[] = [
  { id: 1, title: 'System Updates', description: 'Receive updates about new features and changes.' },
  { id: 2, title: 'Account Security', description: 'Alerts for suspicious logins or password changes.' },
  { id: 3, title: 'Failed Payments', description: 'Notifies you when a payment attempt fails.' },
  { id: 4, title: 'Subscription Changes', description: 'Updates when plans are upgraded or downgraded.' },
  { id: 5, title: 'New Signups', description: 'Be alerted when new users join your organization.' },
  { id: 6, title: 'Data Exports', description: 'Get notified when your export is ready to download.' },
  { id: 7, title: 'Reports Ready', description: 'Receive a notice when scheduled reports are available.' },
  { id: 8, title: 'API Usage', description: 'Threshold alerts for API consumption and limits.' },
  { id: 9, title: 'Messages', description: 'Notifications for new messages and mentions.' },
  { id: 10, title: 'Maintenance Notices', description: 'Planned downtime and maintenance alerts.' },
];

// Extend to demonstrate pagination like the design
const ALL_NOTIFICATIONS: NotificationItem[] = Array.from({ length: 30 }, (_, i) => {
  if (i < BASE_NOTIFICATIONS.length) return BASE_NOTIFICATIONS[i];
  const idx = i + 1;
  return { id: idx, title: `Notification ${idx}`, description: 'Additional notification preference.' };
});

export default function NotificationsPage() {
  const [query, setQuery] = React.useState('');
  const [page, setPage] = React.useState(1);
  const pageSize = 10;

  const filtered = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return ALL_NOTIFICATIONS;
    return ALL_NOTIFICATIONS.filter((n) => (n.title + ' ' + n.description).toLowerCase().includes(q));
  }, [query]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const startIndex = (safePage - 1) * pageSize;
  const pageItems = filtered.slice(startIndex, startIndex + pageSize);

  React.useEffect(() => { setPage(1); }, [query]);

  const handlePrev = () => setPage((p) => Math.max(1, p - 1));
  const handleNext = () => setPage((p) => Math.min(totalPages, p + 1));

  return (
    <MainLayout>
      <div className="p-6">
        <div className="bg-white rounded-lg border border-gray-200">
          {/* Header */}
          <div className="px-6 py-4 flex items-center gap-4">
            <h2 className="text-lg font-semibold text-gray-900">Notifications</h2>
            <div className="mx-auto w-full max-w-md relative">
              <Input value={query} onChange={(e)=>setQuery(e.target.value)} placeholder="Search" className="pl-10 rounded-full h-9" />
              <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            </div>
            <button className="text-sm text-blue-600 hover:text-blue-700 font-medium">See All</button>
          </div>

          {/* Rows */}
          <ul className="divide-y divide-gray-100">
            {pageItems.map((n) => (
              <li key={n.id} className="px-6 py-3">
                <div className="grid grid-cols-[1fr_auto] items-center gap-4">
                  <div>
                    <p className="text-sm font-semibold text-gray-900">{n.title}</p>
                    <p className="text-xs text-gray-500">{n.description}</p>
                  </div>
                  <div className="flex items-center gap-2 justify-end">
                    <Button variant="outline" size="sm" className="rounded-full px-4 h-8">Enable</Button>
                    <Button variant="outline" size="sm" className="rounded-full px-4 h-8">Disable</Button>
                    <Button variant="outline" size="sm" className="rounded-full px-4 h-8">View</Button>
                  </div>
                </div>
              </li>
            ))}
          </ul>

          {/* Footer / Pagination */}
          <div className="px-6 py-3 flex items-center justify-end gap-6 text-xs text-gray-500">
            <div className="mr-auto">Item per pages: <span className="text-gray-900">10</span></div>
            <div>{filtered.length === 0 ? '0-0 of 0' : `${startIndex + 1}-${Math.min(startIndex + pageSize, filtered.length)} of ${filtered.length}`}</div>
            <div className="flex items-center gap-1">
              <button onClick={handlePrev} disabled={safePage===1} className="p-1 rounded hover:bg-gray-100 disabled:opacity-40" aria-label="Previous">
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button onClick={handleNext} disabled={safePage===totalPages} className="p-1 rounded hover:bg-gray-100 disabled:opacity-40" aria-label="Next">
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </MainLayout>
  );
}
