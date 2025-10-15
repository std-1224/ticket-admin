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

      // Then try to fetch ticket types and tickets sold for each event separately
      const eventsWithTickets = await Promise.all(
        (eventsData || []).map(async (event) => {
          try {
            // Fetch ticket types
            const { data: ticketTypes, error: ticketError } = await supabase
              .from('ticket_types')
              .select('id, name, price, total_quantity, combo, description, created_at')
              .eq('event_id', event.id)

            // If ticket_types table doesn't exist or there's an error, just return event without tickets
            if (ticketError) {
              console.warn('Could not fetch ticket types for event:', event.id, ticketError)
              return { ...event, ticket_types: [], total_tickets_sold: 0 }
            }

            // Fetch tickets sold count from order_items with status 'delivered'
            let totalTicketsSold = 0
            try {
              const { data: orderItems, error: orderItemsError } = await supabase
                .from('event_order_items')
                .select('amount')
                .eq('event_id', event.id)
                .eq('status', 'delivered')

              if (!orderItemsError && orderItems) {
                totalTicketsSold = orderItems.reduce((sum, item) => sum + (item.amount || 1), 0)
              }
            } catch (error) {
              console.warn('Could not fetch tickets sold for event:', event.id, error)
            }

            return {
              ...event,
              ticket_types: ticketTypes || [],
              total_tickets_sold: totalTicketsSold
            }
          } catch (error) {
            console.warn('Error fetching tickets for event:', event.id, error)
            return { ...event, ticket_types: [], total_tickets_sold: 0 }
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
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b bg-card/50 backdrop-blur-sm sticky top-0 z-10">
        <div className="container mx-auto px-6 py-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="text-3xl font-bold tracking-tight">All Events</h1>
              <p className="text-muted-foreground mt-1">
                Manage and create new events
              </p>
            </div>
            <Button
              onClick={() => router.push('/eventos')}
              className="w-full sm:w-auto bg-primary hover:bg-primary/90 shadow-lg"
              size="lg"
            >
              <Plus className="mr-2 h-4 w-4" />
              Create New Event
            </Button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="container mx-auto px-6 py-8">

        {/* Events Grid */}
        {events.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="bg-muted/30 rounded-full p-6 mb-6">
              <CalendarDays className="h-16 w-16 text-muted-foreground opacity-50" />
            </div>
            <h3 className="text-2xl font-semibold mb-3">No events yet</h3>
            <p className="text-muted-foreground mb-8 max-w-md leading-relaxed">
              You haven't created any events yet. Start by creating your first event to manage attendees and track sales.
            </p>
            <Button
              onClick={() => router.push('/eventos')}
              size="lg"
              className="shadow-lg"
            >
              <Plus className="mr-2 h-4 w-4" />
              Create Your First Event
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-8">
            {events.map((event) => {
              const upcoming = isUpcoming(event.date)

              return (
                <Card key={event.id} className="group overflow-hidden hover:shadow-xl transition-all duration-300 hover:-translate-y-1 border-0 shadow-md bg-card/50 backdrop-blur-sm flex flex-col h-full">
                  {/* Event Image */}
                  <div className="aspect-[16/10] bg-muted relative overflow-hidden">
                    {event.image_url ? (
                      <img
                        src={event.image_url}
                        alt={event.title}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-primary/20 via-primary/10 to-primary/5">
                        <CalendarDays className="h-16 w-16 text-primary/30" />
                      </div>
                    )}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent" />
                    <div className="absolute top-4 right-4">
                      <Badge
                        variant={upcoming ? "default" : "secondary"}
                        className={`shadow-lg bg-green-500 hover:bg-green-600`}
                      >
                        {event.date}
                      </Badge>
                    </div>
                  </div>

                  {/* Event Content */}
                  <CardContent className="p-6 flex flex-col flex-1">
                    <div className="space-y-4 flex-1">
                      {/* Title */}
                      <div>
                        <h3 className="font-bold text-xl line-clamp-2 group-hover:text-primary transition-colors">
                          {event.title}
                        </h3>
                      </div>

                      {/* Event Details */}
                      <div className="space-y-3">
                        <div className="flex items-center gap-3 text-muted-foreground">
                          <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary/10">
                            <CalendarDays className="h-4 w-4 text-primary" />
                          </div>
                          <span className="font-medium">{formatDate(event.date)}</span>
                        </div>
                        {event.time && (
                          <div className="flex items-center gap-3 text-muted-foreground">
                            <div className="flex items-center justify-center w-8 h-8 rounded-full bg-blue-50">
                              <Clock className="h-4 w-4 text-blue-600" />
                            </div>
                            <span className="font-medium">{formatTime(event.time)}</span>
                          </div>
                        )}
                        {event.location && (
                          <div className="flex items-center gap-3 text-muted-foreground">
                            <div className="flex items-center justify-center w-8 h-8 rounded-full bg-green-50">
                              <MapPin className="h-4 w-4 text-green-600" />
                            </div>
                            <span className="font-medium line-clamp-1">{event.location}</span>
                          </div>
                        )}
                      </div>

                      {/* Description */}
                      {event.description && (
                        <div className="pt-2">
                          <p className="text-sm text-muted-foreground line-clamp-3 leading-relaxed">
                            {event.description}
                          </p>
                        </div>
                      )}

                      {/* Ticket Types */}
                      {event.ticket_types && event.ticket_types.length > 0 && (
                        <div className="space-y-3 pt-2 border-t border-border/50">
                          <div className="text-sm font-semibold text-foreground">Ticket Types</div>
                          <div className="space-y-2">
                            {event.ticket_types.slice(0, 2).map((ticket) => (
                              <div key={ticket.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/30">
                                <span className="font-medium text-sm">{ticket.name}</span>
                                <Badge variant="secondary" className="font-semibold">
                                  ${ticket.price}
                                </Badge>
                              </div>
                            ))}
                            {event.ticket_types.length > 2 && (
                              <div className="text-center">
                                <Badge variant="outline" className="text-xs">
                                  +{event.ticket_types.length - 2} more types
                                </Badge>
                              </div>
                            )}
                          </div>
                        </div>
                      )}

                      {/* Stats */}
                      <div className="flex items-center justify-between pt-4 mt-4 border-t border-border/50">
                        <div className="flex items-center gap-2">
                          <div className="flex items-center justify-center w-8 h-8 rounded-full bg-blue-50">
                            <Users className="h-4 w-4 text-blue-600" />
                          </div>
                          <div>
                            <div className="text-sm font-semibold">{event.total_tickets_sold || 0}</div>
                            <div className="text-xs text-muted-foreground">Tickets Sold</div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="flex items-center justify-center w-8 h-8 rounded-full bg-purple-50">
                            <CalendarDays className="h-4 w-4 text-purple-600" />
                          </div>
                          <div>
                            <div className="text-sm font-semibold">{event.ticket_types?.length || 0}</div>
                            <div className="text-xs text-muted-foreground">Ticket Types</div>
                          </div>
                        </div>
                      </div>

                    </div>

                    {/* Actions - Always at bottom */}
                    <div className="mt-auto pt-4">
                      <Button
                        className="w-full bg-primary hover:bg-primary/90 shadow-lg group-hover:shadow-xl transition-all"
                        onClick={() => router.push(`/eventos?eventId=${event.id}`)}
                        size="lg"
                      >
                        <Eye className="h-4 w-4 mr-2" />
                        View Event Details
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
