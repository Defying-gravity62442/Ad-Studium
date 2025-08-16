import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { serializeEncryptedData, validateEncryptedData } from '@/lib/encryption'

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { journalId, content, mood, keyTopics, summaryDate } = await request.json()

    if (!journalId || !content || !summaryDate) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    // Verify the journal exists and belongs to the user
    const journal = await prisma.journal.findFirst({
      where: {
        id: journalId,
        userId: session.user.id
      }
    })

    if (!journal) {
      return NextResponse.json({ error: 'Journal not found' }, { status: 404 })
    }

    // Check if a summary already exists
    const existingSummary = await prisma.dailySummary.findUnique({
      where: { journalId }
    })

    if (existingSummary) {
      return NextResponse.json({ error: 'Daily summary already exists for this journal' }, { status: 409 })
    }

    // Validate encrypted data
    if (!validateEncryptedData(content)) {
      return NextResponse.json({ error: 'Invalid encrypted content format' }, { status: 400 })
    }

    if (mood && !validateEncryptedData(mood)) {
      return NextResponse.json({ error: 'Invalid encrypted mood format' }, { status: 400 })
    }

    if (keyTopics && keyTopics.some((topic: any) => !validateEncryptedData(topic))) {
      return NextResponse.json({ error: 'Invalid encrypted keyTopics format' }, { status: 400 })
    }

    // Create the daily summary
    const dailySummary = await prisma.dailySummary.create({
      data: {
        journalId,
        content: serializeEncryptedData(content),
        mood: mood ? serializeEncryptedData(mood) : null,
        keyTopics: keyTopics ? keyTopics.map(serializeEncryptedData) : [],
        summaryDate: new Date(summaryDate)
      }
    })

    return NextResponse.json({ 
      success: true,
      summaryId: dailySummary.id
    })

  } catch (error) {
    console.error('Failed to save daily summary:', error)
    return NextResponse.json(
      { error: 'Failed to save daily summary' },
      { status: 500 }
    )
  }
}