"use client"

import { useEffect, useState } from 'react'

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

  const getUrgencyText = (dateString: string) => {
    const date = new Date(dateString)
    const now = new Date()
    const diffInDays = Math.ceil((date.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
    
    if (diffInDays <= 1) return 'text-red-600 font-medium'
    if (diffInDays <= 3) return 'text-orange-600'
    return 'text-gray-600'
  }

  if (isLoading) {
    return (
      <div className="bg-white border-2 border-gray-200 rounded-lg p-6">
        <h3 className="text-xl font-semibold text-black mb-4">Upcoming</h3>
        <div className="text-gray-600">Loading upcoming items...</div>
      </div>
    )
  }

  if (upcomingItems.length === 0) {
    return (
      <div className="bg-white border-2 border-gray-200 rounded-lg p-6">
        <h3 className="text-xl font-semibold text-black mb-4">Upcoming</h3>
        <div className="text-center py-8">
          <p className="text-gray-600 mb-2">No upcoming deadlines or events.</p>
          <p className="text-sm text-gray-500">Create roadmap goals or sync your calendar to see upcoming items.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-white border-2 border-gray-200 rounded-lg p-6">
      <h3 className="text-xl font-semibold text-black mb-6">Upcoming</h3>
      
      <div className="space-y-3">
        {upcomingItems.slice(0, 5).map((item) => (
          <div key={item.id} className={`border-l-4 rounded-r-lg p-4 ${getPriorityColor(item.priority)}`}>
            <div className="flex items-start gap-3">
              <div className="text-lg">{getTypeIcon(item.type)}</div>
              
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between mb-1">
                  <h4 className="font-medium text-black truncate">{item.title}</h4>
                  <span className={`text-sm ${getUrgencyText(item.date)} whitespace-nowrap ml-2`}>
                    {formatDate(item.date)}
                  </span>
                </div>
                
                {item.description && (
                  <p className="text-sm text-gray-700 mb-2">{item.description}</p>
                )}
                
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-500 capitalize">{item.type}</span>
                  <span className="text-xs text-gray-400">•</span>
                  <span className={`text-xs capitalize ${
                    item.priority === 'high' ? 'text-red-600' : 
                    item.priority === 'medium' ? 'text-yellow-600' : 
                    'text-green-600'
                  }`}>
                    {item.priority} priority
                  </span>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
      
      {upcomingItems.length > 5 && (
        <div className="mt-4 text-center">
          <button className="text-sm text-gray-600 hover:text-black border-b border-gray-300 hover:border-black transition-colors">
            View all upcoming items →
          </button>
        </div>
      )}
    </div>
  )
}