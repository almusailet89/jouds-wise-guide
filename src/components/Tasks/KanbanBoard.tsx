import React, { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { useTasks, Task } from '@/hooks/useDatabase';
import { useLanguage } from '@/hooks/useLanguage';
import {
  Plus, ChevronDown, ChevronRight, Trash2, Clock,
  AlertCircle, Minus, CheckCircle2, XCircle, Loader2,
} from 'lucide-react';
import { cn } from '@/lib/utils';

// ─── Column config ─────────────────────────────────────────────────────────────
type Status = Task['status'];

interface ColumnDef {
  status: Status;
  labelKey: string;
  icon: React.ReactNode;
  headerClass: string;
  dropClass: string;
}

const COLUMNS: ColumnDef[] = [
  {
    status: 'pending',
    labelKey: 'kanban.col.pending',
    icon: <Minus className="w-4 h-4" />,
    headerClass: 'bg-muted/60 border-border/40',
    dropClass: 'border-muted-foreground/30',
  },
  {
    status: 'in_progress',
    labelKey: 'kanban.col.in_progress',
    icon: <Loader2 className="w-4 h-4 animate-spin" />,
    headerClass: 'bg-jood-teal-500/10 border-jood-teal-500/30',
    dropClass: 'border-jood-teal-500/40',
  },
  {
    status: 'completed',
    labelKey: 'kanban.col.completed',
    icon: <CheckCircle2 className="w-4 h-4" />,
    headerClass: 'bg-emerald-500/10 border-emerald-500/30',
    dropClass: 'border-emerald-500/40',
  },
  {
    status: 'cancelled',
    labelKey: 'kanban.col.cancelled',
    icon: <XCircle className="w-4 h-4" />,
    headerClass: 'bg-rose-500/10 border-rose-500/30',
    dropClass: 'border-rose-500/40',
  },
];

const PRIORITY_COLORS: Record<string, string> = {
  high:   'text-rose-500 border-rose-300 bg-rose-50 dark:bg-rose-950/30',
  medium: 'text-amber-500 border-amber-300 bg-amber-50 dark:bg-amber-950/30',
  low:    'text-emerald-600 border-emerald-300 bg-emerald-50 dark:bg-emerald-950/30',
};

const PRIORITY_ICON: Record<string, React.ReactNode> = {
  high:   <AlertCircle className="w-3 h-3" />,
  medium: <Minus className="w-3 h-3" />,
  low:    <CheckCircle2 className="w-3 h-3" />,
};

// ─── Task card ─────────────────────────────────────────────────────────────────
interface TaskCardProps {
  task: Task;
  subtasks: Task[];
  onDragStart: (id: string) => void;
  onUpdateStatus: (id: string, status: Status) => void;
  onDelete: (id: string) => void;
  onAddSubtask: (parentId: string, title: string) => void;
  lang: 'ar' | 'en';
  t: (k: string) => string;
}

const TaskCard: React.FC<TaskCardProps> = ({
  task, subtasks, onDragStart, onUpdateStatus, onDelete, onAddSubtask, lang, t,
}) => {
  const [expanded, setExpanded] = useState(false);
  const [addingSubtask, setAddingSubtask] = useState(false);
  const [subtaskTitle, setSubtaskTitle] = useState('');
  const dir = lang === 'ar' ? 'rtl' : 'ltr';

  const handleAddSubtask = () => {
    if (!subtaskTitle.trim()) return;
    onAddSubtask(task.id, subtaskTitle.trim());
    setSubtaskTitle('');
    setAddingSubtask(false);
  };

  const dueDateStr = task.due_date
    ? new Date(task.due_date).toLocaleDateString(lang === 'ar' ? 'ar-SA' : 'en-US', { month: 'short', day: 'numeric' })
    : null;

  const isOverdue = task.due_date && task.status !== 'completed' && task.status !== 'cancelled'
    && new Date(task.due_date) < new Date();

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.96 }}
      transition={{ duration: 0.18 }}
      draggable
      onDragStart={() => onDragStart(task.id)}
      className={cn(
        'group bg-card border border-border/50 rounded-xl p-3 shadow-sm cursor-grab active:cursor-grabbing',
        'hover:shadow-md hover:border-border transition-all duration-150 select-none',
        task.status === 'completed' && 'opacity-60',
      )}
      dir={dir}
    >
      {/* Title row */}
      <div className="flex items-start gap-2">
        <p className={cn(
          'flex-1 text-sm font-arabic font-medium leading-snug',
          task.status === 'completed' && 'line-through text-muted-foreground',
        )}>
          {task.title}
        </p>
        <button
          onClick={() => onDelete(task.id)}
          className="opacity-0 group-hover:opacity-100 flex-shrink-0 text-muted-foreground hover:text-destructive transition-all mt-0.5"
          title={t('kanban.delete')}
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Meta row */}
      <div className="flex flex-wrap items-center gap-1.5 mt-2">
        <Badge
          variant="outline"
          className={cn('text-[10px] px-1.5 py-0 h-4 gap-0.5 font-arabic border', PRIORITY_COLORS[task.priority])}
        >
          {PRIORITY_ICON[task.priority]}
          {t(`kanban.priority.${task.priority}`)}
        </Badge>

        {dueDateStr && (
          <Badge
            variant="outline"
            className={cn(
              'text-[10px] px-1.5 py-0 h-4 gap-0.5 font-arabic',
              isOverdue ? 'text-rose-600 border-rose-300' : 'text-muted-foreground border-border/50',
            )}
          >
            <Clock className="w-2.5 h-2.5" />
            {dueDateStr}
          </Badge>
        )}

        {task.estimated_hours && (
          <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 text-muted-foreground border-border/50">
            {task.estimated_hours}h
          </Badge>
        )}
      </div>

      {/* Subtasks toggle */}
      {subtasks.length > 0 && (
        <button
          onClick={() => setExpanded(v => !v)}
          className="flex items-center gap-1 mt-2 text-[11px] text-muted-foreground hover:text-foreground transition-colors font-arabic"
        >
          {expanded ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
          {subtasks.length} {t('kanban.subtasks')}
          <span className="text-jood-teal-600">
            ({subtasks.filter(s => s.status === 'completed').length}/{subtasks.length})
          </span>
        </button>
      )}

      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="overflow-hidden"
          >
            <div className="mt-2 space-y-1 border-t border-border/40 pt-2">
              {subtasks.map(st => (
                <div key={st.id} className="flex items-center gap-2 group/sub">
                  <button
                    onClick={() => onUpdateStatus(st.id, st.status === 'completed' ? 'pending' : 'completed')}
                    className={cn(
                      'w-3.5 h-3.5 rounded-full border-2 flex-shrink-0 transition-colors',
                      st.status === 'completed'
                        ? 'bg-emerald-500 border-emerald-500'
                        : 'border-muted-foreground/40 hover:border-jood-teal-500',
                    )}
                  />
                  <span className={cn(
                    'text-[11px] font-arabic flex-1',
                    st.status === 'completed' && 'line-through text-muted-foreground',
                  )}>
                    {st.title}
                  </span>
                  <button
                    onClick={() => onDelete(st.id)}
                    className="opacity-0 group-hover/sub:opacity-100 text-muted-foreground hover:text-destructive"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Add subtask */}
      <div className="mt-2">
        {addingSubtask ? (
          <div className="flex gap-1">
            <Input
              autoFocus
              value={subtaskTitle}
              onChange={e => setSubtaskTitle(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter') handleAddSubtask();
                if (e.key === 'Escape') setAddingSubtask(false);
              }}
              placeholder={t('kanban.subtask.placeholder')}
              className="h-6 text-[11px] font-arabic px-2 py-0"
            />
            <Button size="icon" className="h-6 w-6 flex-shrink-0" onClick={handleAddSubtask}>
              <Plus className="w-3 h-3" />
            </Button>
          </div>
        ) : (
          <button
            onClick={() => { setAddingSubtask(true); setExpanded(true); }}
            className="opacity-0 group-hover:opacity-100 flex items-center gap-1 text-[10px] text-muted-foreground hover:text-jood-teal-600 transition-all font-arabic"
          >
            <Plus className="w-3 h-3" />
            {t('kanban.add.subtask')}
          </button>
        )}
      </div>
    </motion.div>
  );
};

// ─── Column ────────────────────────────────────────────────────────────────────
interface KanbanColumnProps {
  col: ColumnDef;
  tasks: Task[];
  allTasks: Task[];
  draggingId: string | null;
  onDragStart: (id: string) => void;
  onDrop: (status: Status) => void;
  onUpdateStatus: (id: string, status: Status) => void;
  onDelete: (id: string) => void;
  onAddTask: (status: Status, title: string) => void;
  onAddSubtask: (parentId: string, title: string) => void;
  lang: 'ar' | 'en';
  t: (k: string) => string;
}

const KanbanColumn: React.FC<KanbanColumnProps> = ({
  col, tasks, allTasks, draggingId, onDragStart, onDrop,
  onUpdateStatus, onDelete, onAddTask, onAddSubtask, lang, t,
}) => {
  const [isOver, setIsOver] = useState(false);
  const [adding, setAdding] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const dir = lang === 'ar' ? 'rtl' : 'ltr';

  const handleDragOver = (e: React.DragEvent) => { e.preventDefault(); setIsOver(true); };
  const handleDragLeave = () => setIsOver(false);
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsOver(false);
    onDrop(col.status);
  };

  const handleAdd = () => {
    if (!newTitle.trim()) return;
    onAddTask(col.status, newTitle.trim());
    setNewTitle('');
    setAdding(false);
  };

  // Only show top-level tasks in the column
  const topLevelTasks = tasks.filter(t => !t.parent_task_id);
  const getSubtasks = (parentId: string) => allTasks.filter(t => t.parent_task_id === parentId);

  return (
    <div
      className="flex flex-col min-w-[230px] max-w-[280px] flex-1"
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      dir={dir}
    >
      {/* Column header */}
      <div className={cn(
        'flex items-center justify-between px-3 py-2 rounded-xl border mb-2',
        col.headerClass,
      )}>
        <div className="flex items-center gap-2">
          <span className="text-muted-foreground">{col.icon}</span>
          <span className="text-sm font-semibold font-arabic">{t(col.labelKey)}</span>
        </div>
        <Badge variant="secondary" className="text-xs h-5 px-1.5 font-arabic">
          {topLevelTasks.length}
        </Badge>
      </div>

      {/* Drop zone */}
      <div className={cn(
        'flex-1 rounded-xl border-2 border-dashed p-2 space-y-2 min-h-[120px] transition-all duration-150',
        isOver ? `${col.dropClass} bg-muted/30 scale-[1.01]` : 'border-transparent',
      )}>
        <AnimatePresence>
          {topLevelTasks.map(task => (
            <TaskCard
              key={task.id}
              task={task}
              subtasks={getSubtasks(task.id)}
              onDragStart={onDragStart}
              onUpdateStatus={onUpdateStatus}
              onDelete={onDelete}
              onAddSubtask={onAddSubtask}
              lang={lang}
              t={t}
            />
          ))}
        </AnimatePresence>

        {topLevelTasks.length === 0 && !isOver && (
          <div className="flex items-center justify-center h-20 text-[11px] text-muted-foreground/50 font-arabic">
            {t('kanban.empty.col')}
          </div>
        )}

        {/* Add task inline */}
        {adding ? (
          <div className="bg-card border border-border/50 rounded-xl p-2 space-y-2">
            <Input
              autoFocus
              value={newTitle}
              onChange={e => setNewTitle(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter') handleAdd();
                if (e.key === 'Escape') setAdding(false);
              }}
              placeholder={t('kanban.add.placeholder')}
              className="h-7 text-xs font-arabic"
            />
            <div className="flex gap-1">
              <Button size="sm" className="h-6 text-xs flex-1 font-arabic" onClick={handleAdd}>
                {t('kanban.add.btn')}
              </Button>
              <Button size="sm" variant="ghost" className="h-6 text-xs font-arabic" onClick={() => setAdding(false)}>
                {t('kanban.cancel')}
              </Button>
            </div>
          </div>
        ) : (
          <button
            onClick={() => setAdding(true)}
            className="w-full flex items-center gap-1.5 px-2 py-1.5 rounded-lg text-xs text-muted-foreground hover:text-foreground hover:bg-muted/40 transition-all font-arabic"
          >
            <Plus className="w-3.5 h-3.5" />
            {t('kanban.add.card')}
          </button>
        )}
      </div>
    </div>
  );
};

// ─── KanbanBoard (main export) ─────────────────────────────────────────────────
export const KanbanBoard: React.FC = () => {
  const { tasks, loading, addTask, updateTask, deleteTask } = useTasks();
  const { t, lang } = useLanguage();
  const draggingId = useRef<string | null>(null);
  const [, forceUpdate] = useState(0);

  const handleDragStart = (id: string) => {
    draggingId.current = id;
    forceUpdate(v => v + 1);
  };

  const handleDrop = async (newStatus: Status) => {
    const id = draggingId.current;
    draggingId.current = null;
    forceUpdate(v => v + 1);
    if (!id) return;
    const task = tasks.find(t => t.id === id);
    if (!task || task.status === newStatus) return;
    await updateTask(id, {
      status: newStatus,
      completed_at: newStatus === 'completed' ? new Date().toISOString() : null,
    });
  };

  const handleUpdateStatus = async (id: string, status: Status) => {
    await updateTask(id, {
      status,
      completed_at: status === 'completed' ? new Date().toISOString() : null,
    });
  };

  const handleDelete = async (id: string) => {
    await deleteTask(id);
  };

  const handleAddTask = async (status: Status, title: string) => {
    await addTask({
      title,
      description: null,
      status,
      priority: 'medium',
      category: 'general',
      due_date: null,
      completed_at: status === 'completed' ? new Date().toISOString() : null,
      parent_task_id: null,
      estimated_hours: null,
      depends_on: null,
    });
  };

  const handleAddSubtask = async (parentId: string, title: string) => {
    const parent = tasks.find(t => t.id === parentId);
    await addTask({
      title,
      description: null,
      status: parent?.status ?? 'pending',
      priority: 'medium',
      category: 'general',
      due_date: null,
      completed_at: null,
      parent_task_id: parentId,
      estimated_hours: null,
      depends_on: null,
    });
  };

  if (loading) {
    return (
      <div className="flex gap-3 overflow-x-auto pb-4">
        {COLUMNS.map(col => (
          <div key={col.status} className="flex flex-col min-w-[230px] max-w-[280px] flex-1 gap-2">
            <div className="h-9 bg-muted/50 rounded-xl animate-pulse" />
            {[1, 2].map(i => (
              <div key={i} className="h-20 bg-muted/30 rounded-xl animate-pulse" />
            ))}
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="flex gap-3 overflow-x-auto pb-4 min-h-[400px]">
      {COLUMNS.map(col => {
        const colTasks = tasks.filter(t => t.status === col.status);
        return (
          <KanbanColumn
            key={col.status}
            col={col}
            tasks={colTasks}
            allTasks={tasks}
            draggingId={draggingId.current}
            onDragStart={handleDragStart}
            onDrop={handleDrop}
            onUpdateStatus={handleUpdateStatus}
            onDelete={handleDelete}
            onAddTask={handleAddTask}
            onAddSubtask={handleAddSubtask}
            lang={lang as 'ar' | 'en'}
            t={t}
          />
        );
      })}
    </div>
  );
};

export default KanbanBoard;
