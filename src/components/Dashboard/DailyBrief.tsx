import React, { useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useTasks, recordTask } from '@/hooks/useDatabase';
import { CalendarDays, PiggyBank, Bell, Shield } from 'lucide-react';
import { useLocalNotifications } from '@/hooks/useLocalNotifications';
import { useKnowledgeVault } from '@/hooks/useDatabase';
import QuickSavings from './QuickSavings';
import { GoalSummary } from '@/hooks/useFinancialDashboard';
import { useToast } from '@/hooks/use-toast';

// TODO: re-enable when remote egress is acceptable
const OFFLINE = import.meta.env?.VITE_DEV_OFFLINE === '1';

const isSaver = () => OFFLINE || (typeof window !== 'undefined' && window.localStorage.getItem('egressSaver') === '1');

type FE = { type: 'income' | 'expense' | 'savings'; amount: number; date: string; currency: string };

export const DailyBrief: React.FC<{
  financialEntries: FE[];
  egressSaver?: boolean;
  walletBalanceSar?: number | null;
  goals?: GoalSummary[];
  applySavingsContribution?: (args: { amountSar: number; note?: string | null; walletBalanceSar?: number | null; financial_entry_id?: string | null; created_at?: string; }) => void;
}> = ({ financialEntries, egressSaver, walletBalanceSar, goals = [], applySavingsContribution }) => {
  const { tasks, appendLocalTask } = useTasks();
  const { toast } = useToast();
  const { addKnowledge } = useKnowledgeVault();
  const { supported, permission, requestPermission, scheduleForTasks, schedule } = useLocalNotifications();
  const [reminderTitle, setReminderTitle] = useState('');
  const [reminderTime, setReminderTime] = useState<string>('');
  const [reminderNote, setReminderNote] = useState<string>('');
  const [noteTitle, setNoteTitle] = useState('');
  const [noteContent, setNoteContent] = useState('');

  const { dueToday, dueCount } = useMemo(() => {
    const today = new Date();
    const start = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);
    const list = (tasks || []).filter(t => {
      if (!t.due_date || t.status === 'completed') return false;
      const d = new Date(t.due_date);
      return d >= start && d < end;
    }).sort((a, b) => ((a.due_date || '') > (b.due_date || '') ? 1 : -1));
    return { dueToday: list.slice(0, 5), dueCount: list.length };
  }, [tasks]);

  const monthSavings = useMemo(() => {
    const now = new Date();
    const m = now.getMonth();
    const y = now.getFullYear();
    return (financialEntries || [])
      .filter(e => e.type === 'savings')
      .filter(e => {
        const d = new Date(e.date);
        return d.getMonth() === m && d.getFullYear() === y;
      })
      .reduce((sum, e) => sum + e.amount, 0);
  }, [financialEntries]);

  const lastSavings = useMemo(() => {
    const last = (financialEntries || [])
      .filter(e => e.type === 'savings')
      .sort((a, b) => (a.date < b.date ? 1 : -1))[0];
    return last ? { amount: last.amount, date: new Date(last.date).toLocaleString(), currency: last.currency } : null;
  }, [financialEntries]);

  const saver = egressSaver ?? isSaver();

  const handleEnableNotifications = async () => {
    try {
      const p = await requestPermission();
      if (p === 'granted') {
        scheduleForTasks(
          dueToday.map(t => ({ id: t.id, title: t.title, due_date: t.due_date, status: t.status })),
          10,
        );
      }
    } catch {}
  };

  useEffect(() => {
    if (!supported) return;
    if (permission !== 'granted') return;
    // Auto (re)schedule as tasks change
    scheduleForTasks(
      dueToday.map(t => ({ id: t.id, title: t.title, due_date: t.due_date, status: t.status })),
      10,
    );
  }, [supported, permission, dueToday, scheduleForTasks]);

  return (
    <Card className="luxury-card">
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2">
          <Shield className="h-5 w-5 text-primary" />
          Today’s Brief
        </CardTitle>
        {saver && <Badge variant="outline" className="text-xs">Egress saver</Badge>}
      </CardHeader>
      <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="p-3 rounded-md border border-border/50 bg-background/60">
          <div className="flex items-center gap-2 mb-1 text-sm font-semibold">
            <CalendarDays className="w-4 h-4 text-primary" />
            Tasks due today
          </div>
          {dueCount === 0 ? (
            <div className="text-xs text-muted-foreground">No tasks due today.</div>
          ) : (
            <ul className="text-xs space-y-1">
              {dueToday.map(t => (
                <li key={t.id} className="truncate">{t.title} <span className="text-muted-foreground">• {t.due_date ? new Date(t.due_date).toLocaleTimeString() : 'Anytime'}</span></li>
              ))}
            </ul>
          )}
          <div className="mt-2">
            <Button variant="outline" size="sm" onClick={handleEnableNotifications}>
              <Bell className="w-3 h-3 mr-1" /> Enable notifications
            </Button>
          </div>
          <div className="mt-3 border-t border-border/40 pt-3">
            <div className="text-xs font-semibold mb-2">Quick reminder</div>
            <div className="flex flex-col gap-2">
              <Input
                placeholder="Reminder title"
                value={reminderTitle}
                onChange={(e) => setReminderTitle(e.target.value)}
              />
              <Input
                type="time"
                value={reminderTime}
                onChange={(e) => setReminderTime(e.target.value)}
              />
              <Input
                placeholder="Optional note"
                value={reminderNote}
                onChange={(e) => setReminderNote(e.target.value)}
              />
              <Button
                size="sm"
                className="self-start"
                disabled={!reminderTitle || !reminderTime}
                onClick={async () => {
                  try {
                    // Build ISO for today at HH:MM local
                    const now = new Date();
                    const [hh, mm] = reminderTime.split(':');
                    const due = new Date(now.getFullYear(), now.getMonth(), now.getDate(), Number(hh || 0), Number(mm || 0), 0);
                    const dueIso = due.toISOString();

                    // One-shot write (Edge Function)
                    const created = await recordTask({ title: reminderTitle, dueIso, note: reminderNote || undefined, reminderIso: dueIso });

                    // Optimistically append to local tasks
                    appendLocalTask({
                      id: created.id,
                      user_id: 'local',
                      title: created.title,
                      description: reminderNote || null,
                      status: 'pending',
                      priority: 'medium',
                      category: 'reminder',
                      due_date: created.due_at,
                      reminder_at: created.reminder_at,
                      completed_at: null,
                      created_at: new Date().toISOString(),
                      updated_at: new Date().toISOString(),
                    });

                    // Schedule local notification if permitted
                    if (permission === 'granted') {
                      schedule(created.due_at, created.title, reminderNote || undefined);
                    }

                    setReminderTitle('');
                    setReminderTime('');
                    setReminderNote('');
                    toast({ title: 'Reminder set', description: 'Your reminder has been created.' });
                  } catch (e: any) {
                    if ((e as any)?.code === 'VALIDATION') {
                      toast({ title: 'Invalid reminder', description: e.message || 'Please provide a title and valid time', variant: 'destructive' });
                    } else {
                      toast({ title: 'Failed to create reminder', description: e?.message || 'Try again', variant: 'destructive' });
                    }
                  }
                }}
              >
                Add reminder
              </Button>
            </div>
          </div>
        </div>

        <div className="p-3 rounded-md border border-border/50 bg-background/60">
          <div className="flex items-center gap-2 mb-1 text-sm font-semibold">
            <PiggyBank className="w-4 h-4 text-primary" />
            This month’s savings
          </div>
          <div className="text-lg font-bold">SAR {monthSavings.toLocaleString()}</div>
          <div className="text-xs text-muted-foreground mt-1">
            {lastSavings ? `Last: SAR ${lastSavings.amount.toLocaleString()} • ${lastSavings.date}` : 'No recent savings yet.'}
          </div>
          <div className="mt-3 border-t border-border/40 pt-3">
            <div className="text-xs font-semibold mb-2">Quick note</div>
            <div className="flex flex-col gap-2">
              <Input
                placeholder="Title"
                value={noteTitle}
                onChange={(e) => setNoteTitle(e.target.value)}
              />
              <Input
                placeholder="Optional details"
                value={noteContent}
                onChange={(e) => setNoteContent(e.target.value)}
              />
              <Button
                size="sm"
                className="self-start"
                disabled={!noteTitle}
                onClick={async () => {
                  try {
                    await addKnowledge({ title: noteTitle, content: noteContent || null });
                    setNoteTitle('');
                    setNoteContent('');
                  } catch {}
                }}
              >
                Save note
              </Button>
            </div>
          </div>
          {/* Quick Savings (zero egress, one-shot write) */}
          <QuickSavings
            walletBalanceSar={walletBalanceSar ?? null}
            goals={goals as GoalSummary[]}
            egressSaver={!!(egressSaver)}
            offline={OFFLINE}
            onCommitted={(contribution, newBal) => {
              applySavingsContribution?.({
                amountSar: Number(contribution.amount_sar),
                note: contribution.note,
                walletBalanceSar: newBal,
                financial_entry_id: contribution.financial_entry_id,
                created_at: contribution.created_at,
              });
            }}
          />
        </div>

        <div className="p-3 rounded-md border border-border/50 bg-background/60">
          <div className="text-sm font-semibold mb-1">Network status</div>
          <ul className="text-xs text-muted-foreground space-y-1">
            <li>Chat: {OFFLINE ? 'offline (disabled)' : 'live'}</li>
            <li>Portfolio/News: {egressSaver ? 'No auto fetch. Use main Refresh for prices/news/portfolio.' : 'auto fetch enabled'}</li>
            <li>
              Realtime: {OFFLINE ? 'disabled (offline)'
                : egressSaver ? 'entries ON; wallet OFF'
                : 'enabled'}
            </li>
            {OFFLINE && <li>Writes: No writes. Try again when online.</li>}
          </ul>
          <div className="mt-2">
            <Button
              size="sm"
              variant="outline"
              onClick={async () => {
                // Compose digest from local state
                const tasksPart = dueCount > 0 ? `${dueCount} task${dueCount > 1 ? 's' : ''} due today` : 'No tasks due today';
                const savingsPart = `MTD savings SAR ${monthSavings.toLocaleString()}`;
                const lastPart = lastSavings ? `Last: SAR ${lastSavings.amount.toLocaleString()} • ${lastSavings.date}` : 'No recent savings';
                const walletPart = typeof walletBalanceSar === 'number' ? `Wallet SAR ${walletBalanceSar.toLocaleString()}` : '';
                const body = `${tasksPart}. ${savingsPart}. ${lastPart}. ${walletPart}`.trim();

                // Next 08:00 local time
                const now = new Date();
                const eight = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 8, 0, 0);
                if (eight.getTime() <= now.getTime()) {
                  eight.setDate(eight.getDate() + 1);
                }
                const whenIso = eight.toISOString();
                if (supported && permission === 'granted') {
                  schedule(whenIso, "Today's Digest", body);
                  toast({ title: 'Digest scheduled', description: `Delivery at ${eight.toLocaleTimeString()}` });
                } else {
                  toast({ title: 'Notifications disabled', description: 'Review your digest below or enable notifications in Reminders.' });
                }
              }}
            >
              Send Today’s Digest
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default DailyBrief;
