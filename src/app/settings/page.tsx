"use client"

import { useState, useEffect } from 'react'
import { useSession, signOut } from 'next-auth/react'
import { useE2EE } from '@/hooks/useE2EE'
import { CalendarPermissionRequest } from '@/components/features/calendar/CalendarPermissionRequest'
import { TIMEZONE_OPTIONS } from '@/lib/utils/timezone'

const AI_PERSONALITIES = [
  {
    id: 'supportive-mentor',
    name: 'Supportive Mentor',
    description: 'Encouraging and patient, focuses on building confidence'
  },
  {
    id: 'analytical-advisor',
    name: 'Analytical Advisor',
    description: 'Logical and structured, helps break down complex problems'
  },
  {
    id: 'creative-collaborator',
    name: 'Creative Collaborator',
    description: 'Innovative and open-minded, encourages creative thinking'
  },
  {
    id: 'pragmatic-guide',
    name: 'Pragmatic Guide',
    description: 'Practical and goal-oriented, focuses on actionable steps'
  }
]

interface CustomizationData {
  currentInstitution: string
  fieldsOfStudy: string
  background: string
  aiAssistantName: string
  aiPersonality: string
  timezone: string
}

interface ExportData {
  exportedAt: string
  user: {
    id: string
    name?: string
    email: string
    image?: string
    hasCompletedOnboarding: boolean
    timezone?: string
    currentInstitution?: unknown
    fieldsOfStudy?: unknown
    background?: unknown
    aiAssistantName?: unknown
    aiPersonality?: unknown
    createdAt: string
    updatedAt: string
  }
  journals: JournalData[]
  roadmaps: RoadmapData[]
  letters: LetterData[]
  readings: ReadingData[]
  readingLogs: ReadingLogData[]
  summaries: {
    daily: SummaryData[]
    weekly: SummaryData[]
    monthly: SummaryData[]
    yearly: SummaryData[]
  }
  metadata: {
    version: string
    format: string
    description: string
    totalJournals: number
    totalRoadmaps: number
    totalLetters: number
    totalReadings: number
    totalReadingLogs: number
  }
}

interface JournalData {
  id: string
  title?: unknown
  content: unknown
  mood?: unknown
  tags?: unknown[]
  aiConversations: Array<{
    id: string
    messages: unknown
  }>
}

interface RoadmapData {
  id: string
  title: unknown
  milestones: Array<{
    id: string
    title: unknown
    description?: unknown
  }>
}

interface LetterData {
  id: string
  title?: unknown
  content: unknown
}

interface ReadingData {
  id: string
  title: unknown
  reflections: Array<{
    id: string
    response: unknown
    aiInsights?: unknown
  }>
}

interface ReadingLogData {
  id: string
  startPage?: unknown
  endPage?: unknown
  notes?: unknown
  sessionDate?: unknown
}

interface SummaryData {
  id: string
  content: unknown
  mood?: unknown
  keyTopics?: unknown[]
  generatedProof?: unknown
}

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState<'customization' | 'calendar' | 'export' | 'delete'>('customization')
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [isExporting, setIsExporting] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [showCalendarPermissionRequest, setShowCalendarPermissionRequest] = useState(false)
  const [calendarIntegrationEnabled, setCalendarIntegrationEnabled] = useState(false)
  
  // Customization state
  const [customization, setCustomization] = useState<CustomizationData>({
    currentInstitution: '',
    fieldsOfStudy: '',
    background: '',
    aiAssistantName: '',
    aiPersonality: '',
    timezone: 'UTC'
  })
  
  const { data: session } = useSession()
  const { decrypt, encrypt, isReady, hasKey, error: e2eeError } = useE2EE()

  // Load current customization data and calendar status
  useEffect(() => {
    const loadData = async () => {
      if (!session?.user?.id || !isReady) return
      
      try {
        const [customizationResponse, onboardingResponse, timezoneResponse] = await Promise.all([
          fetch('/api/user/customization'),
          fetch('/api/user/onboarding-status'),
          fetch('/api/user/timezone')
        ])
        
        if (customizationResponse.ok) {
          const data = await customizationResponse.json()
          
          if (data.customization && hasKey) {
            // Decrypt the data
            const decryptedCustomization = {
              currentInstitution: await decrypt(JSON.parse(data.customization.currentInstitution)),
              fieldsOfStudy: await decrypt(JSON.parse(data.customization.fieldsOfStudy)),
              background: data.customization.background ? await decrypt(JSON.parse(data.customization.background)) : '',
              aiAssistantName: data.customization.aiAssistantName ? await decrypt(JSON.parse(data.customization.aiAssistantName)) : '',
              aiPersonality: data.customization.aiPersonality ? await decrypt(JSON.parse(data.customization.aiPersonality)) : '',
              timezone: customization.timezone, // Preserve existing timezone
            }
            setCustomization(decryptedCustomization)
          }
        }

        if (onboardingResponse.ok) {
          const data = await onboardingResponse.json()
          setCalendarIntegrationEnabled(data.user.calendarIntegrationEnabled || false)
        }

        if (timezoneResponse.ok) {
          const data = await timezoneResponse.json()
          setCustomization(prev => ({ ...prev, timezone: data.timezone }))
        }
      } catch (err) {
        console.error('Error loading data:', err)
        setError('Failed to load data')
      } finally {
        setIsLoading(false)
      }
    }

    loadData()
  }, [session, isReady, hasKey, decrypt])

  const handleSaveCustomization = async () => {
    if (!hasKey) {
      setError('Encryption key is required')
      return
    }

    setIsSaving(true)
    setError(null)
    setSuccess(null)

    try {
      // Save timezone separately (not encrypted)
      const timezoneResponse = await fetch('/api/user/timezone', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ timezone: customization.timezone }),
      })

      if (!timezoneResponse.ok) {
        const data = await timezoneResponse.json()
        throw new Error(data.error || 'Failed to save timezone')
      }

      // Encrypt the data
      const encryptedCustomization = {
        currentInstitution: await encrypt(customization.currentInstitution),
        fieldsOfStudy: await encrypt(customization.fieldsOfStudy),
        background: customization.background ? await encrypt(customization.background) : null,
        aiAssistantName: await encrypt(customization.aiAssistantName),
        aiPersonality: await encrypt(customization.aiPersonality),
      }

      const response = await fetch('/api/user/customization', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(encryptedCustomization),
      })

      if (response.ok) {
        setSuccess('Customization updated successfully')
      } else {
        const data = await response.json()
        setError(data.error || 'Failed to save customization')
      }
    } catch (err) {
      console.error('Error saving customization:', err)
      setError('Failed to save customization')
    } finally {
      setIsSaving(false)
    }
  }

  const handleCalendarPermissionGranted = () => {
    setShowCalendarPermissionRequest(false)
    setCalendarIntegrationEnabled(true)
    setSuccess('Calendar integration enabled successfully')
  }

  const handleDisableCalendarIntegration = async () => {
    if (!window.confirm('Are you sure you want to disable calendar integration? This will remove access to your Google Calendar.')) {
      return
    }

    try {
      const response = await fetch('/api/user/request-calendar-permissions', {
        method: 'DELETE'
      })

      if (response.ok) {
        setCalendarIntegrationEnabled(false)
        setSuccess('Calendar integration disabled successfully')
      } else {
        const data = await response.json()
        setError(data.error || 'Failed to disable calendar integration')
      }
    } catch (err) {
      console.error('Error disabling calendar integration:', err)
      setError('Failed to disable calendar integration')
    }
  }

  const handleExportData = async () => {
    setIsExporting(true)
    setError(null)
    
    try {
      const response = await fetch('/api/user/export')
      if (response.ok) {
        const data = await response.json()
        
        // Decrypt the exported data on the client side
        const decryptedData = await decryptExportedData(data)
        
        // Create and download the file
        const blob = new Blob([JSON.stringify(decryptedData, null, 2)], { type: 'application/json' })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `ad-studium-data-${new Date().toISOString().split('T')[0]}.json`
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)
        URL.revokeObjectURL(url)
        
        setSuccess('Data exported and decrypted successfully')
      } else {
        const errorData = await response.json()
        setError(errorData.error || 'Failed to export data')
      }
    } catch (err) {
      console.error('Error exporting data:', err)
      setError('Failed to export data')
    } finally {
      setIsExporting(false)
    }
  }

  const decryptExportedData = async (data: ExportData): Promise<ExportData> => {
    if (!hasKey) {
      throw new Error('No encryption key available for decryption')
    }

    const decryptField = async (field: unknown): Promise<string | null> => {
      if (!field) return null
      try {
        // Handle both string and object formats
        const fieldData = typeof field === 'string' ? field : JSON.stringify(field)
        return await decrypt(JSON.parse(fieldData))
      } catch (error) {
        console.warn('Failed to decrypt field:', error)
        return '[Decryption Failed]'
      }
    }

    const decryptArray = async (array: unknown[]): Promise<string[]> => {
      if (!array || !Array.isArray(array)) return []
      return await Promise.all(array.map(async (item) => {
        try {
          const decrypted = await decryptField(item)
          return decrypted || '[Decryption Failed]'
        } catch (error) {
          console.warn('Failed to decrypt array item:', error)
          return '[Decryption Failed]'
        }
      }))
    }

    const decryptedData: ExportData = {
      ...data,
      user: {
        ...data.user,
        // Decrypt user customization fields if they exist
        currentInstitution: data.user.currentInstitution ? await decryptField(data.user.currentInstitution) : null,
        fieldsOfStudy: data.user.fieldsOfStudy ? await decryptField(data.user.fieldsOfStudy) : null,
        background: data.user.background ? await decryptField(data.user.background) : null,
        aiAssistantName: data.user.aiAssistantName ? await decryptField(data.user.aiAssistantName) : null,
        aiPersonality: data.user.aiPersonality ? await decryptField(data.user.aiPersonality) : null,
      },
      journals: await Promise.all(data.journals.map(async (journal: JournalData) => ({
        ...journal,
        title: journal.title ? await decryptField(journal.title) : null,
        content: await decryptField(journal.content),
        mood: journal.mood ? await decryptField(journal.mood) : null,
        tags: journal.tags ? await decryptArray(journal.tags) : [],
        aiConversations: await Promise.all(journal.aiConversations.map(async (conv: { id: string; messages: unknown }) => ({
          ...conv,
          messages: await decryptField(conv.messages)
        })))
      }))),
      roadmaps: await Promise.all(data.roadmaps.map(async (roadmap: RoadmapData) => ({
        ...roadmap,
        title: await decryptField(roadmap.title),
        milestones: await Promise.all(roadmap.milestones.map(async (milestone: { id: string; title: unknown; description?: unknown }) => ({
          ...milestone,
          title: await decryptField(milestone.title),
          description: milestone.description ? await decryptField(milestone.description) : null
        })))
      }))),
      letters: await Promise.all(data.letters.map(async (letter: LetterData) => ({
        ...letter,
        title: letter.title ? await decryptField(letter.title) : null,
        content: await decryptField(letter.content)
      }))),
      readings: await Promise.all(data.readings.map(async (reading: ReadingData) => ({
        ...reading,
        title: await decryptField(reading.title),
        reflections: await Promise.all(reading.reflections.map(async (reflection: { id: string; response: unknown; aiInsights?: unknown }) => ({
          ...reflection,
          response: await decryptField(reflection.response),
          aiInsights: reflection.aiInsights ? await decryptField(reflection.aiInsights) : null
        })))
      }))),
      readingLogs: await Promise.all(data.readingLogs.map(async (log: ReadingLogData) => ({
        ...log,
        startPage: log.startPage ? await decryptField(log.startPage) : null,
        endPage: log.endPage ? await decryptField(log.endPage) : null,
        notes: log.notes ? await decryptField(log.notes) : null,
        sessionDate: log.sessionDate ? await decryptField(log.sessionDate) : null
      }))),
      summaries: {
        daily: await Promise.all(data.summaries.daily.map(async (summary: SummaryData) => ({
          ...summary,
          content: await decryptField(summary.content),
          mood: summary.mood ? await decryptField(summary.mood) : null,
          keyTopics: summary.keyTopics ? await decryptArray(summary.keyTopics) : []
        }))),
        weekly: await Promise.all(data.summaries.weekly.map(async (summary: SummaryData) => ({
          ...summary,
          content: await decryptField(summary.content),
          generatedProof: summary.generatedProof ? await decryptField(summary.generatedProof) : null
        }))),
        monthly: await Promise.all(data.summaries.monthly.map(async (summary: SummaryData) => ({
          ...summary,
          content: await decryptField(summary.content),
          generatedProof: summary.generatedProof ? await decryptField(summary.generatedProof) : null
        }))),
        yearly: await Promise.all(data.summaries.yearly.map(async (summary: SummaryData) => ({
          ...summary,
          content: await decryptField(summary.content),
          generatedProof: summary.generatedProof ? await decryptField(summary.generatedProof) : null
        })))
      }
    }

    return decryptedData
  }

  const handleDeleteAccount = async () => {
    if (!window.confirm('Are you sure you want to delete your account? This action cannot be undone and will permanently delete all your data.')) {
      return
    }

    setIsDeleting(true)
    setError(null)

    try {
      const response = await fetch('/api/user/delete', {
        method: 'DELETE'
      })

      if (response.ok) {
        // Clear the session and redirect to homepage after successful deletion
        await signOut({ redirect: false })
        window.location.href = '/'
      } else {
        const data = await response.json()
        setError(data.error || 'Failed to delete account')
      }
    } catch (err) {
      console.error('Error deleting account:', err)
      setError('Failed to delete account')
    } finally {
      setIsDeleting(false)
    }
  }

  if (!isReady || isLoading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-2xl text-gray-600">Loading...</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-white">
      <div className="max-w-4xl mx-auto px-8 py-16">
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-black tracking-tight mb-2">Settings</h1>
          <p className="text-lg text-gray-700">
            Manage your account preferences and data
          </p>
        </div>

        {/* Tab Navigation */}
        <div className="border-b border-gray-200 mb-8">
          <nav className="-mb-px flex space-x-8">
            <button
              onClick={() => setActiveTab('customization')}
              className={`py-2 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'customization'
                  ? 'border-black text-black'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              Customization
            </button>
            <button
              onClick={() => setActiveTab('calendar')}
              className={`py-2 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'calendar'
                  ? 'border-black text-black'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              Calendar Integration
            </button>
            <button
              onClick={() => setActiveTab('export')}
              className={`py-2 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'export'
                  ? 'border-black text-black'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              Export Data
            </button>
            <button
              onClick={() => setActiveTab('delete')}
              className={`py-2 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'delete'
                  ? 'border-black text-black'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              Delete Account
            </button>
          </nav>
        </div>

        {(error || e2eeError) && (
          <div className="warning-card">
            <div className="warning-text">
              {error || e2eeError}
            </div>
          </div>
        )}

        {success && (
          <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-6">
            <div className="text-sm text-green-700">
              {success}
            </div>
          </div>
        )}

        {/* Tab Content */}
        {activeTab === 'customization' && (
          <div className="space-y-6">
            <div>
              <h2 className="text-2xl font-bold text-black mb-4">Edit Your Customization</h2>
              <p className="text-gray-600 mb-6">
                Update your academic information and AI assistant preferences.
              </p>
            </div>

            <div className="space-y-6">
              <div>
                <label htmlFor="institution" className="paper-label">
                  Current Institution
                </label>
                <input
                  type="text"
                  id="institution"
                  value={customization.currentInstitution}
                  onChange={(e) => setCustomization(prev => ({ ...prev, currentInstitution: e.target.value }))}
                  className="w-full paper-input"
                />
              </div>

              <div>
                <label htmlFor="fields" className="paper-label">
                  Fields of Study
                </label>
                <textarea
                  id="fields"
                  value={customization.fieldsOfStudy}
                  onChange={(e) => setCustomization(prev => ({ ...prev, fieldsOfStudy: e.target.value }))}
                  placeholder="e.g., Computer Science, Machine Learning, Natural Language Processing"
                  rows={3}
                  className="w-full paper-textarea"
                />
              </div>

              <div>
                <label htmlFor="background" className="paper-label">
                  Background <span className="text-gray-500">(optional)</span>
                </label>
                <textarea
                  id="background"
                  value={customization.background}
                  onChange={(e) => setCustomization(prev => ({ ...prev, background: e.target.value }))}
                  placeholder="Tell us more about your academic journey, research interests, career goals, or any other relevant background..."
                  rows={4}
                  className="w-full paper-textarea"
                />
                <p className="text-sm text-gray-500 mt-1">
                  This provides additional context to help your AI companion give more personalized advice.
                </p>
              </div>

              <div>
                <label htmlFor="aiName" className="paper-label">
                  AI Assistant Name
                </label>
                <input
                  type="text"
                  id="aiName"
                  value={customization.aiAssistantName}
                  onChange={(e) => setCustomization(prev => ({ ...prev, aiAssistantName: e.target.value }))}
                  placeholder="e.g., Alex, Dr. Smith, Research Buddy"
                  className="w-full paper-input"
                />
              </div>

              <div>
                <label htmlFor="timezone" className="paper-label">
                  Timezone
                </label>
                <select
                  id="timezone"
                  value={customization.timezone}
                  onChange={(e) => setCustomization(prev => ({ ...prev, timezone: e.target.value }))}
                  className="w-full paper-select"
                >
                  {TIMEZONE_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
                <p className="text-sm text-gray-500 mt-1">
                  This affects when your journal day starts (3am in your timezone). You can change this anytime.
                </p>
              </div>

              <div>
                <label className="paper-label mb-4">
                  AI Assistant Personality
                </label>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {AI_PERSONALITIES.map((personality) => (
                    <label
                      key={personality.id}
                      className={`cursor-pointer p-4 border-2 rounded-lg transition-colors ${
                        customization.aiPersonality === personality.id
                          ? 'border-black bg-gray-50'
                          : 'border-gray-300 hover:border-gray-400'
                      }`}
                    >
                      <input
                        type="radio"
                        name="personality"
                        value={personality.id}
                        checked={customization.aiPersonality === personality.id}
                        onChange={(e) => setCustomization(prev => ({ ...prev, aiPersonality: e.target.value }))}
                        className="sr-only"
                      />
                      <div className="font-medium text-gray-900 mb-1">
                        {personality.name}
                      </div>
                      <div className="text-sm text-gray-600">
                        {personality.description}
                      </div>
                    </label>
                  ))}
                </div>
              </div>
            </div>

            <div className="pt-6">
              <button
                onClick={handleSaveCustomization}
                disabled={isSaving}
                className={`px-6 py-3 rounded-lg font-medium transition-colors ${
                  !isSaving
                    ? 'bg-black text-white hover:bg-gray-800'
                    : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                }`}
              >
                {isSaving ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </div>
        )}

        {activeTab === 'calendar' && (
          <div className="space-y-6">
            <div>
              <h2 className="text-2xl font-bold text-black mb-4">Google Calendar Integration</h2>
              <p className="text-gray-600 mb-6">
                Manage your Google Calendar integration settings. When enabled, you can sync milestones to your calendar and provide calendar context to AI features.
              </p>
            </div>

            <div className="bg-gray-50 border border-gray-200 rounded-lg p-6">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="font-medium text-gray-900">Calendar Integration Status</h3>
                  <p className="text-sm text-gray-600 mt-1">
                    {calendarIntegrationEnabled 
                      ? 'Calendar integration is currently enabled'
                      : 'Calendar integration is currently disabled'
                    }
                  </p>
                </div>
                <div className={`px-3 py-1 rounded-full text-sm font-medium ${
                  calendarIntegrationEnabled
                    ? 'bg-green-100 text-green-800'
                    : 'bg-gray-100 text-gray-800'
                }`}>
                  {calendarIntegrationEnabled ? 'Enabled' : 'Disabled'}
                </div>
              </div>

              <div className="space-y-4">
                <h4 className="font-medium text-gray-900">What calendar integration enables:</h4>
                <ul className="text-sm text-gray-600 space-y-2">
                  <li>• Sync milestones to your Google Calendar</li>
                  <li>• Read your calendar events for better AI assistance</li>
                </ul>
              </div>

              <div className="mt-6">
                {calendarIntegrationEnabled ? (
                  <button
                    onClick={handleDisableCalendarIntegration}
                    className="btn-danger-outline"
                  >
                    Disable Calendar Integration
                  </button>
                ) : (
                  <button
                    onClick={() => setShowCalendarPermissionRequest(true)}
                    className="btn-primary"
                  >
                    Enable Calendar Integration
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'export' && (
          <div className="space-y-6">
            <div>
              <h2 className="text-2xl font-bold text-black mb-4">Export Your Data</h2>
              <p className="text-gray-600 mb-6">
                Download all your data in JSON format. This includes your journals, roadmaps, letters, reading reflections, and all other personal data. The exported data will be decrypted on your device for your privacy.
              </p>
            </div>

            <div className="bg-gray-50 border border-gray-200 rounded-lg p-6">
              <h3 className="font-medium text-gray-900 mb-2">What&apos;s included in your export:</h3>
              <ul className="text-sm text-gray-600 space-y-1">
                <li>• Journal entries and AI conversations</li>
                <li>• Roadmaps and milestones</li>
                <li>• Letters to future self</li>
                <li>• Reading reflections and logs</li>
                <li>• Personal customization settings</li>
                <li>• Account information (excluding passwords)</li>
              </ul>
            </div>

            <div>
              <button
                onClick={handleExportData}
                disabled={isExporting}
                className={`px-6 py-3 rounded-lg font-medium transition-colors ${
                  !isExporting
                    ? 'bg-black text-white hover:bg-gray-800'
                    : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                }`}
              >
                {isExporting ? 'Exporting...' : 'Export My Data'}
              </button>
            </div>
          </div>
        )}

        {activeTab === 'delete' && (
          <div className="space-y-6">
            <div>
              <h2 className="text-2xl font-bold text-red-600 mb-4">Delete Your Account</h2>
              <p className="text-gray-600 mb-6">
                Permanently delete your account and all associated data. This action cannot be undone.
              </p>
            </div>

            <div className="warning-card">
              <h3 className="warning-title">This will permanently delete:</h3>
              <ul className="warning-text space-y-1 mb-4">
                <li>• All journal entries and AI conversations</li>
                <li>• All roadmaps and milestones</li>
                <li>• All letters to future self</li>
                <li>• All reading materials and reflections</li>
                <li>• Your account and profile information</li>
                <li>• All encrypted data and encryption keys</li>
              </ul>
              <p className="warning-text font-medium">
                This action is irreversible. Consider exporting your data first.
              </p>
            </div>

            <div>
              <button
                onClick={handleDeleteAccount}
                disabled={isDeleting}
                className={isDeleting ? 'btn-danger opacity-50 cursor-not-allowed' : 'btn-danger'}
              >
                {isDeleting ? 'Deleting...' : 'Delete My Account'}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Calendar Permission Request Modal */}
      {showCalendarPermissionRequest && (
        <CalendarPermissionRequest
          onPermissionGranted={handleCalendarPermissionGranted}
          onCancel={() => setShowCalendarPermissionRequest(false)}
          title="Enable Google Calendar Integration"
          description="To sync your milestones and provide AI context, we need access to your Google Calendar."
        />
      )}
    </div>
  )
}