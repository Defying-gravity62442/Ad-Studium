'use client';

import React from 'react';
import { HelpCircle } from 'lucide-react';
import { useTutorial } from './TutorialProvider';

interface TutorialButtonProps {
  className?: string;
  variant?: 'floating' | 'inline';
}

export function TutorialButton({ className = '', variant = 'floating' }: TutorialButtonProps) {
  const { startTutorial, showTutorialButton, progress } = useTutorial();

  if (!showTutorialButton) return null;

  const isCompleted = progress?.isCompleted;
  const buttonText = isCompleted ? 'Retake Tour' : 'Take a Tour';
  const buttonTitle = isCompleted ? 'Restart the interactive tutorial' : 'Start interactive tutorial';

  const baseClasses = variant === 'floating'
    ? 'fixed bottom-6 right-6 z-30 bg-black text-white hover:bg-gray-800 shadow-2xl font-["EB_Garamond"]'
    : 'bg-gray-100 text-gray-700 hover:bg-gray-200 border border-gray-300 font-["EB_Garamond"]';

  return (
    <button
      onClick={startTutorial}
      className={`
        flex items-center gap-2 px-4 py-3 rounded-lg font-medium transition-all duration-200 
        hover:scale-105 active:scale-95 ${baseClasses} ${className}
      `}
      title={buttonTitle}
    >
      <HelpCircle className="h-5 w-5" />
      {variant === 'inline' && <span>{buttonText}</span>}
    </button>
  );
}

export default TutorialButton;