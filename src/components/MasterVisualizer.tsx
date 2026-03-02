import React, { useEffect, useRef } from 'react';
import { Activity } from 'lucide-react';

interface MasterVisualizerProps {
  analyserNode: AnalyserNode | null;
}

export function MasterVisualizer({ analyserNode }: MasterVisualizerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !analyserNode) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    analyserNode.fftSize = 256;
    analyserNode.smoothingTimeConstant = 0.8;
    const buffer = new Uint8Array(analyserNode.frequencyBinCount);

    let animationId: number;

    const render = () => {
      animationId = requestAnimationFrame(render);
      analyserNode.getByteFrequencyData(buffer);
      const width = canvas.width;
      const height = canvas.height;

      ctx.clearRect(0, 0, width, height);
      const barWidth = Math.max(1, (width / buffer.length) * 1.8);
      let x = 0;

      for (let i = 0; i < buffer.length; i++) {
        const percent = Math.max(0, buffer[i] / 255);
        const barHeight = Math.max(1, height * percent * 0.9);

        const gradient = ctx.createLinearGradient(0, height, 0, height - barHeight);
        gradient.addColorStop(0, 'rgba(16, 185, 129, 0.2)');
        gradient.addColorStop(0.5, 'rgba(52, 211, 153, 0.6)');
        gradient.addColorStop(1, 'rgba(52, 211, 153, 1)');

        ctx.fillStyle = gradient;
        const radius = 1;
        ctx.beginPath();
        ctx.roundRect(x, height - barHeight, barWidth - 2, barHeight, radius);
        ctx.fill();

        x += barWidth;
      }
    };

    render();

    return () => {
      cancelAnimationFrame(animationId);
    };
  }, [analyserNode]);

  return (
    <div className="flex-1 h-full flex items-center justify-center px-4 overflow-hidden pointer-events-none max-w-md">
      <div className="flex flex-col items-center w-full">
        <div className="flex items-center gap-2 mb-1">
          <Activity size={10} className="text-emerald-500/50" />
          <span className="text-[8px] font-bold text-white/20 uppercase tracking-widest">Master Output</span>
        </div>
        <canvas 
          ref={canvasRef} 
          width={800} 
          height={60} 
          className="w-full h-6 opacity-60"
        />
      </div>
    </div>
  );
}
