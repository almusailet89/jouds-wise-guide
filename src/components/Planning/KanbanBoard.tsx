import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Calendar, ChevronRight, ChevronLeft, Clock, AlertCircle } from 'lucide-react';
import { useTasks } from '@/hooks/useDatabase';
import { useLanguage } from '@/hooks/useLanguage';
import { cn } from '@/lib/utils';

type KanbanStatus = 'pending' | 'in_progress' | 'completed';

const COLUMNS: { id: KanbanStatus; labelAr: string; labelEn: string; color: string; bg: string }[] = [
  { id: 'pending',     labelAr: 'للتنفيذ',    labelEn: 'To Do',       color: 'text-slate-600',      bg: 'bg-slate-50 dark:bg-slate-900/40' },
  { id: 'in_progress', labelAr: 'جارٍ التنفيذ', labelEn: 'In Progress', color: 'text-jood-teal-700',  bg: 'bg-jood-teal-50 dark:bg-jood-teal-900/20' },
  { id: 'completed',   labelAr: 'مكتمل',       labelEn: 'Done',        color: 'text-jood-gold-700',  bg: 'bg-jood-gold-50 dark:bg-amber-900/20' },
];

const PRIORITY_COLORS: Record<string, string> = {
  high:   'bg-red-100 text-red-700 border-red-200',
  medium: 'bg-amber-100 text-amber-700 border-amber-200',
  low:    'bg-green-100 text-green-700 border-green-200',
};

const PRIORITY_AR: Record<string, string> = { high: 'عالية', medium: 'متوسطة', low: 'منخفضة' };
const PRIORITY_EN: Record<string, string> = { high: 'High', medium: 'Medium', low: 'Low' };

const isOverdue = (due: string | null) => due && new Date(due) < new Date();
const isDueSoon = (due: string | null) => {
  if (!due) return false;
  const diff = new Date(due).getTime() - Date.now();
  return diff > 0 && diff < 3 * 86400000;
};

export const KanbanBoard: React.FC = () => {
  const { tasks, updateTask } = useTasks();
  const { lang, dir } = useLanguage();
  const [expanded, setExpanded] = useState<string | null>(null);

  const moveTask = (id: string, to: KanbanStatus) => {
    updateTask(id, {
      status: to as any,
      completed_at: to === 'completed' ? new Date().toISOString() : null,
    });
  };

  // Only show top-level tasks in columns; subtasks shown nested
  const getColumnTasks = (status: KanbanStatus) =>
    tasks.filter(t => (t.status as string) === status && !t.parent_task_id);

  const getSubtasks = (parentId: string) =>
    tasks.filter(t => t.parent_task_id === parentId);

  return (
    <div className="overflow-x-auto pb-4" dir={dir}>
      <div className="flex gap-4 min-w-[720px]">
        {COLUMNS.map((col, colIdx) => {
          const colTasks = getColumnTasks(col.id);
          return (
            <div key={col.id} className={cn('flex-1 rounded-2xl p-3', col.bg)}>
              {/* Column header */}
              <div className="flex items-center justify-between mb-3 px-1">
                <span className={cn('text-sm font-bold font-arabic', col.color)}>
                  {lang === 'ar' ? col.labelAr : col.labelEn}
                </span>
                <Badge variant="outline" className="text-xs font-mono">
                  {colTasks.length}
                </Badge>
              </div>

              {/* Task cards */}
              <div className="space-y-2 min-h-[120px]">
                <AnimatePresence>
                  {colTasks.map(task => (
                    <motion.div
                      key={task.id}
                      layout
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.95 }}
                      transition={{ duration: 0.2 }}
                      className="bg-card rounded-xl border border-border/50 shadow-sm overflow-hidden cursor-pointer hover:shadow-md transition-shadow"
                      onClick={() => setExpanded(expanded === task.id ? null : task.id)}
                    >
                      <div className="p-3">
                        {/* Title + overdue warning */}
                        <div className="flex items-start gap-2">
                          {isOverdue(task.due_date) && col.id !== 'completed' && (
                            <AlertCircle className="w-3.5 h-3.5 text-destructive flex-shrink-0 mt-0.5" />
                          )}
                          <p className={cn(
                            'text-sm font-arabic leading-snug flex-1',
                            task.status === 'completed' && 'line-through text-muted-foreground',
                          )}>
                            {task.title}
                          </p>
                        </div>

                        {/* Subtasks */}
                        {(() => {
                          const subs = getSubtasks(task.id);
                          if (!subs.length) return null;
                          const done = subs.filter(s => s.status === 'completed').length;
                          return (
                            <div className="mt-1.5 space-y-0.5">
                              <p className="text-[10px] text-muted-foreground font-arabic">{done}/{subs.length} {lang === 'ar' ? 'مهام فرعية' : 'subtasks'}</p>
                              <div className="w-full bg-muted rounded-full h-1">
                                <div className="bg-jood-teal-600 h-1 rounded-full transition-all" style={{ width: `${subs.length ? (done / subs.length) * 100 : 0}%` }} />
                              </div>
                            </div>
                          );
                        })()}

                        {/* Meta row */}
                        <div className="flex items-center gap-2 mt-2 flex-wrap">
                          <Badge variant="outline" className={cn('text-[10px] px-1.5 py-0', PRIORITY_COLORS[task.priority])}>
                            {lang === 'ar' ? PRIORITY_AR[task.priority] : PRIORITY_EN[task.priority]}
                          </Badge>
                          {task.due_date && (
                            <span className={cn(
                              'flex items-center gap-0.5 text-[10px] font-mono',
                              isOverdue(task.due_date) && col.id !== 'completed' ? 'text-destructive' :
                              isDueSoon(task.due_date) ? 'text-amber-600' : 'text-muted-foreground',
                            )}>
                              <Calendar className="w-2.5 h-2.5" />
                              {new Date(task.due_date).toLocaleDateString(lang === 'ar' ? 'ar-SA' : 'en-US', { month: 'short', day: 'numeric' })}
                            </span>
                          )}
                          {(task as any).estimated_hours && (
                            <span className="flex items-center gap-0.5 text-[10px] text-muted-foreground font-mono">
                              <Clock className="w-2.5 h-2.5" />
                              {(task as any).estimated_hours}h
                            </span>
                          )}
                        </div>

                        {/* Expanded: move buttons */}
                        <AnimatePresence>
                          {expanded === task.id && (
                            <motion.div
                              initial={{ opacity: 0, height: 0 }}
                              animate={{ opacity: 1, height: 'auto' }}
                              exit={{ opacity: 0, height: 0 }}
                              className="mt-3 flex gap-2 justify-end"
                              onClick={e => e.stopPropagation()}
                            >
                              {colIdx > 0 && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="h-7 text-[11px] font-arabic gap-1"
                                  onClick={() => moveTask(task.id, COLUMNS[colIdx - 1].id)}
                                >
                                  <ChevronLeft className="w-3 h-3" />
                                  {lang === 'ar' ? COLUMNS[colIdx - 1].labelAr : COLUMNS[colIdx - 1].labelEn}
                                </Button>
                              )}
                              {colIdx < COLUMNS.length - 1 && (
                                <Button
                                  size="sm"
                                  className="h-7 text-[11px] font-arabic gap-1 bg-jood-teal-700 hover:bg-jood-teal-800 text-white"
                                  onClick={() => moveTask(task.id, COLUMNS[colIdx + 1].id)}
                                >
                                  {lang === 'ar' ? COLUMNS[colIdx + 1].labelAr : COLUMNS[colIdx + 1].labelEn}
                                  <ChevronRight className="w-3 h-3" />
                                </Button>
                              )}
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                    </motion.div>
                  ))}
                </AnimatePresence>

                {colTasks.length === 0 && (
                  <div className="flex items-center justify-center h-20 text-muted-foreground text-xs font-arabic">
                    {lang === 'ar' ? 'لا توجد مهام' : 'No tasks'}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default KanbanBoard;
