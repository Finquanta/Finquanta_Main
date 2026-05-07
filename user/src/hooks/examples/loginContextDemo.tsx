"use client";

import React, { useState } from "react";
import { useAuth, useUI } from "../context/SimpleAppProvider";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Loader2Icon, UserIcon, LogOutIcon, ShieldIcon, InfoIcon, CheckCircleIcon, AlertCircleIcon } from "lucide-react";

/**
 * Comprehensive Login Context Demo for Developers
 * 
 * This demo showcases:
 * - Real authentication flow using the context
 * - Token management
 * - User state management
 * - Error handling
 * - Success/failure feedback
 * - Integration with UI context for toasts and loading states
 */
export default function LoginContextDemo() {
  const auth = useAuth();
  const ui = useUI();
  
  // Local state for the demo
  const [email, setEmail] = useState("demo@Finquantaai.com");
  const [password, setPassword] = useState("demopassword");
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  
  // State for demo user management
  const [demoUsers] = useState([
    {
      id: "user-1",
      name: "Demo User",
      email: "demo@Finquantaai.com",
      role: "user" as const,
      password: "demopassword",
    },
    {
      id: "admin-1", 
      name: "Demo Admin",
      email: "admin@Finquantaai.com",
      role: "admin" as const,
      password: "adminpassword",
    },
    {
      id: "dev-1",
      name: "Developer",
      email: "dev@Finquantaai.com", 
      role: "developer" as const,
      password: "devpassword",
    }
  ]);

  // Simulate API login
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoggingIn(true);
    
    try {
      ui.beginLoading(); // Use UI context for loading state
      
      // Find demo user
      const demoUser = demoUsers.find(user => 
        user.email === email && user.password === password
      );
      
      if (!demoUser) {
        throw new Error("Invalid credentials");
      }
      
      // Simulate API delay
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      // Generate demo tokens
      const accessToken = `demo_access_${demoUser.id}_${Date.now()}`;
      const refreshToken = `demo_refresh_${demoUser.id}_${Date.now()}`;
      
      // Update auth context
      auth.login({
        token: accessToken,
        refreshToken,
        user: {
          id: demoUser.id,
          name: demoUser.name,
          email: demoUser.email,
          role: demoUser.role,
          avatarUrl: null,
          createdAt: new Date(),
          lastLoginAt: new Date(),
          preferences: {
            notifications: true,
            emailUpdates: true,
            darkMode: false,
          }
        }
      });
      
      // Show success toast
      ui.toast("success", `Welcome back, ${demoUser.name}!`, 4000);
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Login failed";
      ui.toast("error", errorMessage, 5000);
      ui.addError(errorMessage, "login-demo");
      auth.incrementLoginAttempts();
    } finally {
      setIsLoggingIn(false);
      ui.endLoading();
    }
  };
  
  // Handle logout
  const handleLogout = () => {
    auth.logout();
    ui.toast("info", "You have been logged out", 3000);
    setEmail("");
    setPassword("");
  };
  
  // Quick login functions for demo
  const quickLogin = (userType: 'user' | 'admin' | 'developer') => {
    const user = demoUsers.find(u => u.role === userType);
    if (user) {
      setEmail(user.email);
      setPassword(user.password);
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      <div className="text-center mb-8">
        <h1 className="text-3xl font-bold mb-2">🔐 Login Context Demo</h1>
        <p className="text-gray-600">
          Comprehensive authentication demo showcasing context integration
        </p>
      </div>
      
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Login Form */}
        <Card className="p-6">
          <h2 className="text-xl font-semibold mb-4 flex items-center">
            <UserIcon className="mr-2 h-5 w-5" />
            Authentication
          </h2>
          
          {!auth.isAuthenticated ? (
            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
                  Email
                </label>
                <Input
                  type="email"
                  id="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Enter your email"
                  disabled={isLoggingIn}
                  required
                />
              </div>
              
              <div>
                <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">
                  Password
                </label>
                <Input
                  type="password"
                  id="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  disabled={isLoggingIn}
                  required
                />
              </div>
              
              <Button 
                type="submit" 
                className="w-full" 
                disabled={isLoggingIn || !email || !password}
              >
                {isLoggingIn && <Loader2Icon className="mr-2 h-4 w-4 animate-spin" />}
                Sign In
              </Button>
              
              {auth.loginAttempts > 0 && (
                <div className="text-sm text-orange-600 flex items-center">
                  <AlertCircleIcon className="mr-1 h-4 w-4" />
                  Login attempts: {auth.loginAttempts}
                </div>
              )}
            </form>
          ) : (
            <div className="text-center space-y-4">
              <div className="flex items-center justify-center text-green-600 mb-2">
                <CheckCircleIcon className="mr-2 h-6 w-6" />
                <span className="font-medium">Authenticated</span>
              </div>
              
              <div className="bg-green-50 p-4 rounded-lg">
                <p className="text-sm text-green-800">
                  <strong>Welcome, {auth.user?.name}!</strong>
                </p>
                <p className="text-xs text-green-600 mt-1">
                  Role: {auth.user?.role} • Last login: {auth.user?.lastLoginAt?.toLocaleString()}
                </p>
              </div>
              
              <Button 
                onClick={handleLogout}
                variant="outline"
                className="w-full"
              >
                <LogOutIcon className="mr-2 h-4 w-4" />
                Sign Out
              </Button>
            </div>
          )}
        </Card>
        
        {/* Demo Controls */}
        <Card className="p-6">
          <h2 className="text-xl font-semibold mb-4 flex items-center">
            <ShieldIcon className="mr-2 h-5 w-5" />
            Demo Controls
          </h2>
          
          <div className="space-y-4">
            <div>
              <h3 className="text-sm font-medium text-gray-700 mb-2">Quick Login As:</h3>
              <div className="space-y-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => quickLogin('user')}
                  className="w-full justify-start"
                  disabled={auth.isAuthenticated}
                >
                  👤 Regular User (demo@Finquantaai.com)
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => quickLogin('admin')}
                  className="w-full justify-start"
                  disabled={auth.isAuthenticated}
                >
                  ⚡ Admin User (admin@Finquantaai.com)
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => quickLogin('developer')}
                  className="w-full justify-start"
                  disabled={auth.isAuthenticated}
                >
                  🛠️ Developer (dev@Finquantaai.com)
                </Button>
              </div>
            </div>
            
            <div className="border-t pt-4">
              <h3 className="text-sm font-medium text-gray-700 mb-2">Context Actions:</h3>
              <div className="space-y-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => ui.toast("info", "Test toast message", 3000)}
                  className="w-full justify-start"
                >
                  📢 Test Toast Message
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => ui.addError("Test error message", "demo")}
                  className="w-full justify-start"
                >
                  ⚠️ Add Test Error
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => ui.clearErrors()}
                  className="w-full justify-start"
                >
                  🧹 Clear All Errors
                </Button>
              </div>
            </div>
          </div>
        </Card>
      </div>
      
      {/* State Display */}
      <Card className="p-6">
        <h2 className="text-xl font-semibold mb-4 flex items-center">
          <InfoIcon className="mr-2 h-5 w-5" />
          Current State
        </h2>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <h3 className="text-sm font-medium text-gray-700 mb-2">Authentication State</h3>
            <div className="bg-gray-50 p-3 rounded text-sm font-mono">
              <div>isAuthenticated: <span className={auth.isAuthenticated ? "text-green-600" : "text-red-600"}>{auth.isAuthenticated.toString()}</span></div>
              <div>accessToken: <span className="text-blue-600">{auth.accessToken ? "***" + auth.accessToken.slice(-8) : "null"}</span></div>
              <div>refreshToken: <span className="text-blue-600">{auth.refreshToken ? "***" + auth.refreshToken.slice(-8) : "null"}</span></div>
              <div>loginAttempts: <span className="text-orange-600">{auth.loginAttempts}</span></div>
              <div>isLoading: <span className={auth.isLoading ? "text-yellow-600" : "text-gray-600"}>{auth.isLoading.toString()}</span></div>
            </div>
          </div>
          
          <div>
            <h3 className="text-sm font-medium text-gray-700 mb-2">User Profile</h3>
            <div className="bg-gray-50 p-3 rounded text-sm font-mono">
              {auth.user ? (
                <>
                  <div>id: <span className="text-purple-600">{auth.user.id}</span></div>
                  <div>name: <span className="text-green-600">{auth.user.name}</span></div>
                  <div>email: <span className="text-blue-600">{auth.user.email}</span></div>
                  <div>role: <span className="text-red-600">{auth.user.role}</span></div>
                </>
              ) : (
                <div className="text-gray-500">No user data</div>
              )}
            </div>
          </div>
          
          <div>
            <h3 className="text-sm font-medium text-gray-700 mb-2">UI State</h3>
            <div className="bg-gray-50 p-3 rounded text-sm font-mono">
              <div>theme: <span className="text-indigo-600">{ui.theme}</span></div>
              <div>loadingCount: <span className="text-yellow-600">{ui.loadingCount}</span></div>
              <div>errors: <span className="text-red-600">{ui.errors.length}</span></div>
              <div>lastToast: <span className="text-blue-600">{ui.lastToast ? ui.lastToast.type : "none"}</span></div>
            </div>
          </div>
          
          <div>
            <h3 className="text-sm font-medium text-gray-700 mb-2">Available Methods</h3>
            <div className="bg-gray-50 p-3 rounded text-xs">
              <div className="text-green-600">✓ login()</div>
              <div className="text-red-600">✓ logout()</div>
              <div className="text-blue-600">✓ updateUserProfile()</div>
              <div className="text-purple-600">✓ requireAuth()</div>
              <div className="text-orange-600">✓ requireRole()</div>
              <div className="text-gray-600">✓ hasPermission()</div>
            </div>
          </div>
        </div>
      </Card>
      
      {/* Integration Examples */}
      <Card className="p-6">
        <h2 className="text-xl font-semibold mb-4">Integration Examples</h2>
        
        <div className="space-y-4">
          <div>
            <h3 className="text-sm font-medium text-gray-700 mb-2">Role-based Access</h3>
            <div className="space-y-2">
              <div className="flex items-center space-x-2">
                <span className="text-sm">Admin Panel:</span>
                <span className={`px-2 py-1 rounded text-xs ${
                  auth.user?.role === 'admin' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                }`}>
                  {auth.user?.role === 'admin' ? 'Accessible' : 'Restricted'}
                </span>
              </div>
              <div className="flex items-center space-x-2">
                <span className="text-sm">User Dashboard:</span>
                <span className={`px-2 py-1 rounded text-xs ${
                  auth.isAuthenticated ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                }`}>
                  {auth.isAuthenticated ? 'Accessible' : 'Requires Login'}
                </span>
              </div>
              <div className="flex items-center space-x-2">
                <span className="text-sm">Developer Tools:</span>
                <span className={`px-2 py-1 rounded text-xs ${
                  auth.user?.role === 'developer' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                }`}>
                  {auth.user?.role === 'developer' ? 'Accessible' : 'Restricted'}
                </span>
              </div>
            </div>
          </div>
          
          <div className="border-t pt-4">
            <h3 className="text-sm font-medium text-gray-700 mb-2">Code Example</h3>
            <pre className="bg-gray-900 text-green-400 p-3 rounded text-xs overflow-x-auto">
{`// Using the authentication context in components
import { useAuth } from '@/hooks/context';

function ProtectedComponent() {
  const { isAuthenticated, user, requireAuth } = useAuth();
  
  // Check authentication in event handlers or conditional rendering
  const handleProtectedAction = () => {
    if (!requireAuth()) return;
    // Perform protected action...
  };
  
  if (!isAuthenticated) {
    return <div>Please log in...</div>;
  }
  
  return (
    <div>
      Welcome, {user?.name}!
      Role: {user?.role}
      <button onClick={handleProtectedAction}>
        Protected Action
      </button>
    </div>
  );
}`}
            </pre>
          </div>
        </div>
      </Card>
    </div>
  );
}
