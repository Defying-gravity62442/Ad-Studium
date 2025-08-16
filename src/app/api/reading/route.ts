import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { parseEncryptedData, safeParseEncryptedData } from '@/lib/encryption'

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const readings = await prisma.reading.findMany({
      where: { userId: session.user.id },
      include: {
        reflections: {
          orderBy: { createdAt: 'desc' }
        },
        readingLogs: {
          orderBy: { createdAt: 'desc' }
        }
      },
      orderBy: { createdAt: 'desc' }
    })

    // Return encrypted data as-is - client will decrypt
    const readingsWithEncryptedData = readings.map(reading => ({
      ...reading,
      title: reading.title ? safeParseEncryptedData(reading.title) : null,
      reflections: reading.reflections.map(reflection => ({
        ...reflection,
        response: reflection.response ? safeParseEncryptedData(reflection.response) : null,
        aiInsights: reflection.aiInsights ? safeParseEncryptedData(reflection.aiInsights) : null
      })),
      readingLogs: reading.readingLogs.map(log => ({
        ...log,
        startPage: log.startPage ? safeParseEncryptedData(log.startPage) : null,
        endPage: log.endPage ? safeParseEncryptedData(log.endPage) : null,
        notes: log.notes ? safeParseEncryptedData(log.notes) : null,
        sessionDate: log.sessionDate ? safeParseEncryptedData(log.sessionDate) : null
      }))
    }))

    return NextResponse.json({ readings: readingsWithEncryptedData })
  } catch (error) {
    console.error('Failed to fetch readings:', error)
    return NextResponse.json(
      { error: 'Failed to fetch readings' },
      { status: 500 }
    )
  }
}