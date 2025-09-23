import React, { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Loader2, Send, Check, X, Edit3 } from 'lucide-react';
import { useAI, ChatMessage, ChatMode } from '@/hooks/useAI';
import { useToast } from '@/hooks/use-toast';
import { recordFinancialEntry, recordTask } from '@/brain/jood';
import { createSavingsContribution, recordExpense, portfolioBuy } from '@/hooks/useDatabase';
import { useFinancialDashboard } from '@/hooks/useFinancialDashboard';

const isStructuredIntent = (text: string) => {
  const s = text.trim().toLowerCase();
  if (s.startsWith('jood, note this')) return true;
  // Detect verbs that imply writing to memory/DB
  return /^(note this|add|log|remember)\b/.test(s);
};

const normalizeNoteThis = (text: string) => {
  const s = text.trim();
  return s.toLowerCase().startsWith('jood, note this') ? s : `Jood, note this ${s}`;
};

export const AssistantChatPanel: React.FC = () => {
  const { toast } = useToast();
  const { sendMessage, sendMessageStream, loading } = useAI();

  // Detect Saver/Offline like the dashboard
  const OFFLINE = import.meta.env?.VITE_DEV_OFFLINE === '1';
  const ENV_SAVER = import.meta.env?.VITE_EGRESS_SAVER === '1';
  const computedSaver = OFFLINE || ENV_SAVER || (typeof window !== 'undefined' && window.localStorage.getItem('egressSaver') === '1');
  const { walletBalanceSar } = useFinancialDashboard({ egressSaver: computedSaver });

  const [mode, setMode] = useState<Exclude<ChatMode, 'commit'>>('structured');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [streaming, setStreaming] = useState(false);
  const [awaitingConfirmation, setAwaitingConfirmation] = useState(false);
  const [pendingFunction, setPendingFunction] = useState<any>(null);

  const scrollAreaRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Hide any duplicate sidebar chat when this panel is active
    document.documentElement.setAttribute('data-chat-open', 'true');
    return () => { document.documentElement.removeAttribute('data-chat-open'); };
  }, []);

  const scrollToBottom = () => {
    if (scrollAreaRef.current) {
      const scrollContainer = scrollAreaRef.current.querySelector('[data-radix-scroll-area-viewport]');
      if (scrollContainer) (scrollContainer as HTMLElement).scrollTop = (scrollContainer as HTMLElement).scrollHeight;
    }
  };

  useEffect(() => { scrollToBottom(); }, [messages, streaming, awaitingConfirmation]);

  const appendAssistant = (content: string) => {
    setMessages(prev => ([
      ...prev,
      {
        id: `${Date.now()}-${Math.random()}`,
        role: 'assistant',
        content,
        timestamp: new Date().toISOString(),
      },
    ]));
  };

  const handleSend = async () => {
    const raw = input.trim();
    if (!raw || loading || streaming) return;

    const userMsg: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: raw,
      timestamp: new Date().toISOString(),
    };
    setMessages(prev => [...prev, userMsg]);
    setInput('');

    const shouldStructured = mode === 'structured' || isStructuredIntent(raw);

    if (shouldStructured) {
      try {
        const normalized = normalizeNoteThis(raw);
        const resp = await sendMessage(normalized, messages, 'structured', pendingFunction);
        const content = typeof resp === 'string' ? resp : resp.message || '';
        appendAssistant(content || '');
        if (resp && typeof resp === 'object' && resp.function_results?.preview_mode) {
          setPendingFunction(resp.function_results.function_call);
          setAwaitingConfirmation(true);
        } else {
          setPendingFunction(null);
          setAwaitingConfirmation(false);
        }
      } catch (e: any) {
        toast({ title: 'Error', description: e?.message || 'Failed to get response', variant: 'destructive' });
      }
      return;
    }

    // Infinite (pure streaming)
    try {
      setStreaming(true);
      // Add placeholder assistant message to stream into
      const streamId = `stream-${Date.now()}`;
      setMessages(prev => ([...prev, { id: streamId, role: 'assistant', content: '', timestamp: new Date().toISOString() }]));

      let buffer = '';
      await sendMessageStream(raw, messages, (delta) => {
        buffer += delta;
        setMessages(prev => prev.map(m => m.id === streamId ? { ...m, content: buffer } : m));
      });
    } catch (e: any) {
      toast({ title: 'Streaming Error', description: e?.message || 'Failed to stream response', variant: 'destructive' });
    } finally {
      setStreaming(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const confirmYes = async () => {
    if (!pendingFunction) return;
    try {
      const f = pendingFunction;
      const name = f.name as string;
      const args = typeof f.arguments === 'string' ? JSON.parse(f.arguments) : (f.arguments || {});

      if (name === 'add_financial_entry') {
        const t = String(args.type);
        const amt = Number(args.amount);
        const curr = String(args.currency || 'SAR');
        if (t === 'savings') {
          try {
            await createSavingsContribution({ amountSar: amt, note: args.description ?? undefined });
            appendAssistant(`Saved ${amt} ${curr}${args.category ? ` toward ${args.category}` : ''}. ✅`);
          } catch (e: any) {
            if (e?.code === 'INSUFFICIENT_FUNDS') {
              appendAssistant(`Insufficient funds to save ${amt} ${curr}. Add funds or lower the amount.`);
            } else {
              appendAssistant(`I couldn't save that due to an error: ${e?.message || 'Unknown error'}.`);
            }
          }
        } else if (t === 'expense') {
          // Client-side pre-check against local wallet
          if (typeof walletBalanceSar === 'number' && amt > walletBalanceSar) {
            appendAssistant(`Insufficient funds to spend ${amt} ${curr}. Add funds or lower the amount.`);
            return;
          }
          try {
            await recordExpense({ amount: amt, currency: curr, category: args.category ?? null, description: args.description ?? null, date: args.date });
            appendAssistant(`Consider it done. Recorded expense of ${amt} ${curr}${args.category ? ` for ${args.category}` : ''}.`);
          } catch (e: any) {
            if (e?.code === 'INSUFFICIENT_FUNDS') {
              appendAssistant(`Insufficient funds to spend ${amt} ${curr}. Add funds or lower the amount.`);
            } else {
              appendAssistant(`I couldn't record that expense: ${e?.message || 'Unknown error'}.`);
            }
          }
        } else {
          await recordFinancialEntry({
            type: t as any,
            amount: amt,
            currency: curr,
            category: args.category ?? null,
            description: args.description ?? null,
            occurred_at: args.date || new Date().toISOString(),
          });
          appendAssistant(`Consider it done. Recorded ${t} of ${amt} ${curr}${args.category ? ` for ${args.category}` : ''}.`);
        }
      } else if (name === 'add_stock_to_portfolio' || name === 'add_crypto_to_portfolio') {
        const qty = Number(args.quantity);
        const price = Number(args.buy_price);
        const sym = String(args.symbol || '').toUpperCase();
        // Client-side pre-check against local wallet
        const total = qty * price;
        if (typeof walletBalanceSar === 'number' && total > walletBalanceSar) {
          appendAssistant(`Insufficient funds to buy ${qty} ${sym} at ${price}. Add funds or reduce quantity.`);
          return;
        }
        try {
          await portfolioBuy({ symbol: sym, quantity: qty, price, currency: args.currency || 'SAR' });
          appendAssistant(`Bought ${qty} ${sym} at ${price} ${args.currency || 'SAR'} per unit. ✅`);
        } catch (e: any) {
          if (e?.code === 'INSUFFICIENT_FUNDS') {
            appendAssistant(`Insufficient funds to buy ${qty} ${sym} at ${price}. Add funds or reduce quantity.`);
          } else {
            appendAssistant(`I couldn't execute that buy: ${e?.message || 'Unknown error'}.`);
          }
        }
      } else if (name === 'add_task') {
        await recordTask({
          title: args.title,
          due_date: args.due_date ?? null,
          priority: args.priority ?? 'medium',
          notes: args.notes ?? null,
        });
        appendAssistant(`Consider it done. Task "${args.title}" added${args.due_date ? ` (due ${new Date(args.due_date).toLocaleDateString()})` : ''}.`);
      } else {
        // Fallback: if unsupported here, ask the user to use the dedicated UI
        appendAssistant('I can preview that, but committing this type of action is best done from the dedicated dashboard UI.');
      }

      setPendingFunction(null);
      setAwaitingConfirmation(false);
    } catch (e: any) {
      appendAssistant(`I encountered an error while trying to save that: ${e?.message || 'Unknown error'}.`);
    }
  };

  const confirmNo = () => {
    setAwaitingConfirmation(false);
    setPendingFunction(null);
    appendAssistant("Okay, I won't record that. Anything else?");
  };

  const confirmEdit = () => {
    setAwaitingConfirmation(false);
    appendAssistant('Edit noted. Please type your corrections and I will update the preview.');
  };

  return (
    <div className="flex flex-col h-full max-w-4xl mx-auto">
      {/* Header + Mode toggle */}
      <div className="flex items-center justify-between py-2">
        <div className="flex items-center gap-2">
          <Badge variant="outline">Assistant</Badge>
        </div>
        <div className="inline-flex rounded-full border p-1 bg-background/80">
          <Button
            type="button"
            size="sm"
            variant={mode === 'structured' ? 'default' : 'ghost'}
            className={mode === 'structured' ? 'px-4 rounded-full' : 'px-4 rounded-full'}
            onClick={() => setMode('structured')}
          >
            Structured
          </Button>
          <Button
            type="button"
            size="sm"
            variant={mode === 'infinite' ? 'default' : 'ghost'}
            className={mode === 'infinite' ? 'px-4 rounded-full' : 'px-4 rounded-full'}
            onClick={() => setMode('infinite')}
          >
            Infinite
          </Button>
        </div>
      </div>

      {/* Messages */}
      <ScrollArea ref={scrollAreaRef} className="flex-1 p-4 space-y-4">
        {messages.length === 0 && (
          <div className="text-center text-muted-foreground py-8">
            <p className="text-lg mb-2">Hi! I'm Jood, your AI assistant.</p>
            <p>Ask for anything — plans, summaries, or actions.</p>
            <div className="mt-4 p-4 bg-muted/50 rounded-lg">
              <p className="text-sm font-medium mb-2">Try:</p>
              <p className="text-sm">"Jood, note this I spent 55 SAR on groceries yesterday"</p>
              <p className="text-sm">"Write a polite email to HR about vacation next week"</p>
            </div>
          </div>
        )}

        {messages.map((m) => (
          <div key={m.id} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <Card className={`max-w-[80%] ${m.role === 'user' ? 'bg-primary text-primary-foreground' : 'bg-card border-border/50'}`}>
              <CardContent className="p-4">
                <div className="whitespace-pre-wrap">{m.content}</div>
              </CardContent>
            </Card>
          </div>
        ))}

        {/* Confirmation Bar for Structured preview */}
        {awaitingConfirmation && (
          <div className="flex justify-center">
            <Card className="bg-accent/50 border-2 border-primary/20">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-center">Confirm Action</CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="flex space-x-2 justify-center">
                  <Button size="sm" onClick={confirmYes} className="bg-green-600 hover:bg-green-700 text-white">
                    <Check className="w-4 h-4 mr-1" /> Yes
                  </Button>
                  <Button size="sm" variant="outline" onClick={confirmEdit}>
                    <Edit3 className="w-4 h-4 mr-1" /> Edit
                  </Button>
                  <Button size="sm" variant="outline" onClick={confirmNo}>
                    <X className="w-4 h-4 mr-1" /> No
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Thinking / streaming indicator */}
        {(loading || streaming) && (
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
            onKeyDown={handleKeyPress}
            placeholder={awaitingConfirmation ? "Type 'edit' to modify or use buttons above..." : mode === 'structured' ? "Try: 'Jood, note this I spent 20 SAR on coffee'" : 'Ask for a plan, summary, or advice'}
            disabled={loading || streaming}
            className="flex-1"
          />
          <Button onClick={handleSend} disabled={loading || streaming || !input.trim()} size="icon">
            {loading || streaming ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          </Button>
        </div>
      </div>
    </div>
  );
};

export default AssistantChatPanel;
