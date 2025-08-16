'use client'

import { useState } from 'react'
import { Button } from '@/components/ui'
import { MessageCircle } from 'lucide-react'
import { AiCompanion } from './ai-companion'

interface CompanionTriggerProps {
  journalContent: string
  userPreferredName?: string
}

export function CompanionTrigger({ 
  journalContent, 
  userPreferredName = 'Claude' 
}: CompanionTriggerProps) {
  const [isCompanionOpen, setIsCompanionOpen] = useState(false)

  // Only show the button if there's journal content
  if (!journalContent || !journalContent.trim()) {
    return null
  }

  return (
    <>
      <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <MessageCircle className="w-5 h-5 text-gray-600" />
            <div>
              <h3 className="font-medium text-black" style={{ fontFamily: 'Hepta Slab, serif' }}>
                Ready to reflect deeper?
              </h3>
              <p className="text-sm text-gray-600 mt-1" style={{ fontFamily: 'Hepta Slab, serif' }}>
                {userPreferredName} can help you explore your thoughts and feelings about today&apos;s entry.
              </p>
            </div>
          </div>
          <Button
            onClick={() => setIsCompanionOpen(true)}
            className="flex items-center gap-2"
          >
            <MessageCircle className="w-4 h-4" />
            Talk About Your Journal with {userPreferredName}
          </Button>
        </div>
      </div>

      <AiCompanion
        journalContent={journalContent}
        userPreferredName={userPreferredName}
        isOpen={isCompanionOpen}
        onClose={() => setIsCompanionOpen(false)}
      />
    </>
  )
}