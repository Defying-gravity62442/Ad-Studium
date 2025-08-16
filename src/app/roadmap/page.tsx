"use client"

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Modal } from '@/components/ui/modal'
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
  
  // Modal state
  const [selectedRoadmap, setSelectedRoadmap] = useState<Roadmap | null>(null)
  const [isModalVisible, setIsModalVisible] = useState(false)
  
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
  const [flippedMilestones, setFlippedMilestones] = useState<Set<string>>(new Set())
  const [currentCardIndices, setCurrentCardIndices] = useState<Record<string, number>>({})

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

  // Handle modal animation timing
  useEffect(() => {
    if (selectedRoadmap) {
      setIsModalVisible(true)
    } else {
      // Delay hiding to allow fade out animation
      const timer = setTimeout(() => {
        setIsModalVisible(false)
      }, 200)
      return () => clearTimeout(timer)
    }
  }, [selectedRoadmap])

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

  const toggleMilestoneFlip = (milestoneId: string) => {
    setFlippedMilestones(prev => {
      const next = new Set(prev)
      if (next.has(milestoneId)) next.delete(milestoneId)
      else next.add(milestoneId)
      return next
    })
  }

  const navigateToCard = (roadmapId: string, direction: 'prev' | 'next') => {
    const currentIndex = currentCardIndices[roadmapId] || 0
    const roadmap = roadmaps.find(r => r.id === roadmapId)
    if (!roadmap) return

    const totalCards = roadmap.milestones.length
    let newIndex: number

    if (direction === 'prev') {
      newIndex = currentIndex > 0 ? currentIndex - 1 : totalCards - 1
    } else {
      newIndex = currentIndex < totalCards - 1 ? currentIndex + 1 : 0
    }

    setCurrentCardIndices(prev => ({
      ...prev,
      [roadmapId]: newIndex
    }))
  }

  const getCurrentCardIndex = (roadmapId: string) => {
    return currentCardIndices[roadmapId] || 0
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
          <div className="paper-grid-2">
            {roadmaps.map((roadmap) => (
              <div key={roadmap.id} className="paper-card paper-elevated">
                {/* Roadmap Header */}
                <div className="border-b border-gray-200 pb-4 mb-4">
                  <div className="space-y-4">
                    {/* Title Row */}
                    <div>
                      {editingRoadmapTitle === roadmap.id ? (
                        <div className="space-y-3">
                          <input
                            type="text"
                            value={editingRoadmapTitleValue}
                            onChange={(e) => setEditingRoadmapTitleValue(e.target.value)}
                            className="form-input text-xl font-semibold"
                            autoFocus
                          />
                          <div className="flex items-center space-x-2">
                            <button
                              onClick={() => saveRoadmapTitle(roadmap.id)}
                              disabled={isUpdatingRoadmap}
                              className="text-sm font-medium text-green-600 hover:text-green-800"
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
                        <div className="flex items-center justify-between">
                          <h3 className="heading-secondary mb-0 cursor-pointer hover:text-gray-700 transition-colors"
                              onClick={() => setSelectedRoadmap(roadmap)}>
                            {roadmap.title}
                          </h3>
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              startEditingRoadmapTitle(roadmap.id, roadmap.title)
                            }}
                            className="text-gray-600 hover:text-gray-800 transition-colors p-1 rounded"
                            title="Edit title"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                            </svg>
                          </button>
                        </div>
                      )}
                      {roadmap.description && (
                        <p className="text-subtle text-elegant mt-2">
                          {roadmap.description}
                        </p>
                      )}
                    </div>

                    {/* Action Buttons Row */}
                    <div className="flex items-center justify-end space-x-2">
                      {roadmap.milestones.length > 0 && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            setRoadmapToSync(roadmap)
                            setShowCalendarSync(true)
                          }}
                          className="flex items-center space-x-1 text-xs text-gray-600 hover:text-gray-800 border border-gray-300 hover:border-gray-400 px-2 py-1 rounded transition-colors"
                          title="Sync to Calendar"
                        >
                          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
                        className="text-red-500 hover:text-red-700 transition-colors p-1 rounded"
                        title="Delete Roadmap"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </div>

                    {/* Progress Bar Row */}
                    <div className="w-full">
                      <div className="flex items-center justify-between mb-2">
                                              <span className="text-sm font-medium text-gray-700 text-elegant">
                        {roadmap.milestones.filter(m => m.status === 'COMPLETED').length}/{roadmap.milestones.length} completed
                      </span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div 
                          className="bg-black h-2 rounded-full transition-all duration-300"
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

                {/* Preview of milestones */}
                <div className="pt-4">
                  {roadmap.milestones.length === 0 ? (
                    <div className="text-center py-8 text-gray-500 text-elegant">
                      No milestones yet. Click on the roadmap title to add milestones.
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {roadmap.milestones
                        .sort((a, b) => a.order - b.order)
                        .slice(0, 3)
                        .map((milestone) => (
                          <div key={milestone.id} className="flex items-center space-x-2 text-sm">
                            <div className={`w-3 h-3 rounded-full flex-shrink-0 ${
                              milestone.status === 'COMPLETED' ? 'bg-green-500' : 'bg-gray-300'
                            }`} />
                            <span className={`flex-1 ${
                              milestone.status === 'COMPLETED' ? 'line-through text-gray-500' : 'text-gray-700'
                            }`}>
                              {milestone.title}
                            </span>
                          </div>
                        ))}
                      {roadmap.milestones.length > 3 && (
                        <div className="text-sm text-gray-500 text-center pt-2 text-elegant">
                          +{roadmap.milestones.length - 3} more milestones
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Roadmap Details Modal */}
        {selectedRoadmap && (
          <Modal 
            isOpen={isModalVisible} 
            onClose={() => setSelectedRoadmap(null)} 
            maxWidth="4xl" 
            showCloseButton={false}
          >
            <div 
              className={`bg-white rounded-xl shadow-2xl border border-gray-100 p-8 max-w-4xl max-h-[90vh] overflow-y-auto w-full transition-all duration-300 ease-out ${
                isModalVisible ? 'opacity-100 scale-100' : 'opacity-0 scale-95'
              }`}
              onClick={e => e.stopPropagation()}
            >
              <div className="flex justify-between items-start mb-6">
                <div>
                  <h3 className="heading-secondary mb-2">
                    {selectedRoadmap.title}
                  </h3>
                  {selectedRoadmap.description && (
                    <p className="text-subtle">
                      {selectedRoadmap.description}
                    </p>
                  )}
                </div>
                <button
                  onClick={() => setSelectedRoadmap(null)}
                  className="text-gray-400 hover:text-gray-600 text-2xl font-light"
                >
                  ×
                </button>
              </div>

              {selectedRoadmap.milestones.length === 0 ? (
                <div className="text-center py-12 text-gray-500">
                  No milestones yet. You can add milestones by editing this roadmap.
                </div>
              ) : (
                <div className="stacked-cards-container">
                  {selectedRoadmap.milestones
                    .sort((a, b) => a.order - b.order)
                    .map((milestone, index) => (
                      <div 
                        key={milestone.id} 
                        className="stacked-card"
                        style={{ 
                          zIndex: selectedRoadmap.milestones.length - index,
                          transform: 'translateY(0px) scale(1)',
                          display: index === getCurrentCardIndex(selectedRoadmap.id) ? 'block' : 'none'
                        }}
                        onClick={() => toggleMilestoneFlip(milestone.id)}
                      >
                        <div className={`stacked-card-inner ${flippedMilestones.has(milestone.id) ? 'is-flipped' : ''}`}>
                          {/* Front */}
                          <div className="stacked-card-face stacked-card-front">
                            <div className="stacked-card-header">
                              <div className="stacked-card-counter">
                                <span>{getCurrentCardIndex(selectedRoadmap.id) + 1} of {selectedRoadmap.milestones.length}</span>
                                <div className="stacked-card-counter-dots">
                                  {selectedRoadmap.milestones.map((_, dotIndex) => (
                                    <div 
                                      key={dotIndex}
                                      className={`stacked-card-counter-dot ${dotIndex === getCurrentCardIndex(selectedRoadmap.id) ? 'active' : ''}`}
                                    />
                                  ))}
                                </div>
                              </div>
                              <div className="flex items-center space-x-2">
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    handleDeleteMilestone(selectedRoadmap.id, milestone.id)
                                  }}
                                  className="text-red-500 hover:text-red-700 text-xs"
                                  title="Delete milestone"
                                >
                                  Delete
                                </button>
                              </div>
                            </div>
                            
                            <div className="stacked-card-content">
                              <div className="flex items-center justify-center mb-4">
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    toggleMilestoneCompletion(selectedRoadmap.id, milestone.id)
                                  }}
                                  className={`w-6 h-6 rounded border-2 flex-shrink-0 transition-colors flex items-center justify-center ${
                                    milestone.status === 'COMPLETED'
                                      ? 'bg-black border-black'
                                      : 'border-gray-300 hover:border-gray-400'
                                  }`}
                                  title={milestone.status === 'COMPLETED' ? 'Mark as pending' : 'Mark as completed'}
                                >
                                  {milestone.status === 'COMPLETED' && (
                                    <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 20 20">
                                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                    </svg>
                                  )}
                                </button>
                              </div>
                              
                              <h4 className={`text-xl font-medium mb-4 ${
                                milestone.status === 'COMPLETED' ? 'line-through text-gray-500' : 'text-black'
                              }`}>
                                {milestone.title}
                              </h4>
                              
                              {milestone.dueDate && (
                                <div className="flex items-center justify-center space-x-2 mb-4">
                                  <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                  </svg>
                                  <span className={`text-sm ${
                                    milestone.status === 'COMPLETED' 
                                      ? 'text-gray-400'
                                      : isOverdue(milestone.dueDate)
                                      ? 'text-red-600 font-medium'
                                      : 'text-gray-600'
                                  }`}>
                                    Due: {milestone.dueDate}
                                    {milestone.status !== 'COMPLETED' && isOverdue(milestone.dueDate) && (
                                      <span className="ml-2 px-2 py-1 bg-red-100 text-red-800 text-xs rounded-full">
                                        Overdue
                                      </span>
                                    )}
                                  </span>
                                </div>
                              )}

                              {milestone.status === 'COMPLETED' && (
                                <div className="text-sm text-green-600 flex items-center justify-center space-x-1">
                                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                                  </svg>
                                  <span>Completed</span>
                                </div>
                              )}
                            </div>
                          </div>

                          {/* Back */}
                          <div className="stacked-card-face stacked-card-back">
                            <div className="stacked-card-header">
                              <span className="text-sm font-medium text-gray-700 uppercase tracking-wide">Details</span>
                              <div className="flex items-center space-x-2">
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    startEditingMilestone(milestone)
                                  }}
                                  className="text-xs text-gray-600 hover:text-gray-800"
                                  title="Edit milestone"
                                >
                                  Edit
                                </button>
                              </div>
                            </div>
                            
                            {editingMilestone === milestone.id ? (
                              <div className="w-full space-y-3 flex-1">
                                <div>
                                  <input
                                    type="text"
                                    value={editingMilestoneData.title}
                                    onChange={(e) => setEditingMilestoneData(prev => ({ ...prev, title: e.target.value }))}
                                    className="form-input text-lg font-medium"
                                    placeholder="Milestone title"
                                    autoFocus
                                  />
                                </div>
                                <div>
                                  <textarea
                                    value={editingMilestoneData.description}
                                    onChange={(e) => setEditingMilestoneData(prev => ({ ...prev, description: e.target.value }))}
                                    className="form-textarea text-sm"
                                    placeholder="Description (optional)"
                                    rows={4}
                                  />
                                </div>
                                <div>
                                  <input
                                    type="date"
                                    value={editingMilestoneData.dueDate}
                                    onChange={(e) => setEditingMilestoneData(prev => ({ ...prev, dueDate: e.target.value }))}
                                    className="form-input text-sm"
                                  />
                                </div>
                                <div className="stacked-card-actions">
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation()
                                      saveMilestone(selectedRoadmap.id, milestone.id)
                                    }}
                                    disabled={isUpdatingMilestone}
                                    className="text-sm font-medium text-green-600 hover:text-green-800"
                                  >
                                    {isUpdatingMilestone ? 'Saving...' : 'Save'}
                                  </button>
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation()
                                      cancelEditingMilestone()
                                    }}
                                    className="text-sm font-medium text-gray-600 hover:text-gray-800"
                                  >
                                    Cancel
                                  </button>
                                </div>
                              </div>
                            ) : (
                              <div className="flex-1 flex flex-col">
                                <div className="text-sm text-gray-700 whitespace-pre-wrap mb-4 flex-1">
                                  {milestone.description || 'No detailed instructions provided.'}
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  
                  {/* Navigation Controls */}
                  {selectedRoadmap.milestones.length > 1 && (
                    <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 flex items-center space-x-4 z-10">
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          navigateToCard(selectedRoadmap.id, 'prev')
                        }}
                        className="flex items-center justify-center w-10 h-10 bg-white border border-gray-300 rounded-full shadow-sm hover:shadow-md transition-shadow"
                        title="Previous milestone"
                      >
                        <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                        </svg>
                      </button>
                      
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          navigateToCard(selectedRoadmap.id, 'next')
                        }}
                        className="flex items-center justify-center w-10 h-10 bg-white border border-gray-300 rounded-full shadow-sm hover:shadow-md transition-shadow"
                        title="Next milestone"
                      >
                        <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          </Modal>
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