import React, { useState } from 'react';
import { CalendarDays, LayoutKanban, Grid2x2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useLanguage } from '@/hooks/useLanguage';
import SmartCalendar from '@/components/Calendar/SmartCalendar';
import { KanbanBoard } from './KanbanBoard';
import { PriorityMatrix } from './PriorityMatrix';

type View = 'calendar' | 'kanban' | 'matrix';

const VIEWS: { id: View; labelAr: string; labelEn: string; icon: React.FC<any> }[] = [
  { id: 'calendar', labelAr: 'التقويم',      labelEn: 'Calendar', icon: CalendarDays },
  { id: 'kanban',   labelAr: 'لوحة المهام',  labelEn: 'Kanban',   icon: LayoutKanban },
  { id: 'matrix',   labelAr: 'مصفوفة الأولويات', labelEn: 'Matrix', icon: Grid2x2 },
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

      {/* View content */}
      {view === 'calendar' && <SmartCalendar />}
      {view === 'kanban'   && <KanbanBoard />}
      {view === 'matrix'   && <PriorityMatrix />}
    </div>
  );
};

export default PlanningHub;
