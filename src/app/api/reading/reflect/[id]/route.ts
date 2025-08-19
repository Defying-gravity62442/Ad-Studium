import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { encryptedReflectionData } = await request.json()

    if (!encryptedReflectionData) {
      return NextResponse.json({ error: 'Encrypted reflection data is required' }, { status: 400 })
    }

    // Verify the reflection belongs to the current user
    const reflection = await prisma.readingReflection.findFirst({
      where: {
        id: id,
        reading: {
          userId: session.user.id
        }
      }
    })

    if (!reflection) {
      return NextResponse.json({ error: 'Reflection not found' }, { status: 404 })
    }

    // Update the reflection with encrypted data
    const updatedReflection = await prisma.readingReflection.update({
      where: { id: id },
      data: {
        response: JSON.stringify(encryptedReflectionData) // Store encrypted structured data
      }
    })

    return NextResponse.json({ 
      success: true,
      reflection: {
        id: updatedReflection.id
      }
    })

  } catch (error) {
    console.error('Failed to update reflection:', error)
    return NextResponse.json(
      { error: 'Failed to update reflection' },
      { status: 500 }
    )
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Verify the reflection belongs to the current user
    const reflection = await prisma.readingReflection.findFirst({
      where: {
        id: id,
        reading: {
          userId: session.user.id
        }
      }
    })

    if (!reflection) {
      return NextResponse.json({ error: 'Reflection not found' }, { status: 404 })
    }

    // Delete the reflection
    await prisma.readingReflection.delete({
      where: { id: id }
    })

    return NextResponse.json({ 
      success: true,
      message: 'Reflection deleted successfully'
    })

  } catch (error) {
    console.error('Failed to delete reflection:', error)
    return NextResponse.json(
      { error: 'Failed to delete reflection' },
      { status: 500 }
    )
  }
}