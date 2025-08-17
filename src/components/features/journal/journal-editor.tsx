'use client'

import { useState, useEffect, useCallback } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { useAutoSave } from '@/hooks/useAutoSave'

interface JournalEditorProps {
  initialContent?: string
  onAutoSave?: (content: string) => void
  content?: string
  onContentChange?: (content: string) => void
  isPreviewMode?: boolean
  onPreviewModeChange?: (isPreview: boolean) => void
  lastSaved?: Date | null
  isSaving?: boolean
}

export function JournalEditor({ 
  initialContent = '', 
  onAutoSave,
  content: externalContent,
  onContentChange,
  isPreviewMode: externalPreviewMode,
  onPreviewModeChange,
  lastSaved: externalLastSaved,
  isSaving: externalIsSaving
}: JournalEditorProps) {
  const [content, setContent] = useState(initialContent)
  const [internalPreviewMode, setInternalPreviewMode] = useState(false)
  
  // Use external state if provided, otherwise use internal state
  const isPreviewMode = externalPreviewMode !== undefined ? externalPreviewMode : internalPreviewMode
  const setIsPreviewMode = (value: boolean) => {
    if (onPreviewModeChange) {
      onPreviewModeChange(value)
    } else {
      setInternalPreviewMode(value)
    }
  }

  // Update content when external content changes
  useEffect(() => {
    if (externalContent !== undefined) {
      setContent(externalContent)
    }
  }, [externalContent])

  // Memoize the autosave function
  const handleAutoSave = useCallback(async (content: string) => {
    if (onAutoSave) {
      await onAutoSave(content)
    }
  }, [onAutoSave])

  // Use the autosave hook
  const { isSaving, lastSaved } = useAutoSave({
    content,
    onSave: handleAutoSave,
    enabled: !!onAutoSave,
    debounceMs: 2000
  })

  const handleContentChange = (newContent: string) => {
    setContent(newContent)
    onContentChange?.(newContent)
  }

  return (
    <div className="journal-layout">
      <div className="journal-content writing-surface paper-texture">
        {isPreviewMode ? (
          <div className="journal-preview text-responsive-base">
            <ReactMarkdown 
              remarkPlugins={[remarkGfm]}
              components={{
                h1: ({ children }) => <h1 className="text-2xl font-bold mb-4 text-black font-serif">{children}</h1>,
                h2: ({ children }) => <h2 className="text-xl font-semibold mb-3 text-black font-serif">{children}</h2>,
                h3: ({ children }) => <h3 className="text-lg font-medium mb-2 text-black font-serif">{children}</h3>,
                p: ({ children }) => <p className="mb-4 text-gray-800 leading-relaxed font-serif">{children}</p>,
                ul: ({ children }) => <ul className="mb-4 ml-6 list-disc text-gray-800">{children}</ul>,
                ol: ({ children }) => <ol className="mb-4 ml-6 list-decimal text-gray-800">{children}</ol>,
                li: ({ children }) => <li className="mb-1 font-serif">{children}</li>,
                blockquote: ({ children }) => <blockquote className="border-l-4 border-gray-300 pl-4 mb-4 italic text-gray-700 font-serif">{children}</blockquote>,
                code: ({ children }) => <code className="bg-gray-100 px-1 py-0.5 rounded text-sm font-mono">{children}</code>,
                pre: ({ children }) => <pre className="bg-gray-100 p-3 rounded mb-4 overflow-x-auto font-mono text-sm">{children}</pre>
              }}
            >
              {content || '*Start writing your journal entry...*'}
            </ReactMarkdown>
          </div>
        ) : (
          <textarea
            value={content}
            onChange={(e) => handleContentChange(e.target.value)}
            placeholder="Start writing your journal entry...

You can use Markdown formatting:
# Heading 1
## Heading 2
**bold text** or *italic text*
- Bullet points
1. Numbered lists
> Blockquotes
`code snippets`"
            className="journal-textarea"
          />
        )}
      </div>
    </div>
  )
}