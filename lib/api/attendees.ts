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
          event_order_items!inner(
            id,
            event_id,
            user_id,
            qr_code,
            status,
            created_at,
            price_paid
          ),
          event_scans(
            id,
            status,
            scanned_at
          )
        `)
        .eq('event_order_items.event_id', eventId)

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
        .eq('event_order_items.event_id', eventId)

      // Apply pagination
      const offset = (page - 1) * limit
      query = query.range(offset, offset + limit - 1)

      const { data: attendeesData, error } = await query

      if (error) {
        handleSupabaseError(error)
      }

      // For individual attendees, we need to get purchase info separately
      // Get unique purchaser IDs to fetch purchase information
      const purchaserIds = [...new Set((attendeesData || []).map((a: any) => a.tickets?.user_id).filter(Boolean))]

      let purchasesData: any[] = []
      if (purchaserIds.length > 0) {
        const { data: purchases } = await supabase
          .from('event_orders')
          .select('*')
          .eq('event_id', eventId)
          .in('user_id', purchaserIds)

        purchasesData = purchases || []
      }

      // Create a map of user_id to purchase info
      const purchasesByUser = new Map<string, any>()
      purchasesData.forEach(purchase => {
        purchasesByUser.set(purchase.user_id, purchase)
      })

      // Transform the data to match our interface
      const attendees: AttendeeWithPurchaseInfo[] = (attendeesData || []).map((attendee: any) => {
        const ticket = attendee.tickets
        const purchase = purchasesByUser.get(ticket?.user_id)

        return {
          id: attendee.id,
          order_item_id: attendee.order_item_id,
          name: attendee.name,
          email: attendee.email,
          created_at: attendee.created_at,
          tickets_count: 1, // Each attendee record represents one ticket
          payment_status: purchase?.status || ticket?.status || 'pending',
          purchase_date: purchase?.created_at || ticket?.created_at || attendee.created_at,
          total_price: purchase?.total_price || ticket?.price_paid || 0,
          user_id: ticket?.user_id || ''
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
        .from('event_orders')
        .select(`
          id,
          user_id,
          event_id,
          total_price,
          status,
          created_at,
          payment_method,
          profiles!user_id(
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
      if (filters.payment_status) {
        purchasesQuery = purchasesQuery.eq('status', filters.payment_status)
      }

      // Get total count
      const { count } = await supabase
        .from('event_orders')
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
            waiting_payment: 0,
            pending: 0,
            cancelled: 0,
            delivered: 0
          },
          total_count: count || 0
        }
      }

      // Get all tickets for these purchases
      const userIds = purchasesData.map(p => p.user_id)
      const { data: ticketsData, error: ticketsError } = await supabase
        .from("event_order_items")
        .select(`
          id,
          event_id,
          qr_code,
          status,
          attendees(
            id,
            name,
            email
          ),
          event_scans(
            id,
            status,
            scanned_at
          )
        `)
        .eq('event_id', eventId)

      if (ticketsError) {
        throw new Error(`Failed to fetch tickets: ${ticketsError.message}`)
      }

      // Group tickets by user_id to match with purchases
      const ticketsByPurchaser = new Map<string, any[]>()
      ;(ticketsData || []).forEach((ticket: any) => {
        const user_id = ticket.user_id
        if (!ticketsByPurchaser.has(user_id)) {
          ticketsByPurchaser.set(user_id, [])
        }
        ticketsByPurchaser.get(user_id)!.push(ticket)
      })

      // Transform data to show one row per purchase with ticket count
      const attendees: AttendeeWithPurchaseInfo[] = purchasesData.map((purchase: any) => {
        const user = purchase.users
        const tickets = ticketsByPurchaser.get(purchase.user_id) || []

        // Get the first attendee from the first ticket (for display purposes)
        const firstAttendee = tickets[0]?.attendees?.[0]

        return {
          id: purchase.id,
          order_item_id: tickets[0]?.id || null,
          name: firstAttendee?.name || user?.name || null,
          email: firstAttendee?.email || user?.email || null,
          created_at: purchase.created_at,
          tickets_count: tickets.length,
          payment_status: purchase.status,
          purchase_date: purchase.created_at,
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
        if (attendee.payment_status === 'waiting_payment') stats.waiting_payment++
        else if (attendee.payment_status === 'pending') stats.pending++
        else if (attendee.payment_status === 'cancelled') stats.cancelled++
        else if (attendee.payment_status === 'delivered') stats.delivered++

        return stats
      },
      {
        total_attendees: 0,
        waiting_payment: 0,
        pending: 0,
        cancelled: 0,
        delivered: 0
      }
    )
  }

  /**
   * Export attendees data to CSV format
   */
  static async exportAttendeesCSV(eventId: string, filters: AttendeeFilters = {}): Promise<string> {
    try {
      const { attendees } = await this.getAttendeesByPurchase(eventId, filters, 1, 1000)
      
      const headers = ['Name', 'Email', 'Tickets', 'Payment Status', 'Purchase Date']
      const csvRows = [
        headers.join(','),
        ...attendees.map(attendee => [
          `"${attendee.name || ''}"`,
          `"${attendee.email || ''}"`,
          attendee.tickets_count,
          attendee.payment_status,
          `"${new Date(attendee.purchase_date).toLocaleString()}"`
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
          event_order_items!inner(
            id,
            event_id,
            user_id,
            order_id,
            qr_code,
            status,
            created_at,
            price_paid,
            event_orders!order_id(
              id,
              status,
              total_price,
              payment_method,
              created_at
            )
          ),
          event_scans(
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

      const orderItem = Array.isArray(data.order_items) ? data.order_items[0] : data.order_items
      const purchase = Array.isArray(orderItem?.purchases) ? orderItem?.purchases[0] : orderItem?.purchases

      return {
        id: data.id,
        order_item_id: data.order_item_id,
        name: data.name,
        email: data.email,
        created_at: data.created_at,
        tickets_count: 1,
        payment_status: purchase?.status || orderItem?.status || 'pending',
        purchase_date: purchase?.created_at || orderItem?.created_at || data.created_at,
        total_price: purchase?.total_price || orderItem?.price_paid || 0,
        user_id: orderItem?.user_id || ''
      }
    } catch (error: any) {
      console.error('Error fetching attendee details:', error)
      throw new Error(`Failed to fetch attendee details: ${error.message}`)
    }
  }
}
