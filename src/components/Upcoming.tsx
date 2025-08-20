"use client"

import { useEffect, useState } from 'react'
import { StaggeredItem, Skeleton, Pulse, FadeIn } from '@/components/ui'

interface UpcomingItem {
  id: string
  type: 'roadmap' | 'calendar' | 'deadline' | 'reminder'
  title: string
  date: string
  description?: string
  priority: 'high' | 'medium' | 'low'
}

export default function Upcoming() {
  const [upcomingItems, setUpcomingItems] = useState<UpcomingItem[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    fetchUpcomingItems()
  }, [])

  const fetchUpcomingItems = async () => {
    try {
      const response = await fetch('/api/dashboard/upcoming')
      if (!response.ok) {
        throw new Error('Failed to fetch upcoming items')
      }
      
      const data = await response.json()
      setUpcomingItems(data.items || [])
    } catch (error) {
      console.error('Failed to fetch upcoming items:', error)
      // Fallback to empty array
      setUpcomingItems([])
    } finally {
      setIsLoading(false)
    }
  }

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'roadmap': return '🗺️'
      case 'calendar': return '📅'
      case 'deadline': return '⏰'
      case 'reminder': return '🔔'
      default: return '📌'
    }
  }

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high': return 'border-l-red-500 bg-red-50'
      case 'medium': return 'border-l-yellow-500 bg-yellow-50'
      case 'low': return 'border-l-green-500 bg-green-50'
      default: return 'border-l-gray-500 bg-gray-50'
    }
  }

  const formatDate = (dateString: string) => {
    // Parse YYYY-MM-DD format directly to avoid timezone issues
    const [year, month, day] = dateString.split('T')[0].split('-')
    const date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day))
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

  const getUrgencyText = (dateString: string) => {
    // Parse YYYY-MM-DD format directly to avoid timezone issues
    const [year, month, day] = dateString.split('T')[0].split('-')
    const date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day))
    const now = new Date()
    const diffInDays = Math.ceil((date.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
    
    if (diffInDays <= 1) return 'text-red-600 font-medium'
    if (diffInDays <= 3) return 'text-orange-600'
    return 'text-gray-600'
  }

  const isUrgent = (dateString: string) => {
    // Parse YYYY-MM-DD format directly to avoid timezone issues
    const [year, month, day] = dateString.split('T')[0].split('-')
    const date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day))
    const now = new Date()
    const diffInDays = Math.ceil((date.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
    return diffInDays <= 1
  }

  if (isLoading) {
    return (
      <div className="bg-white border-2 border-gray-200 rounded-lg p-6">
        <h3 className="text-xl font-semibold text-black mb-4">Upcoming</h3>
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <StaggeredItem key={i} index={i} delay={100}>
              <Skeleton type="rectangle" className="h-16" />
            </StaggeredItem>
          ))}
        </div>
      </div>
    )
  }

  if (upcomingItems.length === 0) {
    return (
      <div className="bg-white border-2 border-gray-200 rounded-lg p-6">
        <h3 className="text-xl font-semibold text-black mb-4">Upcoming</h3>
        <div className="text-center py-8">
          <div className="text-4xl mb-4 opacity-20">
            <Pulse>📅</Pulse>
          </div>
          <p className="text-gray-600 mb-2">No upcoming deadlines or events.</p>
          <p className="text-gray-500 text-sm">Create roadmap milestones or schedule letters to see upcoming items.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-white border-2 border-gray-200 rounded-lg p-6">
      <FadeIn>
        <h3 className="text-xl font-semibold text-black mb-4">Upcoming</h3>
      </FadeIn>
      <div className="space-y-3">
        {upcomingItems.map((item, index) => (
          <StaggeredItem key={item.id} index={index} delay={100}>
            <div
              className={`p-4 rounded-lg border-l-4 ${getPriorityColor(item.priority)} transition-all duration-200 hover-lift ${
                isUrgent(item.date) ? 'animate-pulse' : ''
              }`}
            >
              <div className="flex items-start gap-3">
                <div className="text-2xl flex-shrink-0">
                  {getTypeIcon(item.type)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-1">
                    <h4 className="font-semibold text-gray-900 truncate">{item.title}</h4>
                    <span className={`text-sm whitespace-nowrap ml-3 font-medium ${getUrgencyText(item.date)}`}>
                      {formatDate(item.date)}
                    </span>
                  </div>
                  {item.description && (
                    <p className="text-sm text-gray-600 line-clamp-2">{item.description}</p>
                  )}
                  <div className="flex items-center gap-2 mt-2">
                    <span className="text-xs text-gray-500 font-medium capitalize">{item.type}</span>
                    <span className="text-xs text-gray-400">•</span>
                    <span className="text-xs text-gray-500 font-medium capitalize">{item.priority} priority</span>
                  </div>
                </div>
              </div>
            </div>
          </StaggeredItem>
        ))}
      </div>
    </div>
  )
}