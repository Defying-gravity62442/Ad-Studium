import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await request.json()

    if (!id) {
      return NextResponse.json(
        { error: 'Letter ID is required' },
        { status: 400 }
      )
    }

    // Find the letter to ensure user owns it
    const letter = await prisma.letterToFutureSelf.findUnique({
      where: { id },
    })

    if (!letter) {
      return NextResponse.json(
        { error: 'Letter not found' },
        { status: 404 }
      )
    }

    if (letter.userId !== session.user.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 403 }
      )
    }

    // Check if the unseal date has been reached
    const now = new Date()
    if (letter.unsealDate > now) {
      return NextResponse.json(
        { error: 'Letter cannot be unsealed yet' },
        { status: 400 }
      )
    }

    // Check if letter is already unsealed
    if (letter.isUnsealed) {
      return NextResponse.json(
        { error: 'Letter is already unsealed' },
        { status: 400 }
      )
    }

    // Unseal the letter
    const unsealedLetter = await prisma.letterToFutureSelf.update({
      where: { id },
      data: {
        isUnsealed: true,
        updatedAt: new Date()
      },
    })

    return NextResponse.json({ 
      success: true,
      letter: unsealedLetter
    })
  } catch (error) {
    console.error('Failed to unseal letter:', error)
    return NextResponse.json(
      { error: 'Failed to unseal letter' },
      { status: 500 }
    )
  }
}