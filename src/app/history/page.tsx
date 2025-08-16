'use client'

import { useState, useEffect } from 'react'
import { Modal } from '@/components/ui/modal'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { useE2EE } from '@/hooks/useE2EE'
import { useMonthlySummary } from '@/hooks/useMonthlySummary'
import { useYearlySummary } from '@/hooks/useYearlySummary'
import { formatJournalDate } from '@/lib/date-utils'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { Archive, PenTool } from 'lucide-react'

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


export default function HistoryPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const { hasKey, isReady, decryptSafely } = useE2EE()
  const { generateMonthlySummaries } = useMonthlySummary() // This will auto-trigger monthly summary generation
  useYearlySummary() // This will auto-trigger yearly summary generation
  
  const [journals, setJournals] = useState<Journal[]>([])
  const [weeklySummaries, setWeeklySummaries] = useState<HierarchicalSummary[]>([])
  const [monthlySummaries, setMonthlySummaries] = useState<HierarchicalSummary[]>([])
  const [yearlySummaries, setYearlySummaries] = useState<HierarchicalSummary[]>([])
  const [readingReflections, setReadingReflections] = useState<ReadingReflection[]>([])
  const [readingLogs, setReadingLogs] = useState<ReadingLog[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedView, setSelectedView] = useState<'journals' | 'summaries' | 'reflections' | 'logs'>('journals')
  const [showCoolingPeriodMessage, setShowCoolingPeriodMessage] = useState(false)
  const [coolingPeriodMessage, setCoolingPeriodMessage] = useState('')


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
                content: await decryptSafely(summary.content),
                startDate: summary.startDate,
                endDate: summary.endDate
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
                content: await decryptSafely(summary.content),
                startDate: summary.monthStartDate,
                endDate: summary.monthEndDate
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
                content: await decryptSafely(summary.content),
                startDate: summary.yearStartDate,
                endDate: summary.yearEndDate
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
        const validLogs = decryptedLogs.filter((log): log is ReadingLog & { reading: { decryptedTitle: string | null }, sessionDate: string | null } => log !== null)
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
          alert(error.error || 'Failed to delete journal')
        }
      } catch (error) {
        console.error('Failed to delete journal:', error)
        alert('Failed to delete journal')
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
          alert('Weekly summary deleted successfully!')
        } else {
          const error = await response.json()
          alert(`Failed to delete weekly summary: ${error.error || 'Unknown error'}`)
        }
      } catch (error) {
        console.error('Failed to delete weekly summary:', error)
        alert('Failed to delete weekly summary. Please try again.')
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
          alert('Monthly summary deleted successfully!')
        } else {
          const error = await response.json()
          alert(`Failed to delete monthly summary: ${error.error || 'Unknown error'}`)
        }
      } catch (error) {
        console.error('Failed to delete monthly summary:', error)
        alert('Failed to delete monthly summary. Please try again.')
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
          alert('Yearly summary deleted successfully!')
        } else {
          const error = await response.json()
          alert(`Failed to delete yearly summary: ${error.error || 'Unknown error'}`)
        }
      } catch (error) {
        console.error('Failed to delete yearly summary:', error)
        alert('Failed to delete yearly summary. Please try again.')
      }
    }
  }

  // Weekly summaries are automatically generated and should not be manually edited
  // This maintains consistency with the automatic generation pattern

  if (status === 'loading' || !hasKey || !isReady) {
    return (
      <div className="page-container paper-texture">
        <div className="content-wrapper-4xl">
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
                Reflect on your past thoughts and see how you&apos;ve grown over time.
              </p>
            </div>
          </div>
        </div>

        {/* View Selector */}
        <div className="paper-nav mb-6">
          <button
            onClick={() => setSelectedView('journals')}
            className={`paper-nav-item ${
              selectedView === 'journals' ? 'active' : ''
            }`}
          >
            Past Daily Journals
          </button>
          <button
            onClick={() => setSelectedView('reflections')}
            className={`paper-nav-item ${
              selectedView === 'reflections' ? 'active' : ''
            }`}
          >
            Reading Reflections
          </button>
          <button
            onClick={() => setSelectedView('logs')}
            className={`paper-nav-item ${
              selectedView === 'logs' ? 'active' : ''
            }`}
          >
            Reading Logs
          </button>
          <button
            onClick={() => setSelectedView('summaries')}
            className={`paper-nav-item ${
              selectedView === 'summaries' ? 'active' : ''
            }`}
          >
            Hierarchical Summaries
          </button>
        </div>

        {loading ? (
          <div className="paper-loading">
            <div className="paper-loading-spinner"></div>
            <div className="loading-text text-elegant ml-3">Loading...</div>
          </div>
        ) : selectedView === 'journals' ? (
          <div className="paper-list">
            {journals.length === 0 ? (
              <div className="paper-empty">
                <div className="paper-empty-icon">
                  <PenTool className="h-8 w-8 text-gray-400" />
                </div>
                <div className="paper-empty-title text-elegant">No journal entries yet</div>
                <div className="paper-empty-description text-elegant">Start writing to see your history here!</div>
              </div>
            ) : (
              journals.map((journal) => (
                <div key={journal.id} className="paper-card paper-spacing-md">
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <h3 className="text-lg font-semibold text-paper text-elegant mb-2">
                        {journal.title || `Journal Entry - ${formatJournalDate(journal.date, 'UTC')}`}
                      </h3>
                      <p className="text-sm text-paper-secondary text-elegant">
                        {formatJournalDate(journal.date, 'UTC')} • 
                        {journal.isPast ? ' Past Entry' : ' Current Entry'}
                        {journal.isInCoolingPeriod && ' • 7-day cooling period active'}
                      </p>
                    </div>
                    <div className="flex space-x-2">
                      <button
                        onClick={() => handleEditAttempt(journal)}
                        className={`text-sm px-3 py-1 rounded transition-colors ${
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
                        className={`text-sm px-3 py-1 rounded transition-colors ${
                          journal.canDelete
                            ? 'bg-red-100 text-red-700 hover:bg-red-200 text-elegant'
                            : 'bg-gray-50 text-paper-secondary cursor-not-allowed text-elegant'
                        }`}
                        disabled={!journal.canDelete}
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                  
                  <div className="prose prose-sm max-w-none">
                    <p className="text-paper whitespace-pre-wrap line-clamp-3 text-elegant">
                      {journal.content}
                    </p>
                  </div>
                  
                  {journal.mood && (
                    <div className="mt-4">
                      <span className="paper-badge paper-badge-secondary text-elegant">
                        Mood: {journal.mood}
                      </span>
                    </div>
                  )}
                  
                  {journal.tags.length > 0 && (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {journal.tags.map((tag, index) => (
                        <span
                          key={index}
                          className="paper-badge paper-badge-secondary text-elegant"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  )}
                  
                  {journal.dailySummary && (
                    <div className="mt-4 p-3 bg-gray-50 rounded border-l-4 border-gray-400">
                      <h4 className="text-sm font-medium text-paper mb-2 text-elegant">Daily Summary</h4>
                      <p className="text-sm text-paper-secondary text-elegant">{journal.dailySummary.content}</p>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        ) : selectedView === 'reflections' ? (
          <div className="space-y-6">
            {readingReflections.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-gray-500 text-elegant">No reading reflections yet. Generate reflections from your reading sessions!</p>
              </div>
            ) : (
              readingReflections.map((reflection) => (
                <div key={reflection.id} className="paper-card">
                  <div className="mb-4">
                    <h3 className="card-title text-elegant mb-2">
                      Reading Reflection
                    </h3>
                    <p className="text-sm text-gray-500 text-elegant">
                      Document: {(reflection.reading as any).decryptedTitle} • 
                      {new Date(reflection.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                  
                  {(reflection as any).decryptedData ? (
                    <div className="space-y-6">
                      {/* Display the full AI-generated content */}
                      <div className="prose prose-sm max-w-none">
                        <ReactMarkdown 
                          remarkPlugins={[remarkGfm]}
                          components={{
                            h1: ({ children }) => <h1 className="text-xl font-bold mb-3 text-gray-900 font-serif">{children}</h1>,
                            h2: ({ children }) => <h2 className="text-lg font-semibold mb-2 text-gray-900 font-serif">{children}</h2>,
                            h3: ({ children }) => <h3 className="text-base font-medium mb-2 text-gray-900 font-serif">{children}</h3>,
                            p: ({ children }) => <p className="mb-3 text-gray-700 leading-relaxed font-serif">{children}</p>,
                            ul: ({ children }) => <ul className="mb-3 ml-6 list-disc text-gray-700">{children}</ul>,
                            ol: ({ children }) => <ol className="mb-3 ml-6 list-decimal text-gray-700">{children}</ol>,
                            li: ({ children }) => <li className="mb-1 font-serif">{children}</li>,
                            blockquote: ({ children }) => <blockquote className="border-l-4 border-gray-300 pl-4 mb-3 italic text-gray-600 font-serif">{children}</blockquote>,
                            code: ({ children }) => <code className="bg-gray-100 px-1 py-0.5 rounded text-sm font-mono">{children}</code>,
                            pre: ({ children }) => <pre className="bg-gray-100 p-3 rounded mb-3 overflow-x-auto font-mono text-sm">{children}</pre>,
                            strong: ({ children }) => <strong className="font-semibold text-gray-900">{children}</strong>,
                            em: ({ children }) => <em className="italic text-gray-800">{children}</em>
                          }}
                        >
                          {(reflection as any).decryptedData.content}
                        </ReactMarkdown>
                      </div>
                      
                      {/* Metadata */}
                      {(reflection as any).decryptedData.metadata && (
                        <div className="border-t border-gray-200 pt-4">
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
              <div className="text-center py-12">
                <p className="text-gray-500 text-elegant">No reading logs yet. Start a reading session to see your logs here!</p>
              </div>
            ) : (
              readingLogs.map((log) => (
                <div key={log.id} className="paper-card">
                  <div className="mb-4">
                    <h3 className="card-title text-elegant mb-2">
                      Reading Log
                    </h3>
                    <p className="text-sm text-gray-500 text-elegant">
                      Document: {(log.reading as any).decryptedTitle} • 
                      {log.sessionDate ? new Date(log.sessionDate + 'T00:00:00').toLocaleDateString() : 'N/A'}
                    </p>
                  </div>
                  
                  <div className="prose prose-sm max-w-none">
                    <p className="text-gray-700 whitespace-pre-wrap text-elegant">
                      {log.notes || 'No notes provided.'}
                    </p>
                  </div>
                </div>
              ))
            )}
          </div>
        ) : selectedView === 'summaries' ? (
          <div className="space-y-8">
            <div>
              <h2 className="heading-secondary text-elegant">Hierarchical Summaries</h2>
              <p className="text-body text-elegant mt-2">We turn your past entries into weekly, monthly, and yearly summaries, so the AI can better understand your journey and guide you forward. You control what&apos;s kept for context.</p>
            </div>
            
            {/* Weekly Summaries */}
            <div>
              <h3 className="text-xl font-semibold text-gray-900 text-elegant mb-4">Weekly Summaries</h3>
              {weeklySummaries.length === 0 ? (
                <p className="text-gray-500 text-elegant">No weekly summaries yet.</p>
              ) : (
                <div className="space-y-4">
                  {weeklySummaries.map((summary) => (
                    <div key={summary.id} className="paper-card">
                      <div className="flex justify-between items-start mb-2">
                        <h4 className="font-medium text-gray-900 text-elegant">
                          Week of {new Date(summary.startDate).toLocaleDateString()}
                        </h4>
                        <div className="flex space-x-2">
                          <button
                            onClick={() => handleDeleteWeeklySummary(summary.id)}
                            className="btn-danger-outline text-sm px-3 py-1"
                          >
                            Delete
                          </button>
                        </div>
                      </div>
                      <p className="text-gray-700 whitespace-pre-wrap text-elegant">{summary.content}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Monthly Summaries */}
            <div>
              <h3 className="text-xl font-semibold text-gray-900 text-elegant mb-4">Monthly Summaries</h3>
              {monthlySummaries.length === 0 ? (
                <p className="text-gray-500 text-elegant">No monthly summaries yet.</p>
              ) : (
                <div className="space-y-4">
                  {monthlySummaries.map((summary) => (
                    <div key={summary.id} className="paper-card">
                      <div className="flex justify-between items-start mb-2">
                        <h4 className="font-medium text-gray-900 text-elegant">
                          {new Date(summary.startDate).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
                        </h4>
                        <div className="flex space-x-2">
                          <button
                            onClick={() => handleDeleteMonthlySummary(summary.id)}
                            className="btn-danger-outline text-sm px-3 py-1"
                          >
                            Delete
                          </button>
                        </div>
                      </div>
                      <p className="text-gray-700 text-elegant">{summary.content}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Yearly Summaries */}
            <div>
              <h3 className="text-xl font-semibold text-gray-900 text-elegant mb-4">Yearly Summaries</h3>
              {yearlySummaries.length === 0 ? (
                <p className="text-gray-500 text-elegant">No yearly summaries yet.</p>
              ) : (
                <div className="space-y-4">
                  {yearlySummaries.map((summary) => (
                    <div key={summary.id} className="paper-card">
                      <div className="flex justify-between items-start mb-2">
                        <h4 className="font-medium text-gray-900 text-elegant">
                          {new Date(summary.startDate).getFullYear()}
                        </h4>
                        <div className="flex space-x-2">
                          <button
                            onClick={() => handleDeleteYearlySummary(summary.id)}
                            className="btn-danger-outline text-sm px-3 py-1"
                          >
                            Delete
                          </button>
                        </div>
                      </div>
                      <p className="text-gray-700 text-elegant">{summary.content}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="text-center py-12">
            <p className="text-gray-500 text-elegant">Invalid view selected.</p>
          </div>
        )}

        {/* Cooling Period Message Modal */}
        {showCoolingPeriodMessage && (
          <Modal isOpen={showCoolingPeriodMessage} onClose={() => setShowCoolingPeriodMessage(false)} maxWidth="md" showCloseButton={false}>
            <div className="p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-3 text-elegant">
                7-Day Cooling Period Active
              </h3>
              <p className="text-gray-700 mb-4 text-elegant">
                {coolingPeriodMessage}
              </p>
              <button
                onClick={() => setShowCoolingPeriodMessage(false)}
                className="w-full bg-gray-900 text-white py-2 px-4 rounded hover:bg-gray-800 transition-colors"
              >
                I Understand
              </button>
            </div>
          </Modal>
        )}
      </div>
    </div>
  )
}