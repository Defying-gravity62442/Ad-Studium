import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { gatherAIPromptContext, getUserCustomization } from '@/lib/context-service'

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get user's timezone
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { timezone: true }
    })

    const userTimezone = user?.timezone || 'UTC'
    
    // Gather context data (returns encrypted data)
    const [contextData, userCustomization] = await Promise.all([
      gatherAIPromptContext(session.user.id, userTimezone),
      getUserCustomization(session.user.id)
    ])

    return NextResponse.json({
      contextData,
      userCustomization
    })
  } catch (error) {
    console.error('Failed to gather AI prompt context:', error)
    return NextResponse.json({ error: 'Failed to gather context' }, { status: 500 })
  }
}
