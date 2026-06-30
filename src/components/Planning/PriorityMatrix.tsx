import React from 'react';
import { motion } from 'framer-motion';
import { Badge } from '@/components/ui/badge';
import { AlertCircle, Clock, Trash2, BookOpen } from 'lucide-react';
import { useTasks } from '@/hooks/useDatabase';
import { useLanguage } from '@/hooks/useLanguage';
import { cn } from '@/lib/utils';
import type { Task } from '@/hooks/useDatabase';

// Urgency: due within 3 days = urgent
const isUrgent = (task: Task) => {
  if (!task.due_date) return false;
  const diff = new Date(task.due_date).getTime() - Date.now();
  return diff < 3 * 86400000;
};

// Importance: high priority = important
const isImportant = (task: Task) => task.priority === 'high' || task.priority === 'medium';

const QUADRANTS = [
  {
    id: 'q1',
    urgent: true,
    important: true,
    labelAr: 'افعل الآن',
    labelEn: 'Do Now',
    descAr: 'عاجل ومهم',
    descEn: 'Urgent & Important',
    icon: AlertCircle,
    color: 'text-red-600',
    border: 'border-red-200 dark:border-red-900',
    bg: 'bg-red-50/60 dark:bg-red-900/10',
    badge: 'bg-red-100 text-red-700',
  },
  {
    id: 'q2',
    urgent: false,
    important: true,
    labelAr: 'خطط له',
    labelEn: 'Schedule It',
    descAr: 'مهم وغير عاجل',
    descEn: 'Important, Not Urgent',
    icon: BookOpen,
    color: 'text-jood-teal-700',
    border: 'border-jood-teal-200 dark:border-jood-teal-900',
    bg: 'bg-jood-teal-50/60 dark:bg-jood-teal-900/10',
    badge: 'bg-jood-teal-100 text-jood-teal-700',
  },
  {
    id: 'q3',
    urgent: true,
    important: false,
    labelAr: 'فوّض أو اختصر',
    labelEn: 'Delegate',
    descAr: 'عاجل وغير مهم',
    descEn: 'Urgent, Not Important',
    icon: Clock,
    color: 'text-amber-600',
    border: 'border-amber-200 dark:border-amber-900',
    bg: 'bg-amber-50/60 dark:bg-amber-900/10',
    badge: 'bg-amber-100 text-amber-700',
  },
  {
    id: 'q4',
    urgent: false,
    important: false,
    labelAr: 'أجّله أو احذفه',
    labelEn: 'Eliminate',
    descAr: 'غير عاجل وغير مهم',
    descEn: 'Not Urgent, Not Important',
    icon: Trash2,
    color: 'text-slate-500',
    border: 'border-slate-200 dark:border-slate-700',
    bg: 'bg-slate-50/60 dark:bg-slate-800/20',
    badge: 'bg-slate-100 text-slate-600',
  },
];

export const PriorityMatrix: React.FC = () => {
  const { tasks } = useTasks();
  const { lang, dir } = useLanguage();

  const activeTasks = tasks.filter(t => t.status !== 'completed' && t.status !== 'cancelled');

  const getQuadrantTasks = (urgent: boolean, important: boolean) =>
    activeTasks.filter(t => isUrgent(t) === urgent && isImportant(t) === important);

  return (
    <div className="space-y-3" dir={dir}>
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-bold text-sm font-arabic text-foreground">
            {lang === 'ar' ? 'مصفوفة الأولويات' : 'Priority Matrix'}
          </h3>
          <p className="text-[11px] text-muted-foreground font-arabic">
            {lang === 'ar' ? 'ركّز على ما يهم فعلاً' : 'Eisenhower Matrix — focus on what matters'}
          </p>
        </div>
        <Badge variant="outline" className="text-xs font-mono">{activeTasks.length}</Badge>
      </div>

      <div className="grid grid-cols-2 gap-3">
        {QUADRANTS.map((q, idx) => {
          const qtasks = getQuadrantTasks(q.urgent, q.important);
          const Icon = q.icon;
          return (
            <motion.div
              key={q.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: idx * 0.07 }}
              className={cn('rounded-2xl border p-3 min-h-[140px]', q.bg, q.border)}
            >
              {/* Quadrant header */}
              <div className="flex items-center gap-1.5 mb-2">
                <Icon className={cn('w-3.5 h-3.5 flex-shrink-0', q.color)} />
                <div>
                  <p className={cn('text-xs font-bold font-arabic leading-none', q.color)}>
                    {lang === 'ar' ? q.labelAr : q.labelEn}
                  </p>
                  <p className="text-[9px] text-muted-foreground font-arabic">
                    {lang === 'ar' ? q.descAr : q.descEn}
                  </p>
                </div>
                {qtasks.length > 0 && (
                  <span className={cn('mr-auto text-[10px] font-bold px-1.5 py-0.5 rounded-full', q.badge)}>
                    {qtasks.length}
                  </span>
                )}
              </div>

              {/* Tasks */}
              <div className="space-y-1.5">
                {qtasks.slice(0, 4).map(task => (
                  <div
                    key={task.id}
                    className="flex items-start gap-1.5 bg-white/60 dark:bg-black/20 rounded-lg px-2 py-1.5"
                  >
                    <span className={cn('w-1.5 h-1.5 rounded-full flex-shrink-0 mt-1', q.color.replace('text-', 'bg-'))} />
                    <p className="text-[11px] font-arabic text-foreground leading-snug line-clamp-2">{task.title}</p>
                  </div>
                ))}
                {qtasks.length > 4 && (
                  <p className="text-[10px] text-muted-foreground font-arabic px-1">
                    +{qtasks.length - 4} {lang === 'ar' ? 'أخرى' : 'more'}
                  </p>
                )}
                {qtasks.length === 0 && (
                  <p className="text-[11px] text-muted-foreground font-arabic px-1">
                    {lang === 'ar' ? 'لا توجد مهام هنا' : 'No tasks here'}
                  </p>
                )}
              </div>
            </motion.div>
          );
        })}
      </div>

      <p className="text-[10px] text-muted-foreground font-arabic text-center">
        {lang === 'ar'
          ? '* عاجل = الاستحقاق خلال ٣ أيام · مهم = أولوية عالية أو متوسطة'
          : '* Urgent = due within 3 days · Important = high or medium priority'}
      </p>
    </div>
  );
};

export default PriorityMatrix;
