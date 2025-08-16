'use client'

import { useState } from 'react'
import { Button } from '@/components/ui'
import { Sparkles, RefreshCw } from 'lucide-react'

interface AIPrompt {
  id: string
  text: string
  category: 'reflection' | 'goals' | 'gratitude' | 'growth'
}

interface AIPromptProps {
  onPromptSelect?: (prompt: string) => void
}

export function AIPrompt({ onPromptSelect }: AIPromptProps) {
  const [prompts, setPrompts] = useState<AIPrompt[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const generatePrompts = async () => {
    setIsLoading(true)
    setError(null)
    
    try {
      const response = await fetch('/api/journal/ai-prompts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        }
      })

      if (!response.ok) {
        throw new Error('Failed to generate prompts')
      }

      const data = await response.json()
      setPrompts(data.prompts)
    } catch (error) {
      console.error('Failed to generate AI prompts:', error)
      setError('Unable to generate prompts right now. Please try again.')
    } finally {
      setIsLoading(false)
    }
  }

  const handlePromptClick = (prompt: AIPrompt) => {
    if (onPromptSelect) {
      onPromptSelect(prompt.text)
    }
  }

  const getCategoryColor = (category: AIPrompt['category']) => {
    switch (category) {
      case 'reflection': return 'border-l-gray-400'
      case 'goals': return 'border-l-gray-600'
      case 'gratitude': return 'border-l-gray-500'
      case 'growth': return 'border-l-gray-700'
      default: return 'border-l-gray-400'
    }
  }

  const getCategoryLabel = (category: AIPrompt['category']) => {
    switch (category) {
      case 'reflection': return 'Reflection'
      case 'goals': return 'Goals'
      case 'gratitude': return 'Gratitude'
      case 'growth': return 'Growth'
      default: return 'Prompt'
    }
  }

  return (
    <div className="bg-gray-50 border border-gray-200 rounded-lg p-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-gray-600" />
          <h3 className="text-lg font-semibold text-black" style={{ fontFamily: 'Hepta Slab, serif' }}>
            AI Writing Prompts
          </h3>
        </div>
        <Button
          onClick={generatePrompts}
          disabled={isLoading}
          variant="outline"
          size="sm"
        >
          {isLoading ? (
            <>
              <RefreshCw className="w-4 h-4 mr-1 animate-spin" />
              Generating...
            </>
          ) : (
            <>
              <Sparkles className="w-4 h-4 mr-1" />
              Get Prompts
            </>
          )}
        </Button>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded p-3 mb-4">
          <p className="text-red-700 text-sm">{error}</p>
        </div>
      )}

      {prompts.length === 0 && !isLoading && !error && (
        <p className="text-gray-600 text-center py-8" style={{ fontFamily: 'Hepta Slab, serif' }}>
          Click &quot;Get Prompts&quot; to receive personalized writing inspiration based on your calendar and progress.
        </p>
      )}

      {prompts.length > 0 && (
        <div className="space-y-3">
          {prompts.map((prompt) => (
            <div
              key={prompt.id}
              className={`bg-white border-l-4 ${getCategoryColor(prompt.category)} p-4 rounded-r-lg cursor-pointer hover:shadow-sm transition-shadow`}
              onClick={() => handlePromptClick(prompt)}
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="text-xs text-gray-500 mb-1 uppercase tracking-wide">
                    {getCategoryLabel(prompt.category)}
                  </div>
                  <p className="text-gray-800 leading-relaxed" style={{ fontFamily: 'Hepta Slab, serif' }}>
                    {prompt.text}
                  </p>
                </div>
                <div className="text-gray-400 text-sm ml-4">
                  Click to use
                </div>
              </div>
            </div>
          ))}
          
          <div className="pt-2 border-t border-gray-200">
            <Button
              onClick={generatePrompts}
              variant="ghost"
              size="sm"
              className="w-full"
            >
              <RefreshCw className="w-4 h-4 mr-1" />
              Generate New Prompts
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}