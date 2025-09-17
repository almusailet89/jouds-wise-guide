import React, { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useSubscription } from '@/hooks/useSubscription';
import { Button } from '@/components/ui/button';
import { ChatInterface } from '@/components/Chat/ChatInterface';
import { VoicePanel } from '@/components/Voice/VoicePanel';
import { FinancialDashboard } from '@/components/Dashboard/FinancialDashboard';
import TasksPlanner from '@/components/Tasks/TasksPlanner';
import MoodTracker from '@/components/Mood/MoodTracker';
import { ExportPanel } from '@/components/Export/ExportPanel';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { MessageSquare, TrendingUp, Calendar, Heart, Brain, LogOut, User, Mic, Download, Settings } from "lucide-react";

const Dashboard = () => {
  const { user, signOut } = useAuth();
  const [activeTab, setActiveTab] = useState('overview');

  const handleSignOut = async () => {
    await signOut();
  };

  const handleVoiceMessage = (message: string) => {
    console.log('Voice message received:', message);
    // Handle voice messages here
  };

  const handleChatMessage = (message: string) => {
    console.log('Chat message received:', message);
    // Handle chat messages here
  };

  return (
    <div className="min-h-screen bg-gradient-primary">
      {/* Header */}
      <header className="border-b border-white/10 bg-card/10 backdrop-blur-sm">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-gradient-elegant flex items-center justify-center">
                <Brain className="w-5 h-5 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-white">Joud AI</h1>
                <p className="text-white/70 text-sm">Your Elegant Financial Secretary</p>
              </div>
            </div>
            
            <div className="flex items-center gap-4">
              <Dialog>
                <DialogTrigger asChild>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="bg-white/10 border-white/20 text-white hover:bg-white/20"
                  >
                    <Download className="w-4 h-4 mr-2" />
                    Export
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
                  <DialogHeader>
                    <DialogTitle>Export Data</DialogTitle>
                  </DialogHeader>
                  <ExportPanel />
                </DialogContent>
              </Dialog>
              
              <div className="flex items-center gap-2 text-white/80">
                <User className="w-4 h-4" />
                <span className="text-sm">{user?.email}</span>
              </div>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={handleSignOut}
                className="bg-white/10 border-white/20 text-white hover:bg-white/20"
              >
                <LogOut className="w-4 h-4 mr-2" />
                Sign Out
              </Button>
            </div>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-6">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          {/* Navigation Tabs */}
          <TabsList className="grid w-full grid-cols-5 bg-card/20 backdrop-blur-sm border border-white/10">
            <TabsTrigger value="overview" className="flex items-center gap-2">
              <Brain className="w-4 h-4" />
              <span className="hidden sm:inline">Overview</span>
            </TabsTrigger>
            <TabsTrigger value="chat" className="flex items-center gap-2">
              <MessageSquare className="w-4 h-4" />
              <span className="hidden sm:inline">Chat</span>
            </TabsTrigger>
            <TabsTrigger value="financial" className="flex items-center gap-2">
              <TrendingUp className="w-4 h-4" />
              <span className="hidden sm:inline">Finance</span>
            </TabsTrigger>
            <TabsTrigger value="tasks" className="flex items-center gap-2">
              <Calendar className="w-4 h-4" />
              <span className="hidden sm:inline">Tasks</span>
            </TabsTrigger>
            <TabsTrigger value="mood" className="flex items-center gap-2">
              <Heart className="w-4 h-4" />
              <span className="hidden sm:inline">Mood</span>
            </TabsTrigger>
            <TabsTrigger value="voice" className="flex items-center gap-2">
              <Mic className="w-4 h-4" />
              <span className="hidden sm:inline">Voice</span>
            </TabsTrigger>
          </TabsList>

          {/* Overview Tab */}
          <TabsContent value="overview" className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              <Card className="bg-card/80 backdrop-blur border-white/10">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-foreground">
                    <MessageSquare className="w-5 h-5 text-primary" />
                    AI Assistant
                  </CardTitle>
                  <CardDescription>
                    Your intelligent conversation partner ready to help
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Button 
                    onClick={() => setActiveTab('chat')}
                    className="w-full"
                  >
                    Start Chatting
                  </Button>
                </CardContent>
              </Card>

              <Card className="bg-card/80 backdrop-blur border-white/10">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-foreground">
                    <TrendingUp className="w-5 h-5 text-accent" />
                    Financial Health
                  </CardTitle>
                  <CardDescription>
                    Track your financial progress and insights
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Button 
                    onClick={() => setActiveTab('financial')}
                    className="w-full"
                  >
                    View Dashboard
                  </Button>
                </CardContent>
              </Card>

              <Card className="bg-card/80 backdrop-blur border-white/10">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-foreground">
                    <Mic className="w-5 h-5 text-secondary" />
                    Voice Interface
                  </CardTitle>
                  <CardDescription>
                    Speak naturally with Joud AI
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Button 
                    onClick={() => setActiveTab('voice')}
                    className="w-full"
                  >
                    Activate Voice
                  </Button>
                </CardContent>
              </Card>
            </div>

            <Card className="bg-card/80 backdrop-blur border-white/10">
              <CardHeader>
                <CardTitle className="text-foreground">Welcome back!</CardTitle>
                <CardDescription>
                  Joud AI is ready to assist you with financial planning, task management, 
                  mood tracking, and intelligent conversations.
                </CardDescription>
              </CardHeader>
            </Card>
          </TabsContent>

          {/* Chat Interface */}
          <TabsContent value="chat">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 h-[calc(100vh-200px)]">
              <div className="flex flex-col">
                <h2 className="text-lg font-semibold mb-4 flex items-center space-x-2 text-white">
                  <MessageSquare className="w-5 h-5" />
                  <span>Chat with Joud</span>
                </h2>
                <div className="flex-1 border rounded-lg overflow-hidden">
                  <ChatInterface onMessage={handleChatMessage} />
                </div>
              </div>
              
              <div className="flex flex-col">
                <h2 className="text-lg font-semibold mb-4 flex items-center space-x-2 text-white">
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
              <h2 className="text-2xl font-bold mb-6 flex items-center space-x-2 text-white">
                <TrendingUp className="w-6 h-6" />
                <span>Financial Dashboard</span>
              </h2>
              <FinancialDashboard />
            </div>
          </TabsContent>

          {/* Tasks & Planner */}
          <TabsContent value="tasks">
            <div>
              <h2 className="text-2xl font-bold mb-6 flex items-center space-x-2 text-white">
                <Calendar className="w-6 h-6" />
                <span>Tasks & Planner</span>
              </h2>
              <TasksPlanner />
            </div>
          </TabsContent>

          {/* Mood Tracker */}
          <TabsContent value="mood">
            <div>
              <h2 className="text-2xl font-bold mb-6 flex items-center space-x-2 text-white">
                <Heart className="w-6 h-6" />
                <span>Mood & Wellness</span>
              </h2>
              <MoodTracker />
            </div>
          </TabsContent>

          {/* Voice Interface */}
          {/* Voice Interface */}
          <TabsContent value="voice">
            <div>
              <h2 className="text-2xl font-bold mb-6 flex items-center space-x-2 text-white">
                <Mic className="w-6 h-6" />
                <span>Voice Assistant</span>
              </h2>
              <VoicePanel onVoiceMessage={handleVoiceMessage} />
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default Dashboard;