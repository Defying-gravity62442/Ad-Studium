import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { serializeEncryptedData } from '@/lib/encryption'

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; milestoneId: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const resolvedParams = await params

    // Verify the roadmap belongs to the user
    const roadmap = await prisma.roadmap.findFirst({
      where: {
        id: resolvedParams.id,
        userId: session.user.id
      }
    })

    if (!roadmap) {
      return NextResponse.json(
        { error: 'Roadmap not found' },
        { status: 404 }
      )
    }

    // Handle completion status update
    if ('completed' in body) {
      if (typeof body.completed !== 'boolean') {
        return NextResponse.json(
          { error: 'Completed status must be a boolean' },
          { status: 400 }
        )
      }

      const milestone = await prisma.milestone.update({
        where: {
          id: resolvedParams.milestoneId,
          roadmapId: resolvedParams.id
        },
        data: {
          status: body.completed ? 'COMPLETED' : 'PENDING'
        }
      })

      return NextResponse.json({ milestone })
    }

    // Handle full milestone update
    if ('encryptedTitle' in body || 'encryptedDescription' in body || 'dueDate' in body) {
      const updateData: any = {}
      
      if (body.encryptedTitle) {
        updateData.title = serializeEncryptedData(body.encryptedTitle)
      }
      
      if (body.encryptedDescription !== undefined) {
        updateData.description = body.encryptedDescription ? serializeEncryptedData(body.encryptedDescription) : null
      }
      
      if (body.dueDate !== undefined) {
        updateData.dueDate = body.dueDate
      }

      const milestone = await prisma.milestone.update({
        where: {
          id: resolvedParams.milestoneId,
          roadmapId: resolvedParams.id
        },
        data: updateData
      })

      return NextResponse.json({ milestone })
    }

    return NextResponse.json(
      { error: 'Invalid request body' },
      { status: 400 }
    )
  } catch (error) {
    console.error('Failed to update milestone:', error)
    return NextResponse.json(
      { error: 'Failed to update milestone' },
      { status: 500 }
    )
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; milestoneId: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const resolvedParams = await params

    // Verify the roadmap belongs to the user
    const roadmap = await prisma.roadmap.findFirst({
      where: {
        id: resolvedParams.id,
        userId: session.user.id
      }
    })

    if (!roadmap) {
      return NextResponse.json(
        { error: 'Roadmap not found' },
        { status: 404 }
      )
    }

    // Delete the milestone
    await prisma.milestone.delete({
      where: {
        id: resolvedParams.milestoneId,
        roadmapId: resolvedParams.id
      }
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Failed to delete milestone:', error)
    return NextResponse.json(
      { error: 'Failed to delete milestone' },
      { status: 500 }
    )
  }
}