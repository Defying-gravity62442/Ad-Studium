'use client'

import { useState, useEffect, useMemo } from 'react'
import { useE2EE } from '@/hooks/useE2EE'
import { Modal } from '@/components/ui/modal'
import { ErrorModal } from '@/components/ui/error-modal'
import { extractTextFromPDF } from '@/lib/pdf-parser'
import { calculateUniquePages } from '@/lib/utils/reading-progress'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import remarkMath from 'remark-math'
import rehypeKatex from 'rehype-katex'
import { EncryptedData } from '@/lib/client-encryption'
import { BookOpen, Upload, FileText, Brain, Plus, Calendar, Clock, Eye, CheckCircle, Loader2, Sparkles, X, Trash2, Lock, AlertTriangle } from 'lucide-react'

interface Reading {
  id: string
  docToken: string
  title: EncryptedData | null
  uploadDate: string
  reflections: unknown[]
  readingLogs: ReadingLog[]
  totalPages: number | null
  decryptedTitle?: string
}

interface ReadingLog {
  id: string
  startPage: EncryptedData | null
  endPage: EncryptedData | null
  notes: EncryptedData | null
  sessionDate: EncryptedData | null
  decryptedStartPage?: number
  decryptedEndPage?: number
  decryptedNotes?: string
  decryptedSessionDate?: string
}

interface DecryptedReading extends Reading {
  decryptedTitle: string
  readingLogs: DecryptedReadingLog[]
}

interface DecryptedReadingLog extends ReadingLog {
  decryptedStartPage: number
  decryptedEndPage: number
  decryptedNotes?: string
  decryptedSessionDate: string
}

export default function ReadingReflectionPage() {
  const MAX_SELECTION = 8
  const [isLoading, setIsLoading] = useState(true)
  const [readings, setReadings] = useState<DecryptedReading[]>([])
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [isUploading, setIsUploading] = useState(false)
  const [activeTab, setActiveTab] = useState<'overview' | 'reflect'>('overview')
  const [selectedReading, setSelectedReading] = useState<DecryptedReading | null>(null)
  const [readingLogForm, setReadingLogForm] = useState({
    startPage: '',
    endPage: '',
    notes: '',
    sessionDate: new Date().toISOString().split('T')[0]
  })
  const [isSubmittingLog, setIsSubmittingLog] = useState(false)
  const [selectedReadingLogsForReflection, setSelectedReadingLogsForReflection] = useState<string[]>([])
  const [isGeneratingReflection, setIsGeneratingReflection] = useState(false)
  const [lastReflection, setLastReflection] = useState<string | null>(null)
  const [socraticQuestions, setSocraticQuestions] = useState<string[]>([])
  const [task2Questions, setTask2Questions] = useState<string[]>([])
  const [lastReflectionId, setLastReflectionId] = useState<string | null>(null)
  type ReflectionUserAnswers = { socratic: string[]; task2: string[] }
  interface ReflectionStructuredData {
    socraticQuestions?: string[]
    extensionQuestions?: string[]
    userAnswers?: ReflectionUserAnswers
    [key: string]: any
  }
  const [, setStructuredData] = useState<ReflectionStructuredData | null>(null)
  const [showAnswerForIndex, setShowAnswerForIndex] = useState<Record<string, boolean>>({})
  const [answersByIndex, setAnswersByIndex] = useState<Record<string, string>>({})
  const [saveStatusByIndex, setSaveStatusByIndex] = useState<Record<string, 'idle' | 'saving' | 'saved' | 'error'>>({})
  const [analysisType, setAnalysisType] = useState<'cross-contextual' | 'temporal-progression' | 'beyond-the-reading' | null>(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [filterStatus, setFilterStatus] = useState<'all' | 'active' | 'completed'>('all')
  const [showUploadModal, setShowUploadModal] = useState(false)
  const [showLogModal, setShowLogModal] = useState(false)
  const [deletingReadingId, setDeletingReadingId] = useState<string | null>(null)
  const [userAssistantName, setUserAssistantName] = useState<string>('Claude')
  const [isDragOver, setIsDragOver] = useState(false)
  const [errorModal, setErrorModal] = useState<{ isOpen: boolean; title: string; message: string }>({ isOpen: false, title: '', message: '' })

  const { isReady, hasKey, encrypt, decryptSafely, error: e2eeError } = useE2EE()

  useEffect(() => {
    if (isReady && hasKey) {
      loadReadings()
      loadUserCustomization()
    } else if (isReady && !hasKey) {
      console.warn('No encryption key available')
      setIsLoading(false)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isReady, hasKey])

  const loadUserCustomization = async () => {
    try {
      const response = await fetch('/api/user/customization')
      if (response.ok) {
        const data = await response.json()
        if (data.customization?.aiAssistantName && hasKey) {
          try {
            // Parse and decrypt the aiAssistantName
            const decryptedName = await decryptSafely(JSON.parse(data.customization.aiAssistantName))
            setUserAssistantName(decryptedName || 'Claude')
          } catch {
            console.error('Failed to decrypt aiAssistantName')
            // Fallback to default name
            setUserAssistantName('Claude')
          }
        }
      }
    } catch {
      console.error('Failed to load user customization')
    }
  }

  const loadReadings = async () => {
    if (!hasKey) {
      console.error('No encryption key available')
      setIsLoading(false)
      return
    }

    console.log('🔧 Reading Progress Fix: Using unique page calculation to prevent overlap counting')

    try {
      const response = await fetch('/api/reading')
      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to load readings')
      }

      const decryptedReadings = await Promise.all(
        data.readings.map(async (reading: Reading) => {
          let decryptedTitle = 'Untitled Document'
          
          if (reading.title) {
            try {
              decryptedTitle = await decryptSafely(reading.title) || 'Encrypted Document'
            } catch {
              console.warn('Failed to decrypt title for reading:', reading.id)
              decryptedTitle = 'Encrypted Document'
            }
          }
          
          const decryptedReadingLogs = await Promise.all(
            (reading.readingLogs || []).map(async (log: ReadingLog) => {
              const decryptedLog = { ...log }
              
              try {
                if (log.startPage) {
                  try {
                    const decryptedStartPage = await decryptSafely(log.startPage)
                    if (decryptedStartPage) {
                      const pageNum = parseInt(decryptedStartPage)
                      if (!isNaN(pageNum) && pageNum > 0) {
                        decryptedLog.decryptedStartPage = pageNum
                      }
                    }
                  } catch {
                    console.warn('Failed to decrypt start page for log:', log.id)
                  }
                }
                if (log.endPage) {
                  try {
                    const decryptedEndPage = await decryptSafely(log.endPage)
                    if (decryptedEndPage) {
                      const pageNum = parseInt(decryptedEndPage)
                      if (!isNaN(pageNum) && pageNum > 0) {
                        decryptedLog.decryptedEndPage = pageNum
                      }
                    }
                  } catch {
                    console.warn('Failed to decrypt end page for log:', log.id)
                  }
                }
                if (log.notes) {
                  try {
                    const decryptedNotes = await decryptSafely(log.notes)
                    decryptedLog.decryptedNotes = decryptedNotes || undefined
                  } catch {
                    console.warn('Failed to decrypt notes for log:', log.id)
                  }
                }
                if (log.sessionDate) {
                  try {
                    const decryptedSessionDate = await decryptSafely(log.sessionDate)
                    decryptedLog.decryptedSessionDate = decryptedSessionDate || undefined
                  } catch {
                    console.warn('Failed to decrypt session date for log:', log.id)
                  }
                }
              } catch {}
              
              return decryptedLog
            })
          )
          
          return { 
            ...reading, 
            decryptedTitle,
            readingLogs: decryptedReadingLogs
          }
        })
      )

      setReadings(decryptedReadings)
      setIsLoading(false)
    } catch (error) {
      console.error('Failed to load readings:', error)
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred'
      setErrorModal({ isOpen: true, title: 'Failed to Load Readings', message: `${errorMessage}. Please check your encryption key and try again.` })
      setIsLoading(false)
    }
  }

  const handleFileUpload = async () => {
    if (!selectedFile || !hasKey || isUploading) return

    const maxSizeInBytes = 10 * 1024 * 1024
    if (selectedFile.size > maxSizeInBytes) {
      setErrorModal({ isOpen: true, title: 'File Too Large', message: 'Please select a PDF file smaller than 10MB.' })
      return
    }

    if (selectedFile.type !== 'application/pdf') {
      setErrorModal({ isOpen: true, title: 'Invalid File Type', message: 'Please select a valid PDF file.' })
      return
    }

    setIsUploading(true)
    try {
      const extractionResult = await extractTextFromPDF(selectedFile)

      if (extractionResult.chunks.length === 0) {
        throw new Error('No text content could be extracted from the PDF. Please ensure the PDF contains readable text and is not password-protected or corrupted.')
      }

      const response = await fetch('/api/reading/upload-chunks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chunks: extractionResult.chunks,
          filename: selectedFile.name,
          title: selectedFile.name.replace('.pdf', ''),
          totalPages: extractionResult.totalPages
        })
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to process document')
      }

      const encryptedTitle = await encrypt(data.reading.originalTitle)
      
      const updateResponse = await fetch(`/api/reading/${data.reading.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          encryptedTitle: encryptedTitle
        })
      })

      if (updateResponse.ok) {
        setSelectedFile(null)
        setShowUploadModal(false)
        await loadReadings()
      }
    } catch (error) {
      console.error('Failed to upload document:', error)
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred'
      setErrorModal({ isOpen: true, title: 'Upload Failed', message: `Failed to upload document: ${errorMessage}` })
    } finally {
      setIsUploading(false)
    }
  }

  const handleReadingLogSubmit = async () => {
    if (!selectedReading || !hasKey || isSubmittingLog) return
    
    const { startPage, endPage, notes, sessionDate } = readingLogForm
    
    if (!startPage || !endPage) {
      setErrorModal({ isOpen: true, title: 'Missing Information', message: 'Please enter both start and end page numbers.' })
      return
    }

    const startPageNum = parseInt(startPage)
    const endPageNum = parseInt(endPage)

    if (isNaN(startPageNum) || isNaN(endPageNum) || startPageNum < 1 || endPageNum < 1) {
      setErrorModal({ isOpen: true, title: 'Invalid Page Numbers', message: 'Please enter valid page numbers (must be positive integers).' })
      return
    }

    if (startPageNum > endPageNum) {
      setErrorModal({ isOpen: true, title: 'Invalid Page Range', message: 'Start page must be less than or equal to end page.' })
      return
    }

    // Validate against total pages if available
    if (selectedReading.totalPages) {
      if (startPageNum > selectedReading.totalPages) {
        setErrorModal({ isOpen: true, title: 'Page Out of Range', message: `Start page (${startPageNum}) cannot exceed the total number of pages in this document (${selectedReading.totalPages}).` })
        return
      }
      if (endPageNum > selectedReading.totalPages) {
        setErrorModal({ isOpen: true, title: 'Page Out of Range', message: `End page (${endPageNum}) cannot exceed the total number of pages in this document (${selectedReading.totalPages}).` })
        return
      }
    }

    setIsSubmittingLog(true)
    try {
      const encryptedStartPage = await encrypt(startPage)
      const encryptedEndPage = await encrypt(endPage)
      const encryptedSessionDate = await encrypt(sessionDate)
      const encryptedNotes = notes.trim() ? await encrypt(notes) : null

      const response = await fetch('/api/reading/logs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          readingId: selectedReading.id,
          encryptedData: {
            startPage: encryptedStartPage,
            endPage: encryptedEndPage,
            sessionDate: encryptedSessionDate
          },
          notes: encryptedNotes
        })
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to log reading session')
      }

      setReadingLogForm({
        startPage: '',
        endPage: '',
        notes: '',
        sessionDate: new Date().toISOString().split('T')[0]
      })
      setSelectedReading(null)
      setShowLogModal(false)
      
      await loadReadings()
    } catch (error) {
      console.error('Failed to log reading session:', error)
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred'
      setErrorModal({ isOpen: true, title: 'Failed to Log Session', message: `${errorMessage}. Please try again.` })
    } finally {
      setIsSubmittingLog(false)
    }
  }

  const handleGenerateReflection = async () => {
    if (selectedReadingLogsForReflection.length === 0 || isGeneratingReflection) return

    setIsGeneratingReflection(true)
    try {
      const readingLogsWithDecryptedData = []
      
      for (const logId of selectedReadingLogsForReflection) {
        for (const reading of readings) {
          const log = reading.readingLogs.find(l => l.id === logId)
          if (log && log.decryptedStartPage && log.decryptedEndPage && log.decryptedSessionDate) {
            readingLogsWithDecryptedData.push({
              id: log.id,
              readingId: reading.id,
              docToken: reading.docToken,
              startPage: log.decryptedStartPage,
              endPage: log.decryptedEndPage,
              sessionDate: log.decryptedSessionDate,
              notes: log.decryptedNotes || null,
              readingTitle: reading.decryptedTitle
            })
            break
          }
        }
      }
      
      if (readingLogsWithDecryptedData.length === 0) {
        throw new Error('No valid reading logs found for reflection generation')
      }

      // Extract unique reading IDs from the selected logs
      const readingIds = [...new Set(readingLogsWithDecryptedData.map(log => log.readingId))]

      const response = await fetch('/api/reading/reflect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          readingIds: readingIds,
          readingLogsData: readingLogsWithDecryptedData,
          maxLogs: 8
        })
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to generate reflection')
      }

      const data = await response.json()
      setLastReflection(data.reflection.content)
      setLastReflectionId(data.reflection.id)
      let dataToPersist: any = data.reflection.structuredData || {}
      setAnalysisType(data.reflection?.metadata?.analysisType || null)
      try {
        const parsed = parseQuestionsFromMarkdown(data.reflection.content || '')
        setSocraticQuestions(parsed.socratic)
        setTask2Questions(parsed.task2)
        const combined = {
          ...(data.reflection.structuredData || {}),
          socraticQuestions: parsed.socratic,
          extensionQuestions: parsed.task2,
          userAnswers: {
            socratic: [],
            task2: []
          }
        }
        setStructuredData(combined)
        dataToPersist = combined
      } catch (parseErr) {
        console.warn('Failed to parse questions from reflection content:', parseErr)
        setSocraticQuestions([])
        setTask2Questions([])
      }
      
      if (hasKey) {
        try {
          // Persist the combined structured data with parsed questions
          const encryptedReflectionData = await encrypt(JSON.stringify(dataToPersist))
          
          await fetch(`/api/reading/reflect/${data.reflection.id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              encryptedReflectionData: encryptedReflectionData
            })
          })
        } catch (encryptionError) {
          console.error('Failed to encrypt reflection data:', encryptionError)
        }
      }
      
      // Success - no alert needed
    } catch (error) {
      console.error('Failed to generate reflection:', error)
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred'
      setErrorModal({ isOpen: true, title: 'Reflection Generation Failed', message: errorMessage })
    } finally {
      setIsGeneratingReflection(false)
    }
  }

  const persistStructuredData = async (dataToPersist: any): Promise<boolean> => {
    if (!hasKey || !lastReflectionId) return false
    try {
      const encryptedReflectionData = await encrypt(JSON.stringify(dataToPersist))
      const res = await fetch(`/api/reading/reflect/${lastReflectionId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ encryptedReflectionData })
      })
      return res.ok
    } catch (err) {
      console.error('Failed to persist answers:', err)
      return false
    }
  }

  const handleSaveFlashcard = async (kind: 'socratic' | 'task2', idx: number) => {
    const mapKey = `${kind}-${idx}`
    setSaveStatusByIndex(prev => ({ ...prev, [mapKey]: 'saving' }))
    let nextState: any
    setStructuredData(prev => {
      const next = {
        ...(prev || {}),
        userAnswers: {
          socratic: prev?.userAnswers?.socratic ? [...prev.userAnswers.socratic] : [],
          task2: prev?.userAnswers?.task2 ? [...prev.userAnswers.task2] : []
        }
      }
      const key = kind === 'socratic' ? 'socratic' : 'task2'
      const value = answersByIndex[mapKey] || ''
      const arr: string[] = next.userAnswers[key]
      for (let i = arr.length; i <= idx; i++) arr[i] = ''
      arr[idx] = value
      nextState = next
      return next
    })
    const ok = await persistStructuredData(nextState)
    setSaveStatusByIndex(prev => ({ ...prev, [mapKey]: ok ? 'saved' : 'error' }))
    if (ok) {
      setTimeout(() => {
        setSaveStatusByIndex(prev => ({ ...prev, [mapKey]: 'idle' }))
      }, 1500)
    }
  }

  const parseQuestionsFromMarkdown = (markdown: string): { socratic: string[], task2: string[] } => {
    if (!markdown) return { socratic: [], task2: [] }
    const lines = markdown.split('\n')
    let inSocraticSection = false
    let inTask2Section = false
    const socraticQuestions: string[] = []
    const task2Questions: string[] = []
    
    for (let i = 0; i < lines.length; i++) {
      const raw = lines[i]
      const line = raw.trim()
      
      // Check for section headers
      if (/socratic\s+questions/i.test(line)) {
        inSocraticSection = true
        inTask2Section = false
        continue
      }
      
      if (/^(?:\*\*|__)\s*Task\s*2/i.test(line) || /(Cross-Context|Temporal|Beyond the Reading)/i.test(line)) {
        inSocraticSection = false
        inTask2Section = true
        continue
      }
      
      // Exit sections on new headers
      if (/^\s*#+\s+/.test(line)) {
        inSocraticSection = false
        inTask2Section = false
        continue
      }
      
      // Collect questions
      const match = line.match(/^[-*]|^\d+\./)
      if (match) {
        const text = line.replace(/^\s*(?:[-*]|\d+\.)\s+/, '').trim()
        if (text) {
          if (inSocraticSection && socraticQuestions.length < 3) {
            socraticQuestions.push(text)
          } else if (inTask2Section && task2Questions.length < 3) {
            task2Questions.push(text)
          }
        }
      }
    }
    
    return {
      socratic: socraticQuestions,
      task2: task2Questions
    }
  }

  const handleReadingLogSelectionToggle = (logId: string) => {
    setSelectedReadingLogsForReflection(prev => {
      if (prev.includes(logId)) return prev.filter(id => id !== logId)
      if (prev.length >= MAX_SELECTION) {
        setErrorModal({ isOpen: true, title: 'Selection Limit', message: `You can select up to ${MAX_SELECTION} sessions for a single reflection.` })
        return prev
      }
      return [...prev, logId]
    })
  }

  const handleQuickSelectRecent = (count: number) => {
    const allValidLogs = readings.flatMap(reading =>
      reading.readingLogs
        .filter(log => log.decryptedStartPage && log.decryptedEndPage && log.decryptedSessionDate)
        .map(log => ({ id: log.id, date: new Date(log.decryptedSessionDate! + 'T00:00:00').getTime() }))
    )
    const sorted = allValidLogs.sort((a, b) => b.date - a.date)
    const target = sorted.slice(0, Math.min(count, MAX_SELECTION)).map(l => l.id)
    setSelectedReadingLogsForReflection(target)
  }

  const handleSelectAllForReading = (readingId: string) => {
    const reading = readings.find(r => r.id === readingId)
    if (!reading) return
    const validLogs = reading.readingLogs.filter(log => log.decryptedStartPage && log.decryptedEndPage && log.decryptedSessionDate)
    setSelectedReadingLogsForReflection(prev => {
      const remaining = MAX_SELECTION - prev.length
      if (remaining <= 0) return prev
      const candidates = validLogs.map(l => l.id).filter(id => !prev.includes(id))
      return [...prev, ...candidates.slice(0, remaining)]
    })
  }

  const handleClearForReading = (readingId: string) => {
    const reading = readings.find(r => r.id === readingId)
    if (!reading) return
    const idsToClear = new Set(
      reading.readingLogs
        .filter(log => log.decryptedStartPage && log.decryptedEndPage && log.decryptedSessionDate)
        .map(l => l.id)
    )
    setSelectedReadingLogsForReflection(prev => prev.filter(id => !idsToClear.has(id)))
  }

  const selectedLogDetails = useMemo(() => {
    const details: { id: string; title: string; range: string }[] = []
    for (const reading of readings) {
      for (const log of reading.readingLogs) {
        if (selectedReadingLogsForReflection.includes(log.id)) {
          const range = (log.decryptedStartPage && log.decryptedEndPage) ? `p${log.decryptedStartPage}-${log.decryptedEndPage}` : ''
          details.push({ id: log.id, title: reading.decryptedTitle, range })
        }
      }
    }
    return details
  }, [readings, selectedReadingLogsForReflection])

  const handleDeleteReading = async (readingId: string, readingTitle: string) => {
    if (!confirm(`Are you sure you want to delete "${readingTitle}"? This will permanently remove the document, all reading logs, reflections, and associated data. This action cannot be undone.`)) {
      return
    }

    setDeletingReadingId(readingId)
    try {
      const response = await fetch(`/api/reading/${readingId}`, {
        method: 'DELETE'
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to delete reading')
      }

      await loadReadings()
      // Success - no alert needed
    } catch (error) {
      console.error('Failed to delete reading:', error)
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred'
      setErrorModal({ isOpen: true, title: 'Delete Failed', message: `Failed to delete document: ${errorMessage}` })
    } finally {
      setDeletingReadingId(null)
    }
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(true)
  }

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(false)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(false)
    
    const files = Array.from(e.dataTransfer.files)
    const pdfFile = files.find(file => file.type === 'application/pdf')
    
    if (pdfFile) {
      setSelectedFile(pdfFile)
    } else {
      setErrorModal({ isOpen: true, title: 'Invalid File', message: 'Please drop a valid PDF file.' })
    }
  }

  const handleFileSelect = (file: File | null) => {
    if (!file) {
      setSelectedFile(null)
      return
    }

    if (file.type !== 'application/pdf') {
      setErrorModal({ isOpen: true, title: 'Invalid File Type', message: 'Please select a valid PDF file.' })
      return
    }

    setSelectedFile(file)
  }

  const filteredReadings = readings.filter(reading => {
    const matchesSearch = reading.decryptedTitle.toLowerCase().includes(searchTerm.toLowerCase())
    const hasValidLogs = reading.readingLogs.some(log => log.decryptedStartPage && log.decryptedEndPage)
    
    if (filterStatus === 'active') {
      return matchesSearch && hasValidLogs
    } else if (filterStatus === 'completed') {
      return matchesSearch && reading.readingLogs.length > 0
    }
    return matchesSearch
  })

  const totalPages = readings.reduce((sum, reading) => {
    const validLogs = reading.readingLogs
      .filter(log => log.decryptedStartPage && log.decryptedEndPage)
      .map(log => ({
        id: log.id,
        startPage: log.decryptedStartPage!,
        endPage: log.decryptedEndPage!,
        sessionDate: new Date(log.decryptedSessionDate || ''),
        notes: log.decryptedNotes
      }))
    
    return sum + calculateUniquePages(validLogs)
  }, 0)

  const totalSessions = readings.reduce((sum, reading) => sum + reading.readingLogs.length, 0)
  const activeReadings = readings.filter(r => r.readingLogs.some(log => log.decryptedStartPage && log.decryptedEndPage)).length

  if (isLoading) {
    return (
      <div className="page-container paper-texture">
        <div className="content-wrapper-7xl">
          <div className="paper-loading">
            <div className="paper-loading-spinner"></div>
            <div className="loading-text text-elegant ml-3">Loading your reading library...</div>
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
              Your reading materials are protected with end-to-end encryption. Please set up or unlock your encryption key to continue.
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
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="page-container paper-texture">
      <div className="content-wrapper-7xl">
        {/* Header Section */}
        <div className="paper-header">
          <div className="flex items-center gap-4 mb-6">
            <div className="w-16 h-16 bg-gray-100 rounded-2xl flex items-center justify-center shadow-lg flex-shrink-0">
              <BookOpen className="h-8 w-8 text-gray-600" />
            </div>
            <div>
              <h1 className="heading-primary text-elegant">
                Reading Journal
              </h1>
              <p className="text-paper-secondary text-lg text-elegant">
                Transform your reading into meaningful insights and reflections
              </p>
            </div>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="paper-card mb-8">
          <div className="paper-nav">
            {[
              { id: 'overview', label: 'Library', icon: BookOpen },
              { id: 'reflect', label: 'Deep Reflection', icon: Brain }
            ].map((tab) => {
              const Icon = tab.icon
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as 'overview' | 'reflect')}
                  className={`paper-nav-item flex items-center gap-3 ${
                    activeTab === tab.id ? 'active' : ''
                  }`}
                >
                  <Icon className="h-5 w-5" />
                  {tab.label}
                </button>
              )
            })}
          </div>
        </div>

        {/* Tab Content */}
        {activeTab === 'overview' && (
          <div className="space-y-8">
            {/* Stats Overview */}
            {readings.length > 0 && (
              <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
                <div className="paper-card paper-spacing-md">
                  <div className="flex items-center gap-4">
                    <div className="p-3 bg-gray-100 rounded-lg">
                      <FileText className="h-6 w-6 text-gray-700" />
                    </div>
                    <div>
                      <p className="text-2xl font-bold text-gray-900">{readings.length}</p>
                      <p className="text-sm text-gray-600">Documents</p>
                    </div>
                  </div>
                </div>
                <div className="paper-card paper-spacing-md">
                  <div className="flex items-center gap-4">
                    <div className="p-3 bg-gray-100 rounded-lg">
                      <Eye className="h-6 w-6 text-gray-700" />
                    </div>
                    <div>
                      <p className="text-2xl font-bold text-gray-900">{totalPages}</p>
                      <p className="text-sm text-gray-600">Pages Read</p>
                    </div>
                  </div>
                </div>
                <div className="paper-card paper-spacing-md">
                  <div className="flex items-center gap-4">
                    <div className="p-3 bg-gray-100 rounded-lg">
                      <Clock className="h-6 w-6 text-gray-700" />
                    </div>
                    <div>
                      <p className="text-2xl font-bold text-gray-900">{totalSessions}</p>
                      <p className="text-sm text-gray-600">Sessions</p>
                    </div>
                  </div>
                </div>
                <div className="paper-card paper-spacing-md">
                  <div className="flex items-center gap-4">
                    <div className="p-3 bg-gray-100 rounded-lg">
                      <CheckCircle className="h-6 w-6 text-gray-700" />
                    </div>
                    <div>
                      <p className="text-2xl font-bold text-gray-900">{activeReadings}</p>
                      <p className="text-sm text-gray-600">Active</p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Quick Action Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
              <div 
                className={`paper-card paper-card-interactive paper-spacing-md transition-all duration-200 ${
                  isDragOver ? 'border-blue-500 bg-blue-50' : ''
                }`}
                onClick={() => setShowUploadModal(true)}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
              >
                <div className="flex items-center gap-4">
                  <div className="p-3 bg-gray-100 rounded-lg">
                    <Upload className="h-6 w-6 text-gray-700" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900 mb-1">
                      {isDragOver ? 'Drop PDF here' : 'Upload Document'}
                    </h3>
                    <p className="text-sm text-gray-600">
                      {isDragOver ? 'Release to upload' : 'Add a new PDF to your library'}
                    </p>
                  </div>
                </div>
              </div>
              
              <div className="paper-card paper-card-interactive paper-spacing-md" onClick={() => setShowLogModal(true)}>
                <div className="flex items-center gap-4">
                  <div className="p-3 bg-gray-100 rounded-lg">
                    <Calendar className="h-6 w-6 text-gray-700" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900 mb-1">Log Reading Session</h3>
                    <p className="text-sm text-gray-600">Track your reading progress</p>
                  </div>
                </div>
              </div>
            </div>

            {readings.length === 0 ? (
              <div 
                className={`paper-card paper-spacing-lg text-center transition-all duration-200 ${
                  isDragOver ? 'border-blue-500 bg-blue-50' : ''
                }`}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
              >
                <div className="max-w-md mx-auto">
                  <div className="p-4 bg-gray-100 rounded-full w-fit mx-auto mb-6">
                    <BookOpen className="h-8 w-8 text-gray-600" />
                  </div>
                  <h2 className="heading-secondary text-elegant mb-3">
                    {isDragOver ? 'Drop your PDF here' : 'Begin Your Reading Journey'}
                  </h2>
                  <p className="text-body text-elegant mb-6">
                    {isDragOver 
                      ? 'Release to upload your first document' 
                      : 'Upload your first document to start tracking your reading progress and generating thoughtful reflections.'
                    }
                  </p>
                  {!isDragOver && (
                    <button
                      onClick={() => setShowUploadModal(true)}
                      className="btn-primary btn-large flex items-center gap-2 mx-auto"
                    >
                      <Upload className="h-4 w-4" />
                      Upload Your First Document
                    </button>
                  )}
                </div>
              </div>
            ) : (
              <>
                {/* Search and Filter */}
                <div className="flex flex-col sm:flex-row gap-4 mb-6">
                  <div className="relative flex-1">
                    <input
                      type="text"
                      placeholder="Search documents..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="paper-input w-full pl-10 pr-4 py-3"
                    />
                  </div>
                  <select
                    value={filterStatus}
                    onChange={(e) => setFilterStatus(e.target.value as 'all' | 'active' | 'completed')}
                    className="paper-select px-4 py-3"
                  >
                    <option value="all">All Documents</option>
                    <option value="active">Active Reading</option>
                    <option value="completed">Completed</option>
                  </select>
                </div>

                {/* Documents Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {filteredReadings.map((reading) => {
                    const hasValidLogs = reading.readingLogs.some(log => log.decryptedStartPage && log.decryptedEndPage)
                    const validLogs = reading.readingLogs
                      .filter(log => log.decryptedStartPage && log.decryptedEndPage)
                      .map(log => ({
                        id: log.id,
                        startPage: log.decryptedStartPage!,
                        endPage: log.decryptedEndPage!,
                        sessionDate: new Date(log.decryptedSessionDate || ''),
                        notes: log.decryptedNotes
                      }))
                    const totalPages = calculateUniquePages(validLogs)
                    const latestSession = reading.readingLogs
                      .filter(log => log.decryptedSessionDate)
                      .sort((a, b) => new Date(b.decryptedSessionDate! + 'T00:00:00').getTime() - new Date(a.decryptedSessionDate! + 'T00:00:00').getTime())[0]

                    return (
                      <div key={reading.id} className="paper-card paper-card-interactive paper-spacing-md">
                        <div className="flex items-start justify-between mb-4">
                          <div className="flex-1">
                            <h3 className="font-semibold text-gray-900 mb-2 line-clamp-2 text-paper">
                              {reading.decryptedTitle}
                            </h3>
                            <p className="text-sm text-gray-500">
                              Added {new Date(reading.uploadDate).toLocaleDateString()}
                            </p>
                          </div>
                          <div className={`w-3 h-3 rounded-full ml-2 ${
                            hasValidLogs ? 'bg-gray-700' : 'bg-gray-300'
                          }`} />
                        </div>
                        
                        <div className="space-y-3 mb-4">
                          <div className="flex items-center gap-2 text-sm text-gray-600">
                            <Calendar className="h-4 w-4" />
                            <span>{reading.readingLogs.length} session{reading.readingLogs.length !== 1 ? 's' : ''}</span>
                          </div>
                          {totalPages > 0 && (
                            <div className="flex items-center gap-2 text-sm text-gray-600">
                              <Eye className="h-4 w-4" />
                              <span>{totalPages} pages read</span>
                            </div>
                          )}
                          {latestSession && (
                            <div className="flex items-center gap-2 text-sm text-gray-600">
                              <Clock className="h-4 w-4" />
                              <span>Last: {new Date(latestSession.decryptedSessionDate! + 'T00:00:00').toLocaleDateString()}</span>
                            </div>
                          )}
                        </div>

                        <div className="flex gap-2">
                          <button
                            onClick={() => {
                              setSelectedReading(reading)
                              setShowLogModal(true)
                            }}
                            className="flex-1 btn-secondary btn-small flex items-center justify-center gap-1"
                          >
                            <Plus className="h-3 w-3" />
                            Log Session
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              handleDeleteReading(reading.id, reading.decryptedTitle)
                            }}
                            disabled={deletingReadingId === reading.id}
                            className="btn-secondary btn-small p-2 text-red-600 hover:text-red-700 hover:bg-red-50 disabled:opacity-50"
                            title="Delete document"
                          >
                            {deletingReadingId === reading.id ? (
                              <Loader2 className="h-3 w-3 animate-spin" />
                            ) : (
                              <Trash2 className="h-3 w-3" />
                            )}
                          </button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </>
            )}
          </div>
        )}

        {activeTab === 'reflect' && (
          <div className="space-y-8">
            {/* Header */}
            <div className="text-center mb-8">
              <h2 className="heading-secondary text-elegant mb-2">
                Deep Reflection
              </h2>
              <p className="text-body text-elegant">
                Select specific reading sessions for {userAssistantName} to create personalized Socratic questions and cross-contextual insights.
              </p>
            </div>
            
            {readings.length === 0 ? (
              <div 
                className={`text-center py-12 transition-all duration-200 ${
                  isDragOver ? 'border-2 border-dashed border-blue-500 bg-blue-50 rounded-lg' : ''
                }`}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
              >
                <div className="p-4 bg-gray-100 rounded-full w-fit mx-auto mb-4">
                  <FileText className="h-8 w-8 text-gray-600" />
                </div>
                <p className="text-body text-elegant mb-4">
                  {isDragOver 
                    ? 'Drop your PDF here to get started' 
                    : `You need to upload documents and log reading sessions before ${userAssistantName} can create reflections.`
                  }
                </p>
                {!isDragOver && (
                  <button
                    onClick={() => setShowUploadModal(true)}
                    className="btn-primary"
                  >
                    Upload Document
                  </button>
                )}
              </div>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Reading Logs Selection - Small Side Card */}
                <div className="lg:col-span-1">
                  <div className="paper-card paper-spacing-md sticky top-8">
                    <h3 className="text-lg font-semibold text-gray-900 mb-4">
                      Select Sessions
                    </h3>
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex gap-2">
                        <button onClick={() => handleQuickSelectRecent(3)} className="btn-secondary btn-small text-xs">Last 3</button>
                        <button onClick={() => handleQuickSelectRecent(5)} className="btn-secondary btn-small text-xs">Last 5</button>
                      </div>
                      <div className="text-xs text-gray-500">Up to {MAX_SELECTION} sessions</div>
                    </div>
                    <div className="space-y-3 max-h-96 overflow-y-auto">
                      {readings.map((reading) => {
                        const validLogs = reading.readingLogs
                          .filter(log => log.decryptedStartPage && log.decryptedEndPage && log.decryptedSessionDate)
                          .sort((a, b) => new Date(b.decryptedSessionDate! + 'T00:00:00').getTime() - new Date(a.decryptedSessionDate! + 'T00:00:00').getTime())
                        
                        if (validLogs.length === 0) return null
                        
                        return (
                          <div key={reading.id} className="space-y-2">
                            <div className="flex items-start justify-between">
                              <h4 className="font-medium text-gray-900 text-sm break-words flex-1 pr-2">{reading.decryptedTitle}</h4>
                            </div>
                            <div className="flex items-center gap-3">
                              <button onClick={() => handleSelectAllForReading(reading.id)} className="text-xs text-gray-600 hover:text-gray-800 underline underline-offset-2">Select all</button>
                              <button onClick={() => handleClearForReading(reading.id)} className="text-xs text-gray-600 hover:text-gray-800 underline underline-offset-2">Clear</button>
                            </div>
                            <div className="space-y-1">
                              {validLogs.map((log) => {
                                return (
                                  <div
                                    key={log.id}
                                    className="flex items-center gap-2 p-2 border border-gray-100 rounded-md hover:bg-gray-50 transition-colors"
                                  >
                                    <input
                                      type="checkbox"
                                      id={`log-${log.id}`}
                                      checked={selectedReadingLogsForReflection.includes(log.id)}
                                      onChange={() => handleReadingLogSelectionToggle(log.id)}
                                      disabled={!selectedReadingLogsForReflection.includes(log.id) && selectedReadingLogsForReflection.length >= MAX_SELECTION}
                                      className="h-3 w-3 text-black border-gray-300 rounded focus:ring-black"
                                    />
                                    <label
                                      htmlFor={`log-${log.id}`}
                                      className="flex-1 cursor-pointer text-xs"
                                    >
                                      <div className="font-medium text-gray-900">
                                        Pages {log.decryptedStartPage}-{log.decryptedEndPage}
                                      </div>
                                      <div className="text-gray-500">
                                        {new Date(log.decryptedSessionDate! + 'T00:00:00').toLocaleDateString()}
                                      </div>
                                    </label>
                                  </div>
                                )
                              })}
                            </div>
                          </div>
                        )
                      })}
                    </div>

                    {/* Generate Button */}
                    {selectedReadingLogsForReflection.length > 0 && (
                      <div className="mt-4 pt-4 border-t border-gray-200">
                        <div className="flex items-center gap-2 mb-3">
                          <Sparkles className="h-4 w-4 text-gray-700" />
                          <span className="text-sm font-medium text-gray-900">
                            {selectedReadingLogsForReflection.length} session{selectedReadingLogsForReflection.length === 1 ? '' : 's'} selected
                          </span>
                        </div>
                        {selectedLogDetails.length > 0 && (
                          <div className="flex flex-wrap gap-2 mb-3">
                            {selectedLogDetails.slice(0, 6).map(item => (
                              <span key={item.id} className="inline-flex items-center gap-1 text-xs bg-gray-100 text-gray-700 rounded-full px-2 py-1">
                                <span className="max-w-[120px] truncate">{item.title}</span>
                                <span className="text-gray-500">{item.range}</span>
                                <button onClick={() => handleReadingLogSelectionToggle(item.id)} className="text-gray-500 hover:text-gray-700">
                                  <X className="h-3 w-3" />
                                </button>
                              </span>
                            ))}
                            {selectedLogDetails.length > 6 && (
                              <span className="text-xs text-gray-500">+{selectedLogDetails.length - 6} more</span>
                            )}
                          </div>
                        )}
                        {selectedReadingLogsForReflection.length >= MAX_SELECTION && (
                          <div className="text-xs text-red-600 mb-2">Maximum of {MAX_SELECTION} sessions reached.</div>
                        )}

                        <div className="space-y-2">
                          <button
                            onClick={handleGenerateReflection}
                            disabled={isGeneratingReflection}
                            className="w-full btn-primary btn-small flex items-center justify-center gap-2"
                          >
                            {isGeneratingReflection ? (
                              <>
                                <Loader2 className="h-3 w-3 animate-spin" />
                                {userAssistantName} is thinking...
                              </>
                            ) : (
                              <>
                                <Brain className="h-3 w-3" />
                                Ask {userAssistantName} for Reflection
                              </>
                            )}
                          </button>
                          <button
                            onClick={() => setSelectedReadingLogsForReflection([])}
                            className="w-full btn-secondary btn-small text-xs"
                          >
                            Clear Selection
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Reflection Display - Large Main Card */}
                <div className="lg:col-span-2">
                  {lastReflection ? (
                    <div className="paper-card paper-spacing-lg">
                      <div className="flex items-center gap-3 mb-6 justify-between">
                        <div className="p-2 bg-gray-100 rounded-lg">
                          <Sparkles className="h-5 w-5 text-gray-700" />
                        </div>
                        <div>
                          <h3 className="text-xl font-semibold text-gray-900">
                            {userAssistantName}&apos;s Reflection
                          </h3>
                          <p className="text-sm text-gray-600">
                            Personalized insights from your reading sessions
                          </p>
                        </div>
                        {analysisType && (
                          <span className="text-xs px-2 py-1 bg-gray-100 rounded-md capitalize text-gray-700">{analysisType.replace(/-/g, ' ')}</span>
                        )}
                      </div>
                      {(socraticQuestions.length > 0 || task2Questions.length > 0) && (
                        <div className="mb-8 space-y-6">
                          {socraticQuestions.length > 0 && (
                            <div>
                              <h4 className="text-lg font-semibold text-gray-900 mb-3">Socratic Questions</h4>
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {socraticQuestions.map((q, idx) => {
                                  const isBack = !!showAnswerForIndex[`socratic-${idx}`]
                                  const answer = answersByIndex[`socratic-${idx}`] || ''
                                  return (
                                    <div key={`socratic-${idx}`} className="paper-card paper-spacing-md bg-white">
                                      <div className="flex items-center justify-between mb-2">
                                        <div className="text-sm font-medium text-gray-700">Question {idx + 1}</div>
                                        <button
                                          onClick={() => setShowAnswerForIndex(prev => ({ ...prev, [`socratic-${idx}`]: !prev[`socratic-${idx}`] }))}
                                          className="btn-secondary btn-small text-xs"
                                        >
                                          {isBack ? 'Show Question' : 'Answer'}
                                        </button>
                                      </div>
                                      {!isBack ? (
                                        <div className="prose prose-gray max-w-none text-gray-800 min-h-[4rem]">
                                          <ReactMarkdown remarkPlugins={[remarkGfm, remarkMath]} rehypePlugins={[rehypeKatex]}>
                                            {q}
                                          </ReactMarkdown>
                                        </div>
                                      ) : (
                                        <div>
                                          <label className="paper-label">Your Answer (Markdown + LaTeX supported)</label>
                                          <textarea
                                            value={answer}
                                            onChange={(e) => setAnswersByIndex(prev => ({ ...prev, [`socratic-${idx}`]: e.target.value }))}
                                            className="paper-textarea h-32 w-full"
                                            placeholder="Write your answer here. Use $...$ or $$...$$ for LaTeX."
                                          />
                                          <div className="mt-2 flex justify-end">
                                            <button
                                              onClick={() => handleSaveFlashcard('socratic', idx)}
                                              className="btn-primary btn-small"
                                            >
                                              Save
                                            </button>
                                          </div>
                                          <div className="mt-1 text-right text-xs">
                                            {saveStatusByIndex[`socratic-${idx}`] === 'saving' && <span className="text-gray-500">Saving...</span>}
                                            {saveStatusByIndex[`socratic-${idx}`] === 'saved' && <span className="text-green-600">Saved</span>}
                                            {saveStatusByIndex[`socratic-${idx}`] === 'error' && <span className="text-red-600">Save failed</span>}
                                          </div>
                                          {answer.trim() && (
                                            <div className="mt-3">
                                              <div className="text-xs text-gray-600 mb-1">Preview</div>
                                              <div className="prose prose-gray max-w-none bg-gray-50 rounded-lg p-3">
                                                <ReactMarkdown remarkPlugins={[remarkGfm, remarkMath]} rehypePlugins={[rehypeKatex]}>
                                                  {answer}
                                                </ReactMarkdown>
                                              </div>
                                            </div>
                                          )}
                                        </div>
                                      )}
                                    </div>
                                  )
                                })}
                              </div>
                            </div>
                          )}
                          
                          {task2Questions.length > 0 && (
                            <div>
                              <h4 className="text-lg font-semibold text-gray-900 mb-3">
                                {analysisType === 'cross-contextual' && 'Cross-Context Inspiration'}
                                {analysisType === 'temporal-progression' && 'Temporal Progression'}
                                {analysisType === 'beyond-the-reading' && 'Beyond the Reading'}
                                {!analysisType && 'Extension Questions'}
                              </h4>
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {task2Questions.map((q, idx) => {
                                  const isBack = !!showAnswerForIndex[`task2-${idx}`]
                                  const answer = answersByIndex[`task2-${idx}`] || ''
                                  return (
                                    <div key={`task2-${idx}`} className="paper-card paper-spacing-md bg-white">
                                      <div className="flex items-center justify-between mb-2">
                                        <div className="text-sm font-medium text-gray-700">Question {idx + 1}</div>
                                        <button
                                          onClick={() => setShowAnswerForIndex(prev => ({ ...prev, [`task2-${idx}`]: !prev[`task2-${idx}`] }))}
                                          className="btn-secondary btn-small text-xs"
                                        >
                                          {isBack ? 'Show Question' : 'Notes'}
                                        </button>
                                      </div>
                                      {!isBack ? (
                                        <div className="prose prose-gray max-w-none text-gray-800 min-h-[4rem]">
                                          <ReactMarkdown remarkPlugins={[remarkGfm, remarkMath]} rehypePlugins={[rehypeKatex]}>
                                            {q}
                                          </ReactMarkdown>
                                        </div>
                                      ) : (
                                        <div>
                                          <label className="paper-label">Your Notes (Markdown + LaTeX supported)</label>
                                          <textarea
                                            value={answer}
                                            onChange={(e) => setAnswersByIndex(prev => ({ ...prev, [`task2-${idx}`]: e.target.value }))}
                                            className="paper-textarea h-32 w-full"
                                            placeholder="Write your thoughts here. Use $...$ or $$...$$ for LaTeX."
                                          />
                                          <div className="mt-2 flex justify-end">
                                            <button
                                              onClick={() => handleSaveFlashcard('task2', idx)}
                                              className="btn-primary btn-small"
                                            >
                                              Save
                                            </button>
                                          </div>
                                          <div className="mt-1 text-right text-xs">
                                            {saveStatusByIndex[`task2-${idx}`] === 'saving' && <span className="text-gray-500">Saving...</span>}
                                            {saveStatusByIndex[`task2-${idx}`] === 'saved' && <span className="text-green-600">Saved</span>}
                                            {saveStatusByIndex[`task2-${idx}`] === 'error' && <span className="text-red-600">Save failed</span>}
                                          </div>
                                          {answer.trim() && (
                                            <div className="mt-3">
                                              <div className="text-xs text-gray-600 mb-1">Preview</div>
                                              <div className="prose prose-gray max-w-none bg-gray-50 rounded-lg p-3">
                                                <ReactMarkdown remarkPlugins={[remarkGfm, remarkMath]} rehypePlugins={[rehypeKatex]}>
                                                  {answer}
                                                </ReactMarkdown>
                                              </div>
                                            </div>
                                          )}
                                        </div>
                                      )}
                                    </div>
                                  )
                                })}
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                      {/* Full reflection display removed to keep flashcard-only UI */}
                      
                      {(socraticQuestions.length === 0 && task2Questions.length === 0) && lastReflection && (
                        <div className="bg-gray-50 rounded-lg p-6 text-center text-gray-600">
                          No structured questions were generated for this reflection.
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="paper-card paper-spacing-lg bg-gray-50 border-2 border-dashed border-gray-300">
                      <div className="text-center py-16">
                        <div className="p-4 bg-gray-100 rounded-full w-fit mx-auto mb-4">
                          <Brain className="h-8 w-8 text-gray-600" />
                        </div>
                        <h3 className="text-lg font-semibold text-gray-900 mb-2">
                          Ready for {userAssistantName}&apos;s Reflection
                        </h3>
                        <p className="text-gray-600 mb-4">
                          Select reading sessions from the sidebar and ask {userAssistantName} for personalized insights
                        </p>
                        <div className="text-sm text-gray-500">
                          Your reflection will appear here
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Upload Modal */}
        {showUploadModal && (
          <Modal isOpen={showUploadModal} onClose={() => setShowUploadModal(false)} maxWidth="2xl" showCloseButton={false}>
              <div className="paper-spacing-lg">
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-gray-100 rounded-lg">
                      <Upload className="h-6 w-6 text-gray-700" />
                    </div>
                    <h2 className="text-xl font-semibold text-gray-900">Upload PDF Document</h2>
                  </div>
                  <button
                    onClick={() => setShowUploadModal(false)}
                    className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                  >
                    <X className="h-5 w-5 text-gray-500" />
                  </button>
                </div>

                <div 
                  className={`border-2 border-dashed rounded-xl p-8 text-center transition-all duration-200 ${
                    isDragOver 
                      ? 'border-blue-500 bg-blue-50 border-2' 
                      : 'border-gray-300 hover:border-gray-400'
                  }`}
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                >
                  <input
                    type="file"
                    accept=".pdf"
                    onChange={(e) => handleFileSelect(e.target.files?.[0] || null)}
                    className="hidden"
                    id="file-upload"
                  />
                  <label
                    htmlFor="file-upload"
                    className="cursor-pointer block"
                  >
                    <div className="space-y-4">
                      <div className="text-6xl">
                        {isDragOver ? '📁' : '📄'}
                      </div>
                      <div className="text-lg font-medium text-gray-900">
                        {selectedFile 
                          ? selectedFile.name 
                          : isDragOver 
                            ? 'Drop your PDF file here' 
                            : 'Click to select or drag & drop a PDF file'
                        }
                      </div>
                      <div className="text-sm text-gray-500">
                        Only PDF files are supported (max 10MB)
                      </div>
                      {!selectedFile && !isDragOver && (
                        <div className="text-xs text-blue-500 mt-2">
                          Drag and drop your PDF file here, or click to browse
                        </div>
                      )}
                    </div>
                  </label>
                </div>

                {selectedFile && (
                  <div className="mt-6 flex justify-center">
                    <button
                      onClick={handleFileUpload}
                      disabled={isUploading}
                      className="btn-primary btn-large flex items-center gap-2"
                    >
                      {isUploading ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin" />
                          Processing...
                        </>
                      ) : (
                        <>
                          <Upload className="h-4 w-4" />
                          Upload Document
                        </>
                      )}
                    </button>
                  </div>
                )}
              </div>
          </Modal>
        )}

        {/* Log Session Modal */}
        {showLogModal && (
          <Modal isOpen={showLogModal} onClose={() => setShowLogModal(false)} maxWidth="2xl" showCloseButton={false}>
              <div className="paper-spacing-lg">
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-gray-100 rounded-lg">
                      <Calendar className="h-6 w-6 text-gray-700" />
                    </div>
                    <h2 className="text-xl font-semibold text-gray-900">Log Reading Session</h2>
                  </div>
                  <button
                    onClick={() => setShowLogModal(false)}
                    className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                  >
                    <X className="h-5 w-5 text-gray-500" />
                  </button>
                </div>
                
                {readings.length === 0 ? (
                  <div 
                    className={`text-center py-12 transition-all duration-200 ${
                      isDragOver ? 'border-2 border-dashed border-blue-500 bg-blue-50 rounded-lg' : ''
                    }`}
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    onDrop={handleDrop}
                  >
                    <div className="p-4 bg-gray-100 rounded-full w-fit mx-auto mb-4">
                      <FileText className="h-8 w-8 text-gray-600" />
                    </div>
                    <p className="text-body text-elegant mb-4">
                      {isDragOver 
                        ? 'Drop your PDF here to get started' 
                        : 'You need to upload documents before logging reading sessions.'
                      }
                    </p>
                    {!isDragOver && (
                      <button
                        onClick={() => {
                          setShowLogModal(false)
                          setShowUploadModal(true)
                        }}
                        className="btn-primary"
                      >
                        Upload Document
                      </button>
                    )}
                  </div>
                ) : (
                  <div className="space-y-6">
                    {/* Document Selection */}
                    <div>
                      <label className="paper-label">
                        Select Document
                      </label>
                      <select
                        value={selectedReading?.id || ''}
                        onChange={(e) => {
                          const reading = readings.find(r => r.id === e.target.value)
                          setSelectedReading(reading || null)
                        }}
                        className="paper-select"
                      >
                        <option value="">Choose a document...</option>
                        {readings.map((reading) => (
                          <option key={reading.id} value={reading.id}>
                            {reading.decryptedTitle}
                          </option>
                        ))}
                      </select>
                    </div>

                    {selectedReading && (
                      <div className="paper-card paper-spacing-md bg-gray-50 space-y-6">
                        <div className="flex items-center gap-3">
                          <div className="p-2 bg-gray-100 rounded-lg">
                            <FileText className="h-5 w-5 text-gray-700" />
                          </div>
                          <div>
                            <h3 className="font-semibold text-gray-900">
                              {selectedReading.decryptedTitle}
                            </h3>
                            <p className="text-sm text-gray-600">
                              {selectedReading.readingLogs.length} previous session{selectedReading.readingLogs.length !== 1 ? 's' : ''}
                              {selectedReading.totalPages && (
                                <span className="ml-2 text-gray-500">
                                  • {selectedReading.totalPages} pages total
                                </span>
                              )}
                            </p>
                          </div>
                        </div>
                        
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div>
                            <label className="paper-label">
                              Start Page
                            </label>
                            <input
                              type="number"
                              value={readingLogForm.startPage}
                              onChange={(e) => setReadingLogForm(prev => ({ ...prev, startPage: e.target.value }))}
                              className="paper-input"
                              min="1"
                              max={selectedReading.totalPages || undefined}
                            />
                          </div>
                          
                          <div>
                            <label className="paper-label">
                              End Page
                            </label>
                            <input
                              type="number"
                              value={readingLogForm.endPage}
                              onChange={(e) => setReadingLogForm(prev => ({ ...prev, endPage: e.target.value }))}
                              className="paper-input"
                              min="1"
                              max={selectedReading.totalPages || undefined}
                            />
                          </div>
                        </div>

                        <div>
                          <label className="paper-label">
                            Session Date
                          </label>
                          <input
                            type="date"
                            value={readingLogForm.sessionDate}
                            onChange={(e) => setReadingLogForm(prev => ({ ...prev, sessionDate: e.target.value }))}
                            className="paper-input"
                          />
                        </div>

                        <div>
                          <label className="paper-label">
                            Notes (Optional)
                          </label>
                          <textarea
                            value={readingLogForm.notes}
                            onChange={(e) => setReadingLogForm(prev => ({ ...prev, notes: e.target.value }))}
                            className="paper-textarea h-24"
                            placeholder="Any thoughts, insights, or questions from this reading session..."
                          />
                        </div>

                        <div className="flex justify-end gap-3">
                          <button
                            onClick={() => {
                              setSelectedReading(null)
                              setReadingLogForm({
                                startPage: '',
                                endPage: '',
                                notes: '',
                                sessionDate: new Date().toISOString().split('T')[0]
                              })
                              setShowLogModal(false)
                            }}
                            className="btn-secondary btn-small"
                          >
                            Cancel
                          </button>
                          <button
                            onClick={handleReadingLogSubmit}
                            disabled={isSubmittingLog}
                            className="btn-primary btn-small flex items-center gap-2"
                          >
                            {isSubmittingLog ? (
                              <>
                                <Loader2 className="h-3 w-3 animate-spin" />
                                Logging...
                              </>
                            ) : (
                              <>
                                <Calendar className="h-3 w-3" />
                                Log Session
                              </>
                            )}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
          </Modal>
        )}

        {/* Error Modal */}
        <ErrorModal
          isOpen={errorModal.isOpen}
          onClose={() => setErrorModal({ isOpen: false, title: '', message: '' })}
          title={errorModal.title}
          message={errorModal.message}
        />
      </div>
    </div>
  )
}
