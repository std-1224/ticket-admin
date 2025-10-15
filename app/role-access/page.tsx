'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ShieldX, ArrowLeft, LogOut, ExternalLink, User } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { useAuth } from '@/contexts/auth-context'
import { supabase } from '@/lib/supabase'

export default function RoleAccessPage() {
  const { user, signOut } = useAuth()
  const router = useRouter()
  const [userRole, setUserRole] = useState<string | null>(null)
  const [userProfile, setUserProfile] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchUserProfile = async () => {
      if (!user) {
        setLoading(false)
        return
      }

      try {
        const { data: profile, error } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', user.id)
          .single()

        if (error) {
          console.error('Error fetching user profile:', error)
        } else {
          setUserProfile(profile)
          setUserRole(profile?.role || 'unknown')
        }
      } catch (error) {
        console.error('Error fetching user profile:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchUserProfile()
  }, [user])

  const handleSignOut = async () => {
    try {
      await signOut()
      router.push('/auth')
    } catch (error) {
      console.error('Error signing out:', error)
    }
  }

  const handleGoToClient = () => {
    // Redirect to client app (adjust URL as needed)
    window.open('https://ticket-client-two.vercel.app/', '_blank')
  }

  const getRoleColor = (role: string) => {
    switch (role) {
      case 'admin':
        return 'bg-red-100 text-red-800 border-red-200'
      case 'master':
        return 'bg-purple-100 text-purple-800 border-purple-200'
      case 'scanner':
        return 'bg-blue-100 text-blue-800 border-blue-200'
      case 'client':
      case 'buyer':
        return 'bg-green-100 text-green-800 border-green-200'
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200'
    }
  }

  const getAccessMessage = (role: string) => {
    switch (role) {
      case 'admin':
        return {
          title: 'Administrator Access',
          message: 'You have administrator privileges and should have access to this admin panel.',
          suggestion: 'If you\'re seeing this page, there might be a technical issue.'
        }
      case 'master':
        return {
          title: 'Master Access',
          message: 'You have master privileges and should have access to this admin panel.',
          suggestion: 'If you\'re seeing this page, there might be a technical issue.'
        }
      case 'scanner':
        return {
          title: 'Scanner Access',
          message: 'You have scanner privileges but this admin panel is restricted to administrators and masters only.',
          suggestion: 'Please contact your administrator for access.'
        }
      case 'client':
      case 'buyer':
        return {
          title: 'Client Access',
          message: 'You have client privileges. This admin panel is for administrators and masters only.',
          suggestion: 'Please use the client application for customer features.'
        }
      default:
        return {
          title: 'Unknown Role',
          message: 'Your account role is not recognized.',
          suggestion: 'Please contact your administrator for assistance.'
        }
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
          <p className="mt-2 text-sm text-muted-foreground">Loading user information...</p>
        </div>
      </div>
    )
  }

  const accessInfo = getAccessMessage(userRole || 'unknown')

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
              Access Restricted
            </CardTitle>
            <CardDescription className="text-base">
              {accessInfo.title}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* User Information */}
            <div className="bg-muted/50 rounded-lg p-4 space-y-3">
              <div className="flex items-center gap-2">
                <User className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium">User Information</span>
              </div>
              
              {user?.email && (
                <div className="text-sm">
                  <span className="text-muted-foreground">Email: </span>
                  <span className="font-medium">{user.email}</span>
                </div>
              )}
              
              {userProfile?.name && (
                <div className="text-sm">
                  <span className="text-muted-foreground">Name: </span>
                  <span className="font-medium">{userProfile.name}</span>
                </div>
              )}
              
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">Role: </span>
                <Badge className={getRoleColor(userRole || 'unknown')}>
                  {userRole || 'Unknown'}
                </Badge>
              </div>
            </div>

            {/* Access Message */}
            <div className="text-center space-y-2">
              <p className="text-sm text-muted-foreground">
                {accessInfo.message}
              </p>
              <p className="text-sm font-medium text-foreground">
                {accessInfo.suggestion}
              </p>
            </div>
            
            {/* Action Buttons */}
            <div className="space-y-3">
              {(userRole === 'client' || userRole === 'buyer') && (
                <Button 
                  onClick={handleGoToClient}
                  className="w-full"
                >
                  <ExternalLink className="h-4 w-4 mr-2" />
                  Go to Client App
                </Button>
              )}
              
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
