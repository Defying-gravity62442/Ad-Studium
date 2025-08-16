'use client'

import { useState, useEffect } from 'react'
import { Modal } from '@/components/ui/modal'
import { Button } from '@/components/ui'

interface Letter {
  id: string
  title: string | null
  content: string
  unsealDate: string
  isSealed: boolean
  isUnsealed: boolean
  createdAt: string
}

interface LetterListProps {
  letters: Letter[]
  onLetterDeleted: () => void
}

export function LetterList({ letters, onLetterDeleted }: LetterListProps) {
  const [expandedLetter, setExpandedLetter] = useState<string | null>(null)
  const [deletingLetter, setDeletingLetter] = useState<string | null>(null)
  const [isModalVisible, setIsModalVisible] = useState(false)

  // Handle modal animation timing
  useEffect(() => {
    if (expandedLetter) {
      setIsModalVisible(true)
    } else {
      // Delay hiding to allow fade out animation
      const timer = setTimeout(() => {
        setIsModalVisible(false)
      }, 200)
      return () => clearTimeout(timer)
    }
  }, [expandedLetter])

  const handleDelete = async (letterId: string) => {
    if (!confirm('Are you sure you want to delete this letter? This action cannot be undone.')) {
      return
    }

    try {
      setDeletingLetter(letterId)
      
      const response = await fetch(`/api/letter`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ id: letterId }),
      })

      if (!response.ok) {
        throw new Error('Failed to delete letter')
      }

      onLetterDeleted()
    } catch (err) {
      console.error('Failed to delete letter:', err)
      alert('Failed to delete letter. Please try again.')
    } finally {
      setDeletingLetter(null)
    }
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    })
  }

  const isUnsealDateReached = (unsealDate: string) => {
    return new Date(unsealDate) <= new Date()
  }

  const getLetterStatus = (letter: Letter) => {
    if (letter.isUnsealed) return 'unsealed'
    if (isUnsealDateReached(letter.unsealDate)) return 'ready-to-unseal'
    return 'sealed'
  }

  const getStatusDisplay = (letter: Letter) => {
    const status = getLetterStatus(letter)
    
    switch (status) {
      case 'unsealed':
        return (
          <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-800 font-serif">
            <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            Unsealed
          </span>
        )
      case 'ready-to-unseal':
        return (
          <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-gray-200 text-gray-900 font-serif">
            <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            Ready to Unseal
          </span>
        )
      default:
        return (
          <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-700 font-serif">
            <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
            Sealed
          </span>
        )
    }
  }

  const handleUnseal = async (letterId: string) => {
    try {
      const response = await fetch('/api/letter/unseal', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ id: letterId }),
      })

      if (!response.ok) {
        throw new Error('Failed to unseal letter')
      }

      onLetterDeleted() // Refresh the list
    } catch (err) {
      console.error('Failed to unseal letter:', err)
      alert('Failed to unseal letter. Please try again.')
    }
  }

  if (letters.length === 0) {
    return (
      <div className="text-center py-20">
        <div className="max-w-md mx-auto">
          <div className="w-24 h-24 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <svg className="w-12 h-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 8l7.89 4.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
          </div>
          <h3 className="heading-secondary text-black mb-4">
            No letters yet
          </h3>
          <p className="text-description text-gray-600">
            Write your first letter to your future self and start your journey of self-reflection. Each letter is a time capsule waiting to be discovered.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div>
      <div className="text-center mb-12">
        <h2 className="heading-secondary text-black mb-3">
          Your Time Capsules
        </h2>
        <p className="text-description text-gray-600">
          A collection of your thoughts across time
        </p>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
        {letters.map(letter => {
          const status = getLetterStatus(letter)
          const isExpanded = expandedLetter === letter.id
          
          return (
            <div key={letter.id} className="group">
              {/* Letter Card */}
              <div className="paper-card paper-card-interactive relative">
                {/* Status Badge - Top Right */}
                <div className="absolute top-4 right-4 z-10">
                  {getStatusDisplay(letter)}
                </div>

                {/* Letter Content */}
                <div className="paper-spacing-md">
                  {/* Title */}
                  <div className="mb-6">
                    {letter.title ? (
                      <h3 className="card-title leading-tight pr-20">
                        {letter.title}
                      </h3>
                    ) : (
                      <h3 className="card-title text-gray-400 italic pr-20">
                        Untitled Letter
                      </h3>
                    )}
                  </div>
                  
                  {/* Dates */}
                  <div className="space-y-2 mb-6">
                    <div className="flex items-center text-sm text-gray-500 font-serif">
                      <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                      </svg>
                      Written {formatDate(letter.createdAt)}
                    </div>
                    <div className="flex items-center text-sm text-gray-700 font-serif font-medium">
                      <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                      {status === 'unsealed' ? 'Unsealed' : `Unseals ${formatDate(letter.unsealDate)}`}
                    </div>
                  </div>
                </div>

                {/* Letter Actions */}
                <div className="px-6 pb-6">
                  {status === 'sealed' && (
                    <div className="text-center py-4 bg-gray-50 rounded-xl">
                      <div className="flex items-center justify-center text-sm text-gray-500 font-serif">
                        <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                        </svg>
                        Sealed until {formatDate(letter.unsealDate)}
                      </div>
                    </div>
                  )}

                  {status === 'ready-to-unseal' && !letter.isUnsealed && (
                    <Button
                      onClick={() => handleUnseal(letter.id)}
                      className="btn-primary w-full"
                    >
                      <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                      Unseal Letter
                    </Button>
                  )}

                  {status === 'unsealed' && (
                    <div className="space-y-3">
                      <Button
                        onClick={() => setExpandedLetter(isExpanded ? null : letter.id)}
                        className="btn-primary w-full"
                      >
                        {isExpanded ? (
                          <>
                            <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                            Close
                          </>
                        ) : (
                          <>
                            <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                            </svg>
                            Read Letter
                          </>
                        )}
                      </Button>
                      <Button
                        onClick={() => handleDelete(letter.id)}
                        disabled={deletingLetter === letter.id}
                        className="btn-danger-outline w-full"
                      >
                        {deletingLetter === letter.id ? (
                          <>
                            <svg className="animate-spin -ml-1 mr-3 h-4 w-4" fill="none" viewBox="0 0 24 24">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                            </svg>
                            Deleting...
                          </>
                        ) : (
                          <>
                            <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                            Delete
                          </>
                        )}
                      </Button>
                    </div>
                  )}
                </div>
              </div>

              {/* Expanded Letter Content - Modal Style */}
              {expandedLetter === letter.id && status === 'unsealed' && (
                <Modal 
                  isOpen={isModalVisible} 
                  onClose={() => setExpandedLetter(null)} 
                  maxWidth="4xl" 
                  showCloseButton={false}
                >
                  <div className="paper-card paper-elevated paper-rounded-lg p-8"
                    onClick={e => e.stopPropagation()}
                  >
                    <div className="flex justify-between items-start mb-8">
                      <div>
                        <h3 className="heading-secondary text-black mb-3">
                          {letter.title || 'Letter to Future Self'}
                        </h3>
                        <div className="flex items-center space-x-4 text-sm text-gray-500 font-serif">
                          <span>Written {formatDate(letter.createdAt)}</span>
                          <span>•</span>
                          <span>Unsealed {formatDate(letter.unsealDate)}</span>
                        </div>
                      </div>
                      <Button
                        onClick={() => setExpandedLetter(null)}
                        className="bg-gray-100 hover:bg-gray-200 text-gray-600 p-3 rounded-full transition-all duration-200"
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </Button>
                    </div>
                    
                    <div className="paper-card paper-subtle border-gray-300">
                      <div className="writing-text whitespace-pre-wrap leading-relaxed">
                        {letter.content}
                      </div>
                    </div>
                  </div>
                </Modal>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}