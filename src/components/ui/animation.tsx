'use client'

import React, { useEffect, useState, useRef } from 'react'

// CountUp component for animated numbers
interface CountUpProps {
  value: number
  duration?: number
  className?: string
}

export function CountUp({ value, duration = 1000, className = '' }: CountUpProps) {
  const [displayValue, setDisplayValue] = useState(0)
  const [hasAnimated, setHasAnimated] = useState(false)
  const prevValue = useRef(value)

  useEffect(() => {
    if (value !== prevValue.current) {
      setHasAnimated(false)
      prevValue.current = value
    }

    if (!hasAnimated && value > 0) {
      const startTime = Date.now()
      const startValue = 0
      
      const animate = () => {
        const elapsed = Date.now() - startTime
        const progress = Math.min(elapsed / duration, 1)
        
        // Easing function for smooth animation
        const easeOutQuart = 1 - Math.pow(1 - progress, 4)
        const currentValue = Math.floor(startValue + (value - startValue) * easeOutQuart)
        
        setDisplayValue(currentValue)
        
        if (progress < 1) {
          requestAnimationFrame(animate)
        } else {
          setDisplayValue(value)
          setHasAnimated(true)
        }
      }
      
      requestAnimationFrame(animate)
    } else if (value === 0) {
      setDisplayValue(0)
    }
  }, [value, duration, hasAnimated])

  return <span className={`animate-count-up ${className}`}>{displayValue}</span>
}

// Animated Progress Bar component
interface AnimatedProgressBarProps {
  percentage: number
  height?: string
  color?: string
  delay?: number
  className?: string
}

export function AnimatedProgressBar({ 
  percentage, 
  height = 'h-2', 
  color = 'bg-gray-800',
  delay = 0,
  className = ''
}: AnimatedProgressBarProps) {
  const [isVisible, setIsVisible] = useState(false)
  const barRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setTimeout(() => setIsVisible(true), delay)
        }
      },
      { threshold: 0.1 }
    )

    if (barRef.current) {
      observer.observe(barRef.current)
    }

    return () => observer.disconnect()
  }, [delay])

  return (
    <div className={`bg-gray-200 rounded-full ${height} relative overflow-hidden ${className}`} ref={barRef}>
      <div
        className={`${color} rounded-full ${height} transition-all duration-1000 ease-out progress-bar-animated`}
        style={{
          width: isVisible ? `${percentage}%` : '0%',
          '--progress-width': `${percentage}%`
        } as React.CSSProperties}
      />
    </div>
  )
}

// Staggered List Item component
interface StaggeredItemProps {
  children: React.ReactNode
  index: number
  delay?: number
  className?: string
}

export function StaggeredItem({ children, index, delay = 100, className = '' }: StaggeredItemProps) {
  return (
    <div 
      className={`animate-stagger-in ${className}`}
      style={{ animationDelay: `${index * delay}ms` }}
    >
      {children}
    </div>
  )
}

// Loading Skeleton component
interface SkeletonProps {
  type?: 'text' | 'circle' | 'rectangle'
  className?: string
}

export function Skeleton({ type = 'text', className = '' }: SkeletonProps) {
  const baseClasses = 'skeleton'
  const typeClasses = {
    text: 'skeleton-text',
    circle: 'skeleton-circle',
    rectangle: 'skeleton-rectangle'
  }

  return (
    <div className={`${baseClasses} ${typeClasses[type]} ${className}`} />
  )
}

// Fade In component
interface FadeInProps {
  children: React.ReactNode
  delay?: number
  className?: string
}

export function FadeIn({ children, delay = 0, className = '' }: FadeInProps) {
  return (
    <div 
      className={`animate-fade-in-up ${className}`}
      style={{ animationDelay: `${delay}ms` }}
    >
      {children}
    </div>
  )
}

// Pulse component for urgent/important items
interface PulseProps {
  children: React.ReactNode
  className?: string
}

export function Pulse({ children, className = '' }: PulseProps) {
  return (
    <div className={`animate-pulse ${className}`}>
      {children}
    </div>
  )
}

// Bounce component for interactive elements
interface BounceProps {
  children: React.ReactNode
  className?: string
}

export function Bounce({ children, className = '' }: BounceProps) {
  return (
    <div className={`animate-bounce ${className}`}>
      {children}
    </div>
  )
}
