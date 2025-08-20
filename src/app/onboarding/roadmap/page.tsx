"use client"

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'
import { useE2EE } from '@/hooks/useE2EE'

export default function CreateRoadmapPage() {
  const [step, setStep] = useState<'input' | 'sanity-check' | 'review' | 'saving'>('input')
  const [isCreating, setIsCreating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  
  // Loading animation state
  const [currentLoadingPhrase, setCurrentLoadingPhrase] = useState(0)
  const loadingPhrases = [
    "Analyzing your goal for completeness...",
    "Researching accurate and up-to-date information...",
    "Tailoring your roadmap just for you...",
    "Breaking it down into simple steps...",
    "Checking for the latest requirements...",
    "Personalizing based on your background...",
    "Almost ready with your roadmap..."
  ]
  
  // Form state
  const [roadmapTitle, setRoadmapTitle] = useState('')
  const [generateWithAI, setGenerateWithAI] = useState(true)
  const [currentDepartment, setCurrentDepartment] = useState('')
  const [currentInstitution, setCurrentInstitution] = useState('')
  const [background, setBackground] = useState('')
  
  // Sanity check state
  const [sanityCheck, setSanityCheck] = useState<{
    missingInfo: string[]
    clarifications: string[]
  } | null>(null)
  
  // Clarification state
  const [clarifications, setClarifications] = useState('')
  
  // Dynamic placeholder state
  const [currentPlaceholderIndex, setCurrentPlaceholderIndex] = useState(0)
  const placeholders = [
    "Get accepted into a PhD program in Computer Science at Stanford, focusing on AI research, for 2027 entry",
    "Connect with Professor Sarah Chen at MIT to discuss research opportunities in quantum computing.",
    'Complete reading "The Structure of Scientific Revolutions" by Thomas Kuhn by December 2025',
    "Master advanced statistical analysis techniques, including Bayesian inference and machine learning, by March 2026.",
    "Perfect the CRISPR-Cas9 gene editing protocol in the lab and publish findings by Aug 2025.",
    "Develop proficiency in Python programming for data science and complete 3 projects by January 2026.",
    "Establish a research collaboration with Dr. Michael Rodriguez at Berkeley on climate modeling.",
    "Finish writing and submit my first research paper to Nature by September 2026.",
    "Learn advanced microscopy techniques and complete certification by April 2026.",
    "Build a research network of 20+ academics in my field through conferences and collaborations."
  ]
  
  // Review state
  const [aiRoadmap, setAiRoadmap] = useState<{
    title: string
    description?: string
    milestones: Array<{
      title: string
      description?: string
      dueDate: string
    }>
    sources?: Array<{
      title: string
      url: string
      type: string
    }>
  } | null>(null)
  const [reviewTitle, setReviewTitle] = useState('')
  const [reviewDescription, setReviewDescription] = useState('')
  const [reviewMilestones, setReviewMilestones] = useState<Array<{
    title: string
    description?: string
    dueDate: string
  }>>([])
  
  // Edit state for display mode
  const [editingTitle, setEditingTitle] = useState(false)
  const [editingMilestone, setEditingMilestone] = useState<number | null>(null)
  const [expandedMilestone, setExpandedMilestone] = useState<string | null>(null)
  
  const router = useRouter()
  const { data: session } = useSession()
  const { encrypt, decrypt, isReady, hasKey, error: e2eeError } = useE2EE()

  // Rotate placeholders every 3 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentPlaceholderIndex((prev) => (prev + 1) % placeholders.length)
    }, 3000)

    return () => clearInterval(interval)
  }, [placeholders.length])

  // Rotate loading phrases every 2 seconds when creating
  useEffect(() => {
    let interval: NodeJS.Timeout
    if (isCreating) {
      interval = setInterval(() => {
        setCurrentLoadingPhrase((prev) => (prev + 1) % loadingPhrases.length)
      }, 2000)
    }
    return () => {
      if (interval) clearInterval(interval)
    }
  }, [isCreating, loadingPhrases.length])

  // Load user customization data for onboarding
  useEffect(() => {
    const loadUserCustomization = async () => {
      if (isReady && hasKey) {
        try {
          const response = await fetch('/api/user/customization')
          if (response.ok) {
            const data = await response.json()
            if (data.customization) {
              // Decrypt the customization data
              const decryptedData = {
                currentInstitution: data.customization.currentInstitution ? await decrypt(JSON.parse(data.customization.currentInstitution)) : '',
                fieldsOfStudy: data.customization.fieldsOfStudy ? await decrypt(JSON.parse(data.customization.fieldsOfStudy)) : '',
                background: data.customization.background ? await decrypt(JSON.parse(data.customization.background)) : '',
              }
              
              // Pre-fill the form with user's customization data
              setCurrentInstitution(decryptedData.currentInstitution)
              setCurrentDepartment(decryptedData.fieldsOfStudy) // Map fieldsOfStudy to department
              setBackground(decryptedData.background)
            }
          }
        } catch (err) {
          console.error('Error loading user customization:', err)
        }
      }
    }

    loadUserCustomization()
  }, [isReady, hasKey, decrypt])

  const handleSanityCheck = async () => {
    if (!roadmapTitle.trim()) {
      setError('Please provide a roadmap title')
      return
    }

    if (!hasKey) {
      setError('Encryption key is required')
      return
    }

    setIsCreating(true)
    setError(null)
    setCurrentLoadingPhrase(0)

    try {
      // Step 1: Sanity check with Claude Bedrock
      const response = await fetch('/api/roadmap/sanity-check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          goal: roadmapTitle.trim(),
          currentDepartment: currentDepartment.trim() || undefined,
          currentInstitution: currentInstitution.trim() || undefined,
          background: background.trim() || undefined
        })
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to analyze goal')
      }

      const sanityCheckResult = await response.json()
      setSanityCheck(sanityCheckResult)
      setStep('sanity-check')
    } catch (err) {
      console.error('Error during sanity check:', err)
      setError(err instanceof Error ? err.message : 'Failed to analyze goal')
    } finally {
      setIsCreating(false)
    }
  }

  const handleGenerateRoadmap = async () => {
    setIsCreating(true)
    setError(null)
    setCurrentLoadingPhrase(0)

    try {
      // Generate roadmap with enhanced AI system
      const response = await fetch('/api/roadmap/generate-enhanced', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          goal: roadmapTitle.trim(),
          clarifications: clarifications.trim() || undefined,
          currentDepartment: currentDepartment.trim() || undefined,
          currentInstitution: currentInstitution.trim() || undefined,
          background: background.trim() || undefined
        })
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to generate roadmap')
      }

      const generatedRoadmap = await response.json()
      
      // Set review state
      setAiRoadmap(generatedRoadmap)
      setReviewTitle(generatedRoadmap.roadmap_title || generatedRoadmap.title)
      setReviewDescription(generatedRoadmap.message || generatedRoadmap.description || '')
      // Transform milestones from Bedrock format to UI format
      const transformedMilestones = generatedRoadmap.milestones.map((milestone: any) => ({
        title: milestone.action || milestone.title,
        description: milestone.notes || milestone.description,
        dueDate: milestone.deadline || milestone.dueDate
      }))
      setReviewMilestones(transformedMilestones)
      setStep('review')
    } catch (err) {
      console.error('Error generating roadmap:', err)
      setError(err instanceof Error ? err.message : 'Failed to generate roadmap')
    } finally {
      setIsCreating(false)
    }
  }

  const handleProceedWithClarifications = async () => {
    if (!clarifications.trim()) {
      setError('Please provide clarifications or additional information')
      return
    }
    await handleGenerateRoadmap()
  }

  const handleSkipClarifications = async () => {
    setClarifications('')
    await handleGenerateRoadmap()
  }

  const handleSaveRoadmap = async () => {
    if (!hasKey) {
      setError('Encryption key is required')
      return
    }

    setStep('saving')
    setError(null)

    try {
      // Encrypt and save the roadmap
      const encryptedTitle = await encrypt(reviewTitle.trim())
      const encryptedDescription = reviewDescription.trim() ? await encrypt(reviewDescription.trim()) : null
      const encryptedMilestones = await Promise.all(
        reviewMilestones.map(async (milestone) => ({
          encryptedTitle: await encrypt(milestone.title),
          encryptedDescription: milestone.description ? await encrypt(milestone.description) : null,
          dueDate: milestone.dueDate
        }))
      )

      const saveResponse = await fetch('/api/roadmap', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          encryptedTitle,
          encryptedDescription,
          encryptedMilestones
        })
      })

      if (!saveResponse.ok) {
        const saveData = await saveResponse.json()
        throw new Error(saveData.error || 'Failed to save roadmap')
      }

      // Complete onboarding
      await fetch('/api/user/complete-onboarding', {
        method: 'POST',
      })

      router.push('/dashboard')
    } catch (err) {
      console.error('Error saving roadmap:', err)
      setError(err instanceof Error ? err.message : 'Failed to save roadmap')
      setStep('review')
    }
  }

  const updateReviewMilestone = (index: number, field: string, value: string) => {
    setReviewMilestones(prev => 
      prev.map((milestone, i) => 
        i === index ? { ...milestone, [field]: value } : milestone
      )
    )
  }

  const addReviewMilestone = () => {
    const today = new Date()
    const localDateString = today.getFullYear() + '-' + 
      String(today.getMonth() + 1).padStart(2, '0') + '-' + 
      String(today.getDate()).padStart(2, '0')
    const newMilestone = {
      title: '',
      description: '',
                dueDate: localDateString
    }
    setReviewMilestones(prev => [...prev, newMilestone])
  }

  const removeReviewMilestone = (index: number) => {
    setReviewMilestones(prev => prev.filter((_, i) => i !== index))
  }

  const handleEditTitle = () => {
    setEditingTitle(true)
  }

  const handleSaveTitle = () => {
    setEditingTitle(false)
  }


  const handleEditMilestone = (index: number) => {
    setEditingMilestone(index)
  }

  const handleSaveMilestone = () => {
    setEditingMilestone(null)
  }

  const toggleMilestoneExpansion = (milestoneId: string) => {
    setExpandedMilestone(prev => prev === milestoneId ? null : milestoneId)
  }

  const formatDueDate = (dateString: string) => {
    if (!dateString) return 'No due date'
    // Parse YYYY-MM-DD format directly to avoid timezone issues
    const [year, month, day] = dateString.split('T')[0].split('-')
    const date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day))
    return date.toLocaleDateString('en-US', { 
      year: 'numeric', 
      month: 'short', 
      day: 'numeric'
    })
  }

  const isOverdue = (dueDate: string | undefined) => {
    if (!dueDate) return false
    const today = new Date().toISOString().split('T')[0]
    return dueDate.split('T')[0] < today
  }

  const getMilestoneStatusClass = (index: number) => {
    // All milestones are pending during creation
    return 'pending'
  }


  if (!isReady) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-2xl text-gray-600">Loading...</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-white flex flex-col">
      {/* Progress indicator */}
      <div className="w-full bg-gray-100 h-2">
        <div className="bg-black h-2 transition-all duration-300" style={{ width: '100%' }} />
      </div>

      <div className="flex-1 flex flex-col items-center justify-center px-8 py-16">
        <main className="max-w-2xl mx-auto space-y-8">
          <div className="text-center space-y-4">
            <h1 className="text-4xl font-bold text-black tracking-tight">
              Create Your First Roadmap
            </h1>
            <p className="text-lg text-gray-700 leading-relaxed">
              Tell us about your goal, and our AI will create a personalized step-by-step roadmap for your journey.
            </p>
          </div>

          {(error || e2eeError) && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <div className="text-sm text-red-700">
                {error || e2eeError}
              </div>
            </div>
          )}


          {/* Step 1: Input Form */}
          {step === 'input' && (
            <div className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-900 mb-2">
                  What is your goal (Be specific!)
                </label>
                <textarea
                  value={roadmapTitle}
                  onChange={(e) => setRoadmapTitle(e.target.value)}
                  placeholder={placeholders[currentPlaceholderIndex]}
                  rows={3}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-black focus:border-transparent"
                />
              </div>

              <div className="flex justify-center pt-6">
                <button
                  onClick={handleSanityCheck}
                  disabled={isCreating || !roadmapTitle.trim()}
                  className={`px-8 py-4 rounded-lg font-medium text-lg transition-colors duration-200 min-w-[200px] ${
                    !isCreating && roadmapTitle.trim()
                      ? 'bg-black text-white hover:bg-gray-800'
                      : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                  }`}
                >
                  {isCreating ? loadingPhrases[currentLoadingPhrase] : 'Get My Roadmap'}
                </button>
              </div>
            </div>
          )}

          {/* Step 2: Sanity Check */}
          {step === 'sanity-check' && sanityCheck && (
            <div className="space-y-6">
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-6">
                <h3 className="text-lg font-semibold text-black mb-4">
                  Let&apos;s make your roadmap more specific and tailored to you
                </h3>
                <p className="text-gray-700 mb-4 leading-relaxed">
                  I&apos;d like to check a few things before proceeding, so that we can make your roadmap more specific, tailored to you, and more accurate.
                </p>
                {sanityCheck.missingInfo.length > 0 && (
                  <div className="mb-4">
                    <p className="text-sm font-medium text-gray-900 mb-2">Additional information that would help:</p>
                    <ul className="list-disc list-inside text-sm text-gray-700 ml-2 space-y-1">
                      {sanityCheck.missingInfo.map((info, index) => (
                        <li key={index}>{info}</li>
                      ))}
                    </ul>
                  </div>
                )}
                {sanityCheck.clarifications.length > 0 && (
                  <div className="mb-4">
                    <p className="text-sm font-medium text-gray-900 mb-2">Just to clarify:</p>
                    <ul className="list-disc list-inside text-sm text-gray-700 ml-2 space-y-1">
                      {sanityCheck.clarifications.map((clarification, index) => (
                        <li key={index}>{clarification}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-900 mb-2">
                  Please provide clarifications or additional information to help generate a more accurate roadmap:
                </label>
                <textarea
                  value={clarifications}
                  onChange={(e) => setClarifications(e.target.value)}
                  rows={5}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-black focus:border-transparent"
                />
              </div>

              <div className="flex justify-center pt-6 space-x-4">
                <button
                  onClick={handleProceedWithClarifications}
                  disabled={isCreating || !clarifications.trim()}
                  className={`px-8 py-4 rounded-lg font-medium text-lg transition-colors duration-200 min-w-[200px] ${
                    !isCreating && clarifications.trim()
                      ? 'bg-black text-white hover:bg-gray-800'
                      : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                  }`}
                >
                  {isCreating ? loadingPhrases[currentLoadingPhrase] : 'Generate Roadmap'}
                </button>
                {!isCreating && (
                  <button
                    onClick={handleSkipClarifications}
                    className="px-8 py-4 rounded-lg font-medium text-lg transition-colors duration-200 min-w-[200px] bg-gray-200 text-gray-700 hover:bg-gray-300"
                  >
                    Skip Clarifications
                  </button>
                )}
              </div>
            </div>
          )}



          {/* Step 4: Review & Edit */}
          {step === 'review' && aiRoadmap && (
            <div className="space-y-6">
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                <p className="text-sm text-gray-700 text-elegant">
                  AI has generated a personalized roadmap for you. Review the details below and click edit buttons to make changes.
                </p>
              </div>

              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                <p className="text-sm text-yellow-700">
                  ⚠️ <strong>Please note:</strong> AI-generated content may contain inaccuracies. Please double-check all factual information, requirements, and dates before proceeding with your roadmap.
                </p>
              </div>

              {/* Roadmap Title */}
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-6">
                <div className="flex items-start justify-between mb-2">
                  <h3 className="text-sm font-medium text-gray-700 uppercase tracking-wide">
                    Roadmap Title
                  </h3>
                  {!editingTitle && (
                    <button
                      onClick={handleEditTitle}
                      className="flex items-center space-x-1 text-sm text-gray-600 hover:text-black transition-colors"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                      </svg>
                      <span>Edit</span>
                    </button>
                  )}
                </div>
                
                {editingTitle ? (
                  <div className="space-y-3">
                    <input
                      type="text"
                      value={reviewTitle}
                      onChange={(e) => setReviewTitle(e.target.value)}
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-black focus:border-transparent"
                      autoFocus
                    />
                    <div className="flex space-x-2">
                      <button
                        onClick={handleSaveTitle}
                        className="px-3 py-1 bg-black text-white text-sm rounded hover:bg-gray-800 transition-colors"
                      >
                        Save
                      </button>
                      <button
                        onClick={() => {
                          setReviewTitle(aiRoadmap.title)
                          setEditingTitle(false)
                        }}
                        className="px-3 py-1 bg-gray-200 text-gray-700 text-sm rounded hover:bg-gray-300 transition-colors"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="text-lg font-medium text-black leading-relaxed">
                    {reviewTitle || 'No title'}
                  </div>
                )}
              </div>

              {/* Roadmap Description */}
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-6">
                <div className="flex items-start justify-between mb-2">
                  <h3 className="text-sm font-medium text-gray-700 uppercase tracking-wide">
                    AI-Generated Description
                  </h3>
                </div>
                
                <div className="text-gray-800 leading-relaxed">
                  {reviewDescription || 'No description provided'}
                </div>
              </div>

              {/* Milestones as flip cards */}
              <div>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-black">Milestones</h3>
                  <button
                    onClick={addReviewMilestone}
                    className="flex items-center space-x-2 text-sm bg-gray-100 hover:bg-gray-200 px-3 py-2 rounded-lg transition-colors"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                    </svg>
                    <span>Add Milestone</span>
                  </button>
                </div>

                <div className="roadmap-timeline">
                  {reviewMilestones.length === 0 ? (
                    <div className="paper-empty py-12">
                      <div className="paper-empty-icon">
                        <svg className="h-8 w-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                        </svg>
                      </div>
                      <div className="paper-empty-title text-elegant">No milestones yet</div>
                      <div className="paper-empty-description text-elegant">Click &quot;Add Milestone&quot; to get started.</div>
                    </div>
                  ) : (
                    reviewMilestones.map((milestone, index) => (
                      <div key={index} className="timeline-item">
                        {/* Timeline Connector */}
                        <div className="timeline-connector">
                          <div className={`timeline-dot ${getMilestoneStatusClass(index)}`}>
                            <span className="text-xs font-medium text-gray-600">{index + 1}</span>
                          </div>
                          {index < reviewMilestones.length - 1 && (
                            <div className="timeline-line pending" />
                          )}
                        </div>

                        {/* Timeline Content */}
                        <div className="timeline-content">
                          <div className="timeline-card">
                            <div className="timeline-card-header">
                              <div className="flex items-start space-x-3">
                                <div className="flex-1 min-w-0">
                                  {editingMilestone === index ? (
                                    <div className="space-y-3">
                                      <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1 text-elegant">Title *</label>
                                        <input
                                          type="text"
                                          value={milestone.title}
                                          onChange={(e) => updateReviewMilestone(index, 'title', e.target.value)}
                                          placeholder="e.g., Complete coursework"
                                          className="form-input text-lg font-medium w-full"
                                          autoFocus
                                        />
                                      </div>
                                      <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1 text-elegant">Description (Optional)</label>
                                        <textarea
                                          value={milestone.description || ''}
                                          onChange={(e) => updateReviewMilestone(index, 'description', e.target.value)}
                                          placeholder="Additional details about this milestone..."
                                          rows={3}
                                          className="form-textarea text-sm w-full"
                                        />
                                      </div>
                                      <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1 text-elegant">Due Date</label>
                                        <input
                                          type="date"
                                          value={milestone.dueDate ? milestone.dueDate.split('T')[0] : ''}
                                          onChange={(e) => updateReviewMilestone(index, 'dueDate', e.target.value || '')}
                                          className="form-input text-sm"
                                        />
                                      </div>
                                    </div>
                                  ) : (
                                    <div>
                                      <h4 className="text-lg font-medium mb-1 text-elegant text-gray-900">
                                        {milestone.title || 'Untitled milestone'}
                                      </h4>
                                      
                                      {milestone.dueDate && (
                                        <div className="flex items-center space-x-2 text-sm">
                                          <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                          </svg>
                                          <span className={`${
                                            isOverdue(milestone.dueDate)
                                              ? 'text-red-600 font-medium'
                                              : 'text-gray-600'
                                          }`}>
                                            Due: {formatDueDate(milestone.dueDate)}
                                          </span>
                                          {isOverdue(milestone.dueDate) && (
                                            <span className="paper-badge paper-badge-error text-xs">
                                              Overdue
                                            </span>
                                          )}
                                        </div>
                                      )}
                                    </div>
                                  )}
                                </div>
                              </div>
                            </div>

                            {/* Expandable Content */}
                            {(editingMilestone === index || 
                              (expandedMilestone === `${index}` && milestone.description)) && (
                              <div className="timeline-card-content">
                                {editingMilestone !== index && milestone.description && (
                                  <p className="text-sm text-gray-600 whitespace-pre-wrap text-elegant">
                                    {milestone.description}
                                  </p>
                                )}
                              </div>
                            )}

                            {/* Action Footer */}
                            <div className="timeline-card-footer">
                              <div className="flex items-center justify-between">
                                <div className="flex items-center space-x-4">
                                  {milestone.description && expandedMilestone !== `${index}` && editingMilestone !== index && (
                                    <button
                                      onClick={() => toggleMilestoneExpansion(`${index}`)}
                                      className="text-xs text-gray-500 hover:text-gray-700"
                                    >
                                      Show details
                                    </button>
                                  )}
                                  
                                  {expandedMilestone === `${index}` && editingMilestone !== index && milestone.description && (
                                    <button
                                      onClick={() => toggleMilestoneExpansion(`${index}`)}
                                      className="text-xs text-gray-500 hover:text-gray-700"
                                    >
                                      Hide details
                                    </button>
                                  )}
                                </div>
                                
                                <div className="flex items-center space-x-2">
                                  {editingMilestone === index ? (
                                    <>
                                      <button
                                        onClick={() => handleSaveMilestone()}
                                        className="text-xs font-medium text-green-600 hover:text-green-800"
                                      >
                                        Save
                                      </button>
                                      <button
                                        onClick={() => {
                                          setReviewMilestones(prev => 
                                            prev.map((m, i) => 
                                              i === index ? aiRoadmap.milestones[index] || m : m
                                            )
                                          )
                                          setEditingMilestone(null)
                                        }}
                                        className="text-xs font-medium text-gray-600 hover:text-gray-800"
                                      >
                                        Cancel
                                      </button>
                                    </>
                                  ) : (
                                    <>
                                      <button
                                        onClick={() => setEditingMilestone(index)}
                                        className="text-xs text-gray-500 hover:text-gray-700"
                                        title="Edit milestone"
                                      >
                                        Edit
                                      </button>
                                      <button
                                        onClick={() => removeReviewMilestone(index)}
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
              </div>

              {aiRoadmap.sources && aiRoadmap.sources.length > 0 && (
                <div className="bg-gray-50 border border-gray-200 rounded-lg p-6">
                  <h3 className="text-sm font-medium text-gray-700 uppercase tracking-wide mb-3">Sources</h3>
                  <div className="space-y-2">
                    {aiRoadmap.sources.map((source, index: number) => (
                      <div key={index} className="text-sm text-gray-600">
                        <a 
                          href={source.url} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="text-gray-600 hover:text-gray-800 underline"
                        >
                          {source.title}
                        </a>
                        <span className="text-gray-400 ml-2">({source.type})</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex justify-between pt-6">
                <button
                  onClick={() => setStep('input')}
                  className="px-4 py-2 text-gray-700 hover:text-gray-900"
                >
                  ← Back
                </button>
                <button
                  onClick={handleSaveRoadmap}
                  disabled={!reviewTitle.trim()}
                  className={`px-6 py-2 rounded-lg font-medium transition-colors ${
                    reviewTitle.trim()
                      ? 'bg-black text-white hover:bg-gray-800'
                      : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                  }`}
                >
                  Complete Setup
                </button>
              </div>
            </div>
          )}

          {/* Step 5: Saving */}
          {step === 'saving' && (
            <div className="text-center py-12">
              <div className="text-xl text-gray-600 mb-4">Saving your roadmap...</div>
              <div className="w-8 h-8 border-4 border-gray-200 border-t-black rounded-full animate-spin mx-auto"></div>
            </div>
          )}
        </main>
      </div>
    </div>
  )
}