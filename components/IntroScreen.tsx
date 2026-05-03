import React, { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

interface IntroScreenProps {
  onFinish: () => void;
}

const IntroScreen: React.FC<IntroScreenProps> = ({ onFinish }) => {
  const [isExiting, setIsExiting] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsExiting(true);
      setTimeout(onFinish, 800); // Allow fade out
    }, 4500); 
    return () => clearTimeout(timer);
  }, [onFinish]);

  // Sketchy/Handwritten paths
  // V: stylized
  const vPath = "M15 25 Q 20 20, 25 35 L 50 85 Q 55 90, 60 85 L 85 20";
  // 2: stylized cursive
  const twoPath = "M105 45 C 105 10, 155 10, 155 45 C 155 70, 105 85, 105 110 L 165 110";

  return (
    <AnimatePresence>
      {!isExiting && (
        <motion.div 
          initial={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.8 }}
          className="fixed inset-0 z-[10000] bg-white flex items-center justify-center overflow-hidden select-none"
        >
          {/* Grainy Texture */}
          <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/paper-fibers.png')] opacity-10 pointer-events-none" />

          <div className="flex flex-row items-center justify-center gap-4 md:gap-8 scale-90 md:scale-110">
            
            {/* V2 Sketch Section */}
            <div className="relative w-32 h-24 md:w-48 md:h-32 flex items-center">
                <svg 
                    viewBox="0 0 180 120" 
                    className="w-full h-full"
                    fill="none" 
                    stroke="currentColor" 
                    strokeWidth="3.5" 
                    strokeLinecap="round" 
                    strokeLinejoin="round"
                >
                    {/* Hand-drawn V */}
                    <motion.path
                        d={vPath}
                        initial={{ pathLength: 0, opacity: 0 }}
                        animate={{ pathLength: 1, opacity: 1 }}
                        transition={{ 
                            duration: 1.4, 
                            delay: 0.8,
                            ease: "easeInOut" 
                        }}
                        className="text-indigo-600"
                    />
                    
                    {/* Hand-drawn 2 */}
                    <motion.path
                        d={twoPath}
                        initial={{ pathLength: 0, opacity: 0 }}
                        animate={{ pathLength: 1, opacity: 1 }}
                        transition={{ 
                            duration: 1.6, 
                            delay: 1.8,
                            ease: "easeInOut" 
                        }}
                        className="text-indigo-600"
                    />

                    {/* Final Dot */}
                    <motion.circle
                        cx="172"
                        cy="110"
                        r="3"
                        fill="#4f46e5"
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        transition={{ delay: 3.5, duration: 0.3, type: "spring" }}
                    />
                </svg>

                {/* Sub-label */}
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 3.2, duration: 1 }}
                    className="absolute -bottom-4 right-0 text-[9px] font-black text-indigo-400 tracking-[0.4em] uppercase"
                >
                    System architecture
                </motion.div>
            </div>

            {/* Logo Section */}
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 1.2, ease: "circOut" }}
              className="relative pl-4 border-r-2 border-gray-100"
            >
              <img 
                src="https://od.lk/s/ODZfNzM1MTAwOTVf/%D9%84%D9%88%D8%AC%D9%88%20%D9%85%D8%B9%D9%88%D8%A7%D9%86.png" 
                alt="Ma3wan Logo" 
                className="h-28 md:h-40 object-contain drop-shadow-sm"
              />
            </motion.div>
          </div>

          {/* Version Footer */}
          <motion.div 
             initial={{ opacity: 0, y: 10 }}
             animate={{ opacity: 1, y: 0 }}
             transition={{ delay: 0.2, duration: 1 }}
             className="absolute bottom-12 text-[10px] font-bold text-gray-400 tracking-widest uppercase"
          >
            Ma3wan Tasks • Release 2.0.4
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default IntroScreen;
