import { useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { useToast } from './use-toast';
import { useLanguage } from './useLanguage';

// ═══════════════════════════════════════════════════════════════════════════════
// useEventReminders — fires reminders for upcoming events while the app is open
//
// Every 60s: load events starting within the next 2h, and for each one whose
// reminder window (starts_at - reminder_min) has arrived → fire once:
//   1. Browser Notification (if permitted) — works when tab is in background
//   2. In-app toast with gold styling
//
// De-dup via localStorage so a reminder never fires twice across reloads.
// Server-side push (closed app) is the PWA roadmap — this covers open sessions.
// ═══════════════════════════════════════════════════════════════════════════════

const FIRED_KEY = 'jood-fired-reminders';
const loadFired = (): Record<string, number> => {
  try { return JSON.parse(localStorage.getItem(FIRED_KEY) ?? '{}'); } catch { return {}; }
};
const saveFired = (m: Record<string, number>) => {
  // Prune entries older than 24h so storage never grows unbounded
  const dayAgo = Date.now() - 86400000;
  const pruned = Object.fromEntries(Object.entries(m).filter(([, ts]) => ts > dayAgo));
  localStorage.setItem(FIRED_KEY, JSON.stringify(pruned));
};

export const useEventReminders = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const { lang } = useLanguage();
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    if (!user?.id) return;

    // Ask for notification permission once, politely, after the app settles
    const permTimer = window.setTimeout(() => {
      if ('Notification' in window && Notification.permission === 'default') {
        Notification.requestPermission().catch(() => {});
      }
    }, 8000);

    const check = async () => {
      try {
        const now = Date.now();
        const horizon = new Date(now + 2 * 3600000).toISOString();

        const { data: events } = await (supabase as any)
          .from('events')
          .select('id, title, starts_at, location, reminder_min')
          .eq('user_id', user.id)
          .gte('starts_at', new Date(now - 60000).toISOString())
          .lte('starts_at', horizon)
          .order('starts_at', { ascending: true })
          .limit(20);

        if (!events?.length) return;
        const fired = loadFired();

        for (const ev of events) {
          const startMs = new Date(ev.starts_at).getTime();
          const remindAt = startMs - (ev.reminder_min ?? 15) * 60000;
          if (now < remindAt || fired[ev.id]) continue;

          const minsLeft = Math.max(1, Math.round((startMs - now) / 60000));
          const title = lang === 'ar' ? `تذكير من جود ✨` : `Reminder from Jood ✨`;
          const body = lang === 'ar'
            ? `${ev.title} بعد ${minsLeft} دقيقة${ev.location ? ` — ${ev.location}` : ''}`
            : `${ev.title} in ${minsLeft} min${ev.location ? ` — ${ev.location}` : ''}`;

          if ('Notification' in window && Notification.permission === 'granted') {
            try { new Notification(title, { body, icon: '/favicon.ico', tag: ev.id }); } catch { /* ignore */ }
          }
          toast({ title, description: body });

          fired[ev.id] = now;
        }
        saveFired(fired);
      } catch { /* network hiccup — next tick will retry */ }
    };

    check();
    timerRef.current = window.setInterval(check, 60000);
    return () => {
      window.clearTimeout(permTimer);
      if (timerRef.current) window.clearInterval(timerRef.current);
    };
  }, [user?.id]); // eslint-disable-line react-hooks/exhaustive-deps
};

export default useEventReminders;
