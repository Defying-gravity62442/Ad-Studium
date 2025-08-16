import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get all reading logs for the user (encrypted)
    const readingLogs = await prisma.readingLog.findMany({
      where: {
        reading: {
          userId: session.user.id
        }
      },
      include: {
        reading: true
      },
      orderBy: {
        createdAt: 'desc'
      }
    })

    // Get all readings with their total pages
    const readings = await prisma.reading.findMany({
      where: {
        userId: session.user.id
      },
      include: {
        readingLogs: true
      }
    })


    // Return encrypted data for client-side processing
    // The client will decrypt and calculate statistics
    return NextResponse.json({
      encryptedReadingLogs: readingLogs,
      encryptedReadings: readings,
      requiresClientProcessing: true
    })
  } catch (error) {
    console.error('Failed to get reading statistics:', error)
    return NextResponse.json(
      { error: 'Failed to get reading statistics' },
      { status: 500 }
    )
  }
}