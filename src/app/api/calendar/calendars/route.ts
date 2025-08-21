import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { GoogleCalendarService } from '@/lib/google-calendar'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'

export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check if user has calendar events permission (needed to write to calendars)
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { calendarEventsPermission: true }
    })

    if (!user?.calendarEventsPermission) {
      return NextResponse.json({ 
        error: 'Calendar events permission not enabled. Please enable calendar events access in your settings.' 
      }, { status: 403 })
    }

    if (!session.accessToken) {
      return NextResponse.json({ error: 'No calendar access token available' }, { status: 401 })
    }

    const calendarService = new GoogleCalendarService(session.accessToken)
    const calendars = await calendarService.getCalendars()

    // Filter to show only calendars the user can write to
    const writableCalendars = calendars.filter((calendar: { accessRole: string }) => 
      calendar.accessRole === 'owner' || calendar.accessRole === 'writer'
    ).map((calendar: { id: string; summary: string; description?: string; primary?: boolean; backgroundColor?: string }) => ({
      id: calendar.id,
      name: calendar.summary,
      description: calendar.description,
      primary: calendar.primary || false,
      backgroundColor: calendar.backgroundColor
    }))

    return NextResponse.json({ calendars: writableCalendars })
  } catch (error) {
    console.error('Failed to fetch calendars:', error)
    return NextResponse.json(
      { error: 'Failed to fetch calendars' },
      { status: 500 }
    )
  }
}