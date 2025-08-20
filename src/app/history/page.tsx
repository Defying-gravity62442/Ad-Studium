'use client'

import { useState, useEffect } from 'react'
import { Modal } from '@/components/ui/modal'
import { ErrorModal } from '@/components/ui/error-modal'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { useE2EE } from '@/hooks/useE2EE'
import { useMonthlySummary } from '@/hooks/useMonthlySummary'
import { useYearlySummary } from '@/hooks/useYearlySummary'
import { formatJournalDate } from '@/lib/date-utils'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import remarkMath from 'remark-math'
import rehypeKatex from 'rehype-katex'
import { Archive, PenTool, Loader2, BookOpen, FileText, Calendar } from 'lucide-react'

interface Journal {
  id: string
  title: string | null
  content: string
  mood: string | null
  tags: string[]
  date: string
  createdAt: string
  updatedAt: string
  isPast: boolean
  isInCoolingPeriod: boolean
  canEdit: boolean
  canDelete: boolean
  dailySummary?: DailySummary
  aiConversations: any[]
}

interface DailySummary {
  id: string
  content: string
  mood: string | null
  keyTopics: string[]
  isHiddenFromAI: boolean
  summaryDate: string
  createdAt: string
}

interface HierarchicalSummary {
  id: string
  content: string
  startDate: string
  endDate: string
  createdAt: string
}

interface ReadingReflection {
  id: string
  readingId: string
  question: string
  response: string
  createdAt: string
  reading: {
    id: string
    title: string | null
    docToken: string
  }
}

interface ReadingLog {
  id: string
  readingId: string
  startPage: string | null
  endPage: string | null
  notes: string | null
  sessionDate: string | null
  createdAt: string
  reading: {
    id: string
    title: string | null
    docToken: string
  }
}

interface DecryptedReadingLog extends ReadingLog {
  notes: string | null
  sessionDate: string | null
  reading: {
    id: string
    title: string | null
    docToken: string
    decryptedTitle: string | null
  }
}

function ReflectionAnswerCard({ kind, index, question, answer, onSave }: { 
  kind: 'socratic' | 'task2', 
  index: number, 
  question: string, 
  answer: string,
  onSave: (value: string) => Promise<void>
}) {
  const [value, setValue] = useState(answer)
  const [saving, setSaving] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')

  const handleSave = async () => {
    try {
      setSaving('saving')
      await onSave(value)
      setSaving('saved')
      setTimeout(() => setSaving('idle'), 1500)
    } catch (e) {
      setSaving('error')
    }
  }

  return (
    <div className="paper-card paper-spacing-md">
      <div className="flex items-center gap-2 mb-3">
        <div className="w-6 h-6 bg-gray-100 rounded-full flex items-center justify-center flex-shrink-0">
          <span className="text-xs font-medium text-gray-600">{index + 1}</span>
        </div>
        <span className="text-sm font-medium text-gray-600 text-elegant">Question {index + 1}</span>
      </div>
      
      <div className="prose prose-gray max-w-none text-gray-800 mb-4">
        <ReactMarkdown remarkPlugins={[remarkGfm, remarkMath]} rehypePlugins={[rehypeKatex]}>
          {question}
        </ReactMarkdown>
      </div>
      
      <div>
        <label className="paper-label">{kind === 'socratic' ? 'Your Answer' : 'Your Notes'} (Markdown + LaTeX supported)</label>
        <textarea
          className="paper-textarea h-32 w-full"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder={kind === 'socratic' ? 'Write your answer...' : 'Write your notes...'}
        />
        <div className="mt-3 flex items-center justify-end gap-3">
          <button onClick={handleSave} className="btn-primary btn-small" disabled={saving === 'saving'}>
            {saving === 'saving' ? (
              <span className="inline-flex items-center gap-2"><Loader2 className="h-3 w-3 animate-spin" /> Saving...</span>
            ) : 'Save'}
          </button>
          <div className="text-xs">
            {saving === 'saved' && <span className="text-green-600">Saved</span>}
            {saving === 'error' && <span className="text-red-600">Save failed</span>}
          </div>
        </div>
        {value.trim() && (
          <div className="mt-4">
            <div className="text-xs text-gray-600 mb-2 text-elegant">Preview</div>
            <div className="prose prose-gray max-w-none bg-gray-50 rounded-lg p-4 border border-gray-100">
              <ReactMarkdown remarkPlugins={[remarkGfm, remarkMath]} rehypePlugins={[rehypeKatex]}>
                {value}
              </ReactMarkdown>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function ReadingLogEditCard({ log, onSave, onCancel }: {
  log: DecryptedReadingLog,
  onSave: (notes: string) => Promise<void>,
  onCancel: () => void
}) {
  const [notes, setNotes] = useState(log.notes || '')
  const [saving, setSaving] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')

  const handleSave = async () => {
    try {
      setSaving('saving')
      await onSave(notes)
      setSaving('saved')
      setTimeout(() => setSaving('idle'), 1500)
    } catch (e) {
      setSaving('error')
    }
  }

  return (
    <div className="paper-card paper-spacing-md">
      <div className="mb-4">
        <h3 className="card-title text-elegant mb-2">Edit Reading Log</h3>
        <p className="text-sm text-gray-500 text-elegant">
          Document: {log.reading.decryptedTitle} • 
          {log.sessionDate ? new Date(log.sessionDate + 'T00:00:00').toLocaleDateString() : 'N/A'}
        </p>
      </div>
      
      <div>
        <label className="paper-label">Notes (Markdown + LaTeX supported)</label>
        <textarea
          className="paper-textarea h-32 w-full"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Write your notes about this reading session..."
        />
        <div className="mt-3 flex items-center justify-end gap-3">
          <button onClick={onCancel} className="btn-secondary btn-small">
            Cancel
          </button>
          <button onClick={handleSave} className="btn-primary btn-small" disabled={saving === 'saving'}>
            {saving === 'saving' ? (
              <span className="inline-flex items-center gap-2"><Loader2 className="h-3 w-3 animate-spin" /> Saving...</span>
            ) : 'Save'}
          </button>
          <div className="text-xs">
            {saving === 'saved' && <span className="text-green-600">Saved</span>}
            {saving === 'error' && <span className="text-red-600">Save failed</span>}
          </div>
        </div>
        {notes.trim() && (
          <div className="mt-4">
            <div className="text-xs text-gray-600 mb-2 text-elegant">Preview</div>
            <div className="prose prose-gray max-w-none bg-gray-50 rounded-lg p-4 border border-gray-100">
              <ReactMarkdown remarkPlugins={[remarkGfm, remarkMath]} rehypePlugins={[rehypeKatex]}>
                {notes}
              </ReactMarkdown>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default function HistoryPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const { hasKey, isReady, decryptSafely, encrypt } = useE2EE()
  const { generateMonthlySummaries } = useMonthlySummary() // This will auto-trigger monthly summary generation
  useYearlySummary() // This will auto-trigger yearly summary generation
  
  const [journals, setJournals] = useState<Journal[]>([])
  const [weeklySummaries, setWeeklySummaries] = useState<HierarchicalSummary[]>([])
  const [monthlySummaries, setMonthlySummaries] = useState<HierarchicalSummary[]>([])
  const [yearlySummaries, setYearlySummaries] = useState<HierarchicalSummary[]>([])
  const [readingReflections, setReadingReflections] = useState<ReadingReflection[]>([])
  const [readingLogs, setReadingLogs] = useState<DecryptedReadingLog[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedView, setSelectedView] = useState<'journals' | 'summaries' | 'reflections' | 'logs'>('journals')
  const [showCoolingPeriodMessage, setShowCoolingPeriodMessage] = useState(false)
  const [coolingPeriodMessage, setCoolingPeriodMessage] = useState('')
  const [deletingReflectionId, setDeletingReflectionId] = useState<string | null>(null)
  const [deletingLogId, setDeletingLogId] = useState<string | null>(null)
  const [editingLogId, setEditingLogId] = useState<string | null>(null)
  const [errorModal, setErrorModal] = useState<{ isOpen: boolean; title: string; message: string }>({ isOpen: false, title: '', message: '' })


  useEffect(() => {
    if (status === 'loading' || !hasKey || !isReady) return
    
    if (status === 'unauthenticated') {
      router.push('/')
      return
    }

    fetchHistoryData()
  }, [status, session, hasKey, isReady, router])

  const fetchHistoryData = async () => {
    try {
      setLoading(true)
      
      // Fetch past journals
      const journalsResponse = await fetch('/api/journal')
      
      if (journalsResponse.ok) {
        const { journals: encryptedJournals } = await journalsResponse.json()
        
        // Decrypt journal data
        const decryptedJournals = await Promise.all(
          encryptedJournals.map(async (journal: Journal) => {
            try {
              return {
                ...journal,
                title: journal.title ? await decryptSafely(journal.title) : null,
                content: await decryptSafely(journal.content),
                mood: journal.mood ? await decryptSafely(journal.mood) : null,
                tags: await Promise.all(journal.tags.map(async (tag: any) => await decryptSafely(tag))),
                dailySummary: journal.dailySummary ? {
                  ...journal.dailySummary,
                  content: await decryptSafely(journal.dailySummary.content),
                  mood: journal.dailySummary.mood ? await decryptSafely(journal.dailySummary.mood) : null,
                  keyTopics: await Promise.all(journal.dailySummary.keyTopics.map(async (topic: any) => await decryptSafely(topic)))
                } : undefined
              }
            } catch (error) {
              console.error('Failed to decrypt journal:', journal.id, error)
              return null
            }
          })
        )
        
        const validJournals = decryptedJournals.filter(journal => journal !== null)
        setJournals(validJournals)
        

      }

      // Fetch reading reflections
      const reflectionsResponse = await fetch('/api/reading/reflections')
      
      if (reflectionsResponse.ok) {
        const { reflections: encryptedReflections } = await reflectionsResponse.json()
        
        // Decrypt reflection data
        const decryptedReflections = await Promise.all(
          encryptedReflections.map(async (reflection: ReadingReflection) => {
            try {
              // Decrypt the structured reflection data
              const decryptedResponse = await decryptSafely(reflection.response)
              const decryptedData = decryptedResponse ? JSON.parse(decryptedResponse) : null
              return {
                ...reflection,
                decryptedData,
                reading: {
                  ...reflection.reading,
                  decryptedTitle: await decryptSafely(reflection.reading.title)
                }
              }
            } catch (error) {
              console.warn('Failed to decrypt reflection:', reflection.id, error)
              return {
                ...reflection,
                decryptedData: null,
                reading: {
                  ...reflection.reading,
                  decryptedTitle: 'Encrypted Document'
                }
              }
            }
          })
        )
        
        setReadingReflections(decryptedReflections)
      }

      // Fetch hierarchical summaries
      const [weeklyRes, monthlyRes, yearlyRes] = await Promise.all([
        fetch('/api/journal/hierarchical-summary/save?type=weekly'),
        fetch('/api/journal/hierarchical-summary/save?type=monthly'),
        fetch('/api/journal/hierarchical-summary/save?type=yearly')
      ])

      if (weeklyRes.ok) {
        const { summaries } = await weeklyRes.json()
        const decryptedWeekly = await Promise.all(
          summaries.map(async (summary: HierarchicalSummary) => {
            try {
              return {
                ...summary,
                content: await decryptSafely(summary.content)
              }
            } catch (error) {
              console.error('Failed to decrypt weekly summary:', summary.id, error)
              return null
            }
          })
        )
        const validWeekly = decryptedWeekly.filter(summary => summary !== null)
        setWeeklySummaries(validWeekly)
      }

      if (monthlyRes.ok) {
        const { summaries } = await monthlyRes.json()
        const decryptedMonthly = await Promise.all(
          summaries.map(async (summary: any) => {
            try {
              return {
                ...summary,
                content: await decryptSafely(summary.content)
              }
            } catch (error) {
              console.error('Failed to decrypt monthly summary:', summary.id, error)
              return null
            }
          })
        )
        const validMonthly = decryptedMonthly.filter(summary => summary !== null)
        setMonthlySummaries(validMonthly)
      }

      if (yearlyRes.ok) {
        const { summaries } = await yearlyRes.json()
        const decryptedYearly = await Promise.all(
          summaries.map(async (summary: any) => {
            try {
              return {
                ...summary,
                content: await decryptSafely(summary.content)
              }
            } catch (error) {
              console.error('Failed to decrypt yearly summary:', summary.id, error)
              return null
            }
          })
        )
        const validYearly = decryptedYearly.filter(summary => summary !== null)
        setYearlySummaries(validYearly)
      }

      // Fetch reading logs
      const logsResponse = await fetch('/api/reading/logs')
      if (logsResponse.ok) {
        const { readingLogs: encryptedLogs } = await logsResponse.json()
        const decryptedLogs = await Promise.all(
          encryptedLogs.map(async (log: ReadingLog) => {
            try {
              return {
                ...log,
                notes: log.notes ? await decryptSafely(log.notes) : null,
                sessionDate: log.sessionDate ? await decryptSafely(log.sessionDate) : null,
                reading: {
                  ...log.reading,
                  decryptedTitle: log.reading.title ? await decryptSafely(log.reading.title) : null
                }
              }
            } catch (error) {
              console.warn('Failed to decrypt reading log:', log.id, error)
              return null
            }
          })
        )
        const validLogs = decryptedLogs.filter((log): log is DecryptedReadingLog => log !== null)
        setReadingLogs(validLogs)
      }

      // Fetch debugging data
      
      
    } catch (error) {
      console.error('Failed to fetch history data:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleEditAttempt = (journal: Journal) => {
    if (journal.isInCoolingPeriod) {
      setCoolingPeriodMessage('To help maintain authentic self-reflection, journals cannot be edited for 7 days after creation. This prevents second-guessing your genuine thoughts and feelings.')
      setShowCoolingPeriodMessage(true)
      return
    }
    
    // Navigate to journal editor
    router.push(`/journal?edit=${journal.id}`)
  }

  const handleDeleteAttempt = async (journal: Journal) => {
    if (journal.isInCoolingPeriod) {
      setCoolingPeriodMessage('To help maintain authentic self-reflection, journals cannot be deleted for 7 days after creation. This prevents second-guessing your genuine thoughts and feelings.')
      setShowCoolingPeriodMessage(true)
      return
    }

    if (confirm('Are you sure you want to delete this journal? This action cannot be undone.')) {
      try {
        const response = await fetch(`/api/journal?id=${journal.id}`, {
          method: 'DELETE'
        })
        
        if (response.ok) {
          setJournals(journals.filter(j => j.id !== journal.id))
        } else {
          const error = await response.json()
          setErrorModal({ isOpen: true, title: 'Delete Failed', message: error.error || 'Failed to delete journal' })
        }
      } catch (error) {
        console.error('Failed to delete journal:', error)
        setErrorModal({ isOpen: true, title: 'Delete Failed', message: 'Failed to delete journal' })
      }
    }
  }

  const handleDeleteWeeklySummary = async (summaryId: string) => {
    if (confirm('Are you sure you want to delete this weekly summary? This action cannot be undone.')) {
      try {
        const response = await fetch(`/api/journal/hierarchical-summary/delete`, {
          method: 'DELETE',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            type: 'weekly',
            summaryId
          })
        })

        if (response.ok) {
          // Remove from state
          setWeeklySummaries(prev => prev.filter(s => s.id !== summaryId))
          // Success - no alert needed
        } else {
          const error = await response.json()
          setErrorModal({ isOpen: true, title: 'Delete Failed', message: `Failed to delete weekly summary: ${error.error || 'Unknown error'}` })
        }
      } catch (error) {
        console.error('Failed to delete weekly summary:', error)
        setErrorModal({ isOpen: true, title: 'Delete Failed', message: 'Failed to delete weekly summary. Please try again.' })
      }
    }
  }

  const handleDeleteMonthlySummary = async (summaryId: string) => {
    if (confirm('Are you sure you want to delete this monthly summary? This action cannot be undone.')) {
      try {
        const response = await fetch(`/api/journal/hierarchical-summary/delete`, {
          method: 'DELETE',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            type: 'monthly',
            summaryId
          })
        })

        if (response.ok) {
          // Remove from state
          setMonthlySummaries(prev => prev.filter(s => s.id !== summaryId))
          // Success - no alert needed
        } else {
          const error = await response.json()
          setErrorModal({ isOpen: true, title: 'Delete Failed', message: `Failed to delete monthly summary: ${error.error || 'Unknown error'}` })
        }
      } catch (error) {
        console.error('Failed to delete monthly summary:', error)
        setErrorModal({ isOpen: true, title: 'Delete Failed', message: 'Failed to delete monthly summary. Please try again.' })
      }
    }
  }

  const handleDeleteYearlySummary = async (summaryId: string) => {
    if (confirm('Are you sure you want to delete this yearly summary? This action cannot be undone.')) {
      try {
        const response = await fetch(`/api/journal/hierarchical-summary/delete`, {
          method: 'DELETE',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            type: 'yearly',
            summaryId
          })
        })

        if (response.ok) {
          // Remove from state
          setYearlySummaries(prev => prev.filter(s => s.id !== summaryId))
          // Success - no alert needed
        } else {
          const error = await response.json()
          setErrorModal({ isOpen: true, title: 'Delete Failed', message: `Failed to delete yearly summary: ${error.error || 'Unknown error'}` })
        }
      } catch (error) {
        console.error('Failed to delete yearly summary:', error)
        setErrorModal({ isOpen: true, title: 'Delete Failed', message: 'Failed to delete yearly summary. Please try again.' })
      }
    }
  }

  const handleDeleteReflection = async (reflectionId: string) => {
    if (confirm('Are you sure you want to delete this reading reflection? This action cannot be undone.')) {
      setDeletingReflectionId(reflectionId)
      try {
        const response = await fetch(`/api/reading/reflect/${reflectionId}`, {
          method: 'DELETE'
        })

        if (response.ok) {
          // Remove from state
          setReadingReflections(prev => prev.filter(r => r.id !== reflectionId))
          // Success - no alert needed
        } else {
          const error = await response.json()
          setErrorModal({ isOpen: true, title: 'Delete Failed', message: `Failed to delete reflection: ${error.error || 'Unknown error'}` })
        }
      } catch (error) {
        console.error('Failed to delete reflection:', error)
        setErrorModal({ isOpen: true, title: 'Delete Failed', message: 'Failed to delete reflection. Please try again.' })
      } finally {
        setDeletingReflectionId(null)
      }
    }
  }

  const handleDeleteLog = async (logId: string) => {
    if (confirm('Are you sure you want to delete this reading log? This action cannot be undone.')) {
      setDeletingLogId(logId)
      try {
        const response = await fetch(`/api/reading/logs?id=${logId}`, {
          method: 'DELETE'
        })

        if (response.ok) {
          // Remove from state
          setReadingLogs(prev => prev.filter(log => log.id !== logId))
          // Success - no alert needed
        } else {
          const error = await response.json()
          setErrorModal({ isOpen: true, title: 'Delete Failed', message: `Failed to delete reading log: ${error.error || 'Unknown error'}` })
        }
      } catch (error) {
        console.error('Failed to delete reading log:', error)
        setErrorModal({ isOpen: true, title: 'Delete Failed', message: 'Failed to delete reading log. Please try again.' })
      } finally {
        setDeletingLogId(null)
      }
    }
  }

  const handleEditLog = async (logId: string, notes: string) => {
    try {
      const encryptedNotes = await encrypt(notes)
      const response = await fetch(`/api/reading/logs?id=${logId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          notes: encryptedNotes
        })
      })

      if (response.ok) {
        // Update the log in state
        setReadingLogs(prev => prev.map(log => 
          log.id === logId 
            ? { ...log, notes } 
            : log
        ))
        setEditingLogId(null)
        // Success - no alert needed
      } else {
        const error = await response.json()
        setErrorModal({ isOpen: true, title: 'Update Failed', message: `Failed to update reading log: ${error.error || 'Unknown error'}` })
      }
    } catch (error) {
      console.error('Failed to update reading log:', error)
      setErrorModal({ isOpen: true, title: 'Update Failed', message: 'Failed to update reading log. Please try again.' })
    }
  }

  const handleToggleHiddenFromAI = async (summaryId: string, currentHiddenState: boolean) => {
    try {
      const response = await fetch('/api/journal/summary/save', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          summaryId,
          isHiddenFromAI: !currentHiddenState
        })
      })

      if (response.ok) {
        // Update the journal's daily summary in state
        setJournals(prev => prev.map(journal => {
          if (journal.dailySummary?.id === summaryId) {
            return {
              ...journal,
              dailySummary: {
                ...journal.dailySummary,
                isHiddenFromAI: !currentHiddenState
              }
            }
          }
          return journal
        }))
      } else {
        const error = await response.json()
        setErrorModal({ isOpen: true, title: 'Update Failed', message: `Failed to update summary: ${error.error || 'Unknown error'}` })
      }
    } catch (error) {
      console.error('Failed to toggle hidden from AI:', error)
      setErrorModal({ isOpen: true, title: 'Update Failed', message: 'Failed to update summary. Please try again.' })
    }
  }

  // Weekly summaries are automatically generated and should not be manually edited
  // This maintains consistency with the automatic generation pattern

  if (status === 'loading' || !hasKey || !isReady) {
    return (
      <div className="page-container paper-texture">
        <div className="content-wrapper-7xl">
          <div className="paper-loading">
            <div className="paper-loading-spinner"></div>
            <div className="loading-text text-elegant ml-3">Loading your history...</div>
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
              <Archive className="h-8 w-8 text-gray-600" />
            </div>
            <div>
              <h1 className="heading-primary text-elegant mb-2">
                Your Journey History
              </h1>
              <p className="text-paper-secondary text-lg text-elegant">
                Reflect on your past thoughts and see how you&apos;ve grown over time. You can control which daily summaries are shared with AI for better privacy.
              </p>
            </div>
          </div>
        </div>

        {/* View Selector */}
        <div className="paper-nav mb-8">
          <button
            onClick={() => setSelectedView('journals')}
            className={`paper-nav-item ${
              selectedView === 'journals' ? 'active' : ''
            }`}
          >
            <PenTool className="h-4 w-4 mr-2" />
            Past Daily Journals
          </button>
          <button
            onClick={() => setSelectedView('reflections')}
            className={`paper-nav-item ${
              selectedView === 'reflections' ? 'active' : ''
            }`}
          >
            <BookOpen className="h-4 w-4 mr-2" />
            Reading Reflections
          </button>
          <button
            onClick={() => setSelectedView('logs')}
            className={`paper-nav-item ${
              selectedView === 'logs' ? 'active' : ''
            }`}
          >
            <FileText className="h-4 w-4 mr-2" />
            Reading Logs
          </button>
          <button
            onClick={() => setSelectedView('summaries')}
            className={`paper-nav-item ${
              selectedView === 'summaries' ? 'active' : ''
            }`}
          >
            <Calendar className="h-4 w-4 mr-2" />
            Hierarchical Summaries
          </button>
        </div>

        {loading ? (
          <div className="paper-loading">
            <div className="paper-loading-spinner"></div>
            <div className="loading-text text-elegant ml-3">Loading...</div>
          </div>
        ) : selectedView === 'journals' ? (
          <div className="space-y-6">
            {/* Cooling Period Notice */}
            <div className="paper-card paper-spacing-md bg-gray-50 border-gray-200">
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                  <span className="text-gray-600 text-sm font-medium">!</span>
                </div>
                <div>
                  <h3 className="text-sm font-medium text-gray-800 mb-2 text-elegant">Cooling Period</h3>
                  <p className="text-sm text-gray-700 text-elegant leading-relaxed">
                    I know I, like many others, have a tendency to second-guess my own thoughts and feelings. To support more authentic self-reflection, I&apos;ve set a 7-day cooling period for journal entries. During this time, entries cannot be edited or deleted. However, you can choose to hide specific daily summaries from AI processing. Hidden summaries will not contribute to weekly or monthly reports, nor will they be used as context in AI conversations.
                  </p>
                </div>
              </div>
            </div>
            
            {journals.length === 0 ? (
              <div className="paper-empty">
                <div className="paper-empty-icon">
                  <PenTool className="h-12 w-12 text-gray-400" />
                </div>
                <div className="paper-empty-title text-elegant">No journal entries yet</div>
                <div className="paper-empty-description text-elegant">Start writing to see your history here!</div>
              </div>
            ) : (
              <div className="paper-list">
                {journals.map((journal) => (
                  <div key={journal.id} className="paper-card paper-spacing-md">
                    <div className="flex justify-between items-start mb-4">
                      <div className="flex-1">
                        <h3 className="text-lg font-semibold text-paper text-elegant mb-2">
                          {journal.title || `Journal Entry - ${formatJournalDate(journal.date, 'UTC')}`}
                        </h3>
                        <div className="flex items-center gap-4 text-sm text-paper-secondary text-elegant">
                          <span>{formatJournalDate(journal.date, 'UTC')}</span>
                          <span>•</span>
                          <span>{journal.isPast ? 'Past Entry' : 'Current Entry'}</span>
                                                     {journal.isInCoolingPeriod && (
                             <>
                               <span>•</span>
                               <span className="text-gray-600">7-day cooling period active</span>
                             </>
                           )}
                        </div>
                      </div>
                      <div className="flex space-x-2 ml-4">
                        <button
                          onClick={() => handleEditAttempt(journal)}
                          className={`text-sm px-3 py-1.5 rounded-lg transition-colors ${
                            journal.canEdit
                              ? 'bg-gray-100 text-paper hover:bg-gray-200 text-elegant'
                              : 'bg-gray-50 text-paper-secondary cursor-not-allowed text-elegant'
                          }`}
                          disabled={!journal.canEdit}
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => handleDeleteAttempt(journal)}
                          className={`text-sm px-3 py-1.5 rounded-lg transition-colors ${
                            journal.canDelete
                              ? 'btn-danger-outline text-elegant'
                              : 'bg-gray-50 text-paper-secondary cursor-not-allowed text-elegant'
                          }`}
                          disabled={!journal.canDelete}
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                    
                    <div className="prose prose-sm max-w-none mb-4">
                      <p className="text-paper whitespace-pre-wrap line-clamp-3 text-elegant leading-relaxed">
                        {journal.content}
                      </p>
                    </div>
                    
                    <div className="flex flex-wrap items-center gap-3">
                      {journal.mood && (
                        <span className="paper-badge paper-badge-secondary text-elegant">
                          Mood: {journal.mood}
                        </span>
                      )}
                      
                      {journal.tags.length > 0 && (
                        journal.tags.map((tag, index) => (
                          <span
                            key={index}
                            className="paper-badge paper-badge-secondary text-elegant"
                          >
                            {tag}
                          </span>
                        ))
                      )}
                    </div>
                    
                    {journal.dailySummary && (
                      <div className={`mt-4 p-4 rounded-lg border-l-4 ${
                        journal.dailySummary.isHiddenFromAI 
                          ? 'bg-gray-100 border-gray-500' 
                          : 'bg-gray-50 border-gray-400'
                      }`}>
                        <div className="flex justify-between items-start mb-3">
                          <h4 className="text-sm font-medium text-paper text-elegant">
                            Daily Summary
                            {journal.dailySummary.isHiddenFromAI && (
                              <span className="ml-2 paper-badge paper-badge-secondary">
                                Hidden from AI
                              </span>
                            )}
                          </h4>
                          <button
                            onClick={() => handleToggleHiddenFromAI(journal.dailySummary!.id, journal.dailySummary!.isHiddenFromAI)}
                            className={`text-sm px-3 py-1.5 rounded-lg transition-colors ${
                              journal.dailySummary!.isHiddenFromAI
                                ? 'bg-gray-200 text-gray-800 hover:bg-gray-300'
                                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                            } text-elegant`}
                            title={journal.dailySummary!.isHiddenFromAI ? 'Show to AI' : 'Hide from AI'}
                          >
                            {journal.dailySummary!.isHiddenFromAI ? 'Show to AI' : 'Hide from AI'}
                          </button>
                        </div>
                        <p className="text-sm text-paper-secondary text-elegant leading-relaxed">{journal.dailySummary.content}</p>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : selectedView === 'reflections' ? (
          <div className="space-y-6">
            {readingReflections.length === 0 ? (
              <div className="paper-empty">
                <div className="paper-empty-icon">
                  <BookOpen className="h-12 w-12 text-gray-400" />
                </div>
                <div className="paper-empty-title text-elegant">No reading reflections yet</div>
                <div className="paper-empty-description text-elegant">Generate reflections from your reading sessions!</div>
              </div>
            ) : (
              readingReflections.map((reflection) => (
                <div key={reflection.id} className="paper-card paper-spacing-md">
                  <div className="mb-6">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <h3 className="card-title text-elegant mb-2">
                          Reading Reflection
                        </h3>
                        <div className="flex items-center gap-4 text-sm text-gray-500 text-elegant">
                          <span>Document: {(reflection.reading as any).decryptedTitle}</span>
                          <span>•</span>
                          <span>{new Date(reflection.createdAt).toLocaleDateString()}</span>
                        </div>
                      </div>
                                                                    <button
                        onClick={() => handleDeleteReflection(reflection.id)}
                        disabled={deletingReflectionId === reflection.id}
                        className="btn-danger-outline text-sm px-3 py-1.5 rounded-lg disabled:opacity-50"
                      >
                        {deletingReflectionId === reflection.id ? (
                          <span className="inline-flex items-center gap-2"><Loader2 className="h-3 w-3 animate-spin" /> Deleting...</span>
                        ) : (
                          'Delete'
                        )}
                      </button>
                    </div>
                  </div>
                  
                  {(reflection as any).decryptedData ? (
                    <div className="space-y-8">
                      {/* Prefer flashcard view if structured questions exist */}
                      {((reflection as any).decryptedData.socraticQuestions?.length || (reflection as any).decryptedData.extensionQuestions?.length) ? (
                        <div className="space-y-8">
                          {(reflection as any).decryptedData.socraticQuestions?.length > 0 && (
                            <div>
                              <h4 className="text-lg font-semibold text-gray-900 mb-4 text-elegant">Socratic Questions</h4>
                              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                                {(reflection as any).decryptedData.socraticQuestions.map((q: string, idx: number) => (
                                  <ReflectionAnswerCard
                                    key={`soc-${reflection.id}-${idx}`}
                                    kind="socratic"
                                    index={idx}
                                    question={q}
                                    answer={(reflection as any).decryptedData.userAnswers?.socratic?.[idx] || ''}
                                    onSave={async (value) => {
                                      const target = readingReflections.find(r => r.id === reflection.id) as any
                                      if (!target?.decryptedData) throw new Error('Missing reflection data')
                                      const next = { ...target.decryptedData, userAnswers: { socratic: [...(target.decryptedData.userAnswers?.socratic || [])], task2: [...(target.decryptedData.userAnswers?.task2 || [])] } }
                                      const arr = next.userAnswers.socratic
                                      for (let i = arr.length; i <= idx; i++) arr[i] = ''
                                      arr[idx] = value
                                      const encryptedReflectionData = await encrypt(JSON.stringify(next))
                                      const res = await fetch(`/api/reading/reflect/${reflection.id}`, {
                                        method: 'PATCH',
                                        headers: { 'Content-Type': 'application/json' },
                                        body: JSON.stringify({ encryptedReflectionData })
                                      })
                                      if (!res.ok) throw new Error('Failed to save')
                                      setReadingReflections(prev => prev.map(r => r.id === reflection.id ? ({ ...(r as any), decryptedData: next }) as any : r))
                                    }}
                                  />
                                ))}
                              </div>
                            </div>
                          )}

                          {(reflection as any).decryptedData.extensionQuestions?.length > 0 && (
                            <div>
                              <h4 className="text-lg font-semibold text-gray-900 mb-4 text-elegant">
                                {((reflection as any).decryptedData.metadata?.analysisType === 'cross-contextual') && 'Cross-Context Inspiration'}
                                {((reflection as any).decryptedData.metadata?.analysisType === 'temporal-progression') && 'Temporal Progression'}
                                {((reflection as any).decryptedData.metadata?.analysisType === 'beyond-the-reading') && 'Beyond the Reading'}
                                {(!((reflection as any).decryptedData.metadata?.analysisType)) && 'Extension Questions'}
                              </h4>
                              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                                {(reflection as any).decryptedData.extensionQuestions.map((q: string, idx: number) => (
                                  <ReflectionAnswerCard
                                    key={`ext-${reflection.id}-${idx}`}
                                    kind="task2"
                                    index={idx}
                                    question={q}
                                    answer={(reflection as any).decryptedData.userAnswers?.task2?.[idx] || ''}
                                    onSave={async (value) => {
                                      const target = readingReflections.find(r => r.id === reflection.id) as any
                                      if (!target?.decryptedData) throw new Error('Missing reflection data')
                                      const next = { ...target.decryptedData, userAnswers: { socratic: [...(target.decryptedData.userAnswers?.socratic || [])], task2: [...(target.decryptedData.userAnswers?.task2 || [])] } }
                                      const arr = next.userAnswers.task2
                                      for (let i = arr.length; i <= idx; i++) arr[i] = ''
                                      arr[idx] = value
                                      const encryptedReflectionData = await encrypt(JSON.stringify(next))
                                      const res = await fetch(`/api/reading/reflect/${reflection.id}`, {
                                        method: 'PATCH',
                                        headers: { 'Content-Type': 'application/json' },
                                        body: JSON.stringify({ encryptedReflectionData })
                                      })
                                      if (!res.ok) throw new Error('Failed to save')
                                      setReadingReflections(prev => prev.map(r => r.id === reflection.id ? ({ ...(r as any), decryptedData: next }) as any : r))
                                    }}
                                  />
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      ) : null}
                      
                      {/* Metadata */}
                      {(reflection as any).decryptedData.metadata && (
                        <div className="border-t border-gray-200 pt-6">
                          <div className="text-xs text-gray-500 space-y-1 text-elegant">
                            <p>Reading sessions analyzed: {(reflection as any).decryptedData.metadata.readingLogs}</p>
                            <p>Documents analyzed: {(reflection as any).decryptedData.metadata.documentsAnalyzed}</p>
                            <p>Content chunks retrieved: {(reflection as any).decryptedData.metadata.retrievedChunks}</p>
                          </div>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="text-center py-8">
                      <p className="text-gray-500 text-elegant">Unable to decrypt reflection content.</p>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        ) : selectedView === 'logs' ? (
          <div className="space-y-6">
            {readingLogs.length === 0 ? (
              <div className="paper-empty">
                <div className="paper-empty-icon">
                  <FileText className="h-12 w-12 text-gray-400" />
                </div>
                <div className="paper-empty-title text-elegant">No reading logs yet</div>
                <div className="paper-empty-description text-elegant">Start a reading session to see your logs here!</div>
              </div>
            ) : (
              readingLogs.map((log) => (
                <div key={log.id} className="paper-card paper-spacing-md">
                  {editingLogId === log.id ? (
                    <ReadingLogEditCard
                      log={log as DecryptedReadingLog}
                      onSave={async (notes) => await handleEditLog(log.id, notes)}
                      onCancel={() => setEditingLogId(null)}
                    />
                  ) : (
                    <>
                      <div className="mb-4">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <h3 className="card-title text-elegant mb-2">
                              Reading Log
                            </h3>
                            <div className="flex items-center gap-4 text-sm text-gray-500 text-elegant">
                              <span>Document: {(log.reading as any).decryptedTitle}</span>
                              <span>•</span>
                              <span>{log.sessionDate ? new Date(log.sessionDate + 'T00:00:00').toLocaleDateString() : 'N/A'}</span>
                            </div>
                          </div>
                          <div className="flex space-x-2 ml-4">
                            <button
                              onClick={() => setEditingLogId(log.id)}
                              className="text-sm px-3 py-1.5 rounded-lg transition-colors bg-gray-100 text-gray-700 hover:bg-gray-200 text-elegant"
                            >
                              Edit
                            </button>
                            <button
                              onClick={() => handleDeleteLog(log.id)}
                              disabled={deletingLogId === log.id}
                              className="btn-danger-outline text-sm px-3 py-1.5 rounded-lg disabled:opacity-50"
                            >
                              {deletingLogId === log.id ? (
                                <span className="inline-flex items-center gap-2"><Loader2 className="h-3 w-3 animate-spin" /> Deleting...</span>
                              ) : (
                                'Delete'
                              )}
                            </button>
                          </div>
                        </div>
                      </div>
                      
                      <div className="prose prose-sm max-w-none">
                        <p className="text-gray-700 whitespace-pre-wrap text-elegant leading-relaxed">
                          {log.notes || 'No notes provided.'}
                        </p>
                      </div>
                    </>
                  )}
                </div>
              ))
            )}
          </div>
        ) : selectedView === 'summaries' ? (
          <div className="space-y-8">
            <div className="paper-card paper-spacing-md bg-gray-50 border-gray-200">
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                  <Calendar className="h-4 w-4 text-gray-600" />
                </div>
                <div>
                  <h2 className="heading-secondary text-elegant mb-2">Hierarchical Summaries</h2>
                  <p className="text-body text-elegant text-gray-700">
                    We turn your past entries into weekly, monthly, and yearly summaries, so the AI can better understand your journey and guide you forward. You control what&apos;s kept for context.
                  </p>
                </div>
              </div>
            </div>
            
            {/* Weekly Summaries */}
            <div>
              <h3 className="text-xl font-semibold text-gray-900 text-elegant mb-4">Weekly Summaries</h3>
              {weeklySummaries.length === 0 ? (
                <div className="paper-empty">
                  <div className="paper-empty-description text-elegant">No weekly summaries yet.</div>
                </div>
              ) : (
                <div className="space-y-4">
                  {weeklySummaries.map((summary) => (
                    <div key={summary.id} className="paper-card paper-spacing-md">
                      <div className="flex justify-between items-start mb-3">
                        <h4 className="font-medium text-gray-900 text-elegant">
                          Week of {new Date(summary.startDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                        </h4>
                        <button
                          onClick={() => handleDeleteWeeklySummary(summary.id)}
                          className="btn-danger-outline text-sm px-3 py-1.5 rounded-lg"
                        >
                          Delete
                        </button>
                      </div>
                      <p className="text-gray-700 whitespace-pre-wrap text-elegant leading-relaxed">{summary.content}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Monthly Summaries */}
            <div>
              <h3 className="text-xl font-semibold text-gray-900 text-elegant mb-4">Monthly Summaries</h3>
              {monthlySummaries.length === 0 ? (
                <div className="paper-empty">
                  <div className="paper-empty-description text-elegant">No monthly summaries yet.</div>
                </div>
              ) : (
                <div className="space-y-4">
                  {monthlySummaries.map((summary) => (
                    <div key={summary.id} className="paper-card paper-spacing-md">
                      <div className="flex justify-between items-start mb-3">
                        <h4 className="font-medium text-gray-900 text-elegant">
                          {new Date(summary.startDate).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
                        </h4>
                        <button
                          onClick={() => handleDeleteMonthlySummary(summary.id)}
                          className="btn-danger-outline text-sm px-3 py-1.5 rounded-lg"
                        >
                          Delete
                        </button>
                      </div>
                      <p className="text-gray-700 text-elegant leading-relaxed">{summary.content}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Yearly Summaries */}
            <div>
              <h3 className="text-xl font-semibold text-gray-900 text-elegant mb-4">Yearly Summaries</h3>
              {yearlySummaries.length === 0 ? (
                <div className="paper-empty">
                  <div className="paper-empty-description text-elegant">No yearly summaries yet.</div>
                </div>
              ) : (
                <div className="space-y-4">
                  {yearlySummaries.map((summary) => (
                    <div key={summary.id} className="paper-card paper-spacing-md">
                      <div className="flex justify-between items-start mb-3">
                        <h4 className="font-medium text-gray-900 text-elegant">
                          {new Date(summary.startDate).getFullYear()}
                        </h4>
                        <button
                          onClick={() => handleDeleteYearlySummary(summary.id)}
                          className="btn-danger-outline text-sm px-3 py-1.5 rounded-lg"
                        >
                          Delete
                        </button>
                      </div>
                      <p className="text-gray-700 text-elegant leading-relaxed">{summary.content}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="paper-empty">
            <div className="paper-empty-description text-elegant">Invalid view selected.</div>
          </div>
        )}

        {/* Cooling Period Message Modal */}
        {showCoolingPeriodMessage && (
          <Modal isOpen={showCoolingPeriodMessage} onClose={() => setShowCoolingPeriodMessage(false)} maxWidth="md" showCloseButton={false}>
            <div className="p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-3 text-elegant">
                7-Day Cooling Period Active
              </h3>
              <p className="text-gray-700 mb-4 text-elegant leading-relaxed">
                {coolingPeriodMessage}
              </p>
              <button
                onClick={() => setShowCoolingPeriodMessage(false)}
                className="w-full bg-gray-900 text-white py-2 px-4 rounded hover:bg-gray-800 transition-colors text-elegant"
              >
                I Understand
              </button>
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