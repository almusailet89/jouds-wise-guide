import React, { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import ReactMarkdown from 'react-markdown';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Volume2, Send, Mic, MicOff, Plus, MessageSquare,
  Check, X, Edit3, ChevronLeft, Sparkles,
} from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useChat } from '@/hooks/useChat';
import { useSubscription } from '@/hooks/useSubscription';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

// ─── Categories & suggested prompts ──────────────────────────────────────────
type Cat = 'all' | 'finance' | 'health' | 'planning' | 'personal';

const CATEGORIES: { value: Cat; label: string; icon: string }[] = [
  { value: 'all',      label: 'الكل',     icon: '✨' },
  { value: 'finance',  label: 'مالية',    icon: '💰' },
  { value: 'health',   label: 'صحة',      icon: '💚' },
  { value: 'planning', label: 'تخطيط',    icon: '📅' },
  { value: 'personal', label: 'شخصية',    icon: '🌙' },
];

const SUGGESTED_PROMPTS: { icon: string; ar: string; en: string; cat: Cat }[] = [
  { icon: '💸', ar: 'أنفقت ١٥٠ ريال على الغداء اليوم', en: 'Log an expense', cat: 'finance' },
  { icon: '📈', ar: 'ما رأيك في أسهم أرامكو الآن؟', en: 'Saudi market view', cat: 'finance' },
  { icon: '📊', ar: 'كيف حال محفظتي الاستثمارية هذا الشهر؟', en: 'Portfolio check', cat: 'finance' },
  { icon: '🤲', ar: 'احسبي لي الزكاة بناءً على ثروتي الحالية', en: 'Zakat calculator', cat: 'finance' },
  { icon: '🕌', ar: 'ذكّرني بمواعيد الصلاة اليوم', en: 'Prayer times', cat: 'personal' },
  { icon: '🌙', ar: 'كم باقي على رمضان؟', en: 'Hijri countdown', cat: 'personal' },
  { icon: '✅', ar: 'أضيفي مهمة مراجعة الميزانية الشهرية', en: 'Add a task', cat: 'planning' },
  { icon: '📆', ar: 'رتّبي لي جدول الأسبوع القادم', en: 'Plan my week', cat: 'planning' },
  { icon: '💚', ar: 'كيف أحسّن نومي؟', en: 'Sleep tips', cat: 'health' },
  { icon: '🧘', ar: 'سجّلي مزاجي اليوم: متوتر', en: 'Log mood', cat: 'health' },
];

// ─── Smart-reply chip generator ──────────────────────────────────────────────
// Heuristic: match recent assistant message keywords to follow-up suggestions.
const generateSmartReplies = (lastAssistant: string): string[] => {
  const t = lastAssistant.toLowerCase();
  const arHas = (...needles: string[]) => needles.some(n => lastAssistant.includes(n));

  // Priority order: most specific first
  if (arHas('زكاة', 'zakat'))           return ['احسبيها الآن', 'أضيفيها للتقويم', 'أرسلي تذكيراً'];
  if (arHas('سهم', 'محفظة', 'استثمار')) return ['اعرضي لي المحفظة', 'وش التوقع لخمس سنوات؟', 'اشتري لي اقتراح'];
  if (arHas('مصروف', 'صرف', 'أنفقت'))   return ['كم صرفت هذا الشهر؟', 'صنّفيها', 'احذفي آخر إدخال'];
  if (arHas('صلاة', 'الفجر', 'الظهر'))  return ['ذكّريني بـ١٠ دقائق', 'أضيفي للتقويم', 'باقي وقت كم؟'];
  if (arHas('مهمة', 'مهام', 'تذكير'))   return ['اعرضي مهام اليوم', 'أضيفي مهمة', 'علّمي كمكتمل'];
  if (arHas('مزاج', 'متوتر', 'سعيد'))   return ['ليش؟', 'عطيني نصيحة', 'سجّلي مرة ثانية'];
  if (arHas('عادة', 'سلسلة', 'streak')) return ['كم سلسلتي؟', 'أضيفي عادة', 'تذكير يومي'];

  // Generic fallbacks
  return ['اشرحي أكثر', 'أعطني مثالاً', 'احفظي هذا'];
};

// ─── Typing dots animation ──────────────────────────────────────────────────
const TypingIndicator = () => (
  <div className="flex justify-start px-4 mb-2">
    <div className="flex items-center gap-1 bg-card border border-border/50 rounded-2xl rounded-tl-sm px-4 py-3 shadow-card">
      {[0, 1, 2].map(i => (
        <motion.span
          key={i}
          className="w-2 h-2 rounded-full bg-jood-teal-500/70"
          animate={{ y: [0, -6, 0] }}
          transition={{ duration: 0.7, repeat: Infinity, delay: i * 0.15 }}
        />
      ))}
    </div>
  </div>
);

// ─── Single message bubble ──────────────────────────────────────────────────
interface MessageBubbleProps {
  role: 'user' | 'assistant';
  content: string;
  onSpeak: (text: string) => void;
  speaking: boolean;
}

const MessageBubble: React.FC<MessageBubbleProps> = ({ role, content, onSpeak, speaking }) => {
  const isUser = role === 'user';

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
      className={cn('flex px-4 mb-4', isUser ? 'justify-end' : 'justify-start')}
    >
      {/* Avatar */}
      {!isUser && (
        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-jood-teal-700 to-jood-teal-900 flex items-center justify-center text-white text-xs font-bold mr-2 mt-1 flex-shrink-0 shadow-elegant">
          ج
        </div>
      )}

      <div className={cn('max-w-[78%] group', isUser ? 'items-end' : 'items-start')}>
        <div className={cn(
          'px-4 py-3 shadow-card',
          isUser
            ? 'bg-jood-teal-700 text-white rounded-2xl rounded-tr-sm'
            : 'bg-card border border-border/50 text-foreground rounded-2xl rounded-tl-sm',
        )}>
          {isUser ? (
            <p className="text-sm leading-relaxed whitespace-pre-wrap">{content}</p>
          ) : (
            <div className="prose prose-sm dark:prose-invert max-w-none text-foreground prose-p:leading-relaxed prose-p:mb-2 prose-headings:text-foreground prose-headings:font-semibold prose-code:text-jood-gold-500 prose-pre:p-0 prose-pre:bg-transparent">
              <ReactMarkdown
                components={{
                  code({ node, className, children, ...props }: any) {
                    const match = /language-(\w+)/.exec(className || '');
                    const isBlock = !props.inline;
                    return isBlock && match ? (
                      <SyntaxHighlighter
                        style={oneDark as any}
                        language={match[1]}
                        PreTag="div"
                        className="rounded-lg text-xs my-2"
                      >
                        {String(children).replace(/\n$/, '')}
                      </SyntaxHighlighter>
                    ) : (
                      <code className="bg-muted px-1 py-0.5 rounded text-xs font-mono text-jood-gold-500" {...props}>
                        {children}
                      </code>
                    );
                  },
                }}
              >
                {content}
              </ReactMarkdown>
            </div>
          )}
        </div>

        {/* Speak button (AI messages only) */}
        {!isUser && (
          <Button
            variant="ghost"
            size="sm"
            className="mt-1 h-6 px-2 opacity-0 group-hover:opacity-60 hover:!opacity-100 transition-opacity text-muted-foreground hover:text-foreground"
            onClick={() => onSpeak(content)}
            disabled={speaking}
          >
            <Volume2 className="w-3 h-3 mr-1" />
            <span className="text-[10px]">استمع</span>
          </Button>
        )}
      </div>

      {/* User avatar */}
      {isUser && (
        <div className="w-8 h-8 rounded-full bg-jood-gold-500 flex items-center justify-center text-white text-xs font-bold ml-2 mt-1 flex-shrink-0 shadow-gold">
          أ
        </div>
      )}
    </motion.div>
  );
};

// ─── Session item in sidebar ────────────────────────────────────────────────
interface SessionItemProps {
  session: { id: string; title: string; updated_at: string };
  active: boolean;
  onClick: () => void;
}

const SessionItem: React.FC<SessionItemProps> = ({ session, active, onClick }) => (
  <button
    onClick={onClick}
    className={cn(
      'w-full text-left px-3 py-2.5 rounded-xl text-sm transition-all duration-200 group',
      active
        ? 'bg-jood-teal-900 text-white shadow-elegant'
        : 'text-muted-foreground hover:bg-muted/60 hover:text-foreground',
    )}
  >
    <div className="flex items-center gap-2">
      <MessageSquare className={cn('w-3.5 h-3.5 flex-shrink-0', active ? 'text-jood-gold-300' : 'text-muted-foreground/60')} />
      <span className="truncate leading-snug">{session.title}</span>
    </div>
    <p className="text-[10px] mt-0.5 opacity-50 pl-5">
      {new Date(session.updated_at).toLocaleDateString('ar-SA', { month: 'short', day: 'numeric' })}
    </p>
  </button>
);

// ─── Main component ──────────────────────────────────────────────────────────
interface ChatInterfaceProps {
  onMessage?: (msg: string) => void;
}

export const ChatInterface: React.FC<ChatInterfaceProps> = ({ onMessage }) => {
  const { session: authSession } = useAuth();
  const { canAccessFeature } = useSubscription();
  const { toast } = useToast();

  const {
    sessions,
    messages,
    currentSessionId,
    loading,
    sessionsLoading,
    speaking,
    awaitingConfirmation,
    loadSessions,
    loadMessages,
    startNewChat,
    sendMessage,
    speakMessage,
    confirmAction,
  } = useChat();

  const [input, setInput] = useState('');
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [listening, setListening] = useState(false);
  const [activeCat, setActiveCat] = useState<Cat>('all');
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const recognitionRef = useRef<any>(null);

  // Load sessions on mount
  useEffect(() => { loadSessions(); }, [loadSessions]);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  // ── Voice input (Web Speech API) ──────────────────────────────────────────
  const toggleListening = useCallback(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      toast({ title: 'التعرف على الصوت غير مدعوم', description: 'يرجى استخدام Chrome أو Edge.', variant: 'destructive' });
      return;
    }

    if (listening) {
      recognitionRef.current?.stop();
      setListening(false);
      return;
    }

    const recognition = new SpeechRecognition();
    recognitionRef.current = recognition;
    recognition.lang = 'ar-SA';
    recognition.continuous = false;
    recognition.interimResults = false;

    recognition.onresult = (e: any) => {
      const transcript = e.results[0][0].transcript;
      setInput(prev => prev + transcript);
      setListening(false);
    };
    recognition.onerror = () => setListening(false);
    recognition.onend = () => setListening(false);
    recognition.start();
    setListening(true);
  }, [listening, toast]);

  // ── Send handler ──────────────────────────────────────────────────────────
  const handleSend = useCallback(async (customText?: string) => {
    const text = (customText ?? input).trim();
    if (!text || loading) return;
    if (!customText) setInput('');
    onMessage?.(text);
    await sendMessage(text);
  }, [input, loading, sendMessage, onMessage]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleSpeak = useCallback(async (text: string) => {
    if (!canAccessFeature('voice')) {
      toast({ title: 'ميزة مميزة', description: 'الاستماع للردود متاح للمشتركين المميزين.', variant: 'destructive' });
      return;
    }
    await speakMessage(text);
  }, [canAccessFeature, speakMessage, toast]);

  // ── Welcome screen ────────────────────────────────────────────────────────
  const showWelcome = messages.length === 0 && !loading;

  return (
    <div className="flex h-full overflow-hidden bg-background rounded-2xl border border-border/40 shadow-luxury">

      {/* ── Sidebar ────────────────────────────────────────────────────────── */}
      <AnimatePresence initial={false}>
        {sidebarOpen && (
          <motion.div
            initial={{ width: 0, opacity: 0 }}
            animate={{ width: 260, opacity: 1 }}
            exit={{ width: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: [0.4, 0, 0.2, 1] }}
            className="flex-shrink-0 border-r border-border/40 flex flex-col bg-card/50 backdrop-blur-sm overflow-hidden"
          >
            {/* New chat button */}
            <div className="p-3 border-b border-border/40">
              <Button
                className="w-full jood-btn-primary gap-2 text-sm"
                onClick={startNewChat}
              >
                <Plus className="w-4 h-4" />
                محادثة جديدة
              </Button>
            </div>

            {/* Sessions list */}
            <ScrollArea className="flex-1 px-2 py-2">
              {sessionsLoading ? (
                <div className="flex justify-center py-6">
                  <div className="w-5 h-5 rounded-full border-2 border-jood-teal-500 border-t-transparent animate-spin" />
                </div>
              ) : sessions.length === 0 ? (
                <p className="text-center text-muted-foreground text-xs py-8 px-3">
                  لا توجد محادثات بعد.<br />ابدأ محادثة مع جود!
                </p>
              ) : (
                <div className="space-y-0.5">
                  {sessions.map(s => (
                    <SessionItem
                      key={s.id}
                      session={s}
                      active={s.id === currentSessionId}
                      onClick={() => loadMessages(s.id)}
                    />
                  ))}
                </div>
              )}
            </ScrollArea>

            {/* Jood branding */}
            <div className="p-3 border-t border-border/40">
              <div className="flex items-center gap-2 px-2">
                <div className="w-6 h-6 rounded-full bg-gradient-to-br from-jood-teal-700 to-jood-teal-900 flex items-center justify-center">
                  <Sparkles className="w-3 h-3 text-jood-gold-300" />
                </div>
                <div>
                  <p className="text-[11px] font-semibold text-foreground">جود AI</p>
                  <p className="text-[9px] text-muted-foreground">مدعوم بـ GPT-5</p>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Main chat area ─────────────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col min-w-0">

        {/* Top bar */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-border/40 bg-card/30 backdrop-blur-sm">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 flex-shrink-0 text-muted-foreground hover:text-foreground"
            onClick={() => setSidebarOpen(v => !v)}
          >
            <ChevronLeft className={cn('w-4 h-4 transition-transform', sidebarOpen ? '' : 'rotate-180')} />
          </Button>
          <div>
            <p className="text-sm font-semibold text-foreground font-arabic">
              {currentSessionId
                ? sessions.find(s => s.id === currentSessionId)?.title || 'محادثة'
                : 'جود — مساعدتك الذكية'}
            </p>
            <p className="text-[10px] text-muted-foreground">متصلة بالمالية · المهام · التقويم</p>
          </div>

          {/* Speaking indicator */}
          <AnimatePresence>
            {speaking && (
              <motion.div
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.8 }}
                className="ml-auto flex items-center gap-1.5 bg-jood-gold-500/10 border border-jood-gold-500/30 rounded-full px-3 py-1"
              >
                {[0, 1, 2, 3].map(i => (
                  <motion.span
                    key={i}
                    className="w-0.5 rounded-full bg-jood-gold-500"
                    animate={{ height: ['6px', '16px', '6px'] }}
                    transition={{ duration: 0.8, repeat: Infinity, delay: i * 0.1 }}
                  />
                ))}
                <span className="text-[10px] text-jood-gold-500 font-medium mr-1">جود تتحدث</span>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Messages */}
        <ScrollArea className="flex-1 py-4">

          {/* Welcome screen */}
          <AnimatePresence>
            {showWelcome && (
              <motion.div
                initial={{ opacity: 0, y: 24 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
                className="flex flex-col items-center justify-center min-h-[360px] px-6 text-center"
              >
                {/* Avatar */}
                <motion.div
                  animate={{ scale: [1, 1.012, 1] }}
                  transition={{ duration: 4.5, repeat: Infinity, ease: 'easeInOut' }}
                  className="w-20 h-20 rounded-full bg-gradient-to-br from-jood-teal-700 to-jood-teal-900 flex items-center justify-center shadow-luxury mb-4"
                >
                  <span className="text-3xl font-display text-white">ج</span>
                </motion.div>

                <h2 className="text-xl font-semibold text-foreground font-arabic mb-1">
                  مرحباً، أنا جود
                </h2>
                <p className="text-sm text-muted-foreground mb-6 max-w-xs leading-relaxed">
                  مساعدتك الذكية للتخطيط المالي وإدارة حياتك اليومية بأسلوب سعودي أصيل
                </p>

                {/* Category filter chips */}
                <div className="flex items-center gap-1.5 mb-3 flex-wrap justify-center">
                  {CATEGORIES.map(c => (
                    <button
                      key={c.value}
                      onClick={() => setActiveCat(c.value)}
                      className={cn(
                        'px-3 py-1.5 rounded-full text-[11px] font-arabic transition-all border',
                        activeCat === c.value
                          ? 'bg-jood-teal-900 text-white border-jood-teal-900 shadow-elegant'
                          : 'bg-card/40 text-muted-foreground border-border/40 hover:border-jood-teal-500/50',
                      )}
                    >
                      <span className="ml-1">{c.icon}</span>
                      {c.label}
                    </button>
                  ))}
                </div>

                {/* Suggested prompts grid */}
                <div className="grid grid-cols-2 gap-2 w-full max-w-lg">
                  {SUGGESTED_PROMPTS
                    .filter(p => activeCat === 'all' || p.cat === activeCat)
                    .map((p, i) => (
                      <motion.button
                        key={`${activeCat}-${i}`}
                        initial={{ opacity: 0, y: 16 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.05 + i * 0.05, duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
                        onClick={() => handleSend(p.ar)}
                        className="group jood-card p-3 text-left hover:border-jood-teal-500/50 hover:shadow-elegant transition-all duration-200 cursor-pointer"
                      >
                        <span className="text-lg block mb-1">{p.icon}</span>
                        <p className="text-[10px] text-muted-foreground mb-0.5">{p.en}</p>
                        <p className="text-xs text-foreground font-arabic leading-snug line-clamp-2">{p.ar}</p>
                      </motion.button>
                    ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Message list */}
          {messages.map(msg => (
            <MessageBubble
              key={msg.id}
              role={msg.role}
              content={msg.content}
              onSpeak={handleSpeak}
              speaking={speaking}
            />
          ))}

          {/* Smart reply chips (after last assistant message) */}
          <AnimatePresence>
            {!loading && !awaitingConfirmation && messages.length > 0 &&
              messages[messages.length - 1].role === 'assistant' && (
                <motion.div
                  key="smart-replies"
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.3, delay: 0.15 }}
                  className="flex items-center gap-1.5 px-4 mb-3 mr-10 flex-wrap"
                >
                  {generateSmartReplies(messages[messages.length - 1].content).map((chip, i) => (
                    <motion.button
                      key={chip}
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ delay: 0.2 + i * 0.05 }}
                      onClick={() => handleSend(chip)}
                      className="px-3 py-1.5 rounded-full text-[11px] font-arabic bg-jood-teal-500/10 text-jood-teal-700 border border-jood-teal-500/30 hover:bg-jood-teal-500/20 hover:border-jood-teal-500/50 transition-all"
                    >
                      {chip}
                    </motion.button>
                  ))}
                </motion.div>
              )}
          </AnimatePresence>

          {/* Typing indicator */}
          <AnimatePresence>
            {loading && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
              >
                <TypingIndicator />
              </motion.div>
            )}
          </AnimatePresence>

          {/* Confirmation buttons */}
          <AnimatePresence>
            {awaitingConfirmation && (
              <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="flex justify-center px-4 mb-4"
              >
                <div className="flex items-center gap-2 bg-jood-gold-500/10 border border-jood-gold-500/30 rounded-2xl px-4 py-3">
                  <span className="text-sm text-muted-foreground ml-2 font-arabic">تأكيد الإجراء:</span>
                  <Button size="sm" onClick={() => confirmAction('yes')}
                    className="bg-jood-teal-700 hover:bg-jood-teal-900 text-white rounded-xl h-8">
                    <Check className="w-3.5 h-3.5 mr-1" /> نعم
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => confirmAction('edit')}
                    className="rounded-xl h-8">
                    <Edit3 className="w-3.5 h-3.5 mr-1" /> تعديل
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => confirmAction('no')}
                    className="rounded-xl h-8 text-destructive border-destructive/30 hover:bg-destructive/10">
                    <X className="w-3.5 h-3.5 mr-1" /> إلغاء
                  </Button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <div ref={bottomRef} />
        </ScrollArea>

        {/* ── Input bar ──────────────────────────────────────────────────────── */}
        <div className="border-t border-border/40 bg-card/30 backdrop-blur-sm p-3">
          <div className="flex items-end gap-2 max-w-4xl mx-auto">

            {/* Voice button */}
            <Button
              variant="ghost"
              size="icon"
              onClick={toggleListening}
              className={cn(
                'h-10 w-10 flex-shrink-0 rounded-xl transition-all duration-200',
                listening
                  ? 'bg-destructive/15 text-destructive border border-destructive/30 animate-pulse'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted',
              )}
            >
              {listening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
            </Button>

            {/* Text input */}
            <div className="flex-1 relative">
              <Textarea
                ref={inputRef}
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={
                  awaitingConfirmation
                    ? 'اكتب تعديلاتك أو استخدم الأزرار أعلاه…'
                    : 'اكتب لجود… مثال: «صرفت ٣٠٠ ريال» أو «أضيفي مهمة»'
                }
                disabled={loading}
                rows={1}
                className={cn(
                  'resize-none min-h-[40px] max-h-[140px] rounded-xl border-border/50 bg-background/60 text-sm font-arabic',
                  'focus:ring-1 focus:ring-jood-teal-500/50 focus:border-jood-teal-500/50',
                  'placeholder:text-muted-foreground/50 leading-relaxed pr-3 pl-3 py-2.5',
                )}
                style={{ scrollbarWidth: 'none' }}
                onInput={e => {
                  const el = e.currentTarget;
                  el.style.height = 'auto';
                  el.style.height = Math.min(el.scrollHeight, 140) + 'px';
                }}
              />
            </div>

            {/* Send button */}
            <Button
              onClick={() => handleSend()}
              disabled={loading || !input.trim()}
              size="icon"
              className={cn(
                'h-10 w-10 flex-shrink-0 rounded-xl transition-all duration-200',
                input.trim() && !loading
                  ? 'jood-btn-primary shadow-gold'
                  : 'bg-muted text-muted-foreground cursor-not-allowed',
              )}
            >
              <Send className="w-4 h-4" />
            </Button>
          </div>

          <p className="text-center text-[10px] text-muted-foreground/50 mt-2">
            جود AI · مدعوم بـ GPT-5 · متوافق مع اشتراطات PDPL
          </p>
        </div>
      </div>
    </div>
  );
};
