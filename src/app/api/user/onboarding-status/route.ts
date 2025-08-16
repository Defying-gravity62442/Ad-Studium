import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'

export async function GET(req: NextRequest) {
  try {
    console.log('API: Fetching onboarding status...')
    const session = await getServerSession(authOptions)
    console.log('API: Session user ID:', session?.user?.id)
    console.log('API: Full session:', JSON.stringify(session, null, 2))
    
    if (!session?.user?.id) {
      console.log('API: No session or user ID')
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: {
        id: true,
        encryptionKey: true,
        currentInstitution: true,
        fieldsOfStudy: true,
        aiAssistantName: true,
        aiPersonality: true,
        hasCompletedOnboarding: true,
        calendarIntegrationEnabled: true,
        createdAt: true,
        updatedAt: true,
      }
    })

    console.log('API: User found:', {
      id: user?.id,
      hasEncryptionKey: !!user?.encryptionKey,
      createdAt: user?.createdAt,
      updatedAt: user?.updatedAt
    })

    if (!user) {
      console.log('API: User not found')
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    // Check if user has any roadmaps
    const roadmapCount = await prisma.roadmap.count({
      where: { userId: session.user.id }
    })

    console.log('API: Roadmap count:', roadmapCount)

    return NextResponse.json({
      user,
      hasRoadmaps: roadmapCount > 0
    })
  } catch (error) {
    console.error('API: Error fetching onboarding status:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}