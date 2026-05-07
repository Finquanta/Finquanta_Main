"use client";
import { useState } from 'react';
import Link from 'next/link';
import BookkeepingModal from '@/components/user_dashboard/bookkeeping/BookkeepingModal';
import GoalModal from '@/components/user_dashboard/dashboard/GoalModal';

export default function DashboardPage() {
  const [darkMode, setDarkMode] = useState(false);
const [bookkeepingModalOpen, setBookkeepingModalOpen] = useState(false);
const [goalModalOpen, setGoalModalOpen] = useState(false);

  const bg = darkMode ? "bg-gray-900" : "bg-gray-50";
  const sidebar = darkMode ? "bg-gray-800 border-gray-700" : "bg-white border-gray-200";
  const card = darkMode ? "bg-gray-800 text-white" : "bg-white text-gray-900";
  const topbar = darkMode ? "bg-gray-800 border-gray-700" : "bg-white border-gray-200";
  const text = darkMode ? "text-gray-300" : "text-gray-500";
  const subtext = darkMode ? "text-gray-400" : "text-gray-400";
  const input = darkMode ? "bg-gray-700 border-gray-600 text-white placeholder-gray-400" : "bg-white border-gray-200 text-gray-900";
  const tableRow = darkMode ? "divide-gray-700 text-gray-300" : "divide-gray-50 text-gray-600";
  const tableHead = darkMode ? "text-gray-500 border-gray-700" : "text-gray-400 border-gray-200";

  return (
    <div className={`flex h-screen ${bg}`}>
      {/* Sidebar */}
      <div className={`w-48 ${sidebar} border-r flex flex-col py-6 px-4`}>
        <div className="mb-8">
          <img src="/images/finquanta_logo.svg" alt="Finquanta" className="w-28 h-auto" />
        </div>
        <nav className="flex flex-col gap-2">
          <Link href="/dashboard" className="text-sm font-semibold text-orange-500 bg-orange-50 px-3 py-2 rounded-lg">
            Dashboard
          </Link>
        </nav>
        <div className="mt-auto flex flex-col gap-2 text-xs text-gray-500">
          <Link href="/profile-settings" className={`hover:underline ${text}`}>Profile Settings</Link>
          <Link href="/terms" className={`hover:underline ${text}`}>Terms of Service</Link>
          <Link href="/privacy" className={`hover:underline ${text}`}>Privacy Policy</Link>
          <p className={`mt-4 ${subtext}`}>Version 1.0.0.0</p>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top Bar */}
        <div className={`${topbar} border-b px-6 py-3 flex items-center justify-between`}>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-gray-300 rounded-full"></div>
              <span className={`text-sm font-medium ${darkMode ? "text-white" : "text-gray-800"}`}>User</span>
            </div>
            <span className={`text-sm ${text}`}>Bank account</span>
          </div>
          <div className="flex items-center gap-4">
            <input type="text" placeholder="Search" className={`border rounded-lg px-3 py-1 text-sm w-48 ${input}`} />
            <button
              onClick={() => setDarkMode(!darkMode)}
              className={`px-3 py-1 rounded-lg text-xs font-medium border ${darkMode ? "bg-gray-700 text-white border-gray-600" : "bg-gray-100 text-gray-700 border-gray-200"}`}
            >
              {darkMode ? "☀️ Light" : "🌙 Dark"}
            </button>
          </div>
        </div>

        {/* Dashboard Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {/* Summary Cards */}
          <div className="grid grid-cols-3 gap-4 mb-6">
            {[
              { label: "Balance", value: "$0.00" },
              { label: "Cashflow", value: "$0.00" },
              { label: "Expense", value: "$0.00" },
            ].map((item, i) => (
              <div key={i} className={`${card} rounded-xl p-4 shadow-sm`}>
                <p className={`text-xs mb-1 ${text}`}>{item.label}</p>
                <p className="text-2xl font-bold">{item.value}</p>
              </div>
            ))}
          </div>

          {/* Bookkeeping Table */}
          <div className={`${card} rounded-xl p-4 shadow-sm mb-6`}>
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-sm font-semibold">Bookkeeping</h2>
              <div className="flex items-center gap-2">
                <span className={`text-xs ${text}`}>Last 30 days</span>
                <button onClick={() => setBookkeepingModalOpen(true)} className="bg-blue-500 text-white text-xs px-3 py-1 rounded-lg">Add Data</button>
              </div>
            </div>
            <table className="w-full text-xs">
              <thead>
                <tr className={`${tableHead} border-b`}>
                  <th className="text-left pb-2">Date</th>
                  <th className="text-left pb-2">Type</th>
                  <th className="text-left pb-2">Detail</th>
                  <th className="text-left pb-2">Price</th>
                  <th className="text-left pb-2">Amount</th>
                </tr>
              </thead>
              <tbody className={`divide-y ${tableRow}`}>
                <tr>
                  <td colSpan={5} className={`py-6 text-center ${text}`}>No transactions yet</td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Bottom Row */}
          <div className="grid grid-cols-2 gap-4">
            {/* Total Revenue */}
            <div className={`${card} rounded-xl p-4 shadow-sm`}>
              <h2 className="text-sm font-semibold mb-1">Total Revenue</h2>
              <p className="text-xl font-bold mb-1">$0.00</p>
              <p className={`text-xs mb-4 ${text}`}>No data yet</p>
              <div className="h-24 flex items-end gap-1">
                {[0, 0, 0, 0, 0, 0, 0].map((h, i) => (
                  <div key={i} className={`flex-1 ${darkMode ? "bg-gray-700" : "bg-gray-100"} rounded-t`} style={{ height: "10%" }}></div>
                ))}
              </div>
            </div>

            {/* Goals */}
            <div className={`${card} rounded-xl p-4 shadow-sm`}>
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-sm font-semibold">Goals</h2>
                <button onClick={() => setGoalModalOpen(true)} className="bg-blue-500 text-white text-xs px-3 py-1 rounded-lg">Add Goal</button>
              </div>
              <p className={`text-xs text-center py-6 ${text}`}>No goals added yet</p>
            </div>
          </div>
        </div>
      </div>
    <BookkeepingModal isOpen={bookkeepingModalOpen} onClose={() => setBookkeepingModalOpen(false)} />
      <GoalModal isOpen={goalModalOpen} onClose={() => setGoalModalOpen(false)} />
    </div>
  );
}