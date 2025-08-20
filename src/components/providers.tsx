"use client"

import { SessionProvider } from "next-auth/react"
import { TutorialProvider } from "@/components/tutorial"

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <TutorialProvider>
        {children}
      </TutorialProvider>
    </SessionProvider>
  )
}