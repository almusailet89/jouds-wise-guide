import React, { useState } from 'react';
import { ChatInterface } from '@/components/Chat/ChatInterface';
import { VoicePanel } from '@/components/Voice/VoicePanel';
import { FinancialDashboard } from '@/components/Dashboard/FinancialDashboard';
import TasksPlanner from '@/components/Tasks/TasksPlanner';
import MoodTracker from '@/components/Mood/MoodTracker';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { MessageSquare, TrendingUp, Calendar, Heart, Brain, Settings } from "lucide-react";

const Dashboard = () => {
  const [activeTab, setActiveTab] = useState('chat');

  const handleVoiceMessage = (message: string) => {
    console.log('Voice message received:', message);
    // Handle voice messages here
  };

  const handleChatMessage = (message: string) => {
    console.log('Chat message received:', message);
    // Handle chat messages here
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5">
      {/* Header */}
      <header className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 rounded-full bg-gradient-to-r from-primary to-accent flex items-center justify-center">
              <Brain className="w-5 h-5 text-primary-foreground" />
            </div>
            <h1 className="text-2xl font-bold bg-gradient-to-r from-primary via-accent to-primary bg-clip-text text-transparent">
              Joud AI
            </h1>
          </div>
          <Button variant="outline" size="icon">
            <Settings className="h-4 w-4" />
          </Button>
        </div>
      </header>

      <div className="container mx-auto px-4 py-6">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          {/* Navigation Tabs */}
          <TabsList className="grid w-full grid-cols-5 lg:w-fit lg:grid-cols-5">
            <TabsTrigger value="chat" className="flex items-center space-x-2">
              <MessageSquare className="w-4 h-4" />
              <span className="hidden sm:inline">Chat</span>
            </TabsTrigger>
            <TabsTrigger value="financial" className="flex items-center space-x-2">
              <TrendingUp className="w-4 h-4" />
              <span className="hidden sm:inline">Financial</span>
            </TabsTrigger>
            <TabsTrigger value="tasks" className="flex items-center space-x-2">
              <Calendar className="w-4 h-4" />
              <span className="hidden sm:inline">Tasks</span>
            </TabsTrigger>
            <TabsTrigger value="mood" className="flex items-center space-x-2">
              <Heart className="w-4 h-4" />
              <span className="hidden sm:inline">Mood</span>
            </TabsTrigger>
            <TabsTrigger value="insights" className="flex items-center space-x-2">
              <Brain className="w-4 h-4" />
              <span className="hidden sm:inline">Insights</span>
            </TabsTrigger>
          </TabsList>

          {/* Chat Interface */}
          <TabsContent value="chat">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 h-[calc(100vh-200px)]">
              <div className="flex flex-col">
                <h2 className="text-lg font-semibold mb-4 flex items-center space-x-2">
                  <MessageSquare className="w-5 h-5" />
                  <span>Chat with Joud</span>
                </h2>
                <div className="flex-1 border rounded-lg overflow-hidden">
                  <ChatInterface onMessage={handleChatMessage} />
                </div>
              </div>
              
              <div className="flex flex-col">
                <h2 className="text-lg font-semibold mb-4 flex items-center space-x-2">
                  <Brain className="w-5 h-5" />
                  <span>Voice Assistant</span>
                </h2>
                <div className="flex-1">
                  <VoicePanel onVoiceMessage={handleVoiceMessage} />
                </div>
              </div>
            </div>
          </TabsContent>

          {/* Financial Dashboard */}
          <TabsContent value="financial">
            <div>
              <h2 className="text-2xl font-bold mb-6 flex items-center space-x-2">
                <TrendingUp className="w-6 h-6" />
                <span>Financial Dashboard</span>
              </h2>
              <FinancialDashboard />
            </div>
          </TabsContent>

          {/* Tasks & Planner */}
          <TabsContent value="tasks">
            <div>
              <h2 className="text-2xl font-bold mb-6 flex items-center space-x-2">
                <Calendar className="w-6 h-6" />
                <span>Tasks & Planner</span>
              </h2>
              <TasksPlanner />
            </div>
          </TabsContent>

          {/* Mood Tracker */}
          <TabsContent value="mood">
            <div>
              <h2 className="text-2xl font-bold mb-6 flex items-center space-x-2">
                <Heart className="w-6 h-6" />
                <span>Mood & Wellness</span>
              </h2>
              <MoodTracker />
            </div>
          </TabsContent>

          {/* Smart Insights */}
          <TabsContent value="insights">
            <div>
              <h2 className="text-2xl font-bold mb-6 flex items-center space-x-2">
                <Brain className="w-6 h-6" />
                <span>Smart Insights</span>
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="p-6 rounded-lg bg-gradient-to-br from-primary/10 to-accent/10 border">
                  <h3 className="text-lg font-semibold mb-3">Financial Insights</h3>
                  <ul className="space-y-2 text-sm">
                    <li>• Your savings rate has improved by 15% this month</li>
                    <li>• Consider increasing your ARAMCO position while it's trending up</li>
                    <li>• You're on track to meet your annual savings goal</li>
                  </ul>
                </div>
                
                <div className="p-6 rounded-lg bg-gradient-to-br from-accent/10 to-primary/10 border">
                  <h3 className="text-lg font-semibold mb-3">Behavioral Insights</h3>
                  <ul className="space-y-2 text-sm">
                    <li>• Your mood improves on days with financial check-ins</li>
                    <li>• Most productive hours: 9-11 AM for financial tasks</li>
                    <li>• Stress levels decrease after completing daily tasks</li>
                  </ul>
                </div>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default Dashboard;