'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { CalendarDays, MapPin, Clock, Users, Plus, Eye, Edit, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { useToast } from '@/hooks/use-toast'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/auth-context'

interface TicketType {
  id: string
  event_id: string
  name: string
  price: number
  total_quantity: number
  combo: string | null
  description: string | null
  created_at: string
}

interface Event {
  id: string
  title: string
  description: string | null
  date: string
  time: string | null
  location: string | null
  image_url: string | null
  created_by: string
  created_at: string
  total_tickets_sold?: number
  ticket_types?: TicketType[]
}

export function MyEventsContent() {
  const [events, setEvents] = useState<Event[]>([])
  const [loading, setLoading] = useState(true)
  const { user } = useAuth()
  const { toast } = useToast()
  const router = useRouter()

  useEffect(() => {
    if (user) {
      fetchMyEvents()
    }
  }, [user])

  const fetchMyEvents = async () => {
    try {
      setLoading(true)

      // First, fetch events without ticket types to ensure basic functionality works
      const { data: eventsData, error: eventsError } = await supabase
        .from('events')
        .select('*')
        .order('created_at', { ascending: false })

      if (eventsError) {
        throw eventsError
      }

      // Then try to fetch ticket types for each event separately
      const eventsWithTickets = await Promise.all(
        (eventsData || []).map(async (event) => {
          try {
            const { data: ticketTypes, error: ticketError } = await supabase
              .from('ticket_types')
              .select('id, name, price, quantity, combo, description, created_at')
              .eq('event_id', event.id)

            // If ticket_types table doesn't exist or there's an error, just return event without tickets
            if (ticketError) {
              console.warn('Could not fetch ticket types for event:', event.id, ticketError)
              return { ...event, ticket_types: [] }
            }

            return { ...event, ticket_types: ticketTypes || [] }
          } catch (error) {
            console.warn('Error fetching tickets for event:', event.id, error)
            return { ...event, ticket_types: [] }
          }
        })
      )

      setEvents(eventsWithTickets)
    } catch (err: any) {
      console.error('Error fetching my events:', err)
      toast({
        title: "Error",
        description: "Could not load your events",
        variant: "destructive"
      })
    } finally {
      setLoading(false)
    }
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleDateString('en-US', {
      month: 'long',
      day: 'numeric',
      year: 'numeric'
    })
  }

  const formatTime = (timeString: string | null) => {
    if (!timeString) return null
    const [hours, minutes] = timeString.split(':')
    const hour = parseInt(hours)
    const ampm = hour >= 12 ? 'PM' : 'AM'
    const displayHour = hour % 12 || 12
    return `${displayHour}:${minutes} ${ampm}`
  }

  const isUpcoming = (dateString: string) => {
    const eventDate = new Date(dateString)
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    return eventDate >= today
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary"></div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">All Events</h1>
          <p className="text-muted-foreground">
            Manage and create new events
          </p>
        </div>
        <Button onClick={() => router.push('/eventos')} className="w-full sm:w-auto">
          <Plus className="mr-2 h-4 w-4" />
          Create New Event
        </Button>
      </div>

      {/* Events Grid */}
      {events.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <CalendarDays className="h-16 w-16 text-muted-foreground mb-4 opacity-50" />
          <h3 className="text-xl font-semibold mb-2">No events yet</h3>
          <p className="text-muted-foreground mb-6 max-w-md">
            You haven't created any events yet. Start by creating your first event to manage attendees and track sales.
          </p>
          <Button onClick={() => router.push('/eventos')}>
            <Plus className="mr-2 h-4 w-4" />
            Create Your First Event
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {events.map((event) => {
            const upcoming = isUpcoming(event.date)
            
            return (
              <Card key={event.id} className="overflow-hidden hover:shadow-lg transition-shadow">
                {/* Event Image */}
                <div className="aspect-video bg-muted relative overflow-hidden">
                  {event.image_url ? (
                    <img
                      src={event.image_url}
                      alt={event.title}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-primary/20 to-primary/5">
                      <CalendarDays className="h-12 w-12 text-primary/40" />
                    </div>
                  )}
                  <div className="absolute top-3 right-3">
                    <Badge variant={upcoming ? "default" : "secondary"}>
                      {upcoming ? "Active" : "Past"}
                    </Badge>
                  </div>
                </div>

                {/* Event Content */}
                <CardContent className="p-4">
                  <div className="space-y-3">
                    {/* Title */}
                    <h3 className="font-semibold text-lg line-clamp-2">{event.title}</h3>

                    {/* Event Details */}
                    <div className="space-y-2 text-sm text-muted-foreground">
                      <div className="flex items-center gap-2">
                        <CalendarDays className="h-4 w-4" />
                        <span>{formatDate(event.date)}</span>
                      </div>
                      {event.time && (
                        <div className="flex items-center gap-2">
                          <Clock className="h-4 w-4" />
                          <span>{formatTime(event.time)}</span>
                        </div>
                      )}
                      {event.location && (
                        <div className="flex items-center gap-2">
                          <MapPin className="h-4 w-4" />
                          <span className="line-clamp-1">{event.location}</span>
                        </div>
                      )}
                    </div>

                    {/* Description */}
                    {event.description && (
                      <p className="text-sm text-muted-foreground line-clamp-2">
                        {event.description}
                      </p>
                    )}

                    {/* Ticket Types */}
                    {event.ticket_types && event.ticket_types.length > 0 && (
                      <div className="space-y-2">
                        <div className="text-xs font-medium text-muted-foreground">Ticket Types:</div>
                        <div className="flex flex-wrap gap-1">
                          {event.ticket_types.slice(0, 3).map((ticket) => (
                            <Badge key={ticket.id} variant="secondary" className="text-xs">
                              {ticket.name} - ${ticket.price}
                            </Badge>
                          ))}
                          {event.ticket_types.length > 3 && (
                            <Badge variant="outline" className="text-xs">
                              +{event.ticket_types.length - 3} more
                            </Badge>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Stats */}
                    <div className="flex items-center justify-between pt-2 border-t">
                      <div className="flex items-center gap-1 text-muted-foreground">
                        <Users className="h-4 w-4" />
                        <span className="text-xs">{event.total_tickets_sold || 0} tickets sold</span>
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {event.ticket_types?.length || 0} ticket types
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex gap-2 pt-2">
                      <Button
                        variant="outline"
                        size="sm"
                        className="flex-1"
                        onClick={() => router.push(`/eventos?eventId=${event.id}`)}
                      >
                        <Eye className="h-4 w-4 mr-1" />
                        View
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
