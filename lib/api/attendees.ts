import { supabase } from '@/lib/supabase'
import { handleSupabaseError } from '@/lib/auth-error-handler'
import { AttendeeWithPurchaseInfo, AttendeeStats, AttendeeFilters, AttendeesResponse } from '@/lib/types/attendees'

export class AttendeesAPI {
  /**
   * Get attendees with purchase information for a specific event
   */
  static async getAttendees(
    eventId: string,
    filters: AttendeeFilters = {},
    page: number = 1,
    limit: number = 50
  ): Promise<AttendeesResponse> {
    try {
      // Build the query to get attendees with ticket information
      let query = supabase
        .from('attendees')
        .select(`
          id,
          order_item_id,
          name,
          email,
          created_at,
          order_items!inner(
            id,
            event_id,
            purchaser_id,
            qr_code,
            status,
            created_at,
            price_paid
          ),
          scans(
            id,
            status,
            scanned_at
          )
        `)
        .eq('order_items.event_id', eventId)

      // Apply search filter
      if (filters.search) {
        query = query.or(`name.ilike.%${filters.search}%,email.ilike.%${filters.search}%`)
      }

      // Apply payment status filter
      if (filters.payment_status && filters.payment_status !== 'all') {
        query = query.eq('purchases.status', filters.payment_status)
      }

      // Get total count for pagination
      const { count } = await supabase
        .from('attendees')
        .select('id', { count: 'exact', head: true })
        .eq('order_items.event_id', eventId)

      // Apply pagination
      const offset = (page - 1) * limit
      query = query.range(offset, offset + limit - 1)

      const { data: attendeesData, error } = await query

      if (error) {
        handleSupabaseError(error)
      }

      // For individual attendees, we need to get purchase info separately
      // Get unique purchaser IDs to fetch purchase information
      const purchaserIds = [...new Set((attendeesData || []).map((a: any) => a.tickets?.purchaser_id).filter(Boolean))]

      let purchasesData: any[] = []
      if (purchaserIds.length > 0) {
        const { data: purchases } = await supabase
          .from('purchases')
          .select('*')
          .eq('event_id', eventId)
          .in('user_id', purchaserIds)

        purchasesData = purchases || []
      }

      // Create a map of purchaser_id to purchase info
      const purchasesByUser = new Map<string, any>()
      purchasesData.forEach(purchase => {
        purchasesByUser.set(purchase.user_id, purchase)
      })

      // Transform the data to match our interface
      const attendees: AttendeeWithPurchaseInfo[] = (attendeesData || []).map((attendee: any) => {
        const ticket = attendee.tickets
        const purchase = purchasesByUser.get(ticket?.purchaser_id)
        const scans = attendee.scans || []

        // Check if user has checked in (has any successful scan)
        const hasCheckedIn = scans.some((scan: any) => scan.status === 'used' || scan.status === 'valid')

        return {
          id: attendee.id,
          order_item_id: attendee.order_item_id,
          name: attendee.name,
          email: attendee.email,
          created_at: attendee.created_at,
          tickets_count: 1, // Each attendee record represents one ticket
          payment_status: purchase?.status || 'pending',
          purchase_date: purchase?.created_at || ticket?.created_at || attendee.created_at,
          check_in_status: hasCheckedIn ? 'checked_in' : 'not_checked_in',
          total_price: purchase?.total_price || ticket?.price_paid || 0,
          user_id: ticket?.purchaser_id || ''
        }
      })

      // Calculate stats
      const stats = this.calculateStats(attendees)

      return {
        attendees,
        stats,
        total_count: count || 0
      }
    } catch (error: any) {
      console.error('Error fetching attendees:', error)
      throw new Error(`Failed to fetch attendees: ${error.message}`)
    }
  }

  /**
   * Get attendees grouped by purchase (showing tickets per purchase)
   */
  static async getAttendeesByPurchase(
    eventId: string,
    filters: AttendeeFilters = {},
    page: number = 1,
    limit: number = 50
  ): Promise<AttendeesResponse> {
    try {
      // First, get all purchases for the event
      let purchasesQuery = supabase
        .from('purchases')
        .select(`
          id,
          user_id,
          event_id,
          total_price,
          status,
          created_at,
          payment_method,
          users!user_id(
            id,
            name,
            email
          )
        `)
        .eq('event_id', eventId)

      // Apply search filter on user name/email
      if (filters.search) {
        purchasesQuery = purchasesQuery.or(`users.name.ilike.%${filters.search}%,users.email.ilike.%${filters.search}%`)
      }

      // Apply payment status filter
      if (filters.payment_status && filters.payment_status !== 'all') {
        purchasesQuery = purchasesQuery.eq('status', filters.payment_status)
      }

      // Get total count
      const { count } = await supabase
        .from('purchases')
        .select('id', { count: 'exact', head: true })
        .eq('event_id', eventId)

      // Apply pagination
      const offset = (page - 1) * limit
      purchasesQuery = purchasesQuery.range(offset, offset + limit - 1)

      const { data: purchasesData, error: purchasesError } = await purchasesQuery

      if (purchasesError) {
        throw new Error(`Failed to fetch purchases: ${purchasesError.message}`)
      }

      if (!purchasesData || purchasesData.length === 0) {
        return {
          attendees: [],
          stats: {
            total_attendees: 0,
            paid_payments: 0,
            pending_payments: 0,
            failed_payments: 0,
            checked_in: 0,
            not_checked_in: 0
          },
          total_count: count || 0
        }
      }

      // Get all tickets for these purchases
      const userIds = purchasesData.map(p => p.user_id)
      const { data: ticketsData, error: ticketsError } = await supabase
        .from("order_items")
        .select(`
          id,
          purchaser_id,
          event_id,
          qr_code,
          status,
          attendees(
            id,
            name,
            email
          ),
          scans(
            id,
            status,
            scanned_at
          )
        `)
        .eq('event_id', eventId)
        .in('purchaser_id', userIds)

      if (ticketsError) {
        throw new Error(`Failed to fetch tickets: ${ticketsError.message}`)
      }

      // Group tickets by purchaser_id to match with purchases
      const ticketsByPurchaser = new Map<string, any[]>()
      ;(ticketsData || []).forEach((ticket: any) => {
        const purchaserId = ticket.purchaser_id
        if (!ticketsByPurchaser.has(purchaserId)) {
          ticketsByPurchaser.set(purchaserId, [])
        }
        ticketsByPurchaser.get(purchaserId)!.push(ticket)
      })

      // Transform data to show one row per purchase with ticket count
      const attendees: AttendeeWithPurchaseInfo[] = purchasesData.map((purchase: any) => {
        const user = purchase.users
        const tickets = ticketsByPurchaser.get(purchase.user_id) || []

        // Get the first attendee from the first ticket (for display purposes)
        const firstAttendee = tickets[0]?.attendees?.[0]

        // Check if any ticket has been scanned
        const hasCheckedIn = order_items.some((ticket: any) =>
          ticket.scans?.some((scan: any) => scan.status === 'used' || scan.status === 'valid')
        )

        return {
          id: purchase.id,
          order_item_id: tickets[0]?.id || null,
          name: firstAttendee?.name || user?.name || null,
          email: firstAttendee?.email || user?.email || null,
          created_at: purchase.created_at,
          tickets_count: order_items.length,
          payment_status: purchase.status,
          purchase_date: purchase.created_at,
          check_in_status: hasCheckedIn ? 'checked_in' : 'not_checked_in',
          total_price: purchase.total_price,
          user_id: purchase.user_id
        }
      })

      // Calculate stats
      const stats = this.calculateStats(attendees)

      return {
        attendees,
        stats,
        total_count: count || 0
      }
    } catch (error: any) {
      console.error('Error fetching attendees by purchase:', error)
      throw new Error(`Failed to fetch attendees: ${error.message}`)
    }
  }

  /**
   * Calculate statistics from attendees data
   */
  private static calculateStats(attendees: AttendeeWithPurchaseInfo[]): AttendeeStats {
    return attendees.reduce(
      (stats, attendee) => {
        stats.total_attendees++
        
        // Payment status stats
        if (attendee.payment_status === 'paid') stats.paid_payments++
        else if (attendee.payment_status === 'pending') stats.pending_payments++
        else if (attendee.payment_status === 'failed') stats.failed_payments++
        
        // Check-in status stats
        if (attendee.check_in_status === 'checked_in') stats.checked_in++
        else stats.not_checked_in++
        
        return stats
      },
      {
        total_attendees: 0,
        paid_payments: 0,
        pending_payments: 0,
        failed_payments: 0,
        checked_in: 0,
        not_checked_in: 0
      }
    )
  }

  /**
   * Export attendees data to CSV format
   */
  static async exportAttendeesCSV(eventId: string, filters: AttendeeFilters = {}): Promise<string> {
    try {
      const { attendees } = await this.getAttendeesByPurchase(eventId, filters, 1, 1000)
      
      const headers = ['Name', 'Email', "order_items", 'Payment', 'Purchase Date', 'Status']
      const csvRows = [
        headers.join(','),
        ...attendees.map(attendee => [
          `"${attendee.name || ''}"`,
          `"${attendee.email || ''}"`,
          attendee.tickets_count,
          attendee.payment_status,
          `"${new Date(attendee.purchase_date).toLocaleString()}"`,
          attendee.check_in_status === 'checked_in' ? 'Checked In' : 'Not Checked In'
        ].join(','))
      ]
      
      return csvRows.join('\n')
    } catch (error: any) {
      console.error('Error exporting CSV:', error)
      throw new Error(`Failed to export CSV: ${error.message}`)
    }
  }

  /**
   * Get attendee details by ID
   */
  static async getAttendeeDetails(attendeeId: string): Promise<AttendeeWithPurchaseInfo | null> {
    try {
      const { data, error } = await supabase
        .from('attendees')
        .select(`
          id,
          order_item_id,
          name,
          email,
          created_at,
          order_items!inner(
            id,
            event_id,
            user_id,
            purchase_id,
            qr_code,
            status,
            created_at,
            price_paid,
            purchases!purchase_id(
              id,
              status,
              total_price,
              payment_method,
              created_at
            )
          ),
          scans(
            id,
            status,
            scanned_at
          )
        `)
        .eq('id', attendeeId)
        .single()

      if (error) {
        handleSupabaseError(error)
      }

      if (!data) return null

      const ticket = data.tickets // This is a single object, not an array
      const purchase = ticket?.purchases // This is the purchase object
      const scans = data.scans || []

      const hasCheckedIn = scans.some((scan: any) => scan.status === 'used' || scan.status === 'valid')

      return {
        id: data.id,
        order_item_id: data.order_item_id,
        name: data.name,
        email: data.email,
        created_at: data.created_at,
        tickets_count: 1,
        payment_status: purchase?.status || 'pending',
        purchase_date: purchase?.created_at || ticket?.created_at || data.created_at,
        check_in_status: hasCheckedIn ? 'checked_in' : 'not_checked_in',
        total_price: purchase?.total_price || ticket?.price_paid || 0,
        user_id: ticket?.user_id || ''
      }
    } catch (error: any) {
      console.error('Error fetching attendee details:', error)
      throw new Error(`Failed to fetch attendee details: ${error.message}`)
    }
  }
}
