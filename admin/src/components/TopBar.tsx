'use client';

import React from 'react';
import { useAppContext } from '@/hooks/useAppContext';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import ChevronDownIcon from './icons/ChevronDownIcon';
import BellIcon from './icons/BellIcon';
import SearchIcon from './icons/SearchIcon';
import SettingsIcon from './icons/SettingsIcon';

export default function TopBar() {
  const { user, isAuthenticated, notifications } = useAppContext();

  if (!isAuthenticated || !user) {
    return (
      <header className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between h-16">
        <div className="text-gray-500">Please sign in</div>
      </header>
    );
  }

  return (
    <header className="bg-white border-b border-gray-200 px-5 py-2 flex items-center justify-between h-16 rounded-2xl mx-4 my-2 shadow-sm">
      {/* Left Side - User Profile */}
      <div className="flex items-center">
        <div className="flex items-center gap-5">
          {/* User Profile Section */}
          <div className="flex items-center gap-5">
            <div className="flex items-center gap-5">
              <img 
                src={user.avatar} 
                alt={`${user.name} profile`} 
                className="w-10 h-10 rounded-lg object-cover"
              />
              <span 
                className="text-[#1b263b] font-semibold"
                style={{ 
                  fontFamily: 'Inter, sans-serif', 
                  fontSize: '18px', 
                  fontWeight: 600 
                }}
              >
                {user.name}
              </span>
              <ChevronDownIcon width={11} height={6} color="#778da9" />
            </div>
            
            {/* Notification Bell */}
            <div className="relative">
              <BellIcon width={24} height={24} color="#778da9" />
              {notifications > 0 && (
                <div className="absolute -top-1 -right-1 w-3 h-3 bg-orange-500 rounded-full"></div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Right Side - Search and Settings */}
      <div className="flex items-center gap-5">
        {/* Search Input */}
        <div className="relative">
          <div className="bg-[#f2f3f4] rounded-2xl px-5 py-3 flex items-center gap-4 w-[370px]">
            <span 
              className="text-[#778da9] flex-1"
              style={{ 
                fontFamily: 'Inter, sans-serif', 
                fontSize: '15px', 
                fontWeight: 500 
              }}
            >
              Search
            </span>
            <SearchIcon width={24} height={24} color="#778da9" />
          </div>
        </div>

        {/* Settings Toggle */}
        <div className="flex items-center">
          <SettingsIcon width={84} height={40} color="#778da9" />
        </div>
      </div>
    </header>
  );
}