import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { TechButton } from './TechButton';
import { 
  X, 
  Play, 
  Pause, 
  Download, 
  Trash2, 
  History, 
  FileAudio,
  Plus
} from 'lucide-react';
import { cn } from '@/src/utils';

interface LibraryItem {
  id: string;
  name: string;
  url: string;
  type: 'recorded' | 'exported';
  timestamp: number;
}

interface LibraryPanelProps {
  isOpen: boolean;
  onClose: () => void;
  items: LibraryItem[];
  onDeleteItem: (id: string) => void;
  onAddToTimeline: (item: LibraryItem) => void;
}

export function LibraryPanel({ 
  isOpen, 
  onClose, 
  items, 
  onDeleteItem,
  onAddToTimeline
}: LibraryPanelProps) {
  const [activeTab, setActiveTab] = useState<'recorded' | 'exported'>('recorded');
  const [playingId, setPlayingId] = useState<string | null>(null);
  const audioRef = React.useRef<HTMLAudioElement | null>(null);

  const filteredItems = items.filter(item => item.type === activeTab);

  const handlePlay = (item: LibraryItem) => {
    if (playingId === item.id) {
      audioRef.current?.pause();
      setPlayingId(null);
    } else {
      if (audioRef.current) {
        audioRef.current.src = item.url;
        audioRef.current.play();
        setPlayingId(item.id);
      }
    }
  };

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleString([], { 
      month: 'short', 
      day: 'numeric', 
      hour: '2-digit', 
      minute: '2-digit' 
    });
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ x: '-100%' }}
          animate={{ x: 0 }}
          exit={{ x: '-100%' }}
          transition={{ type: 'spring', damping: 25, stiffness: 200 }}
          className="absolute left-0 top-0 bottom-0 w-full md:w-96 z-50 panel-glass border-r border-white/10 flex flex-col shadow-2xl"
        >
          <div className="flex items-center justify-between px-6 py-5 border-b border-white/5 bg-black/20">
            <div className="flex items-center gap-3">
              <History className="text-emerald-400" size={20} />
              <h2 className="text-sm font-bold uppercase tracking-widest text-white/90">Project Library</h2>
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

          <div className="flex p-2 bg-black/40 border-b border-white/5">
            <button
              onClick={() => setActiveTab('recorded')}
              className={cn(
                "flex-1 py-2 text-[10px] font-bold uppercase tracking-widest transition-all rounded",
                activeTab === 'recorded' ? "bg-emerald-500/10 text-emerald-400" : "text-white/30 hover:text-white/60"
              )}
            >
              Recorded Takes
            </button>
            <button
              onClick={() => setActiveTab('exported')}
              className={cn(
                "flex-1 py-2 text-[10px] font-bold uppercase tracking-widest transition-all rounded",
                activeTab === 'exported' ? "bg-emerald-500/10 text-emerald-400" : "text-white/30 hover:text-white/60"
              )}
            >
              Exported Mixes
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar">
            {filteredItems.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center p-8 opacity-20">
                <FileAudio size={48} className="mb-4" />
                <p className="text-xs font-bold uppercase tracking-widest">No {activeTab} items</p>
              </div>
            ) : (
              filteredItems.map((item) => (
                <div 
                  key={item.id} 
                  className="p-3 rounded-lg bg-white/5 border border-white/5 hover:border-white/10 transition-all group"
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="min-w-0">
                      <h3 className="text-xs font-bold text-white/80 truncate">{item.name}</h3>
                      <p className="text-[9px] text-white/30 font-mono mt-0.5">{formatDate(item.timestamp)}</p>
                    </div>
                    <div className="flex items-center gap-1">
                      <TechButton 
                        size="sm" 
                        icon={playingId === item.id ? Pause : Play} 
                        onClick={() => handlePlay(item)}
                        className="size-8 p-0"
                      />
                      <TechButton 
                        size="sm" 
                        icon={Plus} 
                        title="Add to Timeline"
                        onClick={() => onAddToTimeline(item)}
                        className="size-8 p-0 text-emerald-400 hover:bg-emerald-500/10"
                      />
                    </div>
                  </div>
                  
                  <div className="flex items-center justify-between pt-2 border-t border-white/5 opacity-0 group-hover:opacity-100 transition-opacity">
                    <a 
                      href={item.url} 
                      download={item.name}
                      className="text-[9px] font-bold text-white/40 hover:text-white flex items-center gap-1.5 uppercase tracking-tighter"
                    >
                      <Download size={10} /> Download
                    </a>
                    <button 
                      onClick={() => onDeleteItem(item.id)}
                      className="text-[9px] font-bold text-red-400/60 hover:text-red-400 flex items-center gap-1.5 uppercase tracking-tighter"
                    >
                      <Trash2 size={10} /> Delete
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>

          <audio 
            ref={audioRef} 
            onEnded={() => setPlayingId(null)}
            className="hidden"
          />
        </motion.div>
      )}
    </AnimatePresence>
  );
}
