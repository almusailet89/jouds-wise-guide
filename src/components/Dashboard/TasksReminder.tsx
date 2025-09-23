import React, { useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { useTasks } from '@/hooks/useDatabase';
import { useLocalNotifications } from '@/hooks/useLocalNotifications';
import { Bell } from 'lucide-react';

// TODO: re-enable when remote egress is acceptable
const OFFLINE = import.meta.env?.VITE_DEV_OFFLINE === '1';
const isSaver = () => OFFLINE || (typeof window !== 'undefined' && window.localStorage.getItem('egressSaver') === '1');

export const TasksReminder: React.FC = () => {
  const { tasks } = useTasks();
  const { toast } = useToast();
  const { supported, permission, requestPermission } = useLocalNotifications();
  const [open, setOpen] = useState(false);
  const [notifiedToday, setNotifiedToday] = useState(false);

  const dueSoon = useMemo(() => {
    const now = new Date();
    const soon = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    return (tasks || []).filter(t => {
      if (t.status === 'completed') return false;
      if (!t.due_date) return false;
      const d = new Date(t.due_date);
      return d <= soon;
    }).sort((a, b) => ((a.due_date || '') > (b.due_date || '') ? 1 : -1));
  }, [tasks]);

  useEffect(() => {
    // One lightweight toast per session when there are due tasks
    if (!notifiedToday && dueSoon.length > 0) {
      setNotifiedToday(true);
      toast({ title: 'Upcoming tasks', description: `${dueSoon.length} task${dueSoon.length > 1 ? 's' : ''} due soon`, duration: 2500 });
    }
  }, [dueSoon, notifiedToday, toast]);

  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setOpen(true)} className="relative">
        <Bell className="w-4 h-4 mr-1"/>
        Reminders
        {dueSoon.length > 0 && (
          <Badge className="ml-2" variant="secondary">{dueSoon.length}</Badge>
        )}
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Upcoming tasks</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-1">
            {supported && permission !== 'granted' && (
              <div className="flex items-center justify-between p-2 rounded-md border border-border/50 bg-background/60">
                <div className="text-xs text-muted-foreground">Notifications are disabled.</div>
                <Button size="sm" variant="outline" onClick={requestPermission}>Enable notifications</Button>
              </div>
            )}
            {dueSoon.length === 0 && (
              <div className="text-sm text-muted-foreground">No tasks due in the next 24 hours.</div>
            )}
            {dueSoon.map(t => (
              <div key={t.id} className="p-2 rounded-md border border-border/50 bg-background/60">
                <div className="text-sm font-medium">{t.title}</div>
                <div className="text-xs text-muted-foreground">
                  {t.due_date ? new Date(t.due_date).toLocaleString() : 'No due date'}
                  {t.priority ? ` • ${t.priority}` : ''}
                  {t.category ? ` • ${t.category}` : ''}
                </div>
                {isSaver() && (
                  <div className="mt-1 text-[11px] text-muted-foreground">Egress saver: updates disabled</div>
                )}
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default TasksReminder;
