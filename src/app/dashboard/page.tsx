"use client"

import { useSession } from "next-auth/react"
import { useRouter } from "next/navigation"
import { useEffect, useState } from "react"
import { useE2EE } from "@/hooks/useE2EE"
import { useDailySummary } from "@/hooks/useDailySummary"
import { useWeeklySummary } from "@/hooks/useWeeklySummary"
import { useMonthlySummary } from "@/hooks/useMonthlySummary"
import { useYearlySummary } from "@/hooks/useYearlySummary"
import { ErrorModal } from '@/components/ui/error-modal'
import ReadingStats from "@/components/ReadingStats"
import ProofOfProgress from "@/components/ProofOfProgress"
import MoodTracking from "@/components/MoodTracking"
import { LetterUnsealNotification } from "@/components/LetterUnsealNotification"
import { Calendar, Target, Heart, BookOpen, LayoutDashboard } from 'lucide-react'
import { TutorialButton } from '@/components/tutorial'


interface UserData {
  aiAssistantName?: string
  currentInstitution?: string
  fieldsOfStudy?: string
}

interface UpcomingItem {
  id: string
  type: 'milestone' | 'letter'
  title: string
  date: string
  description?: string | null
  source: string
}

export default function Dashboard() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const { decrypt, isReady, hasKey } = useE2EE()
  useDailySummary()
  useWeeklySummary()
  useMonthlySummary()
  useYearlySummary()
  const [userData, setUserData] = useState<UserData>({})
  const [isLoading, setIsLoading] = useState(true)
  const [upcomingItems, setUpcomingItems] = useState<UpcomingItem[]>([])
  const [showLetterNotification, setShowLetterNotification] = useState(false)
  const [currentTime, setCurrentTime] = useState(new Date())
  const [errorModal, setErrorModal] = useState<{ isOpen: boolean; title: string; message: string }>({ isOpen: false, title: '', message: '' })

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000)
    return () => clearInterval(timer)
  }, [])

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/")
    } else if (session && isReady) {
      fetchUserData()
      fetchUpcomingItems()
      checkForLetterNotifications()
    }
  }, [status, session, isReady, router])

  const fetchUserData = async () => {
    try {
      const response = await fetch('/api/user/onboarding-status')
      if (response.ok) {
        const data = await response.json()
        const user = data.user

        if (hasKey && user) {
          const decryptedData: UserData = {}
          
          if (user.aiAssistantName) {
            try {
              decryptedData.aiAssistantName = await decrypt(JSON.parse(user.aiAssistantName))
            } catch (e) {
              console.warn('Could not decrypt AI assistant name')
            }
          }
          
          if (user.currentInstitution) {
            try {
              decryptedData.currentInstitution = await decrypt(JSON.parse(user.currentInstitution))
            } catch (e) {
              console.warn('Could not decrypt institution')
            }
          }
          
          if (user.fieldsOfStudy) {
            try {
              decryptedData.fieldsOfStudy = await decrypt(JSON.parse(user.fieldsOfStudy))
            } catch (e) {
              console.warn('Could not decrypt fields of study')
            }
          }
          
          setUserData(decryptedData)
        }
      }
    } catch (error) {
      console.error('Error fetching user data:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const fetchUpcomingItems = async () => {
    if (!hasKey) return
    
    try {
      const milestones: UpcomingItem[] = []
      const letters: UpcomingItem[] = []
      
      const roadmapResponse = await fetch('/api/roadmap')
      if (roadmapResponse.ok) {
        const roadmapData = await roadmapResponse.json()
        const roadmaps = roadmapData.roadmaps || []
        
        for (const roadmap of roadmaps) {
          const roadmapTitle = await decrypt(roadmap.title)
          
          for (const milestone of roadmap.milestones || []) {
            const milestoneTitle = await decrypt(milestone.title)
            const milestoneDescription = milestone.description ? await decrypt(milestone.description) : null
            
            if (milestone.status !== 'COMPLETED' && milestone.dueDate) {
              milestones.push({
                id: `milestone-${milestone.id}`,
                type: 'milestone',
                title: milestoneTitle,
                date: milestone.dueDate,
                description: milestoneDescription,
                source: roadmapTitle
              })
            }
          }
        }
      }
      
      const letterResponse = await fetch('/api/letter')
      if (letterResponse.ok) {
        const letterData = await letterResponse.json()
        
        for (const letter of letterData) {
          const letterTitle = letter.title ? await decrypt(letter.title) : 'Letter to Future Self'
          if (letter.isSealed && !letter.isUnsealed) {
            letters.push({
              id: `letter-${letter.id}`,
              type: 'letter',
              title: letterTitle,
              date: letter.unsealDate,
              source: 'Letter to Future Self'
            })
          }
        }
      }
      
      const allItems = [...milestones, ...letters]
        .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
        .slice(0, 5)
      
      setUpcomingItems(allItems)
    } catch (error) {
      console.error('Error fetching upcoming items:', error)
    }
  }

  const checkForLetterNotifications = async () => {
    if (!hasKey) return
    
    try {
      const response = await fetch('/api/letter')
      if (!response.ok) return
      
      const encryptedLetters = await response.json()
      
      const now = new Date()
      const readyLetters = encryptedLetters.filter((letter: any) => 
        letter.isSealed && 
        !letter.isUnsealed && 
        new Date(letter.unsealDate) <= now
      )
      
      if (readyLetters.length > 0) {
        const today = new Date().toDateString()
        const lastNotificationDate = localStorage.getItem('letterNotificationDate')
        
        if (lastNotificationDate !== today) {
          setShowLetterNotification(true)
          localStorage.setItem('letterNotificationDate', today)
        }
      }
    } catch (error) {
      console.error('Error checking for letter notifications:', error)
    }
  }

  const handleLetterUnseal = async (letterId: string) => {
    try {
      const response = await fetch('/api/letter/unseal', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ id: letterId }),
      })

      if (!response.ok) {
        throw new Error('Failed to unseal letter')
      }

      fetchUpcomingItems()
      setShowLetterNotification(false)
      localStorage.removeItem('letterNotificationDate')
    } catch (error) {
      console.error('Failed to unseal letter:', error)
      setErrorModal({ isOpen: true, title: 'Unseal Failed', message: 'Failed to unseal letter. Please try again.' })
    }
  }

  if (status === "loading" || isLoading) {
    return (
      <div className="page-container paper-texture">
        <div className="content-wrapper-7xl">
          <div className="paper-loading">
            <div className="paper-loading-spinner"></div>
            <div className="loading-text text-elegant ml-3">Loading your dashboard...</div>
          </div>
        </div>
      </div>
    )
  }

  if (!session) {
    return null
  }

  const firstName = session.user?.name?.split(' ')[0] || 'there'
  const aiName = userData.aiAssistantName || 'your AI assistant'
  const greeting = getGreeting(currentTime)

  function getGreeting(date: Date) {
    const hour = date.getHours()
    if (hour < 12) return 'Good morning'
    if (hour < 17) return 'Good afternoon'
    return 'Good evening'
  }

  const UpcomingCard = () => {
    const formatDate = (dateString: string) => {
      const date = new Date(dateString)
      const now = new Date()
      const diffInDays = Math.ceil((date.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
      
      if (diffInDays === 0) return 'Today'
      if (diffInDays === 1) return 'Tomorrow'
      if (diffInDays < 7) return `In ${diffInDays} days`
      if (diffInDays < 14) return 'Next week'
      
      return date.toLocaleDateString('en-US', { 
        month: 'short', 
        day: 'numeric',
        year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined
      })
    }

    const getTypeIcon = (type: string) => {
      switch (type) {
        case 'milestone': return '•'
        case 'letter': return '•'
        default: return '•'
      }
    }

    const getUrgencyColor = (dateString: string) => {
      const date = new Date(dateString)
      const now = new Date()
      const diffInDays = Math.ceil((date.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
      
      if (diffInDays <= 1) return 'border-l-red-400 bg-red-50'
      if (diffInDays <= 3) return 'border-l-orange-400 bg-orange-50'
      if (diffInDays <= 7) return 'border-l-yellow-400 bg-yellow-50'
      return 'border-l-gray-400 bg-gray-50'
    }

    if (upcomingItems.length === 0) {
      return (
        <>
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 bg-gray-100 rounded-xl flex items-center justify-center shadow-lg">
              <Calendar className="h-5 w-5 text-gray-600" />
            </div>
            <h3 className="text-xl font-semibold text-paper text-elegant">Upcoming</h3>
          </div>
          <div className="paper-empty">
            <div className="paper-empty-icon">
              <Calendar className="h-8 w-8 text-gray-400" />
            </div>
            <div className="paper-empty-title text-elegant">No upcoming deadlines</div>
            <div className="paper-empty-description text-elegant">Create roadmap milestones or schedule letters to see upcoming items.</div>
          </div>
        </>
      )
    }

    return (
      <>
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 bg-gray-100 rounded-xl flex items-center justify-center shadow-lg">
            <Calendar className="h-5 w-5 text-gray-600" />
          </div>
          <h3 className="text-xl font-semibold text-paper text-elegant">Upcoming</h3>
        </div>
        <div className="paper-list">
          {upcomingItems.map((item) => (
            <div key={item.id} className={`paper-list-item border-l-4 ${getUrgencyColor(item.date)} transition-all duration-200 hover:shadow-sm hover:scale-[1.02]`}>
              <div className="flex items-start gap-4">
                <div className="text-2xl text-paper">{getTypeIcon(item.type)}</div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="font-semibold text-paper truncate text-elegant">{item.title}</h4>
                    <span className="text-sm text-paper-secondary whitespace-nowrap ml-3 font-medium text-elegant">
                      {formatDate(item.date)}
                    </span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-paper-secondary font-medium text-elegant">{item.source}</span>
                    <span className="text-xs text-paper-secondary">•</span>
                    <span className="text-xs text-paper-secondary font-medium capitalize text-elegant">{item.type}</span>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </>
    )
  }

  return (
    <div className="page-container paper-texture">
      <div className="content-wrapper-7xl">
        {/* Header Section */}
        <div className="paper-header">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <div className="w-16 h-16 bg-gray-100 rounded-2xl flex items-center justify-center shadow-lg flex-shrink-0" data-tutorial="dashboard-icon">
                  <LayoutDashboard className="h-8 w-8 text-gray-600" />
                </div>
                <div>
                  <h1 className="heading-primary text-elegant" data-tutorial="welcome-message">
                    {greeting}, {firstName}
                  </h1>
                  <p className="text-paper-secondary text-lg">
                    Ready to continue your PhD journey with {aiName}?
                  </p>
                </div>
              </div>
            </div>
            
            <div className="flex items-center gap-4">
              {/* Tutorial button removed to avoid duplication with floating button */}
            </div>

          </div>
        </div>

        {/* Main Dashboard Grid */}
        <div className="paper-grid-2 mb-8">
          <div className="paper-card paper-spacing-md paper-card-interactive" data-tutorial="upcoming-card">
            <UpcomingCard />
          </div>
          <div className="paper-card paper-spacing-md paper-card-interactive" data-tutorial="progress-card">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 bg-gray-100 rounded-xl flex items-center justify-center shadow-lg">
                <Target className="h-5 w-5 text-gray-600" />
              </div>
              <h3 className="text-xl font-semibold text-paper text-elegant">Proof of Progress</h3>
            </div>
            <ProofOfProgress />
          </div>
        </div>
        
        <div className="paper-grid-2">
          <div className="paper-card paper-spacing-md paper-card-interactive" data-tutorial="mood-card">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 bg-gray-100 rounded-xl flex items-center justify-center shadow-lg">
                <Heart className="h-5 w-5 text-gray-600" />
              </div>
              <h3 className="text-xl font-semibold text-paper text-elegant">Mood Insights</h3>
            </div>
            <MoodTracking />
          </div>
          
          <div className="paper-card paper-spacing-md paper-card-interactive" data-tutorial="reading-card">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 bg-gray-100 rounded-xl flex items-center justify-center shadow-lg">
                <BookOpen className="h-5 w-5 text-gray-600" />
              </div>
              <h3 className="text-xl font-semibold text-paper text-elegant">Reading Stats</h3>
            </div>
            <ReadingStats />
          </div>
        </div>
      </div>

      {/* Floating Tutorial Button */}
      <TutorialButton />

      {/* Letter Unseal Notification */}
      {showLetterNotification && (
        <LetterUnsealNotification
          onClose={() => {
            setShowLetterNotification(false)
            localStorage.removeItem('letterNotificationDate')
          }}
          onUnseal={handleLetterUnseal}
        />
      )}
      
      {/* Error Modal */}
      <ErrorModal
        isOpen={errorModal.isOpen}
        onClose={() => setErrorModal({ isOpen: false, title: '', message: '' })}
        title={errorModal.title}
        message={errorModal.message}
      />
    </div>
  )
}