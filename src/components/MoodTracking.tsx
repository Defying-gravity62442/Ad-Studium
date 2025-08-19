"use client"

import { useMoodTracking } from '@/hooks/useMoodTracking'
import { useEffect, useState } from 'react'
import { CountUp, AnimatedProgressBar, StaggeredItem, Pulse, Bounce } from '@/components/ui'

export default function MoodTracking() {
  const { moodStats, isLoading, error } = useMoodTracking()
  const [hasAnimated, setHasAnimated] = useState(false)

  useEffect(() => {
    if (moodStats && !hasAnimated) {
      // Trigger animations after a short delay
      const timer = setTimeout(() => setHasAnimated(true), 100)
      return () => clearTimeout(timer)
    }
  }, [moodStats, hasAnimated])

  if (isLoading) {
    return (
      <div className="text-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-400 mx-auto mb-4"></div>
        <p className="text-gray-600">Loading mood data...</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="text-center py-8">
        <div className="text-red-500 mb-2 text-lg">!</div>
        <p className="text-gray-600">Error loading mood data: {error}</p>
      </div>
    )
  }

  if (!moodStats || moodStats.totalEntries === 0) {
    return (
      <div className="text-center py-12">
        <div className="text-6xl mb-4 opacity-20 font-light animate-pulse">Mood</div>
        <p className="text-gray-600 mb-2 font-medium">No mood data yet</p>
        <p className="text-gray-500 text-sm">Start journaling to see your mood insights.</p>
      </div>
    )
  }

  const { insights, recentMoods } = moodStats

  const getTrendIcon = (trend: string) => {
    switch (trend) {
      case 'improving': return '↗'
      case 'declining': return '↘'
      default: return '→'
    }
  }

  const getTrendColor = (trend: string) => {
    switch (trend) {
      case 'improving': return 'text-green-700'
      case 'declining': return 'text-red-700'
      default: return 'text-gray-600'
    }
  }

  const getStabilityColor = (stability: number) => {
    if (stability >= 80) return 'text-green-700'
    if (stability >= 60) return 'text-yellow-700'
    return 'text-red-700'
  }

  const getConsistencyColor = (consistency: number) => {
    if (consistency >= 80) return 'text-green-700'
    if (consistency >= 60) return 'text-yellow-700'
    return 'text-red-700'
  }

  return (
    <div className="space-y-6">
      {/* Key Metrics */}
      <div className="grid grid-cols-2 gap-4">
        <div className="text-center p-4 bg-gray-50 rounded-xl border border-gray-200 hover-lift">
          <div className="text-2xl font-bold text-gray-900 mb-1">
            <CountUp value={insights.currentStreak} />
          </div>
          <div className="text-xs text-gray-600 font-medium">Day Streak</div>
        </div>
        <div className="text-center p-4 bg-gray-50 rounded-xl border border-gray-200 hover-lift">
          <div className="text-2xl font-bold text-gray-900 mb-1">
            <CountUp value={insights.weeklyAverage} />
          </div>
          <div className="text-xs text-gray-600 font-medium">Entries/Week</div>
        </div>
      </div>

      {/* Emotional Balance */}
      <div>
        <h4 className="text-sm font-semibold mb-4 text-gray-900">Emotional Balance</h4>
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-600">Positive</span>
            <div className="flex items-center space-x-3">
              <div className="w-20 bg-gray-200 rounded-full h-2">
                <AnimatedProgressBar
                  percentage={insights.positiveMoodPercentage}
                  height="h-2"
                  color="bg-green-500"
                  delay={0}
                />
              </div>
              <span className="text-sm font-semibold text-gray-900 w-8">{insights.positiveMoodPercentage}%</span>
            </div>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-600">Negative</span>
            <div className="flex items-center space-x-3">
              <div className="w-20 bg-gray-200 rounded-full h-2">
                <AnimatedProgressBar
                  percentage={insights.negativeMoodPercentage}
                  height="h-2"
                  color="bg-red-500"
                  delay={200}
                />
              </div>
              <span className="text-sm font-semibold text-gray-900 w-8">{insights.negativeMoodPercentage}%</span>
            </div>
          </div>
        </div>
      </div>

      {/* Insights Grid */}
      <div className="grid grid-cols-2 gap-4">
        <div className="text-center p-4 bg-gray-50 rounded-xl border border-gray-200 hover-lift">
          <div className={`text-xl font-bold mb-1 ${getStabilityColor(insights.moodStability)}`}>
            <CountUp value={insights.moodStability} />
          </div>
          <div className="text-xs text-gray-600 font-medium">Stability</div>
        </div>
        <div className="text-center p-4 bg-gray-50 rounded-xl border border-gray-200 hover-lift">
          <div className={`text-xl font-bold mb-1 ${getConsistencyColor(insights.consistencyScore)}`}>
            <CountUp value={insights.consistencyScore} />
          </div>
          <div className="text-xs text-gray-600 font-medium">Consistency</div>
        </div>
      </div>

      {/* Emotional Trend */}
      <div>
        <div className="flex items-center justify-between p-4 bg-gray-50 rounded-xl border border-gray-200 hover-lift">
          <div>
            <div className="text-sm font-semibold text-gray-900">Emotional Trend</div>
            <div className="text-xs text-gray-600 capitalize">
              {insights.emotionalTrend}
            </div>
          </div>
          <Bounce>
            <div className={`text-2xl ${getTrendColor(insights.emotionalTrend)}`}>
              {getTrendIcon(insights.emotionalTrend)}
            </div>
          </Bounce>
        </div>
      </div>

      {/* Most Productive Mood */}
      {insights.mostProductiveMood && (
        <div>
          <div className="text-center p-4 bg-gray-50 rounded-xl border border-gray-200 hover-lift">
            <div className="text-sm font-semibold text-gray-900 mb-1">
              Most Productive Mood
            </div>
            <div className="text-lg font-bold text-gray-900 capitalize">
              {insights.mostProductiveMood}
            </div>
          </div>
        </div>
      )}

      {/* Recent Activity */}
      <div>
        <h4 className="text-sm font-semibold mb-3 text-gray-900">Recent Activity</h4>
        <div className="space-y-2">
          {recentMoods.slice(0, 5).map((entry, index) => (
            <StaggeredItem key={entry.journalId} index={index} delay={100}>
              <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border border-gray-200 hover-lift">
                <div className="text-sm text-gray-600">
                  {new Date(entry.date).toLocaleDateString('en-US', { 
                    month: 'short', 
                    day: 'numeric' 
                  })}
                </div>
                <div className="flex gap-1">
                  {entry.mood.slice(0, 2).map((mood, moodIndex) => (
                    <span
                      key={moodIndex}
                      className="px-2 py-1 rounded-md text-xs border border-gray-300 bg-white text-gray-700 font-medium hover-scale"
                    >
                      {mood}
                    </span>
                  ))}
                  {entry.mood.length > 2 && (
                    <span className="px-2 py-1 rounded-md text-xs border border-gray-300 bg-white text-gray-500 font-medium">
                      +{entry.mood.length - 2}
                    </span>
                  )}
                </div>
              </div>
            </StaggeredItem>
          ))}
        </div>
      </div>

      {/* Streak Info */}
      {insights.longestStreak > 0 && (
        <div className="text-center pt-2">
          <div className="text-xs text-gray-500">
            Longest streak: <span className="font-semibold text-gray-700">{insights.longestStreak} days</span>
          </div>
        </div>
      )}
    </div>
  )
}