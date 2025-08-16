"use client"

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { useE2EE } from '@/hooks/useE2EE'

type TabType = 'weekly' | 'monthly' | 'yearly'

interface ProgressSummary {
  id: string
  period: TabType
  startDate: string
  endDate: string
  content: string
  keyTopics: string[]
  generatedProof?: string
  createdAt: string
}

interface ProgressStats {
  weeklyProgress: ProgressSummary[]
  monthlyProgress: ProgressSummary[]
  yearlyProgress: ProgressSummary[]
}

export default function ProofOfProgress() {
  const { data: session } = useSession()
  const { decrypt, isReady } = useE2EE()
  const [progressStats, setProgressStats] = useState<ProgressStats>({
    weeklyProgress: [],
    monthlyProgress: [],
    yearlyProgress: []
  })
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<TabType>('weekly')

  const fetchProgressData = async () => {
    if (!session?.user || !isReady) {
      setIsLoading(false)
      return
    }

    try {
      setIsLoading(true)
      setError(null)

      // Fetch hierarchical summaries (weekly, monthly, yearly)
      const response = await fetch('/api/journal/hierarchical-summary', {
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        }
      })
      
      if (!response.ok) {
        throw new Error(`Failed to fetch progress data: ${response.status}`)
      }

      const data = await response.json()
      
      // Process and decrypt each type of summary
      const weeklyProgress: ProgressSummary[] = []
      const monthlyProgress: ProgressSummary[] = []
      const yearlyProgress: ProgressSummary[] = []

             // Process weekly summaries
       if (data.weeklySummaries) {
         for (const summary of data.weeklySummaries) {
           try {
             const decryptedContent = await decrypt(JSON.parse(summary.content))
             const decryptedKeyTopics = summary.keyTopics ? await Promise.all(
               summary.keyTopics.map((topic: string) => decrypt(JSON.parse(topic)))
             ) : []
             const decryptedProof = summary.generatedProof ? await decrypt(JSON.parse(summary.generatedProof)) : undefined

            weeklyProgress.push({
              id: summary.id,
              period: 'weekly',
              startDate: summary.weekStartDate,
              endDate: summary.weekEndDate,
              content: decryptedContent,
              keyTopics: decryptedKeyTopics,
              generatedProof: decryptedProof,
              createdAt: summary.createdAt
            })
          } catch (err) {
            console.error('Failed to decrypt weekly summary:', err)
          }
        }
      }

             // Process monthly summaries
       if (data.monthlySummaries) {
         for (const summary of data.monthlySummaries) {
           try {
             const decryptedContent = await decrypt(JSON.parse(summary.content))
             const decryptedKeyTopics = summary.keyTopics ? await Promise.all(
               summary.keyTopics.map((topic: string) => decrypt(JSON.parse(topic)))
             ) : []
             const decryptedProof = summary.generatedProof ? await decrypt(JSON.parse(summary.generatedProof)) : undefined

            monthlyProgress.push({
              id: summary.id,
              period: 'monthly',
              startDate: summary.monthStartDate,
              endDate: summary.monthEndDate,
              content: decryptedContent,
              keyTopics: decryptedKeyTopics,
              generatedProof: decryptedProof,
              createdAt: summary.createdAt
            })
          } catch (err) {
            console.error('Failed to decrypt monthly summary:', err)
          }
        }
      }

             // Process yearly summaries
       if (data.yearlySummaries) {
         for (const summary of data.yearlySummaries) {
           try {
             const decryptedContent = await decrypt(JSON.parse(summary.content))
             const decryptedKeyTopics = summary.keyTopics ? await Promise.all(
               summary.keyTopics.map((topic: string) => decrypt(JSON.parse(topic)))
             ) : []
             const decryptedProof = summary.generatedProof ? await decrypt(JSON.parse(summary.generatedProof)) : undefined

            yearlyProgress.push({
              id: summary.id,
              period: 'yearly',
              startDate: summary.yearStartDate,
              endDate: summary.yearEndDate,
              content: decryptedContent,
              keyTopics: decryptedKeyTopics,
              generatedProof: decryptedProof,
              createdAt: summary.createdAt
            })
          } catch (err) {
            console.error('Failed to decrypt yearly summary:', err)
          }
        }
      }

      // Sort all by date (most recent first)
      weeklyProgress.sort((a, b) => new Date(b.startDate).getTime() - new Date(a.startDate).getTime())
      monthlyProgress.sort((a, b) => new Date(b.startDate).getTime() - new Date(a.startDate).getTime())
      yearlyProgress.sort((a, b) => new Date(b.startDate).getTime() - new Date(a.startDate).getTime())

      setProgressStats({
        weeklyProgress,
        monthlyProgress,
        yearlyProgress
      })

    } catch (err) {
      console.error('Error fetching progress data:', err)
      setError(err instanceof Error ? err.message : 'Failed to fetch progress data')
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchProgressData()
  }, [session?.user, isReady])

  const formatDateRange = (startDate: string, endDate: string, period: TabType) => {
    const start = new Date(startDate)
    const end = new Date(endDate)
    
    if (period === 'weekly') {
      return `${start.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - ${end.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`
    } else if (period === 'monthly') {
      return start.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
    } else {
      return start.getFullYear().toString()
    }
  }

  if (isLoading) {
    return (
      <div className="text-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-400 mx-auto mb-4"></div>
        <p className="text-gray-600">Loading progress data...</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="text-center py-8">
        <div className="text-red-500 mb-2 text-lg">!</div>
        <p className="text-gray-600">Error loading progress data: {error}</p>
      </div>
    )
  }

  const getCurrentData = () => {
    switch (activeTab) {
      case 'weekly':
        return progressStats.weeklyProgress
      case 'monthly':
        return progressStats.monthlyProgress
      case 'yearly':
        return progressStats.yearlyProgress
      default:
        return []
    }
  }

  const currentData = getCurrentData()

  // Check if there are any summaries available
  const hasAnyData = progressStats.weeklyProgress.length > 0 || 
                    progressStats.monthlyProgress.length > 0 || 
                    progressStats.yearlyProgress.length > 0

  if (!hasAnyData) {
    return (
      <div className="text-center py-12">
        <div className="text-6xl mb-4 opacity-20 font-light">Progress</div>
        <p className="text-gray-600 mb-2 font-medium">No progress data yet</p>
        <p className="text-gray-500 text-sm">Start journaling to build your progress history.</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Tabs */}
      <div className="flex space-x-1 bg-gray-100 p-1 rounded-lg">
        {(['weekly', 'monthly', 'yearly'] as TabType[]).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`flex-1 py-2 px-3 text-sm font-medium rounded-md transition-all duration-200 capitalize ${
              activeTab === tab 
                ? 'bg-white text-gray-900 shadow-sm' 
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Content */}
      {currentData.length === 0 ? (
        <div className="text-center py-12">
          <div className="text-4xl mb-4 opacity-20 font-light">Progress</div>
          <div className="text-gray-600 mb-2 font-medium">
            No {activeTab} summaries available yet.
          </div>
          <div className="text-gray-500 text-sm">
            Continue journaling to build your progress history.
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          {currentData.slice(0, 3).map((summary) => (
            <div key={summary.id} className="bg-gray-50 rounded-xl p-4 border border-gray-200 hover:shadow-sm transition-all duration-200">
              <div className="flex items-center justify-between mb-3">
                <h4 className="font-semibold text-gray-900 text-sm">
                  {formatDateRange(summary.startDate, summary.endDate, summary.period)}
                </h4>
              </div>

              {/* Key Topics */}
              <div className="mb-4">
                <div className="flex flex-wrap gap-2">
                  {summary.keyTopics.slice(0, 4).map((topic, index) => (
                    <span
                      key={index}
                      className="px-2 py-1 bg-white text-gray-700 text-xs rounded-md border border-gray-300 font-medium"
                    >
                      {topic}
                    </span>
                  ))}
                  {summary.keyTopics.length > 4 && (
                    <span className="px-2 py-1 bg-white text-gray-500 text-xs rounded-md border border-gray-300 font-medium">
                      +{summary.keyTopics.length - 4}
                    </span>
                  )}
                </div>
              </div>

              {/* Encouraging Proof Only */}
              <div className="text-sm text-gray-700">
                {summary.generatedProof ? (
                  <div>
                    <div className="font-semibold text-gray-900 mb-2">Your Progress:</div>
                    <p className="leading-relaxed text-gray-600">{summary.generatedProof}</p>
                  </div>
                ) : (
                  <div>
                    <div className="font-semibold text-gray-900 mb-2">No encouraging proof available yet.</div>
                    <p className="text-gray-500 text-xs">The encouraging proof will be generated automatically with the next weekly summary.</p>
                  </div>
                )}
              </div>
            </div>
          ))}

          {currentData.length > 3 && (
            <div className="text-center pt-4">
              <button className="text-sm text-gray-600 hover:text-gray-900 border-b border-gray-300 hover:border-gray-600 transition-all duration-200 font-medium">
                View All {activeTab} Progress →
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}