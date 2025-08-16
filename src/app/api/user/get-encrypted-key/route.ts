import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { encryptionKey: true }
    })

    if (!user?.encryptionKey) {
      return NextResponse.json({ error: 'No encryption key found' }, { status: 404 })
    }

    return NextResponse.json({ encryptedKey: user.encryptionKey })
  } catch (error) {
    console.error('Error retrieving encrypted key:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}