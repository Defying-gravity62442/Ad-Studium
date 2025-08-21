import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { google } from 'googleapis'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const code = searchParams.get('code')
    const state = searchParams.get('state')
    const error = searchParams.get('error')

    if (error) {
      console.error('Google Calendar OAuth error:', error)
      return NextResponse.redirect(new URL('/settings?error=calendar_permission_denied', request.url))
    }

    if (!code) {
      return NextResponse.redirect(new URL('/settings?error=no_authorization_code', request.url))
    }

    // Get the current session to identify the user
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.redirect(new URL('/settings?error=no_session', request.url))
    }

    // Parse the state parameter to get the requested scope
    let requestedScope = 'events' // default fallback
    if (state) {
      try {
        const stateData = JSON.parse(decodeURIComponent(state))
        requestedScope = stateData.scope || 'events'
      } catch (error) {
        console.error('Failed to parse state parameter:', error)
      }
    }

    // Exchange the authorization code for an access token
    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      process.env.NEXTAUTH_URL + '/api/auth/calendar-permissions'
    )

    const { tokens } = await oauth2Client.getToken(code)
    
    if (!tokens.access_token) {
      console.error('No access token received from Google')
      return NextResponse.redirect(new URL('/settings?error=no_access_token', request.url))
    }

    // Update the user's account with the new access token and scopes
    await prisma.account.updateMany({
      where: {
        userId: session.user.id,
        provider: 'google'
      },
      data: {
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token || undefined,
        expires_at: tokens.expiry_date ? Math.floor(tokens.expiry_date / 1000) : undefined,
        scope: tokens.scope || undefined
      }
    })

    // Get current permissions to preserve existing state
    const currentUser = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: {
        calendarReadPermission: true,
        calendarEventsPermission: true
      }
    })

    // Update the user's calendar permissions based on the requested scope, preserving existing permissions
    const updateData: any = {}
    
    if (requestedScope === 'readonly') {
      updateData.calendarReadPermission = true
      updateData.calendarEventsPermission = currentUser?.calendarEventsPermission ?? false
    } else if (requestedScope === 'events') {
      updateData.calendarEventsPermission = true
      updateData.calendarReadPermission = currentUser?.calendarReadPermission ?? false
    }

    await prisma.user.update({
      where: { id: session.user.id },
      data: updateData
    })

    console.log('Successfully updated calendar permissions for user:', session.user.id, 'with scope:', requestedScope)

    // Redirect back to settings with success message
    return NextResponse.redirect(new URL('/settings?success=calendar_permissions_granted', request.url))

  } catch (error) {
    console.error('Error handling Google Calendar OAuth callback:', error)
    return NextResponse.redirect(new URL('/settings?error=oauth_callback_failed', request.url))
  }
}
