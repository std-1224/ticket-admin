"use client"

import { useState } from "react"
import { useRouter, usePathname } from "next/navigation"
import { useAuth } from "@/contexts/auth-context"

import { AppSidebar } from "@/components/app-sidebar"
import { MobileBottomNav } from "@/components/mobile-bottom-nav"
import { SidebarProvider } from "@/components/ui/sidebar"

interface SharedLayoutProps {
  children: React.ReactNode
}

export function SharedLayout({ children }: SharedLayoutProps) {
  const router = useRouter()
  const pathname = usePathname()
  const { userRole } = useAuth()

  // Map pathnames to sidebar page IDs
  const getActivePageFromPath = (path: string) => {
    switch (path) {
      case "/resumen":
        return "Dashboard"
      case "/asistentes":
        return "Attendees"
      case "/registro":
        return "Registration"
      case "/escaner":
        return "Scanner"
      case "/analiticas":
        return "Analytics"
      case "/eventos":
        return "Events"
      case "/my-events":
        return "My Events"
      case "/vip-guests":
        return "VIP Guests"
      case "/role-management":
        return "Role Management"
      default:
        return "Dashboard"
    }
  }

  const [activePage, setActivePage] = useState(getActivePageFromPath(pathname))

  const handlePageChange = (page: string) => {
    setActivePage(page)

    // Navigate to the corresponding route
    switch (page) {
      case "Dashboard":
        router.push("/resumen")
        break
      case "Attendees":
        router.push("/asistentes")
        break
      case "Registration":
        router.push("/registro")
        break
      case "Scanner":
        router.push("/escaner")
        break
      case "Analytics":
        router.push("/analiticas")
        break
      case "Events":
        router.push("/eventos")
        break
      case "My Events":
        router.push("/my-events")
        break
      case "VIP Guests":
        router.push("/vip-guests")
        break
      case "Role Management":
        router.push("/role-management")
        break
      default:
        router.push("/resumen")
    }
  }

  return (
    <SidebarProvider>
      <div className="flex h-screen w-full">
        <AppSidebar activePage={activePage} setActivePage={handlePageChange} userRole={userRole} />
        <main className="flex-1 overflow-auto">
          <div className="p-3 sm:p-6 lg:p-8 max-w-7xl mx-auto">
            {children}
          </div>
        </main>
        <MobileBottomNav activePage={activePage} setActivePage={handlePageChange} userRole={userRole} />
      </div>
    </SidebarProvider>
  )
}
