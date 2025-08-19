'use client';

import React, { useEffect, useState } from 'react';
import { X } from 'lucide-react';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  children: React.ReactNode;
  title?: string;
  showCloseButton?: boolean;
  maxWidth?: 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '3xl' | '4xl' | 'full';
  className?: string;
}

export function Modal({
  isOpen,
  onClose,
  children,
  title,
  showCloseButton = true,
  maxWidth = 'lg',
  className = ''
}: ModalProps) {
  const [isAnimating, setIsAnimating] = useState(false);
  const [shouldRender, setShouldRender] = useState(false);

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    if (isOpen) {
      setShouldRender(true);
      setIsAnimating(true);
      document.addEventListener('keydown', handleEscape);
      document.body.style.overflow = 'hidden';
      
      // Trigger entrance animation
      const timer = setTimeout(() => {
        setIsAnimating(false);
      }, 50);
      
      return () => clearTimeout(timer);
    } else {
      setIsAnimating(true);
      
      // Delay unmounting to allow exit animation
      const timer = setTimeout(() => {
        setShouldRender(false);
        document.body.style.overflow = 'unset';
      }, 300);
      
      return () => clearTimeout(timer);
    }
  }, [isOpen, onClose]);

  useEffect(() => {
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, []);

  if (!shouldRender) return null;

  const maxWidthClasses = {
    sm: 'max-w-sm',
    md: 'max-w-md',
    lg: 'max-w-lg',
    xl: 'max-w-xl',
    '2xl': 'max-w-2xl',
    '3xl': 'max-w-3xl',
    '4xl': 'max-w-4xl',
    full: 'max-w-full'
  };

  return (
    <div
      className={`fixed inset-0 flex items-center justify-center p-4 z-50 transition-all duration-300 ease-out ${
        isOpen && !isAnimating 
          ? 'bg-black/50 backdrop-blur-sm opacity-100' 
          : 'bg-black/0 backdrop-blur-none opacity-0'
      }`}
      onClick={onClose}
    >
      <div
        className={`bg-white border border-gray-200 rounded-lg shadow-2xl w-full ${maxWidthClasses[maxWidth]} max-h-[90vh] overflow-hidden transform transition-all duration-300 ease-out ${
          isOpen && !isAnimating 
            ? 'scale-100 opacity-100 translate-y-0' 
            : 'scale-95 opacity-0 translate-y-4'
        } ${className}`}
        onClick={(e) => e.stopPropagation()}
      >
        {(title || showCloseButton) && (
          <div className="flex items-center justify-between p-6 border-b border-gray-200">
            {title && (
              <h2 className="text-xl font-semibold text-gray-900 animate-fade-in-up">
                {title}
              </h2>
            )}
            {showCloseButton && (
              <button
                onClick={onClose}
                className="text-gray-400 hover:text-gray-600 transition-all duration-200 p-1 rounded-full hover:bg-gray-100 transform hover:scale-110"
                aria-label="Close modal"
              >
                <X className="h-5 w-5" />
              </button>
            )}
          </div>
        )}
        <div className="overflow-y-auto max-h-[calc(90vh-8rem)] animate-fade-in-up-delayed">
          {children}
        </div>
      </div>
    </div>
  );
}

export default Modal;