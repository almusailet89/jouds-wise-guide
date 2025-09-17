import React, { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Volume2, Send, Loader2, Check, X, Edit3 } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useAI, ChatMessage } from '@/hooks/useAI';
import { useSubscription } from '@/hooks/useSubscription';
import { useToast } from '@/hooks/use-toast';

interface ChatInterfaceProps {
  onMessage?: (message: string) => void;
}

export const ChatInterface: React.FC<ChatInterfaceProps> = ({ onMessage }) => {
  const { session } = useAuth();
  const { sendMessage, speakMessage, loading, speaking } = useAI();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [pendingFunction, setPendingFunction] = useState<any>(null);
  const [awaitingConfirmation, setAwaitingConfirmation] = useState(false);
  const { canAccessFeature } = useSubscription();
  const { toast } = useToast();
  const scrollAreaRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    if (scrollAreaRef.current) {
      const scrollContainer = scrollAreaRef.current.querySelector('[data-radix-scroll-area-viewport]');
      if (scrollContainer) {
        scrollContainer.scrollTop = scrollContainer.scrollHeight;
      }
    }
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSendMessage = async (customInput?: string, mode?: string) => {
    const messageContent = customInput || input.trim();
    if (!messageContent || loading) return;

    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: messageContent,
      timestamp: new Date().toISOString(),
    };

    setMessages(prev => [...prev, userMessage]);
    if (!customInput) setInput('');
    onMessage?.(messageContent);

    try {
      const response = await sendMessage(messageContent, messages, mode, pendingFunction);
      
      const aiMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: typeof response === 'string' ? response : response.message || 'No response received',
        timestamp: new Date().toISOString(),
      };

      setMessages(prev => [...prev, aiMessage]);

      // Handle function results for preview mode
      if (response && typeof response === 'object' && response.function_results?.preview_mode) {
        setPendingFunction(response.function_results.function_call);
        setAwaitingConfirmation(true);
      } else if (response && typeof response === 'object' && response.mode === 'commit') {
        setPendingFunction(null);
        setAwaitingConfirmation(false);
        
        // Show success toast
        if (response.function_results && typeof response.function_results === 'string') {
          toast({
            title: "Action Completed",
            description: response.function_results,
            duration: 3000,
          });
        }
      }
    } catch (error) {
      console.error('Error sending message:', error);
    }
  };

  const handleConfirmation = (action: 'yes' | 'no' | 'edit') => {
    if (action === 'yes') {
      handleSendMessage('yes', 'commit');
    } else if (action === 'no') {
      handleSendMessage('no');
      setPendingFunction(null);
      setAwaitingConfirmation(false);
    } else if (action === 'edit') {
      setAwaitingConfirmation(false);
      toast({
        title: "Edit Mode",
        description: "Please type your corrections and I'll update the preview.",
        duration: 3000,
      });
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const handleSpeakMessage = async (content: string) => {
    if (!canAccessFeature('voice')) {
      toast({
        title: "Premium Feature",
        description: "Text-to-speech is available for premium subscribers.",
        variant: "destructive",
      });
      return;
    }

    try {
      await speakMessage(content);
    } catch (error) {
      console.error('Error speaking message:', error);
    }
  };

  return (
    <div className="flex flex-col h-full max-w-4xl mx-auto">
      {/* Messages */}
      <ScrollArea ref={scrollAreaRef} className="flex-1 p-4 space-y-4">
        {messages.length === 0 && (
          <div className="text-center text-muted-foreground py-8">
            <p className="text-lg mb-2">Hi! I'm Jood, your AI assistant.</p>
            <p>Ask me anything about your finances, investments, or life planning!</p>
            <div className="mt-4 p-4 bg-muted/50 rounded-lg">
              <p className="text-sm font-medium mb-2">💡 Try saying:</p>
              <p className="text-sm">"Jood, note this I spent $50 on lunch today"</p>
              <p className="text-sm">"Jood, note this add task to call the bank tomorrow"</p>
            </div>
          </div>
        )}
        
        {messages.map((message) => (
          <div key={message.id} className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <Card className={`max-w-[80%] ${
              message.role === 'user' 
                ? 'bg-primary text-primary-foreground' 
                : 'bg-card border-border/50'
            }`}>
              <CardContent className="p-4">
                <div className="flex items-start justify-between">
                  <div className="flex-1 whitespace-pre-wrap">
                    {message.content}
                  </div>
                  {message.role === 'assistant' && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="ml-2 opacity-70 hover:opacity-100"
                      onClick={() => handleSpeakMessage(message.content)}
                      disabled={speaking}
                    >
                      <Volume2 className="w-4 h-4" />
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        ))}

        {/* Confirmation Buttons */}
        {awaitingConfirmation && (
          <div className="flex justify-center">
            <Card className="bg-accent/50 border-2 border-primary/20">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-center">Confirm Action</CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="flex space-x-2 justify-center">
                  <Button
                    size="sm"
                    onClick={() => handleConfirmation('yes')}
                    className="bg-green-600 hover:bg-green-700 text-white"
                  >
                    <Check className="w-4 h-4 mr-1" />
                    Yes
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleConfirmation('edit')}
                  >
                    <Edit3 className="w-4 h-4 mr-1" />
                    Edit
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleConfirmation('no')}
                  >
                    <X className="w-4 h-4 mr-1" />
                    No
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Thinking indicator */}
        {loading && (
          <div className="flex justify-start">
            <Card className="bg-card border-border/50">
              <CardContent className="p-4">
                <div className="flex items-center space-x-2">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span className="text-muted-foreground">Jood is thinking...</span>
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </ScrollArea>

      {/* Input */}
      <div className="border-t bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 p-4">
        <div className="flex space-x-2">
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder={awaitingConfirmation ? "Type 'edit' to modify or use buttons above..." : "Try: 'Jood, note this I spent $20 on coffee'"}
            disabled={loading}
            className="flex-1"
          />
          <Button 
            onClick={() => handleSendMessage()} 
            disabled={loading || !input.trim()}
            size="icon"
          >
            {loading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Send className="w-4 h-4" />
            )}
          </Button>
        </div>
      </div>
    </div>
  );
};