"use client";

import React from 'react';
import MainLayout from '@/components/MainLayout';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Search, ChevronLeft, ChevronRight } from 'lucide-react';

interface FeatureItem {
  id: number;
  title: string;
  description: string;
}

const BASE_FEATURES: FeatureItem[] = [
  { id: 1, title: 'Business Plan Creation', description: 'Develops comprehensive business strategies.' },
  { id: 2, title: 'Business Plan Validation', description: 'Evaluates and refines business strategies.' },
  { id: 3, title: 'Accounting', description: 'Manages financial records and transactions.' },
  { id: 4, title: 'Taxes', description: 'Automates tax calculations and filings.' },
  { id: 5, title: 'Accounts Receivable', description: 'Manages and collects incoming payments.' },
  { id: 6, title: 'Business Correspondence', description: 'Handles professional communication.' },
  { id: 7, title: 'Processing Payroll', description: 'Calculates and processes employee salaries.' },
  { id: 8, title: 'Financial Statements', description: 'Prepares detailed financial reports.' },
  { id: 9, title: 'Financial Administration', description: 'Oversees overall financial management.' },
  { id: 10, title: 'Legal Contract Creation', description: 'Drafts legally sound contracts.' },
];

// Extend to 30 items to demonstrate pagination
const ALL_FEATURES: FeatureItem[] = Array.from({ length: 30 }, (_, i) => {
  if (i < BASE_FEATURES.length) return BASE_FEATURES[i];
  const idx = i + 1;
  return {
    id: idx,
    title: `Feature ${idx}`,
    description: 'Additional administrative capability.',
  };
});

export default function FeaturesPage() {
  const [query, setQuery] = React.useState('');
  const [page, setPage] = React.useState(1);
  const pageSize = 10;

  const filtered = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return ALL_FEATURES;
    return ALL_FEATURES.filter((f) =>
      (f.title + ' ' + f.description).toLowerCase().includes(q)
    );
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
          {/* Header with title, centered search, See All */}
          <div className="px-6 py-4 flex items-center gap-4">
            <h2 className="text-lg font-semibold text-gray-900">Features</h2>
            <div className="mx-auto w-full max-w-md relative">
              <Input value={query} onChange={(e)=>setQuery(e.target.value)} placeholder="Search" className="pl-10 rounded-full h-9" />
              <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            </div>
            <button className="text-sm text-blue-600 hover:text-blue-700 font-medium">See All</button>
          </div>

          {/* Rows */}
          <ul className="divide-y divide-gray-100">
            {pageItems.map((f) => (
              <li key={f.id} className="px-6 py-3">
                <div className="grid grid-cols-[1fr_auto] gap-4 items-center">
                  {/* Title + description */}
                  <div>
                    <p className="text-sm font-semibold text-gray-900">{f.title}</p>
                    <p className="text-xs text-gray-500">{f.description}</p>
                  </div>
                  {/* Actions */}
                  <div className="flex items-center gap-2 justify-end">
                    <Button variant="outline" size="sm" className="rounded-full px-4 h-8">Enable</Button>
                    <Button variant="outline" size="sm" className="rounded-full px-4 h-8">Disable</Button>
                    <Button variant="outline" size="sm" className="rounded-full px-4 h-8">View</Button>
                  </div>
                </div>
              </li>
            ))}
          </ul>

          {/* Footer */}
          <div className="px-6 py-3 flex items-center justify-end gap-6 text-xs text-gray-500">
            <div className="mr-auto">Item per pages: <span className="text-gray-900">10</span></div>
            <div>
              {filtered.length === 0 ? '0-0 of 0' : `${startIndex + 1}-${Math.min(startIndex + pageSize, filtered.length)} of ${filtered.length}`}
            </div>
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
