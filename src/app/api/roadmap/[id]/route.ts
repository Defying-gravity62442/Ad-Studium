import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { serializeEncryptedData } from '@/lib/encryption'

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const resolvedParams = await params

    // Verify that the roadmap belongs to the user
    const existingRoadmap = await prisma.roadmap.findFirst({
      where: {
        id: resolvedParams.id,
        userId: session.user.id
      },
      include: {
        milestones: true
      }
    })

    if (!existingRoadmap) {
      return NextResponse.json({ error: 'Roadmap not found' }, { status: 404 })
    }

    // Handle title-only update (for inline editing)
    if (body.encryptedTitle && !body.encryptedDescription && !body.encryptedMilestones) {
      const roadmap = await prisma.roadmap.update({
        where: { id: resolvedParams.id },
        data: {
          title: serializeEncryptedData(body.encryptedTitle),
          updatedAt: new Date()
        }
      })

      return NextResponse.json({ success: true, roadmap })
    }

    // Handle full roadmap update
    if (body.encryptedTitle && body.encryptedMilestones) {
      // Update the roadmap in a transaction
      const updatedRoadmap = await prisma.$transaction(async (prisma) => {
        // Update roadmap basic info
        const roadmap = await prisma.roadmap.update({
          where: { id: resolvedParams.id },
          data: {
            title: serializeEncryptedData(body.encryptedTitle),
            updatedAt: new Date()
          }
        })

        // Delete existing milestones
        await prisma.milestone.deleteMany({
          where: { roadmapId: resolvedParams.id }
        })

        // Create new milestones
        if (body.encryptedMilestones && body.encryptedMilestones.length > 0) {
          await prisma.milestone.createMany({
            data: body.encryptedMilestones.map((milestone: any, index: number) => ({
              id: milestone.id, // Will be undefined for new milestones, allowing DB to generate ID
              roadmapId: resolvedParams.id,
              title: serializeEncryptedData(milestone.encryptedTitle),
              description: milestone.encryptedDescription ? serializeEncryptedData(milestone.encryptedDescription) : null,
              dueDate: milestone.dueDate,
              status: milestone.status || 'PENDING',
              order: milestone.order !== undefined ? milestone.order : index,
              createdAt: new Date(),
              updatedAt: new Date()
            }))
          })
        }

        return roadmap
      })

      return NextResponse.json({ success: true, roadmap: updatedRoadmap })
    }

    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  } catch (error) {
    console.error('Error updating roadmap:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const resolvedParams = await params

    // Verify that the roadmap belongs to the user
    const existingRoadmap = await prisma.roadmap.findFirst({
      where: {
        id: resolvedParams.id,
        userId: session.user.id
      }
    })

    if (!existingRoadmap) {
      return NextResponse.json({ error: 'Roadmap not found' }, { status: 404 })
    }

    // Delete the roadmap (milestones will be deleted due to cascade)
    await prisma.roadmap.delete({
      where: { id: resolvedParams.id }
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting roadmap:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}