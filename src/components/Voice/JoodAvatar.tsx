import React, { useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';

// ═══════════════════════════════════════════════════════════════════════════════
// JoodAvatar — multi-state video portrait of Jood with audio-reactive lip-sync
//
// States: idle | listening | thinking | speaking
//
// Implementation strategy (Wave 4 P2):
//   1. Four pre-rendered video loops (Sora/Kling generated, hosted in /public)
//      — different facial expressions for each conversational state.
//   2. All four videos preload + play silently. We crossfade between them via
//      opacity transitions so transitions feel cinematic, not jumpy.
//   3. During "speaking", playback rate is modulated by audio intensity for a
//      lip-sync illusion (faster on loud syllables, slower at pauses).
//   4. Audio-reactive gold halo ring grows/shrinks with TTS amplitude.
//
// Wave 5 upgrade path (when ElevenLabs is wired in final testing):
//   - Pipe ElevenLabs phoneme timing data → drive a viseme overlay
//   - OR: route TTS audio through D-ID / HeyGen Live API for true lip-sync
// ═══════════════════════════════════════════════════════════════════════════════

export type AvatarMode = 'idle' | 'listening' | 'thinking' | 'speaking';

interface JoodAvatarProps {
  mode: AvatarMode;
  /** 0..1 — audio amplitude from AnalyserNode for reactive effects */
  intensity?: number;
  /** Container size in px (avatar is square) */
  size?: number;
  className?: string;
}

const VIDEO_SOURCES: Record<AvatarMode, string> = {
  idle:      '/avatar/idle.mp4',
  listening: '/avatar/listening.mp4',
  thinking:  '/avatar/thinking.mp4',
  speaking:  '/avatar/speaking.mp4',
};

const STATE_GLOW: Record<AvatarMode, string> = {
  idle:      'shadow-[0_0_40px_rgba(184,146,74,0.25)]',
  listening: 'shadow-[0_0_60px_rgba(184,146,74,0.55)]',
  thinking:  'shadow-[0_0_50px_rgba(14,78,78,0.45)]',
  speaking:  'shadow-[0_0_80px_rgba(184,146,74,0.7)]',
};

// ═══════════════════════════════════════════════════════════════════════════════
export const JoodAvatar: React.FC<JoodAvatarProps> = ({
  mode,
  intensity = 0,
  size = 320,
  className,
}) => {
  const videoRefs = useRef<Record<AvatarMode, HTMLVideoElement | null>>({
    idle: null, listening: null, thinking: null, speaking: null,
  });

  // ── Modulate speaking-video playback rate by audio intensity ────────────
  // Subtle effect: 0.9× at silence, 1.15× at peak — sells the illusion that
  // her mouth motion follows the spoken syllables.
  useEffect(() => {
    const speakingVideo = videoRefs.current.speaking;
    if (!speakingVideo) return;

    if (mode === 'speaking') {
      const targetRate = 0.90 + intensity * 0.25;
      speakingVideo.playbackRate = Math.max(0.5, Math.min(1.5, targetRate));
    } else {
      speakingVideo.playbackRate = 1.0;
    }
  }, [mode, intensity]);

  // ── Auto-play all videos silently on mount (preload + ready to swap) ─────
  useEffect(() => {
    Object.values(videoRefs.current).forEach(v => {
      if (!v) return;
      v.muted = true;
      v.loop = true;
      v.play().catch(() => {/* autoplay may need user gesture */});
    });
  }, []);

  // ── Audio-reactive scale (only during speaking — adds breath) ────────────
  const reactiveScale =
    mode === 'speaking'  ? 1 + intensity * 0.04
  : mode === 'listening' ? 1 + intensity * 0.02
  : 1;

  return (
    <div
      className={cn('relative flex items-center justify-center', className)}
      style={{ width: size, height: size }}
    >
      {/* ── Outer halo — pulses with audio amplitude during TTS ───────────── */}
      <motion.div
        className="absolute rounded-full pointer-events-none"
        style={{
          width: size + 60,
          height: size + 60,
          background: 'radial-gradient(circle, rgba(184,146,74,0.35) 0%, rgba(184,146,74,0) 70%)',
        }}
        animate={{
          scale: mode === 'speaking' ? 1 + intensity * 0.15 :
                 mode === 'listening' ? 1 + intensity * 0.08 : 1,
          opacity: mode === 'speaking' ? 0.6 + intensity * 0.4 :
                   mode === 'listening' ? 0.4 + intensity * 0.3 : 0.3,
        }}
        transition={{ duration: 0.15, ease: 'easeOut' }}
      />

      {/* ── Avatar disc with cinematic crossfade between states ─────────── */}
      <motion.div
        className={cn(
          'relative rounded-full overflow-hidden',
          'border-4 border-jood-gold-500/60',
          'transition-shadow duration-700',
          STATE_GLOW[mode],
        )}
        style={{ width: size, height: size }}
        animate={{ scale: reactiveScale }}
        transition={{ duration: 0.1, ease: 'linear' }}
      >
        {(Object.keys(VIDEO_SOURCES) as AvatarMode[]).map(key => (
          <video
            key={key}
            ref={(el) => { videoRefs.current[key] = el; }}
            src={VIDEO_SOURCES[key]}
            muted
            loop
            playsInline
            preload="auto"
            className={cn(
              'absolute inset-0 w-full h-full object-cover transition-opacity duration-700',
              mode === key ? 'opacity-100' : 'opacity-0',
            )}
          />
        ))}

        {/* ── Subtle vignette for cinematic feel ───────────────────────── */}
        <div className="absolute inset-0 pointer-events-none rounded-full"
             style={{
               background: 'radial-gradient(circle, transparent 55%, rgba(14,78,78,0.4) 100%)',
             }}
        />

        {/* ── Speaking-state mouth glow (audio-reactive lip-sync illusion) ─ */}
        {mode === 'speaking' && (
          <motion.div
            className="absolute pointer-events-none rounded-full"
            style={{
              left: '38%',
              top: '62%',
              width: '24%',
              height: '12%',
              background: 'radial-gradient(ellipse, rgba(255,200,120,0.25) 0%, rgba(255,200,120,0) 70%)',
              filter: 'blur(8px)',
            }}
            animate={{ opacity: 0.3 + intensity * 0.7, scale: 1 + intensity * 0.3 }}
            transition={{ duration: 0.08 }}
          />
        )}
      </motion.div>

      {/* ── State-aware micro-indicator dot (top-right, ChatGPT-style) ──── */}
      <motion.div
        className="absolute top-3 right-3 w-3 h-3 rounded-full"
        animate={{
          backgroundColor:
            mode === 'speaking'  ? '#10b981' :  // green — talking
            mode === 'listening' ? '#ef4444' :  // red   — recording
            mode === 'thinking'  ? '#f59e0b' :  // amber — processing
                                   '#94a3b8',   // gray  — idle
          scale: mode === 'idle' ? 1 : [1, 1.3, 1],
        }}
        transition={{
          duration: mode === 'idle' ? 0.3 : 1.2,
          repeat: mode === 'idle' ? 0 : Infinity,
        }}
      />
    </div>
  );
};

export default JoodAvatar;
