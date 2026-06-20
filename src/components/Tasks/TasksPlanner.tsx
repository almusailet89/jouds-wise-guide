import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Plus, Calendar, Clock, Tag } from "lucide-react";
import { useTasks } from '@/hooks/useDatabase';
import { useLanguage } from '@/hooks/useLanguage';

const categoryColors = {
  finance:   'bg-green-100 text-green-800 border-green-200',
  wellness:  'bg-blue-100 text-blue-800 border-blue-200',
  study:     'bg-purple-100 text-purple-800 border-purple-200',
  general:   'bg-gray-100 text-gray-800 border-gray-200',
};

const priorityColors = {
  high:   'border-l-red-500',
  medium: 'border-l-yellow-500',
  low:    'border-l-green-500',
};

const TasksPlanner: React.FC = () => {
  const { tasks, loading, addTask, updateTask } = useTasks();
  const { t, lang, dir } = useLanguage();
  const [newTask, setNewTask] = useState('');
  const [dueDate, setDueDate] = useState(new Date().toISOString().split('T')[0]);

  const toggleTask = async (id: string) => {
    const task = tasks.find(t => t.id === id);
    if (!task) return;
    await updateTask(id, {
      status: task.status === 'completed' ? 'pending' : 'completed',
      completed_at: task.status === 'pending' ? new Date().toISOString() : null,
    });
  };

  const handleAddTask = async () => {
    if (!newTask.trim()) return;
    await addTask({
      title: newTask,
      description: null,
      status: 'pending',
      priority: 'medium',
      category: 'general',
      due_date: dueDate,
      completed_at: null,
    });
    setNewTask('');
    setDueDate(new Date().toISOString().split('T')[0]);
  };

  const completedTasks = tasks.filter(t => t.status === 'completed').length;
  const totalTasks = tasks.length;
  const remaining = totalTasks - completedTasks;

  const priorityLabel = (p: string) => {
    if (p === 'high')   return t('tasks.priority.high');
    if (p === 'medium') return t('tasks.priority.medium');
    return t('tasks.priority.low');
  };

  const dueDateLocale = lang === 'ar' ? 'ar-SA' : 'en-US';

  return (
    <div className="space-y-6" dir={dir}>
      {/* Progress Overview */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between font-arabic">
            <span>{t('tasks.progress.title')}</span>
            <Badge variant="outline" className="text-sm font-arabic">
              {completedTasks}/{totalTasks} {t('tasks.progress.completed')}
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="w-full bg-muted rounded-full h-2">
            <div
              className="bg-primary h-2 rounded-full transition-all duration-300"
              style={{ width: `${totalTasks ? (completedTasks / totalTasks) * 100 : 0}%` }}
            />
          </div>
          <p className="text-sm text-muted-foreground mt-2 font-arabic">
            {remaining} {t('tasks.progress.remaining')}
          </p>
        </CardContent>
      </Card>

      {/* Add New Task */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col gap-2">
            <div className="flex gap-2">
              <Input
                placeholder={t('tasks.add.placeholder')}
                value={newTask}
                onChange={(e) => setNewTask(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleAddTask()}
                className="flex-1 font-arabic"
                disabled={loading}
              />
              <Button onClick={handleAddTask} size="icon" disabled={loading || !newTask.trim()}>
                <Plus className="h-4 w-4" />
              </Button>
            </div>
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-muted-foreground flex-shrink-0" />
              <Input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="w-auto text-sm"
                disabled={loading}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tasks List */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 font-arabic">
            <Calendar className="h-5 w-5" />
            <span>{t('tasks.list.title')}</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {loading ? (
            Array.from({ length: 3 }).map((_, index) => (
              <div key={index} className="p-4 rounded-lg border-l-4 bg-muted/30 animate-pulse">
                <div className="flex items-start gap-3">
                  <div className="w-4 h-4 bg-muted rounded mt-1" />
                  <div className="flex-1">
                    <div className="h-4 bg-muted rounded mb-2" />
                    <div className="flex gap-2">
                      <div className="h-6 bg-muted rounded w-16" />
                      <div className="h-6 bg-muted rounded w-20" />
                    </div>
                  </div>
                </div>
              </div>
            ))
          ) : tasks.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Calendar className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p className="text-lg font-medium mb-2 font-arabic">{t('tasks.empty.title')}</p>
              <p className="text-sm font-arabic">{t('tasks.empty.hint')}</p>
            </div>
          ) : (
            tasks.map((task) => (
              <div
                key={task.id}
                className={`p-4 rounded-lg border-l-4 bg-muted/30 ${priorityColors[task.priority as keyof typeof priorityColors] ?? priorityColors.medium}
                           ${task.status === 'completed' ? 'opacity-60' : ''}`}
              >
                <div className="flex items-start gap-3">
                  <Checkbox
                    checked={task.status === 'completed'}
                    onCheckedChange={() => toggleTask(task.id)}
                    className="mt-1"
                  />
                  <div className="flex-1">
                    <p className={`font-medium font-arabic ${task.status === 'completed' ? 'line-through' : ''}`}>
                      {task.title}
                    </p>
                    {task.description && (
                      <p className="text-sm text-muted-foreground mt-1 font-arabic">{task.description}</p>
                    )}
                    <div className="flex items-center gap-2 mt-2 flex-wrap">
                      <Badge
                        variant="outline"
                        className={`text-xs ${categoryColors[task.category as keyof typeof categoryColors] ?? categoryColors.general}`}
                      >
                        <Tag className="w-3 h-3 mr-1" />
                        {task.category}
                      </Badge>
                      {task.due_date && (
                        <Badge variant="outline" className="text-xs">
                          <Clock className="w-3 h-3 mr-1" />
                          {new Date(task.due_date).toLocaleDateString(dueDateLocale)}
                        </Badge>
                      )}
                      <Badge
                        variant="outline"
                        className={`text-xs font-arabic ${
                          task.priority === 'high'   ? 'text-red-600 border-red-200' :
                          task.priority === 'medium' ? 'text-yellow-600 border-yellow-200' :
                          'text-green-600 border-green-200'
                        }`}
                      >
                        {priorityLabel(task.priority)}
                      </Badge>
                    </div>
                  </div>
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      {/* AI Suggestions */}
      <Card>
        <CardHeader>
          <CardTitle className="font-arabic">{t('tasks.ai.title')}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <div className="p-3 rounded-lg bg-primary/10 border border-primary/20">
              <p className="text-sm font-arabic">{t('tasks.ai.savings')}</p>
            </div>
            <div className="p-3 rounded-lg bg-primary/10 border border-primary/20">
              <p className="text-sm font-arabic">{t('tasks.ai.portfolio')}</p>
            </div>
            <div className="p-3 rounded-lg bg-primary/10 border border-primary/20">
              <p className="text-sm font-arabic">{t('tasks.ai.wellness')}</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default TasksPlanner;
