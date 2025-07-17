import { NextRequest, NextResponse } from 'next/server'
import { AttendeesAPI } from '@/lib/api/attendees'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    
    const eventId = searchParams.get('eventId')
    const search = searchParams.get('search') || undefined
    const paymentStatus = searchParams.get('paymentStatus') as 'paid' | 'pending' | 'failed' | 'all' | undefined
    const checkInStatus = searchParams.get('checkInStatus') as 'checked_in' | 'not_checked_in' | 'all' | undefined
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '50')
    const format = searchParams.get('format') // 'csv' for export

    if (!eventId) {
      return NextResponse.json(
        { error: 'Event ID is required' },
        { status: 400 }
      )
    }

    const filters = {
      search,
      payment_status: paymentStatus,
      check_in_status: checkInStatus,
      event_id: eventId
    }

    // Handle CSV export
    if (format === 'csv') {
      try {
        const csvData = await AttendeesAPI.exportAttendeesCSV(eventId, filters)
        
        return new NextResponse(csvData, {
          status: 200,
          headers: {
            'Content-Type': 'text/csv',
            'Content-Disposition': `attachment; filename="attendees-${eventId}-${new Date().toISOString().split('T')[0]}.csv"`
          }
        })
      } catch (error: any) {
        return NextResponse.json(
          { error: error.message },
          { status: 500 }
        )
      }
    }

    // Get attendees data grouped by purchase
    const result = await AttendeesAPI.getAttendeesByPurchase(eventId, filters, page, limit)

    return NextResponse.json({
      success: true,
      data: result
    })

  } catch (error: any) {
    console.error('Error in attendees API:', error)
    return NextResponse.json(
      { 
        success: false,
        error: error.message || 'Internal server error'
      },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { action, eventId, attendeeId } = body

    if (!eventId) {
      return NextResponse.json(
        { error: 'Event ID is required' },
        { status: 400 }
      )
    }

    switch (action) {
      case 'get_details':
        if (!attendeeId) {
          return NextResponse.json(
            { error: 'Attendee ID is required for details' },
            { status: 400 }
          )
        }

        const attendeeDetails = await AttendeesAPI.getAttendeeDetails(attendeeId)
        
        if (!attendeeDetails) {
          return NextResponse.json(
            { error: 'Attendee not found' },
            { status: 404 }
          )
        }

        return NextResponse.json({
          success: true,
          data: attendeeDetails
        })

      default:
        return NextResponse.json(
          { error: 'Invalid action' },
          { status: 400 }
        )
    }

  } catch (error: any) {
    console.error('Error in attendees POST API:', error)
    return NextResponse.json(
      { 
        success: false,
        error: error.message || 'Internal server error'
      },
      { status: 500 }
    )
  }
}
