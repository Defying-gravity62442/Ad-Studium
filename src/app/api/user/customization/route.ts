import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'

export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: {
        currentInstitution: true,
        fieldsOfStudy: true,
        background: true,
        aiAssistantName: true,
        aiPersonality: true,
      }
    })

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    return NextResponse.json({ 
      customization: {
        currentInstitution: user.currentInstitution,
        fieldsOfStudy: user.fieldsOfStudy,
        background: user.background,
        aiAssistantName: user.aiAssistantName,
        aiPersonality: user.aiPersonality,
      }
    })
  } catch (error) {
    console.error('Error fetching customization:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json()
    const { currentInstitution, fieldsOfStudy, background, aiAssistantName, aiPersonality } = body

    if (!currentInstitution || !fieldsOfStudy || !aiAssistantName || !aiPersonality) {
      return NextResponse.json({ error: 'All required fields must be provided' }, { status: 400 })
    }

    // Update user with customization data
    await prisma.user.update({
      where: { id: session.user.id },
      data: {
        currentInstitution: JSON.stringify(currentInstitution),
        fieldsOfStudy: JSON.stringify(fieldsOfStudy),
        background: background ? JSON.stringify(background) : null,
        aiAssistantName: JSON.stringify(aiAssistantName),
        aiPersonality: JSON.stringify(aiPersonality),
      }
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error saving customization:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}