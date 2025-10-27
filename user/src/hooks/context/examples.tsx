/**
 * Example Integration: How to integrate the App Context into your application
 * 
 * This file demonstrates the recommended way to integrate the context system
 * into the Fiscal AI application.
 */

import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { 
  AppProvider, 
  useAuth, 
  useNavigation, 
  useUI, 
  useAdmin,
  useFinancial,
  useAppContext,
  withAppContext 
} from "@/hooks/context";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Fiscal AI",
  description:
    "Fiscal AI is modern money management platform powered by AI. Track expenses, optimize investments, and reach your goals—all in one place.",
};

/**
 * Example of how to modify your root layout to include the AppProvider
 */
export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <AppProvider 
          enableDevMode={process.env.NODE_ENV === 'development'}
          initialRoute="home"
          onRouteChange={(route) => {
            // Optional: Track route changes for analytics
            console.log('Route changed to:', route);
          }}
        >
          {children}
        </AppProvider>
      </body>
    </html>
  );
}

/**
 * Example component using the context hooks
 */
function ExampleAuthComponent() {
  const { user, isAuthenticated, requireAuth, handleAuthSuccess } = useAuth();
  const { navigateWithBreadcrumbs } = useNavigation();
  const { toast } = useUI();

  const handleLogin = async (credentials: { email: string; password: string }) => {
    try {
      // Your login API call
      const response = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(credentials),
      });

      if (!response.ok) throw new Error('Login failed');

      const data = await response.json();
      
      // Use the context's auth handler
      await handleAuthSuccess({
        token: data.accessToken,
        refreshToken: data.refreshToken,
        user: data.user,
      });

    } catch (error) {
      toast('error', 'Login failed. Please check your credentials.');
    }
  };

  const handleProtectedAction = () => {
    if (!requireAuth('Please log in to access this feature')) return;
    
    // Your protected logic here
    toast('success', 'Protected action completed!');
  };

  if (!isAuthenticated) {
    return (
      <div className="login-form">
        <h2>Please Log In</h2>
        {/* Your login form here */}
        <button onClick={() => handleLogin({ email: 'test@example.com', password: 'password' })}>
          Test Login
        </button>
      </div>
    );
  }

  return (
    <div className="user-dashboard">
      <h2>Welcome, {user?.name}!</h2>
      <p>Role: {user?.role}</p>
      <button onClick={handleProtectedAction}>
        Protected Action
      </button>
      <button onClick={() => navigateWithBreadcrumbs('dashboard', ['Dashboard'])}>
        Go to Dashboard
      </button>
    </div>
  );
}

/**
 * Example admin component with role-based access
 */
function ExampleAdminComponent() {
  const { requireRole, user } = useAuth();
  const { adminPanelOpen, toggleAdminPanel, bulkUserAction } = useAdmin();
  const { toast } = useUI();

  // Check admin permissions
  if (!requireRole('admin', 'Admin access required')) {
    return <div>Access Denied</div>;
  }

  const handleBulkAction = () => {
    bulkUserAction('suspend', ['user1', 'user2']);
    toast('success', 'Bulk action completed');
  };

  return (
    <div className="admin-panel">
      <h2>Admin Panel</h2>
      <p>Welcome, Admin {user?.name}!</p>
      
      <button onClick={() => toggleAdminPanel()}>
        {adminPanelOpen ? 'Close' : 'Open'} Admin Panel
      </button>
      
      <button onClick={handleBulkAction}>
        Test Bulk Action
      </button>
    </div>
  );
}

/**
 * Example financial component
 */
function ExampleFinancialComponent() {
  const { 
    dashboardData, 
    addTransaction, 
    calculateTotalBalance,
    getMonthlyExpenses 
  } = useFinancial();
  const { toast } = useUI();

  const handleAddExpense = () => {
    addTransaction({
      amount: 50.00,
      description: 'Coffee and snacks',
      category: 'Food',
      date: new Date(),
      type: 'expense',
    });

    const newBalance = calculateTotalBalance();
    toast('success', `Expense added! New balance: $${newBalance.toFixed(2)}`);
  };

  const monthlyExpenses = getMonthlyExpenses();

  return (
    <div className="financial-dashboard">
      <h2>Financial Overview</h2>
      <div className="stats">
        <p>Total Balance: ${dashboardData.totalBalance.toFixed(2)}</p>
        <p>Monthly Expenses: ${monthlyExpenses.toFixed(2)}</p>
        <p>Savings: ${dashboardData.savings.toFixed(2)}</p>
      </div>
      
      <button onClick={handleAddExpense}>
        Add Test Expense
      </button>
    </div>
  );
}

/**
 * Example of using the withAppContext HOC
 */
const MyComponentWithContext = withAppContext(function MyComponent() {
  // This component automatically has access to the context
  const { theme, switchTheme } = useUI();
  
  return (
    <div>
      <p>Current theme: {theme}</p>
      <button onClick={() => switchTheme()}>
        Toggle Theme
      </button>
    </div>
  );
});

/**
 * Example of global loading usage
 */
function ExampleLoadingComponent() {
  const { withGlobalLoading, isLoading } = useAppContext();

  const handleAsyncAction = async () => {
    await withGlobalLoading(
      async () => {
        // Simulate API call
        await new Promise(resolve => setTimeout(resolve, 2000));
        return 'Success!';
      },
      (error: unknown) => {
        console.error('Action failed:', error);
      }
    );
  };

  return (
    <div>
      <button 
        onClick={handleAsyncAction} 
        disabled={isLoading}
      >
        {isLoading ? 'Loading...' : 'Start Async Action'}
      </button>
    </div>
  );
}

export {
  ExampleAuthComponent,
  ExampleAdminComponent,
  ExampleFinancialComponent,
  MyComponentWithContext,
  ExampleLoadingComponent,
};