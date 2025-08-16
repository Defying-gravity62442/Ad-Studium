'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Modal } from '@/components/ui/modal'

interface CalendarPermissionRequestProps {
  onPermissionGranted?: () => void
  onCancel?: () => void
  title?: string
  description?: string
}

export function CalendarPermissionRequest({ 
  onPermissionGranted, 
  onCancel,
  title = "Enable Google Calendar Integration",
  description = "To sync your milestones and provide AI context, we need access to your Google Calendar."
}: CalendarPermissionRequestProps) {
  const [isRequesting, setIsRequesting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleCancel = () => {
    onCancel?.()
  }

  const handleRequestPermission = async () => {
    setIsRequesting(true)
    setError(null)

    try {
      const response = await fetch('/api/user/request-calendar-permissions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      })

      if (!response.ok) {
        throw new Error('Failed to request calendar permissions')
      }

      const data = await response.json()
      
      if (data.success && data.authUrl) {
        // Redirect to Google OAuth for calendar permissions
        window.location.href = data.authUrl
      } else {
        throw new Error('Invalid response from server')
      }
    } catch (err) {
      console.error('Calendar permission request failed:', err)
      setError('Failed to request calendar permissions. Please try again.')
    } finally {
      setIsRequesting(false)
    }
  }

  return (
    <Modal isOpen={true} onClose={handleCancel} maxWidth="md" showCloseButton={false}>
      <div className="p-6">
        <div className="text-center">
          <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-gray-100 mb-4">
            <svg className="h-6 w-6 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          </div>
          
          <h3 className="text-lg font-medium text-gray-900 mb-2">
            {title}
          </h3>
          
          <p className="text-sm text-gray-600 mb-6">
            {description}
          </p>

          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md">
              <p className="text-sm text-red-600">{error}</p>
            </div>
          )}

          <div className="flex space-x-3">
            <Button
              onClick={handleRequestPermission}
              disabled={isRequesting}
              className="flex-1 btn-primary"
            >
              {isRequesting ? 'Requesting...' : 'Enable Calendar'}
            </Button>
            
            {onCancel && (
              <Button
                onClick={handleCancel}
                variant="outline"
                className="flex-1"
                disabled={isRequesting}
              >
                Cancel
              </Button>
            )}
          </div>

          <p className="text-xs text-gray-500 mt-4">
            You can change this setting later in your account preferences.
          </p>
        </div>
      </div>
    </Modal>
  )
} 