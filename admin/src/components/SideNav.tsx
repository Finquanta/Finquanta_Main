'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAppContext } from '@/hooks/useAppContext';
import { Badge } from '@/components/ui/badge';
import { Mail } from 'lucide-react';

const navigationItems = [
  { name: 'Dashboard', href: '/' },
  { name: 'Users', href: '/users' },
  { name: 'Usage', href: '/usage' },
  { name: 'Finances', href: '/finances' },
  { name: 'Content', href: '/content' },
  { name: 'Features', href: '/features' },
  { name: 'Notifications', href: '/notifications' },
  { name: 'Reports', href: '/reports' },
  { name: 'Security', href: '/security' },
  { name: 'Team', href: '/team' },
  { name: 'Settings', href: '/settings' },
  { name: 'Help', href: '/help' },
];

export default function SideNav() {
  const pathname = usePathname();
  const { notifications } = useAppContext();

  const isActive = (href: string) => {
    if (href === '/') {
      return pathname === '/';
    }
    return pathname.startsWith(href);
  };

  return (
    <div className="w-[298px] bg-white flex flex-col min-h-screen rounded-r-[20px] shadow-sm">
      {/* Logo/Brand Section */}
      <div className="pt-[61px] pb-[40px] px-[55px]">
        <div className="flex items-center">
          <img 
            src="/images/fiscal-ai-logo.png" 
            alt="FISCAL AI" 
            className="h-9 w-auto"
          />
        </div>
      </div>

      {/* Inbox Section with Notification */}
      <div className="px-[54px] mb-8">
        <div className="flex items-center gap-2 relative">
          <Link
            href="/inbox"
            className="flex items-center gap-2 text-black font-medium text-lg hover:text-gray-700 transition-colors"
            style={{ fontFamily: 'Inter, sans-serif', fontSize: '18px', fontWeight: 500 }}
          >
            <span>Inbox</span>
            <Mail size={22} className="text-black" />
          </Link>
          {notifications > 0 && (
            <div className="absolute -top-1 left-12">
              <Badge 
                className="bg-black text-white text-xs rounded-full min-w-[16px] h-4 flex items-center justify-center px-1"
                style={{ fontSize: '9px', fontWeight: 500 }}
              >
                {notifications}
              </Badge>
            </div>
          )}
        </div>
      </div>

      {/* Main Navigation */}
      <nav className="flex-1 px-[54px]">
        <ul className="space-y-5">
          {navigationItems.map((item) => {
            const active = isActive(item.href);

            return (
              <li key={item.name}>
                <Link
                  href={item.href}
                  className={`block text-lg font-medium transition-colors ${
                    active
                      ? 'text-[#ff8600]'
                      : 'text-black hover:text-gray-700'
                  }`}
                  style={{ 
                    fontFamily: 'Inter, sans-serif', 
                    fontSize: '18px', 
                    fontWeight: 500 
                  }}
                >
                  {item.name}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </div>
  );
}