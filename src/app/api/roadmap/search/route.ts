import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { createPerplexityService } from '@/lib/ai/perplexity'

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { goal, currentDepartment, currentInstitution, background } = await request.json()

    if (!goal || typeof goal !== 'string' || goal.trim().length === 0) {
      return NextResponse.json(
        { error: 'Goal is required and must be a non-empty string' },
        { status: 400 }
      )
    }

    const currentDate = new Date().toISOString().split('T')[0]

    const perplexityService = createPerplexityService()
    
    const searchResults = await perplexityService.searchForRoadmap({
      goal: goal.trim(),
      currentDepartment: currentDepartment?.trim(),
      currentInstitution: currentInstitution?.trim(),
      background: background?.trim(),
      currentDate
    })

    return NextResponse.json({
      searchResults: searchResults.text,
      sources: searchResults.sources,
      metadata: {
        goal,
        currentDepartment,
        currentInstitution,
        background,
        searchDate: currentDate
      }
    })
  } catch (error) {
    console.error('Perplexity search failed:', error)

    if (error instanceof Error) {
      if (error.message.includes('API key')) {
        return NextResponse.json(
          { error: 'Perplexity API configuration error' },
          { status: 500 }
        )
      }
      
      if (error.message.includes('401') || error.message.includes('403')) {
        return NextResponse.json(
          { error: 'Perplexity API authentication failed' },
          { status: 500 }
        )
      }

      if (error.message.includes('429')) {
        return NextResponse.json(
          { error: 'Rate limit exceeded. Please try again later.' },
          { status: 429 }
        )
      }
    }

    return NextResponse.json(
      { error: 'Failed to search for roadmap information' },
      { status: 500 }
    )
  }
}