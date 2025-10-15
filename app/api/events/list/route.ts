import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { isAuthError } from '@/lib/auth-error-handler'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const limit = parseInt(searchParams.get('limit') || '50')
    const search = searchParams.get('search')

    let query = supabase
      .from('events')
      .select(`
        id,
        title,
        description,
        date,
        time,
        location,
        image_url,
        created_at,
        created_by
      `)
      .order('date', { ascending: false })
      .limit(limit)

    // Apply search filter if provided
    if (search) {
      query = query.or(`title.ilike.%${search}%,description.ilike.%${search}%,location.ilike.%${search}%`)
    }

    const { data: events, error } = await query

    if (error) {
      // Check if it's an auth error and return appropriate status
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
      throw new Error(`Failed to fetch events: ${error.message}`)
    }

    // Get attendee counts for each event
    const eventsWithCounts = await Promise.all(
      (events || []).map(async (event) => {
        try {
          // Get total purchases for this event
          const { count: purchaseCount } = await supabase
            .from('event_orders')
            .select('id', { count: 'exact', head: true })
            .eq('event_id', event.id)

          // Get total ticket capacity from ticket_types for this event
          const { data: ticketTypes, error: ticketTypesError } = await supabase
            .from('ticket_types')
            .select('total_quantity')
            .eq('event_id', event.id)

          let ticketCount = ticketTypes?.length || 0

          return {
            ...event,
            purchase_count: purchaseCount || 0,
            ticket_count: ticketCount
          }
        } catch (error) {
          console.error(`Error getting counts for event ${event.id}:`, error)
          return {
            ...event,
            purchase_count: 0,
            ticket_count: 0
          }
        }
      })
    )

    // Calculate aggregated statistics for all events
    const aggregatedStats = eventsWithCounts.reduce((acc, event) => {
      acc.totalEvents += 1
      acc.totalPurchases += event.purchase_count
      acc.totalTickets += event.ticket_count
      return acc
    }, {
      totalEvents: 0,
      totalPurchases: 0,
      totalTickets: 0
    })

    // Get additional aggregated data
    try {
      // Get total revenue across all events
      const { data: revenueData } = await supabase
        .from('event_orders')
        .select('total_price')
        .eq('status', 'delivered')

      const totalRevenue = revenueData?.reduce((sum, purchase) => sum + (purchase.total_price || 0), 0) || 0

      // Get total check-ins across all events
      const { count: totalCheckIns } = await supabase
        .from('event_scans')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'valid')

      aggregatedStats.totalRevenue = totalRevenue
      aggregatedStats.totalCheckIns = totalCheckIns || 0
    } catch (error) {
      console.error('Error calculating aggregated stats:', error)
      aggregatedStats.totalRevenue = 0
      aggregatedStats.totalCheckIns = 0
    }

    return NextResponse.json({
      success: true,
      data: {
        events: eventsWithCounts,
        total_count: eventsWithCounts.length,
        aggregated_stats: aggregatedStats
      }
    })

  } catch (error: any) {
    console.error('Error in events list API:', error)

    // Check if it's an auth error
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

    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Internal server error'
      },
      { status: 500 }
    )
  }
}
