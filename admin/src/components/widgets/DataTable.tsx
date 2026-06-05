// src/components/widgets/DataTable.tsx
'use client';

import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

interface Column<T extends { id: string }> {
  key: string;
  label: string;
  sortable?: boolean;
  render?: (value: unknown, row: T) => React.ReactNode;
}

interface DataTableProps<T extends { id: string }> {
  title?: string;
  columns: Column<T>[];
  data: T[];
  searchable?: boolean;
  bulkActions?: Array<{
    label: string;
    action: (selected: string[]) => void;
  }>;
}

export default function DataTable<T extends { id: string }>({
  title,
  columns,
  data,
  searchable = false,
  bulkActions = []
}: DataTableProps<T>) {
  const [searchTerm, setSearchTerm] = useState('');
  const [selected, setSelected] = useState<string[]>([]);

  const filteredData = data.filter(row =>
    columns.some(col => {
      const value = col.render ? col.render(row[col.key as keyof T], row) : row[col.key as keyof T];
      return String(value).toLowerCase().includes(searchTerm.toLowerCase());
    })
  );

  return (
    <Card className="bg-white shadow-sm">
      {title && (
        <CardHeader>
          <CardTitle className="text-lg font-semibold">{title}</CardTitle>
        </CardHeader>
      )}
      <CardContent>
        {searchable && (
          <div className="mb-4">
            <Input
              placeholder="Search..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="max-w-sm"
            />
          </div>
        )}
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b">
                {bulkActions.length > 0 && (
                  <th className="text-left p-2">
                    <input
                      type="checkbox"
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelected(filteredData.map(row => row.id));
                        } else {
                          setSelected([]);
                        }
                      }}
                    />
                  </th>
                )}
                {columns.map(col => (
                  <th key={col.key} className="text-left p-2 font-medium text-gray-700">
                    {col.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filteredData.map(row => (
                <tr key={row.id} className="border-b hover:bg-gray-50">
                  {bulkActions.length > 0 && (
                    <td className="p-2">
                      <input
                        type="checkbox"
                        checked={selected.includes(row.id)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelected([...selected, row.id]);
                          } else {
                            setSelected(selected.filter(id => id !== row.id));
                          }
                        }}
                      />
                    </td>
                  )}
                  {columns.map(col => (
                    <td key={col.key} className="p-2">
                      {col.render ? col.render(row[col.key], row) : row[col.key]}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {bulkActions.length > 0 && selected.length > 0 && (
          <div className="mt-4 flex gap-2">
            {bulkActions.map((action, idx) => (
              <Button
                key={idx}
                size="sm"
                onClick={() => action.action(selected.filter(id =>
                  filteredData.find(row => row.id === id)
                ))}
              >
                {action.label}
              </Button>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}