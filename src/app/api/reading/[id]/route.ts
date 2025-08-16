import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { serializeEncryptedData, validateEncryptedData } from '@/lib/encryption'

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { encryptedTitle } = await request.json()

    if (!validateEncryptedData(encryptedTitle)) {
      return NextResponse.json(
        { error: 'Invalid encrypted title format' },
        { status: 400 }
      )
    }

    const reading = await prisma.reading.findFirst({
      where: {
        id: id,
        userId: session.user.id
      }
    })

    if (!reading) {
      return NextResponse.json({ error: 'Reading not found' }, { status: 404 })
    }

    const updatedReading = await prisma.reading.update({
      where: { id: id },
      data: {
        title: serializeEncryptedData(encryptedTitle)
      }
    })

    return NextResponse.json({ 
      reading: {
        ...updatedReading,
        title: encryptedTitle
      }
    })
  } catch (error) {
    console.error('Failed to update reading:', error)
    return NextResponse.json(
      { error: 'Failed to update reading' },
      { status: 500 }
    )
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const reading = await prisma.reading.findFirst({
      where: {
        id: id,
        userId: session.user.id
      }
    })

    if (!reading) {
      return NextResponse.json({ error: 'Reading not found' }, { status: 404 })
    }

    await prisma.$transaction(async (tx) => {
      await tx.documentEmbedding.deleteMany({
        where: { docToken: reading.docToken }
      })
      
      await tx.reading.delete({
        where: { id: id }
      })
    })

    return NextResponse.json({ 
      message: 'Reading deleted successfully' 
    })
  } catch (error) {
    console.error('Failed to delete reading:', error)
    return NextResponse.json(
      { error: 'Failed to delete reading' },
      { status: 500 }
    )
  }
}