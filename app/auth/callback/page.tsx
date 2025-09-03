import { redirect } from 'next/navigation'
import { createServerSupabaseClient } from '@/lib/auth-server'

export default async function AuthCallbackPage({
  searchParams,
}: {
  searchParams: Promise<{ code?: string; error?: string; error_description?: string }>
}) {
  const { code, error, error_description } = await searchParams

  if (error) {
    console.error('Auth callback error:', error, error_description)
    // Redirect to auth page with error
    redirect(`/auth?error=${encodeURIComponent(error_description || error)}`)
  }

  if (code) {
    const supabase = await createServerSupabaseClient()

    try {
      // Exchange the code for a session
      const { data, error: exchangeError } = await supabase.auth.exchangeCodeForSession(code)

      if (exchangeError) {
        console.error('Error exchanging code for session:', exchangeError)
        redirect(`/auth?error=${encodeURIComponent(exchangeError.message)}`)
      }

      if (data.user) {
        console.log('User authenticated successfully:', data.user.email)

        // Save user to database if not already exists
        try {
          const { error: dbError } = await supabase
            .from('users')
            .upsert([
              {
                id: data.user.id,
                email: data.user.email,
                name: data.user.user_metadata?.full_name ||
                      data.user.user_metadata?.name ||
                      data.user.email?.split('@')[0] ||
                      'Usuario',
                role: data.user.user_metadata?.role || 'buyer',
                created_at: new Date().toISOString()
              }
            ], {
              onConflict: 'id',
              ignoreDuplicates: false
            })

          if (dbError) {
            console.error('Error saving user to database:', dbError)
          } else {
            console.log('User saved/updated in database successfully')
          }
        } catch (err) {
          console.error('Unexpected error saving user:', err)
        }

        // Check user role from database to get the most up-to-date role
        try {
          const { data: userData, error: userError } = await supabase
            .from('users')
            .select('role')
            .eq('id', data.user.id)
            .single()

          if (userError) {
            console.error('Error fetching user role:', userError)
            redirect(`/auth?error=${encodeURIComponent('Failed to verify user permissions')}`)
          }

          const userRole = userData?.role || 'buyer'
          console.log('User role:', userRole)

          // Check if user has admin or scanner role
          if (userRole !== 'admin' && userRole !== 'scanner') {
            console.log('Access denied - user role is:', userRole)
            // Sign out the user and redirect to auth with error message
            await supabase.auth.signOut()
            redirect(`/auth?error=${encodeURIComponent('Access denied. This application is restricted to administrators and scanner operators only.')}`)
          }

          // Redirect to the main dashboard for authorized users
          redirect('/resumen')
        } catch (err) {
          console.error('Unexpected error checking user role:', err)
          redirect(`/auth?error=${encodeURIComponent('Failed to verify user permissions')}`)
        }
      }
    } catch (error: any) {
      console.error('Unexpected error in auth callback:', error)
      redirect(`/auth?error=${encodeURIComponent('Authentication failed')}`)
    }
  }

  // If no code and no error, redirect to auth page
  redirect('/auth')
}