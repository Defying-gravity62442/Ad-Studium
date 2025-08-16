import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'

export async function DELETE(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { type, summaryId } = await request.json()

    if (!type || !['weekly', 'monthly', 'yearly'].includes(type)) {
      return NextResponse.json({ error: 'Invalid summary type' }, { status: 400 })
    }

    if (!summaryId) {
      return NextResponse.json({ error: 'Summary ID is required' }, { status: 400 })
    }

    if (type === 'weekly') {
      // Delete weekly summary
      const deletedSummary = await prisma.weeklySummary.deleteMany({
        where: {
          id: summaryId,
          userId: session.user.id
        }
      })

      if (deletedSummary.count === 0) {
        return NextResponse.json({ error: 'Weekly summary not found' }, { status: 404 })
      }

      // Remove references from daily summaries
      await prisma.dailySummary.updateMany({
        where: {
          weeklySummaryId: summaryId,
          journal: {
            userId: session.user.id
          }
        },
        data: {
          weeklySummaryId: null
        }
      })

      return NextResponse.json({ 
        success: true,
        message: 'Weekly summary deleted successfully'
      })

    } else if (type === 'monthly') {
      // Delete monthly summary
      const deletedSummary = await prisma.monthlySummary.deleteMany({
        where: {
          id: summaryId,
          userId: session.user.id
        }
      })

      if (deletedSummary.count === 0) {
        return NextResponse.json({ error: 'Monthly summary not found' }, { status: 404 })
      }

      return NextResponse.json({ 
        success: true,
        message: 'Monthly summary deleted successfully'
      })

    } else if (type === 'yearly') {
      // Delete yearly summary
      const deletedSummary = await prisma.yearlySummary.deleteMany({
        where: {
          id: summaryId,
          userId: session.user.id
        }
      })

      if (deletedSummary.count === 0) {
        return NextResponse.json({ error: 'Yearly summary not found' }, { status: 404 })
      }

      return NextResponse.json({ 
        success: true,
        message: 'Yearly summary deleted successfully'
      })
    }

  } catch (error) {
    console.error('Failed to delete hierarchical summary:', error)
    return NextResponse.json(
      { error: 'Failed to delete hierarchical summary' },
      { status: 500 }
    )
  }
}
