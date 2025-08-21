/**
 * Context service for gathering user data for AI features
 * Handles E2EE decryption for context data
 */

import { prisma } from '@/lib/db'
import { safeParseEncryptedData } from '@/lib/encryption'
import { getCurrentJournalDate, getWeekRange } from '@/lib/date-utils'

export interface UserCustomization {
  currentInstitution?: string | null
  fieldsOfStudy?: string | null
  background?: string | null
}

export interface CalendarEvent {
  summary: string
  start: Date
  end: Date
  location?: string
  description?: string
}

/**
 * Get user customization data for AI context
 * This returns encrypted data that needs to be decrypted on the client
 */
export async function getUserCustomization(userId: string): Promise<UserCustomization> {
  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        currentInstitution: true,
        fieldsOfStudy: true,
        background: true
      }
    })

    if (!user) {
      return {}
    }

    return {
      currentInstitution: user.currentInstitution,
      fieldsOfStudy: user.fieldsOfStudy,
      background: user.background
    }
  } catch (error) {
    console.error('Failed to get user customization:', error)
    return {}
  }
}

/**
 * Gather context for AI Prompt generation
 * This returns encrypted data that needs to be decrypted on the client
 */
export async function gatherAIPromptContext(userId: string, userTimezone: string) {
  try {
    const currentJournalDate = getCurrentJournalDate(userTimezone)
    const currentWeek = getWeekRange(new Date(currentJournalDate.dateString), userTimezone)
    
    // Get previous two weeks for summaries
    const twoWeeksAgo = new Date(currentWeek.start)
    twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 14)
    
    // Fetch data in parallel
    const [
      todayCalendarEvents,
      weeklyDailySummaries,
      previousWeeksSummaries,
      activeRoadmaps,
      upcomingMilestones
    ] = await Promise.all([
      // Today's calendar events from Google Calendar API
      getTodayCalendarEvents(userId, userTimezone),
      
      // This week's daily summaries
      prisma.dailySummary.findMany({
        where: {
          summaryDate: {
            gte: currentWeek.start,
            lte: currentWeek.end
          },
          journal: {
            userId: userId
          }
        },
        orderBy: { summaryDate: 'desc' },
        take: 7
      }),
      
      // Previous two weeks' weekly summaries
      prisma.weeklySummary.findMany({
        where: {
          userId: userId,
          weekStartDate: {
            gte: twoWeeksAgo,
            lt: currentWeek.start
          }
        },
        orderBy: { weekStartDate: 'desc' },
        take: 2
      }),
      
      // Active roadmaps
      prisma.roadmap.findMany({
        where: {
          userId: userId,
          status: 'ACTIVE'
        },
        include: {
          milestones: {
            where: {
              status: {
                in: ['PENDING', 'IN_PROGRESS']
              }
            },
            orderBy: { dueDate: 'asc' },
            take: 3
          }
        }
      }),
      
      // Upcoming milestones (next 3)
      prisma.milestone.findMany({
        where: {
          roadmap: {
            userId: userId,
            status: 'ACTIVE'
          },
          status: {
            in: ['PENDING', 'IN_PROGRESS']
          },
          dueDate: {
            not: null
          }
        },
        orderBy: { dueDate: 'asc' },
        take: 3,
        include: {
          roadmap: true
        }
      })
    ])



    // Return encrypted data - client will decrypt
    return {
      todayCalendarEvents: JSON.stringify(todayCalendarEvents),
      weeklyProgress: JSON.stringify(weeklyDailySummaries.map(summary => ({
        id: summary.id,
        content: safeParseEncryptedData(summary.content),
        mood: summary.mood ? safeParseEncryptedData(summary.mood) : null,
        keyTopics: summary.keyTopics.map(topic => safeParseEncryptedData(topic)).filter(Boolean),
        summaryDate: summary.summaryDate
      }))),
      previousWeeksSummaries: previousWeeksSummaries.map(summary => JSON.stringify({
        id: summary.id,
        content: safeParseEncryptedData(summary.content),
        weekStartDate: summary.weekStartDate,
        weekEndDate: summary.weekEndDate
      })),
      activeRoadmaps: activeRoadmaps.map(roadmap => JSON.stringify({
        id: roadmap.id,
        title: safeParseEncryptedData(roadmap.title),
        milestones: roadmap.milestones.map(milestone => ({
          id: milestone.id,
          title: safeParseEncryptedData(milestone.title),
          description: milestone.description ? safeParseEncryptedData(milestone.description) : null,
          dueDate: milestone.dueDate,
          status: milestone.status
        }))
      })),
      upcomingMilestones: upcomingMilestones.map(milestone => JSON.stringify({
        id: milestone.id,
        title: safeParseEncryptedData(milestone.title),
        description: milestone.description ? safeParseEncryptedData(milestone.description) : null,
        dueDate: milestone.dueDate,
        roadmapTitle: safeParseEncryptedData(milestone.roadmap.title)
      }))
    }
  } catch (error) {
    console.error('Failed to gather AI prompt context:', error)
    return {
      todayCalendarEvents: '[]',
      weeklyProgress: '[]',
      previousWeeksSummaries: [],
      activeRoadmaps: [],
      upcomingMilestones: []
    }
  }
}

/**
 * Gather context for AI Companion
 * This returns encrypted data that needs to be decrypted on the client
 */
export async function gatherAICompanionContext(userId: string, userTimezone: string) {
  try {
    const currentJournalDate = getCurrentJournalDate(userTimezone)
    const currentWeek = getWeekRange(new Date(currentJournalDate.dateString), userTimezone)
    
    // Get previous two weeks for summaries
    const twoWeeksAgo = new Date(currentWeek.start)
    twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 14)
    
    // Fetch data in parallel
    const [
      weeklyDailySummaries,
      previousWeeksSummaries,
      recentMoods
    ] = await Promise.all([
      // This week's daily summaries
      prisma.dailySummary.findMany({
        where: {
          summaryDate: {
            gte: currentWeek.start,
            lte: currentWeek.end
          },
          journal: {
            userId: userId
          }
        },
        orderBy: { summaryDate: 'desc' },
        take: 7
      }),
      
      // Previous two weeks' weekly summaries
      prisma.weeklySummary.findMany({
        where: {
          userId: userId,
          weekStartDate: {
            gte: twoWeeksAgo,
            lt: currentWeek.start
          }
        },
        orderBy: { weekStartDate: 'desc' },
        take: 2
      }),
      
      // Recent mood data from journals
      prisma.journal.findMany({
        where: {
          userId: userId,
          mood: {
            not: null
          },
          createdAt: {
            gte: twoWeeksAgo
          }
        },
        orderBy: { createdAt: 'desc' },
        take: 14,
        select: {
          mood: true,
          createdAt: true
        }
      })
    ])

    // Return encrypted data - client will decrypt
    return {
      weeklyDailySummary: JSON.stringify(weeklyDailySummaries.map(summary => ({
        id: summary.id,
        content: safeParseEncryptedData(summary.content),
        mood: summary.mood ? safeParseEncryptedData(summary.mood) : null,
        keyTopics: summary.keyTopics.map(topic => safeParseEncryptedData(topic)),
        summaryDate: summary.summaryDate
      }))),
      previousWeeksSummaries: previousWeeksSummaries.map(summary => JSON.stringify({
        id: summary.id,
        content: safeParseEncryptedData(summary.content),
        weekStartDate: summary.weekStartDate,
        weekEndDate: summary.weekEndDate
      })),
      moodTrends: JSON.stringify(recentMoods.map(entry => ({
        mood: entry.mood ? safeParseEncryptedData(entry.mood) : null,
        date: entry.createdAt
      })))
    }
  } catch (error) {
    console.error('Failed to gather AI companion context:', error)
    return {
      weeklyDailySummary: '[]',
      previousWeeksSummaries: [],
      moodTrends: '[]'
    }
  }
}

/**
 * Fetch today's calendar events from Google Calendar
 * This would integrate with the existing calendar service
 */
export async function getTodayCalendarEvents(userId: string, userTimezone: string): Promise<CalendarEvent[]> {
  try {
    // First check if user has calendar read permission
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { calendarReadPermission: true }
    })

    if (!user?.calendarReadPermission) {
      console.log('Calendar read permission not enabled for user')
      return []
    }

    const { GoogleCalendarService } = await import('@/lib/google-calendar')
    const { getServerSession } = await import('next-auth')
    const { authOptions } = await import('@/lib/auth')
    
    const session = await getServerSession(authOptions)
    if (!session?.accessToken) {
      console.log('No access token available for calendar events')
      return []
    }

    const calendarService = new GoogleCalendarService(session.accessToken)
    
    // Set up date range for today in user's timezone
    const today = new Date()
    const startOfDay = new Date(today)
    startOfDay.setHours(0, 0, 0, 0)
    
    const endOfDay = new Date(today)
    endOfDay.setHours(23, 59, 59, 999)

    const events = await calendarService.getTodayEvents(startOfDay, endOfDay, userTimezone)
    
    // Transform to match CalendarEvent interface expected by the context
    return events.map((event: { summary: string; start: string | Date; end: string | Date; location?: string; description?: string }) => ({
      summary: event.summary,
      start: new Date(event.start),
      end: new Date(event.end),
      location: event.location,
      description: event.description
    }))
  } catch (error) {
    console.error('Failed to fetch calendar events:', error)
    return []
  }
}

/**
 * Generate a human-readable summary of user customization for AI
 */
export function formatUserCustomizationForAI(customization: UserCustomization): string {
  const parts = []
  
  if (customization.currentInstitution) {
    parts.push(`Institution: ${customization.currentInstitution}`)
  }
  
  if (customization.fieldsOfStudy) {
    parts.push(`Fields of Study: ${customization.fieldsOfStudy}`)
  }
  
  if (customization.background) {
    parts.push(`Background: ${customization.background}`)
  }
  
  if (parts.length === 0) {
    return 'No academic background information available.'
  }
  
  return `## User Academic Profile\n${parts.join('\n')}`
}