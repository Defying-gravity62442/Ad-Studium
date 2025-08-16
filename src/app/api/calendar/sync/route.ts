import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { prisma } from '@/lib/db'
import { GoogleCalendarService, MilestoneCalendarData } from '@/lib/google-calendar'
import { authOptions } from '@/lib/auth'

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check if user has calendar integration enabled
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { calendarIntegrationEnabled: true }
    })

    if (!user?.calendarIntegrationEnabled) {
      return NextResponse.json({ 
        error: 'Calendar integration not enabled. Please enable calendar integration in your settings.' 
      }, { status: 403 })
    }

    if (!session.accessToken) {
      return NextResponse.json({ error: 'No calendar access token available' }, { status: 401 })
    }

    const { milestonesData, calendarId = 'primary' } = await request.json()

    if (!milestonesData || !Array.isArray(milestonesData)) {
      return NextResponse.json({ error: 'Invalid milestones data' }, { status: 400 })
    }

    const calendarService = new GoogleCalendarService(session.accessToken)
    const syncResults = []

    for (const milestoneData of milestonesData) {
      const { milestoneId, title, description, dueDate, timeZone } = milestoneData

      try {
        // Verify milestone belongs to user (security check)
        const milestone = await prisma.milestone.findFirst({
          where: {
            id: milestoneId,
            roadmap: { userId: session.user.id }
          }
        })

        if (!milestone) {
          syncResults.push({ milestoneId, success: false, error: 'Milestone not found' })
          continue
        }

        // Check if already synced
        const existingSync = await prisma.calendarSync.findFirst({
          where: { milestoneId }
        })

        // Use client-decrypted data temporarily (will be discarded after API call)
        const calendarEventData: MilestoneCalendarData = {
          title,
          description,
          dueDate: dueDate || milestone.dueDate || new Date().toISOString().split('T')[0],
          timeZone: timeZone || 'UTC'
        }

        const calendarEvent = calendarService.milestoneToCalendarEvent(calendarEventData)

        if (existingSync) {
          // Update existing event
          await calendarService.updateEvent(calendarId, existingSync.calendarEventId, calendarEvent)
          
          // Update sync record
          await prisma.calendarSync.update({
            where: { id: existingSync.id },
            data: { lastSynced: new Date() }
          })
        } else {
          // Create new event
          const eventId = await calendarService.createEvent(calendarId, calendarEvent)
          
          // Create sync record
          await prisma.calendarSync.create({
            data: {
              milestoneId,
              calendarEventId: eventId,
              calendarId,
              lastSynced: new Date()
            }
          })
        }

        syncResults.push({ milestoneId, success: true })
      } catch (error) {
        console.error(`Failed to sync milestone ${milestoneId}:`, error)
        syncResults.push({ 
          milestoneId, 
          success: false, 
          error: error instanceof Error ? error.message : 'Unknown error' 
        })
      }
    }

    return NextResponse.json({ syncResults })
  } catch (error) {
    console.error('Calendar sync failed:', error)
    return NextResponse.json(
      { error: 'Failed to sync to calendar' },
      { status: 500 }
    )
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id || !session.accessToken) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { milestoneIds } = await request.json()

    if (!milestoneIds || !Array.isArray(milestoneIds)) {
      return NextResponse.json({ error: 'Invalid milestone IDs' }, { status: 400 })
    }

    const calendarService = new GoogleCalendarService(session.accessToken)
    const deleteResults = []

    for (const milestoneId of milestoneIds) {
      try {
        // Verify milestone belongs to user
        const milestone = await prisma.milestone.findFirst({
          where: {
            id: milestoneId,
            roadmap: { userId: session.user.id }
          }
        })

        if (!milestone) {
          deleteResults.push({ milestoneId, success: false, error: 'Milestone not found' })
          continue
        }

        const syncRecord = await prisma.calendarSync.findFirst({
          where: { milestoneId }
        })

        if (syncRecord) {
          // Delete from calendar
          await calendarService.deleteEvent(syncRecord.calendarId, syncRecord.calendarEventId)
          
          // Delete sync record
          await prisma.calendarSync.delete({
            where: { id: syncRecord.id }
          })
        }

        deleteResults.push({ milestoneId, success: true })
      } catch (error) {
        console.error(`Failed to delete calendar event for milestone ${milestoneId}:`, error)
        deleteResults.push({ 
          milestoneId, 
          success: false, 
          error: error instanceof Error ? error.message : 'Unknown error' 
        })
      }
    }

    return NextResponse.json({ deleteResults })
  } catch (error) {
    console.error('Calendar delete failed:', error)
    return NextResponse.json(
      { error: 'Calendar delete failed' },
      { status: 500 }
    )
  }
}