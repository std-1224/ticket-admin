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

    // Determine if QR code is from order or VIP guest
    const isOrder = qr_code.startsWith("ORD-")
    const isVipGuest = qr_code.startsWith("VIP-")

    if (!isOrder && !isVipGuest) {
      // Record invalid scan - unknown QR code format
      await supabase.from('event_scans').insert({
        order_id: null,
        vip_guest_id: null,
        scanned_by: scanner_id,
        status: 'invalid'
      })

      return NextResponse.json({
        success: false,
        status: 'invalid',
        message: 'Invalid QR code format',
        order: null,
        vip_guest: null
      })
    }

    let order = null
    let vipGuest = null
    let orderError = null
    let vipGuestError = null

    if (isOrder) {
      // Find the order by QR code with event information
      const orderResult = await supabase
        .from("event_orders")
        .select(`
          *,
          events(
            id,
            title,
            date,
            time,
            location
          ),
          profiles!user_id(
            id,
            name,
            email
          )
        `)
        .eq('qr_code', qr_code)
        .single()
      
      order = orderResult.data
      orderError = orderResult.error
    } else if (isVipGuest) {
      // Find the VIP guest by QR code with event information
      const vipResult = await supabase
        .from("vip_guests")
        .select(`
          *,
          events(
            id,
            title,
            date,
            time,
            location
          )
        `)
        .eq('qr_code', qr_code)
        .single()
      
      vipGuest = vipResult.data
      vipGuestError = vipResult.error
    }

    // If neither order nor VIP guest found - record invalid scan and return
    if ((isOrder && (orderError || !order)) || (isVipGuest && (vipGuestError || !vipGuest))) {
      // Record invalid scan - not found by QR code
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
    }

    // Check if this order or VIP guest has already been scanned
    let existingScans = null
    if (isOrder) {
      const { data: orderScans } = await supabase
        .from('event_scans')
        .select('id')
        .eq('order_id', order.id)
        .limit(1)
      existingScans = orderScans
    } else if (isVipGuest) {
      const { data: vipScans } = await supabase
        .from('event_scans')
        .select('id')
        .eq('vip_guest_id', vipGuest.id)
        .limit(1)
      existingScans = vipScans
    }

    if (existingScans && existingScans.length > 0) {
      // Record this as 'used' scan attempt
      await supabase.from('event_scans').insert({
        order_id: isOrder ? order.id : null,
        vip_guest_id: isVipGuest ? vipGuest.id : null,
        scanned_by: scanner_id,
        status: 'used'
      })

      if (isOrder) {
        return NextResponse.json({
          success: false,
          status: 'used',
          message: 'Already in use',
          order: {
            id: order.id,
            event_title: order.events?.title,
            status: order.status,
            user_id: order.user_id,
            user_name: order.profiles?.name,
            user_email: order.profiles?.email,
            created_at: order.created_at,
            total_amount: order.total_amount
          },
          vip_guest: null
        })
      } else {
        return NextResponse.json({
          success: false,
          status: 'used',
          message: 'Already in use',
          order: null,
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
    }

    // Validate order or VIP guest status
    if (isOrder) {
      // Check if order is paid (not allow 'paid' status only)
      if (order.status === 'delivered' || order.status === 'paid' || order.status === 'approved') {
        // Record invalid scan - order not paid
        await supabase.from('event_scans').insert({
          order_id: order.id,
          vip_guest_id: null,
          scanned_by: scanner_id,
          status: 'used'
        })

        return NextResponse.json({
          success: false,
          status: 'invalid',
          message: 'QR code is in Used',
          order: {
            id: order.id,
            event_title: order.events?.title,
            status: order.status,
            user_id: order.user_id,
            user_name: order.profiles?.name,
            user_email: order.profiles?.email,
            created_at: order.created_at,
            total_amount: order.total_amount
          },
          vip_guest: null
        })
      }

      if (order.status === 'cancelled' || order.status === 'refunded' || order.status === 'pending' || order.status === 'expired' || order.status === 'waiting_payment' || order.status === 'failed') {
        // Record invalid scan - order not paid
        await supabase.from('event_scans').insert({
          order_id: order.id,
          vip_guest_id: null,
          scanned_by: scanner_id,
          status: 'invalid'
        })
        return NextResponse.json({
          success: false,
          status: 'invalid',
          message: 'Order is not paid',
          order: null,
          vip_guest: null
        })
      }
    } else if (isVipGuest) {
      // Check if VIP guest is invited
      if (vipGuest.status === 'invited') {
        // Record invalid scan - VIP guest invitation does not confirmed yet
        await supabase.from('event_scans').insert({
          order_id: null,
          vip_guest_id: vipGuest.id,
          scanned_by: scanner_id,
          status: 'invalid'
        })

        return NextResponse.json({
          success: false,
          status: 'invalid',
          message: 'VIP guest invitation does not confirmed yet',
          order: null,
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
    }
    // Record successful scan in scans table
    const { error: scanInsertError } = await supabase.from('event_scans').insert({
      order_id: isOrder ? order.id : null,
      vip_guest_id: isVipGuest ? vipGuest.id : null,
      scanned_by: scanner_id,
      status: 'valid'
    })

    if (scanInsertError) {
      return NextResponse.json(
        { error: 'Failed to record scan', details: scanInsertError.message },
        { status: 500 }
      )
    }

    // Update order status to 'delivered' if scan is valid (only for orders)
    if (isOrder) {
      const { error: updateError } = await supabase
        .from('event_orders')
        .update({ status: 'delivered' })
        .eq('id', order.id)

      if (updateError) {
        console.error('Failed to update order status:', updateError)
        // Don't fail the request, just log the error
      }

      // Update all order_items for this order to 'delivered' status
      const { error: orderItemsUpdateError } = await supabase
        .from('event_order_items')
        .update({ status: 'delivered' })
        .eq('order_id', order.id)

      if (orderItemsUpdateError) {
        console.error('Failed to update order_items status:', orderItemsUpdateError)
        // Don't fail the request, just log the error
      }

      // Update transactions table status to 'delivered' using order_id
      const { error: transactionUpdateError } = await supabase
        .from('event_transactions')
        .update({ status: 'delivered' })
        .eq('order_id', order.id)

      if (transactionUpdateError) {
        console.error('Failed to update transaction status:', transactionUpdateError)
        // Don't fail the request, just log the error
      }

      // --- Deduct ticket quantities from ticket_types based on this order's items ---
      try {
        // Fetch all items for this order: ticket_type_id and amount
        const { data: orderItems, error: orderItemsError } = await supabase
          .from('event_order_items')
          .select('ticket_type_id, amount')
          .eq('order_id', order.id)

        if (orderItemsError) {
          console.error('Failed to fetch order items for quantity deduction:', orderItemsError)
        } else if (orderItems && orderItems.length > 0) {
          // Summarize amounts per ticket_type_id
          const qtyMap: Record<string, number> = {}
          orderItems.forEach((it: any) => {
            const typeId = it.ticket_type_id
            const amt = Number(it.amount || 0)
            if (!typeId) return
            qtyMap[typeId] = (qtyMap[typeId] || 0) + (isNaN(amt) ? 0 : amt)
          })

          const ticketTypeIds = Object.keys(qtyMap)

          if (ticketTypeIds.length > 0) {
            // Fetch current ticket_types rows
            const { data: ticketTypesRows, error: ticketTypesError } = await supabase
              .from('ticket_types')
              .select('id, total_quantity')
              .in('id', ticketTypeIds)

            if (ticketTypesError) {
              console.error('Failed to fetch ticket types for quantity deduction:', ticketTypesError)
            } else if (ticketTypesRows) {
              // Update each ticket type decrementing by the ordered amount (clamped to >= 0)
              for (const tt of ticketTypesRows) {
                try {
                  const dec = qtyMap[tt.id] || 0
                  const current = Number(tt.total_quantity || 0)
                  const newQty = Math.max(0, current - dec)

                  // Only update if there's a change
                  if (newQty !== current) {
                    const { error: updateQtyError } = await supabase
                      .from('ticket_types')
                      .update({ total_quantity: newQty })
                      .eq('id', tt.id)

                    if (updateQtyError) {
                      console.error(`Failed to update ticket_types(${tt.id}) quantity:`, updateQtyError)
                    }
                  }
                } catch (err) {
                  console.error('Error updating ticket type quantity for', tt.id, err)
                }
              }
            }
          }
        }
      } catch (err) {
        console.error('Unexpected error when deducting ticket quantities:', err)
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
          status: 'delivered', // Show the updated status
          user_name: order.users?.name,
          user_email: order.users?.email
        },
        vip_guest: null
      })
    } else if (isVipGuest) {
      // Update VIP guest status to 'delivered' if they were just 'confirmed'
      if (vipGuest.status === 'confirmed') {
        const { error: vipUpdateError } = await supabase
          .from('vip_guests')
          .update({ status: 'delivered' })
          .eq('id', vipGuest.id)

        if (vipUpdateError) {
          console.error('Failed to update VIP guest status:', vipUpdateError)
          // Don't fail the request, just log the error
        }
      }

      return NextResponse.json({
        success: true,
        status: 'valid',
        message: 'VIP guest access granted',
        order: null,
        vip_guest: {
          id: vipGuest.id,
          name: vipGuest.name,
          email: vipGuest.email,
          status: vipGuest.status === 'invited' ? 'confirmed' : vipGuest.status,
          created_at: vipGuest.created_at,
          notes: vipGuest.notes,
          event_title: vipGuest.events?.title
        }
      })
    }

  } catch (error: any) {
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    )
  }
}
