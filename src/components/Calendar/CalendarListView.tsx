import React, { useMemo, useState } from 'react';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Search, CalendarDays, CheckSquare, Trash2, Clock } from 'lucide-react';
import { useTasks, useEvents } from '@/hooks/useDatabase';
import { useLanguage } from '@/hooks/useLanguage';
import { cn } from '@/lib/utils';
import { CATEGORY_COLORS, CATEGORY_KEYS } from './calendarConstants';

type Kind = 'task' | 'event';

interface ListItem {
  id: string;
  kind: Kind;
  title: string;
  category: string | null;
  priority?: 'low' | 'medium' | 'high';
  completed: boolean;
  date: Date | null;
}

const PRIORITY_RANK: Record<string, number> = { high: 0, medium: 1, low: 2 };

const CalendarListView: React.FC = () => {
  const { tasks, updateTask, deleteTask } = useTasks();
  const { events, deleteEvent } = useEvents();
  const { t, lang, dir } = useLanguage();

  const [search, setSearch] = useState('');
  const [kindFilter, setKindFilter] = useState<'all' | Kind>('all');
  const [categoryFilter, setCategoryFilter] = useState<string | null>(null);
  const [hideCompleted, setHideCompleted] = useState(false);

  const items: ListItem[] = useMemo(() => {
    const fromTasks: ListItem[] = tasks
      .filter(task => !task.parent_task_id)
      .map(task => ({
        id: task.id,
        kind: 'task' as const,
        title: task.title,
        category: task.category,
        priority: task.priority,
        completed: task.status === 'completed',
        date: task.due_date ? new Date(task.due_date) : null,
      }));
    const fromEvents: ListItem[] = events.map(ev => ({
      id: ev.id,
      kind: 'event' as const,
      title: ev.title,
      category: ev.category,
      completed: !!ev.completed_at,
      date: ev.starts_at ? new Date(ev.starts_at) : (ev.start_at ? new Date(ev.start_at) : null),
    }));
    return [...fromTasks, ...fromEvents];
  }, [tasks, events]);

  const filtered = useMemo(() => {
    return items
      .filter(i => kindFilter === 'all' || i.kind === kindFilter)
      .filter(i => !categoryFilter || i.category === categoryFilter)
      .filter(i => !hideCompleted || !i.completed)
      .filter(i => !search.trim() || i.title.toLowerCase().includes(search.trim().toLowerCase()))
      .sort((a, b) => {
        // No-date items sink to the bottom; otherwise ascending by date.
        if (!a.date && !b.date) return (PRIORITY_RANK[a.priority ?? 'low'] ?? 2) - (PRIORITY_RANK[b.priority ?? 'low'] ?? 2);
        if (!a.date) return 1;
        if (!b.date) return -1;
        return a.date.getTime() - b.date.getTime();
      });
  }, [items, kindFilter, categoryFilter, hideCompleted, search]);

  const toggleTaskDone = (id: string, completed: boolean) => {
    updateTask(id, {
      status: completed ? 'pending' : 'completed',
      completed_at: completed ? null : new Date().toISOString(),
    });
  };

  const handleDelete = (item: ListItem) => {
    if (item.kind === 'task') deleteTask(item.id);
    else deleteEvent(item.id);
  };

  const dateLocale = lang === 'ar' ? 'ar-SA' : 'en-US';

  return (
    <div dir={dir} className="space-y-3">
      {/* Filter bar */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[160px] max-w-[280px]">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
          <Input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder={t('list.search.placeholder')}
            className="h-8 text-xs font-arabic pl-8"
          />
        </div>

        <div className="flex gap-1 p-0.5 bg-muted/40 rounded-lg border border-border/30">
          {(['all', 'task', 'event'] as const).map(k => (
            <button
              key={k}
              onClick={() => setKindFilter(k)}
              className={cn(
                'px-2.5 py-1 rounded-md text-xs font-arabic transition-all',
                kindFilter === k ? 'bg-card shadow-sm text-foreground font-semibold' : 'text-muted-foreground hover:text-foreground',
              )}
            >
              {t(`list.kind.${k}`)}
            </button>
          ))}
        </div>

        <div className="flex gap-1 flex-wrap">
          {CATEGORY_KEYS.map(cat => (
            <button
              key={cat}
              onClick={() => setCategoryFilter(prev => prev === cat ? null : cat)}
              className={cn(
                'text-[10px] px-2 py-1 rounded-full border font-arabic transition-all',
                categoryFilter === cat ? CATEGORY_COLORS[cat] : 'text-muted-foreground border-border/40 hover:border-border',
              )}
            >
              {t(`cal.cat.${cat}`)}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-1.5 ml-auto">
          <Switch checked={hideCompleted} onCheckedChange={setHideCompleted} className="scale-75" />
          <span className="text-xs text-muted-foreground font-arabic">{t('list.hide.completed')}</span>
        </div>
      </div>

      {/* List */}
      <div className="space-y-1.5">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-muted-foreground/60">
            <CalendarDays className="w-8 h-8 mb-2 opacity-40" />
            <p className="text-sm font-arabic">{t('list.empty')}</p>
          </div>
        ) : filtered.map(item => {
          const isOverdue = item.date && !item.completed && item.date < new Date();
          return (
            <div
              key={`${item.kind}-${item.id}`}
              className={cn(
                'group flex items-center gap-3 px-3 py-2 rounded-lg border border-border/40 bg-card hover:border-border transition-colors',
                item.completed && 'opacity-60',
              )}
            >
              {item.kind === 'task' ? (
                <button
                  onClick={() => toggleTaskDone(item.id, item.completed)}
                  className={cn(
                    'w-4 h-4 rounded-full border-2 flex-shrink-0 transition-colors',
                    item.completed ? 'bg-emerald-500 border-emerald-500' : 'border-muted-foreground/40 hover:border-jood-teal-500',
                  )}
                />
              ) : (
                <CalendarDays className="w-4 h-4 flex-shrink-0 text-jood-teal-600" />
              )}

              <span className={cn('flex-1 text-sm font-arabic truncate', item.completed && 'line-through text-muted-foreground')}>
                {item.title}
              </span>

              {item.priority && (
                <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 font-arabic flex-shrink-0">
                  {t(`kanban.priority.${item.priority}`)}
                </Badge>
              )}

              {item.category && (
                <Badge variant="outline" className={cn('text-[10px] px-1.5 py-0 h-4 font-arabic flex-shrink-0 border', CATEGORY_COLORS[item.category] ?? '')}>
                  {(CATEGORY_KEYS as readonly string[]).includes(item.category) ? t(`cal.cat.${item.category}`) : item.category}
                </Badge>
              )}

              {item.date && (
                <Badge
                  variant="outline"
                  className={cn(
                    'text-[10px] px-1.5 py-0 h-4 gap-1 font-arabic flex-shrink-0',
                    isOverdue ? 'text-rose-600 border-rose-300' : 'text-muted-foreground border-border/50',
                  )}
                >
                  <Clock className="w-2.5 h-2.5" />
                  {item.date.toLocaleDateString(dateLocale, { month: 'short', day: 'numeric' })}
                </Badge>
              )}

              <button
                onClick={() => handleDelete(item)}
                className="opacity-0 group-hover:opacity-100 flex-shrink-0 text-muted-foreground hover:text-destructive transition-all"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default CalendarListView;
