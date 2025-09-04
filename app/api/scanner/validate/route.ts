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
      .from('users')
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

    // Find the order by QR code
    const { data: order, error: orderError } = await supabase
      .from("orders")
      .select('*')
      .eq('qr_code', qr_code)
      .single()

    // If order not found - record invalid scan and return
    if (orderError || !order) {
      // Record invalid scan - order not found by QR code
      await supabase.from('scans').insert({
        order_id: null, // No order found
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

    // Check if this order has already been scanned (order_id exists in scans table)
    const { data: existingScans } = await supabase
      .from('scans')
      .select('id')
      .eq('order_id', order.id)
      .limit(1)

    if (existingScans && existingScans.length > 0) {
      // Record this as 'used' scan attempt
      await supabase.from('scans').insert({
        order_id: order.id,
        scanned_by: scanner_id,
        status: 'used'
      })

      return NextResponse.json({
        success: false,
        status: 'used',
        message: 'Already in use',
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

    // Check if order is paid (not allow 'paid' status only)
    if (order.status === 'paid') {
      // Record invalid scan - order not paid
      await supabase.from('scans').insert({
        order_id: order.id,
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
          user_name: order.users?.name,
          user_email: order.users?.email,
          created_at: order.created_at,
          total_amount: order.total_amount
        }
      })
    }
    // Record successful scan in scans table and update order status to 'delivered'
    const { error: scanInsertError } = await supabase.from('scans').insert({
      order_id: order.id,
      scanned_by: scanner_id,
      status: 'valid'
    })

    if (scanInsertError) {
      return NextResponse.json(
        { error: 'Failed to record scan', details: scanInsertError.message },
        { status: 500 }
      )
    }

    // Update order status to 'delivered' if scan is valid
    const { error: updateError } = await supabase
      .from('orders')
      .update({ status: 'delivered' })
      .eq('id', order.id)

    if (updateError) {
      console.error('Failed to update order status:', updateError)
      // Don't fail the request, just log the error
    }

    // Update all order_items for this order to 'delivered' status
    const { error: orderItemsUpdateError } = await supabase
      .from('order_items')
      .update({ status: 'delivered' })
      .eq('order_id', order.id)

    if (orderItemsUpdateError) {
      console.error('Failed to update order_items status:', orderItemsUpdateError)
      // Don't fail the request, just log the error
    }

    // Update transactions table status to 'delivered' using order_id
    const { error: transactionUpdateError } = await supabase
      .from('transactions')
      .update({ status: 'delivered' })
      .eq('order_id', order.id)

    if (transactionUpdateError) {
      console.error('Failed to update transaction status:', transactionUpdateError)
      // Don't fail the request, just log the error
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
      }
    })

  } catch (error: any) {
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    )
  }
}
