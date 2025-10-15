'use client'

import { useState, useEffect } from 'react'
import { Plus, Shield, User, Mail, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { toast } from 'sonner'
import { supabase } from '@/lib/supabase'

interface User {
  id: string
  email: string
  name: string
  role: string
  created_at: string
}

export function RoleManagementPage() {
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [isAddModalOpen, setIsAddModalOpen] = useState(false)
  const [newUserEmail, setNewUserEmail] = useState('')
  const [newUserRole, setNewUserRole] = useState<'admin' | 'scanner'>('scanner')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [updatingRoles, setUpdatingRoles] = useState<Set<string>>(new Set())
  const [removingUsers, setRemovingUsers] = useState<Set<string>>(new Set())

  // Fetch admin and scanner users
  const fetchUsers = async (): Promise<void> => {
    try {
      setLoading(true)
      const { data, error } = await supabase
        .from('profiles')
        .select('id, email, name, role, created_at')
        .in('role', ['admin', 'scanner'])
        .order('created_at', { ascending: false })

      if (error) {
        console.error('Error fetching users:', error)
        toast.error('Failed to fetch users')
        return
      }

      setUsers(data || [])
    } catch (error) {
      console.error('Unexpected error:', error)
      toast.error('Failed to fetch users')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchUsers()
  }, [])

  // Add new user with role
  const handleAddUser = async () => {
    if (!newUserEmail.trim()) {
      toast.error('Email is required')
      return
    }

    if (!newUserEmail.includes('@')) {
      toast.error('Please enter a valid email address')
      return
    }

    try {
      setIsSubmitting(true)

      // Check if user already exists
      const { data: existingUser, error: checkError } = await supabase
        .from('profiles')
        .select('id, email, name, role, created_at')
        .eq('email', newUserEmail.trim())
        .single()

      if (checkError && checkError.code !== 'PGRST116') {
        console.error('Error checking existing user:', checkError)
        toast.error('Failed to check user existence')
        return
      }

      if (existingUser) {
        // User exists, update their role
        const { error: updateError } = await supabase
          .from('profiles')
          .update({ role: newUserRole })
          .eq('id', existingUser.id)

        if (updateError) {
          console.error('Error updating user role:', updateError)
          toast.error('Failed to update user role')
          return
        }

        // Check if user is already in the list (has admin/scanner role)
        const userInList = users.find(u => u.id === existingUser.id)
        if (userInList) {
          // Update existing user in the list
          setUsers(prevUsers =>
            prevUsers.map(user =>
              user.id === existingUser.id ? { ...user, role: newUserRole } : user
            )
          )
        } else {
          // Add user to the list (they were previously a buyer)
          const updatedUser = {
            id: existingUser.id,
            email: existingUser.email,
            name: existingUser.name || existingUser.email.split('@')[0],
            role: newUserRole,
            created_at: existingUser.created_at || new Date().toISOString()
          }
          setUsers(prevUsers => [updatedUser, ...prevUsers])
        }

        toast.success(`Updated ${existingUser.email} role to ${newUserRole}`)
      } else {
        // User doesn't exist, create new user record
        const newUser = {
          email: newUserEmail.trim(),
          name: newUserEmail.split('@')[0], // Use email prefix as default name
          role: newUserRole,
          created_at: new Date().toISOString()
        }

        const { data: insertedUser, error: insertError } = await supabase
          .from('profiles')
          .insert([newUser])
          .select('id, email, name, role, created_at')
          .single()

        if (insertError) {
          console.error('Error creating user:', insertError)
          toast.error('Failed to create user')
          return
        }

        // Add the new user to the list
        if (insertedUser) {
          console.log('Adding new user to list:', insertedUser)
          setUsers(prevUsers => {
            const newList = [insertedUser, ...prevUsers]
            console.log('Updated users list length:', newList.length)
            return newList
          })
        } else {
          console.error('No user data returned from insert')
          toast.error('User created but not displayed. Please refresh.')
          // Fallback: refresh the entire list
          await fetchUsers()
        }

        toast.success(`Added ${newUserEmail} as ${newUserRole}`)
      }

      // Reset form and close modal
      setNewUserEmail('')
      setNewUserRole('scanner')
      setIsAddModalOpen(false)

    } catch (error) {
      console.error('Unexpected error:', error)
      toast.error('Failed to add user')
      // Fallback: refresh the entire list to ensure consistency
      await fetchUsers()
    } finally {
      setIsSubmitting(false)
    }
  }

  // Update user role
  const handleUpdateRole = async (userId: string, newRole: 'admin' | 'scanner') => {
    // Prevent multiple simultaneous updates for the same user
    if (updatingRoles.has(userId)) return

    try {
      setUpdatingRoles(prev => new Set(prev).add(userId))

      // Optimistically update the UI first
      setUsers(prevUsers =>
        prevUsers.map(user =>
          user.id === userId ? { ...user, role: newRole } : user
        )
      )

      const { error } = await supabase
        .from('profiles')
        .update({ role: newRole })
        .eq('id', userId)

      if (error) {
        console.error('Error updating role:', error)
        toast.error('Failed to update role')
        // Revert the optimistic update on error
        await fetchUsers()
        return
      }

      toast.success('Role updated successfully')
    } catch (error) {
      console.error('Unexpected error:', error)
      toast.error('Failed to update role')
      // Revert the optimistic update on error
      await fetchUsers()
    } finally {
      setUpdatingRoles(prev => {
        const newSet = new Set(prev)
        newSet.delete(userId)
        return newSet
      })
    }
  }

  // Remove user (set role to buyer)
  const handleRemoveUser = async (userId: string, userEmail: string) => {
    if (!confirm(`Are you sure you want to remove ${userEmail} from admin/scanner roles?`)) {
      return
    }

    // Prevent multiple simultaneous removals for the same user
    if (removingUsers.has(userId)) return

    try {
      setRemovingUsers(prev => new Set(prev).add(userId))

      // Optimistically remove the user from the UI first
      setUsers(prevUsers => prevUsers.filter(user => user.id !== userId))

      const { error } = await supabase
        .from('profiles')
        .update({ role: 'buyer' })
        .eq('id', userId)

      if (error) {
        console.error('Error removing user:', error)
        toast.error('Failed to remove user')
        // Revert the optimistic update on error
        await fetchUsers()
        return
      }

      toast.success('User removed successfully')
    } catch (error) {
      console.error('Unexpected error:', error)
      toast.error('Failed to remove user')
      // Revert the optimistic update on error
      await fetchUsers()
    } finally {
      setRemovingUsers(prev => {
        const newSet = new Set(prev)
        newSet.delete(userId)
        return newSet
      })
    }
  }

  const getRoleBadgeVariant = (role: string) => {
    switch (role) {
      case 'admin':
        return 'default'
      case 'scanner':
        return 'secondary'
      default:
        return 'outline'
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Role Management</h1>
          <p className="text-muted-foreground">
            Manage admin and scanner user roles
          </p>
        </div>
        
        <Dialog open={isAddModalOpen} onOpenChange={setIsAddModalOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Add Member
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle>Add New Member</DialogTitle>
              <DialogDescription>
                Add a new admin or scanner member to the system.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="user@example.com"
                  value={newUserEmail}
                  onChange={(e) => setNewUserEmail(e.target.value)}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="role">Role</Label>
                <Select value={newUserRole} onValueChange={(value: 'admin' | 'scanner') => setNewUserRole(value)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a role" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="admin">Admin</SelectItem>
                    <SelectItem value="scanner">Scanner</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsAddModalOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleAddUser} disabled={isSubmitting}>
                {isSubmitting ? 'Adding...' : 'Add Role'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Admin & Scanner Users
          </CardTitle>
          <CardDescription>
            Users with administrative or scanner privileges
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
          ) : users.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No admin or scanner users found
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>User</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Added</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.map((user) => (
                  <TableRow key={user.id}>
                    <TableCell className="flex items-center gap-2">
                      <User className="h-4 w-4" />
                      <span className="font-medium">{user.name}</span>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Mail className="h-4 w-4 text-muted-foreground" />
                        {user.email}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={getRoleBadgeVariant(user.role)}>
                        {user.role}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {new Date(user.created_at).toLocaleDateString()}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        <div className="relative">
                          <Select
                            value={user.role}
                            onValueChange={(value: 'admin' | 'scanner') => handleUpdateRole(user.id, value)}
                            disabled={updatingRoles.has(user.id)}
                          >
                            <SelectTrigger className="w-24">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="admin">Admin</SelectItem>
                              <SelectItem value="scanner">Scanner</SelectItem>
                            </SelectContent>
                          </Select>
                          {updatingRoles.has(user.id) && (
                            <div className="absolute inset-0 flex items-center justify-center bg-background/50 rounded">
                              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary"></div>
                            </div>
                          )}
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleRemoveUser(user.id, user.email)}
                          disabled={removingUsers.has(user.id)}
                        >
                          {removingUsers.has(user.id) ? (
                            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-current"></div>
                          ) : (
                            <Trash2 className="h-4 w-4" />
                          )}
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
