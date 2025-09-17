import React, { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Mic, MicOff, Volume2, VolumeX } from "lucide-react";

interface VoicePanelProps {
  onVoiceMessage?: (message: string) => void;
}

export const VoicePanel: React.FC<VoicePanelProps> = ({ onVoiceMessage }) => {
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [volume, setVolume] = useState(0);

  useEffect(() => {
    // Startup greeting
    const greetUser = () => {
      setIsSpeaking(true);
      // Simulate speaking animation
      const interval = setInterval(() => {
        setVolume(Math.random() * 100);
      }, 100);

      setTimeout(() => {
        setIsSpeaking(false);
        setVolume(0);
        clearInterval(interval);
      }, 3000);
    };

    // Greet after component mounts
    const timer = setTimeout(greetUser, 500);
    return () => clearTimeout(timer);
  }, []);

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
    <Card className="h-full p-6 flex flex-col items-center justify-center bg-gradient-to-b from-background to-muted/20">
      {/* Avatar Circle */}
      <div className="relative mb-8">
        <div className={`
          w-32 h-32 rounded-full bg-gradient-to-r from-primary to-accent
          flex items-center justify-center transition-all duration-300
          ${isSpeaking ? 'scale-110 shadow-lg shadow-primary/30' : 'scale-100'}
          ${isListening ? 'ring-4 ring-primary/50 ring-pulse' : ''}
        `}>
          <div className="w-28 h-28 rounded-full bg-background flex items-center justify-center">
            <div className="text-4xl">🤖</div>
          </div>
        </div>

        {/* Glow Effect */}
        {(isSpeaking || isListening) && (
          <div className="absolute inset-0 rounded-full bg-primary/20 animate-pulse"></div>
        )}
      </div>

      {/* Waveform Visualization */}
      <div className="flex items-center justify-center space-x-1 mb-6 h-12">
        {[...Array(12)].map((_, i) => (
          <div
            key={i}
            className="bg-primary/60 rounded-full transition-all duration-100"
            style={{
              width: '3px',
              height: (isSpeaking || isListening) 
                ? `${Math.max(4, (Math.sin(Date.now() * 0.01 + i) + 1) * volume / 4)}px`
                : '4px'
            }}
          />
        ))}
      </div>

      {/* Status Text */}
      <div className="text-center mb-6">
        <h3 className="text-lg font-semibold mb-2">
          {isSpeaking ? "Joud is speaking..." : 
           isListening ? "Listening..." : 
           "Voice Assistant"}
        </h3>
        <p className="text-sm text-muted-foreground">
          {isSpeaking ? "Hello, I'm Joud, your personal financial assistant." :
           isListening ? "Speak now, I'm listening..." :
           "Tap the microphone to start voice conversation"}
        </p>
      </div>

      {/* Controls */}
      <div className="flex space-x-4">
        <Button
          onClick={toggleListening}
          variant={isListening ? "destructive" : "default"}
          size="lg"
          className="rounded-full w-16 h-16"
          disabled={isSpeaking}
        >
          {isListening ? <MicOff className="h-6 w-6" /> : <Mic className="h-6 w-6" />}
        </Button>
        
        <Button
          variant="outline"
          size="lg"
          className="rounded-full w-16 h-16"
          disabled={isSpeaking}
        >
          {isSpeaking ? <VolumeX className="h-6 w-6" /> : <Volume2 className="h-6 w-6" />}
        </Button>
      </div>

      {/* Voice Instructions */}
      <div className="mt-6 text-xs text-muted-foreground text-center max-w-sm">
        <p>Try saying: "Show me my financial summary" or "What are my tasks today?"</p>
      </div>
    </Card>
  );
};