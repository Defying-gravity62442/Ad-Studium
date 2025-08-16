import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { createPerplexityService } from '@/lib/ai/perplexity'
import { createBedrockService } from '@/lib/ai/bedrock'
import { inferSourceType } from '@/lib/utils/source-utils'

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { 
      goal, 
      currentDepartment, 
      currentInstitution, 
      background,
      toneInstruction
    } = await request.json()

    if (!goal || typeof goal !== 'string' || goal.trim().length === 0) {
      return NextResponse.json(
        { error: 'Goal is required and must be a non-empty string' },
        { status: 400 }
      )
    }

    const currentDate = new Date().toISOString().split('T')[0]

    // Step 1: Search with Perplexity
    const perplexityService = createPerplexityService()
    
    const searchResults = await perplexityService.searchForRoadmap({
      goal: goal.trim(),
      currentDepartment: currentDepartment?.trim(),
      currentInstitution: currentInstitution?.trim(),
      background: background?.trim(),
      currentDate
    })

    // Step 2: Process with Claude Bedrock
    const bedrockService = createBedrockService()
    
    const generatedRoadmap = await bedrockService.generateRoadmapFromSearch({
      goal: goal.trim(),
      searchResults: searchResults.text,
      currentDepartment: currentDepartment?.trim(),
      currentInstitution: currentInstitution?.trim(),
      background: background?.trim(),
      currentDate,
      toneInstruction: toneInstruction?.trim(),
      sourcesText: `\n\nSources from search (for your awareness, do not fabricate):\n${(searchResults.sources || [])
        .map(s => `- ${s.title}: ${s.url}`)
        .join('\n')}`
    })

    // Sort milestones by deadline to ensure chronological order
    const sortedMilestones = generatedRoadmap.milestones.sort((a, b) => {
      return new Date(a.deadline).getTime() - new Date(b.deadline).getTime()
    })

    const response = {
      ...generatedRoadmap,
      milestones: sortedMilestones,
      sources: (searchResults.sources || []).map(s => ({
        title: s.title,
        url: s.url,
        type: inferSourceType(s.url, s.title)
      })),
      metadata: {
        goal,
        currentDepartment,
        currentInstitution,
        background,
        processedDate: currentDate,
        searchResultsLength: searchResults.text.length
      }
    }

    return NextResponse.json(response)
  } catch (error) {
    console.error('Roadmap generation failed:', error)

    if (error instanceof Error) {
      // Handle specific error types
      if (error.message.includes('Perplexity')) {
        return NextResponse.json(
          { error: 'Failed to gather research information. Please try again.' },
          { status: 500 }
        )
      }
      
      if (error.message.includes('Bedrock')) {
        return NextResponse.json(
          { error: 'Failed to generate roadmap structure. Please try again.' },
          { status: 500 }
        )
      }

      if (error.message.includes('API key') || error.message.includes('configuration')) {
        return NextResponse.json(
          { error: 'Service configuration error' },
          { status: 500 }
        )
      }
      
      if (error.message.includes('401') || error.message.includes('403')) {
        return NextResponse.json(
          { error: 'Authentication failed with external services' },
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
      { error: 'Failed to generate roadmap' },
      { status: 500 }
    )
  }
}