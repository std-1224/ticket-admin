import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export async function GET(request: NextRequest) {
  try {
    
    const { searchParams } = new URL(request.url)
    const eventId = searchParams.get('eventId')
    const scannerId = searchParams.get('scannerId')
    const limit = parseInt(searchParams.get('limit') || '50')

    // First get event_scans without joins to avoid relationship issues
    let query = supabase
      .from('event_scans')
      .select('*')
      .order('scanned_at', { ascending: false })
      .limit(limit)

    const { data: scans, error } = await query

    console.log("📊 Scan history result:", { scans: scans?.length, error })

    if (error) {
      console.error('❌ Error fetching scan history:', error)
      return NextResponse.json(
        { error: 'Failed to fetch scan history', details: error.message },
        { status: 500 }
      )
    }

    // Manually fetch related data
    let transformedScans: any[] = []

    if (scans && scans.length > 0) {
      // Get unique order IDs, VIP guest IDs, and scanner IDs
      const orderIds = [...new Set(scans.map(scan => scan.order_id).filter(Boolean))]
      const vipGuestIds = [...new Set(scans.map(scan => scan.vip_guest_id).filter(Boolean))]
      const scannerIds = [...new Set(scans.map(scan => scan.scanned_by).filter(Boolean))]



      // First: Fetch event_orders data using order_id
      let ordersData: any[] = []
      if (orderIds.length > 0) {
        const { data: orders } = await supabase
          .from('event_orders')
          .select(`
            id,
            qr_code,
            status,
            total_price,
            created_at,
            event_id,
            user_id
          `)
          .in('id', orderIds)



        ordersData = orders || []
      }

      // Second: Fetch order_items using user_id and order_id from orders
      let orderItemsData: any[] = []
      if (ordersData.length > 0) {
        // Get unique combinations of user_id and order_id
        const orderUserPairs = ordersData.map(order => ({ user_id: order.user_id, order_id: order.id }))

        if (orderUserPairs.length > 0) {
          // Fetch order_items for each order
          const orderItemsPromises = orderUserPairs.map(async ({ user_id, order_id }) => {
            const { data: items } = await supabase
              .from('event_order_items')
              .select('*')
              .eq('user_id', user_id)
              .eq('order_id', order_id)

            return items || []
          })

          const orderItemsResults = await Promise.all(orderItemsPromises)
          orderItemsData = orderItemsResults.flat()
        }
      }

      // Third: Fetch events data using event_id from orders
      let eventsData: any[] = []
      if (ordersData.length > 0) {
        const eventIds = [...new Set(ordersData.map(order => order.event_id).filter(Boolean))]

        if (eventIds.length > 0) {
          const { data: events } = await supabase
            .from('events')
            .select('id, title, date, time, location')
            .in('id', eventIds)

          eventsData = events || []
        }
      }

      // Fetch user data for orders
      let usersData: any[] = []
      if (ordersData.length > 0) {
        const userIds = [...new Set(ordersData.map(order => order.user_id).filter(Boolean))]

        if (userIds.length > 0) {
          const { data: users } = await supabase
            .from('profiles')
            .select('id, name, email')
            .in('id', userIds)

          usersData = users || []
        }
      }

      // Fetch VIP guests data with event information
      let vipGuestsData: any[] = []
      if (vipGuestIds.length > 0) {
        const { data: vipGuests } = await supabase
          .from('vip_guests')
          .select(`
            id, 
            name, 
            email, 
            status, 
            created_at, 
            notes, 
            event_id,
            events(
              id,
              title,
              date,
              time,
              location
            )
          `)
          .in('id', vipGuestIds)

        vipGuestsData = vipGuests || []
      }

      // Fetch scanner users data
      let scannersData: any[] = []
      if (scannerIds.length > 0) {
        const { data: scanners } = await supabase
          .from('profiles')
          .select('id, name, email')
          .in('id', scannerIds)

        scannersData = scanners || []
      }

      // Create maps for quick lookup
      const ordersMap = new Map(ordersData.map(order => [order.id, order]))
      const vipGuestsMap = new Map(vipGuestsData.map(vip => [vip.id, vip]))
      const eventsMap = new Map(eventsData.map(event => [event.id, event]))
      const usersMap = new Map(usersData.map(user => [user.id, user]))
      const scannersMap = new Map(scannersData.map(scanner => [scanner.id, scanner]))

      // Create order_items map grouped by order_id
      const orderItemsMap = new Map()
      orderItemsData.forEach(item => {
        if (!orderItemsMap.has(item.order_id)) {
          orderItemsMap.set(item.order_id, [])
        }
        orderItemsMap.get(item.order_id).push(item)
      })

      // Filter by event if provided
      let filteredScans = scans
      if (eventId) {
        filteredScans = scans.filter(scan => {
          const order = ordersMap.get(scan.order_id)
          const vipGuest = vipGuestsMap.get(scan.vip_guest_id)
          return (order && order.event_id === eventId) || (vipGuest && vipGuest.event_id === eventId)
        })
      }

      // Transform the data for frontend consumption
      transformedScans = filteredScans.map(scan => {
        const order = ordersMap.get(scan.order_id)
        const vipGuest = vipGuestsMap.get(scan.vip_guest_id)
        const event = order ? eventsMap.get(order.event_id) : null
        const vipEvent = vipGuest ? vipGuest.events : null
        const user = order ? usersMap.get(order.user_id) : null
        const scanner = scannersMap.get(scan.scanned_by)
        const orderItems = order ? orderItemsMap.get(order.id) || [] : []

        return {
          id: scan.id,
          scanned_at: scan.scanned_at,
          created_at: scan.created_at,
          status: scan.status,
          scanner_name: scanner?.name || 'Unknown',
          scanner_email: scanner?.email,
          order: order ? {
            id: order.id,
            qr_code: order.qr_code,
            status: order.status,
            total_price: order.total_price,
            created_at: order.created_at,
            event_title: event?.title,
            event_date: event?.date,
            event_time: event?.time,
            event_location: event?.location,
            user_name: user?.name,
            user_email: user?.email,
            order_items: orderItems
          } : null,
          vip_guest: vipGuest ? {
            id: vipGuest.id,
            name: vipGuest.name,
            email: vipGuest.email,
            status: vipGuest.status,
            created_at: vipGuest.created_at,
            notes: vipGuest.notes,
            event_title: vipEvent?.title,
            event_date: vipEvent?.date,
            event_time: vipEvent?.time,
            event_location: vipEvent?.location
          } : null
        }
      })
    }

    return NextResponse.json({
      scans: transformedScans,
      total: transformedScans.length
    })

  } catch (error: any) {
    console.error('💥 Scan history API error:', error)
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {

    const body = await request.json()
    const { order_id, scanned_by, status } = body

    console.log("📝 Scan data:", { order_id, scanned_by, status })

    if (!scanned_by || !status) {
      return NextResponse.json(
        { error: 'Scanner ID and status are required' },
        { status: 400 }
      )
    }

    const { data: scan, error } = await supabase
      .from('event_scans')
      .insert({
        order_id,
        scanned_by,
        status
      })
      .select()
      .single()

    if (error) {
      console.error('❌ Error creating scan record:', error)
      return NextResponse.json(
        { error: 'Failed to create scan record', details: error.message },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      scan
    })

  } catch (error: any) {
    console.error('💥 Create scan API error:', error)
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    )
  }
}
