"use client"

import { useEffect, useState } from 'react'
import { useE2EE } from '@/hooks/useE2EE'
import { calculateUniquePages, calculateUniquePagesPerDocument, calculateReadingProgress } from '@/lib/utils/reading-progress'
import { CountUp, AnimatedProgressBar, StaggeredItem, Skeleton } from '@/components/ui'

// Import test function for debugging
import { runTests } from '@/lib/utils/reading-progress.test'

interface ReadingStats {
  overview: {
    totalPagesRead: number
    totalDocuments: number
    readingStreak: number
    recentPagesRead: number
  }
  weeklyActivity: Array<{
    week: string
    pages: number
  }>
  documentBreakdown: Array<{
    docToken: string
    title: string
    pages: number
  }>
  completionRates: Array<{
    docToken: string
    title: string
    pagesRead: number
    totalPages: number
    percentage: number
  }>
}

interface EncryptedReadingLog {
  id: string
  readingId: string
  startPage: any // Encrypted
  endPage: any // Encrypted
  notes: any // Encrypted
  sessionDate: any // Encrypted
  createdAt: string
  reading: {
    id: string
    title: any // Encrypted
    docToken: string
  }
}

interface DecryptedReadingLog {
  id: string
  readingId: string
  startPage: number
  endPage: number
  notes: string | null
  sessionDate: Date
  createdAt: string
  reading: {
    id: string
    title: string
    docToken: string
  }
}

export default function ReadingStats() {
  const [stats, setStats] = useState<ReadingStats | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [hasAnimated, setHasAnimated] = useState(false)
  const { isReady, hasKey, decrypt } = useE2EE()

  useEffect(() => {
    if (isReady && hasKey) {
      fetchStats()
    } else if (isReady && !hasKey) {
      console.warn('No encryption key available for reading stats')
      setIsLoading(false)
    }
  }, [isReady, hasKey])

  useEffect(() => {
    if (stats && !hasAnimated) {
      // Trigger animations after a short delay
      const timer = setTimeout(() => setHasAnimated(true), 100)
      return () => clearTimeout(timer)
    }
  }, [stats, hasAnimated])

  const fetchStats = async () => {
    try {
      const response = await fetch('/api/dashboard/reading-stats')
      if (response.ok) {
        const data = await response.json()
        
        if (data.requiresClientProcessing) {
          // Decrypt and process data on client side
          const decryptedLogs = await decryptReadingLogs(data.encryptedReadingLogs)
          const decryptedReadings = await decryptReadings(data.encryptedReadings)
          const calculatedStats = calculateReadingStats(decryptedLogs, decryptedReadings)
          setStats(calculatedStats)
        } else {
          // Fallback to server-processed data (for backward compatibility)
          setStats(data)
        }
      }
    } catch (error) {
      console.error('Failed to fetch reading stats:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const decryptReadingLogs = async (encryptedLogs: EncryptedReadingLog[]): Promise<DecryptedReadingLog[]> => {
    const decryptedLogs: DecryptedReadingLog[] = []
    
    for (const log of encryptedLogs) {
      try {
        const startPageDecrypted = log.startPage ? await decrypt(JSON.parse(log.startPage)) : '0'
        const endPageDecrypted = log.endPage ? await decrypt(JSON.parse(log.endPage)) : '0'
        const startPage = parseInt(startPageDecrypted)
        const endPage = parseInt(endPageDecrypted)
        
        // Validate page numbers
        if (isNaN(startPage) || isNaN(endPage)) {
          console.warn(`🚨 Invalid page numbers after decryption for log ${log.id}:`, {
            startPageDecrypted,
            endPageDecrypted,
            startPageParsed: startPage,
            endPageParsed: endPage
          })
          continue // Skip this log
        }
        
        const sessionDate = log.sessionDate ? new Date(await decrypt(JSON.parse(log.sessionDate))) : new Date()
        const notes = log.notes ? await decrypt(JSON.parse(log.notes)) : null
        const title = log.reading.title ? await decrypt(JSON.parse(log.reading.title)) : 'Untitled Document'
        
        decryptedLogs.push({
          id: log.id,
          readingId: log.readingId,
          startPage,
          endPage,
          notes,
          sessionDate,
          createdAt: log.createdAt,
          reading: {
            id: log.reading.id,
            title,
            docToken: log.reading.docToken
          }
        })
      } catch (error) {
        console.warn('Failed to decrypt reading log:', log.id, error)
        // Skip this log if decryption fails
      }
    }
    
    if (decryptedLogs.length !== encryptedLogs.length) {
      console.warn(`⚠️ Only ${decryptedLogs.length} out of ${encryptedLogs.length} logs were successfully decrypted`)
    }
    return decryptedLogs
  }

  const decryptReadings = async (encryptedReadings: any[]): Promise<any[]> => {
    const decryptedReadings: any[] = []
    
    for (const reading of encryptedReadings) {
      try {
        const title = reading.title ? await decrypt(JSON.parse(reading.title)) : 'Untitled Document'
        const decryptedLogs = await decryptReadingLogs(reading.readingLogs || [])
        
        decryptedReadings.push({
          ...reading,
          title,
          readingLogs: decryptedLogs
        })
      } catch (error) {
        console.warn('Failed to decrypt reading:', reading.id, error)
      }
    }
    
    return decryptedReadings
  }

  const calculateReadingStats = (readingLogs: DecryptedReadingLog[], readings: any[]): ReadingStats => {
    console.log('🔧 Reading Progress Fix: Ensuring correct log-to-reading mapping')
    
    // Run tests in development mode
    if (process.env.NODE_ENV === 'development') {
      runTests()
    }
    
    // Pages read per week
    const pagesPerWeek = calculatePagesPerWeek(readingLogs)
    
    // Active reading streak
    const readingStreak = calculateReadingStreak(readingLogs)
    
    // Pages read per document
    const pagesPerDocument = calculatePagesPerDocument(readingLogs)
    
    // Percentage read per document - ENSURE each reading has the correct logs
    const readingsWithCorrectLogs = readings.map(reading => {
      // Find all logs for this specific reading from the main logs array
      const logsForThisReading = readingLogs.filter(log => 
        log.readingId === reading.id
      )
      
      if (logsForThisReading.length === 0 && (reading.readingLogs?.length || 0) > 0) {
        console.warn(`⚠️ Reading "${reading.title}" has ${reading.readingLogs?.length || 0} nested logs but 0 matched logs by ID`)
      }
      
      return {
        ...reading,
        readingLogs: logsForThisReading
      }
    })
    
    const percentagePerDocument = calculatePercentageRead(readingsWithCorrectLogs)
    
    // Total pages read (with overlap detection)
    const totalPagesRead = calculateTotalUniquePages(readingLogs)

    // Total documents
    const totalDocuments = readings.length

    // Recent activity (last 30 days)
    const thirtyDaysAgo = new Date()
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
    
    const recentLogs = readingLogs.filter(log => 
      log.sessionDate >= thirtyDaysAgo
    )
    
    const recentPagesRead = calculateTotalUniquePages(recentLogs)

    console.log('📊 Final stats:', {
      totalPagesRead,
      totalDocuments,
      completionRatesCount: percentagePerDocument.length
    })

    return {
      overview: {
        totalPagesRead,
        totalDocuments,
        readingStreak,
        recentPagesRead
      },
      weeklyActivity: pagesPerWeek,
      documentBreakdown: pagesPerDocument,
      completionRates: percentagePerDocument
    }
  }

  // Helper function to convert DecryptedReadingLog to ReadingLog format
  const convertToReadingLog = (log: DecryptedReadingLog) => ({
    id: log.id,
    startPage: log.startPage,
    endPage: log.endPage,
    sessionDate: log.sessionDate,
    notes: log.notes
  })

  // New function to calculate total unique pages read
  const calculateTotalUniquePages = (readingLogs: DecryptedReadingLog[]): number => {
    // Group logs by document to handle overlaps per document
    const logsByDocument: { [docToken: string]: DecryptedReadingLog[] } = {}
    
    readingLogs.forEach(log => {
      if (!logsByDocument[log.reading.docToken]) {
        logsByDocument[log.reading.docToken] = []
      }
      logsByDocument[log.reading.docToken].push(log)
    })
    
    let totalUniquePages = 0
    
    // Calculate unique pages for each document
    Object.values(logsByDocument).forEach(docLogs => {
      const convertedLogs = docLogs.map(convertToReadingLog)
      totalUniquePages += calculateUniquePages(convertedLogs)
    })
    
    return totalUniquePages
  }

  const calculatePagesPerWeek = (readingLogs: DecryptedReadingLog[]) => {
    const weeklyData: { [week: string]: DecryptedReadingLog[] } = {}
    
    readingLogs.forEach(log => {
      const logDate = log.sessionDate
      // Get Monday of the week
      const monday = new Date(logDate)
      monday.setDate(logDate.getDate() - logDate.getDay() + 1)
      const weekKey = monday.toISOString().split('T')[0]
      
      if (!weeklyData[weekKey]) {
        weeklyData[weekKey] = []
      }
      weeklyData[weekKey].push(log)
    })
    
    // Calculate unique pages for each week
    const weeklyPages: { [week: string]: number } = {}
    Object.entries(weeklyData).forEach(([week, logs]) => {
      weeklyPages[week] = calculateTotalUniquePages(logs)
    })
    
    // Convert to array format for charts
    return Object.entries(weeklyPages)
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-12) // Last 12 weeks
      .map(([week, pages]) => ({
        week,
        pages
      }))
  }

  const calculateReadingStreak = (readingLogs: DecryptedReadingLog[]) => {
    if (readingLogs.length === 0) return 0
    
    // Group logs by date
    const logsByDate: { [date: string]: boolean } = {}
    readingLogs.forEach(log => {
      const dateKey = log.sessionDate.toDateString()
      logsByDate[dateKey] = true
    })
    
    const today = new Date()
    let streak = 0
    const currentDate = new Date(today)
    
    // Check consecutive days backwards from today
    while (true) {
      const dateKey = currentDate.toDateString()
      if (logsByDate[dateKey]) {
        streak++
        currentDate.setDate(currentDate.getDate() - 1)
      } else {
        // Allow one day gap if it's today (in case user hasn't read today yet)
        if (streak === 0 && dateKey === today.toDateString()) {
          currentDate.setDate(currentDate.getDate() - 1)
          continue
        }
        break
      }
    }
    
    return streak
  }

  const calculatePagesPerDocument = (readingLogs: DecryptedReadingLog[]) => {
    // Group logs by document
    const logsByDocument: { [docToken: string]: { title: string, logs: DecryptedReadingLog[] } } = {}
    
    readingLogs.forEach(log => {
      if (!logsByDocument[log.reading.docToken]) {
        logsByDocument[log.reading.docToken] = {
          title: log.reading.title,
          logs: []
        }
      }
      logsByDocument[log.reading.docToken].logs.push(log)
    })
    
    return Object.entries(logsByDocument)
      .map(([docToken, data]) => ({
        docToken,
        title: data.title,
        pages: calculateUniquePages(data.logs.map(convertToReadingLog))
      }))
      .sort((a, b) => b.pages - a.pages)
  }

  const calculatePercentageRead = (readings: any[]) => {
    return readings.map(reading => {
      // Ensure readingLogs is an array
      const readingLogs = Array.isArray(reading.readingLogs) ? reading.readingLogs : []
      
      // Calculate unique pages read for this document
      const convertedLogs = readingLogs.map(convertToReadingLog)
      
      // Use actual total pages from PDF, fallback to estimate if not available
      const actualTotalPages = reading.totalPages || 100
      const progress = calculateReadingProgress(convertedLogs, actualTotalPages)
      
      console.log(`📄 "${reading.title}": ${progress.pagesRead}/${actualTotalPages} pages (${progress.percentage}%)`)
      
      return {
        docToken: reading.docToken,
        title: reading.title,
        pagesRead: progress.pagesRead,
        totalPages: actualTotalPages,
        percentage: progress.percentage
      }
    }).sort((a, b) => b.percentage - a.percentage)
  }

  if (isLoading) {
    return (
      <div className="text-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-400 mx-auto mb-4"></div>
        <p className="text-gray-600">Loading reading statistics...</p>
      </div>
    )
  }

  if (!stats) {
    return (
      <div className="text-center py-12">
        <div className="text-6xl mb-4 opacity-20 font-light">Reading</div>
        <p className="text-gray-600 mb-2 font-medium">No reading data yet</p>
        <p className="text-gray-500 text-sm">Upload documents and start reading to see your statistics.</p>
      </div>
    )
  }

  const maxWeeklyPages = Math.max(...stats.weeklyActivity.map(w => w.pages))
  const maxDocumentPages = Math.max(...stats.documentBreakdown.map(d => d.pages))

  return (
    <div className="space-y-6">
      {/* Overview Cards */}
      <div className="grid grid-cols-2 gap-4">
        <div className="text-center p-4 bg-gray-50 rounded-xl border border-gray-200">
          <div className="text-2xl font-bold text-gray-900 mb-1"><CountUp value={stats.overview.totalPagesRead} /></div>
          <div className="text-xs text-gray-600 font-medium">Total Pages</div>
        </div>
        <div className="text-center p-4 bg-gray-50 rounded-xl border border-gray-200">
          <div className="text-2xl font-bold text-gray-900 mb-1"><CountUp value={stats.overview.totalDocuments} /></div>
          <div className="text-xs text-gray-600 font-medium">Documents</div>
        </div>
        <div className="text-center p-4 bg-gray-50 rounded-xl border border-gray-200">
          <div className="text-2xl font-bold text-gray-900 mb-1"><CountUp value={stats.overview.readingStreak} /></div>
          <div className="text-xs text-gray-600 font-medium">Day Streak</div>
        </div>
        <div className="text-center p-4 bg-gray-50 rounded-xl border border-gray-200">
          <div className="text-2xl font-bold text-gray-900 mb-1"><CountUp value={stats.overview.recentPagesRead} /></div>
          <div className="text-xs text-gray-600 font-medium">Pages (30d)</div>
        </div>
      </div>

      {/* Weekly Activity Chart */}
      <div>
        <h4 className="text-sm font-semibold mb-4 text-gray-900">Weekly Reading Activity</h4>
        <div className="space-y-3">
          {stats.weeklyActivity.map((week, index) => (
            <div key={week.week} className="flex items-center gap-4">
              <div className="w-16 text-sm text-gray-600 font-medium">
                Week {index + 1}
              </div>
              <div className="flex-1 bg-gray-200 rounded-full h-3 relative">
                <AnimatedProgressBar
                  percentage={maxWeeklyPages > 0 ? (week.pages / maxWeeklyPages) * 100 : 0}
                  height="h-3"
                  color="bg-gray-800"
                  delay={index * 100} // Stagger animations
                />
              </div>
              <div className="w-12 text-sm text-gray-700 font-semibold text-right">
                {week.pages}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Document Breakdown */}
      <div className="grid grid-cols-1 gap-6">
        {/* Pages per Document */}
        <div>
          <h4 className="text-sm font-semibold mb-4 text-gray-900">Pages Read by Document</h4>
          <div className="space-y-3">
            {stats.documentBreakdown.slice(0, 4).map((doc, index) => (
              <div key={doc.docToken} className="flex items-center gap-4 p-3 bg-gray-50 rounded-lg border border-gray-200">
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold text-gray-900 truncate mb-2">
                    {doc.title}
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="flex-1 bg-gray-200 rounded-full h-2">
                      <AnimatedProgressBar
                        percentage={maxDocumentPages > 0 ? (doc.pages / maxDocumentPages) * 100 : 0}
                        height="h-2"
                        color="bg-gray-800"
                        delay={index * 100} // Stagger animations
                      />
                    </div>
                    <div className="text-xs text-gray-600 w-10 text-right font-semibold">
                      {doc.pages}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Completion Rates */}
        <div>
          <h4 className="text-sm font-semibold mb-4 text-gray-900">Reading Progress</h4>
          <div className="space-y-3">
            {stats.completionRates.slice(0, 4).map((doc, index) => (
              <div key={doc.docToken} className="flex items-center gap-4 p-3 bg-gray-50 rounded-lg border border-gray-200">
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold text-gray-900 truncate mb-2">
                    {doc.title}
                  </div>
                  <div className="flex items-center gap-3 mb-2">
                    <div className="flex-1 bg-gray-200 rounded-full h-2">
                      <AnimatedProgressBar
                        percentage={Math.min(100, doc.percentage)}
                        height="h-2"
                        color="bg-gray-800"
                        delay={index * 100} // Stagger animations
                      />
                    </div>
                    <div className="text-xs text-gray-600 w-12 text-right font-semibold">
                      {doc.percentage.toFixed(1)}%
                    </div>
                  </div>
                  <div className="text-xs text-gray-500">
                    {doc.pagesRead} / {doc.totalPages} pages
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}