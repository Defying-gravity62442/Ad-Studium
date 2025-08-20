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

    const steps = await prisma.tutorialStep.findMany({
      where: { isActive: true },
      orderBy: { stepNumber: 'asc' }
    })

    return NextResponse.json({ steps })
  } catch (error) {
    console.error('Error fetching tutorial steps:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { stepNumber, title, description, targetPage, targetElement, content } = await req.json()

    if (!stepNumber || !title || !description || !content) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    const step = await prisma.tutorialStep.create({
      data: {
        stepNumber,
        title,
        description,
        targetPage,
        targetElement,
        content,
        isActive: true
      }
    })

    return NextResponse.json({ step })
  } catch (error) {
    console.error('Error creating tutorial step:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}