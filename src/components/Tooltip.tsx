import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';

interface TooltipProps {
  text: string;
  children: React.ReactNode;
  position?: 'top' | 'bottom' | 'left' | 'right';
}

export function Tooltip({ text, children, position = 'top' }: TooltipProps) {
  const [show, setShow] = useState(false);

  const positions = {
    top: "bottom-full mb-2 left-1/2 -translate-x-1/2",
    bottom: "top-full mt-2 left-1/2 -translate-x-1/2",
    left: "right-full mr-2 top-1/2 -translate-y-1/2",
    right: "left-full ml-2 top-1/2 -translate-y-1/2"
  };

  const initial = {
    top: { opacity: 0, scale: 0.8, y: 10 },
    bottom: { opacity: 0, scale: 0.8, y: -10 },
    left: { opacity: 0, scale: 0.8, x: 10 },
    right: { opacity: 0, scale: 0.8, x: -10 }
  };

  return (
    <div 
      className="relative flex items-center"
      onMouseEnter={() => setShow(true)}
      onMouseLeave={() => setShow(false)}
    >
      {children}
      <AnimatePresence>
        {show && (
          <motion.div
            initial={initial[position]}
            animate={{ opacity: 1, scale: 1, x: 0, y: 0 }}
            exit={initial[position]}
            className={cn(
              "absolute px-2 py-1 bg-black/90 border border-white/10 rounded text-[10px] font-bold text-white whitespace-nowrap z-[100] pointer-events-none shadow-xl",
              positions[position]
            )}
          >
            {text}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

import { cn } from '@/src/utils';
