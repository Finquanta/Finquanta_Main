"use client";

import { useEffect, useRef, useState } from "react";
import { Bell } from "lucide-react";
import { useLanguage } from "@/hooks/context/LanguageContext";
import {
  InboxItem, getNotifications, markAllNotificationsRead, markNotificationRead,
} from "@/lib/api/notifications";

/**
 * The notification bell from the dashboard's top bar, extracted so every tab
 * gets it.
 *
 * It previously existed only inline on the Dashboard page, so the bell — and
 * the unread count — vanished the moment you opened Invoices, Customers or any
 * other tab, which made the app look like two different products. This is the
 * shared implementation; DashboardShell renders it for every other tab.
 */
export default function NotificationBell({ isDark }: { isDark: boolean }) {
  const { t } = useLanguage();
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<InboxItem[]>([]);
  const ref = useRef<HTMLDivElement | null>(null);

  const unread = items.filter((n) => !n.read).length;

  useEffect(() => {
    getNotifications().then(setItems).catch(() => setItems([]));
  }, []);

  // Close when clicking anywhere else, the way the dashboard's copy behaves.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  const markAllRead = async () => {
    // Update locally first so the badge clears immediately; a failed call just
    // means the next load shows them unread again, which is the safe direction.
    setItems((prev) => prev.map((n) => ({ ...n, read: true })));
    try { await markAllNotificationsRead(); } catch { /* refetched on next load */ }
  };

  const dismiss = async (id: string) => {
    setItems((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)));
    try { await markNotificationRead(id); } catch { /* refetched on next load */ }
  };

  const buttonBg = isDark
    ? "bg-gray-800 border-gray-600 text-gray-200 hover:bg-gray-700"
    : "bg-white border-gray-300 text-gray-700 hover:bg-gray-50";
  const panelBg = isDark ? "bg-gray-800 border-gray-700" : "bg-white border-gray-200";
  const itemBorder = isDark ? "border-gray-700" : "border-gray-200";
  const text = isDark ? "text-gray-300" : "text-gray-600";
  const subtext = isDark ? "text-gray-500" : "text-gray-400";

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={(e) => { e.stopPropagation(); setOpen((v) => !v); }}
        className={`relative p-2 rounded-lg border transition-colors ${buttonBg}`}
        aria-label={t("notifications", "title")}
      >
        <Bell className="h-4 w-4" />
        {unread > 0 && (
          <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] font-bold rounded-full w-4 h-4 flex items-center justify-center">
            {unread}
          </span>
        )}
      </button>

      {open && (
        <div className={`absolute right-0 mt-2 w-80 rounded-xl shadow-xl border z-50 overflow-hidden ${panelBg}`}>
          <div className={`flex items-center justify-between px-4 py-3 border-b ${itemBorder}`}>
            <span className={`text-sm font-semibold ${isDark ? "text-white" : "text-gray-900"}`}>
              {t("notifications", "title")}
            </span>
            {unread > 0 && (
              <button onClick={markAllRead} className="text-xs text-blue-500 hover:underline">
                {t("notifications", "markAllRead")}
              </button>
            )}
          </div>

          <div className="max-h-72 overflow-y-auto">
            {items.length === 0 ? (
              <p className={`text-xs text-center py-6 ${text}`}>
                {t("notifications", "noNotifications")}
              </p>
            ) : (
              items.map((n) => (
                <div
                  key={n.id}
                  onClick={() => dismiss(n.id)}
                  className={`flex items-start gap-3 px-4 py-3 border-b transition-colors cursor-pointer ${itemBorder} ${
                    !n.read ? (isDark ? "bg-gray-700/50" : "bg-blue-50") : ""
                  }`}
                >
                  <div className={`mt-1.5 w-2 h-2 rounded-full flex-shrink-0 ${!n.read ? "bg-blue-500" : "bg-transparent"}`} />
                  <div className="flex-1 min-w-0">
                    <p className={`text-xs font-semibold ${isDark ? "text-white" : "text-gray-900"}`}>{n.title}</p>
                    <p className={`text-xs mt-0.5 whitespace-pre-wrap ${text}`}>{n.body}</p>
                    <p className={`text-[10px] mt-1 ${subtext}`}>{new Date(n.createdAt).toLocaleString()}</p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
