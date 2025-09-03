'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { ShieldX, ArrowLeft, LogOut } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { useAuth } from '@/contexts/auth-context'

export default function AccessDeniedPage() {
  const { user, signOut } = useAuth()
  const router = useRouter()

  const handleSignOut = async () => {
    try {
      await signOut()
      router.push('/auth')
    } catch (error) {
      console.error('Error signing out:', error)
    }
  }

  const handleGoBack = () => {
    // Go back to the previous page or to the main client app
    window.history.back()
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <Card className="border-destructive/20">
          <CardHeader className="text-center">
            <div className="flex justify-center mb-4">
              <div className="bg-destructive/10 rounded-full p-3 flex items-center justify-center">
                <ShieldX className="h-12 w-12 text-destructive" />
              </div>
            </div>
            <CardTitle className="text-2xl font-bold text-destructive">
              Access Denied
            </CardTitle>
            <CardDescription className="text-base">
              You don't have permission to access the admin panel
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="text-center space-y-2">
              <p className="text-sm text-muted-foreground">
                This area is restricted to administrators and scanner operators only.
              </p>
              {user?.email && (
                <p className="text-xs text-muted-foreground">
                  Signed in as: <span className="font-medium">{user.email}</span>
                </p>
              )}
            </div>
            
            <div className="space-y-3">
              <Button 
                onClick={handleGoBack}
                variant="outline" 
                className="w-full"
              >
                <ArrowLeft className="h-4 w-4 mr-2" />
                Go Back
              </Button>
              
              <Button 
                onClick={handleSignOut}
                variant="destructive" 
                className="w-full"
              >
                <LogOut className="h-4 w-4 mr-2" />
                Sign Out
              </Button>
            </div>

            <div className="text-center">
              <p className="text-xs text-muted-foreground">
                If you believe this is an error, please contact your administrator.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
