'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useSession } from 'next-auth/react';
import TutorialOverlay from './TutorialOverlay';

interface TutorialStep {
  id: string;
  stepNumber: number;
  title: string;
  description: string;
  targetPage?: string;
  targetElement?: string;
  content: string;
  isActive: boolean;
}

interface TutorialProgress {
  currentStep: number;
  completedSteps: number[];
  isCompleted: boolean;
}

interface TutorialContextType {
  isActive: boolean;
  currentStep: TutorialStep | null;
  progress: TutorialProgress | null;
  startTutorial: () => void;
  nextStep: () => void;
  previousStep: () => void;
  completeTutorial: () => void;
  skipTutorial: () => void;
  resetTutorial: () => void;
  showTutorialButton: boolean;
}

const TutorialContext = createContext<TutorialContextType | undefined>(undefined);

export function useTutorial() {
  const context = useContext(TutorialContext);
  if (context === undefined) {
    throw new Error('useTutorial must be used within a TutorialProvider');
  }
  return context;
}

interface TutorialProviderProps {
  children: ReactNode;
}

export function TutorialProvider({ children }: TutorialProviderProps) {
  const { data: session } = useSession();
  const [isActive, setIsActive] = useState(false);
  const [steps, setSteps] = useState<TutorialStep[]>([]);
  const [currentStep, setCurrentStep] = useState<TutorialStep | null>(null);
  const [progress, setProgress] = useState<TutorialProgress | null>(null);
  const [showTutorialButton, setShowTutorialButton] = useState(false);

  // Load tutorial steps and progress on mount
  useEffect(() => {
    if (session?.user) {
      loadTutorialSteps();
      loadTutorialProgress();
    }
  }, [session]);

  const loadTutorialSteps = async () => {
    try {
      const response = await fetch('/api/tutorial/steps');
      if (response.ok) {
        const data = await response.json();
        setSteps(data.steps || []);
      }
    } catch (error) {
      console.error('Failed to load tutorial steps:', error);
    }
  };

  const loadTutorialProgress = async () => {
    try {
      const response = await fetch('/api/tutorial/progress');
      if (response.ok) {
        const data = await response.json();
        if (data.progress) {
          setProgress(data.progress);
          // Always show tutorial button - users can restart anytime
          setShowTutorialButton(true);
        } else {
          // No progress found, user hasn't started tutorial
          setShowTutorialButton(true);
          setProgress({
            currentStep: 0,
            completedSteps: [],
            isCompleted: false
          });
        }
      }
    } catch (error) {
      console.error('Failed to load tutorial progress:', error);
    }
  };

  const updateTutorialProgress = async (newProgress: TutorialProgress) => {
    try {
      const response = await fetch('/api/tutorial/progress', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(newProgress),
      });

      if (response.ok) {
        setProgress(newProgress);
      }
    } catch (error) {
      console.error('Failed to update tutorial progress:', error);
    }
  };

  const startTutorial = () => {
    if (steps.length === 0) return;
    
    const firstStep = steps.find(step => step.stepNumber === 1);
    if (firstStep) {
      setCurrentStep(firstStep);
      setIsActive(true);
      
      const newProgress: TutorialProgress = {
        currentStep: 1,
        completedSteps: [],
        isCompleted: false
      };
      updateTutorialProgress(newProgress);
    }
  };

  const nextStep = () => {
    if (!progress || !currentStep) return;

    const nextStepNumber = progress.currentStep + 1;
    const nextStep = steps.find(step => step.stepNumber === nextStepNumber);
    
    if (nextStep) {
      setCurrentStep(nextStep);
      
      const newProgress: TutorialProgress = {
        currentStep: nextStepNumber,
        completedSteps: [...progress.completedSteps, progress.currentStep],
        isCompleted: false
      };
      updateTutorialProgress(newProgress);
    }
  };

  const previousStep = () => {
    if (!progress || !currentStep || progress.currentStep <= 1) return;

    const prevStepNumber = progress.currentStep - 1;
    const prevStep = steps.find(step => step.stepNumber === prevStepNumber);
    
    if (prevStep) {
      setCurrentStep(prevStep);
      
      const newProgress: TutorialProgress = {
        currentStep: prevStepNumber,
        completedSteps: progress.completedSteps.filter(step => step < prevStepNumber),
        isCompleted: false
      };
      updateTutorialProgress(newProgress);
    }
  };

  const completeTutorial = () => {
    if (!progress) return;

    const newProgress: TutorialProgress = {
      currentStep: steps.length,
      completedSteps: [...progress.completedSteps, progress.currentStep],
      isCompleted: true
    };
    
    updateTutorialProgress(newProgress);
    setIsActive(false);
    setCurrentStep(null);
    // Keep tutorial button visible for restarting
  };

  const skipTutorial = () => {
    const newProgress: TutorialProgress = {
      currentStep: steps.length,
      completedSteps: [],
      isCompleted: true
    };
    
    updateTutorialProgress(newProgress);
    setIsActive(false);
    setCurrentStep(null);
    // Keep tutorial button visible for restarting
  };

  const resetTutorial = () => {
    const newProgress: TutorialProgress = {
      currentStep: 0,
      completedSteps: [],
      isCompleted: false
    };
    
    updateTutorialProgress(newProgress);
    setIsActive(false);
    setCurrentStep(null);
    // Start tutorial from beginning
    startTutorial();
  };

  const contextValue: TutorialContextType = {
    isActive,
    currentStep,
    progress,
    startTutorial,
    nextStep,
    previousStep,
    completeTutorial,
    skipTutorial,
    resetTutorial,
    showTutorialButton
  };

  return (
    <TutorialContext.Provider value={contextValue}>
      {children}
      
      {/* Tutorial Overlay */}
      <TutorialOverlay
        isOpen={isActive}
        onClose={skipTutorial}
        currentStep={currentStep}
        totalSteps={steps.length}
        currentStepNumber={progress?.currentStep || 1}
        onNext={nextStep}
        onPrevious={previousStep}
        onComplete={completeTutorial}
      />
    </TutorialContext.Provider>
  );
}

export default TutorialProvider;