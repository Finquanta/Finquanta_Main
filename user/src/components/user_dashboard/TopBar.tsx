'use client';

import React from 'react';
import Image from 'next/image';
import { Search, Bell, ChevronDown, ArrowRight } from 'lucide-react';

export default function TopBar() {
  return (
    <header className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
      {/* Left Side - User Info */}
      <div className="flex items-center space-x-4">
        <div className="flex items-center space-x-2">
          <div className="w-10 h-10 rounded-lg overflow-hidden">
          <Image
          src="/images/user-avatar.png"
          alt="Khalifa Hm profile"
          width={40}
            height={40}
              className="w-full h-full object-cover"
            />
          </div>
          <div className="flex flex-col">
            <span className="text-sm font-medium text-gray-900">Khalifa Hm</span>
            <span className="text-xs text-gray-500">Bank account **** 4256</span>
          </div>
          <ChevronDown className="h-4 w-4 text-gray-400" />
        </div>
      </div>

      {/* Right Side - Search, Notifications, Actions */}
      <div className="flex items-center space-x-4">
        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search"
            className="w-80 pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>

        {/* Notifications */}
        <div className="relative">
          <Bell className="h-5 w-5 text-gray-400 hover:text-gray-600 cursor-pointer" />
          <div className="absolute -top-1 -right-1 w-3 h-3 bg-orange-500 rounded-full"></div>
        </div>

        {/* Dark Mode Toggle */}
        <div className="flex items-center">
          <div className="relative inline-flex h-6 w-11 items-center rounded-full bg-gray-200 transition-colors focus:outline-none">
            <span className="inline-block h-4 w-4 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out translate-x-6" />
          </div>
        </div>

        {/* Right Arrow */}
        <ArrowRight className="h-5 w-5 text-gray-400 hover:text-gray-600 cursor-pointer" />
      </div>
    </header>
  );
}