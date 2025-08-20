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

    const { readingId, encryptedData, notes } = await request.json()

    if (!readingId) {
      return NextResponse.json({ 
        error: 'Reading ID is required' 
      }, { status: 400 })
    }

    if (!encryptedData) {
      return NextResponse.json({ 
        error: 'Encrypted data is required' 
      }, { status: 400 })
    }

    // Verify that the reading belongs to the current user
    const reading = await prisma.reading.findFirst({
      where: {
        id: readingId,
        userId: session.user.id
      }
    })

    if (!reading) {
      return NextResponse.json({ error: 'Reading not found' }, { status: 404 })
    }

    // Validate required encrypted fields
    if (!validateEncryptedData(encryptedData.startPage) ||
        !validateEncryptedData(encryptedData.endPage) ||
        !validateEncryptedData(encryptedData.sessionDate)) {
      return NextResponse.json(
        { error: 'Invalid encrypted data format. All fields (startPage, endPage, sessionDate) must be properly encrypted.' },
        { status: 400 }
      )
    }

    // Validate encrypted notes if provided
    if (notes && !validateEncryptedData(notes)) {
      return NextResponse.json(
        { error: 'Invalid encrypted notes format' },
        { status: 400 }
      )
    }

    // Create the reading log with encrypted data
    const readingLog = await prisma.readingLog.create({
      data: {
        readingId,
        startPage: serializeEncryptedData(encryptedData.startPage),
        endPage: serializeEncryptedData(encryptedData.endPage),
        notes: notes ? serializeEncryptedData(notes) : null,
        sessionDate: serializeEncryptedData(encryptedData.sessionDate)
      }
    })

    return NextResponse.json({ 
      success: true,
      readingLog: {
        id: readingLog.id,
        readingId: readingLog.readingId,
        createdAt: readingLog.createdAt
      }
    })
  } catch (error) {
    console.error('Failed to create reading log:', error)
    return NextResponse.json(
      { 
        error: 'Failed to create reading log',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const readingId = searchParams.get('readingId')

    // Base query to get reading logs for user's readings
    const whereClause: any = {
      reading: {
        userId: session.user.id
      }
    }

    // Filter by specific reading if provided
    if (readingId) {
      whereClause.readingId = readingId
    }

    const readingLogs = await prisma.readingLog.findMany({
      where: whereClause,
      include: {
        reading: {
          select: {
            id: true,
            title: true,
            docToken: true
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    })

    return NextResponse.json({ readingLogs })
  } catch (error) {
    console.error('Failed to fetch reading logs:', error)
    return NextResponse.json(
      { error: 'Failed to fetch reading logs' },
      { status: 500 }
    )
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const logId = searchParams.get('id')

    if (!logId) {
      return NextResponse.json({ error: 'Log ID is required' }, { status: 400 })
    }

    // Verify that the reading log belongs to the current user
    const readingLog = await prisma.readingLog.findFirst({
      where: {
        id: logId,
        reading: {
          userId: session.user.id
        }
      }
    })

    if (!readingLog) {
      return NextResponse.json({ error: 'Reading log not found' }, { status: 404 })
    }

    // Delete the reading log
    await prisma.readingLog.delete({
      where: { id: logId }
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Failed to delete reading log:', error)
    return NextResponse.json(
      { error: 'Failed to delete reading log' },
      { status: 500 }
    )
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const logId = searchParams.get('id')

    if (!logId) {
      return NextResponse.json({ error: 'Log ID is required' }, { status: 400 })
    }

    const { encryptedData, notes } = await request.json()

    // Verify that the reading log belongs to the current user
    const readingLog = await prisma.readingLog.findFirst({
      where: {
        id: logId,
        reading: {
          userId: session.user.id
        }
      }
    })

    if (!readingLog) {
      return NextResponse.json({ error: 'Reading log not found' }, { status: 404 })
    }

    // Validate encrypted data if provided
    if (encryptedData) {
      if (!validateEncryptedData(encryptedData.startPage) ||
          !validateEncryptedData(encryptedData.endPage) ||
          !validateEncryptedData(encryptedData.sessionDate)) {
        return NextResponse.json(
          { error: 'Invalid encrypted data format. All fields (startPage, endPage, sessionDate) must be properly encrypted.' },
          { status: 400 }
        )
      }
    }

    // Validate encrypted notes if provided
    if (notes && !validateEncryptedData(notes)) {
      return NextResponse.json(
        { error: 'Invalid encrypted notes format' },
        { status: 400 }
      )
    }

    // Update the reading log
    const updateData: any = {}
    
    if (encryptedData) {
      updateData.startPage = serializeEncryptedData(encryptedData.startPage)
      updateData.endPage = serializeEncryptedData(encryptedData.endPage)
      updateData.sessionDate = serializeEncryptedData(encryptedData.sessionDate)
    }
    
    if (notes !== undefined) {
      updateData.notes = notes ? serializeEncryptedData(notes) : null
    }

    const updatedReadingLog = await prisma.readingLog.update({
      where: { id: logId },
      data: updateData
    })

    return NextResponse.json({ 
      success: true,
      readingLog: {
        id: updatedReadingLog.id,
        readingId: updatedReadingLog.readingId,
        createdAt: updatedReadingLog.createdAt
      }
    })
  } catch (error) {
    console.error('Failed to update reading log:', error)
    return NextResponse.json(
      { error: 'Failed to update reading log' },
      { status: 500 }
    )
  }
}