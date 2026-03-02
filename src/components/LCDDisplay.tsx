import React from 'react';
import { cn } from '@/src/utils';

interface LCDDisplayProps {
  value: string;
  label?: string;
  className?: string;
}

export function LCDDisplay({ value, label, className }: LCDDisplayProps) {
  return (
    <div className={cn("flex flex-col gap-1", className)}>
      {label && <span className="text-[10px] uppercase tracking-widest text-white/40 font-bold">{label}</span>}
      <div className="lcd-display min-w-[5rem] text-center tabular-nums">
        {value}
      </div>
    </div>
  );
}
