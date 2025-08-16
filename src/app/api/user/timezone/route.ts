import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'

export async function PUT(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { timezone } = await request.json()

    if (!timezone) {
      return NextResponse.json({ error: 'Timezone is required' }, { status: 400 })
    }

    // Validate timezone format (basic check)
    try {
      new Date().toLocaleString("en-US", { timeZone: timezone })
    } catch (error) {
      return NextResponse.json({ error: 'Invalid timezone format' }, { status: 400 })
    }

    // Update user's timezone
    await prisma.user.update({
      where: { id: session.user.id },
      data: { timezone }
    })

    return NextResponse.json({ success: true, timezone })
  } catch (error) {
    console.error('Error updating timezone:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { timezone: true }
    })

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    return NextResponse.json({ timezone: user.timezone || 'UTC' })
  } catch (error) {
    console.error('Error fetching timezone:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
} 