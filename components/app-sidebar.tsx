"use client"

import { BarChart2, CheckCircle, Home, QrCode, Users, CalendarDays } from "lucide-react"

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
}

export function AppSidebar({ activePage, setActivePage }: AppSidebarProps) {
  const menuItems = [
    { id: "Dashboard", label: "Dashboard", icon: Home },
    // { id: "Events", label: "Event", icon: CalendarDays },
    { id: "My Events", label: "All Events", icon: CalendarDays },
    { id: "Scanner", label: "Scanner", icon: QrCode },
    { id: "Attendees", label: "Attendees", icon: Users },
    { id: "Analytics", label: "Analytics", icon: BarChart2 },
    
    { id: "Registration", label: "Registration", icon: CheckCircle },
  ]

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
