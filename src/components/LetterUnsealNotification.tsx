import { useState, useEffect } from 'react'
import { useE2EE } from '@/hooks/useE2EE'
import { Modal } from '@/components/ui/modal'

interface Letter {
  id: string
  title: string | null
  unsealDate: string
  isSealed: boolean
  isUnsealed: boolean
}

interface LetterUnsealNotificationProps {
  onClose: () => void
  onUnseal: (letterId: string) => void
}

export function LetterUnsealNotification({ onClose, onUnseal }: LetterUnsealNotificationProps) {
  const { decryptSafely, hasKey } = useE2EE()
  const [readyLetters, setReadyLetters] = useState<Letter[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!hasKey) return
    
    const checkForReadyLetters = async () => {
      try {
        setLoading(true)
        const response = await fetch('/api/letter')
        
        if (!response.ok) {
          throw new Error('Failed to fetch letters')
        }

        const encryptedLetters = await response.json()
        
        // Decrypt letters and filter for ready-to-unseal ones
        const decryptedLetters = await Promise.all(
          encryptedLetters.map(async (letter: Record<string, unknown>) => {
            let decryptedTitle = 'Letter to Future Self'
            if (letter.title) {
              try {
                const decrypted = await decryptSafely(letter.title as string)
                if (decrypted) {
                  decryptedTitle = decrypted
                }
              } catch (error) {
                console.warn('Could not decrypt letter title:', error)
              }
            }
            return {
              id: letter.id,
              title: decryptedTitle,
              unsealDate: letter.unsealDate,
              isSealed: letter.isSealed,
              isUnsealed: letter.isUnsealed
            }
          })
        )
        
        // Filter for letters that are ready to unseal (past unseal date but not yet unsealed)
        const now = new Date()
        const ready = decryptedLetters.filter(letter => 
          letter.isSealed && 
          !letter.isUnsealed && 
          new Date(letter.unsealDate) <= now
        )
        
        setReadyLetters(ready)
      } catch (error) {
        console.error('Failed to check for ready letters:', error)
      } finally {
        setLoading(false)
      }
    }

    checkForReadyLetters()
  }, [hasKey, decryptSafely])

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    })
  }

  if (loading) {
    return null
  }

  if (readyLetters.length === 0) {
    return null
  }

  return (
    <Modal isOpen={true} onClose={onClose} maxWidth="md" showCloseButton={false}>
      <div className="p-6">
        <div className="text-center mb-6">
          <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-gray-100 mb-4">
            <svg className="h-6 w-6 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 4.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
          </div>
          
          <h3 className="text-lg font-semibold text-gray-900 mb-2">
            Letter{readyLetters.length > 1 ? 's' : ''} Ready to Unseal
          </h3>
          
          <p className="text-sm text-gray-600">
            You have {readyLetters.length} letter{readyLetters.length > 1 ? 's' : ''} from your past self that {readyLetters.length > 1 ? 'are' : 'is'} ready to be unsealed.
          </p>
        </div>

        <div className="space-y-3 mb-6">
          {readyLetters.map((letter) => (
            <div key={letter.id} className="bg-gray-50 rounded-lg p-4">
              <h4 className="font-medium text-gray-900 mb-1">
                {letter.title}
              </h4>
              <p className="text-sm text-gray-600 mb-3">
                Ready since {formatDate(letter.unsealDate)}
              </p>
              <button
                onClick={() => onUnseal(letter.id)}
                className="w-full btn-primary text-sm"
              >
                Unseal Letter
              </button>
            </div>
          ))}
        </div>

        <div className="flex justify-center">
          <button
            onClick={onClose}
            className="text-gray-600 hover:text-gray-800 transition-colors text-sm"
          >
            Close
          </button>
        </div>
      </div>
    </Modal>
  )
} 