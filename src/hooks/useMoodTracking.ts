import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { useE2EE } from '@/hooks/useE2EE'

interface MoodData {
  date: string
  mood: string[]
  journalId: string
}

interface MoodInsights {
  currentStreak: number
  longestStreak: number
  weeklyAverage: number
  moodStability: number
  positiveMoodPercentage: number
  negativeMoodPercentage: number
  neutralMoodPercentage: number
  mostProductiveMood: string | null

  emotionalTrend: 'improving' | 'declining' | 'stable'
  consistencyScore: number
}

interface MoodStats {
  recentMoods: MoodData[]
  totalEntries: number
  insights: MoodInsights
}

// Define mood categories for analysis
const POSITIVE_MOODS = ['happy', 'excited', 'grateful', 'content', 'energetic', 'optimistic', 'inspired', 'confident', 'accomplished', 'peaceful']
const NEGATIVE_MOODS = ['sad', 'anxious', 'stressed', 'frustrated', 'angry', 'overwhelmed', 'tired', 'worried', 'disappointed', 'lonely']
const NEUTRAL_MOODS = ['neutral', 'calm', 'focused', 'contemplative', 'curious', 'determined', 'ambitious']

export function useMoodTracking() {
  const { data: session } = useSession()
  const { decrypt, isReady } = useE2EE()
  const [moodStats, setMoodStats] = useState<MoodStats | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const categorizeMood = (mood: string): 'positive' | 'negative' | 'neutral' => {
    const lowerMood = mood.toLowerCase()
    if (POSITIVE_MOODS.includes(lowerMood)) return 'positive'
    if (NEGATIVE_MOODS.includes(lowerMood)) return 'negative'
    if (NEUTRAL_MOODS.includes(lowerMood)) return 'neutral'
    return 'neutral' // Default to neutral for unknown moods
  }

  const calculateMoodInsights = (moodData: MoodData[]): MoodInsights => {
    if (moodData.length === 0) {
      return {
        currentStreak: 0,
        longestStreak: 0,
        weeklyAverage: 0,
        moodStability: 0,
        positiveMoodPercentage: 0,
        negativeMoodPercentage: 0,
        neutralMoodPercentage: 0,
        mostProductiveMood: null,
        emotionalTrend: 'stable',
        consistencyScore: 0
      }
    }

    // Calculate current streak (consecutive days with journal entries)
    let currentStreak = 0
    let longestStreak = 0
    let tempStreak = 0
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    // Sort by date (oldest first for streak calculation)
    const sortedData = [...moodData].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
    
    for (let i = 0; i < sortedData.length; i++) {
      const currentDate = new Date(sortedData[i].date)
      currentDate.setHours(0, 0, 0, 0)
      
      if (i === 0) {
        tempStreak = 1
      } else {
        const prevDate = new Date(sortedData[i - 1].date)
        prevDate.setHours(0, 0, 0, 0)
        const dayDiff = (currentDate.getTime() - prevDate.getTime()) / (1000 * 60 * 60 * 24)
        
        if (dayDiff === 1) {
          tempStreak++
        } else {
          tempStreak = 1
        }
      }
      
      longestStreak = Math.max(longestStreak, tempStreak)
    }

    // Calculate current streak (from most recent entry)
    const mostRecentDate = new Date(sortedData[sortedData.length - 1].date)
    mostRecentDate.setHours(0, 0, 0, 0)
    const daysSinceLastEntry = (today.getTime() - mostRecentDate.getTime()) / (1000 * 60 * 60 * 24)
    
    if (daysSinceLastEntry <= 1) {
      currentStreak = tempStreak
    } else {
      currentStreak = 0
    }

    // Calculate mood percentages
    let positiveCount = 0
    let negativeCount = 0
    let neutralCount = 0
    let totalMoodCount = 0

    moodData.forEach(entry => {
      entry.mood.forEach(mood => {
        const category = categorizeMood(mood)
        if (category === 'positive') positiveCount++
        else if (category === 'negative') negativeCount++
        else neutralCount++
        totalMoodCount++
      })
    })

    const positiveMoodPercentage = totalMoodCount > 0 ? (positiveCount / totalMoodCount) * 100 : 0
    const negativeMoodPercentage = totalMoodCount > 0 ? (negativeCount / totalMoodCount) * 100 : 0
    const neutralMoodPercentage = totalMoodCount > 0 ? (neutralCount / totalMoodCount) * 100 : 0

    // Calculate weekly average (entries per week)
    const firstEntry = new Date(sortedData[0].date)
    const lastEntry = new Date(sortedData[sortedData.length - 1].date)
    const weeksBetween = Math.max(1, Math.ceil((lastEntry.getTime() - firstEntry.getTime()) / (1000 * 60 * 60 * 24 * 7)))
    const weeklyAverage = moodData.length / weeksBetween

    // Calculate mood stability (variance in mood categories)
    const moodCategories = moodData.map(entry => 
      entry.mood.map(mood => categorizeMood(mood))
    ).flat()
    
    const categoryCounts = moodCategories.reduce((acc, category) => {
      acc[category] = (acc[category] || 0) + 1
      return acc
    }, {} as { [key: string]: number })
    
    const totalCategories = moodCategories.length
    const expectedEven = totalCategories / 3 // Assuming equal distribution
    const variance = Object.values(categoryCounts).reduce((sum, count) => {
      return sum + Math.pow(count - expectedEven, 2)
    }, 0) / 3
    
    const moodStability = Math.max(0, 100 - (variance / totalCategories) * 100)

    // Determine most productive mood (most frequent positive mood)
    const positiveMoodCounts = moodData.reduce((acc, entry) => {
      entry.mood.forEach(mood => {
        if (categorizeMood(mood) === 'positive') {
          acc[mood] = (acc[mood] || 0) + 1
        }
      })
      return acc
    }, {} as { [key: string]: number })
    
    const mostProductiveMood = Object.entries(positiveMoodCounts).length > 0
      ? Object.entries(positiveMoodCounts).reduce((a, b) => a[1] > b[1] ? a : b)[0]
      : null



    // Calculate emotional trend (comparing recent vs older entries)
    const recentEntries = moodData.slice(0, Math.min(7, moodData.length))
    const olderEntries = moodData.slice(-Math.min(7, moodData.length))
    
    const recentPositive = recentEntries.reduce((count, entry) => 
      count + entry.mood.filter(mood => categorizeMood(mood) === 'positive').length, 0
    )
    const olderPositive = olderEntries.reduce((count, entry) => 
      count + entry.mood.filter(mood => categorizeMood(mood) === 'positive').length, 0
    )
    
    let emotionalTrend: 'improving' | 'declining' | 'stable' = 'stable'
    if (recentPositive > olderPositive + 2) emotionalTrend = 'improving'
    else if (olderPositive > recentPositive + 2) emotionalTrend = 'declining'

    // Calculate consistency score (how regularly they journal)
    const expectedEntries = Math.ceil((lastEntry.getTime() - firstEntry.getTime()) / (1000 * 60 * 60 * 24))
    const consistencyScore = Math.min(100, (moodData.length / expectedEntries) * 100)

    return {
      currentStreak,
      longestStreak,
      weeklyAverage: Math.round(weeklyAverage * 10) / 10,
      moodStability: Math.round(moodStability),
      positiveMoodPercentage: Math.round(positiveMoodPercentage),
      negativeMoodPercentage: Math.round(negativeMoodPercentage),
      neutralMoodPercentage: Math.round(neutralMoodPercentage),
      mostProductiveMood,
      emotionalTrend,
      consistencyScore: Math.round(consistencyScore)
    }
  }

  const fetchMoodData = async () => {
    if (!session?.user || !isReady) {
      setIsLoading(false)
      return
    }

    try {
      setIsLoading(true)
      setError(null)

      const response = await fetch('/api/journal/summary')
      
      if (!response.ok) {
        throw new Error('Failed to fetch mood data')
      }

      const { summaries } = await response.json()
      
      if (!summaries || summaries.length === 0) {
        setMoodStats({
          recentMoods: [],
          totalEntries: 0,
          insights: {
            currentStreak: 0,
            longestStreak: 0,
            weeklyAverage: 0,
            moodStability: 0,
            positiveMoodPercentage: 0,
            negativeMoodPercentage: 0,
            neutralMoodPercentage: 0,
            mostProductiveMood: null,
            emotionalTrend: 'stable',
            consistencyScore: 0
          }
        })
        return
      }

      // Process and decrypt mood data
      const moodData: MoodData[] = []

      for (const summary of summaries) {
        if (summary.mood) {
          try {
            const decryptedMood = await decrypt(summary.mood)
            const moods = decryptedMood.split(',').map((m: string) => m.trim())
            
            moodData.push({
              date: summary.summaryDate,
              mood: moods,
              journalId: summary.journalId
            })
          } catch (decryptError) {
            console.warn('Could not decrypt mood data for summary:', summary.id)
          }
        }
      }

      // Sort by date (most recent first)
      moodData.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())

      // Calculate insights
      const insights = calculateMoodInsights(moodData)

      setMoodStats({
        recentMoods: moodData.slice(0, 7), // Last 7 days
        totalEntries: moodData.length,
        insights
      })

    } catch (err) {
      console.error('Error fetching mood data:', err)
      setError(err instanceof Error ? err.message : 'Failed to fetch mood data')
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchMoodData()
  }, [session?.user, isReady])

  return {
    moodStats,
    isLoading,
    error,
    refetch: fetchMoodData
  }
}