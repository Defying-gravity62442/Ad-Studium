'use client'

import { useState, useEffect } from 'react'
import { Modal } from '@/components/ui/modal'
import { Button } from '@/components/ui/button'
import { useCalendarSync } from '@/hooks/useCalendarSync'
import { CalendarPermissionRequest } from '@/components/features/calendar/CalendarPermissionRequest'

interface Milestone {
  id: string
  title: string
  description?: string
  dueDate?: string
  status: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'OVERDUE'
  order: number
}

interface CalendarSyncProps {
  milestones: Milestone[]
  onClose: () => void
}

export function CalendarSync({ milestones, onClose }: CalendarSyncProps) {
  const [selectedMilestones, setSelectedMilestones] = useState<Set<string>>(new Set())
  const [showResults, setShowResults] = useState(false)
  const [showPermissionRequest, setShowPermissionRequest] = useState(false)
  const [hasCalendarAccess, setHasCalendarAccess] = useState<boolean | null>(null)
  const [isVisible, setIsVisible] = useState(false)

  const {
    isSyncing,
    syncResults,
    error,
    syncMilestones,
    clearError
  } = useCalendarSync()

  useEffect(() => {
    checkCalendarAccess()
  }, [])

  useEffect(() => {
    // Trigger fade-in animation
    setIsVisible(true)
  }, [])

  const checkCalendarAccess = async () => {
    try {
      const response = await fetch('/api/user/onboarding-status')
      if (response.ok) {
        const data = await response.json()
        setHasCalendarAccess(data.user.calendarIntegrationEnabled || false)
      } else {
        setHasCalendarAccess(false)
      }
    } catch (error) {
      console.error('Failed to check calendar access:', error)
      setHasCalendarAccess(false)
    }
  }

  useEffect(() => {
    // Auto-select all incomplete milestones by default
    const incompleteMilestones = milestones
      .filter(m => m.status !== 'COMPLETED')
      .map(m => m.id)
    setSelectedMilestones(new Set(incompleteMilestones))
  }, [milestones])

  const handleSelectAll = () => {
    const allIds = milestones.map(m => m.id)
    setSelectedMilestones(new Set(allIds))
  }

  const handleSelectNone = () => {
    setSelectedMilestones(new Set())
  }

  const handleToggleMilestone = (milestoneId: string) => {
    const newSelected = new Set(selectedMilestones)
    if (newSelected.has(milestoneId)) {
      newSelected.delete(milestoneId)
    } else {
      newSelected.add(milestoneId)
    }
    setSelectedMilestones(newSelected)
  }

  const handleSync = async () => {
    if (selectedMilestones.size === 0) {
      return
    }

    const milestonesToSync = milestones
      .filter(m => selectedMilestones.has(m.id))
      .map(m => ({
        milestoneId: m.id,
        title: m.title,
        description: m.description,
        dueDate: m.dueDate,
        timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone
      }))

    // Use 'primary' calendar by default - no need to fetch calendar list
    await syncMilestones(milestonesToSync, 'primary')
    setShowResults(true)
  }

  const handlePermissionGranted = () => {
    setShowPermissionRequest(false)
    setHasCalendarAccess(true)
  }

  const handleClose = () => {
    setIsVisible(false)
    // Wait for fade-out animation to complete before calling onClose
    setTimeout(() => {
      onClose()
    }, 200)
  }

  // Show permission request if user hasn't enabled calendar integration
  if (hasCalendarAccess === false) {
    return (
      <CalendarPermissionRequest
        onPermissionGranted={handlePermissionGranted}
        onCancel={handleClose}
        title="Enable Calendar Integration"
        description="To sync your milestones to Google Calendar, we need your permission to access your calendar."
      />
    )
  }

  if (showResults) {
    const successCount = syncResults.filter(r => r.success).length
    const totalCount = syncResults.length

    return (
      <Modal isOpen={isVisible} onClose={handleClose} maxWidth="md" showCloseButton={false}>
          <div className="text-center mb-6">
            <div className={`w-16 h-16 mx-auto mb-4 rounded-full flex items-center justify-center ${
              successCount === totalCount ? 'bg-green-100' : 'bg-yellow-100'
            }`}>
              {successCount === totalCount ? (
                <svg className="w-8 h-8 text-green-600" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
              ) : (
                <svg className="w-8 h-8 text-yellow-600" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
              )}
            </div>
            <h3 className="text-xl font-semibold text-black mb-2">
              Calendar Sync {successCount === totalCount ? 'Complete' : 'Partially Complete'}
            </h3>
            <p className="text-gray-600">
              {successCount} of {totalCount} milestones synced successfully
            </p>
          </div>

          {syncResults.some(r => !r.success) && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
              <h4 className="text-sm font-medium text-red-800 mb-2">Failed to sync:</h4>
              <ul className="text-sm text-red-700 space-y-1">
                {syncResults
                  .filter(r => !r.success)
                  .map(r => (
                    <li key={r.milestoneId}>
                      {milestones.find(m => m.id === r.milestoneId)?.title}: {r.error}
                    </li>
                  ))}
              </ul>
            </div>
          )}

          <div className="flex justify-center">
            <Button onClick={handleClose}>
              Done
            </Button>
          </div>
      </Modal>
    )
  }

  return (
    <Modal isOpen={isVisible} onClose={handleClose} maxWidth="2xl" showCloseButton={false}>
        <div className="p-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-2xl font-bold text-black">Sync to Google Calendar</h2>
              <p className="text-gray-600 mt-1">
                Select milestones to add to your primary Google Calendar
              </p>
            </div>
            <button
              onClick={handleClose}
              className="text-gray-400 hover:text-gray-600"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
              <div className="flex items-center justify-between">
                <div className="text-sm text-red-700">{error}</div>
                <button
                  onClick={clearError}
                  className="text-red-400 hover:text-red-600"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>
          )}

          {/* Milestone Selection */}
          <div className="mb-6">
            <div className="flex items-center justify-between mb-4">
              <label className="text-sm font-medium text-gray-900">
                Select Milestones ({selectedMilestones.size} of {milestones.length})
              </label>
              <div className="space-x-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleSelectAll}
                >
                  Select All
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleSelectNone}
                >
                  Select None
                </Button>
              </div>
            </div>

            <div className="space-y-3 max-h-64 overflow-y-auto">
              {milestones.map((milestone) => (
                <div key={milestone.id} className="flex items-start space-x-3 p-3 border border-gray-200 rounded-lg">
                  <input
                    type="checkbox"
                    checked={selectedMilestones.has(milestone.id)}
                    onChange={() => handleToggleMilestone(milestone.id)}
                    className="mt-1 w-4 h-4 text-black border-gray-300 rounded focus:ring-black focus:ring-2"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center space-x-2">
                      <p className={`text-sm font-medium ${milestone.status === 'COMPLETED' ? 'line-through text-gray-500' : 'text-gray-900'}`}>
                        {milestone.title}
                      </p>
                      {milestone.status === 'COMPLETED' && (
                        <span className="px-2 py-1 bg-green-100 text-green-800 text-xs rounded-full">
                          Completed
                        </span>
                      )}
                    </div>
                    {milestone.description && (
                      <p className="text-sm text-gray-600 mt-1 line-clamp-2">
                        {milestone.description}
                      </p>
                    )}
                    {milestone.dueDate && (
                      <p className="text-xs text-gray-500 mt-1">
                        Due: {new Date(milestone.dueDate).toLocaleDateString()}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="flex justify-end space-x-4">
            <Button
              variant="outline"
              onClick={handleClose}
            >
              Cancel
            </Button>
            <Button
              onClick={handleSync}
              disabled={selectedMilestones.size === 0 || isSyncing}
            >
              {isSyncing ? 'Syncing...' : `Sync ${selectedMilestones.size} Milestone${selectedMilestones.size !== 1 ? 's' : ''}`}
            </Button>
          </div>
        </div>
    </Modal>
  )
}