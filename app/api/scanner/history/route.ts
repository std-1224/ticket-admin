import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export async function GET(request: NextRequest) {
  try {
    console.log("📋 Scanner history API called")
    
    const { searchParams } = new URL(request.url)
    const eventId = searchParams.get('eventId')
    const scannerId = searchParams.get('scannerId')
    const limit = parseInt(searchParams.get('limit') || '50')

    console.log("📊 Query params:", { eventId, scannerId, limit })

    let query = supabase
      .from('scans')
      .select(`
        *,
        tickets(
          *,
          ticket_types(name, description),
          events(title, date, time, location)
        ),
        scanned_by_user:users!scanned_by(name, email)
      `)
      .order('scanned_at', { ascending: false })
      .limit(limit)

    // Filter by event if provided
    if (eventId) {
      query = query.eq('tickets.event_id', eventId)
    }

    // Note: Removed scanner filtering - show ALL scan history regardless of scanner
    // The scanned_by field will still be properly saved with the current scanner's user ID

    const { data: scans, error } = await query

    console.log("📊 Scan history result:", { scans: scans?.length, error })

    if (error) {
      console.error('❌ Error fetching scan history:', error)
      return NextResponse.json(
        { error: 'Failed to fetch scan history', details: error.message },
        { status: 500 }
      )
    }

    // Transform the data for frontend consumption
    const transformedScans = scans?.map(scan => ({
      id: scan.id,
      scanned_at: scan.scanned_at,
      status: scan.status,
      scanner_name: scan.scanned_by_user?.name || 'Unknown',
      scanner_email: scan.scanned_by_user?.email,
      ticket: scan.tickets ? {
        id: scan.tickets.id,
        qr_code: scan.tickets.qr_code,
        status: scan.tickets.status,
        price_paid: scan.tickets.price_paid,
        purchased_at: scan.tickets.purchased_at,
        ticket_type: scan.tickets.ticket_types?.name,
        ticket_description: scan.tickets.ticket_types?.description,
        event_title: scan.tickets.events?.title,
        event_date: scan.tickets.events?.date,
        event_time: scan.tickets.events?.time,
        event_location: scan.tickets.events?.location
      } : null
    })) || []

    console.log("✅ Returning scan history:", transformedScans.length, "records")

    return NextResponse.json({
      scans: transformedScans,
      total: transformedScans.length
    })

  } catch (error) {
    console.error('💥 Scan history API error:', error)
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    console.log("📝 Creating scan record")
    
    const body = await request.json()
    const { ticket_id, scanned_by, status } = body

    console.log("📝 Scan data:", { ticket_id, scanned_by, status })

    if (!scanned_by || !status) {
      return NextResponse.json(
        { error: 'Scanner ID and status are required' },
        { status: 400 }
      )
    }

    const { data: scan, error } = await supabase
      .from('scans')
      .insert({
        ticket_id,
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

    console.log("✅ Scan record created:", scan.id)

    return NextResponse.json({
      success: true,
      scan
    })

  } catch (error) {
    console.error('💥 Create scan API error:', error)
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    )
  }
}
