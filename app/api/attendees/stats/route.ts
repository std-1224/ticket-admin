import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { isAuthError } from '@/lib/auth-error-handler'

// Create service role client to bypass RLS
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABSE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  }
)

export async function GET(request: NextRequest) {
  try {
    // Calculate real stats from orders table
    const { data: deliveredOrders, error: deliveredError } = await supabaseAdmin
      .from('event_orders')
      .select('total_price')
      .in('status', ['delivered', 'paid'])

    const { data: pendingOrders, error: pendingError } = await supabaseAdmin
      .from('event_orders')
      .select('total_price')
      .eq('status', 'pending')

    if (deliveredError) {
      console.error('Error fetching delivered orders:', deliveredError)
    }

    if (pendingError) {
      console.error('Error fetching pending orders:', pendingError)
    }
    console.log('Delivered Orders:', deliveredOrders)
    // Calculate totals
    const completePaymentAmount = deliveredOrders?.reduce((sum, order) => sum + (order.total_price || 0), 0) || 0
    const pendingPaymentAmount = pendingOrders?.reduce((sum, order) => sum + (order.total_price || 0), 0) || 0
    const checkedInCount = deliveredOrders?.length || 0

    const stats = {
      total_attendees: (deliveredOrders?.length || 0) + (pendingOrders?.length || 0),
      complete_payment_amount: completePaymentAmount,
      pending_payment_amount: pendingPaymentAmount,
      failed_payments: 0, // Keep for compatibility
      checked_in: checkedInCount,
      not_checked_in: (pendingOrders?.length || 0)
    }

    return NextResponse.json({
      success: true,
      data: stats
    })

  } catch (error: any) {
    console.error('Error in attendees stats API:', error)
    
    if (isAuthError(error)) {
      return NextResponse.json(
        { success: false, error: error.message, code: 'AUTH_ERROR' },
        { status: 401 }
      )
    }

    return NextResponse.json(
      { success: false, error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}
