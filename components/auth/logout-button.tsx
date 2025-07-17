'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/contexts/auth-context'
import { useToast } from '@/hooks/use-toast'

interface LogoutButtonProps {
  variant?: 'default' | 'destructive' | 'outline' | 'secondary' | 'ghost' | 'link'
  size?: 'default' | 'sm' | 'lg' | 'icon'
  showText?: boolean
  className?: string
  children?: React.ReactNode
}

export function LogoutButton({
  variant = 'ghost',
  size = 'default',
  showText = true,
  className,
  children
}: LogoutButtonProps) {
  const [isLoading, setIsLoading] = useState(false)
  const { signOut } = useAuth()
  const router = useRouter()
  const { toast } = useToast()

  const handleLogout = async () => {
    setIsLoading(true)
    try {
      await signOut()
      
      toast({
        title: "Sesión cerrada",
        description: "Has cerrado sesión exitosamente",
      })
      
      // Redirect to auth page
      router.push('/auth')
    } catch (error: any) {
      console.error('Error during logout:', error)
      toast({
        title: "Error",
        description: error.message || "Error al cerrar sesión",
        variant: "destructive"
      })
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Button
      variant={variant}
      size={size}
      onClick={handleLogout}
      disabled={isLoading}
      className={className}
    >
      {isLoading && (
        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-current mr-2" />
      )}
      {children || (showText && 'Cerrar sesión')}
    </Button>
  )
}

// Simplified logout button for dropdowns/menus
export function LogoutMenuItem({ className }: { className?: string }) {
  return (
    <LogoutButton
      variant="ghost"
      size="sm"
      className={`w-full justify-start ${className}`}
    >
      Cerrar sesión
    </LogoutButton>
  )
}

// Compact logout button
export function LogoutCompactButton({ className }: { className?: string }) {
  return (
    <LogoutButton
      variant="ghost"
      size="sm"
      showText={true}
      className={className}
      aria-label="Cerrar sesión"
    >
      Salir
    </LogoutButton>
  )
}
