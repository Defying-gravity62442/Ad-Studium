"use client"

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'

export default function ConsentPage() {
  const [acceptedPrivacy, setAcceptedPrivacy] = useState(false)
  const [acceptedTerms, setAcceptedTerms] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const router = useRouter()
  const { data: session } = useSession()

  const handleContinue = async () => {
    if (!acceptedPrivacy || !acceptedTerms) return

    setIsSubmitting(true)
    try {
      const response = await fetch('/api/user/accept-terms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      })

      if (response.ok) {
        router.push('/onboarding/e2ee')
      } else {
        console.error('Failed to accept terms')
      }
    } catch (error) {
      console.error('Error accepting terms:', error)
    } finally {
      setIsSubmitting(false)
    }
  }

  const canContinue = acceptedPrivacy && acceptedTerms

  return (
    <div className="min-h-screen bg-white flex flex-col">
      {/* Progress indicator */}
      <div className="w-full bg-gray-100 h-2">
        <div className="bg-black h-2 transition-all duration-300" style={{ width: '25%' }} />
      </div>

      <div className="flex-1 flex flex-col items-center justify-center px-8 py-16">
        <main className="max-w-2xl mx-auto text-center space-y-8">
          <div className="space-y-4">
            <h1 className="text-4xl font-bold text-black tracking-tight">
              Welcome, {session?.user?.name?.split(' ')[0]}!
            </h1>
            <p className="text-lg text-gray-700 leading-relaxed">
              Before we begin your PhD journey, please review and accept our Privacy Policy and Terms of Service.
            </p>
          </div>

          <div className="space-y-6 text-left">
            <div className="bg-gray-50 p-6 rounded-lg">
              <h2 className="text-xl font-semibold text-black mb-4">Privacy Policy</h2>
              <div className="text-sm text-gray-700 max-h-32 overflow-y-auto mb-4 space-y-2">
                <p>Your privacy is paramount to us. Here&apos;s what you need to know:</p>
                <ul className="list-disc list-inside space-y-1 ml-4">
                  <li>Your content (journals, goals, personal data) is encrypted end-to-end with keys only you hold</li>
                  <li>PDF embeddings are stored unencrypted for AI functionality but cannot be reversed to original text</li>
                  <li>User-to-document mappings are encrypted to protect your privacy</li>
                  <li>AI processing happens via secure relay without server logging or storage of decrypted content</li>
                  <li>We share data only with AI providers (Perplexity, Anthropic, Amazon) and calendar services as needed for functionality</li>
                  <li>Personal data is never sold and you control data export/deletion</li>
                </ul>
              </div>
              <label className="flex items-center space-x-3">
                <input
                  type="checkbox"
                  checked={acceptedPrivacy}
                  onChange={(e) => setAcceptedPrivacy(e.target.checked)}
                  className="w-4 h-4 text-black bg-gray-100 border-gray-300 rounded focus:ring-black focus:ring-2"
                />
                <span className="text-sm font-medium text-gray-900">
                  I have read and accept the <a href="/PRIVACY.html" className="text-gray-600 hover:text-gray-800 underline">Privacy Policy</a>
                </span>
              </label>
            </div>

            <div className="bg-gray-50 p-6 rounded-lg">
              <h2 className="text-xl font-semibold text-black mb-4">Terms of Service</h2>
              <div className="text-sm text-gray-700 max-h-32 overflow-y-auto mb-4 space-y-2">
                <p>By using Ad Studium, you agree to the following terms:</p>
                <ul className="list-disc list-inside space-y-1 ml-4">
                  <li>This is a personal open-source project (BSL 1.1 license) provided free for educational use</li>
                  <li>You must be 13+ years old and use Google OAuth for authentication</li>
                  <li>Use only for personal, educational, non-commercial purposes</li>
                  <li>You own your content but are responsible for ensuring it&apos;s legal and appropriate</li>
                  <li>Journal entries have 7-day cooling-off periods, Letters to Future Self cannot be edited until opened</li>
                  <li>Service provided &quot;as-is&quot; with limited liability; account deletion is irreversible</li>
                </ul>
              </div>
              <label className="flex items-center space-x-3">
                <input
                  type="checkbox"
                  checked={acceptedTerms}
                  onChange={(e) => setAcceptedTerms(e.target.checked)}
                  className="w-4 h-4 text-black bg-gray-100 border-gray-300 rounded focus:ring-black focus:ring-2"
                />
                <span className="text-sm font-medium text-gray-900">
                  I have read and accept the <a href="/TERMS.html" className="text-gray-600 hover:text-gray-800 underline">Terms of Service</a>
                </span>
              </label>
            </div>
          </div>

          <div className="flex justify-center pt-6">
            <button
              onClick={handleContinue}
              disabled={!canContinue || isSubmitting}
              className={`px-8 py-4 rounded-lg font-medium text-lg transition-colors duration-200 min-w-[200px] ${
                canContinue && !isSubmitting
                  ? 'bg-black text-white hover:bg-gray-800'
                  : 'bg-gray-300 text-gray-500 cursor-not-allowed'
              }`}
            >
              {isSubmitting ? 'Processing...' : 'Continue'}
            </button>
          </div>
        </main>
      </div>
    </div>
  )
}