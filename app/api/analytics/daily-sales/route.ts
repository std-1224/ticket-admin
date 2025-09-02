import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export async function GET(request: NextRequest) {
  try {
    console.log("📊 Daily sales API called")
    
    const { searchParams } = new URL(request.url)
    const days = parseInt(searchParams.get('days') || '30') // Default to 30 days
    
    console.log("📊 Query params:", { days })

    // Use the imported supabase client

    // Get the date range (last N days)
    const endDate = new Date()
    const startDate = new Date()
    startDate.setDate(endDate.getDate() - days)

    console.log("📊 Date range:", { 
      startDate: startDate.toISOString().split('T')[0], 
      endDate: endDate.toISOString().split('T')[0] 
    })

    // Fetch orders with pending and delivered status within the date range
    const { data: orders, error } = await supabase
      .from('orders')
      .select('created_at, status, total_price')
      .in('status', ['pending', 'delivered'])
      .gte('created_at', startDate.toISOString())
      .lte('created_at', endDate.toISOString())
      .order('created_at', { ascending: true })

    console.log("📊 Orders fetched:", { count: orders?.length, error })

    if (error) {
      console.error('❌ Error fetching orders:', error)
      return NextResponse.json(
        { error: 'Failed to fetch orders', details: error.message },
        { status: 500 }
      )
    }

    // Group orders by date and count sales
    const salesByDate = new Map<string, { count: number, revenue: number }>()
    
    // Initialize all dates in range with 0 sales
    for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
      const dateStr = d.toISOString().split('T')[0]
      salesByDate.set(dateStr, { count: 0, revenue: 0 })
    }

    // Count actual sales by date
    orders?.forEach((order: any) => {
      const orderDate = new Date(order.created_at).toISOString().split('T')[0]
      const existing = salesByDate.get(orderDate) || { count: 0, revenue: 0 }
      salesByDate.set(orderDate, {
        count: existing.count + 1,
        revenue: existing.revenue + (order.total_price || 0)
      })
    })

    // Convert to array format for the chart
    const salesData = Array.from(salesByDate.entries()).map(([date, data]) => {
      const dateObj = new Date(date)
      return {
        date: dateObj.toLocaleDateString('en-US', { 
          month: 'short', 
          day: 'numeric' 
        }),
        fullDate: date,
        sales: data.count,
        revenue: data.revenue
      }
    })

    console.log("✅ Daily sales data prepared:", { 
      totalDays: salesData.length,
      totalSales: salesData.reduce((sum, day) => sum + day.sales, 0),
      totalRevenue: salesData.reduce((sum, day) => sum + day.revenue, 0)
    })

    return NextResponse.json({
      success: true,
      data: salesData,
      summary: {
        totalDays: salesData.length,
        totalSales: salesData.reduce((sum, day) => sum + day.sales, 0),
        totalRevenue: salesData.reduce((sum, day) => sum + day.revenue, 0),
        averageDailySales: Math.round(salesData.reduce((sum, day) => sum + day.sales, 0) / salesData.length)
      }
    })

  } catch (error: any) {
    console.error('💥 Daily sales API error:', error)
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    )
  }
}
