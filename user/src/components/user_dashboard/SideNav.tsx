'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
// import DashboardIcon from '@/components/icons/DashboardIcon';
import PieChartIcon from '@/components/icons/PieChartIcon';
import CandlestickIcon from '@/components/icons/CandlestickIcon';
import FileTextIcon from '@/components/icons/FileTextIcon';
import FileDownloadIcon from '@/components/icons/FileDownloadIcon';
import WalletIcon from '@/components/icons/WalletIcon';
import InboxIcon from '@/components/icons/InboxIcon';
import SettingsIcon from '@/components/icons/SettingsIcon';
import InfoIcon from '@/components/icons/InfoIcon';
import SecurityIcon from '@/components/icons/SecurityIcon';

const navigationItems = [
  // { name: 'Dashboard', href: '/dashboard', icon: DashboardIcon },
  { name: 'Portfolio overview', href: '/dashboard', icon: PieChartIcon },
  { name: 'Statistics', href: '/statistics', icon: CandlestickIcon },
  { name: 'Documents', href: '/documents', icon: FileTextIcon },
  { name: 'Business plan', href: '/business-plan', icon: FileDownloadIcon },
  { name: 'Payroll', href: '/payroll', icon: WalletIcon },
  { name: 'Inbox', href: '/inbox', icon: InboxIcon },
];

const bottomItems = [
  { name: 'Profile Settings', href: '/settings', icon: SettingsIcon },
  { name: 'Information', href: '/information', icon: InfoIcon },
  { name: 'Security terms', href: '/security', icon: SecurityIcon },
];

export default function SideNav() {
  const pathname = usePathname();

  const isActive = (href: string) => {
    if (href === '/dashboard') {
      return pathname === '/dashboard' || pathname === '/';
    }
    return pathname.startsWith(href);
  };

  return (
    <div className="w-[275px] bg-white flex flex-col min-h-screen">
      {/* Logo/Title */}
      <div className="p-6">
        <h1 className="text-2xl font-bold text-[#150578]">Fund Flow AI</h1>
      </div>

      {/* Main Navigation */}
      <nav className="flex-1 px-4 py-6">
        <ul className="space-y-2">
          {navigationItems.map((item) => {
            const Icon = item.icon;
            const active = isActive(item.href);
            
            return (
              <li key={item.name}>
                <Link
                  href={item.href}
                  className={`flex items-center px-3 py-2 text-lg font-medium transition-colors ${
                    active
                      ? 'text-[#ff8600]'
                      : 'text-[#150578] hover:text-[#150578]/80'
                  }`}
                >
                  <Icon width={24} height={24} color={active ? '#ff8600' : '#150578'} className="mr-2" />
                  {item.name}
                </Link>
              </li>
            );
          })}
        </ul>
        
        {/* Inbox notification badge */}
        <div className="relative ml-7 -mt-6">
          <span className="absolute bg-[#150578] text-white text-xs rounded-full w-4 h-4 flex items-center justify-center">
            3
          </span>
        </div>
      </nav>

      {/* Bottom Navigation */}
      <div className="px-4 py-6">
        <ul className="space-y-5">
          {bottomItems.map((item) => {
            const Icon = item.icon;
            const active = isActive(item.href);
            const isProfileSettings = item.name === 'Profile Settings';
            
            return (
              <li key={item.name}>
                <Link
                  href={item.href}
                  className={`flex items-center px-3 py-2 text-lg font-medium transition-colors ${
                    active ? 'text-[#ff8600]' : ''
                  }`}
                  style={{ color: active ? '#ff8600' : "" }}
                >
                  <Icon width={24} height={24} color={active ? '#ff8600' : ""} className="mr-2" />
                  {item.name}
                </Link>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}