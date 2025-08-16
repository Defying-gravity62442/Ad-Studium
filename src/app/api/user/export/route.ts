import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'

export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const userId = session.user.id

    // Fetch all user data
    const [
      user,
      journals,
      roadmaps,
      letters,
      readings,
      readingLogs,
      dailySummaries,
      weeklySummaries,
      monthlySummaries,
      yearlySummaries
    ] = await Promise.all([
      prisma.user.findUnique({
        where: { id: userId },
        select: {
          id: true,
          name: true,
          email: true,
          image: true,
          hasCompletedOnboarding: true,
          timezone: true,
          currentInstitution: true,
          fieldsOfStudy: true,
          aiAssistantName: true,
          aiPersonality: true,
          createdAt: true,
          updatedAt: true,
        }
      }),
      prisma.journal.findMany({
        where: { userId },
        include: {
          aiConversations: true
        }
      }),
      prisma.roadmap.findMany({
        where: { userId },
        include: {
          milestones: true
        }
      }),
      prisma.letterToFutureSelf.findMany({
        where: { userId }
      }),
      prisma.reading.findMany({
        where: { userId },
        include: {
          reflections: true
        }
      }),
      prisma.readingLog.findMany({
        where: {
          reading: {
            userId
          }
        }
      }),
      prisma.dailySummary.findMany({
        where: {
          journal: {
            userId
          }
        }
      }),
      prisma.weeklySummary.findMany({
        where: { userId }
      }),
      prisma.monthlySummary.findMany({
        where: { userId }
      }),
      prisma.yearlySummary.findMany({
        where: { userId }
      })
    ])

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    // Compile all data into export format
    const exportData = {
      exportedAt: new Date().toISOString(),
      user: {
        ...user,
        // Remove sensitive fields
        encryptionKey: undefined,
      },
      journals: journals.map(journal => ({
        ...journal,
        aiConversations: journal.aiConversations ? [journal.aiConversations] : []
      })),
      roadmaps,
      letters,
      readings,
      readingLogs,
      summaries: {
        daily: dailySummaries,
        weekly: weeklySummaries,
        monthly: monthlySummaries,
        yearly: yearlySummaries,
      },
      metadata: {
        version: '1.0',
        format: 'ad-studium-export',
        description: 'Complete export of your Ad Studium data. All encrypted fields remain encrypted and can be decrypted using your client-side encryption key.',
        totalJournals: journals.length,
        totalRoadmaps: roadmaps.length,
        totalLetters: letters.length,
        totalReadings: readings.length,
        totalReadingLogs: readingLogs.length,
      }
    }

    return NextResponse.json(exportData)
  } catch (error) {
    console.error('Error exporting user data:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}