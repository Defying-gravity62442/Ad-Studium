'use client'

import { useState, useEffect } from 'react'
import { Modal } from '@/components/ui/modal'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { useE2EE } from '@/hooks/useE2EE'
import { Button } from '@/components/ui'
import { LetterForm } from '@/components/features/letter/LetterForm'
import { LetterList } from '@/components/features/letter/LetterList'
import { Mail } from 'lucide-react'

interface Letter {
  id: string
  title: string | null
  content: string
  unsealDate: string
  isSealed: boolean
  isUnsealed: boolean
  createdAt: string
}

export default function LetterToFutureSelfPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const { isReady, hasKey, decryptMultiple } = useE2EE()
  
  const [letters, setLetters] = useState<Letter[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (status === 'loading' || !isReady) return
    
    if (status === 'unauthenticated') {
      router.push('/')
      return
    }

    if (!hasKey) {
      router.push('/auth/unlock')
      return
    }

    fetchLetters()
  }, [status, isReady, hasKey, router])

  const fetchLetters = async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/letter')
      
      if (!response.ok) {
        throw new Error('Failed to fetch letters')
      }

      const encryptedLetters = await response.json()
      
      // Decrypt letters
      const decryptedLetters = await Promise.all(
        encryptedLetters.map(async (letter: Record<string, unknown>) => {
          const decrypted = await decryptMultiple(letter, ['title', 'content'])
          return {
            id: letter.id,
            title: decrypted.title,
            content: decrypted.content,
            unsealDate: letter.unsealDate,
            isSealed: letter.isSealed,
            isUnsealed: letter.isUnsealed,
            createdAt: letter.createdAt
          }
        })
      )
      
      setLetters(decryptedLetters)
    } catch (err) {
      console.error('Failed to fetch letters:', err)
      setError('Failed to load letters')
    } finally {
      setLoading(false)
    }
  }

  const handleLetterCreated = () => {
    setShowForm(false)
    fetchLetters()
  }

  const handleLetterDeleted = () => {
    fetchLetters()
  }

  if (status === 'loading' || !isReady) {
    return (
      <div className="page-container paper-texture">
        <div className="content-wrapper-7xl">
          <div className="paper-loading">
            <div className="paper-loading-spinner"></div>
            <div className="loading-text text-elegant ml-3">Loading your letters...</div>
          </div>
        </div>
      </div>
    )
  }

  if (!session || !hasKey) {
    return null
  }

  return (
    <div className="page-container paper-texture">
      <div className="content-wrapper-7xl">
        {/* Header Section */}
        <div className="paper-header">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 bg-gray-100 rounded-2xl flex items-center justify-center shadow-lg flex-shrink-0">
                <Mail className="h-8 w-8 text-gray-600" />
              </div>
              <div>
                <h1 className="heading-primary text-elegant">
                  Letters to Future Self
                </h1>
                <p className="text-paper-secondary text-lg text-elegant">
                  Send messages across time to your future self. Each letter is a time capsule of your thoughts, dreams, and aspirations.
                </p>
              </div>
            </div>
            <button
              onClick={() => setShowForm(true)}
              className="btn-primary"
            >
              + Write New Letter
            </button>
          </div>
        </div>

        {/* Letter Count */}
        {letters.length > 0 && (
          <div className="text-center mb-8">
            <div className="text-sm text-paper-secondary text-elegant">
              {letters.length} letter{letters.length !== 1 ? 's' : ''} in your collection
            </div>
          </div>
        )}

        {/* Main Content */}
        {error && (
          <div className="paper-alert paper-alert-error mb-8">
            <div className="flex items-center">
              <svg className="w-5 h-5 text-red-400 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <p className="text-elegant">{error}</p>
            </div>
          </div>
        )}

        {loading ? (
          <div className="paper-loading">
            <div className="paper-loading-spinner"></div>
            <div className="loading-text text-elegant ml-3">Loading your letters...</div>
          </div>
        ) : (
          <LetterList 
            letters={letters}
            onLetterDeleted={handleLetterDeleted}
          />
        )}
      </div>

      {/* Letter Form Modal */}
      {showForm && (
        <Modal isOpen={showForm} onClose={() => setShowForm(false)} maxWidth="4xl" showCloseButton={false}>
          <LetterForm 
            onSuccess={handleLetterCreated}
            onCancel={() => setShowForm(false)}
          />
        </Modal>
      )}
    </div>
  )
}