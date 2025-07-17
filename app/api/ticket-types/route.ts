import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    console.log("body: ", body)
    const { event_id, name, price, total_quantity, combo, description } = body

    // Validate required fields
    if (!event_id || !name || price === undefined || total_quantity === undefined) {
      return NextResponse.json(
        { error: 'Missing required fields: event_id, name, price, and total_quantity are required' },
        { status: 400 }
      )
    }

    // Insert ticket type into database
    const { data: ticketType, error } = await supabase
      .from('ticket_types')
      .insert([
        {
          event_id,
          name,
          price: parseFloat(price),
          total_quantity: parseInt(total_quantity),
          combo: combo || null,
          description: description || null
        }
      ])
      .select()
      .single()

    if (error) {
      console.error('Database error:', error)
      return NextResponse.json(
        { error: 'Failed to create ticket type' },
        { status: 500 }
      )
    }

    return NextResponse.json(
      { 
        message: 'Ticket type created successfully',
        ticketType 
      },
      { status: 201 }
    )

  } catch (error) {
    console.error('API error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const eventId = searchParams.get('eventId')

    if (!eventId) {
      return NextResponse.json(
        { error: 'eventId parameter is required' },
        { status: 400 }
      )
    }

    const { data: ticketTypes, error } = await supabase
      .from('ticket_types')
      .select('*')
      .eq('event_id', eventId)
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Database error:', error)
      return NextResponse.json(
        { error: 'Failed to fetch ticket types' },
        { status: 500 }
      )
    }

    return NextResponse.json({ ticketTypes }, { status: 200 })

  } catch (error) {
    console.error('API error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const ticketId = searchParams.get('id')

    if (!ticketId) {
      return NextResponse.json(
        { error: 'Ticket ID is required' },
        { status: 400 }
      )
    }

    const { error } = await supabase
      .from('ticket_types')
      .delete()
      .eq('id', ticketId)

    if (error) {
      console.error('Database error:', error)
      return NextResponse.json(
        { error: 'Failed to delete ticket type' },
        { status: 500 }
      )
    }

    return NextResponse.json(
      { message: 'Ticket type deleted successfully' },
      { status: 200 }
    )

  } catch (error) {
    console.error('API error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
