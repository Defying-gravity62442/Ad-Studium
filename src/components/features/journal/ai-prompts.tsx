'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { Lightbulb, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useAIPrompts } from '@/hooks/useAIPrompts'
import { useE2EE } from '@/hooks/useE2EE'

interface AiPromptsProps {
  onPromptSelect?: (prompt: string) => void
}

export function AiPrompts({ onPromptSelect }: AiPromptsProps) {
  const { data: session, status } = useSession()
  const { hasKey, isReady } = useE2EE()
  const [prompts, setPrompts] = useState<string[]>([])
  const [error, setError] = useState<string | null>(null)
  const { generateAIPrompts, isGenerating } = useAIPrompts()

  const fetchPrompts = async () => {
    setError(null)
    
    try {
      const generatedPrompts = await generateAIPrompts()
      setPrompts(generatedPrompts)
    } catch (error) {
      console.error('Failed to fetch AI prompts:', error)
      setError('Failed to load writing prompts')
    }
  }

  useEffect(() => {
    console.log('AiPrompts: Checking readiness:', {
      status,
      hasSession: !!session,
      hasKey,
      isReady
    })
    
    // Only fetch prompts when session is authenticated and E2EE is ready
    if (status === 'authenticated' && session && hasKey && isReady) {
      console.log('AiPrompts: Ready to fetch prompts')
      fetchPrompts()
    }
  }, [status, session, hasKey, isReady])

  const handlePromptClick = (prompt: string) => {
    onPromptSelect?.(prompt)
  }

  // Show loading state while session or E2EE is not ready
  if (status === 'loading' || !isReady) {
    return (
      <div className="paper-card paper-elevated p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Lightbulb className="w-5 h-5 text-gray-600" />
            <h3 className="font-medium text-black font-serif">Writing Prompts</h3>
          </div>
        </div>
        <div className="space-y-3">
          <div className="h-4 bg-gray-200 rounded animate-pulse"></div>
          <div className="h-4 bg-gray-200 rounded animate-pulse w-3/4"></div>
          <div className="h-4 bg-gray-200 rounded animate-pulse w-1/2"></div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="paper-card paper-elevated p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Lightbulb className="w-5 h-5 text-gray-600" />
            <h3 className="font-medium text-black font-serif">Writing Prompts</h3>
          </div>
          <Button
            onClick={fetchPrompts}
            variant="outline"
            size="sm"
            className="text-xs"
          >
            <RefreshCw className="w-3 h-3 mr-1" />
            Retry
          </Button>
        </div>
        <p className="text-sm text-gray-600 font-serif">{error}</p>
      </div>
    )
  }

  return (
    <div className="paper-card paper-elevated p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Lightbulb className="w-5 h-5 text-gray-600" />
          <h3 className="font-medium text-black font-serif">Writing Prompts</h3>
        </div>
        <Button
          onClick={fetchPrompts}
          variant="outline"
          size="sm"
          disabled={isGenerating}
          className="text-xs"
        >
          <RefreshCw className={`w-3 h-3 mr-1 ${isGenerating ? 'animate-spin' : ''}`} />
          {isGenerating ? 'Loading...' : 'Refresh'}
        </Button>
      </div>
      
      {isGenerating ? (
        <div className="space-y-3">
          <div className="h-4 bg-gray-200 rounded animate-pulse"></div>
          <div className="h-4 bg-gray-200 rounded animate-pulse w-3/4"></div>
          <div className="h-4 bg-gray-200 rounded animate-pulse w-1/2"></div>
        </div>
      ) : prompts.length > 0 ? (
        <div className="space-y-3">
          {prompts.map((prompt, index) => (
            <button
              key={index}
              onClick={() => handlePromptClick(prompt)}
              className="w-full text-left p-3 rounded-lg border border-gray-200 hover:border-gray-300 hover:bg-gray-50 transition-colors"
            >
              <p className="text-sm text-gray-700 font-serif leading-relaxed">
                {prompt}
              </p>
            </button>
          ))}
        </div>
      ) : (
        <p className="text-sm text-gray-500 font-serif">
          No writing prompts available. Click refresh to generate new ones.
        </p>
      )}
    </div>
  )
} 