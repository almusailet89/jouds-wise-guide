import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

export type SimpleTask = {
  id: string;
  title: string;
  due_date?: string | null;
  status?: string;
};

const storageKey = 'scheduled_task_notifications_v1';

function loadScheduled(): Record<string, number> {
  try {
    const raw = localStorage.getItem(storageKey);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function saveScheduled(map: Record<string, number>) {
  try { localStorage.setItem(storageKey, JSON.stringify(map)); } catch {}
}

export function useLocalNotifications() {
  const supported = typeof window !== 'undefined' && 'Notification' in window;
  const [permission, setPermission] = useState<NotificationPermission>(supported ? Notification.permission : 'denied');
  const scheduledRef = useRef<Record<string, number>>(loadScheduled());
  const timeoutsRef = useRef<Record<string, number>>({});

  useEffect(() => {
    // Cleanup timeouts on unmount
    return () => {
      Object.values(timeoutsRef.current).forEach(id => window.clearTimeout(id));
      timeoutsRef.current = {};
    };
  }, []);

  const requestPermission = useCallback(async () => {
    if (!supported) return 'denied' as NotificationPermission;
    try {
      const p = await Notification.requestPermission();
      setPermission(p);
      return p;
    } catch {
      return permission;
    }
  }, [supported, permission]);

  const scheduleForTasks = useCallback((tasks: SimpleTask[], leadMinutes = 5) => {
    if (!supported || permission !== 'granted') return;
    const now = Date.now();
    const leadMs = Math.max(0, leadMinutes) * 60 * 1000;

    tasks.forEach(t => {
      if (!t.due_date || (t.status && t.status === 'completed')) return;
      const due = new Date(t.due_date).getTime();
      if (Number.isNaN(due)) return;
      const fireAt = Math.max(now, due - leadMs);
      if (fireAt <= now) return; // already passed

      const existing = scheduledRef.current[t.id];
      if (existing && existing >= fireAt - 1000 && existing <= fireAt + 1000) return; // already scheduled roughly at same time

      const delay = fireAt - now;
      const timeoutId = window.setTimeout(() => {
        try {
          new Notification('Upcoming task', { body: t.title });
        } catch {}
        // After firing, clear record to allow re-scheduling if date changes
        delete scheduledRef.current[t.id];
        saveScheduled(scheduledRef.current);
        delete timeoutsRef.current[t.id];
      }, delay);

      timeoutsRef.current[t.id] = timeoutId;
      scheduledRef.current[t.id] = fireAt;
      saveScheduled(scheduledRef.current);
    });
  }, [supported, permission]);

  const cancelForTask = useCallback((taskId: string) => {
    const timeout = timeoutsRef.current[taskId];
    if (timeout) {
      clearTimeout(timeout);
      delete timeoutsRef.current[taskId];
    }
    if (scheduledRef.current[taskId]) {
      delete scheduledRef.current[taskId];
      saveScheduled(scheduledRef.current);
    }
  }, []);

  return {
    supported,
    permission,
    requestPermission,
    scheduleForTasks,
    cancelForTask,
    // One-off schedule: schedule a single notification at dateIso
    schedule: (dateIso: string, title: string, body?: string) => {
      if (!supported || permission !== 'granted') return;
      const when = new Date(dateIso).getTime();
      if (!when || Number.isNaN(when)) return;
      const now = Date.now();
      const fireAt = Math.max(now, when);
      const id = `single-${fireAt}-${Math.random().toString(36).slice(2, 7)}`;
      const delay = fireAt - now;
      const timeoutId = window.setTimeout(() => {
        try { new Notification(title, { body }); } catch {}
        delete timeoutsRef.current[id];
      }, delay);
      timeoutsRef.current[id] = timeoutId;
    },
  } as const;
}
