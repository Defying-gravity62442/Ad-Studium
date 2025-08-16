import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { safeParseEncryptedData } from '@/lib/encryption'

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Fetch all reading reflections for the current user
    const reflections = await prisma.readingReflection.findMany({
      where: {
        reading: {
          userId: session.user.id
        }
      },
      include: {
        reading: {
          select: {
            id: true,
            title: true,
            docToken: true
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    })

    // Parse encrypted data for client decryption
    const reflectionsWithEncryptedData = reflections.map(reflection => ({
      ...reflection,
      response: safeParseEncryptedData(reflection.response),
      aiInsights: reflection.aiInsights ? safeParseEncryptedData(reflection.aiInsights) : null,
      reading: {
        ...reflection.reading,
        title: reflection.reading.title ? safeParseEncryptedData(reflection.reading.title) : null
      }
    }))

    return NextResponse.json({ 
      reflections: reflectionsWithEncryptedData 
    })

  } catch (error) {
    console.error('Failed to fetch reading reflections:', error)
    return NextResponse.json(
      { error: 'Failed to fetch reading reflections' },
      { status: 500 }
    )
  }
}