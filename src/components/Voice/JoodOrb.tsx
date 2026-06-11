import React, { useEffect, useRef } from 'react';
import { cn } from '@/lib/utils';

// ═══════════════════════════════════════════════════════════════════════════════
// JoodOrb — "النواة" — the signature Jood AI presence
//
// A glass sphere with liquid waveforms flowing inside, framed by thin rotating
// arcs. Inspired by JARVIS + ElevenLabs orb, but rendered in Jood's Saudi
// palette: deep oasis teal + desert gold. No other AI assistant looks like this —
// blue/purple orbs are everywhere; gold-on-teal is unmistakably Arabian luxury.
//
// Canvas-rendered at 60fps, devicePixelRatio-aware, audio-reactive.
//
// Modes:
//   idle       — slow, calm breathing waves (she's present, resting)
//   listening  — waves lean toward the user, teal glow strengthens
//   thinking   — waves swirl and tighten (processing)
//   speaking   — waves dance with TTS amplitude, gold glow blooms
//   connecting — soft pulse while the call is established
// ═══════════════════════════════════════════════════════════════════════════════

export type OrbMode = 'idle' | 'listening' | 'thinking' | 'speaking' | 'connecting';

interface JoodOrbProps {
  mode: OrbMode;
  /** 0..1 — live audio amplitude (mic or TTS) */
  intensity?: number;
  /** Diameter in px */
  size?: number;
  /** Show the rotating Jarvis arcs around the sphere (hide at small sizes) */
  withRings?: boolean;
  className?: string;
}

// Brand colors (matches --jood-* CSS tokens)
const TEAL_DEEP  = 'rgba(13, 59, 59, 1)';      // sphere depths
const TEAL       = 'rgba(46, 138, 138, 1)';    // teal wave
const TEAL_LIGHT = 'rgba(102, 196, 196, 1)';   // bright teal crest
const GOLD       = 'rgba(184, 146, 74, 1)';    // gold wave
const GOLD_LIGHT = 'rgba(222, 184, 120, 1)';   // bright gold crest
const CREAM      = 'rgba(244, 240, 232, 0.9)'; // highlight thread

interface WaveLayer {
  color: string;
  glowColor: string;
  baseAmp: number;     // fraction of radius
  freq: number;        // horizontal wave count
  speed: number;       // phase speed
  yOffset: number;     // vertical center offset (fraction of radius)
  lineWidth: number;
  phase: number;
}

export const JoodOrb: React.FC<JoodOrbProps> = ({
  mode,
  intensity = 0,
  size = 280,
  withRings = true,
  className,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const modeRef = useRef<OrbMode>(mode);
  const intensityRef = useRef(intensity);
  const smoothedRef = useRef(0);

  // Refs avoid re-running the RAF loop on prop changes
  modeRef.current = mode;
  intensityRef.current = intensity;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    // Canvas covers orb + ring margin
    const margin = withRings ? size * 0.18 : size * 0.08;
    const full = size + margin * 2;
    canvas.width = full * dpr;
    canvas.height = full * dpr;
    canvas.style.width = `${full}px`;
    canvas.style.height = `${full}px`;
    ctx.scale(dpr, dpr);

    const cx = full / 2;
    const cy = full / 2;
    const R = size / 2;

    const waves: WaveLayer[] = [
      { color: TEAL,       glowColor: 'rgba(46,138,138,0.55)',  baseAmp: 0.16, freq: 2.1, speed: 0.9,  yOffset: 0.05,  lineWidth: 2.4, phase: 0 },
      { color: GOLD,       glowColor: 'rgba(184,146,74,0.6)',   baseAmp: 0.20, freq: 1.6, speed: -0.7, yOffset: -0.02, lineWidth: 2.6, phase: 2.1 },
      { color: TEAL_LIGHT, glowColor: 'rgba(102,196,196,0.45)', baseAmp: 0.12, freq: 3.2, speed: 1.3,  yOffset: 0.10,  lineWidth: 1.6, phase: 4.2 },
      { color: GOLD_LIGHT, glowColor: 'rgba(222,184,120,0.5)',  baseAmp: 0.10, freq: 2.6, speed: -1.1, yOffset: -0.08, lineWidth: 1.4, phase: 1.3 },
      { color: CREAM,      glowColor: 'rgba(244,240,232,0.35)', baseAmp: 0.07, freq: 4.1, speed: 1.7,  yOffset: 0.02,  lineWidth: 0.9, phase: 3.0 },
    ];

    let raf = 0;
    let t = 0;
    let last = performance.now();

    const draw = (now: number) => {
      const dt = Math.min((now - last) / 1000, 0.05);
      last = now;

      const m = modeRef.current;

      // Per-mode energy targets
      const targetEnergy =
        m === 'speaking'  ? 0.45 + intensityRef.current * 0.9
      : m === 'listening' ? 0.30 + intensityRef.current * 0.7
      : m === 'thinking'  ? 0.40
      : m === 'connecting'? 0.28
      :                     0.16; // idle breathing

      // Smooth the energy so transitions feel liquid, not jumpy
      smoothedRef.current += (targetEnergy - smoothedRef.current) * Math.min(dt * 6, 1);
      const energy = smoothedRef.current;

      // Time advances faster when thinking (swirl) and speaking
      const speedMul = m === 'thinking' ? 2.2 : m === 'speaking' ? 1.5 : m === 'connecting' ? 1.2 : 1;
      t += dt * speedMul;

      ctx.clearRect(0, 0, full, full);

      // ── 1. Outer ambient glow ─────────────────────────────────────────────
      const glowStrength = 0.25 + energy * 0.6;
      const isGoldMode = m === 'speaking' || m === 'idle';
      const glowRGB = isGoldMode ? '184,146,74' : '46,138,138';
      const glow = ctx.createRadialGradient(cx, cy, R * 0.5, cx, cy, R * 1.35);
      glow.addColorStop(0, `rgba(${glowRGB},${0.20 * glowStrength})`);
      glow.addColorStop(0.7, `rgba(${glowRGB},${0.08 * glowStrength})`);
      glow.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(cx, cy, R * 1.35, 0, Math.PI * 2);
      ctx.fill();

      // ── 2. Rotating Jarvis arcs (outside the sphere) ──────────────────────
      if (withRings) {
        const arcs = [
          { r: R * 1.10, start: t * 0.5,  span: Math.PI * 0.65, w: 1.2, a: 0.45 },
          { r: R * 1.10, start: t * 0.5 + Math.PI, span: Math.PI * 0.4, w: 1.2, a: 0.30 },
          { r: R * 1.17, start: -t * 0.3, span: Math.PI * 0.9,  w: 0.8, a: 0.30 },
          { r: R * 1.17, start: -t * 0.3 + Math.PI * 1.2, span: Math.PI * 0.25, w: 0.8, a: 0.45 },
        ];
        for (const arc of arcs) {
          ctx.beginPath();
          ctx.arc(cx, cy, arc.r, arc.start, arc.start + arc.span);
          ctx.strokeStyle = `rgba(184,146,74,${arc.a * (0.5 + energy)})`;
          ctx.lineWidth = arc.w;
          ctx.stroke();
        }
        // Tick marks on the outermost ring — instrument feel
        const tickCount = 48;
        for (let i = 0; i < tickCount; i++) {
          const angle = (i / tickCount) * Math.PI * 2 + t * 0.08;
          const isMajor = i % 4 === 0;
          const r1 = R * 1.235;
          const r2 = r1 + (isMajor ? 4 : 2);
          ctx.beginPath();
          ctx.moveTo(cx + Math.cos(angle) * r1, cy + Math.sin(angle) * r1);
          ctx.lineTo(cx + Math.cos(angle) * r2, cy + Math.sin(angle) * r2);
          ctx.strokeStyle = `rgba(184,146,74,${isMajor ? 0.35 : 0.15})`;
          ctx.lineWidth = 1;
          ctx.stroke();
        }
      }

      // ── 3. Sphere body — deep glass ───────────────────────────────────────
      const body = ctx.createRadialGradient(
        cx - R * 0.3, cy - R * 0.35, R * 0.1,
        cx, cy, R,
      );
      body.addColorStop(0, 'rgba(24, 72, 72, 0.95)');
      body.addColorStop(0.55, 'rgba(13, 47, 47, 0.97)');
      body.addColorStop(1, TEAL_DEEP);
      ctx.beginPath();
      ctx.arc(cx, cy, R, 0, Math.PI * 2);
      ctx.fillStyle = body;
      ctx.fill();

      // ── 4. Waveforms inside (clipped to sphere) ───────────────────────────
      ctx.save();
      ctx.beginPath();
      ctx.arc(cx, cy, R * 0.97, 0, Math.PI * 2);
      ctx.clip();

      const points = 60;
      for (const w of waves) {
        const amp = R * w.baseAmp * (0.5 + energy * 1.6);
        const yBase = cy + R * w.yOffset;

        ctx.beginPath();
        for (let i = 0; i <= points; i++) {
          const frac = i / points;
          const x = cx - R + frac * R * 2;
          // Edge taper so waves vanish at sphere rim (spherical illusion)
          const taper = Math.sin(frac * Math.PI);
          const y = yBase
            + Math.sin(frac * Math.PI * 2 * w.freq + t * w.speed + w.phase) * amp * taper
            + Math.sin(frac * Math.PI * 2 * (w.freq * 0.5) - t * w.speed * 0.6) * amp * 0.4 * taper;
          if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
        }
        ctx.shadowColor = w.glowColor;
        ctx.shadowBlur = 12 + energy * 18;
        ctx.strokeStyle = w.color;
        ctx.lineWidth = w.lineWidth;
        ctx.globalAlpha = 0.55 + energy * 0.45;
        ctx.stroke();

        // Soft fill below the gold wave — liquid depth
        if (w.color === GOLD) {
          ctx.lineTo(cx + R, cy + R);
          ctx.lineTo(cx - R, cy + R);
          ctx.closePath();
          const fillGrad = ctx.createLinearGradient(0, yBase, 0, cy + R);
          fillGrad.addColorStop(0, `rgba(184,146,74,${0.10 + energy * 0.12})`);
          fillGrad.addColorStop(1, 'rgba(184,146,74,0)');
          ctx.shadowBlur = 0;
          ctx.fillStyle = fillGrad;
          ctx.fill();
        }
      }
      ctx.globalAlpha = 1;
      ctx.shadowBlur = 0;
      ctx.restore();

      // ── 5. Glass rim + top highlight ──────────────────────────────────────
      ctx.beginPath();
      ctx.arc(cx, cy, R, 0, Math.PI * 2);
      const rim = ctx.createLinearGradient(cx, cy - R, cx, cy + R);
      rim.addColorStop(0, `rgba(222,184,120,${0.5 + energy * 0.3})`);
      rim.addColorStop(0.5, 'rgba(184,146,74,0.18)');
      rim.addColorStop(1, 'rgba(46,138,138,0.30)');
      ctx.strokeStyle = rim;
      ctx.lineWidth = 1.5;
      ctx.stroke();

      // Specular highlight — glass curvature
      const spec = ctx.createRadialGradient(
        cx - R * 0.32, cy - R * 0.42, 0,
        cx - R * 0.32, cy - R * 0.42, R * 0.55,
      );
      spec.addColorStop(0, 'rgba(255,255,255,0.20)');
      spec.addColorStop(0.5, 'rgba(255,255,255,0.05)');
      spec.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.beginPath();
      ctx.arc(cx, cy, R * 0.97, 0, Math.PI * 2);
      ctx.fillStyle = spec;
      ctx.fill();

      raf = requestAnimationFrame(draw);
    };

    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [size, withRings]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <canvas
      ref={canvasRef}
      className={cn('block select-none pointer-events-none', className)}
      aria-hidden
    />
  );
};

export default JoodOrb;
