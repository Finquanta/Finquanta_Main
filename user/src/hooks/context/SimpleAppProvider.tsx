"use client";

import React, { createContext, useContext } from "react";
import { useRouter } from "next/navigation";
import { useAppStateManager } from "./useAppStateManager";

type AppContextValue = ReturnType<typeof useAppStateManager>;

const AppContext = createContext<AppContextValue | null>(null);

export interface AppProviderProps {
  children: React.ReactNode;
  enableDevMode?: boolean;
}

export function AppProvider({ children, enableDevMode = false }: AppProviderProps) {
  const manager = useAppStateManager();

  // Use a ref to track if we've initialized devMode to prevent infinite loops
  const devModeInitialized = React.useRef(false);
  
  // Initialize dev mode only once using useLayoutEffect for synchronous execution
  React.useLayoutEffect(() => {
    if (enableDevMode && !manager.dev.devMode && !devModeInitialized.current) {
      manager.setDevMode(true);
      devModeInitialized.current = true;
    }
  }, [enableDevMode, manager]);

  // Memoize the context value to prevent unnecessary re-renders only with stable references
  const contextValue = React.useMemo(() => ({
    ...manager,
    // Force stable object reference for complex nested objects
    ui: {
      ...manager.ui,
      // Create stable references for toast and errors
      lastToast: manager.ui.lastToast,
      errors: manager.ui.errors,
    },
    dev: {
      ...manager.dev,
      devMode: manager.dev.devMode,
    },
  }), [
  manager,
  ]);

  return (
    <AppContext.Provider value={contextValue}>
      {children}
      {/* Simplified UI components */}
      {contextValue.ui.lastToast && <SimpleToast />}
      {contextValue.ui.errors.length > 0 && <SimpleErrors />}
      {contextValue.dev.devMode && <SimpleDevPanel />}
    </AppContext.Provider>
  );
}

export function useAppContext(): AppContextValue {
  const ctx = useContext(AppContext);
  if (!ctx) {
    throw new Error("useAppContext must be used within an AppProvider");
  }
  return ctx;
}

// Simplified Toast component
function SimpleToast() {
  const { ui, clearToast } = useAppContext();

  React.useEffect(() => {
    if (ui.lastToast?.duration) {
      const timer = setTimeout(clearToast, ui.lastToast.duration);
      return () => clearTimeout(timer);
    }
  }, [ui.lastToast?.id, ui.lastToast?.duration, clearToast]); // Use stable id instead of full object

  if (!ui.lastToast) return null;

  return (
    <div className="fixed top-4 right-4 z-50">
      <div 
        className={`px-4 py-2 rounded-md shadow-lg ${
          ui.lastToast.type === "success" ? "bg-green-500 text-white" :
          ui.lastToast.type === "error" ? "bg-red-500 text-white" :
          ui.lastToast.type === "warning" ? "bg-yellow-500 text-black" :
          "bg-blue-500 text-white"
        }`}
      >
        <div className="flex items-center justify-between">
          <span>{ui.lastToast.message}</span>
          <button onClick={clearToast} className="ml-4 text-sm opacity-75 hover:opacity-100">
            ×
          </button>
        </div>
      </div>
    </div>
  );
}

// Simplified Error display
function SimpleErrors() {
  const { ui, removeError } = useAppContext();

  return (
    <div className="fixed bottom-4 left-4 z-50 max-w-md">
      {ui.errors.slice(0, 3).map((error: any) => (
        <div key={error.id} className="mb-2 p-3 bg-red-100 border border-red-400 text-red-700 rounded">
          <div className="flex justify-between items-start">
            <div>
              <p className="font-medium">Error</p>
              <p className="text-sm">{error.message}</p>
            </div>
            <button onClick={() => removeError(error.id)} className="text-red-500 hover:text-red-700">
              ×
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}

// Simplified Dev Panel
function SimpleDevPanel() {
  const router = useRouter();
  const { 
    dev,
    auth,
    setDevMode,
    devQuickLogin,
    devQuickAdminLogin,
    devQuickLogout,
    clearErrors,
  } = useAppContext();

  // Debug logging - monitor auth state changes
  React.useEffect(() => {
    console.log('🔄 Dev Panel - Auth state changed:', {
      isAuthenticated: auth.isAuthenticated,
      user: auth.user?.name || 'None',
      accessToken: auth.accessToken ? '***' + auth.accessToken.slice(-4) : 'None'
    });
  }, [auth.isAuthenticated, auth.user, auth.accessToken]);

  // Handle dev login with navigation
  const handleDevLogin = async () => {
    console.log('🔵 User Login clicked - BEFORE:', {
      isAuthenticated: auth.isAuthenticated,
      localStorage: {
        accessToken: typeof window !== 'undefined' ? localStorage.getItem('accessToken') : 'N/A',
        refreshToken: typeof window !== 'undefined' ? localStorage.getItem('refreshToken') : 'N/A'
      }
    });
    
    devQuickLogin();
    
    // Wait a bit for state to update
    setTimeout(() => {
      console.log('🔵 User Login - AFTER state update:', {
        isAuthenticated: auth.isAuthenticated,
        user: auth.user?.name,
        localStorage: {
          accessToken: typeof window !== 'undefined' ? localStorage.getItem('accessToken') : 'N/A',
          refreshToken: typeof window !== 'undefined' ? localStorage.getItem('refreshToken') : 'N/A'
        }
      });
      console.log('🔵 Navigating to dashboard...');
      router.push('/dashboard');
    }, 200);
  };

  const handleDevAdminLogin = async () => {
    console.log('🟣 Admin Login clicked - BEFORE:', {
      isAuthenticated: auth.isAuthenticated,
      localStorage: {
        accessToken: typeof window !== 'undefined' ? localStorage.getItem('accessToken') : 'N/A',
        refreshToken: typeof window !== 'undefined' ? localStorage.getItem('refreshToken') : 'N/A'
      }
    });
    
    devQuickAdminLogin();
    
    // Wait a bit for state to update
    setTimeout(() => {
      console.log('🟣 Admin Login - AFTER state update:', {
        isAuthenticated: auth.isAuthenticated,
        user: auth.user?.name,
        localStorage: {
          accessToken: typeof window !== 'undefined' ? localStorage.getItem('accessToken') : 'N/A',
          refreshToken: typeof window !== 'undefined' ? localStorage.getItem('refreshToken') : 'N/A'
        }
      });
      console.log('🟣 Navigating to dashboard...');
      router.push('/dashboard');
    }, 200);
  };

  return (
    <div className="fixed bottom-4 right-4 w-80 bg-gray-900 text-white p-4 rounded-lg shadow-xl z-50 max-h-96 overflow-y-auto">
      <div className="flex justify-between items-center mb-3">
        <h3 className="font-bold">🛠️ Dev Panel</h3>
        <button onClick={() => setDevMode(false)} className="text-gray-400 hover:text-white">
          ×
        </button>
      </div>
      
      <div className="space-y-2 text-sm">
        <div>
          <p className="font-medium mb-1">Auth:</p>
          <div className="flex gap-1">
            <button onClick={handleDevLogin} className="px-2 py-1 bg-blue-600 rounded text-xs">
              User Login
            </button>
            {/* <button onClick={handleDevAdminLogin} className="px-2 py-1 bg-purple-600 rounded text-xs">
              Admin Login
            </button> */}
            <button onClick={devQuickLogout} className="px-2 py-1 bg-gray-600 rounded text-xs">
              Logout
            </button>
          </div>
        </div>

        <div>
          <p className="font-medium mb-1">Utils:</p>
          <button onClick={clearErrors} className="px-2 py-1 bg-yellow-600 rounded text-xs">
            Clear Errors
          </button>
        </div>

        <div className="mt-3 pt-3 border-t border-gray-700">
          <p className="font-medium mb-1">Auth State:</p>
          <div className="text-xs space-y-1">
            <p>Authenticated: {auth.isAuthenticated ? 'Yes' : 'No'}</p>
            <p>User: {auth.user?.name || 'None'}</p>
            <p>Role: {auth.user?.role || 'guest'}</p>
          </div>
        </div>
      </div>
    </div>
  );
}

// Specialized hooks
export function useAuth() {
  const { auth, login, logout, requireAuth, requireRole, hasPermission, incrementLoginAttempts, setAuthLoading } = useAppContext();
  return { 
    ...auth, 
    login, 
    logout, 
    requireAuth, 
    requireRole, 
    hasPermission, 
    incrementLoginAttempts,
    setAuthLoading
  };
}

export function useUI() {
  const { ui, toast, clearToast, beginLoading, endLoading, addError, clearErrors } = useAppContext();
  return { 
    ...ui, 
    toast, 
    clearToast, 
    beginLoading, 
    endLoading, 
    addError, 
    clearErrors 
  };
}
