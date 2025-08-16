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

    const { encryptedKey } = await req.json()
    if (!encryptedKey) {
      return NextResponse.json({ error: 'Encrypted key is required' }, { status: 400 })
    }

    // Store the encrypted key in the database
    await prisma.user.update({
      where: { id: session.user.id },
      data: { encryptionKey: encryptedKey }
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error storing encrypted key:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}