import { supabase } from './supabase'

/**
 * Client-side helper to sign out
 */
export async function signOut() {
  const { error } = await supabase.auth.signOut()
  if (error) {
    console.error('Error signing out:', error)
    throw error
  }
}

/**
 * Client-side helper to sign in with email and password
 */
export async function signInWithPassword(email: string, password: string) {
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  })
  
  if (error) {
    console.error('Error signing in:', error)
    throw error
  }
  
  return data
}

/**
 * Client-side helper to sign up with email and password
 */
export async function signUpWithPassword(email: string, password: string, redirectTo?: string) {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: redirectTo || `${process.env.NEXT_PUBLIC_REDIRECT_URL}/auth/callback`,
    },
  })
  
  if (error) {
    console.error('Error signing up:', error)
    throw error
  }
  
  return data
}

/**
 * Client-side helper to sign in with OAuth provider
 */
export async function signInWithOAuth(provider: 'google' | 'github' | 'facebook' | 'twitter', redirectTo?: string) {
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider,
    options: {
      redirectTo: redirectTo || `${process.env.NEXT_PUBLIC_REDIRECT_URL}/auth/callback`,
    },
  })
  
  if (error) {
    console.error(`Error signing in with ${provider}:`, error)
    throw error
  }
  
  return data
}

/**
 * Client-side helper to reset password
 */
export async function resetPassword(email: string, redirectTo?: string) {
  const { data, error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: redirectTo || `${process.env.NEXT_PUBLIC_REDIRECT_URL}/auth/callback`,
  })
  
  if (error) {
    console.error('Error resetting password:', error)
    throw error
  }
  
  return data
}

/**
 * Client-side helper to update password
 */
export async function updatePassword(password: string) {
  const { data, error } = await supabase.auth.updateUser({
    password,
  })
  
  if (error) {
    console.error('Error updating password:', error)
    throw error
  }
  
  return data
}
