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
    const paymentStatus = searchParams.get('payment_status') as 'pending' | 'delivered' | 'cancelled' | undefined
    const checkinStatus = searchParams.get('checkin_status') || undefined
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '50')
    const format = searchParams.get('format') // 'csv' for export

    console.log('Orders API called with params:', {
      page, limit, search, paymentStatus, checkinStatus
    })

    // Build the query for event_orders without joins first
    let query = supabaseAdmin
      .from('event_orders')
      .select(`
        id,
        user_id,
        event_id,
        total_price,
        status,
        created_at,
        updated_at,
        qr_code
      `, { count: 'exact' })

    // Apply search filter on user name/email
    if (search && search.trim()) {
      const searchTerm = search.trim()
      console.log('Applying search filter for:', searchTerm)
      query = query.or(`profiles.name.ilike.%${searchTerm}%,profiles.email.ilike.%${searchTerm}%`)
    }

    // Exclude waiting_payment orders by default
    query = query.neq('status', 'waiting_payment')

    // Apply payment status filter
    if (paymentStatus) {
      query = query.eq('status', paymentStatus)
    }

    // Apply check-in status filter
    if (checkinStatus === 'checked_in') {
      // Get orders that have valid scans
      const { data: validScans } = await supabaseAdmin
        .from('event_scans')
        .select('order_id')
        .eq('status', 'valid')

      if (validScans && validScans.length > 0) {
        const orderIds = validScans.map(scan => scan.order_id)
        query = query.in('id', orderIds)
      } else {
        // No valid scans, return empty result
        query = query.eq('id', 'no-match')
      }
    } else if (checkinStatus === 'not_checked_in') {
      // Show orders with status pending
      query = query.eq('status', 'pending')
    }

    // Apply pagination
    const offset = (page - 1) * limit
    query = query.range(offset, offset + limit - 1)

    // Order by creation date
    query = query.order('created_at', { ascending: false })

    const { data: orders, error } = await query

    if (error) {
      console.error('Orders query error:', error)
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
      throw new Error(`Failed to fetch orders: ${error.message}`)
    }

    // Fetch users and events separately
    const userIds = [...new Set((orders || []).map((order: any) => order.user_id).filter(Boolean))]
    const eventIds = [...new Set((orders || []).map((order: any) => order.event_id).filter(Boolean))]

    // Fetch users
    let usersData: any[] = []
    if (userIds.length > 0) {
      const { data: users, error: usersError } = await supabaseAdmin
        .from('profiles')
        .select('id, name, email')
        .in('id', userIds)

      if (usersError) {
        console.error('❌ Users fetch error:', usersError)
      }
      usersData = users || []
    }

    // Fetch events
    let eventsData: any[] = []
    if (eventIds.length > 0) {
      const { data: events, error: eventsError } = await supabaseAdmin
        .from('events')
        .select('id, title, description')
        .in('id', eventIds)

      if (eventsError) {
        console.error('❌ Events fetch error:', eventsError)
      }
      eventsData = events || []
    }

    // Create lookup maps
    const usersMap = new Map(usersData.map(user => [user.id, user]))
    const eventsMap = new Map(eventsData.map(event => [event.id, event]))

    // Transform orders data to match expected format
    const attendees = (orders || []).map((order: any) => {
      const user = usersMap.get(order.user_id) || {}
      const event = eventsMap.get(order.event_id) || {}

      return {
        id: order.id,
        name: user.name || 'Unknown',
        email: user.email || 'N/A',
        avatar_url: user.avatar_url || null,
        event_name: event.title || 'Unknown Event',
        event_description: event.description || '',
        status: order.status,
        qr_code: order.qr_code,
        total_price: order.total_price,
        created_at: order.created_at,
        updated_at: order.updated_at,
        order_id: order.id,
        user_id: order.user_id,
        event_id: order.event_id
      }
    })

    // Get scan data for check-in status
    let scansData: any[] = []
    if (attendees && attendees.length > 0) {
      const orderIds = attendees.map((a: any) => a.order_id).filter(Boolean)

      if (orderIds.length > 0) {
        const { data: scans } = await supabaseAdmin
          .from('event_scans')
          .select('id, order_id, status, scanned_at')
          .in('order_id', orderIds)
          .eq('status', 'valid')

        scansData = scans || []
      }
    }

    // Create a map of order_id to scans
    const scansByOrder = new Map<string, any[]>()
    scansData.forEach(scan => {
      if (!scansByOrder.has(scan.order_id)) {
        scansByOrder.set(scan.order_id, [])
      }
      scansByOrder.get(scan.order_id)!.push(scan)
    })

    // Add scan data to attendees
    const attendeesWithScans = attendees?.map(attendee => ({
      ...attendee,
      scans: scansByOrder.get(attendee.order_id) || [],
      is_checked_in: scansByOrder.has(attendee.order_id)
    })) || []

    // Final filtered attendees
    let filteredAttendees = attendeesWithScans

    // Calculate real stats from event_orders table
    const { data: deliveredOrders, error: deliveredError } = await supabaseAdmin
      .from('event_orders')
      .select('total_price')
      .eq('status', 'delivered')

    const { data: pendingOrders, error: pendingError } = await supabaseAdmin
      .from('event_orders')
      .select('total_price')
      .eq('status', 'pending')

    const { count: totalCount } = await supabaseAdmin
      .from('event_orders')
      .select('id', { count: 'exact', head: true })

    if (deliveredError) {
      console.error('Error fetching delivered orders:', deliveredError)
    }

    if (pendingError) {
      console.error('Error fetching pending orders:', pendingError)
    }

    // Calculate totals
    const completePaymentAmount = deliveredOrders?.reduce((sum, order) => sum + (order.total_price || 0), 0) || 0
    const pendingPaymentAmount = pendingOrders?.reduce((sum, order) => sum + (order.total_price || 0), 0) || 0
    const checkedInCount = filteredAttendees.filter(a => a.is_checked_in).length
    const notCheckedInCount = filteredAttendees.filter(a => !a.is_checked_in).length

    const stats = {
      total_attendees: totalCount || 0,
      complete_payment_amount: completePaymentAmount,
      pending_payment_amount: pendingPaymentAmount,
      failed_payments: 0, // Keep for compatibility
      checked_in: checkedInCount,
      not_checked_in: notCheckedInCount
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
          const row = [
            `"${attendee.name || ''}"`,
            `"${attendee.email || ''}"`,
            `"${attendee.event_name || ''}"`,
            `"${attendee.status || ''}"`,
            `"${attendee.qr_code || ''}"`,
            `"${attendee.total_price || ''}"`,
            `"${attendee.created_at || ''}"`
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
        total_count: totalCount || 0
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
