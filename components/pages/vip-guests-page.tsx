'use client'

import { useState, useEffect } from 'react'
import { Star, Plus, Search, MoreHorizontal, Mail, Eye, XCircle, Users, Calendar, CheckCircle, Clock } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { toast } from 'sonner'
import { supabase } from '@/lib/supabase'

interface VipGuest {
  id: string
  name: string
  email: string
  event_id: string
  event_name: string
  status: 'invited' | 'confirmed' | 'cancelled' | 'approved'
  qr_code: string
  notes?: string
  created_at: string
}

interface Event {
  id: string
  title: string
  date: string
  time: string
  location: string
  image_url: string
  created_by: string
  created_at: string
  description: string
  purchase_count: number
  ticket_count: number
}

export function VipGuestsPage() {
  const [vipGuests, setVipGuests] = useState<VipGuest[]>([])
  const [events, setEvents] = useState<Event[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedEvent, setSelectedEvent] = useState<string>('all')
  const [isAddModalOpen, setIsAddModalOpen] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [recentlyUpdatedGuests, setRecentlyUpdatedGuests] = useState<Set<string>>(new Set())

  // Form state
  const [newGuestName, setNewGuestName] = useState('')
  const [newGuestEmail, setNewGuestEmail] = useState('')
  const [newGuestEvent, setNewGuestEvent] = useState('')
  const [newGuestNotes, setNewGuestNotes] = useState('')

  // Fetch events
  const fetchEvents = async () => {
    try {
      const response = await fetch('/api/events/list?limit=100')
      const result = await response.json()

     if (!response.ok) {
        // Check if it's an auth error
        if (response.status === 401 || result.code === 'AUTH_ERROR') {
          return
        }
        throw new Error(result.error || 'Failed to fetch events data')
      }

      if (result.success) {
        setEvents(result.data.events || [])
      } else {
        throw new Error(result.error || 'Failed to fetch events data')
      }
    } catch (error) {
      console.error('Unexpected error fetching events:', error)
    }
  }

  // Fetch VIP guests
  const fetchVipGuests = async () => {
    try {
      setLoading(true)
      const { data, error } = await supabase
        .from('vip_guests')
        .select(`
          id,
          name,
          email,
          event_id,
          status,
          qr_code,
          notes,
          created_at,
          events!inner(title)
        `)
        .order('created_at', { ascending: false })

      if (error) {
        console.error('Error fetching VIP guests:', error)
        // If table doesn't exist, show a helpful message
        if (error.message?.includes('relation "vip_guests" does not exist')) {
          toast.error('VIP guests table not found. Please create the database table first.')
        } else {
          toast.error('Failed to fetch VIP guests')
        }
        return
      }

      const formattedGuests = data?.map(guest => ({
        ...guest,
        event_name: (guest.events as any)?.title || 'Unknown Event'
      })) || []

      setVipGuests(formattedGuests)
    } catch (error) {
      console.error('Unexpected error:', error)
      toast.error('Failed to fetch VIP guests')
    } finally {
      setLoading(false)
    }
  }

  // Setup real-time subscription for VIP guest changes
  const setupVipGuestSubscription = () => {
    const subscription = supabase
      .channel('admin_vip_guests_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'vip_guests'
        },
        (payload) => {
          console.log('Admin: VIP guest change detected:', payload)

          // Show toast notification for status changes
          if (payload.eventType === 'UPDATE' && payload.new && payload.old) {
            const oldStatus = (payload.old as any).status
            const newStatus = (payload.new as any).status
            const guestName = (payload.new as any).name
            const guestId = (payload.new as any).id

            if (oldStatus !== newStatus) {
              // Add to recently updated guests for visual highlighting
              setRecentlyUpdatedGuests(prev => new Set([...prev, guestId]))

              // Remove from recently updated after 5 seconds
              setTimeout(() => {
                setRecentlyUpdatedGuests(prev => {
                  const newSet = new Set(prev)
                  newSet.delete(guestId)
                  return newSet
                })
              }, 5000)

              if (newStatus === 'confirmed') {
                toast.success(`🎉 ${guestName} confirmed their VIP invitation!`)
              } else if (newStatus === 'cancelled') {
                toast.error(`❌ ${guestName} cancelled their VIP invitation`)
              }
            }
          } else if (payload.eventType === 'INSERT') {
            const guestName = (payload.new as any).name
            const guestId = (payload.new as any).id

            // Add to recently updated guests for visual highlighting
            setRecentlyUpdatedGuests(prev => new Set([...prev, guestId]))

            // Remove from recently updated after 3 seconds
            setTimeout(() => {
              setRecentlyUpdatedGuests(prev => {
                const newSet = new Set(prev)
                newSet.delete(guestId)
                return newSet
              })
            }, 3000)

            toast.info(`➕ New VIP guest added: ${guestName}`)
          } else if (payload.eventType === 'DELETE') {
            const guestName = (payload.old as any).name
            toast.info(`🗑️ VIP guest removed: ${guestName}`)
          }

          // Reload VIP guests to get updated data
          fetchVipGuests()
        }
      )
      .subscribe()

    return () => {
      subscription.unsubscribe()
    }
  }

  useEffect(() => {
    fetchEvents()
    fetchVipGuests()

    // Setup real-time subscription
    const unsubscribe = setupVipGuestSubscription()

    // Cleanup subscription on unmount
    return () => {
      if (unsubscribe) {
        unsubscribe()
      }
    }
  }, [])

  // Add new VIP guest
  const handleAddVipGuest = async () => {
    if (!newGuestName.trim() || !newGuestEmail.trim() || !newGuestEvent) {
      toast.error('Name, email, and event are required')
      return
    }

    if (!newGuestEmail.includes('@')) {
      toast.error('Please enter a valid email address')
      return
    }

    try {
      setIsSubmitting(true)

      // Generate QR code (simple UUID for now)
      const qrCode = `VIP-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`

      const { data: newGuest, error } = await supabase
        .from('vip_guests')
        .insert([
          {
            name: newGuestName.trim(),
            email: newGuestEmail.trim(),
            event_id: newGuestEvent,
            status: 'invited',
            qr_code: qrCode,
            notes: newGuestNotes.trim() || null,
            created_at: new Date().toISOString()
          }
        ])
        .select(`
          id,
          name,
          email,
          event_id,
          status,
          qr_code,
          notes,
          created_at,
          events!inner(title)
        `)
        .single()

      if (error) {
        console.error('Error creating VIP guest:', error)
        toast.error('Failed to add VIP guest')
        return
      }

      // Add to local state
      if (newGuest) {
        const formattedGuest = {
          ...newGuest,
          event_name: (newGuest.events as any)?.title || 'Unknown Event'
        }
        setVipGuests(prevGuests => [formattedGuest, ...prevGuests])
      }

      // Reset form
      setNewGuestName('')
      setNewGuestEmail('')
      setNewGuestEvent('')
      setNewGuestNotes('')
      setIsAddModalOpen(false)

      toast.success('VIP guest added and invitation sent!')
    } catch (error) {
      console.error('Unexpected error:', error)
      toast.error('Failed to add VIP guest')
    } finally {
      setIsSubmitting(false)
    }
  }

  // Update guest status
  const handleUpdateStatus = async (guestId: string, newStatus: 'invited' | 'confirmed' | 'cancelled') => {
    try {
      const { error } = await supabase
        .from('vip_guests')
        .update({ status: newStatus })
        .eq('id', guestId)

      if (error) {
        console.error('Error updating status:', error)
        toast.error('Failed to update status')
        return
      }

      // Update local state
      setVipGuests(prevGuests =>
        prevGuests.map(guest =>
          guest.id === guestId ? { ...guest, status: newStatus } : guest
        )
      )

      toast.success('Status updated successfully')
    } catch (error) {
      console.error('Unexpected error:', error)
      toast.error('Failed to update status')
    }
  }

  // Filter guests
  const filteredGuests = vipGuests.filter(guest => {
    const matchesSearch = guest.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         guest.email.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesEvent = selectedEvent === 'all' || guest.event_id === selectedEvent
    return matchesSearch && matchesEvent
  })

  // Calculate stats
  const totalVips = vipGuests.length
  const confirmedVips = vipGuests.filter(g => g.status === 'confirmed').length
  const invitedVips = vipGuests.filter(g => g.status === 'invited').length
  const approvedVips = vipGuests.filter(g => g.status === 'approved').length
  const cancelledVips = vipGuests.filter(g => g.status === 'cancelled').length

  const getStatusBadgeVariant = (status: string) => {
    switch (status) {
      case 'confirmed':
        return 'default'
      case 'invited':
        return 'secondary'
      case 'cancelled':
        return 'destructive'
      default:
        return 'outline'
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'confirmed':
        return <CheckCircle className="h-4 w-4" />
      case 'invited':
        return <Clock className="h-4 w-4" />
      case 'cancelled':
        return <XCircle className="h-4 w-4" />
      default:
        return null
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Star className="h-6 w-6 text-yellow-500" />
          <div>
            <h1 className="text-3xl font-bold tracking-tight">VIP Guests</h1>
            <p className="text-muted-foreground">
              Manage VIP invitations and special guests
            </p>
          </div>
        </div>
        
        <Dialog open={isAddModalOpen} onOpenChange={setIsAddModalOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Add VIP
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[500px]">
            <DialogHeader>
              <DialogTitle>Add New VIP Guest</DialogTitle>
              <DialogDescription>
                Complete the details to add a new VIP guest.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="name">Full Name</Label>
                <Input
                  id="name"
                  placeholder="Full name"
                  value={newGuestName}
                  onChange={(e) => setNewGuestName(e.target.value)}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="Email"
                  value={newGuestEmail}
                  onChange={(e) => setNewGuestEmail(e.target.value)}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="event">Select Event</Label>
                <Select value={newGuestEvent} onValueChange={setNewGuestEvent}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select event" />
                  </SelectTrigger>
                  <SelectContent>
                    {events.map((event) => (
                      <SelectItem key={event.id} value={event.id}>
                        {event.title}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="notes">Notes (optional)</Label>
                <Textarea
                  id="notes"
                  placeholder="Additional notes..."
                  value={newGuestNotes}
                  onChange={(e) => setNewGuestNotes(e.target.value)}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsAddModalOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleAddVipGuest} disabled={isSubmitting}>
                {isSubmitting ? 'Adding...' : 'Add VIP'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total VIPs</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalVips}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Confirmed</CardTitle>
            <CheckCircle className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{confirmedVips}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Invited</CardTitle>
            <Clock className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{invitedVips}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Approved</CardTitle>
            <XCircle className="h-4 w-4 text-red-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{approvedVips}</div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
          <Input
            placeholder="Search by name or email..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
        <Select value={selectedEvent} onValueChange={setSelectedEvent}>
          <SelectTrigger className="w-full sm:w-[200px]">
            <SelectValue placeholder="All events" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All events</SelectItem>
            {events.map((event) => (
              <SelectItem key={event.id} value={event.id}>
                {event.title}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* VIP Guests Table */}
      <Card>
        <CardHeader>
          <CardTitle>VIP Guest List</CardTitle>
          <CardDescription>
            {filteredGuests.length} VIP guest{filteredGuests.length !== 1 ? 's' : ''} found
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
          ) : filteredGuests.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              {searchTerm || selectedEvent !== 'all' ? 'No VIP guests match your filters' : 'No VIP guests found'}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Guest</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Event</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>QR Code</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredGuests.map((guest) => {
                  const isRecentlyUpdated = recentlyUpdatedGuests.has(guest.id)
                  return (
                  <TableRow
                    key={guest.id}
                    className={`transition-all duration-500 ${
                      isRecentlyUpdated
                        ? 'bg-blue-50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-800 shadow-md'
                        : ''
                    }`}
                  >
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <Avatar>
                          <AvatarFallback>
                            {guest.name.split(' ').map(n => n[0]).join('').toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <div className="font-medium">{guest.name}</div>
                          {guest.notes && (
                            <div className="text-sm text-muted-foreground truncate max-w-[200px]">
                              {guest.notes}
                            </div>
                          )}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>{guest.email}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Calendar className="h-4 w-4 text-muted-foreground" />
                        {guest.event_name}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={getStatusBadgeVariant(guest.status)}
                        className={`flex items-center gap-1 w-fit transition-all duration-500 ${
                          isRecentlyUpdated
                            ? 'animate-pulse ring-2 ring-blue-400 ring-opacity-50'
                            : ''
                        }`}
                      >
                        {getStatusIcon(guest.status)}
                        {guest.status}
                        {isRecentlyUpdated && (
                          <span className="ml-1 text-xs">✨</span>
                        )}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <code className="text-xs bg-muted px-2 py-1 rounded">
                        {guest.qr_code.slice(0, 12)}...
                      </code>
                    </TableCell>
                  </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
