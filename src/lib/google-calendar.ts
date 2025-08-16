import { google } from 'googleapis'
import { getServerSession } from 'next-auth'
import { authOptions } from './auth'

export interface CalendarEvent {
  id?: string
  summary: string
  description?: string
  start: {
    date?: string
    dateTime?: string
    timeZone?: string
  }
  end: {
    date?: string
    dateTime?: string
    timeZone?: string
  }
  location?: string
}

export interface MilestoneCalendarData {
  title: string
  description?: string
  dueDate: string
  timeZone: string
}

export class GoogleCalendarService {
  private calendar: any

  constructor(accessToken: string) {
    const auth = new google.auth.OAuth2()
    auth.setCredentials({ access_token: accessToken })
    this.calendar = google.calendar({ version: 'v3', auth })
  }

  static async fromSession() {
    const session = await getServerSession(authOptions)
    if (!session?.accessToken) {
      throw new Error('No access token available')
    }
    return new GoogleCalendarService(session.accessToken)
  }

  async createEvent(calendarId: string = 'primary', eventData: CalendarEvent): Promise<string> {
    try {
      const response = await this.calendar.events.insert({
        calendarId,
        resource: eventData,
      })
      return response.data.id
    } catch (error) {
      console.error('Error creating calendar event:', error)
      throw new Error('Failed to create calendar event')
    }
  }

  async updateEvent(
    calendarId: string = 'primary',
    eventId: string,
    eventData: CalendarEvent
  ): Promise<void> {
    try {
      await this.calendar.events.update({
        calendarId,
        eventId,
        resource: eventData,
      })
    } catch (error) {
      console.error('Error updating calendar event:', error)
      throw new Error('Failed to update calendar event')
    }
  }

  async deleteEvent(calendarId: string = 'primary', eventId: string): Promise<void> {
    try {
      await this.calendar.events.delete({
        calendarId,
        eventId,
      })
    } catch (error) {
      console.error('Error deleting calendar event:', error)
      throw new Error('Failed to delete calendar event')
    }
  }

  async getCalendars() {
    try {
      const response = await this.calendar.calendarList.list()
      return response.data.items || []
    } catch (error) {
      console.error('Error fetching calendars:', error)
      throw new Error('Failed to fetch calendars')
    }
  }

  async getTodayEvents(startTime: Date, endTime: Date, timeZone: string = 'UTC') {
    try {
      const response = await this.calendar.events.list({
        calendarId: 'primary',
        timeMin: startTime.toISOString(),
        timeMax: endTime.toISOString(),
        timeZone: timeZone,
        singleEvents: true,
        orderBy: 'startTime',
        maxResults: 50
      })

      const events = response.data.items || []
      
      return events.map((event: any) => ({
        id: event.id,
        summary: event.summary || '(No title)',
        description: event.description || '',
        start: event.start?.dateTime || event.start?.date,
        end: event.end?.dateTime || event.end?.date,
        location: event.location || '',
        attendees: event.attendees || [],
        hangoutLink: event.hangoutLink,
        htmlLink: event.htmlLink
      }))
    } catch (error) {
      console.error('Error fetching calendar events:', error)
      throw new Error('Failed to fetch calendar events')
    }
  }

  milestoneToCalendarEvent(milestone: MilestoneCalendarData): CalendarEvent {
    // Create an all-day event using the YYYY-MM-DD format directly
    return {
      summary: `📚 ${milestone.title}`,
      description: milestone.description || '',
      start: {
        date: milestone.dueDate,
      },
      end: {
        date: milestone.dueDate, // All-day events end on the same day
      },
    }
  }
}

// E2EE-aware calendar sync utilities
export interface EncryptedMilestoneCalendarSync {
  milestoneId: string
  calendarEventId: string
  calendarId: string
  lastSynced: string
}

export function createCalendarSyncRecord(
  milestoneId: string,
  calendarEventId: string,
  calendarId: string = 'primary'
): EncryptedMilestoneCalendarSync {
  return {
    milestoneId,
    calendarEventId,
    calendarId,
    lastSynced: new Date().toISOString(),
  }
}