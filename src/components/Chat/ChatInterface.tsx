import React, { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import ReactMarkdown from 'react-markdown';
// Use PrismLight (tree-shakeable) instead of Prism to cut bundle by ~400 KB
import { PrismLight as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism';
// Register only the languages Jood AI actually produces
import jsx  from 'react-syntax-highlighter/dist/esm/languages/prism/jsx';
import tsx  from 'react-syntax-highlighter/dist/esm/languages/prism/tsx';
import js   from 'react-syntax-highlighter/dist/esm/languages/prism/javascript';
import ts   from 'react-syntax-highlighter/dist/esm/languages/prism/typescript';
import python from 'react-syntax-highlighter/dist/esm/languages/prism/python';
import bash from 'react-syntax-highlighter/dist/esm/languages/prism/bash';
import json from 'react-syntax-highlighter/dist/esm/languages/prism/json';
import sql  from 'react-syntax-highlighter/dist/esm/languages/prism/sql';
SyntaxHighlighter.registerLanguage('jsx', jsx);
SyntaxHighlighter.registerLanguage('tsx', tsx);
SyntaxHighlighter.registerLanguage('javascript', js);
SyntaxHighlighter.registerLanguage('typescript', ts);
SyntaxHighlighter.registerLanguage('python', python);
SyntaxHighlighter.registerLanguage('bash', bash);
SyntaxHighlighter.registerLanguage('json', json);
SyntaxHighlighter.registerLanguage('sql', sql);
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Volume2, Send, Mic, MicOff, Plus, MessageSquare,
  Check, X, Edit3, Sparkles, Menu,
  Calendar, Mail, MessageCircle, CheckSquare, TrendingUp, Copy, Trash2,
} from 'lucide-react';
import { useChat } from '@/hooks/useChat';
import { useSubscription } from '@/hooks/useSubscription';
import { useToast } from '@/hooks/use-toast';
import { useLanguage } from '@/hooks/useLanguage';
import { cn } from '@/lib/utils';

// ─── Suggested prompts ───────────────────────────────────────────────────────
type Cat = 'all' | 'finance' | 'health' | 'planning' | 'personal';

// ─── Smart-reply chip generator ───────────────────────────────────────────────
const generateSmartReplies = (lastAssistant: string, lang: 'ar' | 'en', gender: 'male' | 'female' | null): string[] => {
  const has = (...needles: string[]) => needles.some(n => lastAssistant.includes(n));
  const f = gender === 'female';
  if (lang === 'en') {
    if (has('zakat'))                              return ['Calculate now', 'Add to calendar', 'Send reminder'];
    if (has('portfolio', 'stock', 'investment'))   return ['Show portfolio', '5-year forecast', 'Investment suggestion'];
    if (has('expense', 'spent', 'spend'))          return ['How much this month?', 'Categorize it', 'Delete last entry'];
    if (has('prayer', 'fajr', 'dhuhr'))            return ['Remind me in 10 min', 'Add to calendar', 'Next prayer time'];
    if (has('task', 'reminder'))                   return ["Today's tasks", 'Add task', 'Mark complete'];
    if (has('mood', 'stressed', 'happy'))          return ['Why?', 'Give me advice', 'Log again'];
    if (has('habit', 'streak'))                    return ['My streak?', 'Add habit', 'Daily reminder'];
    return ['Tell me more', 'Give me an example', 'Save this'];
  }
  if (has('زكاة'))                        return [f ? 'احسبيها الآن' : 'احسبها الآن', f ? 'أضيفيها للتقويم' : 'أضفها للتقويم', f ? 'أرسلي تذكيراً' : 'أرسل تذكيراً'];
  if (has('سهم', 'محفظة', 'استثمار'))    return ['اعرضي لي المحفظة', 'التوقع لخمس سنوات', 'اقتراح استثمار'];
  if (has('مصروف', 'صرف', 'أنفقت'))      return ['كم صرفت هذا الشهر؟', 'صنّفيها', 'احذفي آخر إدخال'];
  if (has('صلاة', 'الفجر', 'الظهر'))     return ['ذكّريني بـ١٠ دقائق', f ? 'أضيفي للتقويم' : 'أضف للتقويم', 'وقت الصلاة القادمة'];
  if (has('مهمة', 'مهام', 'تذكير'))      return ['مهام اليوم', f ? 'أضيفي مهمة' : 'أضف مهمة', f ? 'علّمي كمكتمل' : 'علّم كمكتمل'];
  if (has('مزاج', 'متوتر', 'سعيد'))      return ['ليش؟', 'عطيني نصيحة', f ? 'سجّلي مرة ثانية' : 'سجّل مرة ثانية'];
  if (has('عادة', 'سلسلة'))              return ['كم سلسلتي؟', f ? 'أضيفي عادة' : 'أضف عادة', 'تذكير يومي'];
  return ['اشرحي أكثر', 'أعطني مثالاً', 'احفظي هذا'];
};

// ─── Action Card ─────────────────────────────────────────────────────────────
const ACTION_ICONS: Record<string, React.ElementType> = {
  task: CheckSquare, task_update: CheckSquare, task_delete: CheckSquare,
  event: Calendar, event_update: Calendar, event_delete: Calendar,
  email_draft: Mail,
  whatsapp_draft: MessageCircle,
  finance: TrendingUp, finance_update: TrendingUp, finance_delete: TrendingUp,
  goal: TrendingUp, goal_update: TrendingUp, goal_delete: TrendingUp,
  holding_update: TrendingUp, holding_delete: TrendingUp,
  habit_update: CheckSquare, habit_delete: CheckSquare,
  budget: TrendingUp, portfolio: TrendingUp,
  memory: CheckSquare,
};
const ACTION_COLORS: Record<string, string> = {
  task:           'bg-amber-50 border-amber-200 text-amber-800',
  task_update:    'bg-amber-50 border-amber-200 text-amber-800',
  task_delete:    'bg-amber-50 border-amber-200 text-amber-800',
  event:          'bg-blue-50 border-blue-200 text-blue-800',
  event_update:   'bg-blue-50 border-blue-200 text-blue-800',
  event_delete:   'bg-blue-50 border-blue-200 text-blue-800',
  email_draft:    'bg-red-50 border-red-200 text-red-800',
  whatsapp_draft: 'bg-green-50 border-green-200 text-green-800',
  finance:        'bg-teal-50 border-teal-200 text-teal-800',
  finance_update: 'bg-teal-50 border-teal-200 text-teal-800',
  finance_delete: 'bg-teal-50 border-teal-200 text-teal-800',
  goal:           'bg-jood-gold-50 border-jood-gold-200 text-jood-gold-800',
  goal_update:    'bg-jood-gold-50 border-jood-gold-200 text-jood-gold-800',
  goal_delete:    'bg-jood-gold-50 border-jood-gold-200 text-jood-gold-800',
  holding_update: 'bg-purple-50 border-purple-200 text-purple-800',
  holding_delete: 'bg-purple-50 border-purple-200 text-purple-800',
  habit_update:   'bg-emerald-50 border-emerald-200 text-emerald-800',
  habit_delete:   'bg-emerald-50 border-emerald-200 text-emerald-800',
  budget:         'bg-teal-50 border-teal-200 text-teal-800',
  portfolio:      'bg-purple-50 border-purple-200 text-purple-800',
};

const ActionCard: React.FC<{ card: { kind: string; summary: string; data: Record<string, any> } }> = ({ card }) => {
  const Icon  = ACTION_ICONS[card.kind] ?? CheckSquare;
  const color = ACTION_COLORS[card.kind] ?? ACTION_COLORS.task;
  const { toast } = useToast();
  const { t, lang, dir } = useLanguage();
  const copy = (text: string) => { navigator.clipboard.writeText(text); toast({ title: t('chat.copy') }); };
  const dtLocale = lang === 'ar' ? 'ar-SA' : 'en-US';

  // Phase 4: Navigate action — dispatch custom event for Dashboard to handle
  React.useEffect(() => {
    if (card.kind === 'navigate' && card.data?.navigate_to) {
      window.dispatchEvent(new CustomEvent('jood:navigate', { detail: { tab: card.data.navigate_to } }));
    }
    // Refresh daily brief card when Jood updates the schedule
    if (card.data?.client_action?.type === 'refresh_daily_brief') {
      window.dispatchEvent(new CustomEvent('jood:refresh_brief'));
    }
  }, [card.kind, card.data?.navigate_to, card.data?.client_action?.type]);

  if (card.kind === 'navigate') return null; // Navigation cards don't render visually

  return (
    <motion.div
      initial={{ opacity: 0, y: 8, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.3 }}
      className={cn('mt-3 p-3.5 rounded-2xl border', color)}
      dir={dir}
    >
      <div className="flex items-start gap-3">
        <div className={cn('w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0', color)}>
          <Icon className="w-4 h-4" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold font-arabic mb-2">{card.summary}</p>
          {card.kind === 'email_draft' && (
            <div className="space-y-2">
              <div className="text-xs font-arabic bg-white/60 rounded-xl p-3 space-y-1">
                <p><span className="opacity-60">{t('chat.email.to')}:</span> {card.data.to}</p>
                <p><span className="opacity-60">{t('chat.email.subject')}:</span> {card.data.subject}</p>
                <p className="mt-2 leading-relaxed whitespace-pre-wrap">{card.data.body}</p>
              </div>
              <button onClick={() => copy(`${t('chat.email.to')}: ${card.data.to}\n${t('chat.email.subject')}: ${card.data.subject}\n\n${card.data.body}`)}
                className="flex items-center gap-1.5 text-xs font-arabic opacity-60 hover:opacity-100">
                <Copy className="w-3 h-3" /> {t('chat.email.copy')}
              </button>
            </div>
          )}
          {card.kind === 'whatsapp_draft' && (
            <div className="space-y-2">
              <div className="text-xs font-arabic bg-white/60 rounded-xl p-3">
                <p><span className="opacity-60">{t('chat.whatsapp.to')}:</span> {card.data.recipient}</p>
                <p className="mt-2 leading-relaxed">{card.data.message}</p>
              </div>
              <button onClick={() => copy(card.data.message)}
                className="flex items-center gap-1.5 text-xs font-arabic opacity-60 hover:opacity-100">
                <Copy className="w-3 h-3" /> {t('chat.whatsapp.copy')}
              </button>
            </div>
          )}
          {card.kind === 'event' && card.data.starts_at && (
            <p className="text-xs font-arabic opacity-75">
              📅 {new Date(card.data.starts_at).toLocaleString(dtLocale, {
                weekday: 'short', month: 'short', day: 'numeric',
                hour: '2-digit', minute: '2-digit',
              })}
              {card.data.location ? ` · 📍${card.data.location}` : ''}
            </p>
          )}
        </div>
      </div>
    </motion.div>
  );
};

// ─── Typing indicator ─────────────────────────────────────────────────────────
const TypingIndicator = () => (
  <div className="flex items-start gap-3 px-4 py-2" dir="ltr">
    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-jood-teal-700 to-jood-teal-900 flex items-center justify-center text-white text-sm font-bold flex-shrink-0 shadow-sm">
      ج
    </div>
    <div className="bg-muted/60 border border-border/40 rounded-2xl rounded-tl-sm px-4 py-3">
      <div className="flex items-center gap-1.5">
        {[0, 1, 2].map(i => (
          <motion.span key={i}
            className="w-2 h-2 rounded-full bg-jood-teal-500/70"
            animate={{ y: [0, -5, 0] }}
            transition={{ duration: 0.7, repeat: Infinity, delay: i * 0.15 }}
          />
        ))}
      </div>
    </div>
  </div>
);

// ─── Message bubble — ChatGPT-style ──────────────────────────────────────────
// Uses dir="ltr" wrapper so flex direction is always predictable (left = left).
// All actual Arabic text inside uses dir="rtl".
const MessageBubble: React.FC<{
  role: 'user' | 'assistant';
  content: string;
  onSpeak: (t: string) => void;
  speaking: boolean;
}> = ({ role, content, onSpeak, speaking }) => {
  const isUser = role === 'user';
  const { t: tl, lang: msgLang } = useLanguage();

  if (isUser) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
        className="flex justify-end px-4 mb-5"
        dir="ltr"
      >
        <div
          className="max-w-[82%] sm:max-w-[72%] bg-jood-teal-700 text-white rounded-3xl rounded-br-md px-4 py-3 shadow-sm"
          dir="rtl"
        >
          <p className="text-[15px] leading-relaxed whitespace-pre-wrap font-arabic">{content}</p>
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
      className="px-4 mb-5 group"
      dir="ltr"
    >
      <div className="flex items-start gap-3">
        {/* Jood avatar */}
        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-jood-teal-700 to-jood-teal-900 flex items-center justify-center text-white text-sm font-bold flex-shrink-0 shadow-elegant mt-0.5">
          ج
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0" dir="rtl">
          {/* Message text — no bubble background (ChatGPT style) */}
          <div className="prose prose-base dark:prose-invert max-w-none
            text-foreground font-arabic
            prose-p:text-[15px] prose-p:leading-relaxed prose-p:mb-2 prose-p:font-arabic
            prose-headings:text-foreground prose-headings:font-semibold prose-headings:font-arabic
            prose-li:text-[15px] prose-li:font-arabic prose-li:leading-relaxed
            prose-strong:text-foreground
            prose-code:text-jood-gold-600 prose-pre:p-0 prose-pre:bg-transparent"
          >
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
                      className="rounded-xl text-xs my-3"
                    >
                      {String(children).replace(/\n$/, '')}
                    </SyntaxHighlighter>
                  ) : (
                    <code className="bg-muted px-1.5 py-0.5 rounded-md text-xs font-mono text-jood-gold-600" {...props}>
                      {children}
                    </code>
                  );
                },
              }}
            >
              {content}
            </ReactMarkdown>
          </div>

          {/* Listen button */}
          <button
            onClick={() => onSpeak(content)}
            disabled={speaking}
            className="mt-1.5 flex items-center gap-1.5 text-xs text-muted-foreground/50 hover:text-muted-foreground opacity-0 group-hover:opacity-100 transition-all"
          >
            <Volume2 className="w-3.5 h-3.5" />
            <span className="font-arabic">{tl('chat.listen')}</span>
          </button>
        </div>
      </div>
    </motion.div>
  );
};

// ─── Sidebar session item ─────────────────────────────────────────────────────
const SessionItem: React.FC<{
  session: { id: string; title: string; updated_at: string };
  active: boolean;
  onClick: () => void;
  onDelete: () => void;
}> = ({ session, active, onClick, onDelete }) => {
  const { lang: sLang } = useLanguage();
  return (
  <div className="relative group" dir="rtl">
    <button
      onClick={onClick}
      className={cn(
        'w-full text-right px-3 py-2.5 rounded-xl transition-all duration-150',
        active
          ? 'bg-jood-teal-900/90 text-white'
          : 'text-muted-foreground hover:bg-muted/70 hover:text-foreground',
      )}
    >
      <div className="flex items-center gap-2 pl-6">
        <MessageSquare className={cn('w-3.5 h-3.5 flex-shrink-0', active ? 'text-jood-gold-300' : 'text-muted-foreground/50')} />
        <span className="line-clamp-2 text-xs font-arabic leading-snug break-words min-w-0">{session.title}</span>
      </div>
      <p className="text-xs mt-0.5 opacity-45 font-arabic pr-5">
        {new Date(session.updated_at).toLocaleDateString(sLang === 'ar' ? 'ar-SA' : 'en-US', { month: 'short', day: 'numeric' })}
      </p>
    </button>
    {/* Delete button */}
    <button
      onClick={e => { e.stopPropagation(); onDelete(); }}
      className={cn(
        'absolute left-2 top-1/2 -translate-y-1/2 w-7 h-7 rounded-lg flex items-center justify-center transition-all',
        'opacity-0 group-hover:opacity-100',
        active
          ? 'text-white/50 hover:text-white hover:bg-white/15'
          : 'text-muted-foreground/40 hover:text-destructive hover:bg-destructive/10',
      )}
    >
      <Trash2 className="w-3.5 h-3.5" />
    </button>
  </div>
  );
};

// ═══════════════════════════════════════════════════════════════════════════════
interface ChatInterfaceProps {
  onMessage?: (msg: string) => void;
}

export const ChatInterface: React.FC<ChatInterfaceProps> = ({ onMessage }) => {
  const { canAccessFeature } = useSubscription();
  const { toast } = useToast();
  const { lang, t, tg, gender } = useLanguage();

  const SUGGESTED_PROMPTS: { icon: string; ar: string; en: string; cat: Cat }[] = [
    // Finance
    { icon: '💸', ar: 'أنفقت ١٥٠ ريال على الغداء اليوم',                                                               en: 'I spent 150 SAR on lunch today',                         cat: 'finance'  },
    { icon: '🎯', ar: 'حطّي هدف توفير سيارة ٦٠٠٠٠ ريال بنهاية السنة',                                                  en: 'Set a savings goal of 60,000 SAR for a car by year end', cat: 'finance'  },
    { icon: '🤲', ar: 'احسبي لي الزكاة بناءً على ثروتي الحالية',                                                        en: 'Calculate my zakat based on my current wealth',          cat: 'finance'  },
    { icon: '📊', ar: 'كيف حال محفظتي الاستثمارية هذا الشهر؟',                                                          en: 'How is my investment portfolio doing this month?',       cat: 'finance'  },
    { icon: '📈', ar: gender === 'female' ? 'أضيفي ٥٠٠ سهم أرامكو بسعر ٢٨ ريال للمحفظة' : 'أضف ٥٠٠ سهم أرامكو بسعر ٢٨ ريال للمحفظة', en: 'Add 500 Aramco shares at 28 SAR to my portfolio', cat: 'finance' },
    // Planning
    { icon: '✅', ar: gender === 'female' ? 'أضيفي مهمة مراجعة الميزانية الشهرية' : 'أضف مهمة مراجعة الميزانية الشهرية', en: 'Add a task: review monthly budget',                    cat: 'planning' },
    { icon: '📆', ar: 'احجزي اجتماع غداً الساعة ١٠ صباحاً',                                                            en: 'Schedule a meeting tomorrow at 10 AM',                   cat: 'planning' },
    { icon: '⭐', ar: 'عوّديني على المشي ٣٠ دقيقة يومياً الساعة ٧',                                                    en: 'Build a habit: walk 30 minutes daily at 7 AM',           cat: 'planning' },
    // Personal / Spiritual
    { icon: '🕌', ar: 'ذكّريني بمواعيد الصلاة الخمس اليوم',                                                            en: "Remind me of today's prayer times",                      cat: 'personal' },
    { icon: '🌙', ar: 'كم باقي على رمضان؟',                                                                             en: 'How many days until Ramadan?',                           cat: 'personal' },
    // Health
    { icon: '💚', ar: 'كيف أحسّن نومي وطاقتي اليومية؟',                                                                en: 'How can I improve my sleep and daily energy?',           cat: 'health'   },
    { icon: '😊', ar: gender === 'female' ? 'سجّلي إن مزاجي اليوم ممتاز — ١٠ من ١٠' : 'سجّل إن مزاجي اليوم ممتاز — ١٠ من ١٠', en: 'Log my mood today as excellent — 10 out of 10', cat: 'health'  },
  ];

  const CATS: { value: Cat; label: string; icon: string }[] = [
    { value: 'all',      label: t('chat.cat.all'),      icon: '✨' },
    { value: 'finance',  label: t('chat.cat.finance'),  icon: '💰' },
    { value: 'planning', label: t('chat.cat.planning'), icon: '📅' },
    { value: 'personal', label: t('chat.cat.personal'), icon: '🌙' },
    { value: 'health',   label: t('chat.cat.health'),   icon: '💚' },
  ];

  const {
    sessions, messages, currentSessionId,
    loading, sessionsLoading, speaking, awaitingConfirmation,
    loadSessions, loadMessages, startNewChat,
    sendMessage, speakMessage, confirmAction, deleteSession,
  } = useChat();

  const [input, setInput]           = useState('');
  const [sidebarOpen, setSidebarOpen] = useState(() => window.innerWidth >= 768);
  const [listening, setListening]   = useState(false);
  const [activeCat, setActiveCat]   = useState<Cat>('all');
  const bottomRef  = useRef<HTMLDivElement>(null);
  const inputRef   = useRef<HTMLTextAreaElement>(null);
  const recognitionRef = useRef<any>(null);

  useEffect(() => { loadSessions(); }, [loadSessions]);
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  // ── Close sidebar on mobile when a session is selected ───────────────────
  const handleLoadMessages = useCallback((id: string) => {
    loadMessages(id);
    if (window.innerWidth < 768) setSidebarOpen(false);
  }, [loadMessages]);

  const handleNewChat = useCallback(() => {
    startNewChat();
    if (window.innerWidth < 768) setSidebarOpen(false);
  }, [startNewChat]);

  // ── Voice input ───────────────────────────────────────────────────────────
  const toggleListening = useCallback(() => {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) {
      toast({ title: t('chat.voice.unsupported'), description: tg('chat.voice.use.browser'), variant: 'destructive' });
      return;
    }
    if (listening) { recognitionRef.current?.stop(); setListening(false); return; }
    const r = new SR();
    recognitionRef.current = r;
    r.lang = 'ar-SA';
    r.continuous = false;
    r.interimResults = false;
    r.onresult = (e: any) => { setInput(p => p + e.results[0][0].transcript); setListening(false); };
    r.onerror = () => setListening(false);
    r.onend   = () => setListening(false);
    r.start();
    setListening(true);
  }, [listening, toast]);

  // ── Send ──────────────────────────────────────────────────────────────────
  const handleSend = useCallback(async (customText?: string) => {
    const text = (customText ?? input).trim();
    if (!text || loading) return;
    if (!customText) {
      setInput('');
      if (inputRef.current) inputRef.current.style.height = 'auto';
    }
    onMessage?.(text);
    await sendMessage(text);
  }, [input, loading, sendMessage, onMessage]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); }
  };

  const handleSpeak = useCallback(async (text: string) => {
    if (!canAccessFeature('voice')) {
      toast({ title: t('chat.premium.title'), description: t('chat.premium.voice.desc'), variant: 'destructive' });
      return;
    }
    await speakMessage(text);
  }, [canAccessFeature, speakMessage, toast]);

  const showWelcome = messages.length === 0 && !loading;
  const filteredPrompts = SUGGESTED_PROMPTS.filter(p => activeCat === 'all' || p.cat === activeCat);

  const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;

  return (
    <div className="flex h-full overflow-hidden bg-background rounded-2xl border border-border/40 shadow-luxury relative">

      {/* ── Sidebar overlay backdrop (mobile) ──────────────────────────────── */}
      <AnimatePresence>
        {sidebarOpen && isMobile && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 z-20 bg-black/40 backdrop-blur-sm"
            onClick={() => setSidebarOpen(false)}
          />
        )}
      </AnimatePresence>

      {/* ── Sidebar ────────────────────────────────────────────────────────── */}
      <AnimatePresence initial={false}>
        {sidebarOpen && (
          <motion.div
            key="sidebar"
            initial={{ x: '100%', opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: '100%', opacity: 0 }}
            transition={{ duration: 0.22, ease: [0.4, 0, 0.2, 1] }}
            className={cn(
              'flex-shrink-0 flex flex-col bg-card border-l border-border/40 overflow-hidden',
              'md:relative md:z-auto',
              'absolute right-0 top-0 bottom-0 z-30 w-72 shadow-2xl md:shadow-none md:w-64',
            )}
          >
            {/* New chat */}
            <div className="p-3 border-b border-border/30 flex-shrink-0" dir="rtl">
              <button
                onClick={handleNewChat}
                className="w-full flex items-center gap-2.5 px-4 py-3 rounded-xl border border-border/50 bg-background/60 hover:bg-muted/60 transition-all text-sm font-arabic font-medium text-foreground"
              >
                <Plus className="w-4 h-4 text-jood-teal-600" />
                {t('chat.new')}
              </button>
            </div>

            {/* Sessions */}
            <ScrollArea className="flex-1 px-2 py-2">
              {sessionsLoading ? (
                <div className="flex justify-center py-10">
                  <div className="w-5 h-5 rounded-full border-2 border-jood-teal-500 border-t-transparent animate-spin" />
                </div>
              ) : sessions.length === 0 ? (
                <div className="text-center py-12 px-4" dir="rtl">
                  <MessageSquare className="w-8 h-8 mx-auto text-muted-foreground/30 mb-2" />
                  <p className="text-xs text-muted-foreground font-arabic leading-relaxed">
                    {t('chat.empty.title')}<br />{tg('chat.empty.hint')}
                  </p>
                </div>
              ) : (
                <div className="space-y-0.5 py-1" dir="rtl">
                  <p className="text-[10px] text-muted-foreground/50 font-arabic px-3 py-1 uppercase tracking-wide">{t('chat.prev.label')}</p>
                  {sessions.map(s => (
                    <SessionItem
                      key={s.id}
                      session={s}
                      active={s.id === currentSessionId}
                      onClick={() => handleLoadMessages(s.id)}
                      onDelete={() => deleteSession(s.id)}
                    />
                  ))}
                </div>
              )}
            </ScrollArea>

            {/* Footer branding */}
            <div className="p-3 border-t border-border/30 flex-shrink-0" dir="rtl">
              <div className="flex items-center gap-2 px-2">
                <div className="w-7 h-7 rounded-full bg-gradient-to-br from-jood-teal-700 to-jood-teal-900 flex items-center justify-center">
                  <Sparkles className="w-3.5 h-3.5 text-jood-gold-300" />
                </div>
                <div>
                  <p className="text-xs font-bold text-foreground font-arabic">جود AI</p>
                  <p className="text-[10px] text-muted-foreground/60">{t('chat.engine.badge')}</p>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Main chat column ───────────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">

        {/* ── Top bar ──────────────────────────────────────────────────────── */}
        <div className="flex items-center gap-2 px-3 py-2.5 border-b border-border/30 bg-card/60 backdrop-blur-sm flex-shrink-0" dir="rtl">
          {/* Sidebar toggle */}
          <button
            onClick={() => setSidebarOpen(v => !v)}
            className="w-9 h-9 flex-shrink-0 flex items-center justify-center rounded-xl text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-all"
          >
            <Menu className="w-5 h-5" />
          </button>

          {/* Session title */}
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-foreground font-arabic truncate">
              {currentSessionId
                ? (sessions.find(s => s.id === currentSessionId)?.title ?? t('chat.session.default'))
                : t('chat.default.title')}
            </p>
            <p className="text-[11px] text-muted-foreground/70 font-arabic">
              {t('chat.connected')}
            </p>
          </div>

          {/* Speaking waveform */}
          <AnimatePresence>
            {speaking && (
              <motion.div
                initial={{ opacity: 0, scale: 0.85 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.85 }}
                className="flex items-center gap-1 bg-jood-gold-500/10 border border-jood-gold-300/40 rounded-full px-3 py-1.5"
              >
                {[0, 1, 2, 3].map(i => (
                  <motion.span key={i}
                    className="w-0.5 rounded-full bg-jood-gold-500"
                    animate={{ height: ['5px', '14px', '5px'] }}
                    transition={{ duration: 0.8, repeat: Infinity, delay: i * 0.1 }}
                  />
                ))}
                <span className="text-xs text-jood-gold-600 font-arabic mr-1">{t('chat.speaking')}</span>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* ── Message area ─────────────────────────────────────────────────── */}
        <ScrollArea className="flex-1 overflow-y-auto">
          <div className="max-w-3xl mx-auto w-full">

            {/* Welcome screen */}
            <AnimatePresence>
              {showWelcome && (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.45 }}
                  className="flex flex-col items-center pt-10 pb-6 px-4 text-center"
                  dir="rtl"
                >
                  {/* Avatar */}
                  <motion.div
                    animate={{ scale: [1, 1.015, 1] }}
                    transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
                    className="w-20 h-20 rounded-full bg-gradient-to-br from-jood-teal-700 to-jood-teal-900 flex items-center justify-center shadow-luxury mb-5"
                  >
                    <span className="text-3xl font-bold text-white">ج</span>
                  </motion.div>

                  <h2 className="text-2xl font-bold text-foreground font-arabic mb-1">{t('chat.welcome.greet')}</h2>
                  <p className="text-base text-muted-foreground font-arabic mb-8 max-w-xs leading-relaxed">
                    {t('chat.welcome.sub')}
                  </p>

                  {/* Category filter */}
                  <div className="flex items-center gap-2 mb-5 flex-wrap justify-center">
                    {CATS.map(c => (
                      <button
                        key={c.value}
                        onClick={() => setActiveCat(c.value)}
                        className={cn(
                          'px-3.5 py-2 rounded-full text-sm font-arabic transition-all border',
                          activeCat === c.value
                            ? 'bg-jood-teal-900 text-white border-jood-teal-900 shadow-sm'
                            : 'bg-card text-muted-foreground border-border/50 hover:border-jood-teal-400/60',
                        )}
                      >
                        <span className="ml-1">{c.icon}</span>{c.label}
                      </button>
                    ))}
                  </div>

                  {/* Suggestion list — ChatGPT vertical style */}
                  <div className="w-full max-w-sm space-y-2">
                    {filteredPrompts.map((p, i) => (
                      <motion.button
                        key={`${activeCat}-${i}`}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.04 * i, duration: 0.25 }}
                        onClick={() => handleSend(lang === 'ar' ? p.ar : p.en)}
                        className="w-full flex items-center gap-3 px-4 py-3.5 rounded-2xl bg-card border border-border/50 hover:border-jood-teal-400/50 hover:bg-muted/40 transition-all text-right group"
                      >
                        <span className="text-xl flex-shrink-0">{p.icon}</span>
                        <span className="text-[15px] text-foreground font-arabic leading-snug flex-1">
                          {lang === 'ar' ? p.ar : p.en}
                        </span>
                        <Send className="w-4 h-4 text-muted-foreground/30 group-hover:text-jood-teal-500 transition-colors flex-shrink-0 rotate-180" />
                      </motion.button>
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Messages */}
            <div className="pt-4 pb-2">
              {messages.map(msg => (
                <React.Fragment key={msg.id}>
                  <MessageBubble
                    role={msg.role}
                    content={msg.content}
                    onSpeak={handleSpeak}
                    speaking={speaking}
                  />
                  {msg.role === 'assistant' && msg.action_card && (
                    <div className="px-4 mb-4" dir="ltr">
                      <div className="ml-11">
                        <ActionCard card={msg.action_card} />
                      </div>
                    </div>
                  )}
                </React.Fragment>
              ))}
            </div>

            {/* Smart reply chips */}
            <AnimatePresence>
              {!loading && !awaitingConfirmation && messages.length > 0 &&
                messages[messages.length - 1].role === 'assistant' && (
                  <motion.div
                    key="chips"
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.25, delay: 0.1 }}
                    className="flex flex-wrap gap-2 px-4 pb-4 pr-16"
                    dir="rtl"
                  >
                    {generateSmartReplies(messages[messages.length - 1].content, lang, gender).map((chip, i) => (
                      <motion.button
                        key={chip}
                        initial={{ opacity: 0, scale: 0.92 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ delay: 0.15 + i * 0.05 }}
                        onClick={() => handleSend(chip)}
                        className="px-4 py-2 rounded-full text-sm font-arabic bg-card border border-border/60 hover:border-jood-teal-400/60 hover:bg-muted/50 text-foreground transition-all"
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
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                  <TypingIndicator />
                </motion.div>
              )}
            </AnimatePresence>

            {/* Confirmation */}
            <AnimatePresence>
              {awaitingConfirmation && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className="flex justify-center px-4 pb-4"
                  dir="rtl"
                >
                  <div className="flex items-center gap-2 bg-jood-gold-500/8 border border-jood-gold-300/40 rounded-2xl px-4 py-3 flex-wrap">
                    <span className="text-sm text-muted-foreground font-arabic">{t('chat.confirm.title')}</span>
                    <Button size="sm" onClick={() => confirmAction('yes')}
                      className="bg-jood-teal-700 hover:bg-jood-teal-900 text-white rounded-xl h-9 px-4 text-sm font-arabic gap-1.5">
                      <Check className="w-4 h-4" /> {t('chat.confirm.yes')}
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => confirmAction('edit')}
                      className="rounded-xl h-9 px-4 text-sm font-arabic gap-1.5">
                      <Edit3 className="w-4 h-4" /> {t('chat.confirm.edit')}
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => confirmAction('no')}
                      className="rounded-xl h-9 px-4 text-sm font-arabic gap-1.5 text-destructive border-destructive/30 hover:bg-destructive/8">
                      <X className="w-4 h-4" /> {t('chat.confirm.no')}
                    </Button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            <div ref={bottomRef} className="h-2" />
          </div>
        </ScrollArea>

        {/* ── Input bar ─────────────────────────────────────────────────────── */}
        <div className="border-t border-border/30 bg-card/60 backdrop-blur-sm px-3 py-3 flex-shrink-0">
          <div className="max-w-3xl mx-auto">
            <div className="flex items-end gap-2 bg-background border border-border/60 rounded-2xl px-3 py-2 shadow-sm focus-within:border-jood-teal-400/60 focus-within:shadow-md transition-all" dir="rtl">

              {/* Voice button */}
              <button
                onClick={toggleListening}
                className={cn(
                  'w-10 h-10 flex-shrink-0 flex items-center justify-center rounded-xl transition-all',
                  listening
                    ? 'bg-destructive/15 text-destructive animate-pulse'
                    : 'text-muted-foreground hover:text-foreground hover:bg-muted/60',
                )}
              >
                {listening ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
              </button>

              {/* Textarea — 16px font prevents iOS zoom */}
              <Textarea
                ref={inputRef}
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={
                  awaitingConfirmation
                    ? t('chat.input.edit')
                    : t('chat.input.placeholder')
                }
                disabled={loading}
                rows={1}
                className={cn(
                  'flex-1 resize-none border-0 bg-transparent shadow-none',
                  'min-h-[40px] max-h-[160px] py-2.5',
                  'text-base font-arabic leading-relaxed',       // 16px — prevents iOS auto-zoom
                  'placeholder:text-muted-foreground/50',
                  'focus-visible:ring-0 focus-visible:outline-none',
                )}
                style={{ scrollbarWidth: 'none' }}
                onInput={e => {
                  const el = e.currentTarget;
                  el.style.height = 'auto';
                  el.style.height = Math.min(el.scrollHeight, 160) + 'px';
                }}
              />

              {/* Send button */}
              <button
                onClick={() => handleSend()}
                disabled={loading || !input.trim()}
                className={cn(
                  'w-10 h-10 flex-shrink-0 flex items-center justify-center rounded-xl transition-all',
                  input.trim() && !loading
                    ? 'bg-jood-teal-700 text-white hover:bg-jood-teal-900 shadow-sm'
                    : 'text-muted-foreground/30 cursor-not-allowed',
                )}
              >
                {loading
                  ? <div className="w-4 h-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                  : <Send className="w-4 h-4 rotate-180" />
                }
              </button>
            </div>

            <p className="text-center text-xs text-muted-foreground/40 mt-2 font-arabic">
              {t('chat.footer.badge')}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
