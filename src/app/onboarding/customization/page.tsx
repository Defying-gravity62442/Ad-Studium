"use client"

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'
import { useE2EE } from '@/hooks/useE2EE'
import { TIMEZONE_OPTIONS, detectUserTimezone } from '@/lib/utils/timezone'

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

export default function CustomizationPage() {
  const [institution, setInstitution] = useState('')
  const [fieldsOfStudy, setFieldsOfStudy] = useState('')
  const [background, setBackground] = useState('')
  const [aiName, setAiName] = useState('')
  const [selectedPersonality, setSelectedPersonality] = useState('')
  const [timezone, setTimezone] = useState('UTC')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  
  const router = useRouter()
  const { data: session } = useSession()
  const { encrypt, isReady, hasKey, error: e2eeError } = useE2EE()

  // Detect user's timezone on component mount
  useEffect(() => {
    const detectedTimezone = detectUserTimezone()
    setTimezone(detectedTimezone)
  }, [])

  const handleSubmit = async () => {
    if (!institution.trim() || !fieldsOfStudy.trim() || !aiName.trim() || !selectedPersonality) {
      setError('Please fill in all fields')
      return
    }

    if (!hasKey) {
      setError('Encryption key is required. Please complete the E2EE setup first.')
      return
    }

    setIsSubmitting(true)
    setError(null)

    try {
      // Save timezone first (not encrypted)
      const timezoneResponse = await fetch('/api/user/timezone', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ timezone }),
      })

      if (!timezoneResponse.ok) {
        const data = await timezoneResponse.json()
        throw new Error(data.error || 'Failed to save timezone')
      }

      // Encrypt the sensitive data
      const encryptedInstitution = await encrypt(institution)
      const encryptedFields = await encrypt(fieldsOfStudy)
      const encryptedBackground = background ? await encrypt(background) : null
      const encryptedAiName = await encrypt(aiName)
      const encryptedPersonality = await encrypt(selectedPersonality)

      const response = await fetch('/api/user/customization', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          currentInstitution: encryptedInstitution,
          fieldsOfStudy: encryptedFields,
          background: encryptedBackground,
          aiAssistantName: encryptedAiName,
          aiPersonality: encryptedPersonality,
        }),
      })

      if (response.ok) {
        router.push('/onboarding/roadmap')
      } else {
        const data = await response.json()
        setError(data.error || 'Failed to save customization')
      }
    } catch (err) {
      console.error('Error saving customization:', err)
      setError('Failed to save customization. Please try again.')
    } finally {
      setIsSubmitting(false)
    }
  }

  if (!isReady) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-2xl text-gray-600">Loading...</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-white flex flex-col">
      {/* Progress indicator */}
      <div className="w-full bg-gray-100 h-2">
        <div className="bg-black h-2 transition-all duration-300" style={{ width: '75%' }} />
      </div>

      <div className="flex-1 flex flex-col items-center justify-center px-8 py-16">
        <main className="max-w-2xl mx-auto space-y-8">
          <div className="text-center space-y-4">
            <h1 className="text-4xl font-bold text-black tracking-tight">
              Customize Your Experience
            </h1>
            <p className="text-lg text-gray-700 leading-relaxed">
              Help us personalize your AI companion and academic journey
            </p>
          </div>

          {(error || e2eeError) && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <div className="text-sm text-red-700">
                {error || e2eeError}
              </div>
            </div>
          )}

          <div className="space-y-6">
            <div>
              <label htmlFor="institution" className="block text-sm font-medium text-gray-900 mb-2">
                Current Institution
              </label>
              <input
                type="text"
                id="institution"
                value={institution}
                onChange={(e) => setInstitution(e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-black focus:border-transparent"
                required
              />
            </div>

            <div>
              <label htmlFor="fields" className="block text-sm font-medium text-gray-900 mb-2">
                Fields of Study
              </label>
              <textarea
                id="fields"
                value={fieldsOfStudy}
                onChange={(e) => setFieldsOfStudy(e.target.value)}
                rows={1}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-black focus:border-transparent"
                required
              />
            </div>

            <div>
              <label htmlFor="background" className="block text-sm font-medium text-gray-900 mb-2">
                Background <span className="text-gray-500">(optional)</span>
              </label>
              <textarea
                id="background"
                value={background}
                onChange={(e) => setBackground(e.target.value)}
                placeholder="Tell us more about your academic journey, research interests, career goals, or any other relevant background..."
                rows={4}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-black focus:border-transparent"
              />
              <p className="text-sm text-gray-500 mt-1">
                This provides additional context to help your AI companion give more personalized advice.
              </p>
            </div>

            <div>
              <label htmlFor="aiName" className="block text-sm font-medium text-gray-900 mb-2">
                AI Assistant Name
              </label>
              <input
                type="text"
                id="aiName"
                value={aiName}
                onChange={(e) => setAiName(e.target.value)}
                placeholder="Any name you like!"
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-black focus:border-transparent"
                required
              />
            </div>

            <div>
              <label htmlFor="timezone" className="block text-sm font-medium text-gray-900 mb-2">
                Timezone
              </label>
              <select
                id="timezone"
                value={timezone}
                onChange={(e) => setTimezone(e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-black focus:border-transparent"
              >
                {TIMEZONE_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
              <p className="text-sm text-gray-500 mt-1">
                This affects when your journal day starts (3am in your timezone). We&apos;ve automatically detected your timezone, but you can change it if needed.
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-900 mb-4">
                AI Assistant Personality
              </label>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {AI_PERSONALITIES.map((personality) => (
                  <label
                    key={personality.id}
                    className={`cursor-pointer p-4 border-2 rounded-lg transition-colors ${
                      selectedPersonality === personality.id
                        ? 'border-black bg-gray-50'
                        : 'border-gray-300 hover:border-gray-400'
                    }`}
                  >
                    <input
                      type="radio"
                      name="personality"
                      value={personality.id}
                      checked={selectedPersonality === personality.id}
                      onChange={(e) => setSelectedPersonality(e.target.value)}
                      className="sr-only"
                      required
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

          <div className="flex justify-center pt-6">
            <button
              onClick={handleSubmit}
              disabled={isSubmitting}
              className={`px-8 py-4 rounded-lg font-medium text-lg transition-colors duration-200 min-w-[200px] ${
                !isSubmitting
                  ? 'bg-black text-white hover:bg-gray-800'
                  : 'bg-gray-300 text-gray-500 cursor-not-allowed'
              }`}
            >
              {isSubmitting ? 'Saving...' : 'Continue'}
            </button>
          </div>
        </main>
      </div>
    </div>
  )
}