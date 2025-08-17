"use client"

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function TestCalendarPage() {
  const router = useRouter()

  useEffect(() => {
    // Simulate the OAuth callback redirect
    router.push('/settings?success=calendar_permissions_granted')
  }, [router])

  return (
    <div className="min-h-screen bg-white flex items-center justify-center">
      <div className="text-center">
        <h1 className="text-2xl font-bold text-gray-900 mb-4">Testing Calendar Integration</h1>
        <p className="text-gray-600">Redirecting to settings with success message...</p>
      </div>
    </div>
  )
}
