import { useState, useEffect, useRef, type MouseEvent as ReactMouseEvent } from 'react';
import WaveSurfer from 'wavesurfer.js';
import { TechButton } from './TechButton';
import { Tooltip } from './Tooltip';
import { MixerSlider } from './MixerSlider';
import {
  Trash2,
  Scissors,
  Volume2,
  VolumeX
} from 'lucide-react';
import { cn } from '@/src/utils';
import { clamp } from '@/src/audioUtils';

interface TrackProps {
  id: string;
  url: string;
  name: string;
  volume: number;
  masterVolume: number;
  isMuted: boolean;
  fadeIn: number;
  fadeOut: number;
  timelineStart: number;
  startOffset: number;
  endOffset: number;
  zoom: number;
  playheadTime: number;
  transportAction: 'idle' | 'play' | 'pause' | 'stop' | 'seek';
  transportSignal: number;
  isSoloActive: boolean;
  isSoloed: boolean;
  onUpdate: (updates: Partial<TrackProps>) => void;
  onDelete: (id: string) => void;
  onSplit: (id: string, time: number, duration: number) => void;
  onDurationChange?: (id: string, duration: number) => void;
  onMediaElementReady?: (id: string, element: HTMLMediaElement) => void;
  onMediaElementDetached?: (id: string) => void;
}

export function TrackItem({
  id,
  url,
  name,
  volume,
  masterVolume,
  isMuted,
  fadeIn,
  fadeOut,
  timelineStart,
  startOffset,
  endOffset,
  zoom,
  playheadTime,
  transportAction,
  transportSignal,
  isSoloActive,
  isSoloed,
  onUpdate,
  onDelete,
  onSplit,
  onDurationChange,
  onMediaElementReady,
  onMediaElementDetached
}: TrackProps) {
  const trackRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const wavesurferRef = useRef<WaveSurfer | null>(null);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [menuState, setMenuState] = useState({ open: false, x: 0, y: 0 });
  const paramsRef = useRef({
    volume,
    masterVolume,
    isMuted,
    fadeIn,
    fadeOut,
    startOffset,
    endOffset
  });

  const resolveEndPoint = (dur: number, end: number) => end > 0 ? Math.min(end, dur) : dur;

  const applyTrackGain = (time: number, dur: number) => {
    const ws = wavesurferRef.current;
    if (!ws || dur <= 0) return;

    const p = paramsRef.current;
    const regionStart = Math.min(Math.max(0, p.startOffset), dur);
    const regionEnd = resolveEndPoint(dur, p.endOffset);
    const regionLength = Math.max(0.01, regionEnd - regionStart);

    let gain = (p.volume / 100);
    if (p.isMuted || (isSoloActive && !isSoloed)) {
      ws.setVolume(0);
      return;
    }

    const relativeTime = Math.max(0, time - regionStart);
    const safeFadeIn = Math.min(Math.max(0, p.fadeIn), regionLength);
    const safeFadeOut = Math.min(Math.max(0, p.fadeOut), regionLength);

    if (safeFadeIn > 0 && relativeTime < safeFadeIn) {
      gain *= (relativeTime / safeFadeIn);
    } else if (safeFadeOut > 0 && time > regionEnd - safeFadeOut) {
      gain *= Math.max(0, (regionEnd - time) / safeFadeOut);
    }

    ws.setVolume(Math.max(0, Math.min(1, gain)));
  };

  useEffect(() => {
    if (!containerRef.current) return;

    const ws = WaveSurfer.create({
      container: containerRef.current,
      waveColor: '#334155',
      progressColor: '#10b981',
      cursorColor: '#10b981',
      barWidth: 2,
      barRadius: 3,
      height: 72,
      normalize: true,
      url
    });

    ws.on('ready', () => {
      const totalDur = ws.getDuration();
      setDuration(totalDur);
      onDurationChange?.(id, totalDur);
      const mediaElement = ws.getMediaElement();
      if (mediaElement) onMediaElementReady?.(id, mediaElement);
      const regionStart = Math.min(Math.max(0, startOffset), totalDur);
      setCurrentTime(regionStart);
      ws.setTime(regionStart);
      applyTrackGain(regionStart, totalDur);
    });

    ws.on('interaction', () => {
      setCurrentTime(ws.getCurrentTime());
    });

    ws.on('audioprocess', (time) => {
      setCurrentTime(time);
      const p = paramsRef.current;
      const dur = ws.getDuration();
      const endPoint = resolveEndPoint(dur, p.endOffset);

      if (time >= endPoint) {
        ws.setTime(endPoint);
        ws.pause();
        setCurrentTime(endPoint);
        applyTrackGain(endPoint, dur);
        return;
      }

      applyTrackGain(time, dur);
    });

    wavesurferRef.current = ws;

    return () => {
      onMediaElementDetached?.(id);
      ws.destroy();
    };
  }, [id, onDurationChange, onMediaElementDetached, onMediaElementReady, startOffset, url]);

  useEffect(() => {
    paramsRef.current = {
      volume,
      masterVolume,
      isMuted,
      fadeIn,
      fadeOut,
      startOffset,
      endOffset
    };

    const ws = wavesurferRef.current;
    if (!ws) return;
    const dur = ws.getDuration();
    if (dur > 0) {
      applyTrackGain(ws.getCurrentTime(), dur);
    }
  }, [volume, masterVolume, isMuted, fadeIn, fadeOut, startOffset, endOffset, isSoloActive, isSoloed]);

  useEffect(() => {
    const ws = wavesurferRef.current;
    if (!ws) return;
    const dur = ws.getDuration();
    if (dur <= 0) return;

    const regionStart = Math.min(Math.max(0, startOffset), dur);
    const regionEnd = resolveEndPoint(dur, endOffset);
    const regionDuration = Math.max(0, regionEnd - regionStart);
    const regionTimelineStart = Math.max(0, timelineStart);
    const regionTimelineEnd = regionTimelineStart + regionDuration;
    const inRegion = playheadTime >= regionTimelineStart && playheadTime < regionTimelineEnd;
    const mappedTime = clamp(regionStart + (playheadTime - regionTimelineStart), regionStart, regionEnd);

    if (transportSignal === 0) return;

    if (transportAction === 'play') {
      if (inRegion) {
        ws.setTime(mappedTime);
        ws.play();
      } else {
        ws.pause();
      }
      return;
    }

    if (transportAction === 'pause') {
      ws.pause();
      return;
    }

    if (transportAction === 'stop') {
      ws.pause();
      ws.setTime(regionStart);
      setCurrentTime(regionStart);
      return;
    }

    if (transportAction === 'seek') {
      ws.pause();
      if (inRegion) {
        ws.setTime(mappedTime);
        setCurrentTime(mappedTime);
      } else {
        ws.setTime(regionStart);
        setCurrentTime(regionStart);
      }
    }
  }, [transportSignal, transportAction, playheadTime, timelineStart, startOffset, endOffset]);

  useEffect(() => {
    const ws = wavesurferRef.current;
    if (!ws) return;
    if (transportAction !== 'play') return;

    const dur = ws.getDuration();
    if (dur <= 0) return;
    const regionStart = Math.min(Math.max(0, startOffset), dur);
    const regionEnd = resolveEndPoint(dur, endOffset);
    const regionDuration = Math.max(0, regionEnd - regionStart);
    const regionTimelineStart = Math.max(0, timelineStart);
    const regionTimelineEnd = regionTimelineStart + regionDuration;
    const inRegion = playheadTime >= regionTimelineStart && playheadTime < regionTimelineEnd;

    if (inRegion) {
      const mappedTime = clamp(regionStart + (playheadTime - regionTimelineStart), regionStart, regionEnd);
      if (!ws.isPlaying()) {
        ws.setTime(mappedTime);
        ws.play();
      }
      return;
    }

    if (ws.isPlaying()) {
      ws.pause();
    }
    if (playheadTime < regionTimelineStart) {
      ws.setTime(regionStart);
      setCurrentTime(regionStart);
    } else if (playheadTime >= regionTimelineEnd) {
      ws.setTime(regionEnd);
      setCurrentTime(regionEnd);
    }
  }, [playheadTime, transportAction, timelineStart, startOffset, endOffset]);

  useEffect(() => {
    const closeMenu = (e: MouseEvent) => {
      if (!trackRef.current?.contains(e.target as Node)) {
        setMenuState(prev => ({ ...prev, open: false }));
      }
    };

    const closeOnEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setMenuState(prev => ({ ...prev, open: false }));
      }
    };

    window.addEventListener('mousedown', closeMenu);
    window.addEventListener('keydown', closeOnEsc);
    return () => {
      window.removeEventListener('mousedown', closeMenu);
      window.removeEventListener('keydown', closeOnEsc);
    };
  }, []);

  const handleSplit = () => {
    const ws = wavesurferRef.current;
    if (!ws) return;
    onSplit(id, ws.getCurrentTime(), ws.getDuration());
  };

  const openContextMenu = (e: ReactMouseEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (!trackRef.current) return;

    const rect = trackRef.current.getBoundingClientRect();
    const menuWidth = 240;
    const menuHeight = 228;
    const x = Math.max(8, Math.min(e.clientX - rect.left, rect.width - menuWidth - 8));
    const y = Math.max(8, Math.min(e.clientY - rect.top, rect.height - menuHeight - 8));
    setMenuState({ open: true, x, y });
  };

  return (
    <div
      ref={trackRef}
      onContextMenu={openContextMenu}
      className={cn(
        "group relative p-2 md:p-3 panel-glass rounded-lg border-l-4 transition-all",
        isMuted ? "border-l-white/10 opacity-60" : "border-l-emerald-500/50"
      )}
    >
      <div className="relative w-full">
        <div className="relative w-full rounded bg-black/20 overflow-x-auto overflow-y-hidden custom-scrollbar">
          <div className="relative h-24" style={{ width: `${Math.max(1, zoom) * 100}%` }}>
          <div ref={containerRef} className="w-full h-24" />

        <div className="absolute inset-x-0 top-0 p-2 z-30 flex items-start justify-between pointer-events-none">
          <div className="min-w-0 pointer-events-auto">
            <h3 className="text-xs font-bold text-white/85 truncate">{name}</h3>
            <p className="text-[9px] text-white/35 font-mono">
              {currentTime.toFixed(2)}s / {duration.toFixed(2)}s
            </p>
          </div>

          <div className="pointer-events-auto opacity-0 group-hover:opacity-100 transition-opacity duration-150 flex items-center gap-1 p-1 rounded bg-black/60 border border-white/10 backdrop-blur-sm">
            <Tooltip text={isMuted ? "Unmute" : "Mute"}>
              <TechButton
                size="sm"
                icon={isMuted ? VolumeX : Volume2}
                variant={isMuted ? "danger" : "secondary"}
                active={isMuted}
                onClick={() => onUpdate({ isMuted: !isMuted })}
                className="size-7 min-h-0 min-w-0 p-0"
              />
            </Tooltip>
            <Tooltip text="Split Track">
              <TechButton size="sm" icon={Scissors} onClick={handleSplit} className="size-7 min-h-0 min-w-0 p-0" />
            </Tooltip>
            <Tooltip text="Delete Track">
              <TechButton size="sm" icon={Trash2} variant="danger" onClick={() => onDelete(id)} className="size-7 min-h-0 min-w-0 p-0" />
            </Tooltip>
          </div>
          </div>
        </div>

        {startOffset > 0 && (
          <div
            className="absolute top-0 left-0 h-full bg-black/60 backdrop-blur-[2px] z-20 border-r border-white/20"
            style={{ width: `${duration > 0 ? (startOffset / duration) * 100 : 0}%` }}
          >
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="text-[8px] font-bold text-white/20 uppercase rotate-90">Trimmed</span>
            </div>
          </div>
        )}
        {endOffset > 0 && (
          <div
            className="absolute top-0 right-0 h-full bg-black/60 backdrop-blur-[2px] z-20 border-l border-white/20"
            style={{ width: `${duration > 0 ? ((duration - endOffset) / duration) * 100 : 0}%` }}
          >
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="text-[8px] font-bold text-white/20 uppercase rotate-90">Trimmed</span>
            </div>
          </div>
        )}

        {fadeIn > 0 && (
          <div
            className="absolute top-0 h-full bg-gradient-to-r from-black/60 to-transparent pointer-events-none z-10"
            style={{
              left: `${duration > 0 ? (startOffset / duration) * 100 : 0}%`,
              width: `${duration > 0 ? (fadeIn / duration) * 100 : 0}%`
            }}
          />
        )}
        {fadeOut > 0 && (
          <div
            className="absolute top-0 h-full bg-gradient-to-l from-black/60 to-transparent pointer-events-none z-10"
            style={{
              right: `${duration > 0 ? ((duration - (endOffset || duration)) / duration) * 100 : 0}%`,
              width: `${duration > 0 ? (fadeOut / duration) * 100 : 0}%`
            }}
          />
        )}

        <div
          className="absolute bottom-0 left-0 h-0.5 bg-emerald-500/40 transition-all duration-100 z-30"
          style={{ width: `${duration > 0 ? (currentTime / duration) * 100 : 0}%` }}
        />

        <div className="absolute bottom-2 right-2 text-[8px] font-mono text-white/40 uppercase tracking-wide z-30 pointer-events-none">
          Right-click for track menu
        </div>
      </div>

      {menuState.open && (
        <div
          className="absolute z-40 w-60 rounded-md border border-white/10 bg-[#121218]/95 backdrop-blur-md shadow-2xl p-3 space-y-3"
          style={{ left: `${menuState.x}px`, top: `${menuState.y}px` }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="grid grid-cols-3 gap-1">
            <button
              onClick={() => onUpdate({ isMuted: !isMuted })}
              className={cn(
                "py-1 rounded text-[9px] font-bold uppercase border transition-colors",
                isMuted
                  ? "bg-red-500/20 border-red-500/40 text-red-400"
                  : "bg-white/5 border-white/10 text-white/50 hover:text-white/80"
              )}
            >
              {isMuted ? 'Unmute' : 'Mute'}
            </button>
            <button
              onClick={handleSplit}
              className="py-1 rounded text-[9px] font-bold uppercase border bg-white/5 border-white/10 text-white/50 hover:text-white/80"
            >
              Split
            </button>
            <button
              onClick={() => onDelete(id)}
              className="py-1 rounded text-[9px] font-bold uppercase border bg-red-500/10 border-red-500/30 text-red-400 hover:bg-red-500/20"
            >
              Delete
            </button>
          </div>
          <MixerSlider
            label="Volume"
            value={volume}
            onChange={(value) => onUpdate({ volume: value })}
            showMarkers={false}
          />
          <MixerSlider
            label="Fade In"
            min={0}
            max={5}
            step={0.1}
            value={fadeIn}
            unit="s"
            onChange={(value) => onUpdate({ fadeIn: value })}
            showMarkers={false}
          />
          <MixerSlider
            label="Fade Out"
            min={0}
            max={5}
            step={0.1}
            value={fadeOut}
            unit="s"
            onChange={(value) => onUpdate({ fadeOut: value })}
            showMarkers={false}
          />
          <MixerSlider
            label="Start"
            min={0}
            max={300}
            step={0.1}
            value={timelineStart}
            unit="s"
            onChange={(value) => onUpdate({ timelineStart: value })}
            showMarkers={false}
          />
        </div>
      )}
      </div>
    </div>
  );
}
