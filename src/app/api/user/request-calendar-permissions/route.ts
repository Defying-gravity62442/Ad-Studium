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

    // Update user's calendar integration preference
    await prisma.user.update({
      where: { id: session.user.id },
      data: { calendarIntegrationEnabled: true }
    })

    // Return the authorization URL for Google Calendar permissions
    const googleAuthUrl = `https://accounts.google.com/o/oauth2/v2/auth?` +
      `client_id=${process.env.GOOGLE_CLIENT_ID}&` +
      `redirect_uri=${encodeURIComponent(process.env.NEXTAUTH_URL + '/api/auth/calendar-permissions')}&` +
      `response_type=code&` +
      `scope=${encodeURIComponent('https://www.googleapis.com/auth/calendar.readonly https://www.googleapis.com/auth/calendar.events')}&` +
      `access_type=offline&` +
      `prompt=consent`

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

    // Update user's calendar integration preference to disabled
    await prisma.user.update({
      where: { id: session.user.id },
      data: { calendarIntegrationEnabled: false }
    })

    return NextResponse.json({ 
      success: true,
      message: 'Calendar integration disabled successfully'
    })
  } catch (error) {
    console.error('Failed to disable calendar integration:', error)
    return NextResponse.json(
      { error: 'Failed to disable calendar integration' },
      { status: 500 }
    )
  }
} 