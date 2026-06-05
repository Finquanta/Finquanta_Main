"use client";

import { useCallback, useMemo } from "react";
import { 
  useAppState, 
  type AppActions, 
  type AppState, 
  selectors, 
  type UserProfile, 
  type ThemeMode,
  type RouteName,
  type Role,
} from "./useAppState";

/**
 * A comprehensive manager hook that exposes curated selectors and composed actions
 * for the entire application. This provides a clean API for components and reduces
 * the need for components to know about the internal state structure.
 */
export function useAppStateManager() {
  // Get all state and actions directly from Zustand
  const state = useAppState();
  
  // Extract primitive values to avoid object reference issues
  const isAuthenticated = state.isAuthenticated;
  const user = state.user;
  const accessToken = state.accessToken;
  const refreshToken = state.refreshToken;
  const loginAttempts = state.loginAttempts;
  const authLoading = state.isLoading;
  
  const currentRoute = state.currentRoute;
  const previousRoute = state.previousRoute;
  const breadcrumbs = state.breadcrumbs;
  const sidebarOpen = state.sidebarOpen;
  const mobileMenuOpen = state.mobileMenuOpen;
  
  const theme = state.theme;
  const loadingCount = state.loadingCount;
  const lastToast = state.lastToast;
  const modals = state.modals;
  const errors = state.errors;
  
  const adminPanelOpen = state.adminPanelOpen;
  const userManagement = state.userManagement;
  const systemMetrics = state.systemMetrics;
  const auditLogs = state.auditLogs;
  
  const dashboardData = state.dashboardData;
  const bookkeeping = state.bookkeeping;
  const payroll = state.payroll;
  
  const devMode = state.devMode;
  const debugInfo = state.debugInfo;
  const apiLogs = state.apiLogs;

  // Composed helpers and utilities with stable dependencies
  const withGlobalLoading = useCallback(
    async (work: () => Promise<any>, onError?: (e: unknown) => void): Promise<any> => {
      state.beginLoading();
      try {
        const res = await work();
        return res;
      } catch (e) {
        onError?.(e);
        state.toast("error", (e as Error)?.message ?? "An error occurred");
        state.addError((e as Error)?.message ?? "Unknown error", currentRoute);
        return undefined;
      } finally {
        state.endLoading();
      }
    },
    [state, currentRoute]
  );

  const navigateWithBreadcrumbs = useCallback(
    (route: RouteName, breadcrumbsParam?: string[]) => {
      state.setCurrentRoute(route);
      if (breadcrumbsParam) {
        state.updateBreadcrumbs(breadcrumbsParam);
      }
      
      // Auto-generate breadcrumbs based on route
      const routeBreadcrumbs: Record<RouteName, string[]> = {
        home: ["Home"],
        login: ["Auth", "Login"],
        signup: ["Auth", "Sign Up"],
        dashboard: ["Dashboard"],
        bookkeeping: ["Dashboard", "Bookkeeping"],
        payroll: ["Dashboard", "Payroll"],
        settings: ["Dashboard", "Settings"],
        privacy: ["Legal", "Privacy Policy"],
        terms: ["Legal", "Terms of Service"],
        "admin-panel": ["Admin", "Panel"],
      };
      
      if (!breadcrumbsParam && routeBreadcrumbs[route]) {
        state.updateBreadcrumbs(routeBreadcrumbs[route]);
      }
    },
    [state]
  );

  const hasPermission = useCallback(
    (requiredRole: Role): boolean => {
      if (!isAuthenticated || !user) return false;
      
      const roleHierarchy: Record<Role, number> = {
        guest: 0,
        user: 1,
        admin: 2,
        developer: 3,
      };
      
      return roleHierarchy[user.role] >= roleHierarchy[requiredRole];
    },
    [isAuthenticated, user]
  );

  const requireAuth = useCallback(
    (message = "Authentication required"): boolean => {
      if (!isAuthenticated) {
        state.toast("error", message);
        navigateWithBreadcrumbs("login");
        return false;
      }
      return true;
    },
    [isAuthenticated, state, navigateWithBreadcrumbs]
  );

  const requireRole = useCallback(
    (role: Role, message?: string): boolean => {
      if (!requireAuth()) return false;
      
      if (!hasPermission(role)) {
        state.toast("error", message ?? `${role} access required`);
        return false;
      }
      return true;
    },
    [requireAuth, hasPermission, state]
  );

  const switchTheme = useCallback(
    (next?: ThemeMode) => {
      if (next) {
        state.setTheme(next);
        return;
      }
      state.setTheme(theme === "dark" ? "light" : "dark");
    },
    [state, theme]
  );

  const handleAuthSuccess = useCallback(
    async (authData: { token: string; user: UserProfile; refreshToken?: string }) => {
      try {
        state.login(authData);
        
        // Add audit log for login
        state.addAuditLog({
          userId: authData.user.id,
          action: "user_login",
          timestamp: new Date(),
          details: { 
            role: authData.user.role,
            email: authData.user.email,
          },
        });

        // Navigate based on user role
        if (authData.user.role === "admin") {
          navigateWithBreadcrumbs("dashboard", ["Admin", "Dashboard"]);
        } else {
          navigateWithBreadcrumbs("dashboard");
        }

        state.toast("success", `Welcome back, ${authData.user.name}!`);
      } catch (error) {
        state.toast("error", "Login failed. Please try again.");
        throw error;
      }
    },
    [state, navigateWithBreadcrumbs]
  );

  const handleLogout = useCallback(
    async () => {
      try {
        if (user) {
          state.addAuditLog({
            userId: user.id,
            action: "user_logout",
            timestamp: new Date(),
            details: { role: user.role },
          });
        }

        state.logout();
        navigateWithBreadcrumbs("home");
        state.toast("info", "You have been logged out");
      } catch (error) {
        state.toast("error", "Error during logout");
      }
    },
    [user, state, navigateWithBreadcrumbs]
  );

  // Return manager object directly without complex memoization
  return {
    // State - return primitive values and simple objects
    auth: {
      isAuthenticated,
      user,
      accessToken,
      refreshToken,
      loginAttempts,
      isLoading: authLoading,
    },
    navigation: {
      currentRoute,
      previousRoute,
      breadcrumbs,
      sidebarOpen,
      mobileMenuOpen,
    },
    ui: {
      theme,
      loadingCount,
      lastToast,
      modals,
      errors,
    },
    admin: {
      adminPanelOpen,
      userManagement,
      systemMetrics,
      auditLogs,
    },
    financial: {
      dashboardData,
      bookkeeping,
      payroll,
    },
    dev: {
      devMode,
      debugInfo,
      apiLogs,
    },

    // Computed state
    isLoading: loadingCount > 0 || authLoading,
    isAdmin: user?.role === "admin",
    isDeveloper: user?.role === "developer",
    canAccessAdmin: user?.role === "admin" || user?.role === "developer",

    // Direct action access
    login: state.login,
    logout: handleLogout,
    setAccessToken: state.setAccessToken,
    setUser: state.setUser,
    updateUserProfile: state.updateUserProfile,
    incrementLoginAttempts: state.incrementLoginAttempts,
    resetLoginAttempts: state.resetLoginAttempts,
    setAuthLoading: state.setAuthLoading,

    setCurrentRoute: state.setCurrentRoute,
    setPreviousRoute: state.setPreviousRoute,
    updateBreadcrumbs: state.updateBreadcrumbs,
    toggleSidebar: state.toggleSidebar,
    toggleMobileMenu: state.toggleMobileMenu,

    setTheme: state.setTheme,
    beginLoading: state.beginLoading,
    endLoading: state.endLoading,
    toast: state.toast,
    clearToast: state.clearToast,
    openConfirmDialog: state.openConfirmDialog,
    closeConfirmDialog: state.closeConfirmDialog,
    toggleModal: state.toggleModal,
    addError: state.addError,
    clearErrors: state.clearErrors,
    removeError: state.removeError,

    toggleAdminPanel: state.toggleAdminPanel,
    setUserFilter: state.setUserFilter,
    setUserSearch: state.setUserSearch,
    selectUsers: state.selectUsers,
    updateSystemMetrics: state.updateSystemMetrics,
    addAuditLog: state.addAuditLog,

    updateDashboardData: state.updateDashboardData,
    addTransaction: state.addTransaction,
    updateTransaction: state.updateTransaction,
    deleteTransaction: state.deleteTransaction,
    addEmployee: state.addEmployee,
    updateEmployee: state.updateEmployee,
    addPayrollRun: state.addPayrollRun,

    setDevMode: state.setDevMode,
    setDebugInfo: state.setDebugInfo,
    setApiLogs: state.setApiLogs,
    devQuickLogin: state.devQuickLogin,
    devQuickAdminLogin: state.devQuickAdminLogin,
    devQuickLogout: state.devQuickLogout,

    // Composed actions
    withGlobalLoading,
    navigateWithBreadcrumbs,
    hasPermission,
    requireAuth,
    requireRole,
    switchTheme,
    handleAuthSuccess,

    // Convenience methods
    updateUserName: (name: string) => {
      if (!user) return;
      state.updateUserProfile({ name });
      state.toast("success", "Name updated successfully");
    },

    updateUserEmail: (email: string) => {
      if (!user) return;
      state.updateUserProfile({ email });
      state.toast("success", "Email updated successfully");
    },

    toggleUserPreference: (key: keyof NonNullable<UserProfile["preferences"]>) => {
      if (!user?.preferences) return;
      state.updateUserProfile({
        preferences: {
          ...user.preferences,
          [key]: !user.preferences[key],
        },
      });
    },

    // Admin utilities
    bulkUserAction: (action: string, userIds: string[]) => {
      if (!requireRole("admin")) return;
      
      state.addAuditLog({
        userId: user!.id,
        action: `bulk_${action}`,
        timestamp: new Date(),
        details: { 
          targetUserIds: userIds,
          action,
        },
      });
      
      state.toast("success", `${action} applied to ${userIds.length} users`);
    },

    // Financial utilities
    calculateTotalBalance: () => {
      const income = bookkeeping.transactions
        .filter(t => t.type === "income")
        .reduce((sum, t) => sum + t.amount, 0);
      
      const expenses = bookkeeping.transactions
        .filter(t => t.type === "expense")
        .reduce((sum, t) => sum + t.amount, 0);
      
      return income - expenses;
    },

    getMonthlyExpenses: (month?: number, year?: number) => {
      const now = new Date();
      const targetMonth = month ?? now.getMonth();
      const targetYear = year ?? now.getFullYear();
      
      return bookkeeping.transactions
        .filter(t => {
          const date = new Date(t.date);
          return t.type === "expense" && 
                 date.getMonth() === targetMonth && 
                 date.getFullYear() === targetYear;
        })
        .reduce((sum, t) => sum + t.amount, 0);
    },
  };
}

// Re-export types and selectors for convenience
export type { 
  AppState, 
  AppActions, 
  UserProfile, 
  ThemeMode, 
  RouteName, 
  Role,
  AuthState,
  NavigationState,
  UIState,
  AdminState,
  FinancialState,
  DevState,
} from "./useAppState";

export const appSelectors = selectors;