"use client";

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2Icon } from 'lucide-react';
import { useAuth } from '@/hooks/context/SimpleAppProvider';

interface ProtectedRouteProps {
  children: React.ReactNode;
  requireAuth?: boolean;
  redirectTo?: string;
  allowedRoles?: string[];
}

/**
 * ProtectedRoute component that checks authentication status
 * and redirects unauthorized users to the login page
 */
export default function ProtectedRoute({ 
  children, 
  requireAuth = true, 
  redirectTo = '/login',
  allowedRoles = []
}: ProtectedRouteProps) {
  const router = useRouter();
  const auth = useAuth(); // Use our Zustand-based auth context
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const checkAuth = async () => {
      console.log('🔒 ProtectedRoute checking auth:', {
        isAuthenticated: auth.isAuthenticated,
        user: auth.user?.name || 'None',
        accessToken: auth.accessToken ? '***' + auth.accessToken.slice(-4) : 'None',
        requireAuth,
        redirectTo
      });

      try {
        // Use Zustand state instead of localStorage directly
        if (!auth.accessToken) {
          console.log('🔒 No access token found in Zustand state');
          setIsLoading(false);
          if (requireAuth) {
            console.log('🔒 Redirecting to:', redirectTo);
            router.push(redirectTo);
          }
          return;
        }

        // Check if user is authenticated in our state
        if (auth.isAuthenticated && auth.user) {
          console.log('🔒 User authenticated via Zustand:', auth.user.name);
          
          // Check role-based access if roles are specified
          if (allowedRoles.length > 0 && !allowedRoles.includes(auth.user.role)) {
            console.log('🔒 User role not allowed:', auth.user.role, 'Required:', allowedRoles);
            router.push('/unauthorized');
            return;
          }
          
          console.log('🔒 Access granted!');
        } else {
          console.log('🔒 User not authenticated in Zustand state');
          if (requireAuth) {
            console.log('🔒 Redirecting to:', redirectTo);
            router.push(redirectTo);
          }
        }
      } catch (error) {
        console.error('🔒 Auth check failed:', error);
        if (requireAuth) {
          router.push(redirectTo);
        }
      } finally {
        setIsLoading(false);
      }
    };

    checkAuth();
  }, [auth.isAuthenticated, auth.accessToken, auth.user, requireAuth, redirectTo, allowedRoles, router]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="flex flex-col items-center space-y-4">
          <Loader2Icon className="h-8 w-8 animate-spin" />
          <p className="text-sm text-gray-600">Checking authentication...</p>
        </div>
      </div>
    );
  }

  if (requireAuth && !auth.isAuthenticated) {
    // Will be redirected by useEffect, show loading state
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="flex flex-col items-center space-y-4">
          <Loader2Icon className="h-8 w-8 animate-spin" />
          <p className="text-sm text-gray-600">Redirecting to login...</p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
