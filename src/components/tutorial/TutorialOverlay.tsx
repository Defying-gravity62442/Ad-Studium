'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { X, ChevronLeft, ChevronRight, HelpCircle } from 'lucide-react';

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

interface TutorialOverlayProps {
  isOpen: boolean;
  onClose: () => void;
  currentStep: TutorialStep | null;
  totalSteps: number;
  currentStepNumber: number;
  onNext: () => void;
  onPrevious: () => void;
  onComplete: () => void;
}

export function TutorialOverlay({
  isOpen,
  onClose,
  currentStep,
  totalSteps,
  currentStepNumber,
  onNext,
  onPrevious,
  onComplete
}: TutorialOverlayProps) {
  const [highlightedElement, setHighlightedElement] = useState<Element | null>(null);
  const [elementPosition, setElementPosition] = useState<{
    top: number;
    left: number;
    width: number;
    height: number;
  } | null>(null);

  const updateElementPosition = useCallback(() => {
    if (!highlightedElement) {
      setElementPosition(null);
      return;
    }

    const rect = highlightedElement.getBoundingClientRect();
    setElementPosition({
      top: rect.top,
      left: rect.left,
      width: rect.width,
      height: rect.height
    });
  }, [highlightedElement]);

  useEffect(() => {
    if (!isOpen || !currentStep?.targetElement) {
      setHighlightedElement(null);
      setElementPosition(null);
      return;
    }

    // Find target element
    const element = document.querySelector(currentStep.targetElement);
    if (element) {
      setHighlightedElement(element);
      
      // Initial position calculation
      updateElementPosition();
      
      // Scroll element into view gently
      element.scrollIntoView({ 
        behavior: 'smooth', 
        block: 'center',
        inline: 'center' 
      });
    } else {
      setHighlightedElement(null);
      setElementPosition(null);
    }
  }, [isOpen, currentStep, updateElementPosition]);

  // Update position on scroll and resize
  useEffect(() => {
    if (!highlightedElement) return;

    const handleScroll = () => {
      updateElementPosition();
    };

    const handleResize = () => {
      updateElementPosition();
    };

    // Use passive listeners for better performance
    window.addEventListener('scroll', handleScroll, { passive: true });
    window.addEventListener('resize', handleResize, { passive: true });

    return () => {
      window.removeEventListener('scroll', handleScroll);
      window.removeEventListener('resize', handleResize);
    };
  }, [highlightedElement, updateElementPosition]);

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }

    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen]);

  if (!isOpen || !currentStep) return null;

  const isFirstStep = currentStepNumber === 1;
  const isLastStep = currentStepNumber === totalSteps;

  return (
    <>
      {/* Overlay backdrop - clear for tutorial */}
      <div className="fixed inset-0 bg-black/30 z-40" />
      
      {/* Highlight effect for target element */}
      {highlightedElement && elementPosition && (
        <>
          {/* Spotlight effect - cut out the highlighted area */}
          <div
            className="fixed inset-0 z-45"
            style={{
              background: `radial-gradient(ellipse ${elementPosition.width + 40}px ${elementPosition.height + 40}px at ${elementPosition.left + elementPosition.width / 2}px ${elementPosition.top + elementPosition.height / 2}px, transparent 0%, transparent 50%, rgba(0,0,0,0.5) 100%)`,
            }}
          />
          
          {/* Highlight border */}
          <div
            className="fixed z-50 pointer-events-none border-2 border-black rounded-lg shadow-2xl animate-pulse"
            style={{
              top: elementPosition.top - 4,
              left: elementPosition.left - 4,
              width: elementPosition.width + 8,
              height: elementPosition.height + 8,
            }}
          />
          
          {/* Label for the highlighted element */}
          <div
            className="fixed z-50 pointer-events-none bg-black text-white px-3 py-1 rounded-lg text-sm font-medium shadow-lg font-['EB_Garamond']"
            style={{
              top: elementPosition.top - 40,
              left: elementPosition.left,
            }}
          >
            {currentStep.title}
          </div>
        </>
      )}

      {/* Tutorial modal */}
      <div className="fixed inset-0 flex items-center justify-center p-4 z-50">
        <div className="bg-white border border-gray-200 rounded-lg shadow-2xl w-full max-w-md max-h-[80vh] overflow-hidden font-['EB_Garamond']">
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b border-gray-200">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center">
                <HelpCircle className="h-4 w-4 text-gray-600" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-gray-900 font-['EB_Garamond']">
                  {currentStep.title}
                </h2>
                <p className="text-sm text-gray-500 font-['EB_Garamond']">
                  Step {currentStepNumber} of {totalSteps}
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 transition-colors p-1 rounded-full hover:bg-gray-100"
              aria-label="Exit tutorial"
              title="Exit tutorial (you can restart it anytime)"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Progress bar */}
          <div className="w-full bg-gray-100 h-2">
            <div 
              className="bg-black h-2 transition-all duration-300"
              style={{ width: `${(currentStepNumber / totalSteps) * 100}%` }}
            />
          </div>

          {/* Content */}
          <div className="p-6 overflow-y-auto max-h-[calc(80vh-12rem)]">
            <div className="space-y-4">
              <p className="text-gray-700 leading-relaxed font-['EB_Garamond']">
                {currentStep.description}
              </p>
              
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                <div 
                  className="text-gray-800 leading-relaxed prose prose-sm max-w-none font-['EB_Garamond']"
                  dangerouslySetInnerHTML={{ __html: currentStep.content }}
                />
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between p-6 border-t border-gray-200 bg-gray-50">
            <div className="flex items-center gap-2">
              {Array.from({ length: totalSteps }, (_, i) => (
                <div
                  key={i}
                  className={`w-2 h-2 rounded-full transition-colors ${
                    i + 1 === currentStepNumber
                      ? 'bg-black'
                      : i + 1 < currentStepNumber
                      ? 'bg-gray-600'
                      : 'bg-gray-300'
                  }`}
                />
              ))}
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={onPrevious}
                disabled={isFirstStep}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors font-['EB_Garamond'] ${
                  isFirstStep
                    ? 'text-gray-400 cursor-not-allowed'
                    : 'text-gray-700 hover:text-gray-900 hover:bg-gray-200'
                }`}
              >
                <ChevronLeft className="h-4 w-4" />
                Previous
              </button>

              {isLastStep ? (
                <button
                  onClick={onComplete}
                  className="flex items-center gap-2 px-6 py-2 bg-black text-white rounded-lg text-sm font-medium hover:bg-gray-800 transition-colors font-['EB_Garamond']"
                >
                  Complete Tutorial
                </button>
              ) : (
                <button
                  onClick={onNext}
                  className="flex items-center gap-2 px-6 py-2 bg-black text-white rounded-lg text-sm font-medium hover:bg-gray-800 transition-colors font-['EB_Garamond']"
                >
                  Next
                  <ChevronRight className="h-4 w-4" />
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

export default TutorialOverlay;