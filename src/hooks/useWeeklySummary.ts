import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { useE2EE } from '@/hooks/useE2EE'
import { generateWeeklySummariesForPastWeeks } from '@/lib/weekly-summary-utils'

export function useWeeklySummary() {
  const { data: session } = useSession()
  const { hasKey, isReady, encrypt, decrypt, userKey } = useE2EE()
  const [isGenerating, setIsGenerating] = useState(false)
  const [lastGenerationCheck, setLastGenerationCheck] = useState<Date | null>(null)

  const generateWeeklySummaries = async (): Promise<{ success: boolean; count: number }> => {
    if (!session?.user || !hasKey || !isReady || !userKey) {
      return { success: false, count: 0 }
    }

    try {
      setIsGenerating(true)

      // Fetch user data to get personalized context and timezone
      const userResponse = await fetch('/api/user/customization')
      if (!userResponse.ok) {
        throw new Error('Failed to fetch user data')
      }

      const { customization: userData } = await userResponse.json()
      
      // Get user timezone
      const userTimezone = userData.timezone || 'UTC'
      
      // Decrypt user data
      let userFieldsOfStudy = 'academic pursuits' // Default
      let userAssistantName = 'Claude' // Default
      let userAssistantPersonality = 'supportive and encouraging' // Default

      if (userData.fieldsOfStudy) {
        try {
          const encryptedFieldsOfStudy = JSON.parse(userData.fieldsOfStudy)
          userFieldsOfStudy = await decrypt(encryptedFieldsOfStudy)
        } catch {
          console.warn('Failed to decrypt fields of study, using default')
        }
      }

      if (userData.aiAssistantName) {
        try {
          const encryptedAssistantName = JSON.parse(userData.aiAssistantName)
          userAssistantName = await decrypt(encryptedAssistantName)
        } catch {
          console.warn('Failed to decrypt assistant name, using default')
        }
      }

      if (userData.aiPersonality) {
        try {
          const encryptedPersonality = JSON.parse(userData.aiPersonality)
          userAssistantPersonality = await decrypt(encryptedPersonality)
        } catch {
          console.warn('Failed to decrypt assistant personality, using default')
        }
      }

      console.log('User data for weekly summary generation:', {
        userTimezone,
        userFieldsOfStudy,
        userAssistantName,
        userAssistantPersonality
      })

      // Use the new function that generates summaries for all past weeks that need them
      const result = await generateWeeklySummariesForPastWeeks(
        userTimezone,
        userFieldsOfStudy,
        userAssistantName,
        userAssistantPersonality,
        encrypt,
        decrypt
      )

      return result
    } catch (error) {
      console.error('Failed to generate weekly summaries:', error)
      return { success: false, count: 0 }
    } finally {
      setIsGenerating(false)
    }
  }

  // Auto-generate weekly summaries for all past weeks that need them when dashboard is visited
  useEffect(() => {
    if (!session?.user || !hasKey || !isReady || !userKey) return

    // Check if we've already run this check in this session
    const now = new Date()
    const lastCheck = lastGenerationCheck
    if (lastCheck && (now.getTime() - lastCheck.getTime()) < 5 * 60 * 1000) { // 5 minutes
      return
    }

    const checkAndGenerate = async () => {
      console.log('Auto-generating weekly summaries...')
      try {
        const result = await generateWeeklySummaries()
        if (result.success) {
          setLastGenerationCheck(now)
          console.log('Weekly summary generation completed:', result)
        }
      } catch (error) {
        console.error('Auto weekly summary generation failed:', error)
      }
    }

    checkAndGenerate()
  }, [session, hasKey, isReady, userKey, lastGenerationCheck])

  return {
    generateWeeklySummaries,
    isGenerating
  }
}
