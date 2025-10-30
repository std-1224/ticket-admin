import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export async function POST (request: NextRequest) {
  try {
    const body = await request.json()

    const { qr_code, scanner_id, event_id } = body

    if (!qr_code || !scanner_id) {
      return NextResponse.json(
        { error: 'QR code and scanner ID are required' },
        { status: 400 }
      )
    }

    // Validate scanner credentials first
    const { data: scannerUser, error: scannerError } = await supabase
      .from('profiles')
      .select('id, name, role')
      .eq('id', scanner_id)
      .single()

    if (scannerError || !scannerUser) {
      return NextResponse.json({
        success: false,
        status: 'invalid',
        message: 'Invalid scanner credentials',
        order: null
      })
    }

    const isOrder = qr_code.startsWith('ORD-')
    const isVipGuest = qr_code.startsWith('VIP-')

    // ORD flow: keep existing behavior
    if (isOrder) {
      // Find the order by QR code
      const { data: order, error: orderError } = await supabase
        .from('event_orders')
        .select('*')
        .eq('qr_code', qr_code)
        .single()

      // If order not found - record invalid scan and return
      if (orderError || !order) {
        await supabase.from('event_scans').insert({
          order_id: null,
          scanned_by: scanner_id,
          status: 'invalid'
        })

        return NextResponse.json({
          success: false,
          status: 'invalid',
          message: 'QR code is invalid',
          order: null
        })
      }

      // Handle delivered orders - mark as already used
      if (order.status === 'delivered') {
        await supabase.from('event_scans').insert({
          order_id: order.id,
          scanned_by: scanner_id,
          status: 'used'
        })

        return NextResponse.json({
          success: false,
          status: 'used',
          message: 'Already used it before',
          order: {
            id: order.id,
            event_title: order.events?.title,
            status: order.status,
            user_id: order.user_id,
            user_name: order.users?.name,
            user_email: order.users?.email,
            created_at: order.created_at,
            total_amount: order.total_amount
          }
        })
      }

      // Handle invalid statuses
      if (
        [
          'refunded',
          'in_process',
          'rejected',
          'waiting_payment',
          'cancelled'
        ].includes(order.status)
      ) {
        await supabase.from('event_scans').insert({
          order_id: order.id,
          scanned_by: scanner_id,
          status: 'invalid'
        })

        return NextResponse.json({
          success: false,
          status: 'invalid',
          message: `QR code is invalid: Order status is ${order.status}`,
          order: {
            id: order.id,
            event_title: order.events?.title,
            status: order.status,
            user_id: order.user_id,
            user_name: order.users?.name,
            user_email: order.users?.email,
            created_at: order.created_at,
            total_amount: order.total_amount
          }
        })
      }

      // Handle valid (paid) orders
      if (order.status === 'paid') {
        // Get order items
        const { data: orderItems, error: orderItemsError } = await supabase
          .from('event_order_items')
          .select('*')
          .eq('order_id', order.id)

        if (orderItemsError || !orderItems) {
          return NextResponse.json(
            {
              error: 'Failed to fetch order items',
              details: orderItemsError?.message
            },
            { status: 500 }
          )
        }

        // Update ticket quantities for each order item
        for (const item of orderItems) {
          // First get current ticket quantity
          const { data: ticketType, error: ticketFetchError } = await supabase
            .from('ticket_types')
            .select('total_quantity')
            .eq('id', item.ticket_type_id)
            .single()

          if (ticketFetchError || !ticketType) {
            console.error('Failed to fetch ticket type:', ticketFetchError)
            return NextResponse.json(
              {
                error: 'Failed to fetch ticket type',
                details: ticketFetchError?.message
              },
              { status: 500 }
            )
          }

          // Check if we have enough tickets
          if (ticketType.total_quantity < item.amount) {
            return NextResponse.json(
              { error: 'Not enough tickets available' },
              { status: 400 }
            )
          }

          // Update ticket quantity
          const { error: ticketUpdateError } = await supabase
            .from('ticket_types')
            .update({
              total_quantity: ticketType.total_quantity - item.amount
            })
            .eq('id', item.ticket_type_id)

          if (ticketUpdateError) {
            console.error(
              'Failed to update ticket quantity:',
              ticketUpdateError
            )
            return NextResponse.json(
              {
                error: 'Failed to update ticket quantity',
                details: ticketUpdateError.message
              },
              { status: 500 }
            )
          }
        }

        // Record successful scan
        const { error: scanInsertError } = await supabase
          .from('event_scans')
          .insert({
            order_id: order.id,
            scanned_by: scanner_id,
            status: 'valid'
          })

        if (scanInsertError) {
          return NextResponse.json(
            {
              error: 'Failed to record scan',
              details: scanInsertError.message
            },
            { status: 500 }
          )
        }

        const { error: updateError } = await supabase
          .from('event_orders')
          .update({ status: 'delivered' })
          .eq('id', order.id)

        if (updateError) {
          console.error('Failed to update order status:', updateError)
        }

        const { error: orderItemsUpdateError } = await supabase
          .from('event_order_items')
          .update({ status: 'delivered' })
          .eq('order_id', order.id)

        if (orderItemsUpdateError) {
          console.error(
            'Failed to update order_items status:',
            orderItemsUpdateError
          )
        }

        const { error: transactionUpdateError } = await supabase
          .from('event_transactions')
          .update({ status: 'delivered' })
          .eq('order_id', order.id)

        if (transactionUpdateError) {
          console.error(
            'Failed to update transaction status:',
            transactionUpdateError
          )
        }

        return NextResponse.json({
          success: true,
          status: 'valid',
          message: 'QR code is valid',
          order: {
            id: order.id,
            event_title: order.events?.title,
            total_amount: order.total_amount,
            user_id: order.user_id,
            created_at: order.created_at,
            status: 'delivered',
            user_name: order.users?.name,
            user_email: order.users?.email
          }
        })
      }
    }

    // VIP flow
    if (isVipGuest) {
      // Find VIP guest by QR code
      const { data: vipGuest, error: vipError } = await supabase
        .from('vip_guests')
        .select('*')
        .eq('qr_code', qr_code)
        .single()

      // If VIP not found, record invalid scan and return
      if (vipError || !vipGuest) {
        await supabase.from('event_scans').insert({
          order_id: null,
          vip_guest_id: null,
          scanned_by: scanner_id,
          status: 'invalid'
        })

        return NextResponse.json({
          success: false,
          status: 'invalid',
          message: 'QR code is invalid',
          vip_guest: null
        })
      }

      // Handle VIP statuses: invited, confirmed, delivered
      const status = (vipGuest.status || '').toLowerCase()

      if (status === 'confirmed') {
        // Record scan as used and return valid message
        await supabase.from('event_scans').insert({
          order_id: null,
          vip_guest_id: vipGuest.id,
          scanned_by: scanner_id,
          status: 'valid'
        })

        // Update vip_guest status to 'delivered' so future scans are recognized as used
        try {
          const { error: vipUpdateError } = await supabase
            .from('vip_guests')
            .update({ status: 'delivered' })
            .eq('id', vipGuest.id)

          if (vipUpdateError) {
            console.error(
              'Failed to update vip_guest status to delivered:',
              vipUpdateError
            )
          } else {
            // reflect change in response object
            vipGuest.status = 'delivered'
          }
        } catch (err) {
          console.error('Unexpected error updating vip_guest status:', err)
        }

        return NextResponse.json({
          success: true,
          status: 'valid',
          message: 'VIP guest access granted',
          vip_guest: {
            id: vipGuest.id,
            name: vipGuest.name,
            email: vipGuest.email,
            status: vipGuest.status,
            created_at: vipGuest.created_at,
            notes: vipGuest.notes,
            event_title: vipGuest.events?.title
          }
        })
      }

      if (status === 'delivered') {
        // Already used before - record used and return used message
        await supabase.from('event_scans').insert({
          order_id: null,
          vip_guest_id: vipGuest.id,
          scanned_by: scanner_id,
          status: 'used'
        })

        return NextResponse.json({
          success: false,
          status: 'used',
          message: 'Already used it before',
          vip_guest: {
            id: vipGuest.id,
            name: vipGuest.name,
            email: vipGuest.email,
            status: vipGuest.status,
            created_at: vipGuest.created_at,
            notes: vipGuest.notes,
            event_title: vipGuest.events?.title
          }
        })
      }

      if (status === 'invited') {
        // Invitation not confirmed - record invalid and return invalid
        await supabase.from('event_scans').insert({
          order_id: null,
          vip_guest_id: vipGuest.id,
          scanned_by: scanner_id,
          status: 'invalid'
        })

        return NextResponse.json({
          success: false,
          status: 'invalid',
          message: 'VIP guest invitation not confirmed',
          vip_guest: {
            id: vipGuest.id,
            name: vipGuest.name,
            email: vipGuest.email,
            status: vipGuest.status,
            created_at: vipGuest.created_at,
            notes: vipGuest.notes,
            event_title: vipGuest.events?.title
          }
        })
      }

      // For any other VIP status, treat as invalid and record it
      await supabase.from('event_scans').insert({
        order_id: null,
        vip_guest_id: vipGuest.id,
        scanned_by: scanner_id,
        status: 'invalid'
      })

      return NextResponse.json({
        success: false,
        status: 'invalid',
        message: 'VIP QR code is invalid',
        vip_guest: {
          id: vipGuest.id,
          name: vipGuest.name,
          email: vipGuest.email,
          status: vipGuest.status,
          created_at: vipGuest.created_at,
          notes: vipGuest.notes,
          event_title: vipGuest.events?.title
        }
      })
    }

    // If not ORD or VIP - record invalid scan and return
    await supabase.from('event_scans').insert({
      order_id: null,
      vip_guest_id: null,
      scanned_by: scanner_id,
      status: 'invalid'
    })

    return NextResponse.json({
      success: false,
      status: 'invalid',
      message: 'QR code is invalid',
      order: null,
      vip_guest: null
    })
  } catch (error: any) {
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    )
  }
}
