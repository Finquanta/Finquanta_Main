/**
 * App Context Module
 * 
 * This module provides comprehensive state management for the entire Finquanta AI application.
 * It includes authentication, navigation, UI state, admin functionality, financial data,
 * and developer tools.
 * 
 * Usage:
 * 1. Wrap your app with AppProvider
 * 2. Use the hooks in components to access state and actions
 * 
 * @example
 * ```tsx
 * // In your root layout or app component
 * import { AppProvider } from '@/hooks/context';
 * 
 * function App({ children }) {
 *   return (
 *     <AppProvider enableDevMode={process.env.NODE_ENV === 'development'}>
 *       {children}
 *     </AppProvider>
 *   );
 * }
 * 
 * // In any component
 * import { useAuth, useNavigation, useUI } from '@/hooks/context';
 * 
 * function MyComponent() {
 *   const { user, requireAuth } = useAuth();
 *   const { navigateWithBreadcrumbs } = useNavigation();
 *   const { toast } = useUI();
 *   
 *   // Component logic...
 * }
 * ```
 */

// Main exports
export { 
  AppProvider, 
  useAppContext,
  withAppContext,
  type AppProviderProps,
} from './useAppContext';

export { 
  useAppStateManager,
  appSelectors,
} from './useAppStateManager';

export { 
  useAppState,
  selectors,
} from './useAppState';

// Specialized hooks
export {
  useAuth,
  useNavigation,
  useUI,
  useAdmin,
  useFinancial,
} from './useAppContext';

// Type exports
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
} from './useAppState';

// Constants for easy reference
export const ROUTES = {
  HOME: 'home' as const,
  LOGIN: 'login' as const,
  SIGNUP: 'signup' as const,
  DASHBOARD: 'dashboard' as const,
  BOOKKEEPING: 'bookkeeping' as const,
  PAYROLL: 'payroll' as const,
  SETTINGS: 'settings' as const,
  PRIVACY: 'privacy' as const,
  TERMS: 'terms' as const,
  ADMIN_PANEL: 'admin-panel' as const,
} as const;

export const ROLES = {
  GUEST: 'guest' as const,
  USER: 'user' as const,
  ADMIN: 'admin' as const,
  DEVELOPER: 'developer' as const,
} as const;

export const THEMES = {
  LIGHT: 'light' as const,
  DARK: 'dark' as const,
  SYSTEM: 'system' as const,
} as const;