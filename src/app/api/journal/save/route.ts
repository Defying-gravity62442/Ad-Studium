import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { serializeEncryptedData, validateEncryptedData } from '@/lib/encryption'
import { getCurrentJournalDate } from '@/lib/date-utils'

export async function POST(request: NextRequest) {
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
    
    const { content, title, mood, tags } = await request.json()

    // Validate that data is properly encrypted
    if (!validateEncryptedData(content)) {
      return NextResponse.json(
        { error: 'Invalid encrypted content format' },
        { status: 400 }
      )
    }

    if (title && !validateEncryptedData(title)) {
      return NextResponse.json(
        { error: 'Invalid encrypted title format' },
        { status: 400 }
      )
    }

    if (mood && !validateEncryptedData(mood)) {
      return NextResponse.json(
        { error: 'Invalid encrypted mood format' },
        { status: 400 }
      )
    }

    if (tags && tags.some((tag: any) => !validateEncryptedData(tag))) {
      return NextResponse.json(
        { error: 'Invalid encrypted tags format' },
        { status: 400 }
      )
    }

    // Check if today's journal already exists
    const existingJournal = await prisma.journal.findFirst({
      where: {
        userId: session.user.id,
        date: {
          gte: new Date(currentJournalDate.dateString + 'T00:00:00Z'),
          lt: new Date(new Date(currentJournalDate.dateString + 'T00:00:00Z').getTime() + 24 * 60 * 60 * 1000)
        }
      }
    })

    let journal
    const canEditUntil = new Date()
    canEditUntil.setDate(canEditUntil.getDate() + 7)

    if (existingJournal) {
      // Check if journal can still be edited
      if (new Date() > existingJournal.canEditUntil) {
        return NextResponse.json(
          { 
            error: 'Journal is in 7-day cooling period and cannot be edited',
            coolingPeriodMessage: 'To help maintain authentic self-reflection, journals cannot be edited for 7 days after creation.'
          }, 
          { status: 403 }
        )
      }

      // Update existing journal
      journal = await prisma.journal.update({
        where: { id: existingJournal.id },
        data: {
          title: title ? serializeEncryptedData(title) : null,
          content: serializeEncryptedData(content),
          mood: mood ? serializeEncryptedData(mood) : null,
          tags: tags ? tags.map(serializeEncryptedData) : [],
          updatedAt: new Date()
        }
      })
    } else {
      // Create new journal
      journal = await prisma.journal.create({
        data: {
          userId: session.user.id,
          title: title ? serializeEncryptedData(title) : null,
          content: serializeEncryptedData(content),
          mood: mood ? serializeEncryptedData(mood) : null,
          tags: tags ? tags.map(serializeEncryptedData) : [],
          canEditUntil,
          date: new Date(currentJournalDate.dateString + 'T00:00:00Z')
        }
      })
    }

    return NextResponse.json({ 
      success: true,
      journal: {
        id: journal.id,
        title: title || null,
        content,
        mood: mood || null,
        tags: tags || [],
        journalDate: currentJournalDate.dateString,
        canEdit: new Date() < journal.canEditUntil,
        canDelete: new Date() < journal.canEditUntil,
        createdAt: journal.createdAt,
        updatedAt: journal.updatedAt
      }
    })
  } catch (error) {
    console.error('Failed to save journal:', error)
    return NextResponse.json(
      { error: 'Failed to save journal' },
      { status: 500 }
    )
  }
}