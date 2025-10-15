import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { title, description, date, time, location, image_url, created_by } = body

    // Validate required fields
    if (!title || !date || !created_by) {
      return NextResponse.json(
        { error: 'Missing required fields: title, date, and created_by are required' },
        { status: 400 }
      )
    }

    // Insert event into database
    const { data: event, error } = await supabase
      .from('events')
      .insert([
        {
          title,
          description,
          date,
          time,
          location,
          image_url,
          created_by
        }
      ])
      .select()
      .single()

    if (error) {
      console.error('Database error:', error)
      return NextResponse.json(
        { error: 'Failed to create event' },
        { status: 500 }
      )
    }

    return NextResponse.json(
      { 
        message: 'Event created successfully',
        event 
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

export async function PUT(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const eventId = searchParams.get('id')

    if (!eventId) {
      return NextResponse.json(
        { error: 'Event ID is required' },
        { status: 400 }
      )
    }

    const body = await request.json()
    const { title, description, date, time, location, image_url } = body

    // Validate required fields
    if (!title || !date) {
      return NextResponse.json(
        { error: 'Missing required fields: title and date are required' },
        { status: 400 }
      )
    }

    // Update event in database
    const { data: event, error } = await supabase
      .from('events')
      .update({
        title,
        description,
        date,
        time,
        location,
        image_url,
        updated_at: new Date().toISOString()
      })
      .eq('id', eventId)
      .select()
      .single()

    if (error) {
      console.error('Database error:', error)
      return NextResponse.json(
        { error: 'Failed to update event' },
        { status: 500 }
      )
    }

    return NextResponse.json(
      {
        message: 'Event updated successfully',
        event
      },
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

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const userId = searchParams.get('userId')

    let query = supabase
      .from('events')
      .select(`
        *,
        profiles!events_created_by_fkey(name)
      `)

    // Filter by user if userId is provided
    if (userId) {
      query = query.eq('created_by', userId)
    }

    const { data: events, error } = await query.order('created_at', { ascending: false })

    if (error) {
      console.error('Database error:', error)
      return NextResponse.json(
        { error: 'Failed to fetch events' },
        { status: 500 }
      )
    }

    return NextResponse.json({ events }, { status: 200 })

  } catch (error) {
    console.error('API error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
