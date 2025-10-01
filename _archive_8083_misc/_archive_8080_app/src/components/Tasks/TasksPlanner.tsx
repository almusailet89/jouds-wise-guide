import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Plus, Calendar, Clock, Tag } from "lucide-react";
import { useTasks } from '@/hooks/useDatabase';

const TasksPlanner: React.FC = () => {
  const { tasks, loading, addTask, updateTask } = useTasks();
  const [newTask, setNewTask] = useState('');

  const categoryColors = {
    finance: 'bg-green-100 text-green-800 border-green-200',
    wellness: 'bg-blue-100 text-blue-800 border-blue-200',
    study: 'bg-purple-100 text-purple-800 border-purple-200',
    general: 'bg-gray-100 text-gray-800 border-gray-200'
  };

  const priorityColors = {
    high: 'border-l-red-500',
    medium: 'border-l-yellow-500',
    low: 'border-l-green-500'
  };

  const toggleTask = async (id: string) => {
    const task = tasks.find(t => t.id === id);
    if (!task) return;
    
    await updateTask(id, { 
      status: task.status === 'completed' ? 'pending' : 'completed',
      completed_at: task.status === 'pending' ? new Date().toISOString() : null
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
      due_date: new Date().toISOString().split('T')[0],
      completed_at: null
    });

    setNewTask('');
  };

  const completedTasks = tasks.filter(t => t.status === 'completed').length;
  const totalTasks = tasks.length;

  return (
    <div className="space-y-6">
      {/* Progress Overview */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>Today's Progress</span>
            <Badge variant="outline" className="text-sm">
              {completedTasks}/{totalTasks} completed
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="w-full bg-muted rounded-full h-2">
            <div
              className="bg-primary h-2 rounded-full transition-all duration-300"
              style={{ width: `${(completedTasks / totalTasks) * 100}%` }}
            />
          </div>
          <p className="text-sm text-muted-foreground mt-2">
            Great progress! {totalTasks - completedTasks} tasks remaining
          </p>
        </CardContent>
      </Card>

      {/* Add New Task */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex space-x-2">
            <Input
              placeholder="Add a new task..."
              value={newTask}
              onChange={(e) => setNewTask(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleAddTask()}
              className="flex-1"
              disabled={loading}
            />
            <Button onClick={handleAddTask} size="icon" disabled={loading || !newTask.trim()}>
              <Plus className="h-4 w-4" />
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Tasks List */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Calendar className="h-5 w-5" />
            <span>Your Tasks</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {loading ? (
            // Loading skeletons
            Array.from({ length: 3 }).map((_, index) => (
              <div key={index} className="p-4 rounded-lg border-l-4 bg-muted/30 animate-pulse">
                <div className="flex items-start space-x-3">
                  <div className="w-4 h-4 bg-muted rounded mt-1"></div>
                  <div className="flex-1">
                    <div className="h-4 bg-muted rounded mb-2"></div>
                    <div className="flex space-x-2">
                      <div className="h-6 bg-muted rounded w-16"></div>
                      <div className="h-6 bg-muted rounded w-20"></div>
                    </div>
                  </div>
                </div>
              </div>
            ))
          ) : tasks.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Calendar className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p className="text-lg font-medium mb-2">No tasks yet</p>
              <p className="text-sm">Add your first task above or say "Joud, note this add task to call the bank tomorrow"</p>
            </div>
          ) : (
            tasks.map((task) => (
              <div
                key={task.id}
                className={`p-4 rounded-lg border-l-4 bg-muted/30 ${priorityColors[task.priority]} 
                           ${task.status === 'completed' ? 'opacity-60' : ''}`}
              >
                <div className="flex items-start space-x-3">
                  <Checkbox
                    checked={task.status === 'completed'}
                    onCheckedChange={() => toggleTask(task.id)}
                    className="mt-1"
                  />
                  <div className="flex-1">
                    <p className={`font-medium ${task.status === 'completed' ? 'line-through' : ''}`}>
                      {task.title}
                    </p>
                    {task.description && (
                      <p className="text-sm text-muted-foreground mt-1">{task.description}</p>
                    )}
                    <div className="flex items-center space-x-2 mt-2">
                      <Badge
                        variant="outline"
                        className={`text-xs ${categoryColors[task.category as keyof typeof categoryColors] || categoryColors.general}`}
                      >
                        <Tag className="w-3 h-3 mr-1" />
                        {task.category}
                      </Badge>
                      {task.due_date && (
                        <Badge variant="outline" className="text-xs">
                          <Clock className="w-3 h-3 mr-1" />
                          {new Date(task.due_date).toLocaleDateString()}
                        </Badge>
                      )}
                      <Badge
                        variant="outline"
                        className={`text-xs ${
                          task.priority === 'high' ? 'text-red-600 border-red-200' :
                          task.priority === 'medium' ? 'text-yellow-600 border-yellow-200' :
                          'text-green-600 border-green-200'
                        }`}
                      >
                        {task.priority} priority
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
          <CardTitle>AI Suggested Tasks</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <div className="p-3 rounded-lg bg-primary/10 border border-primary/20">
              <p className="text-sm">💡 Based on your spending pattern, consider setting up automatic savings transfer</p>
            </div>
            <div className="p-3 rounded-lg bg-primary/10 border border-primary/20">
              <p className="text-sm">📊 Review your investment portfolio - ARAMCO is performing well this week</p>
            </div>
            <div className="p-3 rounded-lg bg-primary/10 border border-primary/20">
              <p className="text-sm">🏃‍♀️ You haven't logged wellness activities in 3 days - time for a walk?</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default TasksPlanner;