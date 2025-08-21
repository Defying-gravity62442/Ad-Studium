import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { GoogleCalendarService } from '@/lib/google-calendar'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check if user has calendar read permission
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { calendarReadPermission: true }
    })

    if (!user?.calendarReadPermission) {
      return NextResponse.json({ 
        error: 'Calendar read permission not enabled. Please enable calendar read access in your settings.' 
      }, { status: 403 })
    }

    if (!session.accessToken) {
      return NextResponse.json({ error: 'No calendar access token available' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const date = searchParams.get('date') // Optional date parameter, defaults to today
    const timezone = searchParams.get('timezone') || 'UTC'

    const calendarService = new GoogleCalendarService(session.accessToken)
    
    // Set up date range for the requested day
    const targetDate = date ? new Date(date) : new Date()
    const startOfDay = new Date(targetDate)
    startOfDay.setHours(0, 0, 0, 0)
    
    const endOfDay = new Date(targetDate)
    endOfDay.setHours(23, 59, 59, 999)

    const events = await calendarService.getTodayEvents(startOfDay, endOfDay, timezone)

    return NextResponse.json({ events })
  } catch (error) {
    console.error('Failed to fetch calendar events:', error)
    return NextResponse.json(
      { error: 'Failed to fetch calendar events' },
      { status: 500 }
    )
  }
}