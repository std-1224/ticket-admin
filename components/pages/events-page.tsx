"use client"

import { useState, useRef, useEffect } from "react"
import {
  Calendar,
  CheckCircle,
  Eye,
  MapPin,
  PlusCircle,
  Trash2,
  Upload,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { useToast } from "@/hooks/use-toast"
import { useAuth } from "@/contexts/auth-context"
import { supabase } from "@/lib/supabase"
import { useSearchParams, useRouter } from "next/navigation"

// Sample Data in English
const eventDetails = {
  title: "Stellar Music Festival",
  date: "2025-10-26",
  time: "19:00",
  location: "Grand Park, Los Angeles",
  description:
    "An unforgettable night under the stars with the best artists from the current music scene. Don't miss it!",
  image: "/placeholder.svg?height=400&width=800",
}

const overviewStats = {
  ticketsSold: 4892,
  registeredUsers: 5230,
  checkIns: 1204,
  revenue: 73380,
}

export const EventsPage = () => {
  const searchParams = useSearchParams()
  const router = useRouter()
  const eventId = searchParams.get('eventId')
  const isViewMode = !!eventId

  const [ticketTypes, setTicketTypes] = useState<any[]>([])
  const [isAddTicketOpen, setIsAddTicketOpen] = useState(false)
  const [isCreateEventOpen, setIsCreateEventOpen] = useState(false)
  const [newTicket, setNewTicket] = useState({
    name: "",
    price: "",
    total_quantity: "",
    combo: "",
    description: "",
  })

  const [isSaving, setIsSaving] = useState(false)
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved" | "error">("idle")
  const [eventData, setEventData] = useState(eventDetails)
  const [savedEvent, setSavedEvent] = useState<typeof eventDetails | null>(null)
  const [currentEvent, setCurrentEvent] = useState<any>(null)
  const [loadingEvent, setLoadingEvent] = useState(false)

  // New state for image upload and API integration
  const [isUploading, setIsUploading] = useState(false)
  const [uploadedImageUrl, setUploadedImageUrl] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const { user } = useAuth()
  const { toast } = useToast()

  // Helper function to format date for display
  const formatDateForDisplay = (dateString: string) => {
    if (!dateString) return ''
    const date = new Date(dateString)
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    })
  }

  // Helper function to format time for display
  const formatTimeForDisplay = (timeString: string) => {
    if (!timeString) return ''
    const [hours, minutes] = timeString.split(':')
    const hour = parseInt(hours)
    const ampm = hour >= 12 ? 'PM' : 'AM'
    const displayHour = hour % 12 || 12
    return `${displayHour}:${minutes} ${ampm}`
  }

  // Fetch event details when in view mode
  useEffect(() => {
    if (eventId && user) {
      fetchEventDetails()
    }
  }, [eventId, user])

  const fetchEventDetails = async () => {
    if (!eventId) return

    setLoadingEvent(true)
    try {
      // Fetch event details
      const { data: event, error: eventError } = await supabase
        .from('events')
        .select('*')
        .eq('id', eventId)
        .single()

      if (eventError) {
        throw eventError
      }

      setCurrentEvent(event)
      setEventData({
        title: event.title,
        date: event.date,
        time: event.time || '',
        location: event.location || '',
        description: event.description || '',
        image: event.image_url || ''
      })
      setUploadedImageUrl(event.image_url)

      // Fetch ticket types for this event
      const ticketsResponse = await fetch(`/api/ticket-types?eventId=${eventId}`)
      if (ticketsResponse.ok) {
        const ticketsResult = await ticketsResponse.json()
        setTicketTypes(ticketsResult.ticketTypes || [])
      } else {
        console.error('Error fetching tickets:', await ticketsResponse.text())
      }

    } catch (error: any) {
      console.error('Error fetching event:', error)
      toast({
        title: "Error",
        description: "Failed to load event details",
        variant: "destructive"
      })
    } finally {
      setLoadingEvent(false)
    }
  }

  // Image upload function using client-side Supabase
  const handleImageUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file || !user) {
      console.log('No file selected or user not authenticated')
      return
    }

    console.log('Starting upload process for file:', file.name, 'Size:', file.size, 'Type:', file.type)
    console.log('User ID:', user.id)

    // Validate file type
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp']
    if (!allowedTypes.includes(file.type)) {
      toast({
        title: "Error",
        description: "Invalid file type. Only JPEG, PNG, and WebP images are allowed.",
        variant: "destructive"
      })
      return
    }

    // Validate file size (max 5MB)
    const maxSize = 5 * 1024 * 1024 // 5MB
    if (file.size > maxSize) {
      toast({
        title: "Error",
        description: "File size too large. Maximum size is 5MB.",
        variant: "destructive"
      })
      return
    }

    setIsUploading(true)

    try {
      // Generate unique filename - simpler path structure
      const fileExtension = file.name.split('.').pop()
      const timestamp = Date.now()
      const randomId = Math.random().toString(36).substring(2)
      const fileName = `${user.id}/${timestamp}-${randomId}.${fileExtension}`

      console.log('Generated filename:', fileName)
      console.log('Uploading to bucket: event-images')

      // Upload to Supabase Storage using client
      const { data, error } = await supabase.storage
        .from('event-images')
        .upload(fileName, file, {
          contentType: file.type,
          upsert: false
        })

      if (error) {
        console.error('Storage upload error:', error)
        throw new Error(`Upload failed: ${error.message}`)
      }

      console.log('Upload successful:', data)

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('event-images')
        .getPublicUrl(fileName)

      console.log('Generated public URL:', publicUrl)

      // Verify the URL is accessible
      if (publicUrl) {
        setUploadedImageUrl(publicUrl)
        setEventData(prev => ({ ...prev, image: publicUrl }))

        toast({
          title: "Success",
          description: "Image uploaded successfully to event-images bucket",
        })
      } else {
        throw new Error('Failed to generate public URL')
      }
    } catch (error: any) {
      console.error('Upload error:', error)
      toast({
        title: "Error",
        description: error.message || "Failed to upload image to event-images bucket",
        variant: "destructive"
      })
    } finally {
      setIsUploading(false)
    }
  }

  const handleAddTicket = async () => {
    if (newTicket.name && newTicket.price && newTicket.total_quantity) {
      try {
        const ticketData = {
          name: newTicket.name,
          price: Number.parseFloat(newTicket.price),
          total_quantity: Number.parseInt(newTicket.total_quantity),
          combo: newTicket.combo || "N/A",
          description: newTicket.description,
          event_id: eventId, // Add event_id for database
        }

        if (eventId) {
          // Save to database using API
          const response = await fetch('/api/ticket-types', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(ticketData),
          })

          const result = await response.json()

          if (!response.ok) {
            throw new Error(result.error || 'Failed to create ticket type')
          }

          // Update local state with the saved ticket
          setTicketTypes([...(ticketTypes || []), result.ticketType])

          toast({
            title: "Success",
            description: "Ticket type created successfully",
          })
        } else {
          // Just update local state if no event ID (create mode)
          const ticket = {
            id: `temp-${Date.now()}`, // Temporary ID for create mode
            name: newTicket.name,
            price: Number.parseFloat(newTicket.price),
            total_quantity: Number.parseInt(newTicket.total_quantity),
            combo: newTicket.combo || "N/A",
            description: newTicket.description,
          }
          setTicketTypes([...(ticketTypes || []), ticket])
        }

        setNewTicket({
          name: "",
          price: "",
          total_quantity: "",
          combo: "",
          description: "",
        })
        setIsAddTicketOpen(false)
      } catch (error: any) {
        console.error('Error creating ticket:', error)
        toast({
          title: "Error",
          description: "Failed to create ticket type",
          variant: "destructive"
        })
      }
    }
  }

  const handleInputChange = (field: string, value: string) => {
    setNewTicket((prev) => ({
      ...prev,
      [field]: value,
    }))
  }

  const handleSaveEvent = async () => {
    if (!user) {
      toast({
        title: "Error",
        description: "You must be logged in to create an event",
        variant: "destructive"
      })
      return
    }

    // Validate required fields
    if (!eventData.title || !eventData.date) {
      toast({
        title: "Error",
        description: "Please fill in all required fields (title and date)",
        variant: "destructive"
      })
      return
    }

    // Validate that an image has been uploaded
    if (!uploadedImageUrl) {
      toast({
        title: "Error",
        description: "Please upload an event image",
        variant: "destructive"
      })
      return
    }

    setIsSaving(true)
    setSaveStatus("saving")

    try {
      const eventPayload = {
        title: eventData.title,
        description: eventData.description,
        date: eventData.date,
        time: eventData.time,
        location: eventData.location,
        image_url: uploadedImageUrl, // Use the bucket image URL
        created_by: user.id
      }

      console.log('Creating event with payload:', eventPayload)

      const response = await fetch('/api/events', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(eventPayload),
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || 'Failed to create event')
      }

      setSaveStatus("saved")
      setSavedEvent({ ...eventData })
      setIsCreateEventOpen(false)

      toast({
        title: "Success",
        description: "Event created successfully! Redirecting to event details...",
      })

      // Redirect to event details page to manage ticket types
      setTimeout(() => {
        router.push(`/eventos?eventId=${result.event.id}`)
      }, 1500)

    } catch (error: any) {
      console.error('Save error:', error)
      setSaveStatus("error")
      toast({
        title: "Error",
        description: error.message || "Failed to create event",
        variant: "destructive"
      })
    } finally {
      setIsSaving(false)
    }
  }

  const handleDeleteTicket = async (ticketId: string) => {
    try {
      const response = await fetch(`/api/ticket-types?id=${ticketId}`, {
        method: 'DELETE',
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || 'Failed to delete ticket type')
      }

      // Remove from local state
      setTicketTypes(ticketTypes?.filter((ticket: any) => ticket.id !== ticketId) || [])

      toast({
        title: "Success",
        description: "Ticket type deleted successfully",
      })
    } catch (error: any) {
      console.error('Error deleting ticket:', error)
      toast({
        title: "Error",
        description: error.message || "Failed to delete ticket type",
        variant: "destructive"
      })
    }
  }

  const handleEventDataChange = (field: string, value: string) => {
    setEventData((prev) => ({
      ...prev,
      [field]: value,
    }))
    setSaveStatus("idle") // Resetear estado cuando hay cambios
  }

  // Main view with saved event
  if (savedEvent && !isCreateEventOpen) {
    return (
      <div className="space-y-3 sm:space-y-6 pb-20 md:pb-0">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-xl sm:text-3xl font-bold">My Events</h1>
            <p className="text-muted-foreground text-sm">Manage and create new events</p>
          </div>
          <Button onClick={() => setIsCreateEventOpen(true)} className="w-full sm:w-auto">
            <PlusCircle className="mr-2 h-4 w-4" />
            Create New Event
          </Button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <Card className="cursor-pointer hover:shadow-lg transition-shadow">
            <div className="aspect-video rounded-t-lg overflow-hidden">
              <img
                src={savedEvent.image || "/placeholder.svg"}
                alt={savedEvent.title}
                className="object-cover w-full h-full"
              />
            </div>
            <CardHeader className="pb-2">
              <CardTitle className="text-lg line-clamp-2">{savedEvent.title}</CardTitle>
              <div className="flex flex-col gap-1 text-sm text-muted-foreground">
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 flex-shrink-0" />
                  <span>{formatDateForDisplay(savedEvent.date)}</span>
                  {savedEvent.time && (
                    <span className="text-xs">• {formatTimeForDisplay(savedEvent.time)}</span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <MapPin className="h-4 w-4 flex-shrink-0" />
                  <span className="truncate">{savedEvent.location}</span>
                </div>
              </div>
            </CardHeader>
            <CardContent className="pt-0">
              <p className="text-sm text-muted-foreground line-clamp-2 mb-3">{savedEvent.description}</p>
              <div className="flex justify-between items-center text-sm">
                <Badge variant="default">Active</Badge>
                <span className="text-muted-foreground">{overviewStats.ticketsSold} tickets sold</span>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  // Event creation/editing view
  return (
    <div className="pb-20 md:pb-0">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold">
            {eventId ? "Event Details" : savedEvent ? "Create New Event" : "Create Event"}
          </h1>
          <p className="text-muted-foreground text-sm">
            {eventId ? "View and manage event details and ticket types" : "Configure your event details"}
          </p>
        </div>
        {eventId ? (
          <Button variant="outline" onClick={() => window.history.back()} className="bg-transparent">
            Back to My Events
          </Button>
        ) : savedEvent && (
          <Button variant="outline" onClick={() => setIsCreateEventOpen(false)} className="bg-transparent">
            Cancel
          </Button>
        )}
      </div>

      <Tabs defaultValue="details" className="w-full">
        <TabsList className={`grid w-full ${eventId ? 'grid-cols-2' : 'grid-cols-1'}`}>
          <TabsTrigger value="details" className="text-sm">
            Details
          </TabsTrigger>
          {eventId && (
            <TabsTrigger value="tickets" className="text-sm">
              Ticket Types
            </TabsTrigger>
          )}
        </TabsList>
        <TabsContent value="details" className="mt-4 sm:mt-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 sm:gap-6 lg:gap-8">
            <div className="lg:col-span-2 space-y-3 sm:space-y-6">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base sm:text-xl">Event Information</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="space-y-2">
                    <Label htmlFor="event-title" className="text-sm">
                      Event Title
                    </Label>
                    <Input
                      id="event-title"
                      value={eventData.title}
                      onChange={(e) => handleEventDataChange("title", e.target.value)}
                      className="text-sm"
                      readOnly={!!eventId}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="event-description" className="text-sm">
                      Description
                    </Label>
                    <Textarea
                      id="event-description"
                      rows={4}
                      value={eventData.description}
                      onChange={(e) => handleEventDataChange("description", e.target.value)}
                      className="text-sm"
                      readOnly={!!eventId}
                    />
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-2">
                      <Label htmlFor="event-date" className="text-sm">
                        Date *
                      </Label>
                      <Input
                        id="event-date"
                        type="date"
                        value={eventData.date}
                        onChange={(e) => handleEventDataChange("date", e.target.value)}
                        className="text-sm"
                        required
                        readOnly={!!eventId}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="event-time" className="text-sm">
                        Time
                      </Label>
                      <Input
                        id="event-time"
                        type="time"
                        value={eventData.time}
                        onChange={(e) => handleEventDataChange("time", e.target.value)}
                        className="text-sm"
                        readOnly={!!eventId}
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="event-location" className="text-sm">
                      Location
                    </Label>
                    <Input
                      id="event-location"
                      value={eventData.location}
                      onChange={(e) => handleEventDataChange("location", e.target.value)}
                      className="text-sm"
                      readOnly={!!eventId}
                    />
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base sm:text-xl">Event Image</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="aspect-video rounded-md overflow-hidden border relative">
                    {isUploading && (
                      <div className="absolute inset-0 bg-black/50 flex items-center justify-center z-10">
                        <div className="text-white text-sm">Uploading...</div>
                      </div>
                    )}
                    <img
                      src={uploadedImageUrl || eventData.image || "/placeholder.svg"}
                      alt="Event preview"
                      className="object-cover w-full h-full"
                      onError={(e) => {
                        console.error('Image load error:', e)
                        e.currentTarget.src = "/placeholder.svg"
                      }}
                    />
                  </div>
                  {!eventId && (
                    <>
                      <input
                        type="file"
                        ref={fileInputRef}
                        onChange={handleImageUpload}
                        accept="image/jpeg,image/jpg,image/png,image/webp"
                        className="hidden"
                      />
                      <Button
                        variant="outline"
                        size="sm"
                        className="w-full sm:w-auto bg-transparent"
                        onClick={() => fileInputRef.current?.click()}
                        disabled={isUploading}
                      >
                        <Upload className="mr-2 h-4 w-4" />
                        {isUploading ? "Uploading..." : uploadedImageUrl ? "Change Image" : "Upload Image"}
                      </Button>
                    </>
                  )}
                </CardContent>
              </Card>
            </div>
            <div className="space-y-3 sm:space-y-6">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base sm:text-xl">Quick Analytics</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3 sm:space-y-4">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">Tickets Sold</span>
                    <span className="font-bold text-sm sm:text-base">{overviewStats.ticketsSold}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">Revenue Generated</span>
                    <span className="font-bold text-sm sm:text-base">${overviewStats.revenue.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">Most Popular Ticket</span>
                    <span className="font-bold text-sm sm:text-base">General Admission</span>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base sm:text-xl">Preview</CardTitle>
                  <CardDescription className="text-sm">Simulate how users will see your event.</CardDescription>
                </CardHeader>
                <CardContent>
                  <Dialog>
                    <DialogTrigger asChild>
                      <Button className="w-full text-sm">
                        <Eye className="mr-2 h-4 w-4" />
                        Preview Event Page
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="sm:max-w-[90vw] lg:max-w-[625px] max-h-[90vh] overflow-y-auto">
                      <DialogHeader>
                        <DialogTitle className="text-lg">{eventData.title}</DialogTitle>
                        <DialogDescription className="text-sm">
                          This is how attendees will see your event page.
                        </DialogDescription>
                      </DialogHeader>
                      <div className="rounded-lg overflow-hidden">
                        <img
                          src={uploadedImageUrl || eventData.image || "/placeholder.svg"}
                          alt="Event preview"
                          className="w-full h-auto object-cover"
                        />
                        <div className="p-4 sm:p-6 bg-card space-y-3 sm:space-y-4">
                          <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 text-sm text-muted-foreground">
                            <div className="flex items-center gap-2">
                              <Calendar className="h-4 w-4" />
                              <span>{formatDateForDisplay(eventData.date)}</span>
                              {eventData.time && (
                                <span className="text-xs">• {formatTimeForDisplay(eventData.time)}</span>
                              )}
                            </div>
                            <div className="flex items-center gap-2">
                              <MapPin className="h-4 w-4" />
                              <span>{eventData.location}</span>
                            </div>
                          </div>
                          <p className="text-sm">{eventData.description}</p>
                          <Button size="lg" className="w-full">
                            Buy Tickets
                          </Button>
                        </div>
                      </div>
                    </DialogContent>
                  </Dialog>
                </CardContent>
              </Card>
              {!eventId && (
                <div className="flex flex-col sm:flex-row justify-end gap-2">
                  <Button variant="outline" disabled={isSaving} size="sm" className="w-full sm:w-auto bg-transparent">
                    Discard Changes
                  </Button>
                  <Button onClick={handleSaveEvent} disabled={isSaving} size="sm" className="w-full sm:w-auto">
                    {isSaving ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                        Saving...
                      </>
                    ) : saveStatus === "saved" ? (
                      <>
                        <CheckCircle className="mr-2 h-4 w-4" />
                        Saved
                      </>
                    ) : (
                      "Save Event"
                    )}
                  </Button>
                </div>
              )}
            </div>
          </div>
        </TabsContent>
        {eventId && (
          <TabsContent value="tickets" className="mt-4 sm:mt-6">
            <Card>
            <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-2 sm:space-y-0 pb-4">
              <div className="space-y-1">
                <CardTitle className="text-lg sm:text-xl">Manage Ticket Types</CardTitle>
                <CardDescription className="text-sm">Create and edit tickets for your event.</CardDescription>
              </div>
              <Dialog open={isAddTicketOpen} onOpenChange={setIsAddTicketOpen}>
                <DialogTrigger asChild>
                  <Button size="sm" className="w-full sm:w-auto">
                    <PlusCircle className="mr-2 h-4 w-4" />
                    Add Ticket Type
                  </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-[90vw] lg:max-w-[425px] max-h-[90vh] overflow-y-auto">
                  <DialogHeader>
                    <DialogTitle className="text-lg">Create New Ticket Type</DialogTitle>
                    <DialogDescription className="text-sm">
                      Complete the information to create a new ticket type for your event.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="grid gap-4 py-4">
                    <div className="space-y-2">
                      <Label htmlFor="ticket-name" className="text-sm">
                        Ticket Name
                      </Label>
                      <Input
                        id="ticket-name"
                        placeholder="e.g. VIP Premium"
                        value={newTicket.name}
                        onChange={(e) => handleInputChange("name", e.target.value)}
                        className="text-sm"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="ticket-price" className="text-sm">
                          Price ($)
                        </Label>
                        <Input
                          id="ticket-price"
                          type="number"
                          step="0.01"
                          placeholder="0.00"
                          value={newTicket.price}
                          onChange={(e) => handleInputChange("price", e.target.value)}
                          className="text-sm"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="ticket-quantity" className="text-sm">
                          Total quantity
                        </Label>
                        <Input
                          id="ticket-quantity"
                          type="number"
                          placeholder="100"
                          value={newTicket.total_quantity}
                          onChange={(e) => handleInputChange("total_quantity", e.target.value)}
                          className="text-sm"
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="ticket-combo" className="text-sm">
                        Combo/Benefits (Optional)
                      </Label>
                      <Input
                        id="ticket-combo"
                        placeholder="e.g. Includes drink + VIP access"
                        value={newTicket.combo}
                        onChange={(e) => handleInputChange("combo", e.target.value)}
                        className="text-sm"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="ticket-description" className="text-sm">
                        Description
                      </Label>
                      <Textarea
                        id="ticket-description"
                        rows={3}
                        placeholder="Describe the benefits of this ticket..."
                        value={newTicket.description}
                        onChange={(e) => handleInputChange("description", e.target.value)}
                        className="text-sm"
                      />
                    </div>
                  </div>
                  <div className="flex justify-end gap-2">
                    <Button variant="outline" onClick={() => setIsAddTicketOpen(false)} className="bg-transparent">
                      Cancel
                    </Button>
                    <Button onClick={handleAddTicket}>Add Ticket</Button>
                  </div>
                </DialogContent>
              </Dialog>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="min-w-[120px] text-xs sm:text-sm">Name</TableHead>
                      <TableHead className="min-w-[80px] text-xs sm:text-sm">Price</TableHead>
                      <TableHead className="text-center min-w-[80px] text-xs sm:text-sm">Quantity</TableHead>
                      <TableHead className="min-w-[150px] text-xs sm:text-sm">Combo/Benefits</TableHead>
                      <TableHead className="min-w-[200px] text-xs sm:text-sm hidden sm:table-cell">Description</TableHead>
                      <TableHead className="text-right min-w-[100px] text-xs sm:text-sm">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {ticketTypes.map((ticket: any) => (
                      <TableRow key={ticket.id}>
                        <TableCell className="font-medium text-xs sm:text-sm">{ticket.name}</TableCell>
                        <TableCell className="text-xs sm:text-sm">${ticket.price.toFixed(2)}</TableCell>
                        <TableCell className="text-center text-xs sm:text-sm">{ticket.total_quantity}</TableCell>
                        <TableCell className="text-xs sm:text-sm">{ticket.combo}</TableCell>
                        <TableCell className="text-xs sm:text-sm hidden sm:table-cell">{ticket.description}</TableCell>
                        <TableCell className="text-right">
                          <div className="flex gap-1 justify-end">
                            <Button variant="ghost" size="sm" className="text-xs">
                              Edit
                            </Button>
                            {eventId && (
                              <Button
                                variant="ghost"
                                size="sm"
                                className="text-xs text-red-600 hover:text-red-700"
                                onClick={() => handleDeleteTicket(ticket.id)}
                              >
                                <Trash2 className="h-3 w-3" />
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
            </Card>
          </TabsContent>
        )}
      </Tabs>
    </div>
  )
}
