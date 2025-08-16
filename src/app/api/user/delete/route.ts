import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'

export async function DELETE() {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const userId = session.user.id

    // Delete all user data in transaction
    await prisma.$transaction(async (tx) => {
      // Delete reading data first (foreign key constraints)
      await tx.readingReflection.deleteMany({
        where: {
          reading: {
            userId
          }
        }
      })

      await tx.readingLog.deleteMany({
        where: {
          reading: {
            userId
          }
        }
      })

      await tx.reading.deleteMany({
        where: { userId }
      })

      // Delete AI conversations
      await tx.aiConversation.deleteMany({
        where: {
          journal: {
            userId
          }
        }
      })

      // Delete journal entries
      await tx.journal.deleteMany({
        where: { userId }
      })

      // Delete roadmap milestones
      await tx.milestone.deleteMany({
        where: {
          roadmap: {
            userId
          }
        }
      })

      // Delete roadmaps
      await tx.roadmap.deleteMany({
        where: { userId }
      })

      // Delete letters to future self
      await tx.letterToFutureSelf.deleteMany({
        where: { userId }
      })

      // Delete summaries
      await tx.dailySummary.deleteMany({
        where: {
          journal: {
            userId
          }
        }
      })

      await tx.weeklySummary.deleteMany({
        where: { userId }
      })

      await tx.monthlySummary.deleteMany({
        where: { userId }
      })

      await tx.yearlySummary.deleteMany({
        where: { userId }
      })

      // Delete goals
      await tx.goal.deleteMany({
        where: { userId }
      })

      // Delete accounts (OAuth connections)
      await tx.account.deleteMany({
        where: { userId }
      })

      // Delete sessions
      await tx.session.deleteMany({
        where: { userId }
      })

      // Finally, delete the user
      await tx.user.delete({
        where: { id: userId }
      })
    })

    return NextResponse.json({ 
      success: true, 
      message: 'Account and all associated data deleted successfully' 
    })
  } catch (error) {
    console.error('Error deleting user account:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}