import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { ticket_id, scanner_id } = body

    if (!ticket_id || !scanner_id) {
      return NextResponse.json(
        { error: 'Ticket ID and scanner ID are required' },
        { status: 400 }
      )
    }

    // Validate scanner credentials
    const { data: scannerUser, error: scannerError } = await supabase
      .from('users')
      .select('id, name, role')
      .eq('id', scanner_id)
      .eq('role', 'scanner')
      .single()

    if (scannerError || !scannerUser) {
      return NextResponse.json(
        { error: 'Invalid scanner credentials' },
        { status: 401 }
      )
    }

    // Get the ticket
    const { data: ticket, error: ticketError } = await supabase
      .from('tickets')
      .select('id, purchaser_id')
      .eq('id', ticket_id)
      .single()

    if (ticketError || !ticket) {
      return NextResponse.json(
        { error: 'Ticket not found' },
        { status: 404 }
      )
    }

    // Find the most recent 'valid' scan for this ticket
    const { data: validScan, error: scanError } = await supabase
      .from('scans')
      .select('id')
      .eq('ticket_id', ticket_id)
      .eq('status', 'valid')
      .order('scanned_at', { ascending: false })
      .limit(1)
      .single()

    if (scanError || !validScan) {
      return NextResponse.json(
        { error: 'No valid scan found to confirm' },
        { status: 404 }
      )
    }

    // Update the scan status from 'valid' to 'used'
    const { error: updateError } = await supabase
      .from('scans')
      .update({ status: 'used' })
      .eq('id', validScan.id)

    if (updateError) {
      return NextResponse.json(
        { error: 'Failed to update scan status', details: updateError.message },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      message: 'Entry confirmed successfully',
      scan_id: validScan.id,
      status: 'used'
    })

  } catch (error: any) {
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    )
  }
}
