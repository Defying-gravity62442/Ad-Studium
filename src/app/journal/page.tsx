'use client'

import { useState, useEffect } from 'react'
import { JournalEditor, AiCompanion, AiPrompts } from '@/components/features/journal'
import { useE2EE } from '@/hooks/useE2EE'
import { Button } from '@/components/ui'
import { Eye, Edit3, PenTool, Lock, AlertTriangle } from 'lucide-react'

export default function JournalPage() {
  const [isLoading, setIsLoading] = useState(true)
  const [journalContent, setJournalContent] = useState('')
  const [journalId, setJournalId] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [lastSaved, setLastSaved] = useState<Date | null>(null)
  const [isCompanionOpen, setIsCompanionOpen] = useState(false)
  const [userAssistantName, setUserAssistantName] = useState('Claude')
  const [isPreviewMode, setIsPreviewMode] = useState(false)
  const [currentDate] = useState(new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  }))

  const { isReady, hasKey, encrypt, decrypt, error: e2eeError } = useE2EE()

  // Load today's journal and user customization on mount
  useEffect(() => {
    if (isReady && hasKey) {
      loadTodaysJournal()
      loadUserCustomization()
    } else if (isReady && !hasKey) {
      // User needs to unlock or set up E2EE
      console.warn('No encryption key available')
      setIsLoading(false)
    }
  }, [isReady, hasKey, decrypt])

  const loadUserCustomization = async () => {
    try {
      const response = await fetch('/api/user/customization')
      if (response.ok) {
        const data = await response.json()
        if (data.customization?.aiAssistantName && hasKey) {
          try {
            // Parse and decrypt the aiAssistantName
            const decryptedName = await decrypt(JSON.parse(data.customization.aiAssistantName))
            setUserAssistantName(decryptedName)
          } catch (decryptError) {
            console.error('Failed to decrypt aiAssistantName:', decryptError)
            // Fallback to default name
            setUserAssistantName('Claude')
          }
        }
      }
    } catch (error) {
      console.error('Failed to load user customization:', error)
    }
  }

  const loadTodaysJournal = async () => {
    if (!hasKey) {
      console.error('No encryption key available')
      setIsLoading(false)
      return
    }

    try {
      const response = await fetch('/api/journal/today')
      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to load journal')
      }

      if (data.journal) {
        console.log('Received journal data:', {
          contentType: typeof data.journal.content,
          contentKeys: data.journal.content ? Object.keys(data.journal.content) : 'null',
          contentSample: data.journal.content
        })

        // Handle different data formats for backward compatibility
        let contentToDecrypt = data.journal.content

        // Check if content is a string (old format) and try to parse it
        if (typeof data.journal.content === 'string') {
          try {
            contentToDecrypt = JSON.parse(data.journal.content)
            console.log('Parsed string content to object:', contentToDecrypt)
          } catch (parseError) {
            console.error('Failed to parse string content as JSON:', parseError)
            throw new Error('Unable to parse journal content format')
          }
        }

        // Validate the encrypted data format
        if (!contentToDecrypt || 
            typeof contentToDecrypt !== 'object' ||
            !contentToDecrypt.data ||
            !contentToDecrypt.iv ||
            !contentToDecrypt.salt ||
            !contentToDecrypt.tag) {
          console.error('Invalid encrypted data structure:', {
            hasContent: !!contentToDecrypt,
            type: typeof contentToDecrypt,
            hasData: !!(contentToDecrypt && contentToDecrypt.data),
            hasIv: !!(contentToDecrypt && contentToDecrypt.iv),
            hasSalt: !!(contentToDecrypt && contentToDecrypt.salt),
            hasTag: !!(contentToDecrypt && contentToDecrypt.tag)
          })
          throw new Error('Invalid encrypted data format received from server')
        }

        // Decrypt the journal content
        const decryptedContent = await decrypt(contentToDecrypt)
        
        // Ensure the decrypted content is a string
        if (typeof decryptedContent !== 'string') {
          console.error('Decryption returned non-string content:', {
            type: typeof decryptedContent,
            value: decryptedContent
          })
          throw new Error('Decryption failed: expected string but got ' + typeof decryptedContent)
        }
        
        console.log('Successfully decrypted journal content, length:', decryptedContent.length)
        setJournalContent(decryptedContent)
        setJournalId(data.journal.id)
      }
      
      setIsLoading(false)
    } catch (error) {
      console.error('Failed to load journal:', error)
      console.error('Error details:', {
        message: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined
      })
      setIsLoading(false)
    }
  }

  const handleAutoSave = async (content: string) => {
    console.log('handleAutoSave called with content length:', content.length)
    if (!hasKey || isSaving || !content.trim()) return

    try {
      // Encrypt the content before sending
      const encryptedContent = await encrypt(content)
      
      const response = await fetch('/api/journal/save', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          content: encryptedContent,
          title: null,
          mood: null,
          tags: []
        })
      })

      const data = await response.json()

      if (response.ok) {
        console.log('Autosave successful')
        setJournalId(data.journal.id)
        setLastSaved(new Date())
      }
    } catch (error) {
      console.error('Failed to auto-save journal:', error)
      // Don't throw error for autosave failures
    }
  }

  if (isLoading) {
    return (
      <div className="page-container paper-texture">
        <div className="content-wrapper-7xl">
          <div className="paper-loading">
            <div className="paper-loading-spinner"></div>
            <div className="loading-text text-elegant ml-3">Loading your journal...</div>
          </div>
        </div>
      </div>
    )
  }

  if (isReady && !hasKey) {
    return (
      <div className="page-container paper-texture">
        <div className="content-wrapper-4xl">
          <div className="paper-empty">
            <div className="paper-empty-icon">
              <Lock className="h-8 w-8 text-gray-400" />
            </div>
            <div className="paper-empty-title text-elegant">Encryption Required</div>
            <div className="paper-empty-description text-elegant">
              Your journal entries are protected with end-to-end encryption. Please set up or unlock your encryption key to continue.
            </div>
            <div className="paper-alert paper-alert-warning mt-6">
              <p className="text-elegant">
                Visit your Dashboard or Settings to complete encryption setup.
              </p>
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (e2eeError) {
    return (
      <div className="page-container paper-texture">
        <div className="content-wrapper-4xl">
          <div className="paper-empty">
            <div className="paper-empty-icon">
              <AlertTriangle className="h-8 w-8 text-gray-400" />
            </div>
            <div className="paper-empty-title text-elegant">Encryption Error</div>
            <div className="paper-empty-description text-elegant">
              {e2eeError}
            </div>
            <button
              onClick={() => window.location.reload()}
              className="btn-primary mt-6"
            >
              Reload Page
            </button>
          </div>
        </div>
      </div>
    )
  }

  // Ensure journalContent is always a string to prevent React rendering errors
  const safeJournalContent = typeof journalContent === 'string' ? journalContent : ''
  const safeUserAssistantName = typeof userAssistantName === 'string' ? userAssistantName : 'Claude'

  // Debug logging to identify the issue
  if (typeof journalContent !== 'string') {
    console.error('journalContent is not a string:', {
      type: typeof journalContent,
      value: journalContent
    })
  }

  if (typeof userAssistantName !== 'string') {
    console.error('userAssistantName is not a string:', {
      type: typeof userAssistantName,
      value: userAssistantName
    })
  }

  return (
    <div className="page-container paper-texture">
      <div className="content-wrapper-7xl">
        {/* Header Section */}
        <div className="paper-header">
          <div className="flex items-center gap-4 mb-6">
            <div className="w-16 h-16 bg-gray-100 rounded-2xl flex items-center justify-center shadow-lg flex-shrink-0">
              <PenTool className="h-8 w-8 text-gray-600" />
            </div>
            <div>
              <h1 className="heading-primary text-elegant">
                Today&apos;s Journal
              </h1>
              <p className="text-paper-secondary text-lg text-elegant">
                {currentDate}
              </p>
            </div>
          </div>
        </div>

        {/* AI Writing Prompts */}
        <div className="space-y-6 mb-8">
          <AiPrompts
            onPromptSelect={(prompt) => {
              // Add the selected prompt to the journal content
              const newContent = safeJournalContent + (safeJournalContent ? '\n\n' : '') + prompt
              setJournalContent(newContent)
            }}
          />
        </div>

        {/* Journal Editor and AI Companion side by side */}
        <div className="paper-grid-2">
          {/* Journal Editor */}
          <div className="paper-card paper-elevated h-[700px] flex flex-col">
            <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center p-4 space-y-3 sm:space-y-0">
              <h2 className="text-lg font-semibold text-paper text-elegant">Journal Space</h2>
              <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4">
                <div className="text-xs sm:text-sm text-paper-secondary text-elegant">
                  {lastSaved && `Last saved: ${lastSaved.toLocaleTimeString()}`}
                  {isSaving && 'Saving...'}
                </div>
                <Button
                  onClick={() => setIsPreviewMode(!isPreviewMode)}
                  variant="outline"
                  size="sm"
                  className="text-sm text-elegant"
                >
                  {isPreviewMode ? (
                    <>
                      <Edit3 className="w-4 h-4 mr-1" />
                      <span className="hidden sm:inline">Edit</span>
                    </>
                  ) : (
                    <>
                      <Eye className="w-4 h-4 mr-1" />
                      <span className="hidden sm:inline">Preview</span>
                    </>
                  )}
                </Button>
              </div>
            </div>
            <div className="flex-1 min-h-0 pt-2">
              <JournalEditor
                content={safeJournalContent}
                onContentChange={setJournalContent}
                onAutoSave={handleAutoSave}
                isPreviewMode={isPreviewMode}
                onPreviewModeChange={setIsPreviewMode}
                lastSaved={lastSaved}
                isSaving={isSaving}
              />
            </div>
          </div>

          {/* AI Companion */}
          <div className="paper-card h-[700px]">
            <AiCompanion
              journalContent={safeJournalContent}
              userPreferredName={safeUserAssistantName}
              isOpen={true}
              onClose={() => setIsCompanionOpen(false)}
              journalId={journalId || undefined}
            />
          </div>
        </div>
      </div>
    </div>
  )
}