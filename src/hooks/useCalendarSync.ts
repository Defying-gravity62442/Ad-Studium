'use client'

import { useState, useCallback } from 'react'
import { useE2EE } from './useE2EE'

interface Calendar {
  id: string
  name: string
  description?: string
  primary: boolean
  backgroundColor?: string
}

interface MilestoneCalendarData {
  milestoneId: string
  title: string
  description?: string
  dueDate?: string
  timeZone?: string
}

interface SyncResult {
  milestoneId: string
  success: boolean
  error?: string
}

interface UseCalendarSyncReturn {
  calendars: Calendar[]
  isLoadingCalendars: boolean
  isSyncing: boolean
  syncResults: SyncResult[]
  error: string | null
  fetchCalendars: () => Promise<void>
  syncMilestones: (milestonesData: MilestoneCalendarData[], calendarId?: string) => Promise<void>
  unsyncMilestones: (milestoneIds: string[]) => Promise<void>
  clearError: () => void
}

export function useCalendarSync(): UseCalendarSyncReturn {
  const [calendars, setCalendars] = useState<Calendar[]>([])
  const [isLoadingCalendars, setIsLoadingCalendars] = useState(false)
  const [isSyncing, setIsSyncing] = useState(false)
  const [syncResults, setSyncResults] = useState<SyncResult[]>([])
  const [error, setError] = useState<string | null>(null)
  
  const { hasKey } = useE2EE()

  const fetchCalendars = useCallback(async () => {
    if (!hasKey) {
      setError('Encryption key required')
      return
    }

    setIsLoadingCalendars(true)
    setError(null)

    try {
      const response = await fetch('/api/calendar/calendars')
      
      if (!response.ok) {
        if (response.status === 401) {
          throw new Error('Calendar access not granted. Please sign in again.')
        }
        if (response.status === 403) {
          throw new Error('Calendar events permission not enabled. Please enable calendar events access in your settings.')
        }
        throw new Error('Failed to fetch calendars')
      }

      const data = await response.json()
      setCalendars(data.calendars || [])
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch calendars'
      setError(errorMessage)
      console.error('Error fetching calendars:', err)
    } finally {
      setIsLoadingCalendars(false)
    }
  }, [hasKey])

  const syncMilestones = useCallback(async (
    milestonesData: MilestoneCalendarData[],
    calendarId: string = 'primary'
  ) => {
    if (!hasKey) {
      setError('Encryption key required')
      return
    }

    setIsSyncing(true)
    setError(null)
    setSyncResults([])

    try {
      const response = await fetch('/api/calendar/sync', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          milestonesData,
          calendarId
        })
      })

      if (!response.ok) {
        if (response.status === 401) {
          throw new Error('Calendar access not granted. Please sign in again.')
        }
        if (response.status === 403) {
          throw new Error('Calendar events permission not enabled. Please enable calendar events access in your settings.')
        }
        throw new Error('Failed to sync milestones')
      }

      const data = await response.json()
      setSyncResults(data.syncResults || [])
      
      // Check if any syncs failed
      const failedSyncs = data.syncResults?.filter((result: SyncResult) => !result.success) || []
      if (failedSyncs.length > 0) {
        const failedCount = failedSyncs.length
        const totalCount = data.syncResults?.length || 0
        setError(`${failedCount} of ${totalCount} milestones failed to sync`)
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to sync milestones'
      setError(errorMessage)
      console.error('Error syncing milestones:', err)
    } finally {
      setIsSyncing(false)
    }
  }, [hasKey])

  const unsyncMilestones = useCallback(async (milestoneIds: string[]) => {
    if (!hasKey) {
      setError('Encryption key required')
      return
    }

    setIsSyncing(true)
    setError(null)

    try {
      const response = await fetch('/api/calendar/sync', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          milestoneIds
        })
      })

      if (!response.ok) {
        if (response.status === 401) {
          throw new Error('Calendar access not granted. Please sign in again.')
        }
        throw new Error('Failed to remove calendar events')
      }

      const data = await response.json()
      setSyncResults(data.deleteResults || [])
      
      // Check if any deletions failed
      const failedDeletes = data.deleteResults?.filter((result: SyncResult) => !result.success) || []
      if (failedDeletes.length > 0) {
        const failedCount = failedDeletes.length
        const totalCount = data.deleteResults?.length || 0
        setError(`${failedCount} of ${totalCount} calendar events failed to be removed`)
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to remove calendar events'
      setError(errorMessage)
      console.error('Error removing calendar events:', err)
    } finally {
      setIsSyncing(false)
    }
  }, [hasKey])

  const clearError = useCallback(() => {
    setError(null)
  }, [])

  return {
    calendars,
    isLoadingCalendars,
    isSyncing,
    syncResults,
    error,
    fetchCalendars,
    syncMilestones,
    unsyncMilestones,
    clearError
  }
}