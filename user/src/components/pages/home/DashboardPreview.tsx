"use client";

import { useEffect, useRef, useState } from "react";
import {
  Bell, Camera, ChevronDown, Download, FileText, Globe, Inbox, LogOut, MessageSquare,
  PanelLeftClose, PanelLeftOpen, Pencil, Plus, Trash2,
} from "lucide-react";
import HealthScoreCard from "@/components/user_dashboard/health/HealthScoreCard";
import { DASHBOARD_NAV } from "@/components/user_dashboard/DashboardSidebar";
import { useLanguage, LANGUAGE_OPTIONS } from "@/hooks/context/LanguageContext";
import type { HealthScore } from "@/lib/api/health";
import { DASHBOARD_VERSION } from "@/lib/version";

/**
 * A live, scaled-down copy of the signed-in dashboard for the homepage hero.
 *
 * Not a screenshot: it is laid out at the dashboard's own desktop width with the
 * dashboard's classes, nav items (DASHBOARD_NAV), top bar and quick actions, and
 * the Financial Health Score is the product's real HealthScoreCard fed sample
 * data through its `source` prop — the same hook the Try-It Demo uses. So it
 * renders in the visitor's language and keeps up when those pieces change.
 *
 * The Light/Dark button and the sidebar toggle work, and the Health Score card
 * opens. Everything else is inert: nothing here calls an API. The whole thing is
 * hidden from assistive technology and kept out of the tab order, because it is
 * a picture of the product rather than a way to use it; the figure around it
 * carries the description.
 */

/** The width the dashboard is laid out at before it is scaled to fit. */
const BASE_WIDTH = 1280;
const BASE_HEIGHT = 820;

const PREVIEW_HEALTH: HealthScore = {
  ready: true,
  daysOfData: 30,
  daysRequired: 30,
  score: 82,
  trend: 4,
  ratios: [
    {
      key: "liquidity", name: "Current Ratio", label: "Liquidity", value: 2.4, format: "ratio", score: 90, trend: null,
      explanation: "", insight: "", insightParts: { key: "liqStrong", v: { assets: 48210, liabs: 20100 } },
    },
    {
      key: "profitability", name: "Net Profit Margin", label: "Profitability", value: 21.4, format: "percent", score: 84, trend: null,
      explanation: "", insight: "", insightParts: { key: "profStrong", v: { margin: 21 } },
    },
    {
      key: "debtRisk", name: "Debt-to-Equity", label: "Debt Risk", value: 0.35, format: "ratio", score: 88, trend: null,
      explanation: "", insight: "", insightParts: { key: "debtOk", v: { debt: 12000, equity: 34300 } },
    },
    {
      key: "cashFlow", name: "Operating Cash Flow Ratio", label: "Cash Flow", value: 68, format: "percent", score: 66, trend: null,
      explanation: "", insight: "", insightParts: { key: "cashCovers", v: { ocf: 24600, liabs: 20100 } },
    },
  ],
  summary: "",
  summaryParts: { band: "strong", bestKey: "liquidity", worstKey: "cashFlow", goalAligned: false },
  periodDays: 30,
};

/** Module-level so the card's effect sees one stable function and fetches once. */
const previewHealth = () => Promise.resolve(PREVIEW_HEALTH);

const ENTRIES: { daysAgo: number; kind: "cashflow" | "expense"; detail: string; group: string; color: string; amount: number }[] = [
  { daysAgo: 1, kind: "cashflow", detail: "Invoice INV-0002 paid", group: "Client work", color: "#10b981", amount: 1700 },
  { daysAgo: 2, kind: "cashflow", detail: "Shop sales", group: "Online shop", color: "#3b82f6", amount: 2080 },
  { daysAgo: 3, kind: "expense", detail: "Ads", group: "Marketing", color: "#f59e0b", amount: -450 },
  { daysAgo: 5, kind: "expense", detail: "Contractors", group: "Client work", color: "#10b981", amount: -2600 },
  { daysAgo: 10, kind: "cashflow", detail: "Design retainer", group: "Client work", color: "#10b981", amount: 4200 },
  { daysAgo: 12, kind: "expense", detail: "Software subscriptions", group: "Operations", color: "#8b5cf6", amount: -310 },
  { daysAgo: 14, kind: "expense", detail: "Studio rent", group: "Operations", color: "#8b5cf6", amount: -1200 },
];

/** A date `days` ago as the bookkeeping list writes it (YYYY-MM-DD, local time). */
const dateDaysAgo = (days: number) => {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

const money = (amount: number) =>
  `${amount < 0 ? "-" : "+"}$${Math.abs(amount).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export default function DashboardPreview() {
  const { t, language } = useLanguage();
  const frameRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState<number | null>(null);
  const [dark, setDark] = useState(false);
  const [collapsed, setCollapsed] = useState(false);

  // Fit the full-width layout into whatever space the hero gives it.
  useEffect(() => {
    const frame = frameRef.current;
    if (!frame) return;
    const update = () => setScale(frame.clientWidth / BASE_WIDTH);
    update();
    const observer = new ResizeObserver(update);
    observer.observe(frame);
    return () => observer.disconnect();
  }, []);

  // Clickable with a pointer, but never a tab stop — including buttons the
  // Health Score card renders later, when it opens.
  useEffect(() => {
    const content = contentRef.current;
    if (!content) return;
    const removeTabStops = () =>
      content
        .querySelectorAll<HTMLElement>("a, button, input, select, textarea, [tabindex]")
        .forEach((el) => el.setAttribute("tabindex", "-1"));
    removeTabStops();
    const observer = new MutationObserver(removeTabStops);
    observer.observe(content, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, []);

  /** A dashboard label, or English when a key doesn't exist. */
  const label = (ns: string, key: string, fallback: string) => {
    const value = t(ns, key);
    return !value || value.startsWith(`${ns}.`) ? fallback : value;
  };

  // The dashboard page's own palette, light and dark.
  const c = {
    page: dark ? "bg-gray-900" : "bg-white",
    sidebar: dark ? "bg-gray-800 border-gray-700" : "bg-gray-50 border-gray-200",
    topbar: dark ? "bg-gray-800 border-gray-700" : "bg-white border-gray-200",
    card: dark ? "bg-gray-800 text-white" : "bg-white text-gray-900 border border-gray-200",
    text: dark ? "text-gray-300" : "text-gray-700",
    subtext: dark ? "text-gray-400" : "text-gray-500",
    heading: dark ? "text-white" : "text-gray-900",
    button: dark ? "bg-gray-700 text-white border-gray-600" : "bg-gray-100 text-gray-900 border-gray-300",
    input: dark ? "bg-gray-700 border-gray-600 text-gray-400" : "bg-gray-50 border-gray-300 text-gray-400",
    navIdle: dark ? "text-gray-200" : "text-gray-700",
    row: dark ? "border-gray-700 text-gray-300" : "border-gray-100 text-gray-700",
  };

  const languageLabel = LANGUAGE_OPTIONS.find((option) => option.code === language)?.label ?? "English";

  return (
    <div
      ref={frameRef}
      className="relative w-full overflow-hidden rounded-xl"
      style={scale === null ? { aspectRatio: `${BASE_WIDTH} / ${BASE_HEIGHT}` } : { height: BASE_HEIGHT * scale }}
    >
      <div
        ref={contentRef}
        aria-hidden="true"
        className={`fq-preview absolute left-0 top-0 flex origin-top-left text-left transition-opacity duration-300 motion-reduce:transition-none ${c.page} ${scale === null ? "opacity-0" : "opacity-100"}`}
        style={{ width: BASE_WIDTH, height: BASE_HEIGHT, transform: `scale(${scale ?? 1})` }}
      >
        {/* Sidebar */}
        <aside className={`flex shrink-0 flex-col border-r py-6 ${c.sidebar} ${collapsed ? "w-[72px] px-4" : "w-48 px-4"}`}>
          <div className={`mb-8 flex ${collapsed ? "flex-col items-center gap-3" : "items-start justify-between gap-2"}`}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={collapsed ? "/favicon.svg" : "/images/finquanta_logo.svg"} alt="" className={collapsed ? "h-8 w-auto" : "h-auto w-28"} />
            <button
              type="button"
              onClick={() => setCollapsed((v) => !v)}
              className={`rounded-md p-1 ${c.text} ${dark ? "hover:bg-gray-700" : "hover:bg-gray-200"}`}
            >
              {collapsed ? <PanelLeftOpen className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
            </button>
          </div>

          <nav className="flex flex-col gap-1">
            {DASHBOARD_NAV.map((item) => {
              const active = item.href === "/dashboard";
              const Icon = item.icon;
              return (
                <span
                  key={item.href}
                  className={`flex items-center gap-2.5 rounded-lg text-[13px] ${collapsed ? "justify-center py-2.5" : "px-3 py-1.5"} ${active ? "bg-orange-50 font-semibold text-orange-500" : `font-medium ${c.navIdle}`}`}
                >
                  {Icon && <Icon className="h-4 w-4 shrink-0" />}
                  {!collapsed && (item.labelKey ? t("dashboard", item.labelKey) : item.label)}
                </span>
              );
            })}
          </nav>

          {!collapsed && (
            <div className="mt-auto flex flex-col gap-2 pt-6 text-xs">
              <span className={`w-full rounded-lg border px-3 py-1.5 text-center text-[13px] font-semibold ${dark ? "border-green-500 text-green-400" : "border-green-600 text-green-700"}`}>
                Upgrade Plan
              </span>
              <p className={`mt-4 ${c.subtext}`}>{t("dashboard", "version")} {DASHBOARD_VERSION}</p>
              <span className="mt-1 flex items-center gap-1.5 font-medium text-green-600">
                <MessageSquare className="h-3.5 w-3.5" />
                {t("dashboard", "sendFeedback")}
              </span>
              <span className="flex items-center gap-1.5 font-medium text-red-400">
                <LogOut className="h-3.5 w-3.5" />
                {t("settings", "logOut")}
              </span>
            </div>
          )}
        </aside>

        <div className="flex min-w-0 flex-1 flex-col">
          {/* Top bar */}
          <div className={`flex items-center justify-between gap-2 border-b px-6 py-3 ${c.topbar}`}>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <div className="h-8 w-8 rounded-full bg-gray-300" />
                <span className={`text-sm font-medium ${c.heading}`}>Maya Chen</span>
              </div>
              <span className={`flex items-center gap-1.5 rounded-lg border px-3 py-1 text-xs font-medium ${c.button}`}>
                Evergreen Studio
                <ChevronDown className="h-3 w-3" />
              </span>
            </div>
            <div className="flex items-center gap-3">
              <span className={`rounded-lg border p-2 ${c.button}`}>
                <Inbox className="h-4 w-4" />
              </span>
              <span className={`relative rounded-lg border p-2 ${c.button}`}>
                <Bell className="h-4 w-4" />
                <span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white">2</span>
              </span>
              <span className={`w-48 rounded-lg border px-3 py-1 text-sm ${c.input}`}>{t("dashboard", "search")}</span>
              <span className={`flex items-center gap-1 rounded-lg border px-3 py-1 text-xs font-medium ${c.button}`}>
                <Globe className="h-4 w-4" />
                {languageLabel}
                <ChevronDown className="h-3 w-3" />
              </span>
              <span className={`rounded-lg border px-3 py-1 text-xs font-medium ${c.button}`}>{t("dashboard", "finnaOn")}</span>
              <button type="button" onClick={() => setDark((v) => !v)} className={`rounded-lg border px-3 py-1 text-xs font-medium ${c.button}`}>
                {dark ? t("dashboard", "dark") : t("dashboard", "light")}
              </button>
              <span className="flex items-center gap-1.5 rounded-lg bg-red-500 px-3 py-1 text-xs font-medium text-white">
                <LogOut className="h-3.5 w-3.5" />
                {t("settings", "logOut")}
              </span>
            </div>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-hidden p-6">
            <div className="mb-3 flex items-center gap-2">
              {[
                { key: "allTime", active: true },
                { key: "last30Days", active: false },
                { key: "threeMonths", active: false },
                { key: "periodMonth", active: false },
              ].map((period) => (
                <span
                  key={period.key}
                  className={`rounded-lg px-3 py-1 text-xs font-medium ${period.active ? "bg-blue-500 text-white" : `border ${c.button}`}`}
                >
                  {t("dashboard", period.key)}
                </span>
              ))}
            </div>

            <div className="mb-4">
              <HealthScoreCard isDark={dark} source={previewHealth} />
            </div>

            <div className="mb-3 flex items-center justify-end gap-2">
              <span className="flex items-center gap-1.5 rounded-lg bg-blue-500 px-4 py-2 text-sm font-semibold text-white">
                <Plus className="h-4 w-4" />
                {t("dashboard", "dashAddData")}
              </span>
              <span className="flex items-center gap-1.5 rounded-lg bg-green-500 px-4 py-2 text-sm font-semibold text-white">
                <Download className="h-4 w-4" />
                {t("dashboard", "bxExport")}
              </span>
              <span className="flex items-center gap-1.5 rounded-lg bg-[#ff8600] px-4 py-2 text-sm font-semibold text-white">
                <FileText className="h-4 w-4" />
                {t("dashboard", "dashCreateInvoice")}
              </span>
              <span className="flex items-center gap-1.5 rounded-lg bg-purple-500 px-4 py-2 text-sm font-semibold text-white">
                <Camera className="h-4 w-4" />
                {t("dashboard", "captureScan")}
              </span>
            </div>

            <div className="mb-6 grid grid-cols-3 gap-4">
              {[
                { key: "balance", value: "$48,210.00" },
                { key: "cashflow", value: "$12,640.00" },
                { key: "expense", value: "$31,870.00" },
              ].map((card) => (
                <div key={card.key} className={`${c.card} rounded-xl p-4 shadow-sm`}>
                  <p className={`mb-1 text-xs ${c.text}`}>{t("dashboard", card.key)}</p>
                  <p className={`text-2xl font-bold ${c.heading}`}>{card.value}</p>
                </div>
              ))}
            </div>

            <div className={`${c.card} rounded-xl p-4 shadow-sm`}>
              <div className="mb-4 flex items-center justify-between">
                <h2 className={`text-sm font-semibold ${c.heading}`}>{t("dashboard", "bookkeeping")}</h2>
                <div className="flex items-center gap-2">
                  <span className={`text-xs ${c.text}`}>{t("dashboard", "last30Days")}</span>
                  <span className="rounded-lg bg-blue-500 px-3 py-1 text-xs text-white">{t("dashboard", "addData")}</span>
                  <span className="rounded-lg bg-green-500 px-3 py-1 text-xs text-white">{t("dashboard", "bxExport")}</span>
                </div>
              </div>
              <table className="w-full text-sm">
                <thead>
                  <tr className={`border-b text-left text-xs ${dark ? "border-gray-700 text-gray-400" : "border-gray-200 text-gray-600"}`}>
                    <th className="pb-2 font-semibold">{label("dashboard", "date", "Date")}</th>
                    <th className="pb-2 font-semibold">{label("dashboard", "type", "Type")}</th>
                    <th className="pb-2 font-semibold">{label("dashboard", "detail", "Detail")}</th>
                    <th className="pb-2 font-semibold">{label("dashboard", "group", "Group")}</th>
                    <th className="pb-2 font-semibold">{label("dashboard", "amount", "Amount")}</th>
                    <th className="pb-2" />
                  </tr>
                </thead>
                <tbody>
                  {ENTRIES.map((entry) => (
                    <tr key={entry.detail + entry.daysAgo} className={`border-b last:border-0 ${c.row}`}>
                      <td className="py-2.5" suppressHydrationWarning>{dateDaysAgo(entry.daysAgo)}</td>
                      <td>
                        <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${entry.kind === "cashflow" ? "bg-green-100 text-green-700" : "bg-orange-100 text-orange-600"}`}>
                          {t("dashboard", entry.kind)}
                        </span>
                      </td>
                      <td>{entry.detail}</td>
                      <td>
                        <span className="inline-flex items-center gap-2">
                          <span className="h-2 w-2 rounded-full" style={{ backgroundColor: entry.color }} />
                          <span className={`rounded-md border px-2 py-0.5 text-xs ${dark ? "border-gray-600" : "border-gray-300"}`}>{entry.group}</span>
                        </span>
                      </td>
                      <td className="font-medium">{money(entry.amount)}</td>
                      <td className="text-right">
                        <span className="inline-flex gap-2">
                          <Pencil className="h-3.5 w-3.5 text-blue-500" />
                          <Trash2 className="h-3.5 w-3.5 text-red-500" />
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      {/* The dashboard carries on below; fade it rather than cut it off. */}
      <div
        aria-hidden="true"
        className={`pointer-events-none absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t to-transparent ${dark ? "from-gray-900" : "from-white"}`}
      />
    </div>
  );
}
