'use client';

import React, { useState } from 'react';
import SideNav from '@/components/user_dashboard/SideNav';
import TopBar from '@/components/user_dashboard/TopBar';
import ProtectedRoute from '@/components/auth/ProtectedRoute';

export default function UserDashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  return (
    <ProtectedRoute requireAuth={true} redirectTo="/login">
      <div className="flex h-screen bg-[#f2f3f4] overflow-hidden">
        {/* Mobile Overlay */}
        {isMobileMenuOpen && (
          <div
            className="mobile-menu-overlay lg:hidden"
            onClick={() => setIsMobileMenuOpen(false)}
          />
        )}
        
        {/* SideNav - Desktop: Fixed, Mobile: Drawer */}
        <SideNav
          isOpen={isMobileMenuOpen}
          onClose={() => setIsMobileMenuOpen(false)}
        />
        
        <div className="flex-1 flex flex-col overflow-hidden w-full min-w-0 max-w-full">
          <TopBar onMenuClick={() => setIsMobileMenuOpen(true)} />
          <main className="flex-1 overflow-auto overflow-x-hidden max-w-full min-w-0">
            <div className="w-full min-w-0 max-w-full overflow-x-hidden">
              {children}
            </div>
          </main>
        </div>
      </div>
    </ProtectedRoute>
  );
}
