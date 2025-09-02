import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { isAuthError } from '@/lib/auth-error-handler'

// Create service role client to bypass RLS
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABSE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  }
)

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)

    const search = searchParams.get('search') || undefined
    const paymentStatus = searchParams.get('paymentStatus') as 'waiting_payment' | 'pending' | 'cancelled' | 'delivered' | undefined
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '50')
    const format = searchParams.get('format') // 'csv' for export

    // Test basic connection first
    const { data: testData, error: testError, count: testCount } = await supabaseAdmin
      .from('attendees')
      .select('*', { count: 'exact' })
      .limit(1)

    // Build the query to get all attendees across all events
    // First get all attendees
    let query = supabaseAdmin
      .from('attendees')
      .select(`
        id,
        order_item_id,
        name,
        email,
        created_at
      `)

    // Apply search filter
    if (search && search.trim()) {
      const searchTerm = search.trim()
      console.log('Applying search filter for:', searchTerm)
      query = query.or(`name.ilike.%${searchTerm}%,emai l.ilike.%${searchTerm}%`)
    }

    // Get total count for pagination
    const { count } = await supabaseAdmin
      .from('attendees')
      .select('id', { count: 'exact', head: true })

    // Apply pagination
    const offset = (page - 1) * limit
    query = query.range(offset, offset + limit - 1)

    // Order by creation date
    query = query.order('created_at', { ascending: false })

    const { data: attendees, error } = await query

    if (error) {
      console.error('Attendees query error:', error)
      if (isAuthError(error)) {
        return NextResponse.json(
          {
            success: false,
            error: 'Authentication required',
            code: 'AUTH_ERROR'
          },
          { status: 401 }
        )
      }
      throw new Error(`Failed to fetch attendees: ${error.message}`)
    }

    // Now fetch tickets separately for all attendees
    let ticketsData: any[] = []
    if (attendees && attendees.length > 0) {
      const orderItemIds = attendees.map((a: any) => a.order_item_id).filter(Boolean)

      if (orderItemIds.length > 0) {
        let ticketsQuery = supabaseAdmin
          .from('order_items')
          .select(`
            id,
            event_id,
            order_id,
            qr_code,
            status,
            purchased_at,
            price_paid,
            events(
              id,
              title,
              date,
              time,
              location
            )
          `)
          .in('id', orderItemIds)

        // Apply payment status filter to tickets
        if (paymentStatus) {
          ticketsQuery = ticketsQuery.eq('status', paymentStatus)
        }

        const { data: tickets, error: ticketsError } = await ticketsQuery

        if (ticketsError) {
          console.error('Tickets query error:', ticketsError)
          throw new Error(`Failed to fetch tickets: ${ticketsError.message}`)
        }

        ticketsData = tickets || []
      }
    }

    // Create a map of order_item_id to ticket data
    const ticketsByOrderItemId = new Map<string, any>()
    ticketsData.forEach(ticket => {
      ticketsByOrderItemId.set(ticket.id, ticket)
    })

    // Add ticket data to attendees
    const attendeesWithTickets = attendees?.map(attendee => ({
      ...attendee,
      tickets: ticketsByOrderItemId.get(attendee.order_item_id) || null
    })) || []

    // Get scan data separately for all attendees
    let scansData: any[] = []
    if (attendeesWithTickets && attendeesWithTickets.length > 0) {
      const ticketIds = attendeesWithTickets.map((a: any) => a.order_item_id).filter(Boolean)

      if (ticketIds.length > 0) {
        const { data: scans } = await supabaseAdmin
          .from('scans')
          .select('id, order_item_id, status, scanned_at')
          .in('order_item_id', ticketIds)
          .eq('status', 'success')

        scansData = scans || []
      }
    }

    // Create a map of order_item_id to scans
    const scansByTicket = new Map<string, any[]>()
    scansData.forEach(scan => {
      if (!scansByTicket.has(scan.order_item_id)) {
        scansByTicket.set(scan.order_item_id, [])
      }
      scansByTicket.get(scan.order_item_id)!.push(scan)
    })

    // Add scan data to attendees with tickets
    const attendeesWithScans = attendeesWithTickets?.map(attendee => ({
      ...attendee,
      scans: scansByTicket.get(attendee.order_item_id) || []
    })) || []

    // Filter by payment status if specified
    let filteredAttendees = attendeesWithScans
    if (paymentStatus) {
      filteredAttendees = attendeesWithScans.filter(attendee =>
        attendee.tickets && attendee.tickets.status === paymentStatus
      )
    }

    // Calculate real stats from orders table
    const { data: deliveredOrders, error: deliveredError } = await supabaseAdmin
      .from('orders')
      .select('total_price')
      .eq('status', 'delivered')

    const { data: pendingOrders, error: pendingError } = await supabaseAdmin
      .from('orders')
      .select('total_price')
      .eq('status', 'pending')

    if (deliveredError) {
      console.error('Error fetching delivered orders:', deliveredError)
    }

    if (pendingError) {
      console.error('Error fetching pending orders:', pendingError)
    }

    // Calculate totals
    const completePaymentAmount = deliveredOrders?.reduce((sum, order) => sum + (order.total_price || 0), 0) || 0
    const pendingPaymentAmount = pendingOrders?.reduce((sum, order) => sum + (order.total_price || 0), 0) || 0
    const checkedInCount = deliveredOrders?.length || 0

    const stats = {
      total_attendees: count || 0,
      complete_payment_amount: completePaymentAmount,
      pending_payment_amount: pendingPaymentAmount,
      failed_payments: 0, // Keep for compatibility
      checked_in: checkedInCount,
      not_checked_in: (pendingOrders?.length || 0)
    }

    // Handle CSV export
    if (format === 'csv') {
      try {
        const csvHeaders = [
          'Name',
          'Email',
          'Event',
          'Payment Status',
          'QR Code',
          'Price Paid',
          'Created At'
        ]

        const csvRows = [csvHeaders.join(',')]

        filteredAttendees.forEach(attendee => {
          const ticket = Array.isArray(attendee.tickets) ? attendee.tickets[0] : attendee.tickets
          const event = Array.isArray(ticket?.events) ? ticket?.events[0] : ticket?.events

          const row = [
            `"${attendee.name || ''}"`,
            `"${attendee.email || ''}"`,
            `"${event?.title || ''}"`,
            `"${ticket?.status || ''}"`,
            `"${ticket?.qr_code || ''}"`,
            `"${ticket?.price_paid || ''}"`,
            `"${ticket?.purchased_at || ''}"`
          ]

          csvRows.push(row.join(','))
        })

        const csvContent = csvRows.join('\n')

        return new NextResponse(csvContent, {
          status: 200,
          headers: {
            'Content-Type': 'text/csv',
            'Content-Disposition': `attachment; filename="all-attendees-${new Date().toISOString().split('T')[0]}.csv"`
          }
        })
      } catch (csvError: any) {
        console.error('CSV export error:', csvError)
        return NextResponse.json(
          {
            success: false,
            error: 'Failed to export CSV'
          },
          { status: 500 }
        )
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        attendees: filteredAttendees,
        stats,
        total_count: count || 0
      }
    })

  } catch (error: any) {
    console.error('Error in all attendees API:', error)

    // Check if it's an auth error
    if (error.message?.includes('auth') || error.code === 'PGRST301') {
      return NextResponse.json(
        {
          success: false,
          error: 'Authentication required',
          code: 'AUTH_ERROR'
        },
        { status: 401 }
      )
    }

    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Internal server error'
      },
      { status: 500 }
    )
  }
}
