"use client";

import { useEffect, useMemo, useRef, useState } from "react";

const STORY_DURATION = 30000;

type Phase =
  | "idle"
  | "intro"
  | "hint"
  | "manifest"
  | "escalate"
  | "scare"
  | "aftermath";

type OverlayDescriptor = {
  id: string;
  text: string;
  className: string;
  handwritten?: boolean;
  glitch?: boolean;
};

const PHASE_SEQUENCE: { at: number; phase: Phase }[] = [
  { at: 0, phase: "intro" },
  { at: 6800, phase: "hint" },
  { at: 13600, phase: "manifest" },
  { at: 19800, phase: "escalate" },
  { at: 24400, phase: "scare" },
  { at: STORY_DURATION, phase: "aftermath" },
];

const OVERLAYS: Record<Phase, OverlayDescriptor[]> = {
  idle: [],
  intro: [
    {
      id: "timecode",
      text: "02:03 AM – Nursery Camera",
      className:
        "absolute top-6 left-6 text-[0.65rem] uppercase tracking-[0.35em] text-white/50",
    },
    {
      id: "line1",
      text: "It hasn’t rocked since the night she vanished.",
      className:
        "absolute bottom-28 left-7 max-w-[75%] text-lg text-white/75 handwritten flicker",
      handwritten: true,
    },
  ],
  hint: [
    {
      id: "line2",
      text: "the drawing keeps changing.",
      className:
        "absolute top-16 right-6 text-base text-right text-white/70 handwritten",
      handwritten: true,
    },
    {
      id: "line3",
      text: "she added pupils tonight.",
      className:
        "absolute top-28 right-6 text-[1.35rem] text-right text-white/75 handwritten glitch",
      handwritten: true,
      glitch: true,
    },
  ],
  manifest: [
    {
      id: "line4",
      text: "Do not blink.",
      className:
        "absolute bottom-32 left-1/2 -translate-x-1/2 text-sm uppercase tracking-[0.4em] text-white/70",
    },
    {
      id: "line5",
      text: "she's in the doorway.",
      className:
        "absolute bottom-20 left-10 text-2xl text-white/80 handwritten glitch",
      handwritten: true,
      glitch: true,
    },
  ],
  escalate: [
    {
      id: "line6",
      text: "RUN.",
      className:
        "absolute top-1/3 left-1/2 -translate-x-1/2 text-4xl font-semibold text-[var(--accent-red)] glitch",
      glitch: true,
    },
    {
      id: "line7",
      text: "she noticed us.",
      className:
        "absolute bottom-16 right-8 text-lg text-right text-white/65 handwritten flicker",
      handwritten: true,
    },
  ],
  scare: [
    {
      id: "line8",
      text: "DON'T TURN AROUND",
      className:
        "absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-3xl font-semibold text-[var(--accent-red)] final-frame glitch",
      glitch: true,
    },
  ],
  aftermath: [
    {
      id: "line9",
      text: "SHE'S BEHIND YOU.",
      className:
        "absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 final-frame text-center",
      glitch: true,
    },
    {
      id: "line10",
      text: "Replay",
      className:
        "absolute bottom-10 left-1/2 -translate-x-1/2 text-xs uppercase tracking-[0.4em] text-white/60",
    },
  ],
};

const JUMP_CUT_MOMENTS = [6200, 12800, 20750, 24400];

function createNoiseBuffer(ctx: AudioContext, seconds = 2) {
  const buffer = ctx.createBuffer(1, ctx.sampleRate * seconds, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < data.length; i++) {
    data[i] = (Math.random() * 2 - 1) * (1 - i / data.length);
  }
  return buffer;
}

function createDistortionCurve(amount: number, ctx: AudioContext) {
  const samples = ctx.sampleRate;
  const curve = new Float32Array(samples);
  const deg = Math.PI / 180;
  for (let i = 0; i < samples; i++) {
    const x = (i * 2) / samples - 1;
    curve[i] =
      ((3 + amount) * x * 20 * deg) / (Math.PI + amount * Math.abs(x) || 1);
  }
  return curve;
}

export default function Home() {
  const frameRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const startTimeRef = useRef<number>(0);
  const animationRef = useRef<number | null>(null);
  const phaseRef = useRef<Phase>("idle");
  const [phase, setPhase] = useState<Phase>("idle");
  const [started, setStarted] = useState(false);
  const [runKey, setRunKey] = useState(0);
  const [progress, setProgress] = useState(0);
  const [isComplete, setIsComplete] = useState(false);
  const timeoutsRef = useRef<number[]>([]);
  const audioStateRef = useRef<{
    context: AudioContext;
    stop: () => void;
  } | null>(null);
  const lastProgressUpdate = useRef<number>(0);

  useEffect(() => {
    phaseRef.current = phase;
  }, [phase]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const frame = frameRef.current;
    if (!canvas || !frame) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const resize = () => {
      const rect = frame.getBoundingClientRect();
      const width = rect.width;
      const height = (width / 9) * 16;
      const scale = window.devicePixelRatio || 1;
      canvas.width = width * scale;
      canvas.height = height * scale;
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      ctx.setTransform(scale, 0, 0, scale, 0, 0);
    };

    resize();

    const observer = new ResizeObserver(resize);
    observer.observe(frame);

    return () => {
      observer.disconnect();
    };
  }, []);

  useEffect(() => {
    if (runKey === 0) return;

    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;

    startTimeRef.current = performance.now();

    const draw = (now: number) => {
      const elapsed = now - startTimeRef.current;
      const clamped = Math.min(elapsed, STORY_DURATION);
      const progressValue = clamped / STORY_DURATION;
      if (now - lastProgressUpdate.current > 120) {
        setProgress(progressValue);
        lastProgressUpdate.current = now;
      }

      ctx.save();
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      const width = canvas.width / (window.devicePixelRatio || 1);
      const height = canvas.height / (window.devicePixelRatio || 1);
      const phaseName = phaseRef.current;

      const zoomBase = 1.12 + progressValue * 0.45;
      let zoomBoost = 0;
      for (const moment of JUMP_CUT_MOMENTS) {
        if (Math.abs(clamped - moment) < 220) {
          zoomBoost = Math.max(zoomBoost, 0.3 + (1 - Math.abs(clamped - moment) / 220) * 0.35);
        }
      }
      const zoom = zoomBase + zoomBoost;

      const shakeFactor =
        phaseName === "scare"
          ? 12
          : phaseName === "escalate"
          ? 6
          : phaseName === "manifest"
          ? 3.5
          : 1.5;

      const xShake = Math.sin(now * 0.012) * shakeFactor;
      const yShake = Math.cos(now * 0.009) * shakeFactor * 0.6;

      ctx.translate(width / 2 + xShake, height / 2 + yShake);
      ctx.scale(zoom, zoom);
      ctx.translate(-width / 2, -height / 2);

      const bg = ctx.createLinearGradient(0, 0, 0, height);
      bg.addColorStop(0, "rgba(9, 14, 26, 0.95)");
      bg.addColorStop(0.4, "rgba(4, 8, 16, 0.95)");
      bg.addColorStop(1, "rgba(1, 2, 7, 0.98)");
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, width, height);

      const coldGlow = ctx.createRadialGradient(
        width * 0.62,
        height * 0.32,
        40,
        width * 0.55,
        height * 0.58,
        width * 0.7
      );
      coldGlow.addColorStop(0, "rgba(54, 82, 128, 0.28)");
      coldGlow.addColorStop(0.6, "rgba(9, 14, 26, 0)");
      ctx.fillStyle = coldGlow;
      ctx.fillRect(0, 0, width, height);

      // Rocking chair silhouette
      const chairDark = "rgba(19, 26, 40, 0.95)";
      const chairHighlight = "rgba(58, 74, 104, 0.35)";
      const rock = Math.sin(now * 0.0025) * (phaseName === "scare" ? 14 : phaseName === "escalate" ? 9 : 6);

      ctx.save();
      ctx.translate(width * 0.46, height * 0.66);
      ctx.rotate((rock * Math.PI) / 180);
      ctx.lineCap = "round";
      ctx.lineJoin = "round";

      ctx.strokeStyle = chairDark;
      ctx.lineWidth = 8;
      ctx.beginPath();
      ctx.moveTo(-110, 160);
      ctx.quadraticCurveTo(20, 220, 140, 180);
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(-90, 150);
      ctx.quadraticCurveTo(25, 210, 135, 170);
      ctx.stroke();

      ctx.lineWidth = 7;
      ctx.beginPath();
      ctx.moveTo(-80, 150);
      ctx.lineTo(-48, -60);
      ctx.lineTo(-30, -140);
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(95, 150);
      ctx.lineTo(62, -40);
      ctx.lineTo(48, -128);
      ctx.stroke();

      ctx.lineWidth = 6;
      ctx.beginPath();
      ctx.moveTo(-120, -50);
      ctx.lineTo(52, -78);
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(-110, -94);
      ctx.lineTo(54, -122);
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(-78, -120);
      ctx.lineTo(-72, -220);
      ctx.lineTo(36, -240);
      ctx.lineTo(44, -140);
      ctx.stroke();

      ctx.strokeStyle = chairHighlight;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(-110, -94);
      ctx.lineTo(-78, -120);
      ctx.lineTo(-72, -220);
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(54, -122);
      ctx.lineTo(44, -140);
      ctx.lineTo(36, -240);
      ctx.stroke();

      ctx.restore();

      // Child's drawing on wall
      ctx.save();
      ctx.globalAlpha = 0.12 + progressValue * 0.25;
      ctx.translate(width * 0.23, height * 0.32);
      ctx.rotate(-3 * (Math.PI / 180));
      ctx.fillStyle = "rgba(255,255,255,0.08)";
      ctx.fillRect(-110, -140, 220, 280);
      ctx.lineWidth = 2;
      ctx.strokeStyle = "rgba(255,255,255,0.12)";
      ctx.strokeRect(-110, -140, 220, 280);

      ctx.strokeStyle = "rgba(220, 220, 220, 0.45)";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(0, -30, 42, 0, Math.PI * 2);
      ctx.stroke();

      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(0, 12);
      ctx.lineTo(-45, 95);
      ctx.lineTo(45, 95);
      ctx.closePath();
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(-45, 28);
      ctx.lineTo(-90, 120);
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(45, 28);
      ctx.lineTo(90, 120);
      ctx.stroke();

      ctx.strokeStyle =
        phaseName === "hint" || phaseName === "manifest" || phaseName === "escalate" || phaseName === "scare"
          ? "rgba(211, 43, 55, 0.75)"
          : "rgba(211, 43, 55, 0.35)";
      ctx.lineWidth = phaseName === "scare" ? 7 : 5;
      const eyeOffset = phaseName === "scare" ? 12 : phaseName === "escalate" ? 9 : 6;
      ctx.beginPath();
      ctx.moveTo(-eyeOffset, -38);
      ctx.lineTo(-eyeOffset, -18);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(eyeOffset, -38);
      ctx.lineTo(eyeOffset, -18);
      ctx.stroke();

      ctx.restore();

      if (phaseName === "manifest" || phaseName === "escalate" || phaseName === "scare") {
        ctx.save();
        const strength = phaseName === "scare" ? 0.48 : phaseName === "escalate" ? 0.3 : 0.18;
        const bars = phaseName === "scare" ? 28 : 18;
        for (let i = 0; i < bars; i++) {
          const alpha = Math.random() * strength;
          ctx.fillStyle = `rgba(229, 30, 50, ${alpha})`;
          const barWidth = Math.random() * width * 0.12;
          const barHeight = 3 + Math.random() * 3;
          const barX = Math.random() * (width - barWidth);
          const barY = Math.random() * height;
          ctx.fillRect(barX, barY, barWidth, barHeight);
        }
        ctx.restore();
      }

      if (phaseName === "scare" || phaseName === "aftermath") {
        ctx.save();
        ctx.globalAlpha = phaseName === "aftermath" ? 0.85 : 1;
        ctx.translate(width * 0.54, height * 0.37);
        ctx.scale(1.4, 1.4);
        ctx.fillStyle = "rgba(211, 43, 55, 0.85)";
        ctx.beginPath();
        ctx.ellipse(-60, 0, 18, 26, 0.2, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.ellipse(60, 0, 18, 26, -0.2, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }

      ctx.restore();

      if (clamped < STORY_DURATION) {
        animationRef.current = requestAnimationFrame(draw);
      } else {
        setIsComplete(true);
      }
    };

    animationRef.current = requestAnimationFrame(draw);

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
        animationRef.current = null;
      }
    };
  }, [runKey]);

  useEffect(() => {
    return () => {
      timeoutsRef.current.forEach((timeoutId) => window.clearTimeout(timeoutId));
      timeoutsRef.current = [];
      if (audioStateRef.current) {
        audioStateRef.current.stop();
        audioStateRef.current.context.close();
        audioStateRef.current = null;
      }
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
        animationRef.current = null;
      }
    };
  }, []);

  const startAudio = async () => {
    if (audioStateRef.current) {
      audioStateRef.current.stop();
      await audioStateRef.current.context.close();
      audioStateRef.current = null;
    }

    const context = new AudioContext();
    const masterGain = context.createGain();
    masterGain.gain.value = 0.8;
    masterGain.connect(context.destination);

    const ambientFilter = context.createBiquadFilter();
    ambientFilter.type = "lowpass";
    ambientFilter.frequency.value = 420;
    ambientFilter.Q.value = 0.6;
    ambientFilter.connect(masterGain);

    const ambientGain = context.createGain();
    ambientGain.gain.value = 0.0001;
    ambientGain.connect(ambientFilter);

    const ambientSource = context.createBufferSource();
    ambientSource.buffer = createNoiseBuffer(context, 2);
    ambientSource.loop = true;
    ambientSource.playbackRate.setValueAtTime(0.32, context.currentTime);
    ambientSource.connect(ambientGain);
    ambientSource.start();

    ambientGain.gain.linearRampToValueAtTime(0.05, context.currentTime + 1);
    ambientGain.gain.linearRampToValueAtTime(0.12, context.currentTime + 10);
    ambientGain.gain.linearRampToValueAtTime(0.2, context.currentTime + 18);
    ambientGain.gain.linearRampToValueAtTime(0.32, context.currentTime + 26);

    const scheduleCreak = (start: number) => {
      const osc = context.createOscillator();
      osc.type = "triangle";
      const gain = context.createGain();
      gain.gain.value = 0;
      const distortion = context.createWaveShaper();
      distortion.curve = createDistortionCurve(180, context);
      distortion.oversample = "4x";
      osc.connect(distortion);
      distortion.connect(gain);
      gain.connect(masterGain);

      const startTime = context.currentTime + start;
      osc.frequency.setValueAtTime(160, startTime);
      osc.frequency.exponentialRampToValueAtTime(38, startTime + 1.3);

      gain.gain.setValueAtTime(0.0001, startTime);
      gain.gain.exponentialRampToValueAtTime(0.18, startTime + 0.25);
      gain.gain.exponentialRampToValueAtTime(0.0001, startTime + 1.45);

      osc.start(startTime);
      osc.stop(startTime + 1.6);
    };

    scheduleCreak(5.8);
    scheduleCreak(11.4);
    scheduleCreak(17.6);

    const scareGain = context.createGain();
    scareGain.gain.value = 0;
    scareGain.connect(masterGain);

    const scareNoise = context.createBufferSource();
    scareNoise.buffer = createNoiseBuffer(context, 1.5);
    scareNoise.loop = false;
    scareNoise.connect(scareGain);

    scareNoise.start(context.currentTime + 24.6);
    scareGain.gain.setValueAtTime(0.0001, context.currentTime + 24.6);
    scareGain.gain.exponentialRampToValueAtTime(0.95, context.currentTime + 24.82);
    scareGain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + 25.3);

    const boomOsc = context.createOscillator();
    boomOsc.type = "sawtooth";
    const boomGain = context.createGain();
    boomGain.gain.value = 0;
    boomOsc.connect(boomGain);
    boomGain.connect(masterGain);

    const boomStart = context.currentTime + 24.5;
    boomOsc.frequency.setValueAtTime(280, boomStart);
    boomOsc.frequency.exponentialRampToValueAtTime(48, boomStart + 0.6);

    boomGain.gain.setValueAtTime(0.0001, boomStart);
    boomGain.gain.exponentialRampToValueAtTime(0.8, boomStart + 0.22);
    boomGain.gain.exponentialRampToValueAtTime(0.0001, boomStart + 0.7);

    boomOsc.start(boomStart);
    boomOsc.stop(boomStart + 0.9);

    audioStateRef.current = {
      context,
      stop: () => {
        try {
          ambientSource.stop();
        } catch {}
        try {
          scareNoise.stop();
        } catch {}
        try {
          boomOsc.stop();
        } catch {}
      },
    };
  };

  const beginStory = async () => {
    await startAudio();
    setPhase("intro");
    phaseRef.current = "intro";
    setStarted(true);
    setRunKey((prev) => prev + 1);
    setProgress(0);
    setIsComplete(false);

    timeoutsRef.current.forEach((timeoutId) => window.clearTimeout(timeoutId));
    timeoutsRef.current = [];

    PHASE_SEQUENCE.forEach(({ at, phase: nextPhase }) => {
      const timeoutId = window.setTimeout(() => {
        setPhase(nextPhase);
        phaseRef.current = nextPhase;
      }, at);
      timeoutsRef.current.push(timeoutId);
    });

    const finishTimeout = window.setTimeout(() => {
      setIsComplete(true);
    }, STORY_DURATION + 60);
    timeoutsRef.current.push(finishTimeout);
  };

  useEffect(() => {
    if (isComplete) {
      timeoutsRef.current.forEach((timeoutId) => window.clearTimeout(timeoutId));
      timeoutsRef.current = [];
    }
  }, [isComplete]);

  const overlay = useMemo(() => OVERLAYS[phase] ?? [], [phase]);

  const replay = async () => {
    await beginStory();
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-black/40 px-4 py-8">
      <div className="mx-auto flex w-full max-w-5xl flex-col items-center gap-6 text-center">
        <h1 className="text-sm tracking-[0.5em] text-white/40 uppercase">
          NIGHT WHISPERS · reel ready horror short
        </h1>
        <div
          ref={frameRef}
          className="relative aspect-[9/16] w-full max-w-xs overflow-hidden rounded-[28px] border border-white/8 bg-black/90 shadow-[0_20px_50px_rgba(0,0,0,0.65)] sm:max-w-sm"
        >
          <canvas ref={canvasRef} className="h-full w-full" />
          <div className="grain-overlay" />
          <div className="scanline-overlay" />

          {!started && (
            <button
              type="button"
              onClick={beginStory}
              className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 bg-black/70 text-center transition hover:bg-black/60"
            >
              <span className="text-[0.75rem] uppercase tracking-[0.45em] text-white/40">
                tap to enter
              </span>
              <span className="text-2xl font-semibold text-white/80">
                The Rocking Chair
              </span>
            </button>
          )}

          {overlay.map(({ id, text, className, handwritten: isHand, glitch }) => (
            <p
              key={id}
              data-text={text}
              className={`${className} ${
                isHand ? "handwritten" : ""
              } ${glitch ? "glitch" : ""}`}
            >
              {text}
            </p>
          ))}

          {isComplete && (
            <button
              type="button"
              onClick={replay}
              className="absolute inset-0 z-20 flex items-end justify-center bg-gradient-to-t from-black/80 via-black/30 to-transparent pb-14 text-xs uppercase tracking-[0.4em] text-white/60 transition hover:text-white/80"
            >
              Replay Story
            </button>
          )}

          <div className="absolute bottom-6 left-0 right-0 z-10 px-8">
            <div className="h-[2px] w-full bg-white/10">
              <div
                className="h-full bg-[var(--accent-red)] transition-[width] duration-[120ms]"
                style={{ width: `${Math.min(progress * 100, 100)}%` }}
              />
            </div>
            <div className="mt-2 flex items-center justify-between text-[0.65rem] uppercase tracking-[0.45em] text-white/35">
              <span>00:00</span>
              <span>00:30</span>
            </div>
          </div>
        </div>
        <p className="max-w-xl text-sm text-white/55">
          Shot composition, lighting, and audio automation crafted for 9:16 reels. Use screen
          capture or export-to-video tooling to publish directly on TikTok, Reels, or Shorts.
        </p>
      </div>
    </main>
  );
}
