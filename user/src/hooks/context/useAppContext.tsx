"use client";

import React, { createContext, useContext, useMemo, useEffect } from "react";
import { useAppState } from "./useAppState";
import { useAppStateManager } from "./useAppStateManager";

/**
 * App Context for the entire application.
 * This provider creates a clear boundary for client components and provides
 * a centralized place for initialization and side effects.
 */

type AppContextValue = ReturnType<typeof useAppStateManager>;

// Create the context
const AppContext = createContext<AppContextValue | null>(null);

export interface AppProviderProps {
  children: React.ReactNode;
  initialRoute?: string;
  enableDevMode?: boolean;
  onRouteChange?: (route: string) => void;
}

export function AppProvider({ 
  children, 
  initialRoute,
  enableDevMode = false,
  onRouteChange,
}: AppProviderProps) {
  // Initialize the store
  useAppState();

  const manager = useAppStateManager();
  
  // Use a ref to track if we've initialized to prevent multiple calls
  const initialized = React.useRef(false);
  
  // Initialize synchronously but only once
  if (!initialized.current) {
    // Set initial route if provided and different from current
    if (initialRoute && manager.navigation.currentRoute !== initialRoute) {
      manager.setCurrentRoute(initialRoute as any);
    }

    // Enable dev mode if specified and not already enabled
    if (enableDevMode && !manager.dev.devMode) {
      manager.setDevMode(true);
    }
    
    initialized.current = true;
  }
  
  // Memoize the context value to prevent unnecessary re-renders
  const value = useMemo(() => manager, [manager]);

  return (
    <AppContext.Provider value={value}>
      {children}
      {/* Global UI components that depend on context */}
      <GlobalToast />
      <GlobalErrorBoundary />
      {manager.dev.devMode && <DevPanel />}
    </AppContext.Provider>
  );
}

/**
 * Hook to access the app context
 */
export function useAppContext(): AppContextValue {
  const ctx = useContext(AppContext);
  if (!ctx) {
    throw new Error("useAppContext must be used within an AppProvider");
  }
  return ctx;
}

/**
 * Higher-order component to wrap components with app context
 */
export function withAppContext<P extends object>(
  Component: React.ComponentType<P>
): React.ComponentType<P> {
  const WrappedComponent = (props: P) => {
    const context = useAppContext();
    return <Component {...props} />;
  };
  
  WrappedComponent.displayName = `withAppContext(${Component.displayName || Component.name})`;
  return WrappedComponent;
}

/**
 * Global Toast component
 */
function GlobalToast() {
  const { ui, clearToast } = useAppContext();

  useEffect(() => {
    if (ui.lastToast && ui.lastToast.duration && ui.lastToast.duration > 0) {
      const timer = setTimeout(() => {
        clearToast();
      }, ui.lastToast.duration);

      return () => clearTimeout(timer);
    }
  }, [ui.lastToast, clearToast]);

  if (!ui.lastToast) return null;

  return (
    <div className="fixed top-4 right-4 z-50">
      <div 
        className={`px-4 py-2 rounded-md shadow-lg transition-all duration-300 ${
          ui.lastToast.type === "success" ? "bg-green-500 text-white" :
          ui.lastToast.type === "error" ? "bg-red-500 text-white" :
          ui.lastToast.type === "warning" ? "bg-yellow-500 text-black" :
          "bg-blue-500 text-white"
        }`}
      >
        <div className="flex items-center justify-between">
          <span>{ui.lastToast.message}</span>
          <button 
            onClick={clearToast}
            className="ml-4 text-sm opacity-75 hover:opacity-100"
          >
            ×
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * Global Error Boundary component
 */
function GlobalErrorBoundary() {
  const { ui, removeError } = useAppContext();

  if (ui.errors.length === 0) return null;

  return (
    <div className="fixed bottom-4 left-4 z-50 max-w-md">
      {ui.errors.slice(0, 3).map((error: { id: string; message: string; route?: string; timestamp: number }) => (
        <div 
          key={error.id}
          className="mb-2 p-3 bg-red-100 border border-red-400 text-red-700 rounded"
        >
          <div className="flex justify-between items-start">
            <div>
              <p className="font-medium">Error</p>
              <p className="text-sm">{error.message}</p>
              {error.route && (
                <p className="text-xs opacity-75">Route: {error.route}</p>
              )}
            </div>
            <button 
              onClick={() => removeError(error.id)}
              className="text-red-500 hover:text-red-700"
            >
              ×
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}

/**
 * Developer Panel for debugging
 */
function DevPanel() {
  const { 
    dev, 
    auth,
    navigation,
    ui,
    admin,
    financial,
    setDevMode,
    devQuickLogin,
    devQuickAdminLogin,
    devQuickLogout,
    setDebugInfo,
    setApiLogs,
    clearErrors,
    toggleAdminPanel,
  } = useAppContext();

  if (!dev.devMode) return null;

  return (
    <div className="fixed bottom-4 right-4 w-80 bg-gray-900 text-white p-4 rounded-lg shadow-xl z-50 max-h-96 overflow-y-auto">
      <div className="flex justify-between items-center mb-3">
        <h3 className="font-bold">🛠️ Dev Panel</h3>
        <button 
          onClick={() => setDevMode(false)}
          className="text-gray-400 hover:text-white"
        >
          ×
        </button>
      </div>
      
      <div className="space-y-2 text-sm">
        {/* Auth Controls */}
        <div>
          <p className="font-medium mb-1">Auth:</p>
          <div className="flex gap-1">
            <button 
              onClick={devQuickLogin}
              className="px-2 py-1 bg-blue-600 rounded text-xs"
            >
              User Login
            </button>
            {/* <button 
              onClick={devQuickAdminLogin}
              className="px-2 py-1 bg-purple-600 rounded text-xs"
            >
              Admin Login
            </button> */}
            <button 
              onClick={devQuickLogout}
              className="px-2 py-1 bg-gray-600 rounded text-xs"
            >
              Logout
            </button>
          </div>
        </div>

        {/* Debug Controls */}
        <div>
          <p className="font-medium mb-1">Debug:</p>
          <div className="flex gap-1">
            <label className="flex items-center text-xs">
              <input
                type="checkbox"
                checked={dev.debugInfo}
                onChange={(e) => setDebugInfo(e.target.checked)}
                className="mr-1"
              />
              Debug Info
            </label>
            <label className="flex items-center text-xs">
              <input
                type="checkbox"
                checked={dev.apiLogs}
                onChange={(e) => setApiLogs(e.target.checked)}
                className="mr-1"
              />
              API Logs
            </label>
          </div>
        </div>

        {/* Admin Controls */}
        {auth.user?.role === "admin" && (
          <div>
            <p className="font-medium mb-1">Admin:</p>
            <button 
              onClick={() => toggleAdminPanel()}
              className="px-2 py-1 bg-red-600 rounded text-xs"
            >
              Toggle Admin Panel
            </button>
          </div>
        )}

        {/* Utilities */}
        <div>
          <p className="font-medium mb-1">Utils:</p>
          <button 
            onClick={clearErrors}
            className="px-2 py-1 bg-yellow-600 rounded text-xs"
          >
            Clear Errors
          </button>
        </div>

        {/* State Display */}
        {dev.debugInfo && (
          <div className="mt-3 pt-3 border-t border-gray-700">
            <p className="font-medium mb-1">State:</p>
            <div className="text-xs space-y-1 max-h-32 overflow-y-auto">
              <p>Route: {navigation.currentRoute}</p>
              <p>User: {auth.user?.name || "None"}</p>
              <p>Role: {auth.user?.role || "guest"}</p>
              <p>Theme: {ui.theme}</p>
              <p>Loading: {ui.loadingCount}</p>
              <p>Errors: {ui.errors.length}</p>
              <p>Balance: ${financial.dashboardData.totalBalance}</p>
              <p>Transactions: {financial.bookkeeping.transactions.length}</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// Type-safe hooks for specific context slices
export function useAuth() {
  const { auth, requireAuth, requireRole, hasPermission, handleAuthSuccess, logout } = useAppContext();
  return { ...auth, requireAuth, requireRole, hasPermission, handleAuthSuccess, logout };
}

export function useNavigation() {
  const { navigation, navigateWithBreadcrumbs, setCurrentRoute } = useAppContext();
  return { ...navigation, navigateWithBreadcrumbs, setCurrentRoute };
}

export function useUI() {
  const { ui, toast, clearToast, toggleModal, switchTheme, addError, clearErrors } = useAppContext();
  return { ...ui, toast, clearToast, toggleModal, switchTheme, addError, clearErrors };
}

export function useAdmin() {
  const { admin, toggleAdminPanel, bulkUserAction, addAuditLog } = useAppContext();
  return { ...admin, toggleAdminPanel, bulkUserAction, addAuditLog };
}

export function useFinancial() {
  const { 
    financial, 
    addTransaction, 
    updateTransaction, 
    deleteTransaction,
    calculateTotalBalance,
    getMonthlyExpenses,
  } = useAppContext();
  return { 
    ...financial, 
    addTransaction, 
    updateTransaction, 
    deleteTransaction,
    calculateTotalBalance,
    getMonthlyExpenses,
  };
}