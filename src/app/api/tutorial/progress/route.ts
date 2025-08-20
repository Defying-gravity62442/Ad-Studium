import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const progress = await prisma.tutorialProgress.findUnique({
      where: { userId: session.user.id }
    })

    return NextResponse.json({ progress })
  } catch (error) {
    console.error('Error fetching tutorial progress:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { currentStep, completedSteps, isCompleted } = await req.json()

    if (currentStep === undefined || !Array.isArray(completedSteps) || isCompleted === undefined) {
      return NextResponse.json({ error: 'Invalid progress data' }, { status: 400 })
    }

    const progress = await prisma.tutorialProgress.upsert({
      where: { userId: session.user.id },
      update: {
        currentStep,
        completedSteps,
        isCompleted,
        lastSeenAt: new Date()
      },
      create: {
        userId: session.user.id,
        currentStep,
        completedSteps,
        isCompleted,
        lastSeenAt: new Date()
      }
    })

    return NextResponse.json({ progress })
  } catch (error) {
    console.error('Error updating tutorial progress:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}