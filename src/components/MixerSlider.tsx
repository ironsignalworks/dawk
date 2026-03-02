import React from 'react';
import { cn } from '@/src/utils';

interface MixerSliderProps {
  key?: string | number;
  value: number;
  min?: number;
  max?: number;
  step?: number;
  onChange: (value: number) => void;
  label?: string;
  unit?: string;
  className?: string;
  showMarkers?: boolean;
  orientation?: 'horizontal' | 'vertical';
}

export function MixerSlider({
  value,
  min = 0,
  max = 100,
  step = 1,
  onChange,
  label,
  unit = "%",
  className,
  showMarkers = true,
  orientation = 'horizontal'
}: MixerSliderProps) {
  // Generate markers every 5%
  const markers = [];
  if (showMarkers) {
    for (let i = 0; i <= 100; i += 5) {
      markers.push(i);
    }
  }

  const progress = `${((value - min) / (max - min)) * 100}%`;

  return (
    <div className={cn(
      orientation === 'vertical' ? "flex flex-col gap-2 h-full items-center" : "flex flex-col gap-2 w-full",
      className
    )}>
      {label && (
        <div className="flex justify-between text-[10px] font-bold uppercase text-white/40 tracking-widest">
          <span>{label}</span>
          <span className="text-emerald-400 font-mono">{value}{unit}</span>
        </div>
      )}

      {orientation === 'vertical' ? (
        <div className="relative h-full w-6 min-h-24 flex items-center justify-center group">
          <div className="absolute inset-y-0 left-1/2 -translate-x-1/2 w-1.5 bg-black/60 rounded-sm border border-white/5 overflow-hidden">
            {showMarkers && (
              <div className="absolute inset-0">
                {markers.map((m) => (
                  <div
                    key={m}
                    className={cn(
                      "absolute left-0 w-full h-[1px]",
                      m % 25 === 0 ? "bg-white/20" : "bg-white/5"
                    )}
                    style={{ bottom: `${m}%` }}
                  />
                ))}
              </div>
            )}
            <div
              className="absolute left-0 right-0 bottom-0 bg-emerald-500/20"
              style={{ height: progress }}
            />
          </div>

          <input
            type="range"
            min={min}
            max={max}
            step={step}
            value={value}
            onChange={(e) => onChange(Number(e.target.value))}
            style={{ writingMode: 'vertical-lr', direction: 'rtl' }}
            className="mixer-slider-input mixer-slider-input-vertical absolute inset-0 w-full h-full bg-transparent appearance-none cursor-pointer z-10"
          />
        </div>
      ) : (
        <div className="relative h-6 flex items-center group">
          {/* Background Track with Markers */}
          <div className="absolute inset-x-0 h-1.5 bg-black/60 rounded-sm border border-white/5 overflow-hidden">
            {showMarkers && (
              <div className="absolute inset-0 flex justify-between px-[2px]">
                {markers.map((m) => (
                  <div
                    key={m}
                    className={cn(
                      "w-[1px] h-full",
                      m % 25 === 0 ? "bg-white/20" : "bg-white/5"
                    )}
                  />
                ))}
              </div>
            )}
            {/* Progress fill */}
            <div
              className="h-full bg-emerald-500/20"
              style={{ width: progress }}
            />
          </div>

          {/* The actual range input */}
          <input
            type="range"
            min={min}
            max={max}
            step={step}
            value={value}
            onChange={(e) => onChange(Number(e.target.value))}
            className="mixer-slider-input absolute inset-0 w-full h-full bg-transparent appearance-none cursor-pointer z-10"
          />
        </div>
      )}
    </div>
  );
}
