"use client"

import { useState, useEffect, useCallback } from "react"
import { useAuth } from "@/contexts/auth-context"
import { Search, Download, Filter, Users, CreditCard, CheckCircle, Clock, AlertCircle, X } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"

interface AttendeeData {
  id: string
  name: string
  email: string
  ticket_id: string
  created_at: string
  tickets: {
    id: string
    event_id: string
    purchaser_id: string
    qr_code: string
    status: 'paid' | 'pending' | 'failed'
    purchased_at: string
    price_paid: number
    events: {
      id: string
      title: string
      date: string
      time: string
      location: string
    }
  }
  scans: Array<{
    id: string
    ticket_id: string
    status: string
    scanned_at: string
  }>
}

interface AttendeeStats {
  total_attendees: number
  paid_payments: number
  pending_payments: number
  failed_payments: number
  checked_in: number
  not_checked_in: number
}

export const AttendeesPage = () => {
  const [attendees, setAttendees] = useState<AttendeeData[]>([])
  const [stats, setStats] = useState<AttendeeStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [searchLoading, setSearchLoading] = useState(false)
  const [error, setError] = useState('')
  const { handleAuthError } = useAuth()
  const [searchTerm, setSearchTerm] = useState("")
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState("")
  const [paymentFilter, setPaymentFilter] = useState<'all' | 'paid' | 'pending' | 'failed'>('all')
  const [statusFilter, setStatusFilter] = useState<'all' | 'checked_in' | 'not_checked_in'>('all')
  const [currentPage, setCurrentPage] = useState(1)
  const [totalCount, setTotalCount] = useState(0)
  const limit = 50

  // Debounce search term
  useEffect(() => {
    if (searchTerm !== debouncedSearchTerm) {
      setSearchLoading(true)
    }

    const timer = setTimeout(() => {
      setDebouncedSearchTerm(searchTerm)
      setSearchLoading(false)
    }, 500) // 500ms delay

    return () => clearTimeout(timer)
  }, [searchTerm, debouncedSearchTerm])

  useEffect(() => {
    fetchAllAttendees()
  }, [debouncedSearchTerm, paymentFilter, statusFilter, currentPage])

  const fetchAllAttendees = async () => {
    try {
      setLoading(true)
      setError('')

      const params = new URLSearchParams({
        page: currentPage.toString(),
        limit: limit.toString(),
      })

      if (debouncedSearchTerm) params.append('search', debouncedSearchTerm)
      if (paymentFilter !== 'all') params.append('paymentStatus', paymentFilter)
      if (statusFilter !== 'all') params.append('checkInStatus', statusFilter)

      console.log('Fetching attendees with params:', {
        search: debouncedSearchTerm,
        paymentFilter,
        statusFilter,
        page: currentPage,
        limit
      })

      const response = await fetch(`/api/attendees/all?${params}`)
      const result = await response.json()

      if (!response.ok) {
        // Check if it's an auth error
        if (response.status === 401 || result.code === 'AUTH_ERROR') {
          handleAuthError({ message: result.error, status: response.status })
          return
        }
        throw new Error(result.error || 'Failed to fetch attendees')
      }

      if (result.success) {
        setAttendees(result.data.attendees || [])
        setStats(result.data.stats || null)
        setTotalCount(result.data.total_count || 0)
      } else {
        throw new Error(result.error || 'Failed to fetch attendees')
      }
    } catch (err: any) {
      console.error('Error fetching attendees:', err)
      setError(err.message || 'Failed to fetch attendees')
    } finally {
      setLoading(false)
    }
  }

  const handleSearch = (value: string) => {
    setSearchTerm(value)
    setCurrentPage(1) // Reset to first page when searching
  }

  const clearSearch = () => {
    setSearchTerm("")
    setCurrentPage(1)
  }

  const handlePaymentFilter = (value: string) => {
    setPaymentFilter(value as 'all' | 'paid' | 'pending' | 'failed')
    setCurrentPage(1)
  }

  const handleStatusFilter = (value: string) => {
    setStatusFilter(value as 'all' | 'checked_in' | 'not_checked_in')
    setCurrentPage(1)
  }

  const handleExport = async () => {
    try {
      const params = new URLSearchParams({
        format: 'csv'
      })

      if (debouncedSearchTerm) params.append('search', debouncedSearchTerm)
      if (paymentFilter !== 'all') params.append('paymentStatus', paymentFilter)
      if (statusFilter !== 'all') params.append('checkInStatus', statusFilter)

      const response = await fetch(`/api/attendees/all?${params}`)

      if (!response.ok) {
        throw new Error('Failed to export data')
      }

      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.style.display = 'none'
      a.href = url
      a.download = `all-attendees-${new Date().toISOString().split('T')[0]}.csv`
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)
    } catch (err: any) {
      console.error('Export error:', err)
      setError(err.message || 'Failed to export data')
    }
  }

  const totalPages = Math.ceil(totalCount / limit)

  const handlePageChange = (page: number) => {
    setCurrentPage(page)
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const getPaymentStatusBadge = (status: string) => {
    switch (status) {
      case 'paid':
        return <Badge variant="default" className="bg-green-500">Paid</Badge>
      case 'pending':
        return <Badge variant="secondary">Pending</Badge>
      case 'failed':
        return <Badge variant="destructive">Failed</Badge>
      default:
        return <Badge variant="outline">Unknown</Badge>
    }
  }

  const getCheckInStatusBadge = (scans: any[]) => {
    if (scans && scans.length > 0) {
      return <Badge variant="default" className="bg-blue-500">Checked In</Badge>
    }
    return <Badge variant="outline">Not Checked In</Badge>
  }

  if (error) {
    return (
      <div className="space-y-6">
        <Card>
          <CardContent className="p-6">
            <div className="text-center">
              <p className="text-red-500 mb-4">Error loading attendees: {error}</p>
              <Button onClick={fetchAllAttendees} variant="outline">
                Try Again
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-3 sm:space-y-6 pb-20 md:pb-0">
      {/* Header */}
      <div className="space-y-2">
        <h1 className="text-xl sm:text-3xl font-bold">All Events Attendees</h1>
        <p className="text-muted-foreground">
          View and manage attendees across all events.
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
        <Card>
          <CardHeader className="pb-1">
            <CardTitle className="text-sm sm:text-base">Completed Payments</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-8 w-16" />
            ) : (
              <div className="text-lg sm:text-3xl font-bold text-green-400">{stats?.paid_payments || 0}</div>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-1">
            <CardTitle className="text-sm sm:text-base">Pending Payments</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-8 w-16" />
            ) : (
              <div className="text-lg sm:text-3xl font-bold text-yellow-400">{stats?.pending_payments || 0}</div>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-1">
            <CardTitle className="text-sm sm:text-base">Checked In</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-8 w-16" />
            ) : (
              <div className="text-lg sm:text-3xl font-bold text-blue-400">{stats?.checked_in || 0}</div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Filters and Search */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                <Input
                  placeholder="Search by name or email..."
                  value={searchTerm}
                  onChange={(e) => handleSearch(e.target.value)}
                  className="pl-10"
                />
                {searchLoading && (
                  <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                    <div className="animate-spin h-4 w-4 border-2 border-gray-300 border-t-blue-600 rounded-full"></div>
                  </div>
                )}
                {!searchLoading && searchTerm && (
                  <button
                    onClick={clearSearch}
                    className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>
            </div>
            <div className="flex gap-2">
              <Select value={paymentFilter} onValueChange={handlePaymentFilter}>
                <SelectTrigger className="w-[140px]">
                  <SelectValue placeholder="Payment" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Payments</SelectItem>
                  <SelectItem value="paid">Paid</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="failed">Failed</SelectItem>
                </SelectContent>
              </Select>
              <Select value={statusFilter} onValueChange={handleStatusFilter}>
                <SelectTrigger className="w-[140px]">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="checked_in">Checked In</SelectItem>
                  <SelectItem value="not_checked_in">Not Checked In</SelectItem>
                </SelectContent>
              </Select>
              <Button onClick={handleExport} variant="outline" size="sm">
                <Download className="h-4 w-4 mr-2" />
                Export
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Attendees Table */}
      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-6">
              <div className="space-y-4">
                {[...Array(5)].map((_, i) => (
                  <div key={i} className="flex items-center space-x-4">
                    <Skeleton className="h-12 w-12 rounded-full" />
                    <div className="space-y-2">
                      <Skeleton className="h-4 w-[200px]" />
                      <Skeleton className="h-4 w-[150px]" />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : attendees.length === 0 ? (
            <div className="p-6 text-center">
              <Users className="mx-auto h-12 w-12 text-gray-400" />
              <h3 className="mt-2 text-sm font-medium text-gray-900">No attendees found</h3>
              <p className="mt-1 text-sm text-gray-500">
                {debouncedSearchTerm || paymentFilter !== 'all' || statusFilter !== 'all'
                  ? 'Try adjusting your search or filters.'
                  : 'No attendees have been registered yet.'}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Event</TableHead>
                    <TableHead>Payment</TableHead>
                    <TableHead>Check-in</TableHead>
                    <TableHead>Registered</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {attendees.map((attendee) => {
                    const ticket = Array.isArray(attendee.tickets) ? attendee.tickets[0] : attendee.tickets
                    const event = Array.isArray(ticket?.events) ? ticket?.events[0] : ticket?.events

                    return (
                      <TableRow key={attendee.id}>
                        <TableCell className="font-medium">{attendee.name}</TableCell>
                        <TableCell>{attendee.email}</TableCell>
                        <TableCell>
                          <div>
                            <div className="font-medium">{event?.title || 'Unknown Event'}</div>
                            <div className="text-sm text-gray-500">{event?.location}</div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div>
                            {getPaymentStatusBadge(ticket?.status || 'unknown')}
                            <div className="text-sm text-gray-500 mt-1">
                              ${ticket?.price_paid || 0}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          {getCheckInStatusBadge(attendee.scans)}
                        </TableCell>
                        <TableCell className="text-sm text-gray-500">
                          {formatDate(attendee.created_at)}
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex justify-center space-x-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => handlePageChange(currentPage - 1)}
            disabled={currentPage === 1}
          >
            Previous
          </Button>

          {[...Array(Math.min(5, totalPages))].map((_, i) => {
            const pageNum = Math.max(1, Math.min(totalPages - 4, currentPage - 2)) + i
            if (pageNum > totalPages) return null

            return (
              <Button
                key={pageNum}
                variant={currentPage === pageNum ? "default" : "outline"}
                size="sm"
                onClick={() => handlePageChange(pageNum)}
              >
                {pageNum}
              </Button>
            )
          })}

          <Button
            variant="outline"
            size="sm"
            onClick={() => handlePageChange(currentPage + 1)}
            disabled={currentPage === totalPages}
          >
            Next
          </Button>
        </div>
      )}
    </div>
  )
}
