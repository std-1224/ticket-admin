import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { order_id, vip_guest_id, scanner_id } = body

    if ((!order_id && !vip_guest_id) || !scanner_id) {
      return NextResponse.json(
        { error: 'Order ID or VIP guest ID and scanner ID are required' },
        { status: 400 }
      )
    }

    // Validate scanner credentials
    const { data: scannerUser, error: scannerError } = await supabase
      .from('profiles')
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

    // Determine if we're confirming an order or VIP guest
    const isOrder = !!order_id
    const isVipGuest = !!vip_guest_id

    if (isOrder) {
      // Get the order
      const { data: order, error: orderError } = await supabase
        .from("event_orders")
        .select('id, status')
        .eq('id', order_id)
        .single()

      if (orderError || !order) {
        return NextResponse.json(
          { error: 'Order not found' },
          { status: 404 }
        )
      }

      // Find the most recent 'valid' scan for this order
      const { data: validScan, error: scanError } = await supabase
        .from('event_scans')
        .select('id')
        .eq('order_id', order_id)
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
        .from('event_scans')
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
        message: 'Order entry confirmed successfully',
        scan_id: validScan.id,
        status: 'used',
        type: 'order'
      })
    } else if (isVipGuest) {
      // Get the VIP guest
      const { data: vipGuest, error: vipGuestError } = await supabase
        .from("vip_guests")
        .select('id, status')
        .eq('id', vip_guest_id)
        .single()

      if (vipGuestError || !vipGuest) {
        return NextResponse.json(
          { error: 'VIP guest not found' },
          { status: 404 }
        )
      }

      // Find the most recent 'valid' scan for this VIP guest
      const { data: validScan, error: scanError } = await supabase
        .from('event_scans')
        .select('id')
        .eq('vip_guest_id', vip_guest_id)
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
        .from('event_scans')
        .update({ status: 'used' })
        .eq('id', validScan.id)

      if (updateError) {
        return NextResponse.json(
          { error: 'Failed to update scan status', details: updateError.message },
          { status: 500 }
        )
      }

      // Update VIP guest status to 'delivered' after confirming entry
      const { error: vipUpdateError } = await supabase
        .from('vip_guests')
        .update({ status: 'delivered' })
        .eq('id', vip_guest_id)

      if (vipUpdateError) {
        console.error('Failed to update VIP guest status:', vipUpdateError)
        // Don't fail the request, just log the error
      }

      return NextResponse.json({
        success: true,
        message: 'VIP guest entry confirmed successfully',
        scan_id: validScan.id,
        status: 'used',
        type: 'vip_guest'
      })
    }

  } catch (error: any) {
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    )
  }
}
