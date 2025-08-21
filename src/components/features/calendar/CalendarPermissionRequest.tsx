"use client"

import { useState } from 'react'
import { Modal } from '@/components/ui/modal'
import { Button } from '@/components/ui/button'

interface CalendarPermissionRequestProps {
  onPermissionGranted?: () => void
  onCancel?: () => void
  title?: string
  description?: string
  showPermissionOptions?: boolean
}

export function CalendarPermissionRequest({ 
  onPermissionGranted, 
  onCancel,
  title = "Enable Google Calendar Integration",
  description = "Choose what calendar permissions you'd like to enable:",
  showPermissionOptions = true
}: CalendarPermissionRequestProps) {
  const [isRequesting, setIsRequesting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [selectedPermissions, setSelectedPermissions] = useState<{
    readonly: boolean
    events: boolean
  }>({
    readonly: false,
    events: false
  })

  const handleCancel = () => {
    onCancel?.()
  }

  const handlePermissionChange = (permission: 'readonly' | 'events', checked: boolean) => {
    setSelectedPermissions(prev => ({
      ...prev,
      [permission]: checked
    }))
  }

  const handleRequestPermission = async () => {
    if (showPermissionOptions && !selectedPermissions.readonly && !selectedPermissions.events) {
      setError('Please select at least one permission type.')
      return
    }

    setIsRequesting(true)
    setError(null)

    try {
      // Determine the scope to request
      let scope = 'events' // default to events permission
      if (showPermissionOptions) {
        if (selectedPermissions.readonly && !selectedPermissions.events) {
          scope = 'readonly'
        } else if (selectedPermissions.events) {
          scope = 'events'
        }
      } else {
        // When showPermissionOptions is false, default to events permission for milestone syncing
        scope = 'events'
      }

      const response = await fetch('/api/user/request-calendar-permissions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ scope })
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
    <Modal isOpen={true} onClose={handleCancel} maxWidth="md">
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

          {showPermissionOptions && (
            <div className="mb-6 text-left">
              <div className="space-y-4">
                <div className="flex items-start space-x-3">
                  <input
                    type="checkbox"
                    id="readonly-permission"
                    checked={selectedPermissions.readonly}
                    onChange={(e) => handlePermissionChange('readonly', e.target.checked)}
                    className="mt-1 h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                  />
                  <div>
                    <label htmlFor="readonly-permission" className="text-sm font-medium text-gray-900">
                      Read Calendar Events
                    </label>
                    <p className="text-xs text-gray-600 mt-1">
                      Allow AI to read your calendar events to provide better context and assistance in your journal entries and AI conversations.
                    </p>
                  </div>
                </div>

                <div className="flex items-start space-x-3">
                  <input
                    type="checkbox"
                    id="events-permission"
                    checked={selectedPermissions.events}
                    onChange={(e) => handlePermissionChange('events', e.target.checked)}
                    className="mt-1 h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                  />
                  <div>
                    <label htmlFor="events-permission" className="text-sm font-medium text-gray-900">
                      Create Calendar Events
                    </label>
                    <p className="text-xs text-gray-600 mt-1">
                      Allow syncing your roadmap milestones to your Google Calendar as events with due dates.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md">
              <p className="text-sm text-red-600">{error}</p>
            </div>
          )}

          <div className="flex space-x-3">
            <Button
              onClick={handleRequestPermission}
              disabled={isRequesting || (showPermissionOptions && !selectedPermissions.readonly && !selectedPermissions.events)}
              className="flex-1 btn-primary"
            >
              {isRequesting ? 'Requesting...' : (showPermissionOptions ? 'Enable Selected Permissions' : 'Enable Calendar Events')}
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
            You can change these permissions later in your account settings.
          </p>
        </div>
      </div>
    </Modal>
  )
} 