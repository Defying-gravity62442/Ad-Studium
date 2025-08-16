import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { safeParseEncryptedData } from '@/lib/encryption'
import { getCurrentJournalDate } from '@/lib/date-utils'

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
    const currentJournalDate = getCurrentJournalDate(userTimezone)

    // Find today's journal entry
    const todayJournal = await prisma.journal.findFirst({
      where: {
        userId: session.user.id,
        date: {
          gte: new Date(currentJournalDate.dateString + 'T00:00:00Z'),
          lt: new Date(new Date(currentJournalDate.dateString + 'T00:00:00Z').getTime() + 24 * 60 * 60 * 1000)
        }
      },
      orderBy: { createdAt: 'desc' },
      include: {
        aiConversations: true
      }
    })

    if (!todayJournal) {
      return NextResponse.json({ 
        journal: null,
        journalDate: currentJournalDate.dateString
      })
    }

    // Return encrypted data as-is - client will decrypt
    const parsedContent = safeParseEncryptedData(todayJournal.content)
    if (!parsedContent) {
      console.error('Failed to parse encrypted journal content')
      console.error('Raw content data:', todayJournal.content)
      return NextResponse.json(
        { error: 'Corrupted journal data detected' },
        { status: 500 }
      )
    }

    const journalWithEncryptedData = {
      ...todayJournal,
      title: todayJournal.title ? safeParseEncryptedData(todayJournal.title) : null,
      content: parsedContent,
      mood: todayJournal.mood ? safeParseEncryptedData(todayJournal.mood) : null,
      tags: todayJournal.tags.map(tag => safeParseEncryptedData(tag)),
      journalDate: currentJournalDate.dateString,
      canEdit: new Date() < todayJournal.canEditUntil,
      canDelete: new Date() < todayJournal.canEditUntil
    }

    return NextResponse.json({ 
      journal: journalWithEncryptedData,
      journalDate: currentJournalDate.dateString
    })
  } catch (error) {
    console.error('Failed to fetch today\'s journal:', error)
    return NextResponse.json(
      { error: 'Failed to fetch today\'s journal' },
      { status: 500 }
    )
  }
}