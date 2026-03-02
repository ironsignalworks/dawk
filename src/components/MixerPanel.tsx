import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { TechButton } from './TechButton';
import { MixerSlider } from './MixerSlider';
import { X } from 'lucide-react';
import { cn } from '@/src/utils';

interface Track {
  id: string;
  name: string;
  volume: number;
  isMuted: boolean;
}

interface MixerPanelProps {
  isOpen: boolean;
  onClose: () => void;
  tracks: Track[];
  onUpdateTrack: (id: string, updates: Partial<Track>) => void;
  soloTrackIds: string[];
  onToggleSolo: (id: string) => void;
  masterVolume: number;
  onMasterVolumeChange: (v: number) => void;
}

export function MixerPanel({ 
  isOpen, 
  onClose, 
  tracks, 
  onUpdateTrack, 
  soloTrackIds,
  onToggleSolo,
  masterVolume, 
  onMasterVolumeChange 
}: MixerPanelProps) {
  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ y: '100%' }}
          animate={{ y: 0 }}
          exit={{ y: '100%' }}
          transition={{ type: 'spring', damping: 25, stiffness: 200 }}
          className="absolute inset-x-0 bottom-0 h-64 md:h-80 z-40 bg-[#121218] border-t border-white/10 shadow-[0_-20px_50px_rgba(0,0,0,0.5)] flex flex-col"
        >
          <div className="flex items-center justify-between px-6 py-3 border-b border-white/5 bg-black/20">
            <div className="flex items-center gap-4">
              <h2 className="text-xs font-bold uppercase tracking-[0.2em] text-emerald-400">Console Mixer</h2>
              <div className="h-4 w-px bg-white/10" />
              <span className="text-[10px] text-white/30 font-mono uppercase">{tracks.length + 1} Channels Active</span>
            </div>
            <TechButton
              icon={X}
              size="sm"
              iconSize={24}
              variant="ghost"
              onClick={onClose}
              className="size-7 min-h-0 min-w-0 p-0"
            />
          </div>

          <div className="flex-1 flex overflow-x-auto custom-scrollbar p-4 gap-4">
            {/* Master Channel */}
            <div className="flex flex-col items-center w-20 md:w-24 flex-shrink-0 bg-emerald-500/5 rounded-lg border border-emerald-500/10 p-3 gap-4">
              <span className="text-[9px] font-bold text-emerald-400 uppercase tracking-widest">Master Bus</span>
              <div className="flex-1 w-full flex items-center py-2">
                <MixerSlider
                  value={masterVolume}
                  onChange={onMasterVolumeChange}
                  showMarkers={false}
                  orientation="vertical"
                  className="h-full"
                />
              </div>
              <div className="text-[10px] font-mono text-emerald-400">{masterVolume}%</div>
            </div>

            <div className="h-full w-px bg-white/5 mx-2" />

            {/* Track Channels */}
            {tracks.map((track) => (
              <div key={track.id} className="flex flex-col items-center w-20 md:w-24 flex-shrink-0 bg-white/5 rounded-lg border border-white/5 p-3 gap-4 group">
                <span className="text-[9px] font-bold text-white/40 uppercase tracking-tighter truncate w-full text-center">
                  {track.name}
                </span>
                
                <div className="flex-1 w-full flex items-center py-2">
                  <MixerSlider
                    value={track.volume}
                    onChange={(value) => onUpdateTrack(track.id, { volume: value })}
                    showMarkers={false}
                    orientation="vertical"
                    className="h-full"
                  />
                </div>

                <div className="flex flex-col gap-2 items-center w-full">
                  <div className="text-[10px] font-mono text-white/40">{track.volume}%</div>
                  <div className="flex gap-1 w-full">
                    <button 
                      onClick={() => onUpdateTrack(track.id, { isMuted: !track.isMuted })}
                      className={cn(
                        "flex-1 py-1 rounded text-[8px] font-bold uppercase transition-all border",
                        track.isMuted 
                          ? "bg-red-500/20 border-red-500/40 text-red-400" 
                          : "bg-white/5 border-white/10 text-white/30 hover:bg-white/10"
                      )}
                    >
                      M
                    </button>
                    <button
                      onClick={() => onToggleSolo(track.id)}
                      className={cn(
                        "flex-1 py-1 rounded text-[8px] font-bold uppercase transition-all border",
                        soloTrackIds.includes(track.id)
                          ? "bg-emerald-500/20 border-emerald-500/40 text-emerald-400"
                          : "bg-white/5 border-white/10 text-white/30 hover:bg-white/10"
                      )}
                    >
                      S
                    </button>
                  </div>
                </div>
              </div>
            ))}

            {tracks.length === 0 && (
              <div className="flex-1 flex items-center justify-center text-white/10 uppercase tracking-widest text-xs font-bold">
                No active track channels
              </div>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
