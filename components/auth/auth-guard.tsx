'use client'

import { useEffect } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { useAuth } from '@/contexts/auth-context'

// Define all protected routes
const PROTECTED_ROUTES = [
  '/resumen',
  '/asistentes',
  '/registro',
  '/escaner',
  '/analiticas',
  '/eventos',
  '/my-events'
]



interface AuthGuardProps {
  children: React.ReactNode
}

export function AuthGuard({ children }: AuthGuardProps) {
  const { user, loading } = useAuth()
  const router = useRouter()
  const pathname = usePathname()

  useEffect(() => {
    // Don't do anything while loading
    if (loading) return

    // Check if current route is protected
    const isProtectedRoute = PROTECTED_ROUTES.some(route => pathname.startsWith(route))

    console.log('AuthGuard - Path:', pathname, 'Protected:', isProtectedRoute, 'User:', !!user)

    // If user is not authenticated and trying to access a protected route
    if (!user && isProtectedRoute) {
      console.log('Redirecting to auth - no user on protected route')
      router.push('/auth')
      return
    }

    // If user is authenticated and trying to access auth pages, redirect to dashboard
    if (user && pathname === '/auth') {
      console.log('Redirecting to dashboard - user on auth page')
      router.push('/resumen')
      return
    }

    // If user is not authenticated and on root path, redirect to auth
    if (!user && pathname === '/') {
      console.log('Redirecting to auth - no user on root')
      router.push('/auth')
      return
    }

    // If user is authenticated and on root path, redirect to dashboard
    if (user && pathname === '/') {
      console.log('Redirecting to dashboard - user on root')
      router.push('/resumen')
      return
    }

  }, [user, loading, pathname, router])

  // Show loading state while checking authentication
  if (loading) {
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
