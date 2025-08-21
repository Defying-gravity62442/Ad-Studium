import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { prisma } from '@/lib/db'
import { authOptions } from '@/lib/auth'

export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: {
        calendarReadPermission: true,
        calendarEventsPermission: true
      }
    })

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    return NextResponse.json({
      calendarReadPermission: user.calendarReadPermission,
      calendarEventsPermission: user.calendarEventsPermission
    })
  } catch (error) {
    console.error('Failed to get calendar permissions:', error)
    return NextResponse.json(
      { error: 'Failed to get calendar permissions' },
      { status: 500 }
    )
  }
}

export async function PUT(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { permission, enabled } = await request.json()
    
    if (!permission || !['read', 'events'].includes(permission)) {
      return NextResponse.json({ error: 'Invalid permission parameter' }, { status: 400 })
    }

    if (typeof enabled !== 'boolean') {
      return NextResponse.json({ error: 'Invalid enabled parameter' }, { status: 400 })
    }

    // Update the specific permission
    const updateData: any = {}
    if (permission === 'read') {
      updateData.calendarReadPermission = enabled
    } else if (permission === 'events') {
      updateData.calendarEventsPermission = enabled
    }

    await prisma.user.update({
      where: { id: session.user.id },
      data: updateData
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Failed to update calendar permission:', error)
    return NextResponse.json(
      { error: 'Failed to update calendar permission' },
      { status: 500 }
    )
  }
}
