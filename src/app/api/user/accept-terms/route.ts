import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Update user's updatedAt to indicate they've accepted terms
    // (We're using the fact that createdAt != updatedAt as a simple flag)
    await prisma.user.update({
      where: { id: session.user.id },
      data: { updatedAt: new Date() }
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error accepting terms:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}