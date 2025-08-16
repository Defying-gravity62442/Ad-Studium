/**
 * Date utilities for handling journal dates with timezone awareness
 * The day boundary is defined as 3am in the user's timezone
 */

export interface JournalDate {
  date: Date
  dateString: string // YYYY-MM-DD format for the journal day
  timezone: string
}

/**
 * Get the journal date for a given timestamp in user's timezone
 * If the time is before 3am, it belongs to the previous day's journal
 */
export function getJournalDate(timestamp: Date, userTimezone: string): JournalDate {
  const zonedDate = new Date(timestamp.toLocaleString("en-US", { timeZone: userTimezone }))
  
  // If it's before 3am, subtract one day
  if (zonedDate.getHours() < 3) {
    zonedDate.setDate(zonedDate.getDate() - 1)
  }
  
  const dateString = zonedDate.toISOString().split('T')[0]
  
  return {
    date: zonedDate,
    dateString,
    timezone: userTimezone
  }
}

/**
 * Get the current journal date for the user
 */
export function getCurrentJournalDate(userTimezone: string): JournalDate {
  return getJournalDate(new Date(), userTimezone)
}

/**
 * Check if a journal is past (after 3am of the next day)
 */
export function isJournalPast(journalTimestamp: Date, userTimezone: string): boolean {
  const now = new Date()
  const journalDate = getJournalDate(journalTimestamp, userTimezone)
  const currentJournalDate = getCurrentJournalDate(userTimezone)
  
  return journalDate.dateString < currentJournalDate.dateString
}

/**
 * Check if a journal is in the 7-day cooling period (immutable)
 */
export function isJournalInCoolingPeriod(journalTimestamp: Date, userTimezone: string): boolean {
  const now = new Date()
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
  
  return journalTimestamp > sevenDaysAgo
}

/**
 * Get the end of day timestamp (3am next day) for a journal date
 */
export function getEndOfJournalDay(journalDateString: string, userTimezone: string): Date {
  const journalDate = new Date(journalDateString + 'T00:00:00')
  const nextDay = new Date(journalDate.getTime() + 24 * 60 * 60 * 1000)
  
  // Convert to user timezone and set to 3am
  const endOfDay = new Date(nextDay.toLocaleString("en-US", { timeZone: userTimezone }))
  endOfDay.setHours(3, 0, 0, 0)
  
  return endOfDay
}

/**
 * Check if we should generate a daily summary for a date
 * Only generate if it's at least one day later than the journal date
 */
export function shouldGenerateDailySummary(journalDateString: string, userTimezone: string): boolean {
  const currentJournalDate = getCurrentJournalDate(userTimezone)
  const journalDate = new Date(journalDateString)
  const currentDate = new Date(currentJournalDate.dateString)
  
  // At least one day must have passed
  return currentDate > journalDate
}

/**
 * Check if we should generate a weekly summary for a week
 * Only generate if it's at least one week later than the week end date
 */
export function shouldGenerateWeeklySummary(weekEndDate: Date, userTimezone: string): boolean {
  const currentDate = new Date()
  const weekEnd = new Date(weekEndDate)
  
  // At least one week must have passed since the end of the week
  const oneWeekLater = new Date(weekEnd.getTime() + 7 * 24 * 60 * 60 * 1000)
  
  return currentDate >= oneWeekLater
}

/**
 * Check if we should generate a monthly summary for a month
 * Only generate if it's at least one month later than the month end date
 */
export function shouldGenerateMonthlySummary(monthEndDate: Date, userTimezone: string): boolean {
  const currentDate = new Date()
  const monthEnd = new Date(monthEndDate)
  
  // At least one month must have passed since the end of the month
  const oneMonthLater = new Date(monthEnd.getTime() + 30 * 24 * 60 * 60 * 1000) // Approximate 30 days
  
  return currentDate >= oneMonthLater
}

/**
 * Check if we should generate a yearly summary for a year
 * Only generate if it's at least one year later than the year end date
 */
export function shouldGenerateYearlySummary(yearEndDate: Date, userTimezone: string): boolean {
  const currentDate = new Date()
  const yearEnd = new Date(yearEndDate)
  
  // At least one year must have passed since the end of the year
  const oneYearLater = new Date(yearEnd.getTime() + 365 * 24 * 60 * 60 * 1000) // Approximate 365 days
  
  return currentDate >= oneYearLater
}

/**
 * Get date ranges for hierarchical summaries
 */
export function getWeekRange(date: Date, userTimezone: string): { start: Date, end: Date } {
  const start = new Date(date)
  start.setDate(start.getDate() - start.getDay()) // Start of week (Sunday)
  start.setHours(0, 0, 0, 0)
  
  const end = new Date(start)
  end.setDate(end.getDate() + 6) // End of week (Saturday)
  end.setHours(23, 59, 59, 999)
  
  return { start, end }
}

/**
 * Get the previous week's date for retrospective summary generation
 */
export function getPreviousWeekDate(): Date {
  const currentDate = new Date()
  return new Date(currentDate.getTime() - 7 * 24 * 60 * 60 * 1000) // 7 days ago
}

export function getMonthRange(date: Date, userTimezone: string): { start: Date, end: Date } {
  const localDate = new Date(date.toLocaleString("en-US", { timeZone: userTimezone }))
  
  const start = new Date(localDate.getFullYear(), localDate.getMonth(), 1)
  start.setHours(3, 0, 0, 0)
  
  const end = new Date(localDate.getFullYear(), localDate.getMonth() + 1, 0)
  end.setHours(3, 0, 0, 0)
  
  return { start, end }
}

export function getYearRange(date: Date, userTimezone: string): { start: Date, end: Date } {
  const localDate = new Date(date.toLocaleString("en-US", { timeZone: userTimezone }))
  
  const start = new Date(localDate.getFullYear(), 0, 1)
  start.setHours(3, 0, 0, 0)
  
  const end = new Date(localDate.getFullYear(), 11, 31)
  end.setHours(3, 0, 0, 0)
  
  return { start, end }
}

/**
 * Format date for display in user's timezone
 */
export function formatJournalDate(dateString: string, userTimezone: string): string {
  const date = new Date(dateString)
  return date.toLocaleDateString("en-US", { 
    timeZone: userTimezone,
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  })
}