import React from 'react';
import SideNav from '@/components/user_dashboard/SideNav';
import TopBar from '@/components/user_dashboard/TopBar';
import ProtectedRoute from '@/components/auth/ProtectedRoute';

export default function UserDashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ProtectedRoute requireAuth={true} redirectTo="/login">
      <div className="flex h-screen bg-[#f2f3f4]">
        <SideNav />
        <div className="flex-1 flex flex-col overflow-hidden">
          <TopBar />
          <main className="flex-1 overflow-auto">
            {children}
          </main>
        </div>
      </div>
    </ProtectedRoute>
  );
}
