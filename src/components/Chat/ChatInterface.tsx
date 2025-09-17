import { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useAI, ChatMessage } from '@/hooks/useAI';
import { useSubscription } from '@/hooks/useSubscription';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { MessageSquare, Send, Volume2, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface ChatInterfaceProps {
  onMessage?: (message: string) => void;
}

export const ChatInterface = ({ onMessage }: ChatInterfaceProps) => {
  const { user } = useAuth();
  const { canAccessFeature } = useSubscription();
  const { sendMessage, speakMessage, loading, speaking } = useAI();
  const { toast } = useToast();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputMessage, setInputMessage] = useState('');
  const [isFirstLoad, setIsFirstLoad] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Joud's greeting only when user explicitly requests it
  useEffect(() => {
    if (isFirstLoad && user) {
      setIsFirstLoad(false);
    }
  }, [user, isFirstLoad]);

  const handleSendMessage = async () => {
    if (!inputMessage.trim() || loading) return;

    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: inputMessage.trim(),
      timestamp: new Date().toISOString(),
    };

    const updatedMessages = [...messages, userMessage];
    setMessages(updatedMessages);
    onMessage?.(inputMessage.trim());
    setInputMessage('');

    try {
      const response = await sendMessage(inputMessage.trim(), messages);
      
      const assistantMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: response,
        timestamp: new Date().toISOString(),
      };

      setMessages(prev => [...prev, assistantMessage]);
      
      // Auto-speak response if user has voice access
      if (canAccessFeature('voice')) {
        speakMessage(response);
      }
    } catch (error) {
      console.error('Chat error:', error);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const handleSpeakMessage = (content: string) => {
    if (!canAccessFeature('voice')) {
      toast({
        title: "Premium Feature",
        description: "Voice features are available with a subscription.",
        variant: "destructive",
      });
      return;
    }
    speakMessage(content);
  };

  return (
    <div className="flex flex-col h-full">
      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((message) => (
          <div
            key={message.id}
            className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <Card className={`max-w-[80%] p-4 ${
              message.role === 'user'
                ? 'bg-primary text-primary-foreground'
                : 'bg-card/80 backdrop-blur border-white/10'
            }`}>
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1">
                  <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                  <span className="text-xs opacity-70 mt-1 block">
                    {new Date(message.timestamp).toLocaleTimeString()}
                  </span>
                </div>
                {message.role === 'assistant' && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleSpeakMessage(message.content)}
                    disabled={speaking}
                    className="p-1 h-auto opacity-70 hover:opacity-100 ml-2"
                  >
                    {speaking ? (
                      <Loader2 className="w-3 h-3 animate-spin" />
                    ) : (
                      <Volume2 className="w-3 h-3" />
                    )}
                  </Button>
                )}
              </div>
            </Card>
          </div>
        ))}
        
        {loading && (
          <div className="flex justify-start">
            <Card className="bg-card/80 backdrop-blur border-white/10 p-4">
              <div className="flex items-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin text-primary" />
                <span className="text-sm text-muted-foreground">Joud is thinking...</span>
              </div>
            </Card>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="p-4 border-t border-white/10 bg-card/20 backdrop-blur">
        <div className="flex gap-2">
          <Input
            placeholder="Ask Joud anything about your finances, tasks, or goals..."
            value={inputMessage}
            onChange={(e) => setInputMessage(e.target.value)}
            onKeyPress={handleKeyPress}
            disabled={loading}
            className="flex-1 bg-background/50"
          />
          <Button
            onClick={handleSendMessage}
            disabled={loading || !inputMessage.trim()}
            size="icon"
            className="bg-primary hover:bg-primary/90"
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