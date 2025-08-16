import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { serializeEncryptedData, parseEncryptedData, validateEncryptedData } from '@/lib/encryption'

export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const letters = await prisma.letterToFutureSelf.findMany({
      where: {
        userId: session.user.id,
      },
      orderBy: { createdAt: 'desc' },
    })

    // Return encrypted data as-is - client will decrypt
    const lettersWithEncryptedData = letters.map(letter => ({
      ...letter,
      title: letter.title ? parseEncryptedData(letter.title) : null,
      content: parseEncryptedData(letter.content)
    }))

    return NextResponse.json(lettersWithEncryptedData)
  } catch (error) {
    console.error('Failed to fetch letters:', error)
    return NextResponse.json(
      { error: 'Failed to fetch letters' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { title, content, unsealDate } = await request.json()

    // Validate required fields
    if (!content) {
      return NextResponse.json(
        { error: 'Content is required' },
        { status: 400 }
      )
    }

    if (!unsealDate) {
      return NextResponse.json(
        { error: 'Unseal date is required' },
        { status: 400 }
      )
    }

    // Validate that data is properly encrypted
    if (!validateEncryptedData(content)) {
      return NextResponse.json(
        { error: 'Invalid encrypted content format' },
        { status: 400 }
      )
    }

    if (title && !validateEncryptedData(title)) {
      return NextResponse.json(
        { error: 'Invalid encrypted title format' },
        { status: 400 }
      )
    }

    // Validate unseal date
    // Parse the date string as if it's in the user's local timezone
    // The frontend sends dates in YYYY-MM-DD format
    const dateMatch = unsealDate.match(/^(\d{4})-(\d{2})-(\d{2})$/)
    if (!dateMatch) {
      return NextResponse.json(
        { error: 'Invalid unseal date format. Expected YYYY-MM-DD' },
        { status: 400 }
      )
    }

    const [, year, month, day] = dateMatch
    const unsealDateObj = new Date(parseInt(year), parseInt(month) - 1, parseInt(day))
    
    if (isNaN(unsealDateObj.getTime())) {
      return NextResponse.json(
        { error: 'Invalid unseal date' },
        { status: 400 }
      )
    }

    // Get today's date at midnight in local time
    const today = new Date()
    const todayAtMidnight = new Date(today.getFullYear(), today.getMonth(), today.getDate())
    
    if (unsealDateObj <= todayAtMidnight) {
      return NextResponse.json(
        { error: 'Unseal date must be in the future' },
        { status: 400 }
      )
    }

    const letter = await prisma.letterToFutureSelf.create({
      data: {
        userId: session.user.id,
        title: title ? serializeEncryptedData(title) : null,
        content: serializeEncryptedData(content),
        unsealDate: unsealDateObj,
        isSealed: true,
        isUnsealed: false
      },
    })

    return NextResponse.json({ 
      letter: {
        ...letter,
        title,
        content
      }
    })
  } catch (error) {
    console.error('Failed to create letter:', error)
    return NextResponse.json(
      { error: 'Failed to create letter' },
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

    const { id } = await request.json()

    if (!id) {
      return NextResponse.json(
        { error: 'Letter ID is required' },
        { status: 400 }
      )
    }

    // Find the letter to ensure user owns it and it's unsealed
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

    // Only allow deletion if letter is unsealed
    if (!letter.isUnsealed) {
      return NextResponse.json(
        { error: 'Cannot delete sealed letters' },
        { status: 400 }
      )
    }

    await prisma.letterToFutureSelf.delete({
      where: { id },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Failed to delete letter:', error)
    return NextResponse.json(
      { error: 'Failed to delete letter' },
      { status: 500 }
    )
  }
}