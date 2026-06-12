import React from 'react';
import { motion } from 'framer-motion';
import { JoodOrb } from '@/components/Voice/JoodOrb';
import { cn } from '@/lib/utils';

// ═══════════════════════════════════════════════════════════════════════════════
// EmptyState — the luxury empty state, signed by Jood
//
// Instead of a gray icon + "no data", every empty screen becomes an invitation:
// the Jood orb breathing softly + a warm line + an optional action.
// ═══════════════════════════════════════════════════════════════════════════════

interface EmptyStateProps {
  /** Warm headline, e.g. "ما عندك مواعيد اليوم" */
  title: string;
  /** Invitation line, e.g. "قولي لجود: احجزي لي اجتماع بكرة الساعة عشر" */
  hint?: string;
  /** Optional action button */
  action?: React.ReactNode;
  /** Orb size — 64 for tight panels, 96 default, 120 for full tabs */
  orbSize?: number;
  className?: string;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  title,
  hint,
  action,
  orbSize = 96,
  className,
}) => (
  <motion.div
    initial={{ opacity: 0, y: 8 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ duration: 0.4 }}
    className={cn('flex flex-col items-center justify-center text-center py-8 px-4', className)}
  >
    <JoodOrb mode="idle" size={orbSize} withRings={false} className="opacity-80" />
    <p className="mt-3 text-sm font-arabic font-semibold text-foreground/85">{title}</p>
    {hint && (
      <p className="mt-1.5 text-xs font-arabic text-muted-foreground max-w-[260px] leading-relaxed">
        {hint}
      </p>
    )}
    {action && <div className="mt-4">{action}</div>}
  </motion.div>
);

export default EmptyState;
