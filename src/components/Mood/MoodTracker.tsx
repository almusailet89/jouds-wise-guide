import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Heart, TrendingUp, Calendar, BarChart3 } from "lucide-react";

interface MoodEntry {
  id: string;
  mood: string;
  emoji: string;
  timestamp: Date;
  note?: string;
}

const MoodTracker: React.FC = () => {
  const [currentMood, setCurrentMood] = useState<string>('');
  const [moodEntries, setMoodEntries] = useState<MoodEntry[]>([
    {
      id: '1',
      mood: 'Great',
      emoji: '😊',
      timestamp: new Date(Date.now() - 86400000), // Yesterday
      note: 'Had a productive day with my investments'
    },
    {
      id: '2',
      mood: 'Okay',
      emoji: '🙂',
      timestamp: new Date(Date.now() - 172800000), // 2 days ago
    },
    {
      id: '3',
      mood: 'Stressed',
      emoji: '😰',
      timestamp: new Date(Date.now() - 259200000), // 3 days ago
      note: 'Market volatility made me anxious'
    },
    {
      id: '4',
      mood: 'Great',
      emoji: '😊',
      timestamp: new Date(Date.now() - 345600000), // 4 days ago
    }
  ]);

  const moodOptions = [
    { mood: 'Great', emoji: '😊', color: 'bg-green-100 text-green-800 border-green-200' },
    { mood: 'Okay', emoji: '🙂', color: 'bg-yellow-100 text-yellow-800 border-yellow-200' },
    { mood: 'Low', emoji: '😕', color: 'bg-orange-100 text-orange-800 border-orange-200' },
    { mood: 'Stressed', emoji: '😰', color: 'bg-red-100 text-red-800 border-red-200' }
  ];

  const logMood = (mood: string, emoji: string) => {
    const newEntry: MoodEntry = {
      id: Date.now().toString(),
      mood,
      emoji,
      timestamp: new Date()
    };

    setMoodEntries([newEntry, ...moodEntries]);
    setCurrentMood(mood);
  };

  const getMoodStats = () => {
    const last7Days = moodEntries.filter(
      entry => entry.timestamp > new Date(Date.now() - 7 * 86400000)
    );
    
    const moodCounts = last7Days.reduce((acc, entry) => {
      acc[entry.mood] = (acc[entry.mood] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const dominantMood = Object.entries(moodCounts)
      .sort(([,a], [,b]) => b - a)[0];

    return {
      totalEntries: last7Days.length,
      dominantMood: dominantMood ? dominantMood[0] : 'No data',
      streak: calculateStreak()
    };
  };

  const calculateStreak = () => {
    // Simple streak calculation - consecutive "Great" moods
    let streak = 0;
    for (const entry of moodEntries) {
      if (entry.mood === 'Great') {
        streak++;
      } else {
        break;
      }
    }
    return streak;
  };

  const stats = getMoodStats();

  return (
    <div className="space-y-6">
      {/* Current Mood Selection */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Heart className="h-5 w-5 text-primary" />
            <span>How are you feeling today?</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {moodOptions.map(({ mood, emoji, color }) => (
              <Button
                key={mood}
                variant="outline"
                className={`h-20 flex-col space-y-2 ${currentMood === mood ? color : ''}`}
                onClick={() => logMood(mood, emoji)}
              >
                <span className="text-2xl">{emoji}</span>
                <span className="text-sm">{mood}</span>
              </Button>
            ))}
          </div>
          {currentMood && (
            <div className="mt-4 p-3 rounded-lg bg-primary/10 border border-primary/20">
              <p className="text-sm">✨ Mood logged! Remember, it's okay to have ups and downs.</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Mood Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-2xl font-bold">{stats.totalEntries}</p>
                <p className="text-sm text-muted-foreground">Entries this week</p>
              </div>
              <Calendar className="h-8 w-8 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-2xl font-bold">{stats.dominantMood}</p>
                <p className="text-sm text-muted-foreground">Most common mood</p>
              </div>
              <BarChart3 className="h-8 w-8 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-2xl font-bold">{stats.streak}</p>
                <p className="text-sm text-muted-foreground">Great mood streak</p>
              </div>
              <TrendingUp className="h-8 w-8 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Mood History */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Mood Entries</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {moodEntries.slice(0, 7).map((entry) => (
              <div
                key={entry.id}
                className="flex items-center space-x-4 p-3 rounded-lg bg-muted/30"
              >
                <span className="text-2xl">{entry.emoji}</span>
                <div className="flex-1">
                  <div className="flex items-center space-x-2">
                    <Badge variant="outline" className={
                      moodOptions.find(m => m.mood === entry.mood)?.color || ''
                    }>
                      {entry.mood}
                    </Badge>
                    <span className="text-sm text-muted-foreground">
                      {entry.timestamp.toLocaleDateString()}
                    </span>
                  </div>
                  {entry.note && (
                    <p className="text-sm text-muted-foreground mt-1">{entry.note}</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* AI Insights */}
      <Card>
        <CardHeader>
          <CardTitle>Mood Insights</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <div className="p-3 rounded-lg bg-blue-50 border border-blue-200">
              <p className="text-sm text-blue-800">
                🔍 <strong>Pattern detected:</strong> Your mood tends to improve on days when you check your financial progress.
              </p>
            </div>
            <div className="p-3 rounded-lg bg-green-50 border border-green-200">
              <p className="text-sm text-green-800">
                💪 <strong>Recommendation:</strong> Consider adding 5 minutes of meditation to your morning routine for better stress management.
              </p>
            </div>
            <div className="p-3 rounded-lg bg-purple-50 border border-purple-200">
              <p className="text-sm text-purple-800">
                📊 <strong>Trend:</strong> Your mood stability has improved 23% since you started tracking your finances regularly.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default MoodTracker;