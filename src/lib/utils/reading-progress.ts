/**
 * Utility functions for calculating reading progress with proper overlap detection
 */

export interface ReadingLog {
  id: string
  startPage: number
  endPage: number
  sessionDate: Date
  notes?: string | null
}

/**
 * Calculate unique pages read from a list of reading logs, accounting for overlaps
 */
export function calculateUniquePages(readings: ReadingLog[]): number {
  if (readings.length === 0) return 0
  
  // Filter out invalid logs and validate page numbers
  const validLogs = readings.filter(log => {
    // Ensure page numbers are valid
    if (typeof log.startPage !== 'number' || typeof log.endPage !== 'number') {
      console.warn('Invalid page numbers in reading log:', log.id)
      return false
    }
    
    // Ensure endPage >= startPage
    if (log.endPage < log.startPage) {
      console.warn('End page is less than start page in reading log:', log.id)
      return false
    }
    
    // Ensure page numbers are positive
    if (log.startPage < 0 || log.endPage < 0) {
      console.warn('Negative page numbers in reading log:', log.id)
      return false
    }
    
    return true
  })
  
  if (validLogs.length === 0) return 0
  
  // Sort logs by start page to process them in order
  const sortedLogs = validLogs.sort((a, b) => a.startPage - b.startPage)
  
  // Merge overlapping ranges
  const mergedRanges: Array<{ start: number; end: number }> = []
  
  for (const log of sortedLogs) {
    const currentRange = { start: log.startPage, end: log.endPage }
    
    if (mergedRanges.length === 0) {
      mergedRanges.push(currentRange)
      continue
    }
    
    const lastRange = mergedRanges[mergedRanges.length - 1]
    
    // Check if ranges overlap or are adjacent
    if (currentRange.start <= lastRange.end + 1) {
      // Merge the ranges
      lastRange.end = Math.max(lastRange.end, currentRange.end)
    } else {
      // No overlap, add new range
      mergedRanges.push(currentRange)
    }
  }
  
  // Calculate total unique pages from merged ranges
  return mergedRanges.reduce((total, range) => {
    return total + (range.end - range.start + 1)
  }, 0)
}

/**
 * Calculate reading progress percentage for a document
 */
export function calculateReadingProgress(
  readingLogs: ReadingLog[],
  totalPages: number = 100 // Default estimate
): { pagesRead: number; totalPages: number; percentage: number } {
  const pagesRead = calculateUniquePages(readingLogs)
  const percentage = Math.min(100, (pagesRead / totalPages) * 100)
  
  return {
    pagesRead,
    totalPages,
    percentage: Math.round(percentage * 100) / 100
  }
}
