'use client'

import { useEffect, useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { useAuth } from '@/contexts/auth-context'
import { supabase } from '@/lib/supabase'

// Define routes with their required roles (admin and master allowed)
const ROUTE_PERMISSIONS = {
  '/resumen': ['admin', 'master'],
  '/my-events': ['admin', 'master'],
  '/escaner': ['admin', 'master'],
  '/asistentes': ['admin', 'master'],
  '/registro': ['admin', 'master'],
  '/analiticas': ['admin', 'master'],
  '/eventos': ['admin', 'master'],
  '/role-management': ['admin', 'master'],
  '/vip-guests': ['admin', 'master']
}

// Define all protected routes (require admin or scanner role)
const PROTECTED_ROUTES = Object.keys(ROUTE_PERMISSIONS)

// Routes that authenticated users can access regardless of role
const PUBLIC_AUTH_ROUTES = [
  '/access-denied',
  '/role-access'
]



interface AuthGuardProps {
  children: React.ReactNode
}

export function AuthGuard({ children }: AuthGuardProps) {
  const { user, loading, userRole, setUserRole } = useAuth()
  const router = useRouter()
  const pathname = usePathname()
  const [roleChecked, setRoleChecked] = useState(false)

  // Check user role when user is available
  useEffect(() => {
    const checkUserRole = async () => {
      if (!user || roleChecked) return

      try {
        const { data: userData, error } = await supabase
          .from('profiles')
          .select('role')
          .eq('id', user.id)
          .single()

        if (error) {
          console.error('Error fetching user role:', error)
          setUserRole('buyer') // Default to buyer if error
        } else {
          setUserRole(userData?.role || 'buyer')
        }
      } catch (error) {
        console.error('Unexpected error checking user role:', error)
        setUserRole('buyer') // Default to buyer if error
      } finally {
        setRoleChecked(true)
      }
    }

    checkUserRole()
  }, [user, roleChecked])

  useEffect(() => {
    // Don't do anything while loading or role not checked
    if (loading || (user && !roleChecked)) return

    // Check if current route is public auth route (access-denied page)
    const isPublicAuthRoute = PUBLIC_AUTH_ROUTES.some(route => pathname.startsWith(route))

    // If user is not authenticated, redirect to auth (except for auth page itself)
    if (!user && pathname !== '/auth') {
      router.push('/auth')
      return
    }

    // If user is authenticated but doesn't have admin or master role, redirect to role-access page
    if (user && userRole && userRole !== 'admin' && userRole !== 'master' && !isPublicAuthRoute) {
      router.push('/role-access')
      return
    }

    // Admin users have access to all routes in the admin panel
    // No additional route-specific permission checks needed since only admins are allowed

    // If user is authenticated with admin/master role and trying to access auth pages, redirect to dashboard
    if (user && (userRole === 'admin' || userRole === 'master') && pathname === '/auth') {
      router.push('/resumen')
      return
    }

    // If user is authenticated with admin/master role and on root path, redirect to dashboard
    if (user && (userRole === 'admin' || userRole === 'master') && pathname === '/') {
      router.push('/resumen')
      return
    }

  }, [user, loading, pathname, router, roleChecked, userRole])

  // Show loading state while checking authentication or user role
  if (loading || (user && !roleChecked)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary"></div>
      </div>
    )
  }

  // Check if current route is protected and user is not authenticated
  const isProtectedRoute = PROTECTED_ROUTES.some(route => pathname.startsWith(route))
  if (isProtectedRoute && !user) {
    // Show loading while redirect is happening
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary"></div>
      </div>
    )
  }

  // Render children for all other cases
  return <>{children}</>
}
