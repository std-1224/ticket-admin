import { redirect } from 'next/navigation'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

/**
 * Create a Supabase client for server-side operations
 * This should be used in Server Components, Route Handlers, and Server Actions
 */
export async function createServerSupabaseClient() {
  const cookieStore = await cookies()

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {
            // The `setAll` method was called from a Server Component.
            // This can be ignored if you have middleware refreshing
            // user sessions.
          }
        },
      },
    }
  )
}

/**
 * Get the current user on the server side
 * Returns null if no user exists
 */
export async function getServerUser() {
  try {
    const supabase = await createServerSupabaseClient()
    const { data: { user }, error } = await supabase.auth.getUser()

    if (error) {
      console.error('Error getting server user:', error)
      return null
    }

    return user
  } catch (error) {
    console.error('Unexpected error getting server user:', error)
    return null
  }
}

/**
 * Get the current session on the server side
 * Returns null if no session exists
 */
export async function getServerSession() {
  try {
    const supabase = await createServerSupabaseClient()
    const { data: { session }, error } = await supabase.auth.getSession()

    if (error) {
      console.error('Error getting server session:', error)
      return null
    }

    return session
  } catch (error) {
    console.error('Unexpected error getting server session:', error)
    return null
  }
}

/**
 * Protect a page by requiring authentication
 * Redirects to /auth if user is not authenticated
 * Use this in Server Components or page components
 */
export async function requireAuth() {
  const user = await getServerUser()
  
  if (!user) {
    redirect('/auth')
  }
  
  return user
}

/**
 * Protect a page by requiring authentication and return both user and session
 * Redirects to /auth if user is not authenticated
 */
export async function requireAuthWithSession() {
  const [user, session] = await Promise.all([
    getServerUser(),
    getServerSession()
  ])
  
  if (!user || !session) {
    redirect('/auth')
  }
  
  return { user, session }
}

/**
 * Redirect authenticated users away from auth pages
 * Use this on login/signup pages to redirect already authenticated users
 */
export async function redirectIfAuthenticated(redirectTo: string = '/resumen') {
  const user = await getServerUser()
  
  if (user) {
    redirect(redirectTo)
  }
}

/**
 * Get user data without redirecting
 * Returns null if not authenticated
 * Use this when you want to conditionally show content based on auth status
 */
export async function getOptionalAuth() {
  const [user, session] = await Promise.all([
    getServerUser(),
    getServerSession()
  ])
  
  return { user, session }
}

/**
 * Check if user has admin or master role (for ticket-admin app)
 * Redirects to role-access page if user doesn't have admin or master role
 */
export async function requireAdminRole() {
  const user = await requireAuth()

  // Get user profile from database to check role
  const supabase = await createServerSupabaseClient()
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  const userRole = profile?.role || 'unknown'

  if (userRole !== 'admin' && userRole !== 'master') {
    redirect('/role-access')
  }

  return user
}

/**
 * Check if user has a specific role
 * Note: This checks the role from the profiles table in the database
 */
export async function requireRole(requiredRole: string) {
  const user = await requireAuth()

  // Get user profile from database to check role
  const supabase = await createServerSupabaseClient()
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  const userRole = profile?.role || 'unknown'

  if (userRole !== requiredRole) {
    redirect('/role-access')
  }

  return user
}

/**
 * Check if user has any of the specified roles
 */
export async function requireAnyRole(requiredRoles: string[]) {
  const user = await requireAuth()
  
  // Check user metadata for role
  const userRole = user.user_metadata?.role || user.app_metadata?.role
  
  if (!requiredRoles.includes(userRole)) {
    redirect('/unauthorized')
  }
  
  return user
}
