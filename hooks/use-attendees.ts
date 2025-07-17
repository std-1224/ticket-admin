import { useState, useEffect, useCallback } from 'react'
import { AttendeeWithPurchaseInfo, AttendeeStats, AttendeeFilters } from '@/lib/types/attendees'

interface UseAttendeesResult {
  attendees: AttendeeWithPurchaseInfo[]
  stats: AttendeeStats
  loading: boolean
  error: string | null
  totalCount: number
  currentPage: number
  totalPages: number
  fetchAttendees: () => Promise<void>
  setFilters: (filters: AttendeeFilters) => void
  setPage: (page: number) => void
  exportCSV: () => Promise<void>
  refreshData: () => Promise<void>
}

export function useAttendees(
  eventId: string,
  initialFilters: AttendeeFilters = {},
  pageSize: number = 50
): UseAttendeesResult {
  const [attendees, setAttendees] = useState<AttendeeWithPurchaseInfo[]>([])
  const [stats, setStats] = useState<AttendeeStats>({
    total_attendees: 0,
    paid_payments: 0,
    pending_payments: 0,
    failed_payments: 0,
    checked_in: 0,
    not_checked_in: 0
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [totalCount, setTotalCount] = useState(0)
  const [currentPage, setCurrentPage] = useState(1)
  const [filters, setFilters] = useState<AttendeeFilters>(initialFilters)

  const totalPages = Math.ceil(totalCount / pageSize)

  const fetchAttendees = useCallback(async () => {
    if (!eventId) return

    setLoading(true)
    setError(null)

    try {
      const params = new URLSearchParams({
        eventId,
        page: currentPage.toString(),
        limit: pageSize.toString()
      })

      if (filters.search) params.append('search', filters.search)
      if (filters.payment_status && filters.payment_status !== 'all') {
        params.append('paymentStatus', filters.payment_status)
      }
      if (filters.check_in_status && filters.check_in_status !== 'all') {
        params.append('checkInStatus', filters.check_in_status)
      }

      const response = await fetch(`/api/attendees?${params}`)
      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || 'Failed to fetch attendees')
      }

      if (result.success) {
        setAttendees(result.data.attendees)
        setStats(result.data.stats)
        setTotalCount(result.data.total_count)
      } else {
        throw new Error(result.error || 'Failed to fetch attendees')
      }
    } catch (err: any) {
      console.error('Error fetching attendees:', err)
      setError(err.message || 'Failed to fetch attendees')
      setAttendees([])
      setStats({
        total_attendees: 0,
        paid_payments: 0,
        pending_payments: 0,
        failed_payments: 0,
        checked_in: 0,
        not_checked_in: 0
      })
    } finally {
      setLoading(false)
    }
  }, [eventId, currentPage, pageSize, filters])

  const exportCSV = useCallback(async () => {
    if (!eventId) return

    try {
      const params = new URLSearchParams({
        eventId,
        format: 'csv'
      })

      if (filters.search) params.append('search', filters.search)
      if (filters.payment_status && filters.payment_status !== 'all') {
        params.append('paymentStatus', filters.payment_status)
      }
      if (filters.check_in_status && filters.check_in_status !== 'all') {
        params.append('checkInStatus', filters.check_in_status)
      }

      const response = await fetch(`/api/attendees?${params}`)
      
      if (!response.ok) {
        throw new Error('Failed to export CSV')
      }

      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `attendees-${eventId}-${new Date().toISOString().split('T')[0]}.csv`
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)
    } catch (err: any) {
      console.error('Error exporting CSV:', err)
      setError(err.message || 'Failed to export CSV')
    }
  }, [eventId, filters])

  const handleSetFilters = useCallback((newFilters: AttendeeFilters) => {
    setFilters(newFilters)
    setCurrentPage(1) // Reset to first page when filters change
  }, [])

  const handleSetPage = useCallback((page: number) => {
    setCurrentPage(page)
  }, [])

  const refreshData = useCallback(async () => {
    await fetchAttendees()
  }, [fetchAttendees])

  // Fetch data when dependencies change
  useEffect(() => {
    fetchAttendees()
  }, [fetchAttendees])

  return {
    attendees,
    stats,
    loading,
    error,
    totalCount,
    currentPage,
    totalPages,
    fetchAttendees,
    setFilters: handleSetFilters,
    setPage: handleSetPage,
    exportCSV,
    refreshData
  }
}
