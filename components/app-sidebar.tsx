"use client"

import { BarChart2, CheckCircle, Home, QrCode, Users, CalendarDays, Shield, Star } from "lucide-react"

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar"
import { UserMenu } from "@/components/auth/user-menu"

interface AppSidebarProps {
  activePage: string
  setActivePage: (page: string) => void
  userRole?: string | null
}

export function AppSidebar({ activePage, setActivePage, userRole }: AppSidebarProps) {
  // Define all menu items with role restrictions
  const allMenuItems = [
    { id: "Dashboard", label: "Dashboard", icon: Home, roles: ["admin", "master"] },
    { id: "My Events", label: "All Events", icon: CalendarDays, roles: ["admin", "master"] },
    { id: "Scanner", label: "Scanner", icon: QrCode, roles: ["admin", "master"] },
    { id: "Attendees", label: "Attendees", icon: Users, roles: ["admin", "master"] },
    { id: "VIP Guests", label: "VIP Guests", icon: Star, roles: ["admin", "master"] },
    { id: "Analytics", label: "Analytics", icon: BarChart2, roles: ["admin", "master"] },
    { id: "Registration", label: "Registration", icon: CheckCircle, roles: ["admin", "master"] },
    { id: "Role Management", label: "Role Management", icon: Shield, roles: ["admin", "master"] },
  ]

  // Filter menu items based on user role - only show items for admin/master roles
  const menuItems = allMenuItems.filter(item =>
    !userRole || item.roles.includes(userRole)
  )

  return (
    <Sidebar variant="sidebar" collapsible="icon">
      <SidebarHeader className="p-4">
        <div className="flex items-center gap-2">
          <div className="bg-primary rounded-lg p-2 flex items-center justify-center">
            <CalendarDays className="h-6 w-6 text-primary-foreground" />
          </div>
          <span className="font-semibold text-lg group-data-[state=collapsed]/sidebar-wrapper:hidden">EventDash</span>
        </div>
      </SidebarHeader>
      <SidebarContent className="p-2">
        <SidebarMenu>
          {menuItems.map((item) => (
            <SidebarMenuItem key={item.id}>
              <SidebarMenuButton
                onClick={() => setActivePage(item.id)}
                isActive={activePage === item.id}
                tooltip={item.label}
                className="justify-start"
              >
                <item.icon className="h-5 w-5" />
                <span>{item.label}</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          ))}
        </SidebarMenu>
      </SidebarContent>
      <SidebarFooter className="p-2">
        <SidebarMenu>
          <SidebarMenuItem>
            <div className="flex items-center justify-center w-full">
              <UserMenu />
            </div>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  )
}
