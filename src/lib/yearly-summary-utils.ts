import { getYearRange, shouldGenerateYearlySummary } from './date-utils'

const DEFAULT_FIELD_OF_STUDY = 'academic pursuits'

interface YearlySummary {
  id: string
  startDate: string
  endDate: string
  content: string
  generatedProof?: string
  createdAt: string
}

interface MonthlySummary {
  id: string
  startDate: string
  endDate: string
  content: string
  generatedProof?: string
  createdAt: string
}

interface YearlySummaryResult {
  success: boolean
  count: number
  error?: string
  summaryId?: string
}

/**
 * Shared utility for generating yearly summaries for all past years that need them
 * This follows the same pattern as weekly and monthly summaries - finds all past years without summaries and generates them
 * This consolidates the logic that was duplicated across useYearlySummary hook and history page
 */
export async function generateYearlySummariesForPastYears(
  userTimezone: string = 'UTC',
  userFieldsOfStudy: string = DEFAULT_FIELD_OF_STUDY,
  userAssistantName: string = 'Claude',
  userAssistantPersonality: string = 'supportive and encouraging',
  encrypt: (data: string) => Promise<unknown>,
  decrypt: (data: any) => Promise<string>,
  onSuccess?: (message: string) => void,
  onError?: (error: string) => void
): Promise<YearlySummaryResult> {
  try {
    // First, fetch all yearly summaries to see what years already have summaries
    const yearlySummariesResponse = await fetch('/api/journal/hierarchical-summary/save?type=yearly')
    if (!yearlySummariesResponse.ok) {
      throw new Error('Failed to fetch existing yearly summaries')
    }

    const { summaries: existingYearlySummaries } = await yearlySummariesResponse.json()
    
    // Fetch all monthly summaries to find the next gap
    console.log('Fetching monthly summaries for yearly summary generation...')
    const monthlySummariesResponse = await fetch('/api/journal/hierarchical-summary/save?type=monthly')
    if (!monthlySummariesResponse.ok) {
      throw new Error('Failed to fetch monthly summaries')
    }

    const { summaries: allMonthlySummaries } = await monthlySummariesResponse.json()
    console.log(`Found ${allMonthlySummaries.length} monthly summaries`)
    
    if (allMonthlySummaries.length === 0) {
      console.log('No monthly summaries found')
      return { success: true, count: 0 }
    }

    // Group monthly summaries by year
    const yearlyGroups = new Map<string, MonthlySummary[]>()
    
    allMonthlySummaries.forEach((summary: MonthlySummary) => {
      const summaryDate = new Date(summary.startDate)
      const { start: yearStart } = getYearRange(summaryDate, userTimezone)
      const yearKey = yearStart.toISOString().split('T')[0] // Use start date as key
      
      if (!yearlyGroups.has(yearKey)) {
        yearlyGroups.set(yearKey, [])
      }
      yearlyGroups.get(yearKey)!.push(summary)
    })

    // Find the next chronological gap
    const nextGap = findNextYearlyGap(existingYearlySummaries, yearlyGroups, userTimezone)
    
    if (!nextGap) {
      console.log('No gaps found in yearly summaries')
      return { success: true, count: 0 }
    }

    console.log(`Found gap for year starting ${nextGap.yearStart.toISOString()}`)

    // Generate summary for this one gap
    let totalGenerated = 0
    let totalErrors = 0

    try {
      // Decrypt the monthly summaries for this year
      const decryptedMonthlySummaries = await Promise.all(
        nextGap.monthlySummaries.map(async (summary: MonthlySummary) => {
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
            console.error('Failed to decrypt monthly summary:', error)
            return null
          }
        })
      )

      const validMonthlySummaries = decryptedMonthlySummaries.filter(Boolean)
      
      if (validMonthlySummaries.length === 0) {
        console.log(`No valid monthly summaries found for year starting ${nextGap.yearStart.toISOString()}`)
        return { success: true, count: 0 }
      }

      // Generate yearly summary for this year
      const response = await fetch('/api/journal/hierarchical-summary', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          type: 'yearly',
          date: nextGap.yearStart.toISOString(),
          monthlySummaries: validMonthlySummaries,
          userFieldsOfStudy
        })
      })

      if (!response.ok) {
        throw new Error('Failed to generate yearly summary')
      }

      const result = await response.json()
      
      if (result.alreadyExists) {
        console.log(`Yearly summary already exists for year starting ${nextGap.yearStart.toISOString()}`)
        return { success: true, count: 0 }
      }

      if (!result.summary) {
        console.log(`No summary generated for year starting ${nextGap.yearStart.toISOString()}`)
        return { success: true, count: 0 }
      }

      // Save the generated summary
      const saveResponse = await fetch('/api/journal/hierarchical-summary/save', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          type: 'yearly',
          content: await encrypt(result.summary.content),
          startDate: result.summary.yearStartDate,
          endDate: result.summary.yearEndDate,
          relatedIds: result.summary.monthlySummaryIds || [],
          generatedProof: result.summary.encouragingProof ? await encrypt(result.summary.encouragingProof) : null
        })
      })

      if (!saveResponse.ok) {
        throw new Error('Failed to save yearly summary')
      }

      const saveResult = await saveResponse.json()
      
      if (saveResult.success) {
        totalGenerated++
        console.log(`Generated yearly summary for year starting ${nextGap.yearStart.toISOString()}`)
        
        if (onSuccess) {
          onSuccess(`Generated yearly summary for ${nextGap.yearStart.toLocaleDateString()}`)
        }
      } else {
        totalErrors++
        console.error(`Failed to save yearly summary for year starting ${nextGap.yearStart.toISOString()}`)
        
        if (onError) {
          onError(`Failed to save yearly summary for ${nextGap.yearStart.toLocaleDateString()}`)
        }
      }

    } catch (error) {
      totalErrors++
      console.error(`Failed to generate yearly summary for year starting ${nextGap.yearStart.toISOString()}:`, error)
      
      if (onError) {
        onError(`Failed to generate yearly summary for ${nextGap.yearStart.toLocaleDateString()}`)
      }
    }

    return { 
      success: totalErrors === 0, 
      count: totalGenerated,
      error: totalErrors > 0 ? `Failed to generate ${totalErrors} yearly summary` : undefined
    }

  } catch (error) {
    console.error('Failed to generate yearly summaries:', error)
    return { 
      success: false, 
      count: 0,
      error: error instanceof Error ? error.message : 'Unknown error'
    }
  }
}

/**
 * Find the next chronological gap in yearly summaries
 * Returns the next year that has monthly summaries but no yearly summary
 */
function findNextYearlyGap(
  existingYearlySummaries: YearlySummary[], 
  yearlyGroups: Map<string, MonthlySummary[]>,
  userTimezone: string
): { yearStart: Date; yearEnd: Date; monthlySummaries: MonthlySummary[] } | null {
  
  // Sort existing yearly summaries by year start date (oldest first)
  const sortedYearlySummaries = existingYearlySummaries
    .sort((a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime())

  // Sort yearly groups by year start date (oldest first)
  const sortedYearKeys = Array.from(yearlyGroups.keys()).sort()

  // If no yearly summaries exist, find the earliest year with monthly summaries
  if (sortedYearlySummaries.length === 0) {
    if (sortedYearKeys.length === 0) {
      return null
    }
    
    const earliestYearKey = sortedYearKeys[0]
    const yearStart = new Date(earliestYearKey)
    const { end: yearEnd } = getYearRange(yearStart, userTimezone)
    
    // Check if we should generate a summary for this year (not too recent)
    const isTestMode = process.env.NODE_ENV === 'development' && false
    const shouldGenerate = isTestMode || shouldGenerateYearlySummary(yearEnd, userTimezone)
    
    if (shouldGenerate) {
      return {
        yearStart,
        yearEnd,
        monthlySummaries: yearlyGroups.get(earliestYearKey)!
      }
    }
    
    return null
  }

  // Find the next gap after the latest yearly summary
  const latestYearlySummary = sortedYearlySummaries[sortedYearlySummaries.length - 1]
  const latestYearStart = new Date(latestYearlySummary.startDate)
  
  // Find the next year after the latest yearly summary
  const nextYearStart = new Date(latestYearStart)
  nextYearStart.setFullYear(nextYearStart.getFullYear() + 1)
  
  const nextYearKey = nextYearStart.toISOString().split('T')[0]
  
  // Check if this next year has monthly summaries
  if (yearlyGroups.has(nextYearKey)) {
    const { end: nextYearEnd } = getYearRange(nextYearStart, userTimezone)
    
    // Check if we should generate a summary for this year (not too recent)
    const isTestMode = process.env.NODE_ENV === 'development' && false
    const shouldGenerate = isTestMode || shouldGenerateYearlySummary(nextYearEnd, userTimezone)
    
    if (shouldGenerate) {
      return {
        yearStart: nextYearStart,
        yearEnd: nextYearEnd,
        monthlySummaries: yearlyGroups.get(nextYearKey)!
      }
    }
  }

  return null
}


