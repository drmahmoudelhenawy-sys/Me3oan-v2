import React, { useState, useEffect } from "react";
import { X, ChevronLeft, ChevronRight, Check } from "lucide-react";

export interface TourStep {
  targetId: string;
  title: string;
  content: string;
  position?: 'top' | 'bottom' | 'left' | 'right' | 'center';
}

interface TourGuideProps {
  steps: TourStep[];
  isOpen: boolean;
  onClose: () => void;
  onComplete: () => void;
}

export default function TourGuide({ steps, isOpen, onClose, onComplete }: TourGuideProps) {
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [targetRect, setTargetRect] = useState<DOMRect | null>(null);
  const [isReady, setIsReady] = useState(false);
  const currentStep = steps[currentStepIndex];

  // Helper to get element position safely
  const updatePosition = () => {
    if (!isOpen) return;

    // If position is 'center', we don't need a target element
    if (currentStep.position === 'center') {
      setTargetRect(null);
      setIsReady(true);
      return;
    }

    const element = document.getElementById(currentStep.targetId);
    if (element) {
      // Mobile: Scroll slightly above center to leave room for tooltip
      const isMobile = window.innerWidth < 768;
      element.scrollIntoView({ 
          behavior: 'smooth', 
          block: isMobile ? 'center' : 'center',
          inline: 'center'
      });
      
      // Wait a bit for scroll to finish
      setTimeout(() => {
          const rect = element.getBoundingClientRect();
          // Ensure rect is valid and visible
          if (rect.width > 0 && rect.height > 0) {
              setTargetRect(rect);
              setIsReady(true);
          } else {
              // Element found but hidden/zero size
              setTargetRect(null); 
              setIsReady(true);
          }
      }, 450);
    } else {
      // Fallback if element not found
      setTargetRect(null); 
      setIsReady(true);
    }
  };

  useEffect(() => {
    setIsReady(false);
    if (isOpen) {
        // Initial delay to allow UI (like sidebars) to settle
        const timer = setTimeout(updatePosition, 300);
        window.addEventListener('resize', updatePosition);
        window.addEventListener('scroll', updatePosition, true); // Capture scroll events

        return () => {
            clearTimeout(timer);
            window.removeEventListener('resize', updatePosition);
            window.removeEventListener('scroll', updatePosition, true);
        };
    }
  }, [currentStepIndex, isOpen, currentStep]);

  if (!isOpen) return null;

  const handleNext = () => {
    if (currentStepIndex < steps.length - 1) {
      setCurrentStepIndex(prev => prev + 1);
    } else {
      onComplete();
    }
  };

  const handlePrev = () => {
    if (currentStepIndex > 0) {
      setCurrentStepIndex(prev => prev - 1);
    }
  };

  // --- Smart Positioning Logic ---
  const getTooltipStyle = () => {
    const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;
    
    // 1. Center Position (No Target)
    if (!targetRect || currentStep.position === 'center') {
      return { 
        top: '50%', 
        left: '50%', 
        transform: 'translate(-50%, -50%)',
        position: 'fixed' as const,
        width: isMobile ? '90%' : '400px',
        maxWidth: '90vw',
        zIndex: 10001
      };
    }

    // 2. Mobile Specific Logic (Top or Bottom Docked)
    if (isMobile) {
        // If target is in the top half of screen -> Tooltip at Bottom
        // If target is in the bottom half of screen -> Tooltip at Top
        const isTopHalf = targetRect.top < (window.innerHeight / 2);
        
        return {
            position: 'fixed' as const,
            left: '5%',
            width: '90%',
            // Add spacing from element
            ...(isTopHalf 
                ? { top: Math.min(targetRect.bottom + 20, window.innerHeight - 200) } // Place below
                : { bottom: Math.min(window.innerHeight - targetRect.top + 20, window.innerHeight - 200) } // Place above
            ),
            zIndex: 10001
        };
    }

    // 3. Desktop Logic (Floating near element)
    const gap = 20;
    const tooltipWidth = 320; // Approx width of card
    const tooltipHeight = 200; // Approx height

    let top = 0;
    let left = 0;
    
    // Default preferred position
    const pos = currentStep.position || 'bottom';

    switch (pos) {
        case 'top':
            top = targetRect.top - gap - tooltipHeight;
            left = targetRect.left + (targetRect.width / 2) - (tooltipWidth / 2);
            break;
        case 'bottom':
            top = targetRect.bottom + gap;
            left = targetRect.left + (targetRect.width / 2) - (tooltipWidth / 2);
            break;
        case 'left':
            top = targetRect.top + (targetRect.height / 2) - (tooltipHeight / 2);
            left = targetRect.left - gap - tooltipWidth;
            break;
        case 'right':
            top = targetRect.top + (targetRect.height / 2) - (tooltipHeight / 2);
            left = targetRect.right + gap;
            break;
        default:
            top = targetRect.bottom + gap;
            left = targetRect.left + (targetRect.width / 2) - (tooltipWidth / 2);
    }

    // Boundary Checks (Keep on screen)
    // Horizontal Check
    if (left < 20) left = 20;
    if (left + tooltipWidth > window.innerWidth - 20) {
        left = window.innerWidth - tooltipWidth - 20;
    }

    // Vertical Check (Flip if needed)
    if (top < 20) {
        // If too high, push to bottom of target
        top = targetRect.bottom + gap;
    } else if (top + tooltipHeight > window.innerHeight - 20) {
        // If too low, push to top of target
        top = targetRect.top - gap - tooltipHeight + 50; // +50 to adjust for variable height
    }

    return { 
        top, 
        left, 
        position: 'fixed' as const,
        width: tooltipWidth,
        zIndex: 10001 
    };
  };

  // Highlighter Padding
  const padding = 8;

  return (
    <div className="fixed inset-0 z-[10000] overflow-hidden" aria-live="polite">
      
      {/* Background Overlay with "Cutout" effect */}
      {targetRect ? (
        <div className="absolute inset-0 transition-all duration-300 ease-out">
            {/* We create the dark overlay using borders or SVG, but keeping it simple with 4 divs or a mix-blend-mode is better. 
                Here we use a massive box-shadow on the highlight box to darken everything else. */}
            <div 
                className="absolute rounded-2xl shadow-[0_0_0_9999px_rgba(0,0,0,0.7)] transition-all duration-300 ease-out border-2 border-yellow-400/80 animate-pulse"
                style={{
                    top: targetRect.top - padding,
                    left: targetRect.left - padding,
                    width: targetRect.width + (padding * 2),
                    height: targetRect.height + (padding * 2),
                }}
            />
        </div>
      ) : (
        <div className="absolute inset-0 bg-black/70 backdrop-blur-sm transition-all duration-500" />
      )}

      {/* Tooltip Card */}
      <div 
        className={`bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-2xl transition-all duration-300 ${isReady ? 'opacity-100 translate-y-0 scale-100' : 'opacity-0 translate-y-4 scale-95'}`}
        style={getTooltipStyle() as any}
      >
        <button onClick={onClose} className="absolute top-4 right-4 text-gray-400 hover:text-red-500 transition">
            <X size={18} />
        </button>

        <div className="mb-6">
            <h3 className="font-black text-xl text-indigo-600 dark:text-indigo-400 mb-2">
                {currentStep.title}
            </h3>
            <p className="text-gray-600 dark:text-gray-300 text-sm leading-relaxed font-medium">
                {currentStep.content}
            </p>
        </div>

        <div className="flex justify-between items-center pt-2">
            <div className="flex gap-1">
                {steps.map((_, idx) => (
                    <div 
                        key={idx} 
                        className={`h-1.5 rounded-full transition-all duration-300 ${idx === currentStepIndex ? 'w-6 bg-indigo-600' : 'w-1.5 bg-gray-200 dark:bg-gray-700'}`} 
                    />
                ))}
            </div>
            
            <div className="flex gap-3">
                {currentStepIndex > 0 && (
                    <button 
                        onClick={handlePrev} 
                        className="px-4 py-2 rounded-xl bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-white font-bold text-sm hover:bg-gray-200 dark:hover:bg-gray-600 transition"
                    >
                        السابق
                    </button>
                )}
                <button 
                    onClick={handleNext} 
                    className="flex items-center gap-2 px-5 py-2 rounded-xl bg-indigo-600 text-white font-bold text-sm hover:bg-indigo-700 transition shadow-lg shadow-indigo-500/30"
                >
                    {currentStepIndex === steps.length - 1 ? (
                        <>إنهاء <Check size={16}/></>
                    ) : (
                        <>التالي <ChevronLeft size={16} className={document.dir === 'rtl' ? '' : 'rotate-180'} /></>
                    )}
                </button>
            </div>
        </div>
      </div>
    </div>
  );
}