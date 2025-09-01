import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    
    const { qr_code, scanner_id, event_id } = body

    if (!qr_code || !scanner_id) {
      return NextResponse.json(
        { error: 'QR code and scanner ID are required' },
        { status: 400 }
      )
    }

    // Find the ticket by QR code with user information
    const { data: ticket, error: ticketError } = await supabase
      .from('tickets')
      .select(`
        *,
        ticket_types(*),
        events(*),
        users!purchaser_id(id, name, email)
      `)
      .eq('qr_code', qr_code)
      .single()

    if (ticketError || !ticket) {
      // Try to record invalid scan if scanner_id is valid
      try {
        const { data: scannerUser } = await supabase
          .from('users')
          .select('id')
          .eq('id', scanner_id)
          .eq('role', 'scanner')
          .single()

        if (scannerUser) {
          await supabase.from('scans').insert({
            ticket_id: null, // No ticket found
            scanned_by: scanner_id,
            status: 'invalid'
          })
        }
      } catch (error) {
        // Ignore scan recording errors for invalid tickets
      }

      return NextResponse.json({
        success: false,
        status: 'invalid',
        message: 'Ticket not found',
        ticket: null
      })
    }

    // Check if ticket belongs to the event (if event_id is provided)
    if (event_id && ticket.event_id !== event_id) {
      // Record invalid scan with proper scanner ID
      try {
        const { data: scannerUser } = await supabase
          .from('users')
          .select('id')
          .eq('id', scanner_id)
          .eq('role', 'scanner')
          .single()

        if (scannerUser) {
          await supabase.from('scans').insert({
            ticket_id: ticket.id,
            scanned_by: scanner_id,
            status: 'invalid'
          })
        }
      } catch (error) {
        // Ignore scan recording errors
      }

      return NextResponse.json({
        success: false,
        status: 'invalid',
        message: 'Ticket is not valid for this event',
        ticket: {
          id: ticket.id,
          event_title: ticket.events?.title,
          ticket_type: ticket.ticket_types?.name,
          status: ticket.status,
          purchaser_id: ticket.purchaser_id,
          user_name: ticket.users?.name,
          user_email: ticket.users?.email
        }
      })
    }

    // Check if ticket has been scanned before by looking at scans table
    const { data: previousScans, error: scanError } = await supabase
      .from('scans')
      .select('*')
      .eq('ticket_id', ticket.id)
      .eq('status', 'valid')
      .order('scanned_at', { ascending: false })

    if (previousScans && previousScans.length > 0) {

      // Record this duplicate scan attempt
      await supabase.from('scans').insert({
        ticket_id: ticket.id,
        scanned_by: ticket.purchaser_id, // Use purchaser_id as temporary scanner ID
        status: 'duplicate'
      })

      const lastScan = previousScans[0]
      return NextResponse.json({
        success: false,
        status: 'used',
        message: 'Ticket has already been scanned and used',
        ticket: {
          id: ticket.id,
          event_title: ticket.events?.title,
          ticket_type: ticket.ticket_types?.name,
          status: ticket.status,
          scanned_at: lastScan.scanned_at,
          scan_count: previousScans.length,
          purchaser_id: ticket.purchaser_id,
          user_name: ticket.users?.name,
          user_email: ticket.users?.email,
          created_at: ticket.created_at,
          price_paid: ticket.price_paid
        }
      })
    }

    // Check if ticket is paid (allow 'pending' and 'paid' status)
    if (ticket.status !== 'paid' && ticket.status !== 'pending') {
      // Record invalid scan with proper scanner ID
      try {
        const { data: scannerUser } = await supabase
          .from('users')
          .select('id')
          .eq('id', scanner_id)
          .eq('role', 'scanner')
          .single()

        if (scannerUser) {
          await supabase.from('scans').insert({
            ticket_id: ticket.id,
            scanned_by: scanner_id,
            status: 'invalid'
          })
        }
      } catch (error) {
        // Ignore scan recording errors
      }

      return NextResponse.json({
        success: false,
        status: 'invalid',
        message: 'Ticket is not paid or is cancelled',
        ticket: {
          id: ticket.id,
          event_title: ticket.events?.title,
          ticket_type: ticket.ticket_types?.name,
          status: ticket.status,
          purchaser_id: ticket.purchaser_id,
          user_name: ticket.users?.name,
          user_email: ticket.users?.email,
          created_at: ticket.created_at,
          price_paid: ticket.price_paid
        }
      })
    }

    // Validate that scanner_id is a valid UUID and exists in users table
    const { data: scannerUser, error: scannerError } = await supabase
      .from('users')
      .select('id, name, role')
      .eq('id', scanner_id)
      .eq('role', 'scanner')
      .single()

    if (scannerError || !scannerUser) {
      console.error('❌ Invalid scanner ID:', scanner_id, scannerError)
      return NextResponse.json({
        success: false,
        status: 'invalid',
        message: 'Invalid scanner credentials',
        ticket: null
      })
    }

    // Record successful scan in scans table
    const { error: scanInsertError } = await supabase.from('scans').insert({
      ticket_id: ticket.id,
      scanned_by: scanner_id,
      status: 'valid'
    })

    if (scanInsertError) {
      return NextResponse.json(
        { error: 'Failed to record scan', details: scanInsertError.message },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      status: 'valid',
      message: 'Ticket validated successfully - Entry granted',
      ticket: {
        id: ticket.id,
        event_title: ticket.events?.title,
        ticket_type: ticket.ticket_types?.name,
        price_paid: ticket.price_paid,
        purchaser_id: ticket.purchaser_id,
        created_at: ticket.created_at,
        status: ticket.status,
        user_name: ticket.users?.name,
        user_email: ticket.users?.email
      }
    })

  } catch (error: any) {
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    )
  }
}
