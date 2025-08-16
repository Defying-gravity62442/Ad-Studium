import { useState } from 'react'
import { useSession } from 'next-auth/react'
import { useE2EE } from '@/hooks/useE2EE'
import { EncryptedData } from '@/lib/encryption'

interface DecryptedContextData {
  todayCalendarEvents: Array<{
    summary: string
    start: string
    end: string
    location?: string
    description?: string
  }>
  weeklyProgress: Array<{
    id: string
    content: string
    mood: string | null
    keyTopics: string[]
    summaryDate: string
  }>
  previousWeeksSummaries: Array<{
    id: string
    content: string
    weekStartDate: string
    weekEndDate: string
  }>
  activeRoadmaps: Array<{
    id: string
    title: string
    milestones: Array<{
      id: string
      title: string
      description: string | null
      dueDate: string
      status: string
    }>
  }>
  upcomingMilestones: Array<{
    id: string
    title: string
    description: string | null
    dueDate: string
    roadmapTitle: string
  }>
}

interface DecryptedUserCustomization {
  currentInstitution?: string
  fieldsOfStudy?: string
  background?: string
}

export function useAIPrompts() {
  const { data: session } = useSession()
  const { hasKey, isReady, decrypt, userKey } = useE2EE()
  const [isGenerating, setIsGenerating] = useState(false)

  const generateAIPrompts = async (): Promise<string[]> => {
    console.log('useAIPrompts: Checking readiness:', {
      hasSession: !!session?.user,
      hasKey,
      isReady,
      hasUserKey: !!userKey
    })
    
    if (!session?.user || !hasKey || !isReady || !userKey) {
      throw new Error('Not ready to generate prompts')
    }

    try {
      setIsGenerating(true)

      // Fetch encrypted context data from server
      const contextResponse = await fetch('/api/journal/ai-prompts/context')
      if (!contextResponse.ok) {
        throw new Error('Failed to fetch context data')
      }

      const { contextData, userCustomization } = await contextResponse.json()

      // Decrypt the context data
      const decryptedContext = await decryptContextData(contextData)
      const decryptedCustomization = await decryptUserCustomization(userCustomization)

      // Send decrypted data to AI prompts API
      const promptsResponse = await fetch('/api/journal/ai-prompts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contextData: decryptedContext,
          userCustomization: decryptedCustomization
        })
      })

      if (!promptsResponse.ok) {
        throw new Error('Failed to generate prompts')
      }

      const { content: prompts } = await promptsResponse.json()
      return prompts
    } catch (error) {
      console.error('Failed to generate AI prompts:', error)
      throw error
    } finally {
      setIsGenerating(false)
    }
  }

  const decryptContextData = async (contextData: Record<string, unknown>): Promise<DecryptedContextData> => {
    try {
      const decrypted: DecryptedContextData = {
        todayCalendarEvents: [],
        weeklyProgress: [],
        previousWeeksSummaries: [],
        activeRoadmaps: [],
        upcomingMilestones: []
      }

      // Decrypt today's calendar events
      if (contextData.todayCalendarEvents && typeof contextData.todayCalendarEvents === 'string') {
        try {
          const events = JSON.parse(contextData.todayCalendarEvents)
          decrypted.todayCalendarEvents = Array.isArray(events) ? events : []
        } catch {
          console.warn('Failed to parse calendar events')
        }
      }

      // Decrypt weekly progress
      if (contextData.weeklyProgress && typeof contextData.weeklyProgress === 'string') {
        try {
          const progress = JSON.parse(contextData.weeklyProgress)
          if (Array.isArray(progress)) {
            decrypted.weeklyProgress = await Promise.all(
              progress.map(async (item: { id: string; content?: unknown; mood?: unknown; keyTopics?: unknown[]; summaryDate: string }) => ({
                id: item.id,
                content: item.content ? await decrypt(item.content as EncryptedData) : '',
                mood: item.mood ? await decrypt(item.mood as EncryptedData) : null,
                keyTopics: await Promise.all(
                  (item.keyTopics || []).map(async (topic: unknown) => 
                    topic ? await decrypt(topic as EncryptedData) : ''
                  )
                ),
                summaryDate: item.summaryDate
              }))
            )
          }
        } catch {
          console.warn('Failed to parse weekly progress')
        }
      }

      // Decrypt previous weeks summaries
      if (contextData.previousWeeksSummaries && Array.isArray(contextData.previousWeeksSummaries)) {
        decrypted.previousWeeksSummaries = await Promise.all(
          contextData.previousWeeksSummaries.map(async (summary: string) => {
            try {
              const parsed = JSON.parse(summary) as { id: string; content?: unknown; weekStartDate: string; weekEndDate: string }
              return {
                id: parsed.id,
                content: parsed.content ? await decrypt(parsed.content as EncryptedData) : '',
                weekStartDate: parsed.weekStartDate,
                weekEndDate: parsed.weekEndDate
              }
            } catch {
              console.warn('Failed to parse weekly summary')
              return { id: '', content: '', weekStartDate: '', weekEndDate: '' }
            }
          })
        )
      }

      // Decrypt active roadmaps
      if (contextData.activeRoadmaps && Array.isArray(contextData.activeRoadmaps)) {
        decrypted.activeRoadmaps = await Promise.all(
          contextData.activeRoadmaps.map(async (roadmap: string) => {
            try {
              const parsed = JSON.parse(roadmap) as { id: string; title?: unknown; milestones?: Array<{ id: string; title?: unknown; description?: unknown; dueDate: string; status: string }> }
              return {
                id: parsed.id,
                title: parsed.title ? await decrypt(parsed.title as EncryptedData) : '',
                milestones: await Promise.all(
                  (parsed.milestones || []).map(async (milestone) => ({
                    id: milestone.id,
                    title: milestone.title ? await decrypt(milestone.title as EncryptedData) : '',
                    description: milestone.description ? await decrypt(milestone.description as EncryptedData) : null,
                    dueDate: milestone.dueDate,
                    status: milestone.status
                  }))
                )
              }
            } catch {
              console.warn('Failed to parse roadmap')
              return { id: '', title: '', description: null, milestones: [] }
            }
          })
        )
      }

      // Decrypt upcoming milestones
      if (contextData.upcomingMilestones && Array.isArray(contextData.upcomingMilestones)) {
        decrypted.upcomingMilestones = await Promise.all(
          contextData.upcomingMilestones.map(async (milestone: string) => {
            try {
              const parsed = JSON.parse(milestone) as { id: string; title?: unknown; description?: unknown; dueDate: string; roadmapTitle?: unknown }
              return {
                id: parsed.id,
                title: parsed.title ? await decrypt(parsed.title as EncryptedData) : '',
                description: parsed.description ? await decrypt(parsed.description as EncryptedData) : null,
                dueDate: parsed.dueDate,
                roadmapTitle: parsed.roadmapTitle ? await decrypt(parsed.roadmapTitle as EncryptedData) : ''
              }
            } catch {
              console.warn('Failed to parse milestone')
              return { id: '', title: '', description: null, dueDate: '', roadmapTitle: '' }
            }
          })
        )
      }

      return decrypted
    } catch (error) {
      console.error('Failed to decrypt context data:', error)
      return {
        todayCalendarEvents: [],
        weeklyProgress: [],
        previousWeeksSummaries: [],
        activeRoadmaps: [],
        upcomingMilestones: []
      }
    }
  }

  const decryptUserCustomization = async (userCustomization: Record<string, unknown>): Promise<DecryptedUserCustomization> => {
    try {
      const decrypted: DecryptedUserCustomization = {}

      if (userCustomization.currentInstitution && typeof userCustomization.currentInstitution === 'string') {
        try {
          const encrypted = JSON.parse(userCustomization.currentInstitution)
          decrypted.currentInstitution = await decrypt(encrypted as EncryptedData)
        } catch {
          console.warn('Failed to decrypt current institution')
        }
      }

      if (userCustomization.fieldsOfStudy && typeof userCustomization.fieldsOfStudy === 'string') {
        try {
          const encrypted = JSON.parse(userCustomization.fieldsOfStudy)
          decrypted.fieldsOfStudy = await decrypt(encrypted as EncryptedData)
        } catch {
          console.warn('Failed to decrypt fields of study')
        }
      }

      if (userCustomization.background && typeof userCustomization.background === 'string') {
        try {
          const encrypted = JSON.parse(userCustomization.background)
          decrypted.background = await decrypt(encrypted as EncryptedData)
        } catch {
          console.warn('Failed to decrypt background')
        }
      }

      return decrypted
    } catch (error) {
      console.error('Failed to decrypt user customization:', error)
      return {}
    }
  }

  return {
    generateAIPrompts,
    isGenerating
  }
}
