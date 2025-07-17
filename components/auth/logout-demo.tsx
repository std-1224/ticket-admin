'use client'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { LogoutButton, LogoutMenuItem, LogoutCompactButton } from './logout-button'
import { UserMenu } from './user-menu'
import { Separator } from '@/components/ui/separator'

export function LogoutDemo() {
  return (
    <div className="space-y-6 p-6">
      <Card>
        <CardHeader>
          <CardTitle>Logout Components Demo</CardTitle>
          <CardDescription>
            Different ways to implement logout functionality in your app
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Standard Logout Button */}
          <div className="space-y-2">
            <h3 className="text-sm font-medium">Standard Logout Button</h3>
            <LogoutButton />
          </div>

          <Separator />

          {/* Different Variants */}
          <div className="space-y-2">
            <h3 className="text-sm font-medium">Button Variants</h3>
            <div className="flex gap-2 flex-wrap">
              <LogoutButton variant="default" size="sm">
                Default
              </LogoutButton>
              <LogoutButton variant="destructive" size="sm">
                Destructive
              </LogoutButton>
              <LogoutButton variant="outline" size="sm">
                Outline
              </LogoutButton>
              <LogoutButton variant="secondary" size="sm">
                Secondary
              </LogoutButton>
              <LogoutButton variant="ghost" size="sm">
                Ghost
              </LogoutButton>
            </div>
          </div>

          <Separator />

          {/* Compact Button */}
          <div className="space-y-2">
            <h3 className="text-sm font-medium">Compact Button</h3>
            <LogoutCompactButton />
          </div>

          <Separator />

          {/* Menu Item */}
          <div className="space-y-2">
            <h3 className="text-sm font-medium">Menu Item (for dropdowns)</h3>
            <div className="w-48 border rounded-md p-1">
              <LogoutMenuItem />
            </div>
          </div>

          <Separator />

          {/* User Menu */}
          <div className="space-y-2">
            <h3 className="text-sm font-medium">Complete User Menu</h3>
            <div className="flex justify-start">
              <UserMenu />
            </div>
          </div>

          <Separator />

          {/* Usage Examples */}
          <div className="space-y-2">
            <h3 className="text-sm font-medium">Usage Examples</h3>
            <div className="text-sm text-muted-foreground space-y-1">
              <p>• <strong>Sidebar Footer:</strong> Use UserMenu component</p>
              <p>• <strong>Header/Navbar:</strong> Use LogoutButton or UserMenu</p>
              <p>• <strong>Dropdown Menus:</strong> Use LogoutMenuItem</p>
              <p>• <strong>Compact Spaces:</strong> Use LogoutCompactButton</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
