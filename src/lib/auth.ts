import { NextAuthOptions } from "next-auth"
import GoogleProvider from "next-auth/providers/google"
import { PrismaAdapter } from "@next-auth/prisma-adapter"
import { prisma } from "@/lib/db"

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma),
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      authorization: {
        params: {
          scope: "openid email profile https://www.googleapis.com/auth/calendar.readonly https://www.googleapis.com/auth/calendar.events"
        }
      }
    }),
  ],
  pages: {
    signIn: "/",
    error: "/auth/error",
  },
  events: {
    async signIn({ user, account, profile, isNewUser }) {
      console.log('NextAuth: User signed in:', {
        userId: user?.id,
        userEmail: user?.email,
        provider: account?.provider,
        isNewUser
      })
    },
    async signOut({ session, token }) {
      console.log('NextAuth: User signed out:', {
        sessionUserId: session?.user?.id,
        tokenSub: token?.sub
      })
    }
  },
  callbacks: {
    async jwt({ token, account, user }) {
      console.log('NextAuth JWT callback:', { 
        hasToken: !!token, 
        hasAccount: !!account, 
        hasUser: !!user,
        tokenSub: token?.sub,
        userEmail: user?.email,
        userId: user?.id
      })
      
      if (account) {
        token.accessToken = account.access_token
        token.refreshToken = account.refresh_token
      }
      if (user) {
        token.uid = user.id
        console.log('NextAuth JWT: Set token.uid to:', user.id)
      }

      // If we have a user ID but no account data, try to fetch the latest access token from the database
      if (token.uid && !account) {
        try {
          const dbAccount = await prisma.account.findFirst({
            where: {
              userId: token.uid,
              provider: 'google'
            },
            select: {
              access_token: true,
              refresh_token: true,
              expires_at: true,
              scope: true
            }
          })

          if (dbAccount?.access_token) {
            // Update the token with the latest access token from the database
            token.accessToken = dbAccount.access_token
            token.refreshToken = dbAccount.refresh_token || token.refreshToken
            
            // Check if the token has calendar scopes
            const hasCalendarScopes = dbAccount.scope?.includes('calendar.readonly') || 
                                     dbAccount.scope?.includes('calendar.events')
            
            if (hasCalendarScopes) {
              console.log('NextAuth JWT: Updated token with calendar scopes')
            }
          }
        } catch (error) {
          console.error('NextAuth JWT: Error fetching account from database:', error)
        }
      }

      return token
    },
    async session({ session, token, user }) {
      console.log('NextAuth Session callback:', { 
        hasSession: !!session, 
        hasToken: !!token, 
        hasUser: !!user,
        sessionUser: session?.user?.email,
        tokenSub: token?.sub,
        tokenUid: token?.uid
      })
      
      if (session?.user && token?.uid) {
        session.user.id = token.uid as string
      } else if (session?.user && token?.sub) {
        session.user.id = token.sub as string
      }
      if (token?.accessToken) {
        session.accessToken = token.accessToken as string
      }
      if (token?.refreshToken) {
        session.refreshToken = token.refreshToken as string
      }
      return session
    },
  },
  session: {
    strategy: "jwt",
  },
  debug: process.env.NODE_ENV === 'development',
}