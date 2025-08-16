import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { serializeEncryptedData, safeParseEncryptedData, validateEncryptedData } from '@/lib/encryption'
import { getJournalDate, isJournalInCoolingPeriod, isJournalPast } from '@/lib/date-utils'

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
    const { searchParams } = new URL(request.url)
    const date = searchParams.get('date')
    const limit = searchParams.get('limit')

    const journals = await prisma.journal.findMany({
      where: {
        userId: session.user.id,
        ...(date && { date: new Date(date) }),
      },
      orderBy: { createdAt: 'desc' },
      take: limit ? parseInt(limit) : undefined,
      include: {
        dailySummary: true,
        aiConversations: true
      }
    })

    // Return encrypted data as-is with additional metadata - client will decrypt
    const journalsWithEncryptedData = journals.map(journal => ({
      ...journal,
      title: journal.title ? safeParseEncryptedData(journal.title) : null,
      content: safeParseEncryptedData(journal.content),
      mood: journal.mood ? safeParseEncryptedData(journal.mood) : null,
      tags: journal.tags.map(tag => safeParseEncryptedData(tag)),
      dailySummary: journal.dailySummary ? {
        ...journal.dailySummary,
        content: safeParseEncryptedData(journal.dailySummary.content),
        mood: journal.dailySummary.mood ? safeParseEncryptedData(journal.dailySummary.mood) : null,
        keyTopics: journal.dailySummary.keyTopics.map(topic => safeParseEncryptedData(topic))
      } : null,
      isPast: isJournalPast(journal.createdAt, userTimezone),
      isInCoolingPeriod: isJournalInCoolingPeriod(journal.createdAt, userTimezone),
      canEdit: !isJournalInCoolingPeriod(journal.createdAt, userTimezone),
      canDelete: !isJournalInCoolingPeriod(journal.createdAt, userTimezone)
    }))

    return NextResponse.json({ journals: journalsWithEncryptedData })
  } catch (error) {
    console.error('Failed to fetch journals:', error)
    return NextResponse.json(
      { error: 'Failed to fetch journals' },
      { status: 500 }
    )
  }
}

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
    const { title, content, mood, tags } = await request.json()

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

    // Get the proper journal date based on 3am boundary
    const now = new Date()
    const journalDate = getJournalDate(now, userTimezone)
    
    const canEditUntil = new Date()
    canEditUntil.setDate(canEditUntil.getDate() + 7)

    const journal = await prisma.journal.create({
      data: {
        userId: session.user.id,
        title: title ? serializeEncryptedData(title) : null,
        content: serializeEncryptedData(content),
        mood: mood ? serializeEncryptedData(mood) : null,
        tags: tags ? tags.map(serializeEncryptedData) : [],
        canEditUntil,
        date: new Date(journalDate.dateString + 'T00:00:00Z'), // Set to the journal date
      },
    })

    return NextResponse.json({ 
      journal: {
        ...journal,
        title: title || null,
        content,
        mood: mood || null,
        tags: tags || [],
        journalDateString: journalDate.dateString,
        canEdit: true,
        canDelete: true,
        isInCoolingPeriod: true,
        isPast: false
      }
    })
  } catch (error) {
    console.error('Failed to create journal:', error)
    return NextResponse.json(
      { error: 'Failed to create journal' },
      { status: 500 }
    )
  }
}

export async function PUT(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const journalId = searchParams.get('id')
    
    if (!journalId) {
      return NextResponse.json({ error: 'Journal ID is required' }, { status: 400 })
    }

    // Get user's timezone
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { timezone: true }
    })

    const userTimezone = user?.timezone || 'UTC'

    // Check if journal exists and belongs to user
    const existingJournal = await prisma.journal.findFirst({
      where: {
        id: journalId,
        userId: session.user.id
      }
    })

    if (!existingJournal) {
      return NextResponse.json({ error: 'Journal not found' }, { status: 404 })
    }

    // Check if journal is in cooling period
    if (isJournalInCoolingPeriod(existingJournal.createdAt, userTimezone)) {
      return NextResponse.json(
        { 
          error: 'Journal is in 7-day cooling period and cannot be edited',
          coolingPeriodMessage: 'To help maintain authentic self-reflection, journals cannot be edited for 7 days after creation. This prevents second-guessing your genuine thoughts and feelings.'
        }, 
        { status: 403 }
      )
    }

    const { title, content, mood, tags } = await request.json()

    // Validate encrypted data
    if (!validateEncryptedData(content)) {
      return NextResponse.json({ error: 'Invalid encrypted content format' }, { status: 400 })
    }

    if (title && !validateEncryptedData(title)) {
      return NextResponse.json({ error: 'Invalid encrypted title format' }, { status: 400 })
    }

    if (mood && !validateEncryptedData(mood)) {
      return NextResponse.json({ error: 'Invalid encrypted mood format' }, { status: 400 })
    }

    if (tags && tags.some((tag: any) => !validateEncryptedData(tag))) {
      return NextResponse.json({ error: 'Invalid encrypted tags format' }, { status: 400 })
    }

    const updatedJournal = await prisma.journal.update({
      where: { id: journalId },
      data: {
        title: title ? serializeEncryptedData(title) : null,
        content: serializeEncryptedData(content),
        mood: mood ? serializeEncryptedData(mood) : null,
        tags: tags ? tags.map(serializeEncryptedData) : [],
        updatedAt: new Date()
      }
    })

    return NextResponse.json({ 
      journal: {
        ...updatedJournal,
        title: title || null,
        content,
        mood: mood || null,
        tags: tags || []
      }
    })
  } catch (error) {
    console.error('Failed to update journal:', error)
    return NextResponse.json({ error: 'Failed to update journal' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const journalId = searchParams.get('id')
    
    if (!journalId) {
      return NextResponse.json({ error: 'Journal ID is required' }, { status: 400 })
    }

    // Get user's timezone
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { timezone: true }
    })

    const userTimezone = user?.timezone || 'UTC'

    // Check if journal exists and belongs to user
    const existingJournal = await prisma.journal.findFirst({
      where: {
        id: journalId,
        userId: session.user.id
      }
    })

    if (!existingJournal) {
      return NextResponse.json({ error: 'Journal not found' }, { status: 404 })
    }

    // Check if journal is in cooling period
    if (isJournalInCoolingPeriod(existingJournal.createdAt, userTimezone)) {
      return NextResponse.json(
        { 
          error: 'Journal is in 7-day cooling period and cannot be deleted',
          coolingPeriodMessage: 'To help maintain authentic self-reflection, journals cannot be deleted for 7 days after creation. This prevents second-guessing your genuine thoughts and feelings.'
        }, 
        { status: 403 }
      )
    }

    await prisma.journal.delete({
      where: { id: journalId }
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Failed to delete journal:', error)
    return NextResponse.json({ error: 'Failed to delete journal' }, { status: 500 })
  }
}