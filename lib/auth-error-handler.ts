// Global auth error handler - will be set by the auth context
let globalAuthErrorHandler: ((error: any) => boolean) | null = null

export function setGlobalAuthErrorHandler(handler: (error: any) => boolean) {
  globalAuthErrorHandler = handler
}

// Helper function to handle Supabase errors
export function handleSupabaseError(error: any) {
  if (globalAuthErrorHandler && globalAuthErrorHandler(error)) {
    // Error was handled by auth context (JWT expired, etc.)
    return
  }
  // Re-throw the error if it wasn't an auth error
  throw new Error(error.message)
}

// Helper function to check if an error is an auth error
export function isAuthError(error: any): boolean {
  const errorMessage = error?.message || error?.error_description || error?.error || ''
  
  return (
    errorMessage.includes('JWT expired') ||
    errorMessage.includes('invalid JWT') ||
    errorMessage.includes('token has expired') ||
    errorMessage.includes('Authentication required') ||
    errorMessage.includes('Invalid JWT') ||
    error?.status === 401 ||
    error?.code === 'PGRST301' // PostgREST JWT expired error
  )
}
