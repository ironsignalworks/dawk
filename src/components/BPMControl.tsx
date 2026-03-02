import React, { useState } from 'react';
import { ChevronUp, ChevronDown, Volume2, Clock3, Settings2, VolumeX, Hash } from 'lucide-react';
import { cn } from '@/src/utils';
import { MixerSlider } from './MixerSlider';

interface BPMControlProps {
  value: number;
  onChange: (value: number) => void;
  metronomeVolume: number;
  onMetronomeVolumeChange: (value: number) => void;
  metronomeSound: 'classic' | 'woodblock' | 'electronic';
  onMetronomeSoundChange: (sound: 'classic' | 'woodblock' | 'electronic') => void;
  isEnabled: boolean;
  onToggle: () => void;
  isMuted: boolean;
  onToggleMute: () => void;
  timeSignature: string;
  onTimeSignatureChange: (sig: string) => void;
}

export function BPMControl({ 
  value, 
  onChange, 
  metronomeVolume, 
  onMetronomeVolumeChange,
  metronomeSound,
  onMetronomeSoundChange,
  isEnabled,
  onToggle,
  isMuted,
  onToggleMute,
  timeSignature,
  onTimeSignatureChange
}: BPMControlProps) {
  const [showSettings, setShowSettings] = useState(false);
  
  const increment = () => onChange(Math.min(300, value + 1));
  const decrement = () => onChange(Math.max(20, value - 1));

  const timeSignatures = ['2/4', '3/4', '4/4', '5/4', '6/8'];

  return (
    <div className="flex items-center gap-1.5">
      <div className={cn(
        "flex items-center gap-2 bg-black/40 border rounded-lg px-2 py-1 transition-all",
        isEnabled ? "border-emerald-500/30 shadow-[0_0_10px_rgba(16,185,129,0.1)]" : "border-white/5"
      )}>
        <button 
          onClick={onToggle}
          className={cn(
            "p-1 rounded transition-colors",
            isEnabled ? "bg-emerald-500/20 text-emerald-400" : "text-white/20 hover:text-white/40"
          )}
        >
          <Clock3 size={12} className={isEnabled ? "animate-pulse" : ""} />
        </button>

        <div className="h-4 w-px bg-white/5" />

        <div className="flex flex-col items-center justify-center">
          <span className="text-[7px] font-bold text-white/20 uppercase tracking-tighter leading-none mb-0.5">BPM</span>
          <input 
            type="number" 
            value={value} 
            onChange={(e) => onChange(Number(e.target.value))}
            className="w-7 bg-transparent text-[10px] font-mono text-emerald-400 focus:outline-none text-center [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
          />
        </div>
        <div className="flex flex-col gap-0.5">
          <button 
            onClick={increment}
            className="p-0.5 hover:bg-white/5 rounded transition-colors text-white/30 hover:text-emerald-400"
          >
            <ChevronUp size={8} strokeWidth={3} />
          </button>
          <button 
            onClick={decrement}
            className="p-0.5 hover:bg-white/5 rounded transition-colors text-white/30 hover:text-emerald-400"
          >
            <ChevronDown size={8} strokeWidth={3} />
          </button>
        </div>

        <div className="h-4 w-px bg-white/5" />

        <button 
          onClick={() => setShowSettings(!showSettings)}
          className={cn(
            "p-1 rounded transition-colors",
            showSettings ? "bg-white/10 text-white" : "text-white/20 hover:text-white/40"
          )}
        >
          <Settings2 size={12} />
        </button>
      </div>

      {showSettings && (
        <div className="flex flex-col gap-2 bg-black/60 backdrop-blur-md border border-white/10 rounded-lg p-2 shadow-2xl animate-in fade-in slide-in-from-left-2 duration-200">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <button 
                onClick={onToggleMute}
                className={cn(
                  "p-1 rounded transition-colors",
                  isMuted ? "text-red-400 bg-red-400/10" : "text-white/30 hover:text-white/60"
                )}
              >
                {isMuted ? <VolumeX size={10} /> : <Volume2 size={10} />}
              </button>
              <MixerSlider
                value={metronomeVolume}
                onChange={onMetronomeVolumeChange}
                showMarkers={false}
                className="w-16"
              />
              </div>

            <div className="h-4 w-px bg-white/10" />

            <div className="flex items-center gap-1">
              {(['classic', 'woodblock', 'electronic'] as const).map((sound) => (
                <button
                  key={sound}
                  onClick={() => onMetronomeSoundChange(sound)}
                  className={cn(
                    "px-1.5 py-0.5 rounded text-[7px] font-bold uppercase tracking-widest transition-all",
                    metronomeSound === sound 
                      ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30" 
                      : "text-white/20 hover:text-white/40 border border-transparent"
                  )}
                >
                  {sound}
                </button>
              ))}
            </div>
          </div>

          <div className="h-px w-full bg-white/5" />

          <div className="flex items-center gap-2">
            <Hash size={10} className="text-white/30" />
            <div className="flex items-center gap-1">
              {timeSignatures.map((sig) => (
                <button
                  key={sig}
                  onClick={() => onTimeSignatureChange(sig)}
                  className={cn(
                    "px-1.5 py-0.5 rounded text-[7px] font-bold transition-all",
                    timeSignature === sig 
                      ? "bg-white/20 text-white" 
                      : "text-white/20 hover:text-white/40"
                  )}
                >
                  {sig}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
