import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { parseEncryptedData } from '@/lib/encryption'
import { GoogleCalendarService } from '@/lib/google-calendar'

export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const userId = session.user.id
    
    // Get user's timezone
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { timezone: true }
    })
    const userTimezone = user?.timezone || 'UTC'
    
    // Get dates in user's timezone
    const now = new Date()
    const nextWeek = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000)
    
    // Convert to YYYY-MM-DD format in user's timezone for string comparison
    const todayStr = now.toLocaleDateString('en-CA', { timeZone: userTimezone }) // en-CA gives YYYY-MM-DD format
    const nextWeekStr = nextWeek.toLocaleDateString('en-CA', { timeZone: userTimezone })

    // Fetch upcoming milestones from roadmaps
    const upcomingMilestones = await prisma.milestone.findMany({
      where: {
        roadmap: {
          userId: userId,
          status: 'ACTIVE'
        },
        status: {
          in: ['PENDING', 'IN_PROGRESS']
        },
        dueDate: {
          gte: todayStr,
          lte: nextWeekStr
        }
      },
      include: {
        roadmap: true
      },
      orderBy: { dueDate: 'asc' },
      take: 10
    })

    // Fetch calendar events (if access token available)
    let calendarEvents: Array<{
      id: string
      summary: string
      start: string | { dateTime: string }
      description?: string
      location?: string
    }> = []
    if (session.accessToken) {
      try {
        const calendarService = new GoogleCalendarService(session.accessToken)
        calendarEvents = await calendarService.getTodayEvents(now, nextWeek, userTimezone)
      } catch (error) {
        console.error('Failed to fetch calendar events:', error)
        // Continue without calendar events
      }
    }

    // Transform milestones to upcoming items
    const milestoneItems = upcomingMilestones.map(milestone => ({
      id: `milestone-${milestone.id}`,
      type: 'roadmap' as const,
      title: parseEncryptedData(milestone.title),
      date: milestone.dueDate || new Date().toISOString().split('T')[0],
      description: milestone.description ? parseEncryptedData(milestone.description) : undefined,
      priority: 'medium' as const // Could be enhanced based on milestone importance
    }))

    // Transform calendar events to upcoming items
    const calendarItems = calendarEvents.map(event => ({
      id: `calendar-${event.id}`,
      type: 'calendar' as const,
      title: event.summary,
      date: typeof event.start === 'string' ? event.start : event.start.dateTime,
      description: event.description || event.location || undefined,
      priority: 'medium' as const // Could be enhanced based on event importance
    }))

    // Combine and sort all items
    const allItems = [...milestoneItems, ...calendarItems]
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
      .slice(0, 10) // Limit to 10 items

    return NextResponse.json({ items: allItems }, {
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0'
      }
    })
  } catch (error) {
    console.error('Failed to fetch upcoming items:', error)
    return NextResponse.json(
      { error: 'Failed to fetch upcoming items' },
      { status: 500 }
    )
  }
}