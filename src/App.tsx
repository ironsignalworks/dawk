import React, { useState, useEffect, useCallback, useRef } from 'react';
import { 
  Play, 
  Pause, 
  Square, 
  Mic, 
  Plus, 
  Download, 
  Settings2, 
  Activity,
  Layers,
  Zap,
  Clock,
  Music,
  Waves,
  Sliders,
  Radio,
  Share2,
  Undo2,
  Redo2,
  Library,
  History,
  FileAudio
} from 'lucide-react';
import { TechButton } from './components/TechButton';
import { LCDDisplay } from './components/LCDDisplay';
import { TrackItem } from './components/TrackItem';
import { MixerSlider } from './components/MixerSlider';
import { MixerPanel } from './components/MixerPanel';
import { LibraryPanel } from './components/LibraryPanel';
import { Tooltip } from './components/Tooltip';
import { MasterVisualizer } from './components/MasterVisualizer';
import { BPMControl } from './components/BPMControl';
import { motion, AnimatePresence } from 'motion/react';
import * as Tone from 'tone';
import { cn } from './utils';
import { clamp, createDistortionCurve, createImpulseResponse, encodeWav, isBlobUrl } from './audioUtils';

interface Track {
  id: string;
  url: string;
  name: string;
  blob?: Blob;
  volume: number;
  isMuted: boolean;
  fadeIn: number;
  fadeOut: number;
  timelineStart: number;
  startOffset: number;
  endOffset: number;
}

interface LibraryItem {
  id: string;
  name: string;
  url: string;
  type: 'recorded' | 'exported';
  timestamp: number;
}

interface TrackAudioNode {
  element: HTMLMediaElement;
  source: MediaElementAudioSourceNode;
  gain: GainNode;
}

type TransportCommand = 'idle' | 'play' | 'pause' | 'stop' | 'seek';
const MIN_SPLIT_GAP_SECONDS = 0.1;

const createId = () =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2, 11);

export default function App() {
  const [tracks, setTracks] = useState<Track[]>([]);
  const [history, setHistory] = useState<Track[][]>([]);
  const [redoStack, setRedoStack] = useState<Track[][]>([]);
  
  const [isPlaying, setIsPlaying] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [isRecordingPaused, setIsRecordingPaused] = useState(false);
  const [time, setTime] = useState(0);
  const [bpm, setBpm] = useState(120);
  const [masterVolume, setMasterVolume] = useState(80);
  const [inputSource, setInputSource] = useState<'mic' | 'system'>('mic');
  const [isFxPanelOpen, setIsFxPanelOpen] = useState(false);
  const [isMixerOpen, setIsMixerOpen] = useState(false);
  const [isLibraryOpen, setIsLibraryOpen] = useState(false);
  const [isImportMenuOpen, setIsImportMenuOpen] = useState(false);
  const [isMetronomeEnabled, setIsMetronomeEnabled] = useState(false);
  const [isMetronomeMuted, setIsMetronomeMuted] = useState(false);
  const [metronomeVolume, setMetronomeVolume] = useState(50);
  const [metronomeSound, setMetronomeSound] = useState<'classic' | 'woodblock' | 'electronic'>('classic');
  const [timeSignature, setTimeSignature] = useState('4/4');
  const [library, setLibrary] = useState<LibraryItem[]>([]);
  const [showExportDonateMessage, setShowExportDonateMessage] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [statusNotice, setStatusNotice] = useState<{ type: 'info' | 'error'; message: string } | null>(null);
  const [timelineZoom, setTimelineZoom] = useState(1);
  const [transportCommand, setTransportCommand] = useState<TransportCommand>('idle');
  const [transportSignal, setTransportSignal] = useState(0);
  const [trackDurations, setTrackDurations] = useState<Record<string, number>>({});
  const [soloTrackIds, setSoloTrackIds] = useState<string[]>([]);
  
  const metronomeIntervalRef = useRef<number | null>(null);
  const metronomeNextBeatRef = useRef(0);
  const metronomeBeatCounterRef = useRef(0);

  const stopMetronomeScheduler = useCallback(() => {
    if (metronomeIntervalRef.current !== null) {
      window.clearInterval(metronomeIntervalRef.current);
      metronomeIntervalRef.current = null;
    }
    metronomeBeatCounterRef.current = 0;
    metronomeNextBeatRef.current = 0;
  }, []);

  useEffect(() => {
    if (!isMetronomeEnabled || !isPlaying) {
      stopMetronomeScheduler();
      return;
    }

    let cancelled = false;

    const run = async () => {
      const ctx = await initAudioEngine();
      const masterInput = masterInputRef.current;
      if (!masterInput || cancelled) return;

      stopMetronomeScheduler();
      const [beats, subdivision] = timeSignature.split('/').map(Number);
      const beatSeconds = (60 / Math.max(1, bpm)) * (4 / Math.max(1, subdivision));
      const lookAhead = 0.1;
      const intervalMs = 25;
      const volume = isMetronomeMuted ? 0 : metronomeVolume / 100;

      metronomeNextBeatRef.current = ctx.currentTime + 0.02;

      const scheduleClick = (time: number, isAccent: boolean) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        if (metronomeSound === 'classic') {
          osc.type = 'sine';
          osc.frequency.value = isAccent ? 1568 : 1174;
          gain.gain.setValueAtTime(0.0001, time);
          gain.gain.exponentialRampToValueAtTime(Math.max(0.0001, volume * (isAccent ? 0.9 : 0.6)), time + 0.002);
          gain.gain.exponentialRampToValueAtTime(0.0001, time + 0.05);
          osc.start(time);
          osc.stop(time + 0.06);
        } else if (metronomeSound === 'woodblock') {
          osc.type = 'triangle';
          osc.frequency.value = isAccent ? 1900 : 1300;
          gain.gain.setValueAtTime(0.0001, time);
          gain.gain.exponentialRampToValueAtTime(Math.max(0.0001, volume * (isAccent ? 0.8 : 0.55)), time + 0.001);
          gain.gain.exponentialRampToValueAtTime(0.0001, time + 0.03);
          osc.start(time);
          osc.stop(time + 0.04);
        } else {
          osc.type = 'square';
          osc.frequency.value = isAccent ? 1300 : 980;
          gain.gain.setValueAtTime(0.0001, time);
          gain.gain.exponentialRampToValueAtTime(Math.max(0.0001, volume * (isAccent ? 0.75 : 0.5)), time + 0.001);
          gain.gain.exponentialRampToValueAtTime(0.0001, time + 0.025);
          osc.start(time);
          osc.stop(time + 0.035);
        }

        osc.connect(gain);
        gain.connect(masterInput);
      };

      metronomeIntervalRef.current = window.setInterval(() => {
        while (metronomeNextBeatRef.current < ctx.currentTime + lookAhead) {
          const beatIndex = metronomeBeatCounterRef.current % Math.max(1, beats);
          scheduleClick(metronomeNextBeatRef.current, beatIndex === 0);
          metronomeBeatCounterRef.current += 1;
          metronomeNextBeatRef.current += beatSeconds;
        }
      }, intervalMs);
    };

    void run();

    return () => {
      cancelled = true;
      stopMetronomeScheduler();
    };
  }, [isMetronomeEnabled, isPlaying, bpm, metronomeSound, metronomeVolume, isMetronomeMuted, timeSignature, stopMetronomeScheduler]);

  const [fxSettings, setFxSettings] = useState({
    reverb: { value: 20, mode: 'Hall' },
    delay: { value: 10, mode: 'Digital' },
    distortion: { value: 0, mode: 'Overdrive' },
    compression: { value: 50, mode: 'Soft' }
  });

  const FX_MODES = {
    reverb: ['Room', 'Hall', 'Plate'],
    delay: ['Digital', 'Tape', 'Ping-Pong'],
    distortion: ['Overdrive', 'Fuzz', 'Bitcrush'],
    compression: ['Soft', 'Hard', 'Limiter']
  };
  
  const recorderRef = useRef<MediaRecorder | null>(null);
  const recordingStreamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const rafRef = useRef<number | null>(null);
  const playStartRef = useRef<number | null>(null);
  const pausedAtRef = useRef(0);
  const timeRef = useRef(0);
  const audioContextRef = useRef<AudioContext | null>(null);
  const trackNodesRef = useRef<Map<string, TrackAudioNode>>(new Map());
  const masterInputRef = useRef<GainNode | null>(null);
  const compressorRef = useRef<DynamicsCompressorNode | null>(null);
  const distortionShaperRef = useRef<WaveShaperNode | null>(null);
  const distortionDryRef = useRef<GainNode | null>(null);
  const distortionWetRef = useRef<GainNode | null>(null);
  const delayNodeRef = useRef<DelayNode | null>(null);
  const delayFeedbackRef = useRef<GainNode | null>(null);
  const delayDryRef = useRef<GainNode | null>(null);
  const delayWetRef = useRef<GainNode | null>(null);
  const convolverRef = useRef<ConvolverNode | null>(null);
  const reverbDryRef = useRef<GainNode | null>(null);
  const reverbWetRef = useRef<GainNode | null>(null);
  const masterGainRef = useRef<GainNode | null>(null);
  const analyserNodeRef = useRef<AnalyserNode | null>(null);
  const previousTrackUrlsRef = useRef<Set<string>>(new Set());
  const previousLibraryUrlsRef = useRef<Set<string>>(new Set());
  const [liveAnalyserNode, setLiveAnalyserNode] = useState<AnalyserNode | null>(null);

  const notify = useCallback((message: string, type: 'info' | 'error' = 'info') => {
    setStatusNotice({ message, type });
  }, []);

  async function initAudioEngine() {
    if (audioContextRef.current) {
      if (audioContextRef.current.state === 'suspended') {
        await audioContextRef.current.resume();
      }
      return audioContextRef.current;
    }

    const ctx = new AudioContext();
    const masterInput = ctx.createGain();
    const compressor = ctx.createDynamicsCompressor();
    const distortionShaper = ctx.createWaveShaper();
    const distortionDry = ctx.createGain();
    const distortionWet = ctx.createGain();
    const distortionSum = ctx.createGain();
    const delay = ctx.createDelay(2);
    const delayFeedback = ctx.createGain();
    const delayDry = ctx.createGain();
    const delayWet = ctx.createGain();
    const delaySum = ctx.createGain();
    const convolver = ctx.createConvolver();
    const reverbDry = ctx.createGain();
    const reverbWet = ctx.createGain();
    const reverbSum = ctx.createGain();
    const masterGain = ctx.createGain();
    const analyser = ctx.createAnalyser();

    masterInput.connect(compressor);
    compressor.connect(distortionDry);
    distortionDry.connect(distortionSum);
    compressor.connect(distortionShaper);
    distortionShaper.connect(distortionWet);
    distortionWet.connect(distortionSum);

    distortionSum.connect(delayDry);
    delayDry.connect(delaySum);
    distortionSum.connect(delay);
    delay.connect(delayFeedback);
    delayFeedback.connect(delay);
    delay.connect(delayWet);
    delayWet.connect(delaySum);

    delaySum.connect(reverbDry);
    reverbDry.connect(reverbSum);
    delaySum.connect(convolver);
    convolver.connect(reverbWet);
    reverbWet.connect(reverbSum);

    reverbSum.connect(masterGain);
    masterGain.connect(analyser);
    analyser.connect(ctx.destination);

    audioContextRef.current = ctx;
    masterInputRef.current = masterInput;
    compressorRef.current = compressor;
    distortionShaperRef.current = distortionShaper;
    distortionDryRef.current = distortionDry;
    distortionWetRef.current = distortionWet;
    delayNodeRef.current = delay;
    delayFeedbackRef.current = delayFeedback;
    delayDryRef.current = delayDry;
    delayWetRef.current = delayWet;
    convolverRef.current = convolver;
    reverbDryRef.current = reverbDry;
    reverbWetRef.current = reverbWet;
    masterGainRef.current = masterGain;
    analyserNodeRef.current = analyser;
    setLiveAnalyserNode(analyser);

    return ctx;
  }

  const registerTrackMediaElement = useCallback(async (id: string, element: HTMLMediaElement) => {
    const ctx = await initAudioEngine();
    const input = masterInputRef.current;
    if (!input) return;

    const existing = trackNodesRef.current.get(id);
    if (existing?.element === element) return;
    if (existing) {
      existing.source.disconnect();
      existing.gain.disconnect();
      trackNodesRef.current.delete(id);
    }

    let source: MediaElementAudioSourceNode;
    try {
      source = ctx.createMediaElementSource(element);
    } catch (error) {
      console.error('Failed to register media element on audio engine', error);
      notify('Audio engine could not attach a track output.', 'error');
      return;
    }
    const gain = ctx.createGain();
    gain.gain.value = 1;
    source.connect(gain);
    gain.connect(input);
    trackNodesRef.current.set(id, { element, source, gain });
  }, []);

  const unregisterTrackMediaElement = useCallback((id: string) => {
    const existing = trackNodesRef.current.get(id);
    if (!existing) return;
    existing.source.disconnect();
    existing.gain.disconnect();
    trackNodesRef.current.delete(id);
  }, []);

  useEffect(() => {
    timeRef.current = time;
  }, [time]);

  useEffect(() => {
    setTrackDurations(prev => {
      const next: Record<string, number> = {};
      tracks.forEach(track => {
        if (prev[track.id]) next[track.id] = prev[track.id];
      });
      return next;
    });
    setSoloTrackIds(prev => prev.filter(id => tracks.some(track => track.id === id)));
  }, [tracks]);

  useEffect(() => {
    if (!statusNotice) return;
    const timer = window.setTimeout(() => setStatusNotice(null), 4000);
    return () => window.clearTimeout(timer);
  }, [statusNotice]);

  useEffect(() => {
    const currentTrackUrls = new Set(tracks.map(track => track.url));
    const currentLibraryUrls = new Set(library.map(item => item.url));
    const allCurrent = new Set([...currentTrackUrls, ...currentLibraryUrls]);
    const previousAll = new Set([
      ...previousTrackUrlsRef.current,
      ...previousLibraryUrlsRef.current
    ]);

    previousAll.forEach(url => {
      if (isBlobUrl(url) && !allCurrent.has(url)) {
        URL.revokeObjectURL(url);
      }
    });

    previousTrackUrlsRef.current = currentTrackUrls;
    previousLibraryUrlsRef.current = currentLibraryUrls;
  }, [tracks, library]);

  useEffect(() => {
    const compressor = compressorRef.current;
    const distortionShaper = distortionShaperRef.current;
    const distortionDry = distortionDryRef.current;
    const distortionWet = distortionWetRef.current;
    const delay = delayNodeRef.current;
    const delayFeedback = delayFeedbackRef.current;
    const delayDry = delayDryRef.current;
    const delayWet = delayWetRef.current;
    const convolver = convolverRef.current;
    const reverbDry = reverbDryRef.current;
    const reverbWet = reverbWetRef.current;
    const masterGain = masterGainRef.current;
    const ctx = audioContextRef.current;
    if (!compressor || !distortionShaper || !distortionDry || !distortionWet || !delay || !delayFeedback || !delayDry || !delayWet || !convolver || !reverbDry || !reverbWet || !masterGain || !ctx) {
      return;
    }

    const compressionAmount = fxSettings.compression.value / 100;
    compressor.threshold.value = compressionAmount <= 0 ? 0 : -10 - compressionAmount * 24;
    compressor.ratio.value = compressionAmount <= 0 ? 1 : 2 + compressionAmount * 10;
    compressor.attack.value = 0.003;
    compressor.release.value = 0.2;

    const distortionAmount = fxSettings.distortion.value / 100;
    distortionShaper.curve = createDistortionCurve(20 + distortionAmount * 420);
    distortionShaper.oversample = '4x';
    distortionDry.gain.value = 1 - distortionAmount * 0.8;
    distortionWet.gain.value = distortionAmount * 0.8;

    const delayAmount = fxSettings.delay.value / 100;
    const delayTimeByMode = {
      Digital: 0.22,
      Tape: 0.34,
      'Ping-Pong': 0.4
    } as const;
    delay.delayTime.value = delayTimeByMode[fxSettings.delay.mode as keyof typeof delayTimeByMode] ?? 0.25;
    delayFeedback.gain.value = delayAmount <= 0 ? 0 : 0.2 + delayAmount * 0.45;
    delayDry.gain.value = 1 - delayAmount * 0.6;
    delayWet.gain.value = delayAmount * 0.6;

    const reverbAmount = fxSettings.reverb.value / 100;
    const reverbSecondsByMode = {
      Room: 0.8,
      Hall: 1.8,
      Plate: 1.2
    } as const;
    const seconds = reverbSecondsByMode[fxSettings.reverb.mode as keyof typeof reverbSecondsByMode] ?? 1.2;
    convolver.buffer = createImpulseResponse(ctx, seconds, 2 + reverbAmount * 4);
    reverbDry.gain.value = 1 - reverbAmount * 0.7;
    reverbWet.gain.value = reverbAmount * 0.7;

    masterGain.gain.value = masterVolume / 100;
  }, [fxSettings, masterVolume]);

  useEffect(() => {
    if (!isPlaying) {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
      playStartRef.current = null;
      pausedAtRef.current = timeRef.current;
      return;
    }

    const animate = (now: number) => {
      if (playStartRef.current === null) {
        playStartRef.current = now - pausedAtRef.current * 1000;
      }
      const elapsed = (now - playStartRef.current) / 1000;
      setTime(elapsed);
      rafRef.current = requestAnimationFrame(animate);
    };

    rafRef.current = requestAnimationFrame(animate);
    return () => {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
    };
  }, [isPlaying]);

  const pushToHistory = useCallback((newTracks: Track[]) => {
    setHistory(prev => [...prev, tracks]);
    setRedoStack([]);
    setTracks(newTracks);
  }, [tracks]);

  const undo = useCallback(() => {
    if (history.length === 0) return;
    const previous = history[history.length - 1];
    const newHistory = history.slice(0, -1);
    setRedoStack(prev => [tracks, ...prev]);
    setHistory(newHistory);
    setTracks(previous);
  }, [history, tracks]);

  const redo = useCallback(() => {
    if (redoStack.length === 0) return;
    const next = redoStack[0];
    const newRedoStack = redoStack.slice(1);
    setHistory(prev => [...prev, tracks]);
    setRedoStack(newRedoStack);
    setTracks(next);
  }, [redoStack, tracks]);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const fileList = e.target.files;
    if (!fileList || fileList.length === 0) return;
    const files: File[] = [];
    for (let i = 0; i < fileList.length; i++) {
      const file = fileList.item(i);
      if (file) files.push(file);
    }

    const newTracks: Track[] = files.map((file) => ({
      id: createId(),
      url: URL.createObjectURL(file),
      name: file.name,
      volume: 80,
      isMuted: false,
      fadeIn: 0,
      fadeOut: 0,
      timelineStart: 0,
      startOffset: 0,
      endOffset: 0
    }));

    pushToHistory([...tracks, ...newTracks]);
    e.target.value = '';
  };

  const startRecording = async (source: 'mic' | 'system' = inputSource) => {
    try {
      await Tone.start();
      await initAudioEngine();
      let stream: MediaStream;
      
      if (source === 'system') {
        // Capture system/tab audio
        stream = await (navigator.mediaDevices as any).getDisplayMedia({
          video: { displaySurface: 'browser' }, // Hint for browser tab
          audio: {
            echoCancellation: false,
            noiseSuppression: false,
            autoGainControl: false
          }
        });
        
        // Ensure we have an audio track
        if (stream.getAudioTracks().length === 0) {
          stream.getTracks().forEach(t => t.stop());
          throw new Error("No audio track found in system stream. Make sure to check 'Share audio'.");
        }
        
        // Stop video tracks as we only need audio
        stream.getVideoTracks().forEach(track => track.stop());
      } else {
        // Capture microphone
        stream = await navigator.mediaDevices.getUserMedia({ 
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
          } 
        });
      }

      const recorder = new MediaRecorder(stream);
      recorderRef.current = recorder;
      chunksRef.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
        const url = URL.createObjectURL(blob);
        const trackName = `Recording ${tracks.length + 1}`;
        const newTrack: Track = {
          id: createId(),
          url,
          name: trackName,
          blob,
          volume: 80,
          isMuted: false,
          fadeIn: 0,
          fadeOut: 0,
          timelineStart: 0,
          startOffset: 0,
          endOffset: 0
        };
        pushToHistory([...tracks, newTrack]);
        
        // Add to library
        setLibrary(prev => [{
          id: createId(),
          name: trackName,
          url,
          type: 'recorded',
          timestamp: Date.now()
        }, ...prev]);
        stream.getTracks().forEach(track => track.stop());
        recordingStreamRef.current = null;
        setIsRecording(false);
        setIsRecordingPaused(false);
      };

      recorder.onerror = () => {
        stream.getTracks().forEach(track => track.stop());
        recordingStreamRef.current = null;
        setIsRecording(false);
        setIsRecordingPaused(false);
      };

      recorder.onpause = () => {
        setIsRecordingPaused(true);
      };

      recorder.onresume = () => {
        setIsRecordingPaused(false);
      };

      recordingStreamRef.current = stream;
      recorder.start();
      setIsRecording(true);
      setIsRecordingPaused(false);
      setIsPlaying(true);
      dispatchTransport('play');
    } catch (err) {
      console.error("Failed to start recording", err);
      recordingStreamRef.current?.getTracks().forEach(track => track.stop());
      recordingStreamRef.current = null;
      notify('Recording failed to start. Check browser permissions.', 'error');
    }
  };

  const deleteTrack = (id: string) => {
    setSoloTrackIds(prev => prev.filter(trackId => trackId !== id));
    pushToHistory(tracks.filter(t => t.id !== id));
  };

  const splitTrack = (id: string, time: number, duration: number) => {
    const track = tracks.find(t => t.id === id);
    if (!track) return;
    const regionStart = Math.max(0, track.startOffset);
    const regionEnd = track.endOffset > 0 ? Math.min(track.endOffset, duration) : duration;
    const minLeft = regionStart + MIN_SPLIT_GAP_SECONDS;
    const maxRight = regionEnd - MIN_SPLIT_GAP_SECONDS;
    if (maxRight <= minLeft) return;
    const splitAt = Math.min(Math.max(time, minLeft), maxRight);

    const newTracks = tracks.flatMap(t => {
      if (t.id === id) {
        return [
          { 
            ...t, 
            id: createId(), 
            name: `${t.name} (Part 1)`,
            endOffset: splitAt 
          },
          { 
            ...t, 
            id: createId(), 
            name: `${t.name} (Part 2)`,
            startOffset: splitAt 
          }
        ];
      }
      return [t];
    });
    setSoloTrackIds(prev => prev.filter(trackId => trackId !== id));
    pushToHistory(newTracks);
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
        e.preventDefault();
        undo();
      } else if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || (e.shiftKey && e.key === 'Z'))) {
        e.preventDefault();
        redo();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [undo, redo]);

  const updateTrack = (id: string, updates: Partial<Track>) => {
    pushToHistory(tracks.map(t => t.id === id ? { ...t, ...updates } : t));
  };

  const toggleSoloTrack = (id: string) => {
    setSoloTrackIds(prev => (
      prev.includes(id)
        ? prev.filter(trackId => trackId !== id)
        : [...prev, id]
    ));
  };

  const handleTrackDurationChange = (id: string, duration: number) => {
    setTrackDurations(prev => {
      if (prev[id] === duration) return prev;
      return { ...prev, [id]: duration };
    });
  };

  const decodeTrackBuffer = async (url: string, ctx: BaseAudioContext) => {
    const response = await fetch(url);
    const data = await response.arrayBuffer();
    return await ctx.decodeAudioData(data.slice(0));
  };

  const handleExport = async () => {
    if (isExporting) return;
    if (tracks.length === 0) {
      notify('Add at least one track before exporting.', 'error');
      return;
    }
    setIsExporting(true);

    try {
      const audibleTracks = tracks.filter(track => {
        if (track.isMuted) return false;
        if (soloTrackIds.length === 0) return true;
        return soloTrackIds.includes(track.id);
      });
      if (audibleTracks.length === 0) {
        notify('No audible tracks to export. Check mute/solo state.', 'error');
        return;
      }

      const preloadContext = new AudioContext();
      const prepared = await Promise.all(
        audibleTracks.map(async track => {
          const buffer = await decodeTrackBuffer(track.url, preloadContext);
          const regionStart = clamp(track.startOffset, 0, buffer.duration);
          const rawEnd = track.endOffset > 0 ? track.endOffset : buffer.duration;
          const regionEnd = clamp(rawEnd, regionStart, buffer.duration);
          const regionDuration = regionEnd - regionStart;
          if (regionDuration <= 0) return null;

          return {
            track,
            buffer,
            regionStart,
            regionDuration
          };
        })
      );
      await preloadContext.close();

      const validTracks = prepared.filter((item): item is NonNullable<typeof item> => Boolean(item));
      if (validTracks.length === 0) {
        notify('Tracks could not be prepared for export.', 'error');
        return;
      }

      const renderDuration = validTracks.reduce((max, item) => Math.max(max, item.track.timelineStart + item.regionDuration), 0);
      const sampleRate = 44100;
      const offline = new OfflineAudioContext(2, Math.ceil(renderDuration * sampleRate), sampleRate);

      const masterInput = offline.createGain();
      let fxTail: AudioNode = masterInput;

      const compressionAmount = fxSettings.compression.value / 100;
      if (compressionAmount > 0) {
        const compressor = offline.createDynamicsCompressor();
        compressor.threshold.value = -10 - compressionAmount * 24;
        compressor.ratio.value = 2 + compressionAmount * 10;
        compressor.attack.value = 0.003;
        compressor.release.value = 0.2;
        fxTail.connect(compressor);
        fxTail = compressor;
      }

      const distortionAmount = fxSettings.distortion.value / 100;
      if (distortionAmount > 0) {
        const dryGain = offline.createGain();
        const wetGain = offline.createGain();
        const sum = offline.createGain();
        const shaper = offline.createWaveShaper();
        shaper.curve = createDistortionCurve(30 + distortionAmount * 380);
        shaper.oversample = '4x';
        dryGain.gain.value = 1 - distortionAmount * 0.8;
        wetGain.gain.value = distortionAmount * 0.8;

        fxTail.connect(dryGain);
        dryGain.connect(sum);
        fxTail.connect(shaper);
        shaper.connect(wetGain);
        wetGain.connect(sum);
        fxTail = sum;
      }

      const delayAmount = fxSettings.delay.value / 100;
      if (delayAmount > 0) {
        const dryGain = offline.createGain();
        const wetGain = offline.createGain();
        const sum = offline.createGain();
        const delay = offline.createDelay(2);
        const feedback = offline.createGain();
        const delayTimeByMode = {
          Digital: 0.22,
          Tape: 0.34,
          'Ping-Pong': 0.4
        } as const;
        delay.delayTime.value = delayTimeByMode[fxSettings.delay.mode as keyof typeof delayTimeByMode] ?? 0.25;
        feedback.gain.value = 0.2 + delayAmount * 0.45;
        dryGain.gain.value = 1 - delayAmount * 0.6;
        wetGain.gain.value = delayAmount * 0.6;

        fxTail.connect(dryGain);
        dryGain.connect(sum);
        fxTail.connect(delay);
        delay.connect(feedback);
        feedback.connect(delay);
        delay.connect(wetGain);
        wetGain.connect(sum);
        fxTail = sum;
      }

      const reverbAmount = fxSettings.reverb.value / 100;
      if (reverbAmount > 0) {
        const dryGain = offline.createGain();
        const wetGain = offline.createGain();
        const sum = offline.createGain();
        const convolver = offline.createConvolver();
        const reverbSecondsByMode = {
          Room: 0.8,
          Hall: 1.8,
          Plate: 1.2
        } as const;
        const seconds = reverbSecondsByMode[fxSettings.reverb.mode as keyof typeof reverbSecondsByMode] ?? 1.2;
        convolver.buffer = createImpulseResponse(offline, seconds, 2 + reverbAmount * 4);
        dryGain.gain.value = 1 - reverbAmount * 0.7;
        wetGain.gain.value = reverbAmount * 0.7;

        fxTail.connect(dryGain);
        dryGain.connect(sum);
        fxTail.connect(convolver);
        convolver.connect(wetGain);
        wetGain.connect(sum);
        fxTail = sum;
      }

      const masterGain = offline.createGain();
      masterGain.gain.value = masterVolume / 100;
      fxTail.connect(masterGain);
      masterGain.connect(offline.destination);

      validTracks.forEach(({ track, buffer, regionStart, regionDuration }) => {
        const source = offline.createBufferSource();
        source.buffer = buffer;
        const gain = offline.createGain();

        const trackGain = clamp(track.volume / 100, 0, 1);
        const fadeIn = Math.min(track.fadeIn, regionDuration);
        const fadeOut = Math.min(track.fadeOut, regionDuration);
        const fadeOutStart = Math.max(0, regionDuration - fadeOut);

        gain.gain.setValueAtTime(trackGain, 0);
        if (fadeIn > 0) {
          gain.gain.setValueAtTime(0, 0);
          gain.gain.linearRampToValueAtTime(trackGain, fadeIn);
        }
        if (fadeOut > 0) {
          gain.gain.setValueAtTime(trackGain, fadeOutStart);
          gain.gain.linearRampToValueAtTime(0, regionDuration);
        }

        source.connect(gain);
        gain.connect(masterInput);
        source.start(track.timelineStart, regionStart, regionDuration);
      });

      const rendered = await offline.startRendering();
      const exportBlob = encodeWav(rendered);
      const timestamp = new Date();
      const fileName = `mixdown-${timestamp.toISOString().replace(/[:.]/g, '-')}.wav`;
      const url = URL.createObjectURL(exportBlob);

      const exportItem: LibraryItem = {
        id: createId(),
        name: fileName,
        url,
        type: 'exported',
        timestamp: Date.now()
      };

      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);

      setLibrary(prev => [exportItem, ...prev]);
      setIsLibraryOpen(true);
      setShowExportDonateMessage(true);
      notify(`Exported ${fileName}`, 'info');
    } catch (error) {
      console.error('Export failed', error);
      notify('Export failed. Try again with a shorter session.', 'error');
    } finally {
      setIsExporting(false);
    }
  };

  useEffect(() => {
    if (!showExportDonateMessage) return;
    const timeout = window.setTimeout(() => setShowExportDonateMessage(false), 9000);
    return () => window.clearTimeout(timeout);
  }, [showExportDonateMessage]);

  const handleAddToTimeline = (item: LibraryItem) => {
    const newTrack: Track = {
      id: createId(),
      url: item.url,
      name: item.name,
      volume: 80,
      isMuted: false,
      fadeIn: 0,
      fadeOut: 0,
      timelineStart: timelineDuration,
      startOffset: 0,
      endOffset: 0
    };
    pushToHistory([...tracks, newTrack]);
  };

  const handleDeleteLibraryItem = (id: string) => {
    setLibrary(prev => prev.filter(item => item.id !== id));
  };

  const dispatchTransport = (command: TransportCommand) => {
    setTransportCommand(command);
    setTransportSignal(prev => prev + 1);
  };

  const handlePlayPause = async () => {
    if (isRecording && recorderRef.current) {
      const state = recorderRef.current.state;
      if (state === 'recording') {
        recorderRef.current.pause();
        setIsPlaying(false);
        dispatchTransport('pause');
        return;
      }
      if (state === 'paused') {
        recorderRef.current.resume();
        setIsPlaying(true);
        dispatchTransport('play');
        return;
      }
    }

    if (isPlaying) {
      setIsPlaying(false);
      dispatchTransport('pause');
      return;
    }
    await Tone.start();
    await initAudioEngine();
    setIsPlaying(true);
    dispatchTransport('play');
  };

  const handleStop = () => {
    if (isRecording && recorderRef.current) {
      recorderRef.current.stop();
    }
    recordingStreamRef.current?.getTracks().forEach(track => track.stop());
    recordingStreamRef.current = null;
    setIsRecording(false);
    setIsRecordingPaused(false);
    setIsPlaying(false);
    setTime(0);
    pausedAtRef.current = 0;
    playStartRef.current = null;
    dispatchTransport('stop');
  };

  const handleTimelineWheel = (e: React.WheelEvent<HTMLDivElement>) => {
    if (!(e.ctrlKey || e.metaKey)) return;
    e.preventDefault();
    const direction = e.deltaY < 0 ? 1 : -1;
    setTimelineZoom(prev => {
      const next = Math.min(3, Math.max(1, prev + direction * 0.1));
      return Math.round(next * 10) / 10;
    });
  };

  const handleRecordClick = () => {
    if (isRecording) {
      handleStop();
      return;
    }
    startRecording(inputSource);
  };

  const timelineDuration = tracks.reduce((max, track) => {
    const trackDuration = trackDurations[track.id] ?? 0;
    if (trackDuration <= 0) return max;
    const regionStart = clamp(track.startOffset, 0, trackDuration);
    const rawEnd = track.endOffset > 0 ? track.endOffset : trackDuration;
    const regionEnd = clamp(rawEnd, regionStart, trackDuration);
    return Math.max(max, Math.max(0, track.timelineStart) + (regionEnd - regionStart));
  }, 0);

  const handleSeek = (nextTime: number) => {
    const next = clamp(nextTime, 0, timelineDuration || 0);
    setTime(next);
    timeRef.current = next;
    pausedAtRef.current = next;
    playStartRef.current = null;
    dispatchTransport(isPlaying ? 'play' : 'seek');
  };

  const handleShare = async () => {
    try {
      const payload = {
        title: 'DAWK Mix Session',
        text: 'Check out my DAWK session.',
        url: window.location.href
      };
      if (navigator.share) {
        await navigator.share(payload);
        return;
      }
      if (navigator.clipboard) {
        await navigator.clipboard.writeText(window.location.href);
      }
    } catch (error) {
      console.error('Share failed', error);
      notify('Share failed on this device/browser.', 'error');
    }
  };

  const handleBroadcast = async () => {
    if (isRecording) return;
    setInputSource('system');
    await startRecording('system');
  };

  useEffect(() => {
    return () => {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
      }
      trackNodesRef.current.forEach(node => {
        node.source.disconnect();
        node.gain.disconnect();
      });
      trackNodesRef.current.clear();
      if (audioContextRef.current) {
        audioContextRef.current.close();
        audioContextRef.current = null;
      }
      setLiveAnalyserNode(null);
      const remainingUrls = new Set([
        ...previousTrackUrlsRef.current,
        ...previousLibraryUrlsRef.current
      ]);
      remainingUrls.forEach(url => {
        if (isBlobUrl(url)) URL.revokeObjectURL(url);
      });
      recordingStreamRef.current?.getTracks().forEach(track => track.stop());
      stopMetronomeScheduler();
    };
  }, [stopMetronomeScheduler]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    const ms = Math.floor((seconds % 1) * 100);
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}.${ms.toString().padStart(2, '0')}`;
  };

  return (
    <div className="flex flex-col h-screen w-full overflow-hidden bg-[#0a0a0c]">
      <AnimatePresence>
        {showExportDonateMessage && (
          <motion.div
            initial={{ opacity: 0, y: 16, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 16, scale: 0.98 }}
            className="fixed right-4 bottom-4 z-[120] w-[22rem] max-w-[calc(100vw-2rem)] rounded-xl border border-emerald-500/30 bg-[#101419]/95 backdrop-blur-md p-4 shadow-2xl"
          >
            <p className="text-sm font-semibold text-emerald-300">Your file is ready.</p>
            <p className="mt-2 text-xs leading-relaxed text-white/85">
              This tool runs free because users support its development. If it saved you time, consider contributing.
            </p>
            <a
              href="https://donate.stripe.com/4gMdR25le5GXenHbrT5Ne00"
              target="_blank"
              rel="noreferrer"
              className="mt-3 inline-block text-xs font-semibold text-emerald-300 hover:text-emerald-200 underline underline-offset-4"
            >
              Donate
            </a>
          </motion.div>
        )}
      </AnimatePresence>
      <AnimatePresence>
        {statusNotice && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            className={cn(
              "fixed right-4 top-4 z-[130] max-w-[22rem] rounded-lg border px-4 py-3 text-sm shadow-xl backdrop-blur-md",
              statusNotice.type === 'error'
                ? "border-red-500/40 bg-[#2a1116]/90 text-red-200"
                : "border-emerald-500/40 bg-[#102018]/90 text-emerald-200"
            )}
          >
            {statusNotice.message}
          </motion.div>
        )}
      </AnimatePresence>
      {/* Header / Brand */}
      <header className="flex-shrink-0 flex items-center justify-between px-4 md:px-8 py-2 md:py-3 border-b border-white/5 bg-black/20 z-30">
        <div className="flex items-center gap-3 md:gap-4">
          <div className="p-1.5 md:p-2 bg-emerald-500/10 rounded-xl border border-emerald-500/20 shadow-lg shadow-emerald-500/5">
            <Activity className="text-emerald-400" size={20} />
          </div>
          <div>
            <h1 className="text-lg md:text-xl font-bold tracking-tighter text-white/90 leading-none">
              DAW<span className="text-emerald-500">K</span>
            </h1>
            <p className="hidden sm:block text-[9px] md:text-[10px] uppercase tracking-[0.3em] text-white/30 font-bold mt-1">
              Portable Audio Workstation v1.0
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 md:gap-4">
          <div className="flex items-center gap-2 md:gap-3 mr-4 md:mr-6">
            <TechButton 
              icon={Undo2} 
              size="md" 
              variant="ghost" 
              disabled={history.length === 0}
              onClick={undo}
              className={cn(history.length > 0 ? "text-emerald-400" : "text-white/20")}
              title="Undo (Ctrl+Z)"
            />
            <TechButton 
              icon={Redo2} 
              size="md" 
              variant="ghost" 
              disabled={redoStack.length === 0}
              onClick={redo}
              className={cn(redoStack.length > 0 ? "text-emerald-400" : "text-white/20")}
              title="Redo (Ctrl+Y)"
            />
          </div>
          <div className="hidden md:flex items-center gap-2 px-4 py-2 rounded-full bg-white/5 border border-white/10 shadow-inner">
            <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-[11px] font-mono text-emerald-300/90">ENGINE READY</span>
          </div>
          <TechButton
            icon={Settings2}
            size="sm"
            variant="ghost"
            onClick={() => setIsFxPanelOpen(prev => !prev)}
            className={cn(isFxPanelOpen && "text-emerald-400")}
          />
        </div>
      </header>

      <main className="flex-1 flex flex-col md:flex-row overflow-hidden min-h-0 w-full relative">
        {/* Sidebar / Tools - Horizontal on mobile, vertical on desktop */}
        <aside className="flex-shrink-0 w-full md:w-14 lg:w-16 border-b md:border-b-0 md:border-r border-white/5 flex flex-row md:flex-col items-center justify-center md:justify-start py-2 md:py-6 gap-1.5 md:gap-4 lg:gap-5 bg-black/10 z-20">
          <div className="relative">
            <Tooltip text="Add Track" position="right">
              <TechButton 
                icon={Plus} 
                variant="primary" 
                size="md" 
                iconSize={28}
                onClick={() => setIsImportMenuOpen(!isImportMenuOpen)}
                className={cn(
                  "size-10 p-0 relative shadow-xl shadow-emerald-500/20 hover:scale-105 transition-transform",
                  isImportMenuOpen && "scale-110 bg-emerald-500 text-black border-emerald-500"
                )}
              />
            </Tooltip>
            
            <AnimatePresence>
              {isImportMenuOpen && (
                <motion.div
                  initial={{ opacity: 0, x: 20, scale: 0.9 }}
                  animate={{ opacity: 1, x: 0, scale: 1 }}
                  exit={{ opacity: 0, x: 20, scale: 0.9 }}
                  className="absolute left-full ml-4 top-0 w-48 bg-[#16161d] border border-white/10 rounded-xl shadow-2xl z-[100] overflow-hidden"
                >
                  <div className="p-2 flex flex-col gap-1">
                    <button 
                      onClick={() => {
                        setIsImportMenuOpen(false);
                        setInputSource('mic');
                        void startRecording('mic');
                      }}
                      className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-white/5 text-left transition-colors group"
                    >
                      <Mic size={16} className="text-emerald-400" />
                      <div>
                        <p className="text-xs font-bold text-white uppercase tracking-wider">Microphone</p>
                        <p className="text-[11px] text-white/65">Record new take</p>
                      </div>
                    </button>
                    <label className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-white/5 cursor-pointer transition-colors group">
                      <Music size={16} className="text-blue-400" />
                      <div>
                        <p className="text-xs font-bold text-white uppercase tracking-wider">Import Audio</p>
                        <p className="text-[11px] text-white/65">From local files</p>
                      </div>
                      <input type="file" className="hidden" onChange={(e) => {
                        setIsImportMenuOpen(false);
                        handleFileUpload(e);
                      }} accept="audio/*" multiple />
                    </label>
                    <button 
                      onClick={() => {
                        setIsImportMenuOpen(false);
                        setInputSource('system');
                        void startRecording('system');
                      }}
                      className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-white/5 text-left transition-colors group"
                    >
                      <Radio size={16} className="text-purple-400" />
                      <div>
                        <p className="text-xs font-bold text-white uppercase tracking-wider">Link Device</p>
                        <p className="text-[11px] text-white/65">System/Tab audio</p>
                      </div>
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <Tooltip text="Tracks" position="right">
            <TechButton
              icon={Layers}
              variant="ghost"
              size="md"
              iconSize={28}
              onClick={() => setIsMixerOpen(prev => !prev)}
              className={cn("hidden md:flex size-10 p-0 hover:text-emerald-400 transition-colors", isMixerOpen && "text-emerald-400")}
            />
          </Tooltip>
          <Tooltip text="Library" position="right">
            <TechButton 
              icon={Library} 
              variant="ghost" 
              size="md" 
              iconSize={28}
              active={isLibraryOpen}
              onClick={() => setIsLibraryOpen(!isLibraryOpen)}
              className={cn("size-10 p-0 hover:text-emerald-400 transition-colors", isLibraryOpen && "text-emerald-400")} 
            />
          </Tooltip>
          <Tooltip text="FX Rack" position="right">
            <TechButton 
              icon={Zap} 
              variant="ghost" 
              size="md"
              iconSize={28}
              active={isFxPanelOpen}
              onClick={() => setIsFxPanelOpen(!isFxPanelOpen)} 
              className={cn("size-10 p-0 hover:text-emerald-400 transition-colors", isFxPanelOpen && "text-emerald-400")}
            />
          </Tooltip>
          <Tooltip text="Mixer" position="right">
            <TechButton 
              icon={Waves} 
              variant="ghost" 
              size="md" 
              iconSize={28}
              active={isMixerOpen}
              onClick={() => setIsMixerOpen(!isMixerOpen)}
              className={cn("hidden sm:flex size-10 p-0 hover:text-emerald-400 transition-colors", isMixerOpen && "text-emerald-400")} 
            />
          </Tooltip>
          <Tooltip text="Broadcast" position="right">
            <TechButton
              icon={Radio}
              variant="ghost"
              size="md"
              iconSize={28}
              onClick={() => void handleBroadcast()}
              className="hidden sm:flex size-10 p-0 hover:text-emerald-400 transition-colors"
            />
          </Tooltip>
          <div className="md:mt-auto flex flex-row md:flex-col gap-2 md:gap-4">
            <Tooltip text="Share" position="right">
              <TechButton
                icon={Share2}
                variant="ghost"
                size="md"
                iconSize={28}
                onClick={() => void handleShare()}
                className="hidden sm:flex size-10 p-0 hover:text-emerald-400 transition-colors"
              />
            </Tooltip>
            <Tooltip text="Export" position="right">
              <TechButton 
                icon={Download} 
                variant="ghost" 
                size="md" 
                iconSize={28}
                onClick={() => void handleExport()}
                disabled={isExporting}
                className="size-10 p-0 hover:text-emerald-400 transition-colors" 
              />
            </Tooltip>
          </div>
        </aside>

        {/* Main Workspace */}
        <div className="flex-1 flex flex-col overflow-hidden bg-[#0d0d12] relative min-w-0 z-10">
          {/* FX Panel Overlay */}
          <AnimatePresence>
            {isFxPanelOpen && (
              <motion.div
                initial={{ x: '100%' }}
                animate={{ x: 0 }}
                exit={{ x: '100%' }}
                transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                className="absolute right-0 top-0 bottom-0 w-full md:w-[22rem] z-50 panel-glass border-l border-white/10 p-6 flex flex-col gap-6"
              >
                <div className="flex items-center justify-between">
                  <h2 className="text-sm font-bold uppercase tracking-widest text-emerald-400">Master FX Rack</h2>
                  <TechButton icon={Plus} size="sm" variant="ghost" onClick={() => setIsFxPanelOpen(false)} className="rotate-45" />
                </div>

                <div className="flex-1 overflow-y-auto pr-2 space-y-8 custom-scrollbar">
                  {(Object.entries(fxSettings) as [keyof typeof FX_MODES, { value: number, mode: string }][]).map(([fxKey, settings]) => (
                    <div key={fxKey} className="space-y-3">
                      <MixerSlider 
                        label={fxKey}
                        value={settings.value}
                        onChange={(v) => setFxSettings(prev => ({ 
                          ...prev, 
                          [fxKey]: { ...prev[fxKey], value: v } 
                        }))}
                      />
                      <div className="flex gap-1">
                        {FX_MODES[fxKey].map((mode) => (
                          <button
                            key={mode}
                            onClick={() => setFxSettings(prev => ({
                              ...prev,
                              [fxKey]: { ...prev[fxKey], mode }
                            }))}
                            className={cn(
                              "flex-1 py-1 text-[8px] font-bold uppercase tracking-tighter border rounded transition-all",
                              settings.mode === mode 
                                ? "bg-emerald-500/20 border-emerald-500/40 text-emerald-400" 
                                : "bg-white/5 border-white/10 text-white/30 hover:text-white/60"
                            )}
                          >
                            {mode}
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>

                <div className="mt-auto p-4 rounded-lg bg-emerald-500/5 border border-emerald-500/10">
                  <p className="text-xs text-emerald-300/80 leading-relaxed">
                    FX processing is applied to the master output bus. Real-time rendering enabled.
                  </p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Library Panel Overlay */}
          <LibraryPanel 
            isOpen={isLibraryOpen}
            onClose={() => setIsLibraryOpen(false)}
            items={library}
            onDeleteItem={handleDeleteLibraryItem}
            onAddToTimeline={handleAddToTimeline}
          />

          {/* Mixer Panel Overlay */}
          <MixerPanel 
            isOpen={isMixerOpen}
            onClose={() => setIsMixerOpen(false)}
            tracks={tracks}
            onUpdateTrack={updateTrack}
            soloTrackIds={soloTrackIds}
            onToggleSolo={toggleSoloTrack}
            masterVolume={masterVolume}
            onMasterVolumeChange={setMasterVolume}
          />

          {/* Timeline Header */}
          <div className="flex-shrink-0 h-10 md:h-12 border-b border-white/5 flex items-center px-4 md:px-6 gap-2 md:gap-8 bg-black/20">
            <div className="flex-1 min-w-0 flex items-center justify-center">
              <MasterVisualizer analyserNode={liveAnalyserNode} />
            </div>
            <div className="hidden sm:flex items-center gap-2 flex-shrink-0">
              <Clock size={12} className="text-white/30" />
              <span className="text-xs font-mono text-white/65">TIMELINE</span>
              <span className="text-[10px] font-mono text-emerald-300/70">{timelineZoom.toFixed(1)}x</span>
            </div>
            <div className="hidden lg:block flex-1 h-px bg-white/5" />
            <div className="flex items-center gap-2 md:gap-4 flex-shrink-0" />
          </div>

          {/* Tracks Area */}
          <div
            className="flex-1 overflow-auto p-4 md:p-6 space-y-2 custom-scrollbar relative"
            onWheel={handleTimelineWheel}
          >
            {/* Timeline Grid Background */}
            <div className="absolute inset-0 pointer-events-none opacity-[0.03]" 
                 style={{ 
                   backgroundImage: 'linear-gradient(to right, white 1px, transparent 1px), linear-gradient(to bottom, white 1px, transparent 1px)',
                   backgroundSize: `${6.25 * timelineZoom}rem 2.5rem` 
                 }} 
            />
            
            <AnimatePresence mode="popLayout">
              {tracks.length === 0 ? (
                <motion.div 
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="h-full flex flex-col items-center justify-center text-center space-y-4 opacity-20"
                >
                  <Music size={64} />
                  <div>
                    <p className="text-lg font-medium">No tracks yet</p>
                    <p className="text-sm">Import an audio file or start recording</p>
                  </div>
                </motion.div>
              ) : (
                tracks.map((track) => (
                  <motion.div
                    key={track.id}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    layout
                  >
                    <TrackItem 
                      id={track.id}
                      url={track.url}
                      name={track.name}
                      volume={track.volume}
                      isMuted={track.isMuted}
                      fadeIn={track.fadeIn}
                      fadeOut={track.fadeOut}
                      timelineStart={track.timelineStart}
                      startOffset={track.startOffset}
                      endOffset={track.endOffset}
                      masterVolume={masterVolume}
                      playheadTime={time}
                      zoom={timelineZoom}
                      transportAction={transportCommand}
                      transportSignal={transportSignal}
                      isSoloActive={soloTrackIds.length > 0}
                      isSoloed={soloTrackIds.includes(track.id)}
                      onUpdate={(updates) => updateTrack(track.id, updates)}
                      onDelete={deleteTrack}
                      onSplit={splitTrack}
                      onDurationChange={handleTrackDurationChange}
                      onMediaElementReady={registerTrackMediaElement}
                      onMediaElementDetached={unregisterTrackMediaElement}
                    />
                  </motion.div>
                ))
              )}
            </AnimatePresence>
          </div>

          {/* Transport Bar */}
          <footer className="flex-shrink-0 h-auto md:h-24 border-t border-white/10 bg-[#16161d] px-4 md:px-8 py-3 md:py-0 flex flex-col md:flex-row items-center justify-between gap-4 md:gap-0 shadow-[0_-10px_40px_rgba(0,0,0,0.5)] z-30">
            <div className="flex items-center justify-between w-full md:w-auto gap-2 md:gap-6">
              <LCDDisplay label="Timecode" value={formatTime(time)} className="scale-90 md:scale-100 origin-left" />
              <div className="hidden md:block h-10 w-px bg-white/5" />
              <div className="flex items-center gap-2 md:gap-4 p-1 rounded-full bg-black/40 border border-white/5 shadow-2xl">
                <Tooltip text="Play / Pause">
                  <TechButton 
                    icon={isPlaying ? Pause : Play} 
                    variant={isPlaying ? "primary" : "secondary"}
                    size="lg"
                    className={cn(
                      "rounded-full transition-all duration-300",
                      isPlaying && "shadow-[0_0_20px_rgba(16,185,129,0.3)]"
                    )}
                    onClick={handlePlayPause}
                  />
                </Tooltip>
                <Tooltip text="Stop">
                  <TechButton 
                    icon={Square} 
                    size="md"
                    className="rounded-full hover:bg-white/10"
                    onClick={handleStop}
                  />
                </Tooltip>
                <Tooltip text="Record">
                  <TechButton 
                    icon={Mic} 
                    variant={isRecording ? "danger" : "secondary"}
                    size="lg"
                    active={isRecording}
                    className={cn(
                      "rounded-full transition-all duration-300",
                      isRecording && "text-red-300 shadow-[0_0_20px_rgba(239,68,68,0.3)]",
                      isRecording && !isRecordingPaused && "animate-pulse"
                    )}
                    onClick={handleRecordClick}
                  />
                </Tooltip>
              </div>
              
              <div className="hidden lg:flex items-center gap-2 px-3 py-1.5 rounded-md bg-black/40 border border-white/5 group/input">
                <span className="text-[11px] font-bold text-white/55 uppercase tracking-widest">Input</span>
                <select 
                  value={inputSource}
                  onChange={(e) => setInputSource(e.target.value as 'mic' | 'system')}
                  className="bg-transparent text-xs font-mono text-emerald-300 focus:outline-none cursor-pointer"
                >
                  <option value="mic" className="bg-[#16161d]">MICROPHONE</option>
                  <option value="system" className="bg-[#16161d]">VIRTUAL (SYSTEM)</option>
                </select>
                
                {inputSource === 'system' && (
                  <div className="relative">
                    <Settings2 size={12} className="text-emerald-500/50 animate-pulse" />
                    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-48 p-2 bg-black border border-white/10 rounded text-[10px] text-white/85 leading-tight opacity-0 group-hover/input:opacity-100 transition-opacity pointer-events-none z-50">
                      Select a tab or window and ensure <span className="text-emerald-400">"Share audio"</span> is checked to record from other apps.
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="hidden md:block md:w-80 lg:w-[28rem]">
              <input
                id="seek-desktop"
                type="range"
                min={0}
                max={Math.max(1, Math.round(timelineDuration * 1000))}
                value={Math.min(Math.round(time * 1000), Math.max(1, Math.round(timelineDuration * 1000)))}
                onChange={(e) => handleSeek(Number(e.target.value) / 1000)}
                className="w-full h-1.5 bg-white/10 rounded-full appearance-none"
              />
            </div>

            <div className="w-full md:hidden">
              <input
                id="seek"
                type="range"
                min={0}
                max={Math.max(1, Math.round(timelineDuration * 1000))}
                value={Math.min(Math.round(time * 1000), Math.max(1, Math.round(timelineDuration * 1000)))}
                onChange={(e) => handleSeek(Number(e.target.value) / 1000)}
                className="w-full h-1 bg-white/10 rounded-full appearance-none"
              />
            </div>

            <div className="flex items-center justify-between w-full md:w-auto gap-4 md:gap-8">
              <BPMControl 
                value={bpm} 
                onChange={setBpm} 
                metronomeVolume={metronomeVolume}
                onMetronomeVolumeChange={setMetronomeVolume}
                metronomeSound={metronomeSound}
                onMetronomeSoundChange={setMetronomeSound}
                isEnabled={isMetronomeEnabled}
                onToggle={() => setIsMetronomeEnabled(!isMetronomeEnabled)}
                isMuted={isMetronomeMuted}
                onToggleMute={() => setIsMetronomeMuted(!isMetronomeMuted)}
                timeSignature={timeSignature}
                onTimeSignatureChange={setTimeSignature}
              />

              <MixerSlider 
                label="Master Out"
                value={masterVolume}
                onChange={setMasterVolume}
                className="w-full md:w-48"
              />

              <div className="hidden sm:flex flex-col items-end">
                <span className="text-[10px] md:text-[11px] font-bold text-white/45 uppercase tracking-tighter">Powered by</span>
                <a
                  href="https://ironsignalworks.com"
                  target="_blank"
                  rel="noreferrer"
                  className="text-xs font-bold text-white/70 tracking-widest hover:text-emerald-300 transition-colors"
                >
                  IRON SIGNAL WORKS
                </a>
              </div>
            </div>
          </footer>
        </div>
      </main>
    </div>
  );
}
