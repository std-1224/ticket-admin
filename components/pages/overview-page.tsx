"use client"

import { useState, useEffect } from "react"
import {
  Calendar,
  CheckCircle,
  Clock,
  DollarSign,
  MapPin,
  Ticket,
  Users,
  Loader2,
} from "lucide-react"
import { useAuth } from "@/contexts/auth-context"
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

interface AggregatedStats {
  totalEvents: number
  totalPurchases: number
  totalTickets: number
  totalRevenue: number
  totalCheckIns: number
}

interface Event {
  id: string
  title: string
  date: string
  time?: string
  location?: string
  purchase_count: number
  ticket_count: number
}

interface SalesDataPoint {
  date: string
  fullDate: string
  sales: number
  revenue: number
}

export const OverviewPage = () => {
  const [stats, setStats] = useState<AggregatedStats | null>(null)
  const [events, setEvents] = useState<Event[]>([])
  const [salesData, setSalesData] = useState<SalesDataPoint[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const { handleAuthError } = useAuth()

  useEffect(() => {
    fetchAllData()
  }, [])

  const fetchAllData = async () => {
    await Promise.all([
      fetchAllEventsData(),
      fetchSalesData()
    ])
  }

  const fetchAllEventsData = async () => {
    try {
      setLoading(true)
      setError('')

      const response = await fetch('/api/events/list?limit=100')
      const result = await response.json()

      if (!response.ok) {
        // Check if it's an auth error
        if (response.status === 401 || result.code === 'AUTH_ERROR') {
          handleAuthError({ message: result.error, status: response.status })
          return
        }
        throw new Error(result.error || 'Failed to fetch events data')
      }

      if (result.success) {
        setEvents(result.data.events || [])
        setStats(result.data.aggregated_stats || null)
      } else {
        throw new Error(result.error || 'Failed to fetch events data')
      }
    } catch (err: any) {
      console.error('Error fetching events data:', err)
      setError(err.message || 'Failed to fetch events data')
    } finally {
      setLoading(false)
    }
  }

  const fetchSalesData = async () => {
    try {
      const response = await fetch('/api/analytics/daily-sales?days=30')
      const result = await response.json()

      if (!response.ok) {
        // Check if it's an auth error
        if (response.status === 401 || result.code === 'AUTH_ERROR') {
          handleAuthError({ message: result.error, status: response.status })
          return
        }
        throw new Error(result.error || 'Failed to fetch sales data')
      }

      if (result.success) {
        setSalesData(result.data || [])
      } else {
        throw new Error(result.error || 'Failed to fetch sales data')
      }
    } catch (err: any) {
      console.error('Error fetching sales data:', err)
      // Don't set error state for sales data, just log it
      // The chart will show empty if sales data fails
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="text-center py-12">
        <p className="text-destructive mb-4">Error: {error}</p>
        <button
          onClick={fetchAllData}
          className="px-4 py-2 bg-primary text-primary-foreground rounded-md"
        >
          Retry
        </button>
      </div>
    )
  }

  return (
    <div className="space-y-3 sm:space-y-6 lg:space-y-8 pb-20 md:pb-0">
      <div className="space-y-2 sm:space-y-3">
        <h1 className="text-xl sm:text-3xl font-bold leading-tight">All Events Overview</h1>
        <div className="flex flex-col sm:flex-row sm:flex-wrap sm:items-center gap-2 sm:gap-x-6 sm:gap-y-2 text-sm sm:text-base text-muted-foreground">
          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4 flex-shrink-0" />
            <span className="truncate">{stats?.totalEvents || 0} Total Events</span>
          </div>
          <div className="flex items-center gap-2">
            <Ticket className="h-4 w-4 flex-shrink-0" />
            <span className="truncate">{stats?.totalTickets || 0} Total Tickets Available</span>
          </div>
          <div className="flex items-center gap-2">
            <DollarSign className="h-4 w-4 flex-shrink-0" />
            <span className="truncate">${(stats?.totalRevenue || 0).toLocaleString()} Revenue</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1">
            <CardTitle className="text-xs sm:text-sm font-medium">Total Revenue</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-lg sm:text-2xl font-bold">${(stats?.totalRevenue || 0).toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">Across all events</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1">
            <CardTitle className="text-xs sm:text-sm font-medium">Total Tickets Available</CardTitle>
            <Ticket className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-lg sm:text-2xl font-bold">{(stats?.totalTickets || 0).toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">
              Across all ticket types
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1">
            <CardTitle className="text-xs sm:text-sm font-medium">Total Events</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-lg sm:text-2xl font-bold">{(stats?.totalEvents || 0).toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">Active events</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1">
            <CardTitle className="text-xs sm:text-sm font-medium">Checked In Attendees</CardTitle>
            <CheckCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-lg sm:text-2xl font-bold">{(stats?.totalCheckIns || 0).toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">
              {stats?.totalTickets ? Math.round(((stats?.totalCheckIns || 0) / stats.totalTickets) * 100) : 0}% of tickets
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg sm:text-xl">Ticket Sales Over Time</CardTitle>
          </CardHeader>
          <CardContent className="h-48 sm:h-80">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={salesData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="date" stroke="hsl(var(--muted-foreground))" fontSize={10} />
                <YAxis stroke="hsl(var(--muted-foreground))" fontSize={10} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "hsl(var(--background))",
                    borderColor: "hsl(var(--border))",
                    fontSize: "12px",
                  }}
                />
                <Legend />
                <Line type="monotone" dataKey="sales" stroke="hsl(var(--primary))" strokeWidth={2} activeDot={{ r: 6 }} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg sm:text-xl">Recent Events</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {events.slice(0, 5).map((event) => (
                <div key={event.id} className="flex items-center justify-between p-3 border rounded-lg">
                  <div className="flex-1">
                    <h4 className="font-medium text-sm">{event.title}</h4>
                    <div className="flex items-center gap-4 text-xs text-muted-foreground mt-1">
                      <span className="flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        {event.date}
                      </span>
                      {event.location && (
                        <span className="flex items-center gap-1">
                          <MapPin className="h-3 w-3" />
                          {event.location}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-medium">{event.ticket_count} tickets available</div>
                    <div className="text-xs text-muted-foreground">{event.purchase_count} purchases</div>
                  </div>
                </div>
              ))}
              {events.length === 0 && (
                <p className="text-center text-muted-foreground py-4">No events found</p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
