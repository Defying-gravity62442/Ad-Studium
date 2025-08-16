import NextAuth from 'next-auth'

declare module 'next-auth' {
  interface User {
    id: string
  }

  interface Session {
    accessToken?: string
    refreshToken?: string
    user: {
      id: string
      name?: string | null
      email?: string | null
      image?: string | null
    }
  }

  interface JWT {
    accessToken?: string
    refreshToken?: string
  }
}