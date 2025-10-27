'use client';

import React from 'react';
import { ChevronDown } from 'lucide-react';

interface FilterDropdownProps {
  value: string;
  onChange: (value: string) => void;
  options?: string[];
}

export default function FilterDropdown({ 
  value, 
  onChange, 
  options = ['Last 30 days', 'Last 60 days', 'Last 90 days'] 
}: FilterDropdownProps) {
  return (
    <div className="relative inline-flex items-center px-3 py-2 text-sm text-gray-600 border-2 border-gray-200 rounded-xl hover:border-gray-300 transition-colors cursor-pointer">
      <span className="font-medium">{value}</span>
      <ChevronDown className="ml-2 h-4 w-4" />
    </div>
  );
}