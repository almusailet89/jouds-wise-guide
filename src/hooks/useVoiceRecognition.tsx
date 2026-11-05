import { useState, useRef, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from './use-toast';
import { bi } from '@/lib/i18n';

interface UseVoiceRecognitionProps {
  onTranscription: (text: string) => void;
  onError?: (error: string) => void;
}

export const useVoiceRecognition = ({ onTranscription, onError }: UseVoiceRecognitionProps) => {
  const [isListening, setIsListening] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const { toast } = useToast();

  const startListening = useCallback(async () => {
    try {
      console.log('Starting voice recognition...');
      
      // Request microphone permission
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          sampleRate: 16000,
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        } 
      });

      // Create MediaRecorder
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: 'audio/webm;codecs=opus'
      });
      
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        console.log('Recording stopped, processing audio...');
        setIsProcessing(true);
        
        try {
          // Create audio blob
          const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
          
          // Convert to base64
          const reader = new FileReader();
          reader.onloadend = async () => {
            const base64Audio = (reader.result as string).split(',')[1];
            
            try {
              // Send to speech-to-text function
              const { data, error } = await supabase.functions.invoke('speech-to-text', {
                body: { audio: base64Audio }
              });

              if (error) {
                console.error('Speech-to-text error:', error);
                throw new Error('Failed to transcribe audio');
              }

              if (data?.text && data.text.trim()) {
                console.log('Transcription result:', data.text);
                onTranscription(data.text);
              } else {
                toast({
                  title: bi('لم نسمع شيئاً', 'We didn\'t hear anything'),
                  description: bi('تحدّث بالقرب من الميكروفون ثم حاول مرة أخرى.', 'Speak close to the microphone, then try again.'),
                  variant: "destructive",
                });
              }
            } catch (error) {
              console.error('Transcription error:', error);
              const errorMessage = error instanceof Error ? error.message : 'Failed to process speech';
              onError?.(errorMessage);
              toast({
                title: bi('تعذّر فهم التسجيل', 'Couldn\'t understand the recording'),
                description: bi('حاول مرة أخرى بعد قليل.', 'Please try again in a moment.'),
                variant: "destructive",
              });
            } finally {
              setIsProcessing(false);
            }
          };
          
          reader.readAsDataURL(audioBlob);
        } catch (error) {
          console.error('Audio processing error:', error);
          setIsProcessing(false);
          const errorMessage = error instanceof Error ? error.message : 'Failed to process audio';
          onError?.(errorMessage);
        }

        // Stop all tracks
        stream.getTracks().forEach(track => track.stop());
      };

      // Start recording
      mediaRecorder.start();
      setIsListening(true);
      
      console.log('Voice recognition started successfully');
      
    } catch (error) {
      console.error('Error starting voice recognition:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to access microphone';
      onError?.(errorMessage);
      toast({
        title: bi('الميكروفون غير مسموح', 'Microphone access is off'),
        description: bi('اسمح بالميكروفون لهذا الموقع من إعدادات المتصفح.', 'Allow microphone access for this site in your browser settings.'),
        variant: "destructive",
      });
    }
  }, [onTranscription, onError, toast]);

  const stopListening = useCallback(() => {
    console.log('Stopping voice recognition...');
    
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.stop();
    }
    
    setIsListening(false);
  }, []);

  const toggleListening = useCallback(() => {
    if (isListening) {
      stopListening();
    } else {
      startListening();
    }
  }, [isListening, startListening, stopListening]);

  return {
    isListening,
    isProcessing,
    startListening,
    stopListening,
    toggleListening
  };
};