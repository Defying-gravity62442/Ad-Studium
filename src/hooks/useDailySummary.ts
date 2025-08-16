import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { useE2EE } from '@/hooks/useE2EE'
import { encryptData } from '@/lib/client-encryption'

interface GeneratedSummary {
  journalId: string
  date: string
  summary: {
    context: string
    mood: string | null
    keyTopics: string[]
  }
}

export function useDailySummary() {
  const { data: session } = useSession()
  const { hasKey, isReady, decrypt, userKey } = useE2EE()
  const [isGenerating, setIsGenerating] = useState(false)
  const [lastGenerationCheck, setLastGenerationCheck] = useState<Date | null>(null)

  const generateDailySummaries = async (): Promise<{ success: boolean; count: number }> => {
    if (!session?.user || !hasKey || !isReady || !userKey) {
      return { success: false, count: 0 }
    }

    try {
      setIsGenerating(true)

      // First, fetch all journals to find ones that need summaries
      const journalsResponse = await fetch('/api/journal')
      if (!journalsResponse.ok) {
        throw new Error('Failed to fetch journals')
      }

      const { journals } = await journalsResponse.json()
      
      // Find journals that need summaries (past journals without summaries)
      const journalsNeedingSummaries = journals.filter((j: any) => j.isPast && !j.dailySummary)
      
      if (journalsNeedingSummaries.length === 0) {
        console.log('No journals found that need daily summaries')
        return { success: true, count: 0 }
      }

      // Decrypt journal content before sending to API
      const journalDataForAPI = await Promise.all(
        journalsNeedingSummaries.map(async (journal: any) => {
          try {
            // Decrypt content
            let decryptedContent = ''
            if (journal.content) {
              // Handle both string (legacy) and object format
              let contentToDecrypt = journal.content
              if (typeof journal.content === 'string') {
                try {
                  contentToDecrypt = JSON.parse(journal.content)
                } catch (parseError) {
                  console.error('Failed to parse journal content:', parseError)
                  throw new Error('Unable to parse journal content format')
                }
              }
              
              // Validate encrypted data structure
              if (!contentToDecrypt || 
                  typeof contentToDecrypt !== 'object' ||
                  !contentToDecrypt.data ||
                  !contentToDecrypt.iv ||
                  !contentToDecrypt.salt ||
                  !contentToDecrypt.tag) {
                console.error('Invalid encrypted data structure for journal:', journal.id)
                throw new Error('Invalid encrypted data format')
              }
              
              decryptedContent = await decrypt(contentToDecrypt)
            }
            
            // Decrypt title if it exists
            let decryptedTitle = journal.title
            if (journal.title) {
              let titleToDecrypt = journal.title
              if (typeof journal.title === 'string') {
                try {
                  titleToDecrypt = JSON.parse(journal.title)
                } catch (parseError) {
                  console.error('Failed to parse journal title:', parseError)
                  // Leave as is if parsing fails
                }
              }
              
              if (titleToDecrypt && typeof titleToDecrypt === 'object' && 
                  titleToDecrypt.data && titleToDecrypt.iv && 
                  titleToDecrypt.salt && titleToDecrypt.tag) {
                try {
                  decryptedTitle = await decrypt(titleToDecrypt)
                } catch (decryptError) {
                  console.error('Failed to decrypt title for journal:', journal.id, decryptError)
                  decryptedTitle = `Journal from ${journal.date}`
                }
              }
            }
            
            return {
              journalId: journal.id,
              date: journal.date,
              content: decryptedContent,
              title: decryptedTitle,
              hasAiConversations: journal.aiConversations?.length > 0
            }
          } catch (error) {
            console.error('Failed to decrypt journal:', journal.id, error)
            // Return a minimal entry for failed decryption
            return {
              journalId: journal.id,
              date: journal.date,
              content: `Journal entry from ${journal.date} (decryption failed)`,
              title: `Journal from ${journal.date}`,
              hasAiConversations: journal.aiConversations?.length > 0
            }
          }
        })
      )

      // Request AI to generate summaries for past journals with decrypted content
      const response = await fetch('/api/journal/summary', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          journals: journalDataForAPI
        })
      })

      if (!response.ok) {
        throw new Error('Failed to generate summaries')
      }

      const { summaries }: { summaries: GeneratedSummary[] } = await response.json()

      // Encrypt and save each summary
      let savedCount = 0
      for (const summaryData of summaries) {
        try {
          // Encrypt the summary data
          const encryptedContent = await encryptData(summaryData.summary.context, userKey)
          const encryptedMood = summaryData.summary.mood 
            ? await encryptData(summaryData.summary.mood, userKey) 
            : null
          const encryptedKeyTopics = await Promise.all(
            summaryData.summary.keyTopics.map(topic => encryptData(topic, userKey))
          )

          // Save the encrypted summary
          const saveResponse = await fetch('/api/journal/summary/save', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              journalId: summaryData.journalId,
              content: encryptedContent,
              mood: encryptedMood,
              keyTopics: encryptedKeyTopics,
              summaryDate: summaryData.date
            })
          })

          if (saveResponse.ok) {
            savedCount++
          } else {
            console.error('Failed to save summary for journal:', summaryData.journalId)
          }

        } catch (error) {
          console.error('Failed to encrypt/save summary for journal:', summaryData.journalId, error)
        }
      }

      setLastGenerationCheck(new Date())
      return { success: true, count: savedCount }

    } catch (error) {
      console.error('Failed to generate daily summaries:', error)
      return { success: false, count: 0 }
    } finally {
      setIsGenerating(false)
    }
  }

  // Auto-trigger summary generation on login (once per session)
  useEffect(() => {
    if (session?.user && hasKey && isReady && !lastGenerationCheck && !isGenerating) {
      // Check if we've already done this in this session
      const sessionKey = `dailySummaryCheck_${session.user.id}`
      const lastCheck = sessionStorage.getItem(sessionKey)
      
      if (!lastCheck) {
        // Generate summaries and mark as done for this session
        generateDailySummaries().then(result => {
          if (result.success) {
            sessionStorage.setItem(sessionKey, new Date().toISOString())
            console.log(`Generated ${result.count} daily summaries`)
          }
        })
      } else {
        setLastGenerationCheck(new Date(lastCheck))
      }
    }
  }, [session?.user, hasKey, isReady, lastGenerationCheck, isGenerating, decrypt])

  return {
    generateDailySummaries,
    isGenerating,
    lastGenerationCheck
  }
}