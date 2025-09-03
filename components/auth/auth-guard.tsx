'use client'

import { useEffect, useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { useAuth } from '@/contexts/auth-context'
import { supabase } from '@/lib/supabase'

// Define all protected routes (require admin or scanner role)
const PROTECTED_ROUTES = [
  '/resumen',
  '/asistentes',
  '/registro',
  '/escaner',
  '/analiticas',
  '/eventos',
  '/my-events'
]

// Routes that authenticated users can access regardless of role
const PUBLIC_AUTH_ROUTES = [
  '/access-denied'
]



interface AuthGuardProps {
  children: React.ReactNode
}

export function AuthGuard({ children }: AuthGuardProps) {
  const { user, loading } = useAuth()
  const router = useRouter()
  const pathname = usePathname()
  const [roleChecked, setRoleChecked] = useState(false)
  const [userRole, setUserRole] = useState<string | null>(null)

  // Check user role when user is available
  useEffect(() => {
    const checkUserRole = async () => {
      if (!user || roleChecked) return

      try {
        const { data: userData, error } = await supabase
          .from('users')
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

    console.log('AuthGuard - Path:', pathname, 'PublicAuth:', isPublicAuthRoute, 'User:', !!user, 'Role:', userRole)

    // If user is not authenticated, redirect to auth (except for auth page itself)
    if (!user && pathname !== '/auth') {
      console.log('Redirecting to auth - no user')
      router.push('/auth')
      return
    }

    // If user is authenticated but has buyer role, redirect to access denied (except if already on access-denied)
    if (user && userRole === 'buyer' && !isPublicAuthRoute) {
      console.log('Redirecting to access denied - buyer role not allowed')
      router.push('/access-denied')
      return
    }

    // If user is authenticated with proper role (admin/scanner) and trying to access auth pages, redirect to dashboard
    if (user && userRole && userRole !== 'buyer' && pathname === '/auth') {
      console.log('Redirecting to dashboard - authorized user on auth page')
      router.push('/resumen')
      return
    }

    // If user is authenticated with proper role (admin/scanner) and on root path, redirect to dashboard
    if (user && userRole && userRole !== 'buyer' && pathname === '/') {
      console.log('Redirecting to dashboard - authorized user on root')
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
