import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { prisma } from '@/lib/db'
import { authOptions } from '@/lib/auth'

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { scope } = await request.json()
    
    if (!scope || !['readonly', 'events'].includes(scope)) {
      return NextResponse.json({ error: 'Invalid scope parameter' }, { status: 400 })
    }

    // Determine the scopes to request based on the parameter
    let scopesToRequest = ''
    if (scope === 'readonly') {
      scopesToRequest = 'https://www.googleapis.com/auth/calendar.readonly'
    } else if (scope === 'events') {
      scopesToRequest = 'https://www.googleapis.com/auth/calendar.events'
    }

    // Get current permissions to preserve existing state
    const currentUser = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: {
        calendarReadPermission: true,
        calendarEventsPermission: true
      }
    })

    // Update user's calendar permissions, preserving existing permissions
    const updateData: any = {}
    
    if (scope === 'readonly') {
      updateData.calendarReadPermission = true
      updateData.calendarEventsPermission = currentUser?.calendarEventsPermission ?? false
    } else if (scope === 'events') {
      updateData.calendarEventsPermission = true
      updateData.calendarReadPermission = currentUser?.calendarReadPermission ?? false
    }

    await prisma.user.update({
      where: { id: session.user.id },
      data: updateData
    })

    // Return the authorization URL for Google Calendar permissions
    const googleAuthUrl = `https://accounts.google.com/o/oauth2/v2/auth?` +
      `client_id=${process.env.GOOGLE_CLIENT_ID}&` +
      `redirect_uri=${encodeURIComponent(process.env.NEXTAUTH_URL + '/api/auth/calendar-permissions')}&` +
      `response_type=code&` +
      `scope=${encodeURIComponent(scopesToRequest)}&` +
      `access_type=offline&` +
      `prompt=consent&` +
      `state=${encodeURIComponent(JSON.stringify({ scope }))}`

    return NextResponse.json({ 
      success: true, 
      authUrl: googleAuthUrl 
    })
  } catch (error) {
    console.error('Failed to request calendar permissions:', error)
    return NextResponse.json(
      { error: 'Failed to request calendar permissions' },
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

    // Disable calendar permissions
    await prisma.user.update({
      where: { id: session.user.id },
      data: { 
        calendarReadPermission: false,
        calendarEventsPermission: false
      }
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Failed to disable calendar integration:', error)
    return NextResponse.json(
      { error: 'Failed to disable calendar integration' },
      { status: 500 }
    )
  }
} 