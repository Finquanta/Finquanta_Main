# App Context System

This directory contains a comprehensive state management solution for the Finquanta AI application, built using Zustand and React Context. It provides centralized state management for authentication, navigation, UI state, admin functionality, financial data, and developer tools.

## Overview

The context system is designed to cover the entire application with role-based access control for both users and admins. It includes:

- **Authentication State**: User login, logout, permissions, and profile management
- **Navigation State**: Route management, breadcrumbs, and sidebar controls
- **UI State**: Theme, loading states, toasts, modals, and error handling
- **Admin State**: User management, system metrics, and audit logs
- **Financial State**: Dashboard data, bookkeeping, and payroll management
- **Developer State**: Debug tools, quick login, and development helpers

## Installation

First, ensure Zustand is installed:

```bash
npm install zustand
```

## Setup

### 1. Wrap Your App with AppProvider

```tsx
// In your root layout or app.tsx
import { AppProvider } from '@/hooks/context';

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <AppProvider 
          enableDevMode={process.env.NODE_ENV === 'development'}
          initialRoute="home"
        >
          {children}
        </AppProvider>
      </body>
    </html>
  );
}
```

### 2. Use Hooks in Components

```tsx
// In any component
import { useAuth, useNavigation, useUI } from '@/hooks/context';

function MyComponent() {
  const { user, isAuthenticated, requireAuth } = useAuth();
  const { navigateWithBreadcrumbs } = useNavigation();
  const { toast, theme, switchTheme } = useUI();

  const handleAction = () => {
    if (!requireAuth()) return;
    
    // Your authenticated logic here
    toast('success', 'Action completed!');
    navigateWithBreadcrumbs('dashboard');
  };

  return (
    <div>
      <p>User: {user?.name || 'Guest'}</p>
      <button onClick={handleAction}>
        Protected Action
      </button>
      <button onClick={() => switchTheme()}>
        Toggle Theme (Current: {theme})
      </button>
    </div>
  );
}
```

## Available Hooks

### Core Hook
- `useAppContext()`: Access to the complete app state and actions

### Specialized Hooks
- `useAuth()`: Authentication state and actions
- `useNavigation()`: Navigation state and routing
- `useUI()`: UI state, themes, toasts, modals
- `useAdmin()`: Admin functionality (requires admin role)
- `useFinancial()`: Financial data and transactions

## Authentication

### Login
```tsx
import { useAuth } from '@/hooks/context';

function LoginForm() {
  const { handleAuthSuccess, isLoading } = useAuth();

  const handleLogin = async (credentials) => {
    // Your login API call
    const response = await loginAPI(credentials);
    
    // Handle successful authentication
    await handleAuthSuccess({
      token: response.accessToken,
      refreshToken: response.refreshToken,
      user: response.user,
    });
  };
}
```

### Role-Based Access
```tsx
import { useAuth } from '@/hooks/context';

function AdminComponent() {
  const { requireRole, user } = useAuth();

  useEffect(() => {
    // Redirect if not admin
    if (!requireRole('admin')) return;
  }, [requireRole]);

  // Admin-only content
  return <div>Admin Panel</div>;
}
```

## Navigation

### Route Management
```tsx
import { useNavigation, ROUTES } from '@/hooks/context';

function Navigation() {
  const { currentRoute, navigateWithBreadcrumbs, breadcrumbs } = useNavigation();

  const goToDashboard = () => {
    navigateWithBreadcrumbs(ROUTES.DASHBOARD, ['Dashboard']);
  };

  return (
    <nav>
      <div>Current: {currentRoute}</div>
      <div>Breadcrumbs: {breadcrumbs.join(' > ')}</div>
      <button onClick={goToDashboard}>Dashboard</button>
    </nav>
  );
}
```

## UI State Management

### Toasts
```tsx
import { useUI } from '@/hooks/context';

function MyComponent() {
  const { toast } = useUI();

  const showSuccess = () => {
    toast('success', 'Operation completed!', 3000); // 3 second duration
  };

  const showError = () => {
    toast('error', 'Something went wrong!');
  };
}
```

### Global Loading
```tsx
import { useAppContext } from '@/hooks/context';

function DataComponent() {
  const { withGlobalLoading } = useAppContext();

  const fetchData = async () => {
    await withGlobalLoading(async () => {
      const data = await api.getData();
      // Process data
    });
  };
}
```

### Modals
```tsx
import { useUI } from '@/hooks/context';

function ModalComponent() {
  const { modals, toggleModal, openConfirmDialog } = useUI();

  const handleDelete = () => {
    openConfirmDialog({
      title: 'Confirm Delete',
      message: 'Are you sure you want to delete this item?',
      onConfirm: () => {
        // Delete logic
      },
      onCancel: () => {
        // Cancel logic
      },
    });
  };
}
```

## Admin Functionality

### User Management
```tsx
import { useAdmin, useAuth } from '@/hooks/context';

function AdminPanel() {
  const { canAccessAdmin } = useAuth();
  const { userManagement, setUserFilter, bulkUserAction } = useAdmin();

  if (!canAccessAdmin) return <div>Access Denied</div>;

  return (
    <div>
      <select onChange={(e) => setUserFilter(e.target.value)}>
        <option value="all">All Users</option>
        <option value="user">Users</option>
        <option value="admin">Admins</option>
      </select>
      
      <button onClick={() => bulkUserAction('suspend', userManagement.selectedUsers)}>
        Bulk Suspend
      </button>
    </div>
  );
}
```

### Audit Logging
```tsx
import { useAdmin } from '@/hooks/context';

function AuditComponent() {
  const { addAuditLog, auditLogs } = useAdmin();

  const logAction = (action: string, details: any) => {
    addAuditLog({
      userId: 'current-user-id',
      action,
      timestamp: new Date(),
      details,
    });
  };
}
```

## Financial Data

### Transactions
```tsx
import { useFinancial } from '@/hooks/context';

function TransactionForm() {
  const { addTransaction, calculateTotalBalance } = useFinancial();

  const handleSubmit = (transactionData) => {
    addTransaction({
      amount: transactionData.amount,
      description: transactionData.description,
      category: transactionData.category,
      date: new Date(),
      type: transactionData.type, // 'income' | 'expense'
    });

    const newBalance = calculateTotalBalance();
    console.log('New balance:', newBalance);
  };
}
```

## Developer Tools

The system includes a built-in developer panel when `devMode` is enabled:

### Features
- Quick login/logout for testing
- State inspection and debugging
- Error management
- Admin panel toggle
- API logging toggle

### Usage
```tsx
// Enable in development
<AppProvider enableDevMode={process.env.NODE_ENV === 'development'}>
  {children}
</AppProvider>
```

The dev panel appears in the bottom-right corner and provides:
- Quick authentication buttons
- Debug information toggle
- State visualization
- Error clearing
- Admin access shortcuts

## Best Practices

### 1. Use Specialized Hooks
Prefer specialized hooks over the main `useAppContext()` for better performance and clearer intent:

```tsx
// Good
const { user, requireAuth } = useAuth();

// Less optimal
const { auth: { user }, requireAuth } = useAppContext();
```

### 2. Handle Loading States
Always handle loading states for better UX:

```tsx
const { withGlobalLoading, toast } = useAppContext();

const handleAction = async () => {
  await withGlobalLoading(
    async () => {
      await api.performAction();
      toast('success', 'Action completed!');
    },
    (error) => {
      console.error('Action failed:', error);
    }
  );
};
```

### 3. Role-Based Rendering
Use permission checks for conditional rendering:

```tsx
const { hasPermission } = useAuth();

return (
  <div>
    {hasPermission('admin') && <AdminControls />}
    {hasPermission('user') && <UserControls />}
  </div>
);
```

### 4. Error Handling
Use the built-in error system:

```tsx
const { addError } = useUI();

try {
  await riskyOperation();
} catch (error) {
  addError(error.message, 'current-page');
}
```

## File Structure

```
src/hooks/context/
├── index.ts              # Main exports and constants
├── useAppState.tsx       # Zustand store definition
├── useAppStateManager.tsx # State manager with composed actions
├── useAppContext.tsx     # React context provider and hooks
└── README.md            # This documentation
```

## Type Safety

All state and actions are fully typed with TypeScript. The system exports comprehensive types for use throughout the application:

```tsx
import type { 
  UserProfile, 
  RouteName, 
  Role, 
  AppState 
} from '@/hooks/context';
```

## Migration from Examples

This context system is based on the examples in `src/hooks/examples/` but expanded for full application coverage. If you were using the examples, you can migrate by:

1. Replacing imports from `examples` to `context`
2. Using the specialized hooks for better performance
3. Taking advantage of the new admin and financial state management
4. Utilizing the enhanced developer tools

The API is backward compatible with the examples, so existing code should continue to work with minimal changes.