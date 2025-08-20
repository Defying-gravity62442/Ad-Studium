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

    const { type, content, startDate, endDate, relatedIds, generatedProof } = await request.json()

    if (!type || !['weekly', 'monthly', 'yearly'].includes(type)) {
      return NextResponse.json({ error: 'Invalid summary type' }, { status: 400 })
    }

    if (!content || !startDate || !endDate || !Array.isArray(relatedIds)) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    // Validate encrypted content
    if (!validateEncryptedData(content)) {
      return NextResponse.json({ error: 'Invalid encrypted content format' }, { status: 400 })
    }

    if (type === 'weekly') {
      // Check if weekly summary already exists
      const existing = await prisma.weeklySummary.findFirst({
        where: {
          userId: session.user.id,
          weekStartDate: new Date(startDate),
          weekEndDate: new Date(endDate)
        }
      })

      if (existing) {
        return NextResponse.json({ error: 'Weekly summary already exists' }, { status: 409 })
      }

      // Create weekly summary with generatedProof if provided
      const weeklySummary = await prisma.weeklySummary.create({
        data: {
          userId: session.user.id,
          content: serializeEncryptedData(content),
          weekStartDate: new Date(startDate),
          weekEndDate: new Date(endDate),
          generatedProof: generatedProof ? serializeEncryptedData(generatedProof) : null
        }
      })

      // Update daily summaries to reference this weekly summary
      await prisma.dailySummary.updateMany({
        where: {
          id: { in: relatedIds },
          journal: { userId: session.user.id }
        },
        data: {
          weeklySummaryId: weeklySummary.id
        }
      })

      return NextResponse.json({ 
        success: true,
        summaryId: weeklySummary.id,
        type: 'weekly'
      })

    } else if (type === 'monthly') {
      // Check if monthly summary already exists
      const existing = await prisma.monthlySummary.findFirst({
        where: {
          userId: session.user.id,
          monthStartDate: new Date(startDate),
          monthEndDate: new Date(endDate)
        }
      })

      if (existing) {
        return NextResponse.json({ error: 'Monthly summary already exists' }, { status: 409 })
      }

      // Create monthly summary with generatedProof if provided
      const monthlySummary = await prisma.monthlySummary.create({
        data: {
          userId: session.user.id,
          content: serializeEncryptedData(content),
          monthStartDate: new Date(startDate),
          monthEndDate: new Date(endDate),
          generatedProof: generatedProof ? serializeEncryptedData(generatedProof) : null
        }
      })

      // Update weekly summaries to reference this monthly summary
      await prisma.weeklySummary.updateMany({
        where: {
          id: { in: relatedIds },
          userId: session.user.id
        },
        data: {
          monthlySummaryId: monthlySummary.id
        }
      })

      return NextResponse.json({ 
        success: true,
        summaryId: monthlySummary.id,
        type: 'monthly'
      })

    } else if (type === 'yearly') {
      // Check if yearly summary already exists
      const existing = await prisma.yearlySummary.findFirst({
        where: {
          userId: session.user.id,
          yearStartDate: new Date(startDate),
          yearEndDate: new Date(endDate)
        }
      })

      if (existing) {
        return NextResponse.json({ error: 'Yearly summary already exists' }, { status: 409 })
      }

      // Create yearly summary with generatedProof if provided
      const yearlySummary = await prisma.yearlySummary.create({
        data: {
          userId: session.user.id,
          content: serializeEncryptedData(content),
          yearStartDate: new Date(startDate),
          yearEndDate: new Date(endDate),
          generatedProof: generatedProof ? serializeEncryptedData(generatedProof) : null
        }
      })

      // Update monthly summaries to reference this yearly summary
      await prisma.monthlySummary.updateMany({
        where: {
          id: { in: relatedIds },
          userId: session.user.id
        },
        data: {
          yearlySummaryId: yearlySummary.id
        }
      })

      // Note: Monthly summaries are NOT deleted after yearly summary creation (as per requirements)

      return NextResponse.json({ 
        success: true,
        summaryId: yearlySummary.id,
        type: 'yearly'
      })
    }

  } catch (error) {
    console.error('Failed to save hierarchical summary:', error)
    return NextResponse.json(
      { error: 'Failed to save hierarchical summary' },
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
    const type = searchParams.get('type')

    if (!type || !['weekly', 'monthly', 'yearly'].includes(type)) {
      return NextResponse.json({ error: 'Invalid or missing summary type' }, { status: 400 })
    }

    if (type === 'weekly') {
      const weeklySummaries = await prisma.weeklySummary.findMany({
        where: { userId: session.user.id },
        orderBy: { weekStartDate: 'desc' }
      })

      const summariesWithDecryptedData = weeklySummaries.map(summary => ({
        id: summary.id,
        content: summary.content, // Return the serialized encrypted data string for client decryption
        startDate: summary.weekStartDate.toISOString(),
        endDate: summary.weekEndDate.toISOString(),
        createdAt: summary.createdAt.toISOString(),
        generatedProof: summary.generatedProof // Return the serialized encrypted proof for client decryption
      }))

      return NextResponse.json({ summaries: summariesWithDecryptedData })

    } else if (type === 'monthly') {
      const monthlySummaries = await prisma.monthlySummary.findMany({
        where: { userId: session.user.id },
        orderBy: { monthStartDate: 'desc' }
      })

      const summariesWithDecryptedData = monthlySummaries.map(summary => ({
        id: summary.id,
        content: summary.content, // Return the serialized encrypted data string for client decryption
        startDate: summary.monthStartDate.toISOString(),
        endDate: summary.monthEndDate.toISOString(),
        createdAt: summary.createdAt.toISOString(),
        generatedProof: summary.generatedProof // Return the serialized encrypted proof for client decryption
      }))

      return NextResponse.json({ summaries: summariesWithDecryptedData })

    } else if (type === 'yearly') {
      const yearlySummaries = await prisma.yearlySummary.findMany({
        where: { userId: session.user.id },
        orderBy: { yearStartDate: 'desc' }
      })

      const summariesWithDecryptedData = yearlySummaries.map(summary => ({
        id: summary.id,
        content: summary.content, // Return the serialized encrypted data string for client decryption
        startDate: summary.yearStartDate.toISOString(),
        endDate: summary.yearEndDate.toISOString(),
        createdAt: summary.createdAt.toISOString(),
        generatedProof: summary.generatedProof // Return the serialized encrypted proof for client decryption
      }))

      return NextResponse.json({ summaries: summariesWithDecryptedData })
    }

  } catch (error) {
    console.error('Failed to fetch hierarchical summaries:', error)
    return NextResponse.json(
      { error: 'Failed to fetch hierarchical summaries' },
      { status: 500 }
    )
  }
}