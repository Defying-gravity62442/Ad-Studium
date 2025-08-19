import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { createBedrockService } from '@/lib/ai/bedrock'

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
      background
    } = await request.json()

    if (!goal || typeof goal !== 'string' || goal.trim().length === 0) {
      return NextResponse.json(
        { error: 'Goal is required and must be a non-empty string' },
        { status: 400 }
      )
    }

    const bedrockService = createBedrockService()
    
    const sanityCheck = await bedrockService.checkGoalSanity({
      goal: goal.trim(),
      currentDepartment: currentDepartment?.trim(),
      currentInstitution: currentInstitution?.trim(),
      background: background?.trim()
    })

    return NextResponse.json(sanityCheck)
  } catch (error) {
    console.error('Goal sanity check failed:', error)

    if (error instanceof Error) {
      if (error.message.includes('Bedrock')) {
        return NextResponse.json(
          { error: 'Failed to analyze goal. Please try again.' },
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
      { error: 'Failed to analyze goal' },
      { status: 500 }
    )
  }
}
