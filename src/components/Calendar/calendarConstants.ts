// Shared between SmartCalendar and the other Planning views (List, Kanban) so
// category/priority colors stay visually consistent without duplicating them.
export const CATEGORY_COLORS: Record<string, string> = {
  personal: 'bg-jood-teal-500/15 text-jood-teal-700 dark:text-jood-teal-500 border border-jood-teal-500/25',
  finance:  'bg-jood-gold-500/15 text-jood-gold-500 border border-jood-gold-500/30',
  health:   'bg-jood-ok/12 text-jood-ok border border-jood-ok/25',
  prayer:   'bg-jood-teal-900/10 text-jood-teal-700 dark:text-jood-gold-300 border border-jood-teal-700/25',
  family:   'bg-jood-warn/12 text-jood-warn border border-jood-warn/25',
  work:     'bg-foreground/8 text-foreground/80 border border-foreground/15',
};
export const CATEGORY_KEYS = ['personal', 'finance', 'health', 'prayer', 'family', 'work'] as const;
export type CategoryKey = typeof CATEGORY_KEYS[number];

export const PRIORITY_COLORS: Record<string, string> = {
  high: 'text-red-500', medium: 'text-amber-500', low: 'text-emerald-500',
};
