'use client'

import { useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { CalendarDays, AlertCircle } from 'lucide-react'
import { useAuth } from '@/contexts/auth-context'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { CustomAuthForm } from '@/components/auth/custom-auth-form'

export default function AuthPage() {
  const { user, loading } = useAuth()
  const router = useRouter()
  const searchParams = useSearchParams()
  const [authError, setAuthError] = useState<string | null>(null)

  useEffect(() => {
    if (user && !loading) {
      router.push('/resumen')
    }
  }, [user, loading, router])

  useEffect(() => {
    // Check for error in URL params (from callback)
    const error = searchParams.get('error')
    if (error) {
      setAuthError(decodeURIComponent(error))
      // Clear the error from URL
      const newUrl = new URL(window.location.href)
      newUrl.searchParams.delete('error')
      window.history.replaceState({}, '', newUrl.toString())
    }
  }, [searchParams])

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary"></div>
      </div>
    )
  }

  if (user) {
    return null // Will redirect
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        {/* Header with branding matching the sidebar */}
        <div className="text-center">
          <div className="flex justify-center mb-6">
            <div className="bg-primary rounded-lg p-3 flex items-center justify-center">
              <CalendarDays className="h-8 w-8 text-primary-foreground" />
            </div>
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">
            EventDash
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Event administration panel
          </p>
        </div>

        {/* Error Alert */}
        {authError && (
          <Alert variant="destructive" className="mb-4">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              {authError}
            </AlertDescription>
          </Alert>
        )}

        {/* Custom Auth Form */}
        <CustomAuthForm />

        {/* Footer */}
        <div className="text-center text-sm text-muted-foreground">
          <p>© 2024 EventDash. All rights reserved.</p>
        </div>
      </div>
    </div>
  )
}
