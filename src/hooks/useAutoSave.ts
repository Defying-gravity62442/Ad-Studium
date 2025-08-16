import { useState, useEffect, useCallback, useRef } from 'react'

interface UseAutoSaveOptions {
  content: string
  onSave: (content: string) => Promise<void>
  debounceMs?: number
  enabled?: boolean
}

interface UseAutoSaveReturn {
  isSaving: boolean
  lastSaved: Date | null
  saveManually: () => Promise<void>
}

export function useAutoSave({
  content,
  onSave,
  debounceMs = 2000,
  enabled = true
}: UseAutoSaveOptions): UseAutoSaveReturn {
  const [isSaving, setIsSaving] = useState(false)
  const [lastSaved, setLastSaved] = useState<Date | null>(null)
  const lastSavedContentRef = useRef<string>('')

  const saveContent = useCallback(async () => {
    if (!content.trim() || !enabled) {
      return
    }

    // Only save if content has actually changed
    if (content === lastSavedContentRef.current) {
      return
    }

    setIsSaving(true)
    try {
      await onSave(content)
      setLastSaved(new Date())
      lastSavedContentRef.current = content
    } catch (error) {
      console.error('Error auto-saving content:', error)
    } finally {
      setIsSaving(false)
    }
  }, [content, onSave, enabled])

  // Auto-save with debounce
  useEffect(() => {
    if (!content.trim() || !enabled) {
      return
    }

    // Only set up timer if content has changed from last saved
    if (content === lastSavedContentRef.current) {
      return
    }

    const timeoutId = setTimeout(saveContent, debounceMs)
    return () => {
      clearTimeout(timeoutId)
    }
  }, [content, enabled, saveContent, debounceMs])

  return {
    isSaving,
    lastSaved,
    saveManually: saveContent
  }
} 