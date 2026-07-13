"use client";

import { useState } from "react";
import { Menu } from "lucide-react";
import { useTheme } from "@/hooks/context/ThemeContext";
import DashboardSidebar from "./DashboardSidebar";
import ReferralIdChip from "./ReferralIdChip";

/**
 * Page shell for the dashboard section: keeps the sidebar on screen so it never
 * disappears when you move into Invoices or Customers. Wrap a page's content in
 * this and it gets the sidebar plus a hamburger on tablet/mobile.
 */
export default function DashboardShell({ children }: { children: React.ReactNode }) {
  const { theme } = useTheme();
  const isDark = theme === "dark";
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className={`flex h-screen ${isDark ? "bg-gray-900" : "bg-gray-50"}`}>
      <DashboardSidebar isDark={isDark} isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top bar: hamburger on small screens, and the Finquanta ID chip — the
            same one the dashboard has, so the referral link is always one click
            away wherever you are. */}
        <div className={`flex items-center justify-between px-4 py-3 border-b ${isDark ? "bg-gray-800 border-gray-700" : "bg-white border-gray-200"}`}>
          <button
            onClick={() => setSidebarOpen(true)}
            className={`lg:hidden p-2 rounded-lg border ${isDark ? "border-gray-600 text-gray-200" : "border-gray-300 text-gray-700"}`}
            aria-label="Open menu"
          >
            <Menu className="h-5 w-5" />
          </button>
          <div className="ml-auto">
            <ReferralIdChip isDark={isDark} />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">{children}</div>
      </div>
    </div>
  );
}
