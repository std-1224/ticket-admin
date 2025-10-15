"use client"

import { BarChart2, Home, QrCode, Users, CalendarDays, Star } from "lucide-react"
import { cn } from "@/lib/utils"

interface MobileBottomNavProps {
  activePage: string
  setActivePage: (page: string) => void
  userRole?: string | null
}

export function MobileBottomNav({ activePage, setActivePage, userRole }: MobileBottomNavProps) {
  const allNavItems = [
    { id: "Dashboard", label: "Home", icon: Home, roles: ["admin", "master"] },
    { id: "Scanner", label: "Scanner", icon: QrCode, roles: ["admin", "master"] },
    { id: "Attendees", label: "Attendees", icon: Users, roles: ["admin", "master"] },
    { id: "VIP Guests", label: "VIP", icon: Star, roles: ["admin", "master"] },
    { id: "Analytics", label: "Stats", icon: BarChart2, roles: ["admin", "master"] },
    { id: "My Events", label: "Events", icon: CalendarDays, roles: ["admin", "master"] },
  ]

  // Filter nav items based on user role - only show items for admin/master roles
  const navItems = allNavItems.filter(item =>
    !userRole || item.roles.includes(userRole)
  )

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 bg-background/95 backdrop-blur-sm border-t border-border md:hidden">
      <div className="flex items-center justify-around px-2 py-2 safe-area-pb">
        {navItems.map((item) => {
          const isActive = activePage === item.id
          const Icon = item.icon

          return (
            <button
              key={item.id}
              onClick={() => setActivePage(item.id)}
              className={cn(
                "flex flex-col items-center justify-center min-w-0 flex-1 px-1 py-2 rounded-lg transition-all duration-200 active:scale-95",
                isActive
                  ? "text-primary bg-primary/10"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted/50",
              )}
            >
              <Icon className={cn("h-5 w-5 mb-1 transition-all duration-200", isActive ? "scale-110" : "scale-100")} />
              <span
                className={cn(
                  "text-xs font-medium truncate transition-all duration-200",
                  isActive ? "text-primary" : "text-muted-foreground",
                )}
              >
                {item.label}
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
