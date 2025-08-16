import { getWeekRange, shouldGenerateWeeklySummary } from '@/lib/date-utils'

// Default field of study for users who haven't specified one
const DEFAULT_FIELD_OF_STUDY = 'academic pursuits'

interface DailySummary {
  journal: {
    date: string
  }
  content: string
}

interface WeeklySummaryResult {
  success: boolean
  count: number
  error?: string
  summaryId?: string
}

interface WeeklySummary {
  id: string
  weekStartDate: string
  weekEndDate: string
  content: string
  generatedProof?: string
  createdAt: string
}

/**
 * Shared utility for generating weekly summaries for all past weeks that need them
 * This follows the same pattern as daily summaries - finds all past weeks without summaries and generates them
 * This consolidates the logic that was duplicated across useWeeklySummary hook and history page
 */
export async function generateWeeklySummariesForPastWeeks(
  userFieldsOfStudy: string = DEFAULT_FIELD_OF_STUDY,
  userAssistantName: string = 'Claude',
  userAssistantPersonality: string = 'supportive and encouraging',
  encrypt: (data: string) => Promise<unknown>,
  decrypt: (data: any) => Promise<string>,
  onSuccess?: (message: string) => void,
  onError?: (error: string) => void
): Promise<WeeklySummaryResult> {
  try {
    // First, fetch all weekly summaries to see what weeks already have summaries
    const weeklySummariesResponse = await fetch('/api/journal/hierarchical-summary/save?type=weekly')
    if (!weeklySummariesResponse.ok) {
      throw new Error('Failed to fetch existing weekly summaries')
    }

    const { summaries: existingWeeklySummaries } = await weeklySummariesResponse.json()
    
    // Fetch all daily summaries to find the next gap
    console.log('Fetching daily summaries for weekly summary generation...')
    const dailySummariesResponse = await fetch('/api/journal/summary')
    if (!dailySummariesResponse.ok) {
      throw new Error('Failed to fetch daily summaries')
    }

    const { summaries: allDailySummaries } = await dailySummariesResponse.json()
    console.log(`Found ${allDailySummaries.length} daily summaries`)
    
    if (allDailySummaries.length === 0) {
      console.log('No daily summaries found')
      return { success: true, count: 0 }
    }

    // Group daily summaries by week
    const weeklyGroups = new Map<string, DailySummary[]>()
    
    allDailySummaries.forEach((summary: DailySummary) => {
      const summaryDate = new Date(summary.journal.date)
      const { start: weekStart } = getWeekRange(summaryDate, 'UTC')
      const weekKey = weekStart.toISOString().split('T')[0] // Use start date as key
      
      if (!weeklyGroups.has(weekKey)) {
        weeklyGroups.set(weekKey, [])
      }
      weeklyGroups.get(weekKey)!.push(summary)
    })

    // Find the next chronological gap
    const nextGap = findNextWeeklyGap(existingWeeklySummaries, weeklyGroups)
    
    if (!nextGap) {
      console.log('No gaps found in weekly summaries')
      return { success: true, count: 0 }
    }

    console.log(`Found gap for week starting ${nextGap.weekStart.toISOString()}`)

    // Generate summary for this one gap
    let totalGenerated = 0
    let totalErrors = 0

    try {
      // Decrypt the daily summaries for this week
      const decryptedDailySummaries = await Promise.all(
        nextGap.dailySummaries.map(async (summary: DailySummary) => {
          try {
            // Handle both cases: when content is already an object or when it's a JSON string
            let encryptedData
            if (typeof summary.content === 'string') {
              encryptedData = JSON.parse(summary.content)
            } else {
              encryptedData = summary.content
            }
            
            const decryptedContent = await decrypt(encryptedData)
            return {
              date: summary.journal.date,
              content: decryptedContent
            }
          } catch (error) {
            console.error('Failed to decrypt daily summary:', error)
            return null
          }
        })
      )

      const validDailySummaries = decryptedDailySummaries.filter(Boolean)
      
      if (validDailySummaries.length === 0) {
        console.log(`No valid daily summaries found for week starting ${nextGap.weekStart.toISOString()}`)
        return { success: true, count: 0 }
      }

      // Generate weekly summary for this week
      const response = await fetch('/api/journal/hierarchical-summary', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          type: 'weekly',
          date: nextGap.weekStart.toISOString(),
          dailySummaries: validDailySummaries,
          userFieldsOfStudy,
          userAssistantName,
          userAssistantPersonality
        })
      })

      if (!response.ok) {
        throw new Error('Failed to generate weekly summary')
      }

      const result = await response.json()
      
      if (result.alreadyExists) {
        console.log(`Weekly summary already exists for week starting ${nextGap.weekStart.toISOString()}`)
        return { success: true, count: 0 }
      }

      if (!result.summary) {
        console.log(`No summary generated for week starting ${nextGap.weekStart.toISOString()}`)
        return { success: true, count: 0 }
      }

      // Save the generated summary
      const saveResponse = await fetch('/api/journal/hierarchical-summary/save', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          type: 'weekly',
          content: await encrypt(result.summary.content),
          startDate: result.summary.weekStartDate,
          endDate: result.summary.weekEndDate,
          relatedIds: result.summary.dailySummaryIds || [],
          generatedProof: result.summary.encouragingProof ? await encrypt(result.summary.encouragingProof) : null
        })
      })

      if (!saveResponse.ok) {
        throw new Error('Failed to save weekly summary')
      }

      const saveResult = await saveResponse.json()
      
      if (saveResult.success) {
        totalGenerated++
        console.log(`Generated weekly summary for week starting ${nextGap.weekStart.toISOString()}`)
        
        if (onSuccess) {
          onSuccess(`Generated weekly summary for ${nextGap.weekStart.toLocaleDateString()}`)
        }
      } else {
        totalErrors++
        console.error(`Failed to save weekly summary for week starting ${nextGap.weekStart.toISOString()}`)
        
        if (onError) {
          onError(`Failed to save weekly summary for ${nextGap.weekStart.toLocaleDateString()}`)
        }
      }

    } catch (error) {
      totalErrors++
      console.error(`Failed to generate weekly summary for week starting ${nextGap.weekStart.toISOString()}:`, error)
      
      if (onError) {
        onError(`Failed to generate weekly summary for ${nextGap.weekStart.toLocaleDateString()}`)
      }
    }

    return { 
      success: totalErrors === 0, 
      count: totalGenerated,
      error: totalErrors > 0 ? `Failed to generate ${totalErrors} weekly summary` : undefined
    }

  } catch (error) {
    console.error('Failed to generate weekly summaries:', error)
    return { 
      success: false, 
      count: 0,
      error: error instanceof Error ? error.message : 'Unknown error'
    }
  }
}

/**
 * Find the next chronological gap in weekly summaries
 * Returns the next week that has daily summaries but no weekly summary
 */
function findNextWeeklyGap(
  existingWeeklySummaries: WeeklySummary[], 
  weeklyGroups: Map<string, DailySummary[]>
): { weekStart: Date; weekEnd: Date; dailySummaries: DailySummary[] } | null {
  
  // Sort existing weekly summaries by week start date (oldest first)
  const sortedWeeklySummaries = existingWeeklySummaries
    .sort((a, b) => new Date(a.weekStartDate).getTime() - new Date(b.weekStartDate).getTime())

  // Sort weekly groups by week start date (oldest first)
  const sortedWeekKeys = Array.from(weeklyGroups.keys()).sort()

  // If no weekly summaries exist, find the earliest week with daily summaries
  if (sortedWeeklySummaries.length === 0) {
    if (sortedWeekKeys.length === 0) {
      return null
    }
    
    const earliestWeekKey = sortedWeekKeys[0]
    const weekStart = new Date(earliestWeekKey)
    const { end: weekEnd } = getWeekRange(weekStart, 'UTC')
    
    // Check if we should generate a summary for this week (not too recent)
    const isTestMode = process.env.NODE_ENV === 'development' && false
    const shouldGenerate = isTestMode || shouldGenerateWeeklySummary(weekEnd, 'UTC')
    
    if (shouldGenerate) {
      return {
        weekStart,
        weekEnd,
        dailySummaries: weeklyGroups.get(earliestWeekKey)!
      }
    }
    
    return null
  }

  // Find the next gap after the latest weekly summary
  const latestWeeklySummary = sortedWeeklySummaries[sortedWeeklySummaries.length - 1]
  const latestWeekStart = new Date(latestWeeklySummary.weekStartDate)
  
  // Find the next week after the latest weekly summary
  const nextWeekStart = new Date(latestWeekStart)
  nextWeekStart.setDate(nextWeekStart.getDate() + 7)
  
  const nextWeekKey = nextWeekStart.toISOString().split('T')[0]
  
  // Check if this next week has daily summaries
  if (weeklyGroups.has(nextWeekKey)) {
    const { end: nextWeekEnd } = getWeekRange(nextWeekStart, 'UTC')
    
    // Check if we should generate a summary for this week (not too recent)
    const isTestMode = process.env.NODE_ENV === 'development' && false
    const shouldGenerate = isTestMode || shouldGenerateWeeklySummary(nextWeekEnd, 'UTC')
    
    if (shouldGenerate) {
      return {
        weekStart: nextWeekStart,
        weekEnd: nextWeekEnd,
        dailySummaries: weeklyGroups.get(nextWeekKey)!
      }
    }
  }

  return null
}
