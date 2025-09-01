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
    const paymentStatus = searchParams.get('paymentStatus') as 'paid' | 'pending' | 'failed' | 'all' | undefined
    const checkInStatus = searchParams.get('checkInStatus') as 'checked_in' | 'not_checked_in' | 'all' | undefined
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '50')
    const format = searchParams.get('format') // 'csv' for export

    // Test basic connection first
    const { data: testData, error: testError, count: testCount } = await supabaseAdmin
      .from('attendees')
      .select('*', { count: 'exact' })
      .limit(1)

    // Build the query to get all attendees across all events
    let query = supabaseAdmin
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
          price_paid,
          events(
            id,
            title,
            date,
            time,
            location
          )
        )
      `)

    // Apply search filter
    if (search && search.trim()) {
      const searchTerm = search.trim()
      console.log('Applying search filter for:', searchTerm)
      query = query.or(`name.ilike.%${searchTerm}%,email.ilike.%${searchTerm}%`)
    }

    // Apply payment status filter
    if (paymentStatus && paymentStatus !== 'all') {
      query = query.eq('order_items.status', paymentStatus)
    }

    // Get total count for pagination (apply same filters for accurate count)
    let countQuery = supabaseAdmin
      .from('attendees')
      .select('id, order_items!inner(id)', { count: 'exact', head: true })

    // Apply same filters to count query
    if (search && search.trim()) {
      const searchTerm = search.trim()
      countQuery = countQuery.or(`name.ilike.%${searchTerm}%,email.ilike.%${searchTerm}%`)
    }
    if (paymentStatus && paymentStatus !== 'all') {
      countQuery = countQuery.eq('order_items.status', paymentStatus)
    }

    const { count } = await countQuery

    // Apply pagination
    const offset = (page - 1) * limit
    query = query.range(offset, offset + limit - 1)

    // Order by creation date
    query = query.order('created_at', { ascending: false })

    const { data: attendees, error } = await query
    // Also check raw attendees count
    const { count: rawCount } = await supabaseAdmin
      .from('attendees')
      .select('id', { count: 'exact', head: true })

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

    // Get scan data separately for all attendees
    let scansData: any[] = []
    if (attendees && attendees.length > 0) {
      const ticketIds = attendees.map((a: any) => a.order_item_id).filter(Boolean)

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

    // Add scan data to attendees
    const attendeesWithScans = attendees?.map(attendee => ({
      ...attendee,
      scans: scansByTicket.get(attendee.order_item_id) || []
    })) || []

    // Apply check-in status filter after getting scan data
    let filteredAttendees = attendeesWithScans
    if (checkInStatus && checkInStatus !== 'all') {
      if (checkInStatus === 'checked_in') {
        filteredAttendees = attendeesWithScans.filter(a => a.scans && a.scans.length > 0)
      } else if (checkInStatus === 'not_checked_in') {
        filteredAttendees = attendeesWithScans.filter(a => !a.scans || a.scans.length === 0)
      }
    }

    // Calculate stats from the current page data
    const stats = {
      total_attendees: count || 0,
      paid_payments: 0,
      pending_payments: 0,
      failed_payments: 0,
      checked_in: 0,
      not_checked_in: 0
    }

    // Calculate stats from the current page data
    filteredAttendees.forEach(attendee => {
      const ticket = Array.isArray(attendee.tickets) ? attendee.tickets[0] : attendee.tickets
      if (ticket) {
        if (ticket.status === 'paid') stats.paid_payments++
        else if (ticket.status === 'pending') stats.pending_payments++
        else if (ticket.status === 'failed') stats.failed_payments++
      }

      if (attendee.scans && attendee.scans.length > 0) {
        stats.checked_in++
      } else {
        stats.not_checked_in++
      }
    })

    // Handle CSV export
    if (format === 'csv') {
      try {
        const csvHeaders = [
          'Name',
          'Email',
          'Event',
          'Ticket Status',
          'QR Code',
          'Price Paid',
          'Purchased At',
          'Check-in Status',
          'Checked In At'
        ]

        const csvRows = [csvHeaders.join(',')]

        filteredAttendees.forEach(attendee => {
          const ticket = Array.isArray(attendee.tickets) ? attendee.tickets[0] : attendee.tickets
          const event = Array.isArray(ticket?.events) ? ticket?.events[0] : ticket?.events
          const scan = attendee.scans?.[0]

          const row = [
            `"${attendee.name || ''}"`,
            `"${attendee.email || ''}"`,
            `"${event?.title || ''}"`,
            `"${ticket?.status || ''}"`,
            `"${ticket?.qr_code || ''}"`,
            `"${ticket?.price_paid || ''}"`,
            `"${ticket?.created_at || ''}"`,
            `"${scan ? 'Checked In' : 'Not Checked In'}"`,
            `"${scan?.scanned_at || ''}"`
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
