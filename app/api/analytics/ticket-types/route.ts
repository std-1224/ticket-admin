import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export async function GET(request: NextRequest) {
  try {
    console.log("📊 Ticket types analytics API called")

    // Get actual ticket sales data from event_order_items
    const { data: orderItems, error: orderItemsError } = await supabase
      .from('event_order_items')
      .select(`
        id,
        ticket_type_id,
        amount,
        price_paid,
        ticket_types!inner(
          id,
          name,
          price
        )
      `)
      .eq('status', 'delivered')

    if (orderItemsError) {
      console.error('❌ Error fetching order items:', orderItemsError)
      return NextResponse.json(
        { error: 'Failed to fetch order items', details: orderItemsError.message },
        { status: 500 }
      )
    }

    console.log("📊 Order items fetched:", { count: orderItems?.length })

    if (!orderItems || orderItems.length === 0) {
      console.log("📊 No order items found")
      return NextResponse.json({
        success: true,
        data: [],
        summary: {
          totalTypes: 0,
          totalTickets: 0,
          totalRevenue: 0,
          mostPopular: 'No data'
        }
      })
    }

    // Calculate ticket sales by type
    const ticketTypeStats = new Map<string, {
      id: string,
      name: string,
      quantity: number,
      revenue: number
    }>()

    orderItems.forEach(item => {
      const ticketTypeId = item.ticket_type_id
      const ticketTypeName = (item.ticket_types as any)?.name || 'Unknown'
      const amount = item.amount || 1
      const revenue = (item.price_paid || 0) * amount

      console.log("📊 Processing order item:", {
        ticketTypeId,
        ticketTypeName,
        amount,
        pricePaid: item.price_paid,
        revenue
      })

      if (ticketTypeStats.has(ticketTypeId)) {
        const existing = ticketTypeStats.get(ticketTypeId)!
        existing.quantity += amount
        existing.revenue += revenue
      } else {
        ticketTypeStats.set(ticketTypeId, {
          id: ticketTypeId,
          name: ticketTypeName,
          quantity: amount,
          revenue: revenue
        })
      }
    })

    console.log("📊 Ticket type stats calculated:", {
      totalTypes: ticketTypeStats.size,
      stats: Array.from(ticketTypeStats.values())
    })

    // Convert Map to array and add colors
    const colors = [
      "hsl(var(--chart-1))",
      "hsl(var(--chart-2))",
      "hsl(var(--chart-3))",
      "hsl(var(--chart-4))",
      "hsl(var(--chart-5))"
    ]

    const ticketTypesArray = Array.from(ticketTypeStats.values())
    const finalTicketTypesData = ticketTypesArray.map((type, index) => ({
      name: type.name,
      value: type.quantity,
      revenue: type.revenue,
      fill: colors[index % colors.length]
    }))

    // Sort by quantity descending
    finalTicketTypesData.sort((a, b) => b.value - a.value)

    const totalTickets = finalTicketTypesData.reduce((sum, type) => sum + type.value, 0)
    const totalRevenue = finalTicketTypesData.reduce((sum, type) => sum + type.revenue, 0)

    console.log("✅ Ticket types data prepared:", {
      totalTypes: finalTicketTypesData.length,
      totalTickets: totalTickets,
      totalRevenue: totalRevenue,
      ticketNames: finalTicketTypesData.map(t => t.name)
    })

    return NextResponse.json({
      success: true,
      data: finalTicketTypesData,
      summary: {
        totalTypes: finalTicketTypesData.length,
        totalTickets: totalTickets,
        totalRevenue: totalRevenue,
        mostPopular: finalTicketTypesData[0]?.name || 'No data'
      }
    })

  } catch (error: any) {
    console.error('💥 Ticket types analytics API error:', error)
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    )
  }
}
