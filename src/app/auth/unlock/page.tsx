"use client"

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'

export default function UnlockPage() {
  const [password, setPassword] = useState('')
  const [isUnlocking, setIsUnlocking] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()
  const { data: session } = useSession()

  useEffect(() => {
    // If user is not authenticated, redirect to home
    if (!session) {
      router.push('/')
    }
  }, [session, router])

  const handleUnlock = async () => {
    if (!password.trim()) {
      setError('Please enter your password')
      return
    }

    setIsUnlocking(true)
    setError(null)

    try {
      // Get the encrypted key from the server
      const response = await fetch('/api/user/get-encrypted-key')
      if (!response.ok) {
        throw new Error('Failed to retrieve encryption key')
      }

      const { encryptedKey } = await response.json()
      
      // Try to decrypt the key with the provided password
      const decryptedKey = await decryptWithPassword(encryptedKey, password)
      
      // Store the decrypted key using the same method as the E2EE setup
      const { storeUserKey } = await import('@/lib/client-encryption')
      storeUserKey({
        encryptionKey: decryptedKey,
        created: Date.now()
      })

      // Redirect to continue onboarding or dashboard
      checkOnboardingStatus()
    } catch (err) {
      console.error('Unlock failed:', err)
      setError('Invalid password. Please try again.')
    } finally {
      setIsUnlocking(false)
    }
  }

  const checkOnboardingStatus = async () => {
    try {
      const response = await fetch('/api/user/onboarding-status')
      if (response.ok) {
        const data = await response.json()
        const user = data.user

        const hasCustomizedAI = !!(user.currentInstitution || user.fieldsOfStudy || user.aiAssistantName || user.aiPersonality)
        const hasCreatedRoadmap = data.hasRoadmaps || false

        if (!hasCustomizedAI) {
          router.push('/onboarding/customization')
        } else if (!hasCreatedRoadmap) {
          router.push('/onboarding/roadmap')
        } else {
          router.push('/dashboard')
        }
      } else if (response.status === 404) {
        // User not found - likely deleted account, redirect to homepage
        console.log('User not found - redirecting to homepage')
        router.push('/')
      } else {
        router.push('/dashboard')
      }
    } catch (error) {
      console.error('Error checking onboarding status:', error)
      router.push('/dashboard')
    }
  }

  const decryptWithPassword = async (encryptedKey: string, password: string): Promise<string> => {
    try {
      const { decryptKeyWithPassword } = await import('@/lib/client-encryption')
      return await decryptKeyWithPassword(encryptedKey, password)
    } catch (error) {
      console.error('Password decryption failed:', error)
      throw new Error('Invalid password or corrupted data')
    }
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleUnlock()
    }
  }

  if (!session) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-2xl text-gray-600">Loading...</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-white flex flex-col items-center justify-center px-8 py-16">
      <main className="max-w-md mx-auto space-y-8">
        <div className="text-center space-y-4">
          <h1 className="text-3xl font-bold text-black tracking-tight">
            Welcome back, {session.user?.name?.split(' ')[0]}!
          </h1>
          <p className="text-lg text-gray-700 leading-relaxed">
            Please enter your password to unlock your encrypted data.
          </p>
        </div>

        <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
          <div className="flex">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-gray-400" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="ml-3">
              <h3 className="text-sm font-medium text-gray-800 text-elegant">
                Secure Access
              </h3>
              <div className="mt-2 text-sm text-gray-700 text-elegant">
                <p>
                  Your privacy is yours alone. End-to-end encryption means only you can see your data—no one else, not even us.
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <div>
            <label htmlFor="password" className="block text-sm font-medium text-gray-900 mb-2">
              Password
            </label>
            <input
              type="password"
              id="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="Enter your password"
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-black focus:border-transparent"
              autoFocus
            />
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <div className="text-sm text-red-700">
                {error}
              </div>
            </div>
          )}

          <button
            onClick={handleUnlock}
            disabled={isUnlocking || !password.trim()}
            className={`w-full py-3 px-6 rounded-lg font-medium text-lg transition-colors duration-200 ${
              !isUnlocking && password.trim()
                ? 'bg-black text-white hover:bg-gray-800'
                : 'bg-gray-300 text-gray-500 cursor-not-allowed'
            }`}
          >
            {isUnlocking ? 'Unlocking...' : 'Unlock My Data'}
          </button>
        </div>
      </main>
    </div>
  )
}