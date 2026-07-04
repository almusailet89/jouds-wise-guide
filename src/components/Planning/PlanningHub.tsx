import React, { lazy, Suspense, useState } from 'react';
import { CalendarDays, Kanban, Grid2x2, List } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useLanguage } from '@/hooks/useLanguage';

const SmartCalendar   = lazy(() => import('@/components/Calendar/SmartCalendar'));
const KanbanBoard     = lazy(() => import('@/components/Tasks/KanbanBoard'));
const PriorityMatrix  = lazy(() => import('./PriorityMatrix'));
const CalendarListView = lazy(() => import('@/components/Calendar/CalendarListView'));

const Skeleton = () => (
  <div className="space-y-3 animate-pulse">
    <div className="h-8 bg-muted/50 rounded-xl w-1/3" />
    <div className="h-32 bg-muted/30 rounded-2xl" />
    <div className="h-24 bg-muted/20 rounded-2xl" />
  </div>
);

type View = 'calendar' | 'kanban' | 'matrix' | 'list';

const VIEWS: { id: View; labelAr: string; labelEn: string; icon: React.FC<{ className?: string }> }[] = [
  { id: 'calendar', labelAr: 'التقويم',           labelEn: 'Calendar', icon: CalendarDays },
  { id: 'list',     labelAr: 'القائمة',            labelEn: 'List',     icon: List },
  { id: 'kanban',   labelAr: 'لوحة المهام',        labelEn: 'Kanban',   icon: Kanban },
  { id: 'matrix',   labelAr: 'مصفوفة الأولويات',  labelEn: 'Matrix',   icon: Grid2x2 },
];

const PlanningHub: React.FC = () => {
  const { lang, dir } = useLanguage();
  const [view, setView] = useState<View>('calendar');

  return (
    <div className="space-y-4" dir={dir}>
      {/* View toggle */}
      <div className="flex gap-1 p-1 bg-muted/40 rounded-xl border border-border/30 w-fit">
        {VIEWS.map(({ id, labelAr, labelEn, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setView(id)}
            className={cn(
              'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-arabic transition-all',
              view === id
                ? 'bg-card shadow-sm text-foreground font-semibold'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            <Icon className="w-3.5 h-3.5" />
            {lang === 'ar' ? labelAr : labelEn}
          </button>
        ))}
      </div>

      {/* Content */}
      <Suspense fallback={<Skeleton />}>
        {view === 'calendar' && <SmartCalendar />}
        {view === 'list'     && <CalendarListView />}
        {view === 'kanban'   && <KanbanBoard />}
        {view === 'matrix'   && <PriorityMatrix />}
      </Suspense>
    </div>
  );
};

export default PlanningHub;
