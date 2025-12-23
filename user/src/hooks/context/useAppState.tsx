"use client";

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

/**
 * App-wide domain types
 */
export type Role = "guest" | "user" | "admin" | "developer";

export type ThemeMode = "light" | "dark" | "system";

export type RouteName = 
  | "home" 
  | "login" 
  | "signup" 
  | "dashboard" 
  | "bookkeeping" 
  | "payroll" 
  | "settings" 
  | "privacy" 
  | "terms"
  | "admin-panel";

export interface UserProfile {
  id: string;
  name: string;
  email: string;
  role: Role;
  avatarUrl?: string | null;
  createdAt?: Date;
  lastLoginAt?: Date;
  preferences?: {
    notifications: boolean;
    emailUpdates: boolean;
    darkMode: boolean;
  };
}

export interface AuthState {
  isAuthenticated: boolean;
  accessToken?: string | null;
  refreshToken?: string | null;
  user?: UserProfile | null;
  loginAttempts: number;
  isLoading: boolean;
}

export interface NavigationState {
  currentRoute: RouteName;
  previousRoute?: RouteName | null;
  breadcrumbs: string[];
  sidebarOpen: boolean;
  mobileMenuOpen: boolean;
}

export interface UIState {
  theme: ThemeMode;
  loadingCount: number;
  lastToast?: { 
    id: string;
    type: "success" | "error" | "info" | "warning"; 
    message: string; 
    ts: number;
    duration?: number;
  } | null;
  modals: {
    confirmDialog?: {
      isOpen: boolean;
      title: string;
      message: string;
      onConfirm: () => void;
      onCancel: () => void;
    } | null;
    settingsModal?: boolean;
    userProfileModal?: boolean;
  };
  errors: Array<{
    id: string;
    message: string;
    timestamp: number;
    route?: string;
  }>;
}

export interface AdminState {
  adminPanelOpen: boolean;
  userManagement: {
    selectedUsers: string[];
    filterRole: Role | "all";
    searchQuery: string;
  };
  systemMetrics: {
    totalUsers: number;
    activeUsers: number;
    systemHealth: "healthy" | "warning" | "critical";
    lastUpdated?: Date;
  };
  auditLogs: Array<{
    id: string;
    userId: string;
    action: string;
    timestamp: Date;
    details: Record<string, any>;
  }>;
}

export interface FinancialState {
  dashboardData: {
    totalBalance: number;
    monthlyExpenses: number;
    savings: number;
    goals: Array<{
      id: string;
      name: string;
      target: number;
      current: number;
      deadline: Date;
    }>;
  };
  bookkeeping: {
    transactions: Array<{
      id: string;
      amount: number;
      description: string;
      category: string;
      date: Date;
      type: "income" | "expense";
    }>;
    categories: string[];
  };
  payroll: {
    employees: Array<{
      id: string;
      name: string;
      position: string;
      salary: number;
      status: "active" | "inactive";
    }>;
    payrollRuns: Array<{
      id: string;
      period: string;
      status: "pending" | "processed" | "completed";
      totalAmount: number;
    }>;
  };
}

export interface DevState {
  devMode: boolean;
  debugInfo: boolean;
  apiLogs: boolean;
}

/**
 * Root app state combining all state slices
 */
export interface AppState extends AuthState, NavigationState, UIState, AdminState, FinancialState, DevState {}

export interface AppActions {
  // Auth Actions
  login: (payload: { token: string; user: UserProfile; refreshToken?: string | null }) => void;
  logout: () => void;
  setAccessToken: (token: string | null) => void;
  setUser: (user: UserProfile | null) => void;
  updateUserProfile: (updates: Partial<UserProfile>) => void;
  incrementLoginAttempts: () => void;
  resetLoginAttempts: () => void;
  setAuthLoading: (loading: boolean) => void;

  // Navigation Actions
  setCurrentRoute: (route: RouteName) => void;
  setPreviousRoute: (route: RouteName) => void;
  updateBreadcrumbs: (crumbs: string[]) => void;
  toggleSidebar: (open?: boolean) => void;
  toggleMobileMenu: (open?: boolean) => void;

  // UI Actions
  setTheme: (mode: ThemeMode) => void;
  beginLoading: () => void;
  endLoading: () => void;
  toast: (type: "success" | "error" | "info" | "warning", message: string, duration?: number) => void;
  clearToast: () => void;
  openConfirmDialog: (config: { title: string; message: string; onConfirm: () => void; onCancel: () => void }) => void;
  closeConfirmDialog: () => void;
  toggleModal: (modalName: "settingsModal" | "userProfileModal", open?: boolean) => void;
  addError: (message: string, route?: string) => void;
  clearErrors: () => void;
  removeError: (id: string) => void;

  // Admin Actions
  toggleAdminPanel: (open?: boolean) => void;
  setUserFilter: (role: Role | "all") => void;
  setUserSearch: (query: string) => void;
  selectUsers: (userIds: string[]) => void;
  updateSystemMetrics: (metrics: Partial<AdminState["systemMetrics"]>) => void;
  addAuditLog: (log: Omit<AdminState["auditLogs"][0], "id">) => void;

  // Financial Actions
  updateDashboardData: (data: Partial<FinancialState["dashboardData"]>) => void;
  addTransaction: (transaction: Omit<FinancialState["bookkeeping"]["transactions"][0], "id">) => void;
  updateTransaction: (id: string, updates: Partial<FinancialState["bookkeeping"]["transactions"][0]>) => void;
  deleteTransaction: (id: string) => void;
  addEmployee: (employee: Omit<FinancialState["payroll"]["employees"][0], "id">) => void;
  updateEmployee: (id: string, updates: Partial<FinancialState["payroll"]["employees"][0]>) => void;
  addPayrollRun: (payrollRun: Omit<FinancialState["payroll"]["payrollRuns"][0], "id">) => void;

  // Dev Actions
  setDevMode: (on: boolean) => void;
  setDebugInfo: (on: boolean) => void;
  setApiLogs: (on: boolean) => void;
  devQuickLogin: () => void;
  devQuickAdminLogin: () => void;
  devQuickLogout: () => void;
}

/**
 * Initial state
 */
const initialState: AppState = {
  // Auth
  isAuthenticated: false,
  accessToken: null,
  refreshToken: null,
  user: null,
  loginAttempts: 0,
  isLoading: false,

  // Navigation
  currentRoute: "home",
  previousRoute: null,
  breadcrumbs: [],
  sidebarOpen: false,
  mobileMenuOpen: false,

  // UI
  theme: "system",
  loadingCount: 0,
  lastToast: null,
  modals: {
    confirmDialog: null,
    settingsModal: false,
    userProfileModal: false,
  },
  errors: [],

  // Admin
  adminPanelOpen: false,
  userManagement: {
    selectedUsers: [],
    filterRole: "all",
    searchQuery: "",
  },
  systemMetrics: {
    totalUsers: 0,
    activeUsers: 0,
    systemHealth: "healthy",
  },
  auditLogs: [],

  // Financial
  dashboardData: {
    totalBalance: 0,
    monthlyExpenses: 0,
    savings: 0,
    goals: [],
  },
  bookkeeping: {
    transactions: [],
    categories: ["Food", "Transportation", "Entertainment", "Bills", "Shopping", "Health", "Other"],
  },
  payroll: {
    employees: [],
    payrollRuns: [],
  },

  // Dev
  devMode: false,
  debugInfo: false,
  apiLogs: false,
};

/**
 * Generate unique ID
 */
const generateId = () => Math.random().toString(36).substr(2, 9);

/**
 * Store creation with persist (localStorage)
 */
export const useAppState = create<AppState & AppActions>()(
  persist(
    (set, get) => ({
      ...initialState,

      // Auth Actions
      login: ({ token, user, refreshToken }) =>
        set(() => ({
          isAuthenticated: true,
          accessToken: token,
          refreshToken: refreshToken ?? null,
          user: {
            ...user,
            lastLoginAt: new Date(),
          },
          loginAttempts: 0,
          isLoading: false,
        })),
      
      logout: () => {
        const currentTheme = get().theme;
        const currentDevMode = get().devMode;
        set(() => ({ 
          ...initialState, 
          theme: currentTheme, 
          devMode: currentDevMode,
          currentRoute: "home",
        }));
      },
      
      setAccessToken: (token) => set(() => ({ accessToken: token })),
      setUser: (user) => set(() => ({ user })),
      updateUserProfile: (updates) => set((state) => ({
        user: state.user ? { ...state.user, ...updates } : null,
      })),
      incrementLoginAttempts: () => set((state) => ({ loginAttempts: state.loginAttempts + 1 })),
      resetLoginAttempts: () => set(() => ({ loginAttempts: 0 })),
      setAuthLoading: (loading) => set(() => ({ isLoading: loading })),

      // Navigation Actions
      setCurrentRoute: (route) => set((state) => ({
        previousRoute: state.currentRoute,
        currentRoute: route,
      })),
      setPreviousRoute: (route) => set(() => ({ previousRoute: route })),
      updateBreadcrumbs: (crumbs) => set(() => ({ breadcrumbs: crumbs })),
      toggleSidebar: (open) => set((state) => ({
        sidebarOpen: typeof open === "boolean" ? open : !state.sidebarOpen,
      })),
      toggleMobileMenu: (open) => set((state) => ({
        mobileMenuOpen: typeof open === "boolean" ? open : !state.mobileMenuOpen,
      })),

      // UI Actions
      setTheme: (mode) => set(() => ({ theme: mode })),
      beginLoading: () => set((s) => ({ loadingCount: Math.max(0, s.loadingCount + 1) })),
      endLoading: () => set((s) => ({ loadingCount: Math.max(0, s.loadingCount - 1) })),
      toast: (type, message, duration = 5000) => set(() => ({ 
        lastToast: { 
          id: generateId(),
          type, 
          message, 
          ts: Date.now(),
          duration,
        } 
      })),
      clearToast: () => set(() => ({ lastToast: null })),
      openConfirmDialog: (config) => set(() => ({
        modals: { ...get().modals, confirmDialog: { ...config, isOpen: true } },
      })),
      closeConfirmDialog: () => set(() => ({
        modals: { ...get().modals, confirmDialog: null },
      })),
      toggleModal: (modalName, open) => set((state) => ({
        modals: {
          ...state.modals,
          [modalName]: typeof open === "boolean" ? open : !state.modals[modalName],
        },
      })),
      addError: (message, route) => set((state) => ({
        errors: [...state.errors, {
          id: generateId(),
          message,
          timestamp: Date.now(),
          route,
        }],
      })),
      clearErrors: () => set(() => ({ errors: [] })),
      removeError: (id) => set((state) => ({
        errors: state.errors.filter(error => error.id !== id),
      })),

      // Admin Actions
      toggleAdminPanel: (open) => set((state) => ({
        adminPanelOpen: typeof open === "boolean" ? open : !state.adminPanelOpen,
      })),
      setUserFilter: (role) => set((state) => ({
        userManagement: { ...state.userManagement, filterRole: role },
      })),
      setUserSearch: (query) => set((state) => ({
        userManagement: { ...state.userManagement, searchQuery: query },
      })),
      selectUsers: (userIds) => set((state) => ({
        userManagement: { ...state.userManagement, selectedUsers: userIds },
      })),
      updateSystemMetrics: (metrics) => set((state) => ({
        systemMetrics: { ...state.systemMetrics, ...metrics, lastUpdated: new Date() },
      })),
      addAuditLog: (log) => set((state) => ({
        auditLogs: [{ ...log, id: generateId() }, ...state.auditLogs].slice(0, 1000), // Keep last 1000 logs
      })),

      // Financial Actions
      updateDashboardData: (data) => set((state) => ({
        dashboardData: { ...state.dashboardData, ...data },
      })),
      addTransaction: (transaction) => set((state) => ({
        bookkeeping: {
          ...state.bookkeeping,
          transactions: [{ ...transaction, id: generateId() }, ...state.bookkeeping.transactions],
        },
      })),
      updateTransaction: (id, updates) => set((state) => ({
        bookkeeping: {
          ...state.bookkeeping,
          transactions: state.bookkeeping.transactions.map(t => 
            t.id === id ? { ...t, ...updates } : t
          ),
        },
      })),
      deleteTransaction: (id) => set((state) => ({
        bookkeeping: {
          ...state.bookkeeping,
          transactions: state.bookkeeping.transactions.filter(t => t.id !== id),
        },
      })),
      addEmployee: (employee) => set((state) => ({
        payroll: {
          ...state.payroll,
          employees: [...state.payroll.employees, { ...employee, id: generateId() }],
        },
      })),
      updateEmployee: (id, updates) => set((state) => ({
        payroll: {
          ...state.payroll,
          employees: state.payroll.employees.map(e => 
            e.id === id ? { ...e, ...updates } : e
          ),
        },
      })),
      addPayrollRun: (payrollRun) => set((state) => ({
        payroll: {
          ...state.payroll,
          payrollRuns: [{ ...payrollRun, id: generateId() }, ...state.payroll.payrollRuns],
        },
      })),

      // Dev Actions
      setDevMode: (on) => set(() => ({ devMode: on })),
      setDebugInfo: (on) => set(() => ({ debugInfo: on })),
      setApiLogs: (on) => set(() => ({ apiLogs: on })),
      devQuickLogin: () => set((state) => {
        const devUser: UserProfile = {
          id: "dev-user-123",
          name: "Developer User",
          email: "dev@example.com",
          role: "user",
          avatarUrl: null,
          createdAt: new Date(),
          preferences: {
            notifications: true,
            emailUpdates: false,
            darkMode: true,
          },
        };
        
        console.log('🔵 devQuickLogin executing...');
        
        // Update state directly without calling other actions
        const newState = {
          ...state,
          isAuthenticated: true,
          accessToken: "dev-token",
          refreshToken: "dev-refresh",
          user: {
            ...devUser,
            lastLoginAt: new Date(),
          },
          loginAttempts: 0,
          isLoading: false,
          // Navigate to dashboard after login
          currentRoute: "dashboard" as RouteName,
          previousRoute: state.currentRoute,
          breadcrumbs: ["Dashboard"],
          lastToast: {
            id: Math.random().toString(36).substr(2, 9),
            type: "success" as const,
            message: "Logged in as Developer User",
            ts: Date.now(),
            duration: 3000,
          },
        };
        
        console.log('🔵 devQuickLogin new state:', {
          isAuthenticated: newState.isAuthenticated,
          user: newState.user?.name,
          accessToken: newState.accessToken
        });
        
        return newState;
      }),
      devQuickAdminLogin: () => set((state) => {
        const adminUser: UserProfile = {
          id: "dev-admin-123",
          name: "Developer Admin",
          email: "admin@example.com",
          role: "admin",
          avatarUrl: null,
          createdAt: new Date(),
          preferences: {
            notifications: true,
            emailUpdates: true,
            darkMode: false,
          },
        };
        
        console.log('🟣 devQuickAdminLogin executing...');
        
        // Update state directly without calling other actions
        const newState = {
          ...state,
          isAuthenticated: true,
          accessToken: "admin-token",
          refreshToken: "admin-refresh",
          user: {
            ...adminUser,
            lastLoginAt: new Date(),
          },
          loginAttempts: 0,
          isLoading: false,
          // Navigate to dashboard after login (admin gets special breadcrumbs)
          currentRoute: "dashboard" as RouteName,
          previousRoute: state.currentRoute,
          breadcrumbs: ["Admin", "Dashboard"],
          lastToast: {
            id: Math.random().toString(36).substr(2, 9),
            type: "success" as const,
            message: "Logged in as Developer Admin",
            ts: Date.now(),
            duration: 3000,
          },
        };
        
        console.log('🟣 devQuickAdminLogin new state:', {
          isAuthenticated: newState.isAuthenticated,
          user: newState.user?.name,
          accessToken: newState.accessToken
        });
        
        return newState;
      }),
      devQuickLogout: () => set((state) => {
        console.log('🛾 devQuickLogout executing...');
        
        const currentTheme = state.theme;
        const currentDevMode = state.devMode;
        return {
          ...initialState,
          theme: currentTheme,
          devMode: currentDevMode,
          currentRoute: "home" as RouteName,
          lastToast: {
            id: Math.random().toString(36).substr(2, 9),
            type: "info" as const,
            message: "Developer logged out",
            ts: Date.now(),
            duration: 3000,
          },
        };
      }),
    }),
    {
      name: "fiscal-ai-app-state",
      storage: createJSONStorage(() => (typeof window !== "undefined" ? localStorage : undefined as any)),
      // Persist only necessary fields, exclude volatile state
      partialize: (state) => ({
        // Auth (persistent)
        isAuthenticated: state.isAuthenticated,
        accessToken: state.accessToken,
        refreshToken: state.refreshToken,
        user: state.user,
        
        // UI preferences (persistent)
        theme: state.theme,
        sidebarOpen: state.sidebarOpen,
        
        // Financial data (persistent)
        dashboardData: state.dashboardData,
        bookkeeping: state.bookkeeping,
        payroll: state.payroll,
        
        // Dev preferences (persistent)
        devMode: state.devMode,
        debugInfo: state.debugInfo,
        apiLogs: state.apiLogs,
        
        // Admin settings (persistent)
        userManagement: state.userManagement,
      }),
    }
  )
);

/**
 * Selectors for optimized state access
 */
export const selectors = {
  auth: (s: AppState) => ({
    isAuthenticated: s.isAuthenticated,
    user: s.user,
    accessToken: s.accessToken,
    refreshToken: s.refreshToken,
    loginAttempts: s.loginAttempts,
    isLoading: s.isLoading,
  }),
  navigation: (s: AppState) => ({
    currentRoute: s.currentRoute,
    previousRoute: s.previousRoute,
    breadcrumbs: s.breadcrumbs,
    sidebarOpen: s.sidebarOpen,
    mobileMenuOpen: s.mobileMenuOpen,
  }),
  ui: (s: AppState) => ({
    theme: s.theme,
    loadingCount: s.loadingCount,
    lastToast: s.lastToast,
    modals: s.modals,
    errors: s.errors,
  }),
  admin: (s: AppState) => ({
    adminPanelOpen: s.adminPanelOpen,
    userManagement: s.userManagement,
    systemMetrics: s.systemMetrics,
    auditLogs: s.auditLogs,
  }),
  financial: (s: AppState) => ({
    dashboardData: s.dashboardData,
    bookkeeping: s.bookkeeping,
    payroll: s.payroll,
  }),
  dev: (s: AppState) => ({
    devMode: s.devMode,
    debugInfo: s.debugInfo,
    apiLogs: s.apiLogs,
  }),
};