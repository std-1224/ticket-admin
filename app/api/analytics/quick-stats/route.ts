import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export async function GET(request: NextRequest) {
  try {
    
    const { searchParams } = new URL(request.url)
    const eventId = searchParams.get('event_id')

    // Base query for event_order_items with delivered status
    let orderItemsQuery = supabase
      .from('event_order_items')
      .select(`
        id,
        price_paid,
        amount,
        ticket_type_id,
        event_id,
        order_id,
        ticket_types!inner(
          id,
          name,
          event_id
        )
      `)
      .eq('status', 'delivered')

    // Filter by event if provided
    if (eventId) {
      orderItemsQuery = orderItemsQuery.eq('event_id', eventId)
    }

    const { data: orderItems, error: orderItemsError } = await orderItemsQuery

    if (orderItemsError) {
      console.error('❌ Error fetching order items:', orderItemsError)
      return NextResponse.json(
        { error: 'Failed to fetch order items', details: orderItemsError.message },
        { status: 500 }
      )
    }

    if (!orderItems || orderItems.length === 0) {
      return NextResponse.json({
        success: true,
        data: {
          ticketsSold: 0,
          revenueGenerated: 0,
          mostPopularTicket: 'No data'
        }
      })
    }

    // Calculate tickets sold (sum of amount field)
    const ticketsSold = orderItems.reduce((sum, item) => sum + (item.amount || 1), 0)

    // Calculate revenue generated (sum of price_paid * amount)
    const revenueGenerated = orderItems.reduce((sum, item) => {
      const amount = item.amount || 1
      const price = item.price_paid || 0
      return sum + (price * amount)
    }, 0)

    // Calculate most popular ticket type
    const ticketTypeCount = new Map<string, { count: number, name: string }>()
    
    orderItems.forEach(item => {
      const ticketTypeId = item.ticket_type_id
      const ticketTypeName = item.ticket_types?.name || 'Unknown'
      const amount = item.amount || 1
      
      if (ticketTypeCount.has(ticketTypeId)) {
        const existing = ticketTypeCount.get(ticketTypeId)!
        existing.count += amount
      } else {
        ticketTypeCount.set(ticketTypeId, { count: amount, name: ticketTypeName })
      }
    })

    // Find the most popular ticket type
    let mostPopularTicket = 'No data'
    let maxCount = 0
    
    for (const [ticketTypeId, data] of ticketTypeCount.entries()) {
      if (data.count > maxCount) {
        maxCount = data.count
        mostPopularTicket = data.name
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        ticketsSold,
        revenueGenerated: Math.round(revenueGenerated * 100) / 100, // Round to 2 decimal places
        mostPopularTicket
      }
    })

  } catch (error: any) {
    console.error('💥 Quick stats API error:', error)
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    )
  }
}
