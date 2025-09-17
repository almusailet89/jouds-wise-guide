import React, { useState, useEffect, useRef } from 'react';
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Mic, MicOff, Volume2, VolumeX, Sparkles } from "lucide-react";
import { toast } from "sonner";

interface VoicePanelProps {
  onVoiceMessage?: (message: string) => void;
}

// Local Storage Manager for Joud AI
const JoudStorage = {
  saveUserProfile: (profile: any) => localStorage.setItem('joud_user_profile', JSON.stringify(profile)),
  getUserProfile: () => {
    const data = localStorage.getItem('joud_user_profile');
    return data ? JSON.parse(data) : { preferences: {}, routines: [], values: [] };
  },
  saveMood: (mood: string) => {
    const moods = JSON.parse(localStorage.getItem('joud_mood_log') || '[]');
    moods.push({ mood, timestamp: new Date().toISOString(), id: Date.now() });
    localStorage.setItem('joud_mood_log', JSON.stringify(moods));
  },
  getMoods: () => JSON.parse(localStorage.getItem('joud_mood_log') || '[]'),
  saveTask: (task: any) => {
    const tasks = JSON.parse(localStorage.getItem('joud_tasks') || '[]');
    tasks.push({ ...task, id: Date.now(), createdAt: new Date().toISOString() });
    localStorage.setItem('joud_tasks', JSON.stringify(tasks));
  },
  getTasks: () => JSON.parse(localStorage.getItem('joud_tasks') || '[]'),
  saveFinanceData: (data: any) => localStorage.setItem('joud_finance_data', JSON.stringify(data))
};

// Text-to-Speech Engine
const useSpeech = () => {
  const synth = useRef(window.speechSynthesis);
  
  const speak = (text: string, voice: 'elegant' | 'professional' = 'elegant') => {
    if (!synth.current) return;
    
    const utterance = new SpeechSynthesisUtterance(text);
    const voices = synth.current.getVoices();
    
    // Find a suitable female voice
    const femaleVoice = voices.find(v => 
      v.name.includes('Female') || v.name.includes('Samantha') || 
      v.name.includes('Karen') || v.name.includes('Zira')
    ) || voices[0];
    
    if (femaleVoice) utterance.voice = femaleVoice;
    utterance.rate = voice === 'elegant' ? 0.9 : 1.0;
    utterance.pitch = voice === 'elegant' ? 1.1 : 1.0;
    utterance.volume = 0.8;
    
    synth.current.speak(utterance);
    return utterance;
  };
  
  return { speak };
};

export const VoicePanel: React.FC<VoicePanelProps> = ({ onVoiceMessage }) => {
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [volume, setVolume] = useState(0);
  const [hasGreeted, setHasGreeted] = useState(false);
  const { speak } = useSpeech();

  useEffect(() => {
    // Startup greeting - must speak within 1s of UI load
    if (!hasGreeted) {
      const greetUser = () => {
        setIsSpeaking(true);
        
        // Start speaking animation
        const interval = setInterval(() => {
          setVolume(Math.random() * 100);
        }, 80);

        // Speak the greeting
        const greeting = "Hello, I'm Joud, your personal financial assistant. How may I help you today?";
        speak(greeting, 'elegant');
        
        // Show toast notification
        toast.success("Joud AI is ready to assist you", {
          description: "Your elegant financial secretary is now online."
        });

        setTimeout(() => {
          setIsSpeaking(false);
          setVolume(0);
          clearInterval(interval);
          setHasGreeted(true);
        }, 4000);
      };

      // Greet after 500ms (< 1s requirement)
      const timer = setTimeout(greetUser, 500);
      return () => clearTimeout(timer);
    }
  }, [hasGreeted, speak]);

  const toggleListening = () => {
    setIsListening(!isListening);
    if (!isListening) {
      // Start listening animation
      const interval = setInterval(() => {
        setVolume(Math.random() * 50);
      }, 100);

      // Stop after 3 seconds (simulate)
      setTimeout(() => {
        setIsListening(false);
        setVolume(0);
        clearInterval(interval);
        onVoiceMessage?.("I heard you say something about finances...");
      }, 3000);
    }
  };

  return (
    <Card className="h-full luxury-card p-8 flex flex-col items-center justify-center">
      {/* Luxury Avatar */}
      <div className="relative mb-8">
        <div className={`
          w-40 h-40 rounded-full bg-gradient-luxury
          flex items-center justify-center transition-luxury
          ${isSpeaking ? 'scale-110 avatar-glow' : 'scale-100'}
          ${isListening ? 'ring-4 ring-primary ring-opacity-60 animate-pulse' : ''}
        `}>
          <div className="w-36 h-36 rounded-full bg-gradient-to-b from-background to-muted/30 flex items-center justify-center shadow-elegant">
            <div className="relative">
              <div className="text-5xl">👩🏻‍💼</div>
              {isSpeaking && (
                <Sparkles className="absolute -top-2 -right-2 w-6 h-6 text-secondary animate-pulse" />
              )}
            </div>
          </div>
        </div>

        {/* Luxury Glow Effect */}
        {isSpeaking && (
          <div className="absolute inset-0 rounded-full bg-gradient-luxury opacity-30 animate-pulse blur-md"></div>
        )}
        
        {/* Listening Ring */}
        {isListening && (
          <div className="absolute inset-0 rounded-full border-4 border-primary animate-ping opacity-60"></div>
        )}
      </div>

      {/* Luxury Waveform Visualization */}
      <div className="flex items-center justify-center space-x-2 mb-8 h-16 px-4">
        {[...Array(15)].map((_, i) => (
          <div
            key={i}
            className="waveform-bar transition-all duration-75"
            style={{
              width: '4px',
              height: (isSpeaking || isListening) 
                ? `${Math.max(6, (Math.sin(Date.now() * 0.02 + i * 0.5) + 1) * volume / 3 + 10)}px`
                : '6px',
              animationDelay: `${i * 50}ms`
            }}
          />
        ))}
      </div>

      {/* Luxury Status Display */}
      <div className="text-center mb-8">
        <h3 className="text-xl font-semibold mb-3 bg-gradient-luxury bg-clip-text text-transparent">
          {isSpeaking ? "Joud is speaking..." : 
           isListening ? "I'm listening..." : 
           "Voice Assistant"}
        </h3>
        <p className="text-muted-foreground text-base leading-relaxed max-w-md">
          {isSpeaking ? "Your elegant financial secretary is ready to assist with premium insights and personalized guidance." :
           isListening ? "Please share your financial questions or goals..." :
           "Activate voice mode to experience Joud's sophisticated AI assistance"}
        </p>
      </div>

      {/* Luxury Controls */}
      <div className="flex space-x-6 mb-8">
        <Button
          onClick={toggleListening}
          variant={isListening ? "destructive" : "default"}
          size="lg"
          className="luxury-button rounded-full w-20 h-20 shadow-luxury hover:shadow-gold transition-luxury"
          disabled={isSpeaking}
        >
          {isListening ? <MicOff className="h-7 w-7" /> : <Mic className="h-7 w-7" />}
        </Button>
        
        <Button
          variant="outline"
          size="lg"
          className="rounded-full w-20 h-20 border-2 border-primary/30 hover:border-primary hover:bg-primary/10 transition-luxury shadow-elegant"
          disabled={isSpeaking}
        >
          {isSpeaking ? <VolumeX className="h-7 w-7 text-primary" /> : <Volume2 className="h-7 w-7 text-primary" />}
        </Button>
      </div>

      {/* Luxury Voice Suggestions */}
      <div className="text-center max-w-lg">
        <p className="text-sm text-muted-foreground font-medium mb-2">Elegant Voice Commands:</p>
        <div className="grid grid-cols-1 gap-2 text-xs text-muted-foreground">
          <p>"Show me my financial portfolio analysis"</p>
          <p>"What are my personalized investment suggestions?"</p>
          <p>"How am I progressing toward my savings goals?"</p>
        </div>
      </div>
    </Card>
  );
};