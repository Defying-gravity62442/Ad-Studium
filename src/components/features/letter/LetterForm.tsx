'use client'

import { useState } from 'react'
import { useE2EE } from '@/hooks/useE2EE'
import { Button, Input } from '@/components/ui'

interface LetterFormProps {
  onSuccess: () => void
  onCancel: () => void
}

export function LetterForm({ onSuccess, onCancel }: LetterFormProps) {
  const { encrypt } = useE2EE()
  
  const [formData, setFormData] = useState({
    title: '',
    content: '',
    unsealDate: ''
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!formData.content.trim()) {
      setError('Please write your letter content')
      return
    }
    
    if (!formData.unsealDate) {
      setError('Please select an unseal date')
      return
    }

    // Ensure unseal date is in the future
    const unsealDate = new Date(formData.unsealDate)
    const now = new Date()
    if (unsealDate <= now) {
      setError('Unseal date must be in the future')
      return
    }

    try {
      setLoading(true)
      setError(null)

      // Encrypt the data
      const encryptedTitle = formData.title ? await encrypt(formData.title) : null
      const encryptedContent = await encrypt(formData.content)

      const response = await fetch('/api/letter', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          title: encryptedTitle,
          content: encryptedContent,
          unsealDate: formData.unsealDate
        }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to create letter')
      }

      onSuccess()
    } catch (err) {
      console.error('Failed to create letter:', err)
      setError(err instanceof Error ? err.message : 'Failed to create letter')
    } finally {
      setLoading(false)
    }
  }

  const getTomorrowDate = () => {
    const today = new Date()
    const year = today.getFullYear()
    const month = String(today.getMonth() + 1).padStart(2, '0')
    const day = String(today.getDate() + 1).padStart(2, '0')
    return `${year}-${month}-${day}`
  }

  return (
    <div className="letter-modal-container">
      {/* Letter Paper Background */}
      <div className="letter-paper">
        {/* Letterhead */}
        <div className="letter-header">
          <div className="flex items-center justify-between mb-8">
            <div className="letter-heading">
              <h2 className="letter-title">
                Letter to Future Self
              </h2>
              <div className="letter-date">
                {new Date().toLocaleDateString('en-US', { 
                  weekday: 'long', 
                  year: 'numeric', 
                  month: 'long', 
                  day: 'numeric' 
                })}
              </div>
            </div>
            <Button
              onClick={onCancel}
              className="letter-close-btn"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </Button>
          </div>
        </div>

        {/* Letter Body */}
        <div className="letter-body">
          {error && (
            <div className="letter-error">
              <div className="flex items-center text-red-600">
                <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span className="text-sm">{error}</span>
              </div>
            </div>
          )}

          <form onSubmit={handleSubmit} className="letter-form">
            {/* Letter Title */}
            <div className="letter-field">
              <label className="letter-label">Subject:</label>
              <input
                type="text"
                value={formData.title}
                onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
                placeholder="A meaningful title for your letter..."
                className="letter-input"
              />
            </div>

            {/* Unseal Date */}
            <div className="letter-field">
              <label className="letter-label">
                To be opened on: <span className="text-red-500">*</span>
              </label>
              <input
                type="date"
                value={formData.unsealDate}
                onChange={(e) => setFormData(prev => ({ ...prev, unsealDate: e.target.value }))}
                min={getTomorrowDate()}
                required
                className="letter-input"
              />
              <p className="letter-note">
                Choose when you want to receive and read this letter. Once sealed, you cannot edit or delete it until this date.
              </p>
            </div>

            {/* Letter Content */}
            <div className="letter-content-field">
              <div className="letter-greeting">Dear Future Me,</div>
              <textarea
                value={formData.content}
                onChange={(e) => setFormData(prev => ({ ...prev, content: e.target.value }))}
                placeholder="Share your thoughts, dreams, goals, and what you hope to have accomplished by the time you read this.

This is your time capsule - write from your heart about where you are right now, what you're feeling, what you're hoping for, and what advice you'd like to give your future self.

Take your time and let your thoughts flow naturally onto this page."
                required
                rows={18}
                className="letter-textarea"
              />
              <div className="letter-signature">
                <div className="letter-signature-line">
                  With hope and anticipation,
                  <br />
                  <span className="letter-signature-name">Your Past Self</span>
                </div>
              </div>
            </div>

            {/* Sealing Information */}
            <div className="letter-seal-info">
              <div className="letter-seal-icon">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
              </div>
              <div className="letter-seal-text">
                <h4>Time Capsule Security</h4>
                <ul>
                  <li>• Letter will be encrypted and sealed until the chosen date</li>
                  <li>• Cannot be modified or deleted once sealed</li>
                  <li>• Will automatically become available on the specified date</li>
                  <li>• Only you can decrypt and read the contents</li>
                </ul>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="letter-actions">
              <button
                type="button"
                onClick={onCancel}
                disabled={loading}
                className="letter-btn letter-btn-cancel"
              >
                Discard
              </button>
              <button
                type="submit"
                disabled={loading}
                className="letter-btn letter-btn-seal"
              >
                {loading ? (
                  <div className="flex items-center">
                    <svg className="animate-spin -ml-1 mr-2 h-4 w-4" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Sealing Letter...
                  </div>
                ) : (
                  <div className="flex items-center">
                    <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                    </svg>
                    Seal & Send to Future
                  </div>
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}