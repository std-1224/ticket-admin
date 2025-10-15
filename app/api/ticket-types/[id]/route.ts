import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const ticketId = params.id
    const body = await request.json()
    
    const { name, price, total_quantity, combo, description } = body

    if (!name || price === undefined || total_quantity === undefined) {
      return NextResponse.json(
        { error: 'Missing required fields: name, price, total_quantity' },
        { status: 400 }
      )
    }

    // Update the ticket type in the database
    const { data, error } = await supabase
      .from('ticket_types')
      .update({
        name,
        price: Number(price),
        total_quantity: Number(total_quantity),
        combo: combo || 'N/A',
        description: description || '',
        updated_at: new Date().toISOString()
      })
      .eq('id', ticketId)
      .select()
      .single()

    if (error) {
      console.error('Database error:', error)
      return NextResponse.json(
        { error: 'Failed to update ticket type', details: error.message },
        { status: 500 }
      )
    }

    if (!data) {
      return NextResponse.json(
        { error: 'Ticket type not found' },
        { status: 404 }
      )
    }

    return NextResponse.json({
      success: true,
      ticket: data
    })

  } catch (error: any) {
    console.error('Error updating ticket type:', error)
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    )
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const ticketId = params.id

    // Delete the ticket type from the database
    const { error } = await supabase
      .from('ticket_types')
      .delete()
      .eq('id', ticketId)

    if (error) {
      console.error('Database error:', error)
      return NextResponse.json(
        { error: 'Failed to delete ticket type', details: error.message },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      message: 'Ticket type deleted successfully'
    })

  } catch (error: any) {
    console.error('Error deleting ticket type:', error)
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    )
  }
}
