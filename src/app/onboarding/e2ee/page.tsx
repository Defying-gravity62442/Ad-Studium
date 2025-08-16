"use client"

import { useRouter } from 'next/navigation'
import E2EESetup from '@/components/E2EESetup'

export default function E2EEOnboardingPage() {
  const router = useRouter()

  const handleComplete = () => {
    router.push('/onboarding/customization')
  }

  return (
    <div className="min-h-screen bg-white flex flex-col">
      {/* Progress indicator */}
      <div className="w-full bg-gray-100 h-2">
        <div className="bg-black h-2 transition-all duration-300" style={{ width: '50%' }} />
      </div>

      <div className="flex-1">
        <E2EESetup onComplete={handleComplete} />
      </div>
    </div>
  )
}