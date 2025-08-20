"use client"

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'
import { useE2EE } from '@/hooks/useE2EE'
import { CalendarSync } from '@/components/features/roadmap/CalendarSync'
import type { EncryptedData } from '@/lib/client-encryption'
import { Map } from 'lucide-react'

interface Milestone {
  id: string
  title: string
  description?: string
  dueDate?: string // YYYY-MM-DD format
  status: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'OVERDUE'
  order: number
}

interface Roadmap {
  id: string
  title: string
  description?: string
  createdAt: string
  milestones: Milestone[]
}

export default function RoadmapPage() {
  const [roadmaps, setRoadmaps] = useState<Roadmap[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showCalendarSync, setShowCalendarSync] = useState(false)
  const [roadmapToSync, setRoadmapToSync] = useState<Roadmap | null>(null)
  
  // Inline editing state
  const [editingRoadmapTitle, setEditingRoadmapTitle] = useState<string | null>(null)
  const [editingRoadmapTitleValue, setEditingRoadmapTitleValue] = useState('')
  const [editingMilestone, setEditingMilestone] = useState<string | null>(null)
  const [editingMilestoneData, setEditingMilestoneData] = useState<{
    title: string
    description: string
    dueDate: string
  }>({ title: '', description: '', dueDate: '' })
  const [isUpdatingRoadmap, setIsUpdatingRoadmap] = useState(false)
  const [isUpdatingMilestone, setIsUpdatingMilestone] = useState(false)
  // Enhanced milestone display state
  const [expandedMilestone, setExpandedMilestone] = useState<string | null>(null)
  const [collapsedRoadmaps, setCollapsedRoadmaps] = useState<Set<string>>(new Set())

  const router = useRouter()
  useSession({
    required: true,
    onUnauthenticated() {
      router.push('/auth/signin')
    }
  })
  const { decrypt, encrypt, isReady, hasKey } = useE2EE()

  useEffect(() => {
    if (isReady && hasKey) {
      fetchRoadmaps()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isReady, hasKey])

  interface EncryptedMilestone {
    id: string
    title: EncryptedData
    description?: EncryptedData | null
    dueDate?: string | null
    status: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'OVERDUE'
    order: number
  }

  interface EncryptedRoadmap {
    id: string
    title: EncryptedData
    description?: EncryptedData | null
    createdAt: string
    milestones: EncryptedMilestone[]
  }

  const fetchRoadmaps = async () => {
    try {
      setIsLoading(true)
      const response = await fetch('/api/roadmap')
      
      if (!response.ok) {
        throw new Error('Failed to fetch roadmaps')
      }

      const data = await response.json()
      
      // Decrypt roadmap data
      const decryptedRoadmaps = await Promise.all(
        (data.roadmaps as EncryptedRoadmap[]).map(async (roadmap) => ({
          id: roadmap.id,
          createdAt: roadmap.createdAt,
          title: await decrypt(roadmap.title),
          description: roadmap.description ? await decrypt(roadmap.description) : undefined,
          milestones: await Promise.all(
            roadmap.milestones.map(async (milestone) => ({
              id: milestone.id,
              order: milestone.order,
              status: milestone.status,
              dueDate: milestone.dueDate || undefined,
              title: await decrypt(milestone.title),
              description: milestone.description ? await decrypt(milestone.description) : undefined
            }))
          )
        }))
      )

      setRoadmaps(decryptedRoadmaps)
    } catch (err) {
      console.error('Error fetching roadmaps:', err)
      setError('Failed to load roadmaps')
    } finally {
      setIsLoading(false)
    }
  }

  const toggleMilestoneCompletion = async (roadmapId: string, milestoneId: string) => {
    try {
      // Find current completion status
      const roadmap = roadmaps.find(r => r.id === roadmapId)
      const milestone = roadmap?.milestones.find(m => m.id === milestoneId)
      if (!milestone) return

      const newCompleted = milestone.status !== 'COMPLETED'

      // Update local state optimistically
      setRoadmaps(prevRoadmaps =>
        prevRoadmaps.map(roadmap =>
          roadmap.id === roadmapId
            ? {
                ...roadmap,
                milestones: roadmap.milestones.map(milestone =>
                  milestone.id === milestoneId
                    ? { ...milestone, status: newCompleted ? 'COMPLETED' : 'PENDING' }
                    : milestone
                )
              }
            : roadmap
        )
      )

      // Update on server
      const response = await fetch(`/api/roadmap/${roadmapId}/milestone/${milestoneId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ completed: newCompleted })
      })

      if (!response.ok) {
        // Revert local state on error
        setRoadmaps(prevRoadmaps =>
          prevRoadmaps.map(roadmap =>
            roadmap.id === roadmapId
              ? {
                  ...roadmap,
                  milestones: roadmap.milestones.map(milestone =>
                    milestone.id === milestoneId
                      ? { ...milestone, status: newCompleted ? 'PENDING' : 'COMPLETED' }
                      : milestone
                  )
                }
              : roadmap
          )
        )
        throw new Error('Failed to update milestone')
      }
    } catch (err) {
      console.error('Error updating milestone:', err)
      setError('Failed to update milestone completion')
    }
  }

  const isOverdue = (dueDate: string | undefined) => {
    if (!dueDate) return false
    // Compare YYYY-MM-DD strings directly
    const today = new Date().toISOString().split('T')[0]
    return dueDate < today
  }

  // Enhanced milestone interactions
  const toggleMilestoneExpansion = (milestoneId: string) => {
    setExpandedMilestone(prev => prev === milestoneId ? null : milestoneId)
  }

  const toggleRoadmapCollapse = (roadmapId: string) => {
    setCollapsedRoadmaps(prev => {
      const newSet = new Set(prev)
      if (newSet.has(roadmapId)) {
        newSet.delete(roadmapId)
      } else {
        newSet.add(roadmapId)
      }
      return newSet
    })
  }

  const formatDueDate = (dueDate: string | undefined) => {
    if (!dueDate) return null
    // Parse YYYY-MM-DD format directly to avoid timezone issues
    const [year, month, day] = dueDate.split('T')[0].split('-')
    const date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day))
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    })
  }

  const getMilestoneStatusClass = (milestone: Milestone) => {
    if (milestone.status === 'COMPLETED') return 'completed'
    if (milestone.status === 'IN_PROGRESS') return 'in-progress'
    if (isOverdue(milestone.dueDate)) return 'overdue'
    return 'pending'
  }

  // Roadmap title editing
  const startEditingRoadmapTitle = (roadmapId: string, currentTitle: string) => {
    setEditingRoadmapTitle(roadmapId)
    setEditingRoadmapTitleValue(currentTitle)
  }

  const cancelEditingRoadmapTitle = () => {
    setEditingRoadmapTitle(null)
    setEditingRoadmapTitleValue('')
  }

  const saveRoadmapTitle = async (roadmapId: string) => {
    if (!editingRoadmapTitleValue.trim()) {
      setError('Roadmap title cannot be empty')
      return
    }

    if (!hasKey) {
      setError('Encryption key is required')
      return
    }

    setIsUpdatingRoadmap(true)
    setError(null)

    try {
      const encryptedTitle = await encrypt(editingRoadmapTitleValue.trim())
      
      const response = await fetch(`/api/roadmap/${roadmapId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          encryptedTitle
        })
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to update roadmap title')
      }

      // Update local state
      setRoadmaps(prevRoadmaps =>
        prevRoadmaps.map(roadmap =>
          roadmap.id === roadmapId
            ? { ...roadmap, title: editingRoadmapTitleValue.trim() }
            : roadmap
        )
      )

      setEditingRoadmapTitle(null)
      setEditingRoadmapTitleValue('')
    } catch (err) {
      console.error('Error updating roadmap title:', err)
      setError(err instanceof Error ? err.message : 'Failed to update roadmap title')
    } finally {
      setIsUpdatingRoadmap(false)
    }
  }

  // Milestone editing
  const startEditingMilestone = (milestone: Milestone) => {
    setEditingMilestone(milestone.id)
    setEditingMilestoneData({
      title: milestone.title,
      description: milestone.description || '',
      dueDate: milestone.dueDate || ''
    })
  }

  const cancelEditingMilestone = () => {
    setEditingMilestone(null)
    setEditingMilestoneData({ title: '', description: '', dueDate: '' })
  }

  const saveMilestone = async (roadmapId: string, milestoneId: string) => {
    if (!editingMilestoneData.title.trim()) {
      setError('Milestone title cannot be empty')
      return
    }

    if (!hasKey) {
      setError('Encryption key is required')
      return
    }

    setIsUpdatingMilestone(true)
    setError(null)

    try {
      const encryptedTitle = await encrypt(editingMilestoneData.title.trim())
      const encryptedDescription = editingMilestoneData.description.trim() 
        ? await encrypt(editingMilestoneData.description.trim()) 
        : null
      
      const response = await fetch(`/api/roadmap/${roadmapId}/milestone/${milestoneId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          encryptedTitle,
          encryptedDescription,
          dueDate: editingMilestoneData.dueDate || null
        })
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to update milestone')
      }

      // Update local state
      setRoadmaps(prevRoadmaps =>
        prevRoadmaps.map(roadmap =>
          roadmap.id === roadmapId
            ? {
                ...roadmap,
                milestones: roadmap.milestones.map(milestone =>
                  milestone.id === milestoneId
                    ? {
                        ...milestone,
                        title: editingMilestoneData.title.trim(),
                        description: editingMilestoneData.description.trim() || undefined,
                        dueDate: editingMilestoneData.dueDate || undefined
                      }
                    : milestone
                )
              }
            : roadmap
        )
      )

      setEditingMilestone(null)
      setEditingMilestoneData({ title: '', description: '', dueDate: '' })
    } catch (err) {
      console.error('Error updating milestone:', err)
      setError(err instanceof Error ? err.message : 'Failed to update milestone')
    } finally {
      setIsUpdatingMilestone(false)
    }
  }

  const handleDeleteRoadmap = async (roadmapId: string) => {
    if (!confirm('Are you sure you want to delete this roadmap? This action cannot be undone.')) {
      return
    }

    try {
      const response = await fetch(`/api/roadmap/${roadmapId}`, {
        method: 'DELETE'
      })

      if (!response.ok) {
        throw new Error('Failed to delete roadmap')
      }

      await fetchRoadmaps()
    } catch (err) {
      console.error('Error deleting roadmap:', err)
      setError('Failed to delete roadmap')
    }
  }

  const handleDeleteMilestone = async (roadmapId: string, milestoneId: string) => {
    if (!confirm('Are you sure you want to delete this milestone?')) {
      return
    }

    try {
      const response = await fetch(`/api/roadmap/${roadmapId}/milestone/${milestoneId}`, {
        method: 'DELETE'
      })

      if (!response.ok) {
        throw new Error('Failed to delete milestone')
      }

      await fetchRoadmaps()
    } catch (err) {
      console.error('Error deleting milestone:', err)
      setError('Failed to delete milestone')
    }
  }

  if (!isReady || !hasKey) {
    return (
      <div className="page-container paper-texture">
        <div className="content-wrapper-7xl">
          <div className="paper-loading">
            <div className="paper-loading-spinner"></div>
            <div className="loading-text text-elegant ml-3">Loading...</div>
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
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
                          <div className="w-16 h-16 bg-gray-100 rounded-2xl flex items-center justify-center shadow-lg flex-shrink-0">
              <Map className="h-8 w-8 text-gray-600" />
            </div>
              <div>
                <h1 className="heading-primary text-elegant">
                  My Roadmaps
                </h1>
                <p className="text-paper-secondary text-lg text-elegant">
                  Manage your PhD journey roadmaps and track your progress.
                </p>
              </div>
            </div>
            <button
              onClick={() => router.push('/roadmap/create')}
              className="btn-primary"
            >
              + New Roadmap
            </button>
          </div>
        </div>

        {error && (
          <div className="paper-alert paper-alert-error mb-6">
            <div className="text-elegant">{error}</div>
          </div>
        )}

        {isLoading ? (
          <div className="paper-loading">
            <div className="paper-loading-spinner"></div>
            <div className="loading-text text-elegant ml-3">Loading roadmaps...</div>
          </div>
        ) : roadmaps.length === 0 ? (
          <div className="paper-empty">
            <div className="paper-empty-icon">
              <Map className="h-8 w-8 text-gray-400" />
            </div>
            <div className="paper-empty-title text-elegant">No roadmaps yet</div>
            <div className="paper-empty-description text-elegant">Create your first roadmap to start tracking your PhD journey.</div>
            <button
              onClick={() => router.push('/roadmap/create')}
              className="btn-primary mt-6"
            >
              Create Your First Roadmap
            </button>
          </div>
        ) : (
          <div className="space-y-8">
            {roadmaps.map((roadmap) => (
              <div key={roadmap.id} className="paper-card paper-elevated">
                {/* Roadmap Header */}
                <div className="border-b border-gray-200 pb-6 mb-6">
                  <div className="space-y-4">
                    {/* Title and Actions Row */}
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        {editingRoadmapTitle === roadmap.id ? (
                          <div className="space-y-3">
                            <input
                              type="text"
                              value={editingRoadmapTitleValue}
                              onChange={(e) => setEditingRoadmapTitleValue(e.target.value)}
                              className="form-input text-2xl font-semibold w-full"
                              autoFocus
                            />
                            <div className="flex items-center space-x-3">
                              <button
                                onClick={() => saveRoadmapTitle(roadmap.id)}
                                disabled={isUpdatingRoadmap}
                                className="btn-primary text-sm py-1 px-3"
                              >
                                {isUpdatingRoadmap ? 'Saving...' : 'Save'}
                              </button>
                              <button
                                onClick={cancelEditingRoadmapTitle}
                                className="text-sm font-medium text-gray-600 hover:text-gray-800"
                              >
                                Cancel
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div className="space-y-2">
                            <div className="flex items-center space-x-3">
                              <button
                                onClick={() => toggleRoadmapCollapse(roadmap.id)}
                                className="text-gray-400 hover:text-gray-600 transition-colors p-1 rounded flex-shrink-0"
                                title={collapsedRoadmaps.has(roadmap.id) ? "Expand roadmap" : "Collapse roadmap"}
                              >
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={collapsedRoadmaps.has(roadmap.id) ? "M9 5l7 7-7 7" : "M19 9l-7 7-7-7"} />
                                </svg>
                              </button>
                              <h2 className="heading-primary text-2xl mb-0 text-elegant flex-1">
                                {roadmap.title}
                              </h2>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation()
                                  startEditingRoadmapTitle(roadmap.id, roadmap.title)
                                }}
                                className="text-gray-400 hover:text-gray-600 transition-colors p-1 rounded flex-shrink-0"
                                title="Edit title"
                              >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                </svg>
                              </button>
                            </div>
                            {roadmap.description && (
                              <p className="text-paper-secondary text-lg text-elegant">
                                {roadmap.description}
                              </p>
                            )}
                          </div>
                        )}
                      </div>

                      {/* Action Buttons */}
                      <div className="flex items-center space-x-2 ml-6">
                        {roadmap.milestones.length > 0 && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              setRoadmapToSync(roadmap)
                              setShowCalendarSync(true)
                            }}
                            className="flex items-center space-x-2 text-sm text-gray-600 hover:text-gray-800 border border-gray-300 hover:border-gray-400 px-3 py-1.5 rounded-md transition-colors"
                            title="Sync to Calendar"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                            </svg>
                            <span>Sync</span>
                          </button>
                        )}
                        
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            handleDeleteRoadmap(roadmap.id)
                          }}
                          className="text-red-500 hover:text-red-700 transition-colors p-1.5 rounded-md hover:bg-red-50"
                          title="Delete Roadmap"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      </div>
                    </div>

                    {/* Progress Indicator */}
                    <div className="flex items-center space-x-4 pt-1">
                      <span className="text-sm text-gray-600 text-elegant whitespace-nowrap font-medium">
                        {roadmap.milestones.filter(m => m.status === 'COMPLETED').length} of {roadmap.milestones.length} completed
                      </span>
                      <div className="flex-1 max-w-lg">
                        <div className="w-full bg-gray-200 rounded-full h-3 shadow-inner">
                          <div 
                            className="bg-gradient-to-r from-gray-800 to-black h-3 rounded-full transition-all duration-300 shadow-sm"
                            style={{ 
                              width: `${roadmap.milestones.length > 0 
                                ? (roadmap.milestones.filter(m => m.status === 'COMPLETED').length / roadmap.milestones.length) * 100 
                                : 0}%` 
                            }}
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Milestones Timeline */}
                {!collapsedRoadmaps.has(roadmap.id) && (
                <div className="roadmap-timeline">
                  {roadmap.milestones.length === 0 ? (
                    <div className="paper-empty py-12">
                      <div className="paper-empty-icon">
                        <Map className="h-8 w-8 text-gray-400" />
                      </div>
                      <div className="paper-empty-title text-elegant">No milestones yet</div>
                      <div className="paper-empty-description text-elegant">Add milestones to start tracking your progress.</div>
                    </div>
                  ) : (
                    roadmap.milestones
                      .sort((a, b) => a.order - b.order)
                      .map((milestone, index) => (
                        <div key={milestone.id} className="timeline-item">
                          {/* Timeline Connector */}
                          <div className="timeline-connector">
                            <div className={`timeline-dot ${getMilestoneStatusClass(milestone)}`}>
                              {milestone.status === 'COMPLETED' && (
                                <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                </svg>
                              )}
                            </div>
                            {index < roadmap.milestones.length - 1 && (
                              <div className={`timeline-line ${milestone.status === 'COMPLETED' ? 'completed' : 'pending'}`} />
                            )}
                          </div>

                          {/* Timeline Content */}
                          <div className="timeline-content">
                            <div className="timeline-card">
                              <div className="timeline-card-header">
                                <div className="flex items-start space-x-3">
                                  <button
                                    onClick={() => toggleMilestoneCompletion(roadmap.id, milestone.id)}
                                    className={`w-5 h-5 rounded border-2 flex-shrink-0 transition-colors flex items-center justify-center mt-0.5 ${
                                      milestone.status === 'COMPLETED'
                                        ? 'bg-black border-black'
                                        : 'border-gray-300 hover:border-gray-400'
                                    }`}
                                    title={milestone.status === 'COMPLETED' ? 'Mark as pending' : 'Mark as completed'}
                                  >
                                    {milestone.status === 'COMPLETED' && (
                                      <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                      </svg>
                                    )}
                                  </button>
                                  
                                  <div className="flex-1 min-w-0">
                                    {editingMilestone === milestone.id ? (
                                      <input
                                        type="text"
                                        value={editingMilestoneData.title}
                                        onChange={(e) => setEditingMilestoneData(prev => ({ ...prev, title: e.target.value }))}
                                        className="form-input text-lg font-medium w-full"
                                        autoFocus
                                      />
                                    ) : (
                                      <h4 className={`text-lg font-medium mb-1 text-elegant ${
                                        milestone.status === 'COMPLETED' ? 'line-through text-gray-500' : 'text-gray-900'
                                      }`}>
                                        {milestone.title}
                                      </h4>
                                    )}
                                    
                                    {milestone.dueDate && (
                                      <div className="flex items-center space-x-2 text-sm">
                                        <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                        </svg>
                                        <span className={`${
                                          milestone.status === 'COMPLETED' 
                                            ? 'text-gray-400'
                                            : isOverdue(milestone.dueDate)
                                            ? 'text-red-600 font-medium'
                                            : 'text-gray-600'
                                        }`}>
                                          Due: {formatDueDate(milestone.dueDate)}
                                        </span>
                                        {milestone.status !== 'COMPLETED' && isOverdue(milestone.dueDate) && (
                                          <span className="paper-badge paper-badge-error text-xs">
                                            Overdue
                                          </span>
                                        )}
                                      </div>
                                    )}
                                  </div>
                                </div>
                              </div>

                              {/* Expandable Content */}
                              {(editingMilestone === milestone.id || 
                                (expandedMilestone === milestone.id && milestone.description)) && (
                                <div className="timeline-card-content">
                                  {editingMilestone === milestone.id ? (
                                    <div className="space-y-3">
                                      <textarea
                                        value={editingMilestoneData.description}
                                        onChange={(e) => setEditingMilestoneData(prev => ({ ...prev, description: e.target.value }))}
                                        className="form-textarea text-sm w-full"
                                        placeholder="Description (optional)"
                                        rows={3}
                                      />
                                      <input
                                        type="date"
                                        value={editingMilestoneData.dueDate}
                                        onChange={(e) => setEditingMilestoneData(prev => ({ ...prev, dueDate: e.target.value }))}
                                        className="form-input text-sm"
                                      />
                                    </div>
                                  ) : milestone.description ? (
                                    <p className="text-sm text-gray-600 whitespace-pre-wrap text-elegant">
                                      {milestone.description}
                                    </p>
                                  ) : null}
                                </div>
                              )}

                              {/* Action Footer */}
                              <div className="timeline-card-footer">
                                <div className="flex items-center justify-between">
                                  <div className="flex items-center space-x-4">
                                    {milestone.status === 'COMPLETED' && (
                                      <span className="text-xs text-green-600 flex items-center space-x-1">
                                        <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                                          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                                        </svg>
                                        <span>Completed</span>
                                      </span>
                                    )}
                                    
                                    {milestone.description && expandedMilestone !== milestone.id && editingMilestone !== milestone.id && (
                                      <button
                                        onClick={() => toggleMilestoneExpansion(milestone.id)}
                                        className="text-xs text-gray-500 hover:text-gray-700"
                                      >
                                        Show details
                                      </button>
                                    )}
                                    
                                    {expandedMilestone === milestone.id && editingMilestone !== milestone.id && milestone.description && (
                                      <button
                                        onClick={() => toggleMilestoneExpansion(milestone.id)}
                                        className="text-xs text-gray-500 hover:text-gray-700"
                                      >
                                        Hide details
                                      </button>
                                    )}
                                  </div>
                                  
                                  <div className="flex items-center space-x-2">
                                    {editingMilestone === milestone.id ? (
                                      <>
                                        <button
                                          onClick={() => saveMilestone(roadmap.id, milestone.id)}
                                          disabled={isUpdatingMilestone}
                                          className="text-xs font-medium text-green-600 hover:text-green-800"
                                        >
                                          {isUpdatingMilestone ? 'Saving...' : 'Save'}
                                        </button>
                                        <button
                                          onClick={cancelEditingMilestone}
                                          className="text-xs font-medium text-gray-600 hover:text-gray-800"
                                        >
                                          Cancel
                                        </button>
                                      </>
                                    ) : (
                                      <>
                                        <button
                                          onClick={() => startEditingMilestone(milestone)}
                                          className="text-xs text-gray-500 hover:text-gray-700"
                                          title="Edit milestone"
                                        >
                                          Edit
                                        </button>
                                        <button
                                          onClick={() => handleDeleteMilestone(roadmap.id, milestone.id)}
                                          className="text-xs text-red-500 hover:text-red-700"
                                          title="Delete milestone"
                                        >
                                          Delete
                                        </button>
                                      </>
                                    )}
                                  </div>
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      ))
                  )}
                </div>
                )}
              </div>
            ))}
          </div>
        )}


        {/* Calendar Sync Modal */}
        {showCalendarSync && roadmapToSync && (
          <CalendarSync
            milestones={roadmapToSync.milestones}
            onClose={() => {
              setShowCalendarSync(false)
              setRoadmapToSync(null)
            }}
          />
        )}
      </div>
    </div>
  )
}