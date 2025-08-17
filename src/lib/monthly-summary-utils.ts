import { getMonthRange, shouldGenerateMonthlySummary } from '@/lib/date-utils'

// Default field of study for users who haven't specified one
const DEFAULT_FIELD_OF_STUDY = 'academic pursuits'

interface WeeklySummary {
  journal: {
    date: string
  }
  content: string
  startDate: string
  endDate: string
}

interface MonthlySummaryResult {
  success: boolean
  count: number
  error?: string
  summaryId?: string
}

interface MonthlySummary {
  id: string
  monthStartDate: string
  monthEndDate: string
  content: string
  generatedProof?: string
  createdAt: string
}

/**
 * Shared utility for generating monthly summaries for all past months that need them
 * This follows the same pattern as weekly summaries - finds all past months without summaries and generates them
 * This consolidates the logic that was duplicated across useMonthlySummary hook and history page
 */
export async function generateMonthlySummariesForPastMonths(
  userFieldsOfStudy: string = DEFAULT_FIELD_OF_STUDY,
  encrypt: (data: string) => Promise<unknown>,
  decrypt: (data: any) => Promise<string>,
  onSuccess?: (message: string) => void,
  onError?: (error: string) => void
): Promise<MonthlySummaryResult> {
  try {
    // First, fetch all monthly summaries to see what months already have summaries
    const monthlySummariesResponse = await fetch('/api/journal/hierarchical-summary/save?type=monthly')
    if (!monthlySummariesResponse.ok) {
      throw new Error('Failed to fetch existing monthly summaries')
    }

    const { summaries: existingMonthlySummaries } = await monthlySummariesResponse.json()
    
    // Fetch all weekly summaries to find the next gap
    console.log('Fetching weekly summaries for monthly summary generation...')
    const weeklySummariesResponse = await fetch('/api/journal/hierarchical-summary/save?type=weekly')
    if (!weeklySummariesResponse.ok) {
      throw new Error('Failed to fetch weekly summaries')
    }

    const { summaries: allWeeklySummaries } = await weeklySummariesResponse.json()
    console.log(`Found ${allWeeklySummaries.length} weekly summaries`)
    
    if (allWeeklySummaries.length === 0) {
      console.log('No weekly summaries found')
      return { success: true, count: 0 }
    }

    // Group weekly summaries by month
    const monthlyGroups = new Map<string, WeeklySummary[]>()
    
    allWeeklySummaries.forEach((summary: WeeklySummary) => {
      const summaryDate = new Date(summary.startDate)
      const { start: monthStart } = getMonthRange(summaryDate, 'UTC')
      const monthKey = monthStart.toISOString().split('T')[0] // Use start date as key
      
      if (!monthlyGroups.has(monthKey)) {
        monthlyGroups.set(monthKey, [])
      }
      monthlyGroups.get(monthKey)!.push(summary)
    })

    // Find the next chronological gap
    const nextGap = findNextMonthlyGap(existingMonthlySummaries, monthlyGroups)
    
    if (!nextGap) {
      console.log('No gaps found in monthly summaries')
      return { success: true, count: 0 }
    }

    console.log(`Found gap for month starting ${nextGap.monthStart.toISOString()}`)

    // Generate summary for this one gap
    let totalGenerated = 0
    let totalErrors = 0

    try {
      // Decrypt the weekly summaries for this month
      const decryptedWeeklySummaries = await Promise.all(
        nextGap.weeklySummaries.map(async (summary: WeeklySummary) => {
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
              startDate: summary.startDate,
              content: decryptedContent
            }
          } catch (error) {
            console.error('Failed to decrypt weekly summary:', error)
            return null
          }
        })
      )

      const validWeeklySummaries = decryptedWeeklySummaries.filter(Boolean)
      
      if (validWeeklySummaries.length === 0) {
        console.log(`No valid weekly summaries found for month starting ${nextGap.monthStart.toISOString()}`)
        return { success: true, count: 0 }
      }

      // Generate monthly summary for this month
      const response = await fetch('/api/journal/hierarchical-summary', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          type: 'monthly',
          date: nextGap.monthStart.toISOString(),
          weeklySummaries: validWeeklySummaries,
          userFieldsOfStudy
        })
      })

      if (!response.ok) {
        throw new Error('Failed to generate monthly summary')
      }

      const result = await response.json()
      
      if (result.alreadyExists) {
        console.log(`Monthly summary already exists for month starting ${nextGap.monthStart.toISOString()}`)
        return { success: true, count: 0 }
      }

      if (!result.summary) {
        console.log(`No summary generated for month starting ${nextGap.monthStart.toISOString()}`)
        return { success: true, count: 0 }
      }

      // Save the generated summary
      const saveResponse = await fetch('/api/journal/hierarchical-summary/save', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          type: 'monthly',
          content: await encrypt(result.summary.content),
          startDate: result.summary.monthStartDate,
          endDate: result.summary.monthEndDate,
          relatedIds: result.summary.weeklySummaryIds || [],
          generatedProof: result.summary.encouragingProof ? await encrypt(result.summary.encouragingProof) : null
        })
      })

      if (!saveResponse.ok) {
        throw new Error('Failed to save monthly summary')
      }

      const saveResult = await saveResponse.json()
      
      if (saveResult.success) {
        totalGenerated++
        console.log(`Generated monthly summary for month starting ${nextGap.monthStart.toISOString()}`)
        
        if (onSuccess) {
          onSuccess(`Generated monthly summary for ${nextGap.monthStart.toLocaleDateString()}`)
        }
      } else {
        totalErrors++
        console.error(`Failed to save monthly summary for month starting ${nextGap.monthStart.toISOString()}`)
        
        if (onError) {
          onError(`Failed to save monthly summary for ${nextGap.monthStart.toLocaleDateString()}`)
        }
      }

    } catch (error) {
      totalErrors++
      console.error(`Failed to generate monthly summary for month starting ${nextGap.monthStart.toISOString()}:`, error)
      
      if (onError) {
        onError(`Failed to generate monthly summary for ${nextGap.monthStart.toLocaleDateString()}`)
      }
    }

    return { 
      success: totalErrors === 0, 
      count: totalGenerated,
      error: totalErrors > 0 ? `Failed to generate ${totalErrors} monthly summary` : undefined
    }

  } catch (error) {
    console.error('Failed to generate monthly summaries:', error)
    return { 
      success: false, 
      count: 0,
      error: error instanceof Error ? error.message : 'Unknown error'
    }
  }
}

/**
 * Find the next chronological gap in monthly summaries
 * Returns the next month that has weekly summaries but no monthly summary
 */
function findNextMonthlyGap(
  existingMonthlySummaries: MonthlySummary[], 
  monthlyGroups: Map<string, WeeklySummary[]>
): { monthStart: Date; monthEnd: Date; weeklySummaries: WeeklySummary[] } | null {
  
  // Sort existing monthly summaries by month start date (oldest first)
  const sortedMonthlySummaries = existingMonthlySummaries
    .sort((a, b) => new Date(a.monthStartDate).getTime() - new Date(b.monthStartDate).getTime())

  // Sort monthly groups by month start date (oldest first)
  const sortedMonthKeys = Array.from(monthlyGroups.keys()).sort()

  // If no monthly summaries exist, find the earliest month with weekly summaries
  if (sortedMonthlySummaries.length === 0) {
    if (sortedMonthKeys.length === 0) {
      return null
    }
    
    const earliestMonthKey = sortedMonthKeys[0]
    const monthStart = new Date(earliestMonthKey)
    const { end: monthEnd } = getMonthRange(monthStart, 'UTC')
    
    // Check if we should generate a summary for this month (not too recent)
    const isTestMode = process.env.NODE_ENV === 'development' && false
    const shouldGenerate = isTestMode || shouldGenerateMonthlySummary(monthEnd, 'UTC')
    
    if (shouldGenerate) {
      return {
        monthStart,
        monthEnd,
        weeklySummaries: monthlyGroups.get(earliestMonthKey)!
      }
    }
    
    return null
  }

  // Find the next gap after the latest monthly summary
  const latestMonthlySummary = sortedMonthlySummaries[sortedMonthlySummaries.length - 1]
  const latestMonthStart = new Date(latestMonthlySummary.monthStartDate)
  
  // Find the next month after the latest monthly summary
  const nextMonthStart = new Date(latestMonthStart)
  nextMonthStart.setMonth(nextMonthStart.getMonth() + 1)
  
  const nextMonthKey = nextMonthStart.toISOString().split('T')[0]
  
  // Check if this next month has weekly summaries
  if (monthlyGroups.has(nextMonthKey)) {
    const { end: nextMonthEnd } = getMonthRange(nextMonthStart, 'UTC')
    
    // Check if we should generate a summary for this month (not too recent)
    const isTestMode = process.env.NODE_ENV === 'development' && false
    const shouldGenerate = isTestMode || shouldGenerateMonthlySummary(nextMonthEnd, 'UTC')
    
    if (shouldGenerate) {
      return {
        monthStart: nextMonthStart,
        monthEnd: nextMonthEnd,
        weeklySummaries: monthlyGroups.get(nextMonthKey)!
      }
    }
  }

  return null
}
