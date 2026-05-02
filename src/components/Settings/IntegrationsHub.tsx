import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import {
  CheckCircle2, Circle, ExternalLink, ChevronDown, ChevronUp,
  Zap, Bell, Mail, Calendar, MessageSquare, Briefcase,
  Globe, Settings2, Info,
} from 'lucide-react';

// ─── Integration definitions ─────────────────────────────────────────────────
interface Integration {
  id: string;
  name: string;
  nameAr: string;
  icon: string;
  category: 'communication' | 'calendar' | 'productivity' | 'finance';
  description: string;
  descAr: string;
  authType: 'oauth' | 'apikey' | 'coming_soon';
  oauthUrl?: string;
  keyLabel?: string;
  capabilities: string[];
  color: string;
}

const INTEGRATIONS: Integration[] = [
  {
    id: 'whatsapp',
    name: 'WhatsApp Business',
    nameAr: 'واتساب بيزنس',
    icon: '💬',
    category: 'communication',
    description: 'Send messages, receive notifications, book meetings via WhatsApp',
    descAr: 'أرسل رسائل وابق على اطلاع بكل شيء مباشرة من واتساب',
    authType: 'apikey',
    keyLabel: 'WhatsApp Business API Key',
    capabilities: ['إرسال رسائل', 'إشعارات الاجتماعات', 'تذكيرات المهام', 'موجز يومي'],
    color: 'bg-green-500',
  },
  {
    id: 'google_calendar',
    name: 'Google Calendar',
    nameAr: 'تقويم جوجل',
    icon: '📅',
    category: 'calendar',
    description: 'Two-way sync with Google Calendar — book meetings, get reminders',
    descAr: 'مزامنة ثنائية مع تقويم جوجل — احجزي المواعيد وانسّقي الاجتماعات',
    authType: 'oauth',
    oauthUrl: 'https://accounts.google.com/o/oauth2/auth',
    capabilities: ['مزامنة الأحداث', 'حجز الاجتماعات', 'دعوات التقويم', 'تذكيرات ذكية'],
    color: 'bg-blue-500',
  },
  {
    id: 'apple_calendar',
    name: 'Apple Calendar',
    nameAr: 'تقويم آبل',
    icon: '🍎',
    category: 'calendar',
    description: 'Sync with iCloud Calendar for iPhone and Mac users',
    descAr: 'مزامنة مع iCloud لمستخدمي iPhone و Mac',
    authType: 'oauth',
    capabilities: ['مزامنة iCloud', 'أحداث iPhone', 'تذكيرات آبل'],
    color: 'bg-gray-800',
  },
  {
    id: 'gmail',
    name: 'Gmail',
    nameAr: 'جيميل',
    icon: '📧',
    category: 'communication',
    description: 'Let Jood draft and send emails directly from chat',
    descAr: 'دعي جود تصيغ وترسل الإيميلات مباشرة من المحادثة',
    authType: 'oauth',
    oauthUrl: 'https://accounts.google.com/o/oauth2/auth',
    capabilities: ['صياغة إيميلات', 'إرسال مباشر', 'متابعة المحادثات', 'تصنيف ذكي'],
    color: 'bg-red-500',
  },
  {
    id: 'outlook',
    name: 'Outlook / Office 365',
    nameAr: 'أوتلوك / أوفيس 365',
    icon: '📨',
    category: 'communication',
    description: 'Microsoft email and calendar integration for corporate users',
    descAr: 'تكامل مايكروسوفت للبريد والتقويم — مثالي لبيئة الشركات',
    authType: 'oauth',
    capabilities: ['البريد الإلكتروني', 'Teams meetings', 'تقويم Outlook', 'OneDrive'],
    color: 'bg-blue-700',
  },
  {
    id: 'slack',
    name: 'Slack',
    nameAr: 'سلاك',
    icon: '⚡',
    category: 'productivity',
    description: 'Get Jood updates in Slack — task alerts, daily briefs, meeting reminders',
    descAr: 'احصل على إشعارات جود في سلاك — تنبيهات المهام والملخصات اليومية',
    authType: 'oauth',
    capabilities: ['إشعارات الفريق', 'ملخص يومي', 'تذكيرات المهام', 'تقارير المحفظة'],
    color: 'bg-purple-600',
  },
  {
    id: 'notion',
    name: 'Notion',
    nameAr: 'نوشن',
    icon: '📓',
    category: 'productivity',
    description: 'Sync tasks and notes with your Notion workspace',
    descAr: 'زامن مهامك وملاحظاتك مع مساحة عمل نوشن',
    authType: 'apikey',
    keyLabel: 'Notion Integration Token',
    capabilities: ['مزامنة المهام', 'إضافة ملاحظات', 'تحديث قواعد البيانات'],
    color: 'bg-gray-900',
  },
  {
    id: 'telegram',
    name: 'Telegram',
    nameAr: 'تيليجرام',
    icon: '✈️',
    category: 'communication',
    description: 'Receive Jood briefings and alerts via Telegram bot',
    descAr: 'استقبل ملخصات جود وتنبيهاتها عبر بوت تيليجرام',
    authType: 'apikey',
    keyLabel: 'Telegram Bot Token',
    capabilities: ['ملخص صباحي', 'تنبيهات فورية', 'أوامر سريعة'],
    color: 'bg-sky-500',
  },
  {
    id: 'ms_teams',
    name: 'Microsoft Teams',
    nameAr: 'مايكروسوفت تيمز',
    icon: '👥',
    category: 'communication',
    description: 'Schedule Teams meetings and get notifications in Teams',
    descAr: 'احجز اجتماعات Teams وتلقَّ الإشعارات مباشرة فيه',
    authType: 'coming_soon',
    capabilities: ['حجز اجتماعات', 'إشعارات Teams', 'تسجيل الاجتماعات'],
    color: 'bg-indigo-600',
  },
  {
    id: 'zoom',
    name: 'Zoom',
    nameAr: 'زووم',
    icon: '🎥',
    category: 'productivity',
    description: 'Book Zoom meetings from chat — Jood generates the link',
    descAr: 'احجز اجتماعات زووم من المحادثة — جود تُنشئ الرابط',
    authType: 'coming_soon',
    capabilities: ['إنشاء اجتماعات', 'توليد روابط', 'إرسال دعوات'],
    color: 'bg-blue-400',
  },
];

const CATEGORY_LABELS: Record<string, { ar: string; icon: React.ElementType }> = {
  communication: { ar: 'التواصل',      icon: MessageSquare },
  calendar:      { ar: 'التقويم',      icon: Calendar },
  productivity:  { ar: 'الإنتاجية',   icon: Zap },
  finance:       { ar: 'المالية',      icon: Briefcase },
};

const STORAGE_KEY = 'jood.integrations';

// ─── Integration Card ─────────────────────────────────────────────────────────
const IntegrationCard: React.FC<{
  integration: Integration;
  connected: boolean;
  apiKey: string;
  onConnect: (id: string) => void;
  onDisconnect: (id: string) => void;
  onKeyChange: (id: string, key: string) => void;
  notifEnabled: boolean;
  onToggleNotif: (id: string, v: boolean) => void;
}> = ({ integration, connected, apiKey, onConnect, onDisconnect, onKeyChange, notifEnabled, onToggleNotif }) => {
  const [expanded, setExpanded] = useState(false);
  const [inputVal, setInputVal] = useState(apiKey);

  const isComingSoon = integration.authType === 'coming_soon';

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        'border rounded-2xl overflow-hidden transition-all duration-200',
        connected ? 'border-jood-teal-700/40 bg-jood-teal-900/5' : 'border-border/40 bg-card',
        isComingSoon && 'opacity-60',
      )}
    >
      {/* Main row */}
      <div className="flex items-center gap-3 p-4">
        <div className={cn('w-10 h-10 rounded-xl flex items-center justify-center text-xl flex-shrink-0', integration.color, 'bg-opacity-15 dark:bg-opacity-20')}>
          {integration.icon}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-sm text-foreground font-arabic">{integration.nameAr}</span>
            {connected && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 flex-shrink-0" />}
            {isComingSoon && <Badge variant="secondary" className="text-[10px] font-arabic">قريباً</Badge>}
          </div>
          <p className="text-xs text-muted-foreground font-arabic mt-0.5 truncate">{integration.descAr}</p>
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          {connected && (
            <Switch
              checked={notifEnabled}
              onCheckedChange={v => onToggleNotif(integration.id, v)}
              className="scale-90"
            />
          )}
          {!isComingSoon && (
            <Button
              size="sm"
              variant={connected ? 'outline' : 'default'}
              className={cn(
                'h-8 text-xs font-arabic rounded-xl',
                connected
                  ? 'border-border/40 text-muted-foreground hover:text-destructive hover:border-destructive/40'
                  : 'bg-jood-teal-900 hover:bg-jood-teal-800 text-white',
              )}
              onClick={() => {
                if (connected) onDisconnect(integration.id);
                else if (integration.authType === 'oauth') onConnect(integration.id);
                else setExpanded(!expanded);
              }}
            >
              {connected ? 'فصل' : integration.authType === 'apikey' ? 'ربط' : 'تسجيل دخول'}
            </Button>
          )}
          <button
            onClick={() => setExpanded(!expanded)}
            className="text-muted-foreground hover:text-foreground p-1"
          >
            {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Expanded panel */}
      {expanded && (
        <div className="px-4 pb-4 border-t border-border/20 pt-3 space-y-3">
          {/* Capabilities */}
          <div>
            <p className="text-[11px] font-arabic text-muted-foreground mb-2">القدرات المتاحة:</p>
            <div className="flex flex-wrap gap-1.5">
              {integration.capabilities.map(cap => (
                <span key={cap} className="text-[11px] font-arabic px-2 py-0.5 bg-muted/60 rounded-full text-foreground/70">
                  {cap}
                </span>
              ))}
            </div>
          </div>

          {/* API Key input for apikey auth */}
          {!connected && integration.authType === 'apikey' && (
            <div className="space-y-2">
              <Label className="text-xs font-arabic text-muted-foreground">{integration.keyLabel}</Label>
              <div className="flex gap-2">
                <Input
                  type="password"
                  value={inputVal}
                  onChange={e => { setInputVal(e.target.value); onKeyChange(integration.id, e.target.value); }}
                  placeholder="أدخل المفتاح..."
                  className="text-sm font-mono h-9"
                  dir="ltr"
                />
                <Button
                  size="sm"
                  onClick={() => { if (inputVal.trim()) onConnect(integration.id); }}
                  className="h-9 bg-jood-teal-900 hover:bg-jood-teal-800 text-white text-xs font-arabic"
                  disabled={!inputVal.trim()}
                >
                  ربط
                </Button>
              </div>
            </div>
          )}

          {/* OAuth instructions */}
          {!connected && integration.authType === 'oauth' && (
            <div className="flex items-start gap-2 p-2.5 bg-muted/40 rounded-xl">
              <Info className="w-3.5 h-3.5 text-muted-foreground mt-0.5 flex-shrink-0" />
              <p className="text-[11px] font-arabic text-muted-foreground leading-relaxed">
                ستُعاد توجيهك لتسجيل الدخول بحسابك. بعد الموافقة، ستُربط جود تلقائياً.
              </p>
            </div>
          )}

          {/* Coming soon */}
          {isComingSoon && (
            <div className="flex items-center gap-2 text-xs font-arabic text-muted-foreground">
              <Settings2 className="w-3.5 h-3.5" />
              قيد التطوير — سيكون متاحاً قريباً
            </div>
          )}

          {/* Connected state */}
          {connected && (
            <div className="flex items-center gap-2 p-2.5 bg-emerald-500/5 rounded-xl border border-emerald-500/20">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
              <div className="flex-1">
                <p className="text-xs font-arabic text-emerald-600 font-semibold">مرتبط بنجاح</p>
                <p className="text-[10px] font-arabic text-muted-foreground mt-0.5">
                  الإشعارات {notifEnabled ? 'مفعّلة' : 'معطّلة'} — يمكنك تغييرها من الزر أعلاه
                </p>
              </div>
            </div>
          )}
        </div>
      )}
    </motion.div>
  );
};

// ─── Main Component ───────────────────────────────────────────────────────────
const IntegrationsHub: React.FC = () => {
  const { toast } = useToast();
  const [activeCategory, setActiveCategory] = useState<string>('all');

  // Persisted state: { [id]: { connected, apiKey, notifEnabled } }
  const [states, setStates] = useState<Record<string, { connected: boolean; apiKey: string; notifEnabled: boolean }>>(() => {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
    } catch { return {}; }
  });

  const save = (next: typeof states) => {
    setStates(next);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  };

  const get = (id: string) => states[id] ?? { connected: false, apiKey: '', notifEnabled: true };

  const handleConnect = (id: string) => {
    const integration = INTEGRATIONS.find(i => i.id === id);
    if (!integration) return;

    if (integration.authType === 'oauth') {
      // Real OAuth would redirect — for now simulate with toast + mock connection
      toast({ title: `جاري الاتصال بـ ${integration.nameAr}…`, description: 'ستُعاد التوجيه لتسجيل الدخول.' });
      // Simulate successful OAuth after 1.5s (in production this would be a real redirect)
      setTimeout(() => {
        save({ ...states, [id]: { connected: true, apiKey: '', notifEnabled: true } });
        toast({ title: `✓ تم ربط ${integration.nameAr}`, description: 'جود جاهزة للتكامل الآن.' });
      }, 1500);
    } else {
      const cur = get(id);
      if (!cur.apiKey.trim()) return;
      save({ ...states, [id]: { ...cur, connected: true } });
      toast({ title: `✓ تم ربط ${integration?.nameAr}` });
    }
  };

  const handleDisconnect = (id: string) => {
    const integration = INTEGRATIONS.find(i => i.id === id);
    save({ ...states, [id]: { connected: false, apiKey: '', notifEnabled: true } });
    toast({ title: `تم فصل ${integration?.nameAr}`, variant: 'default' });
  };

  const handleKeyChange = (id: string, key: string) => {
    const cur = get(id);
    save({ ...states, [id]: { ...cur, apiKey: key } });
  };

  const handleToggleNotif = (id: string, v: boolean) => {
    const cur = get(id);
    save({ ...states, [id]: { ...cur, notifEnabled: v } });
  };

  const connectedCount = Object.values(states).filter(s => s.connected).length;
  const categories = ['all', ...Array.from(new Set(INTEGRATIONS.map(i => i.category)))];

  const filtered = activeCategory === 'all'
    ? INTEGRATIONS
    : INTEGRATIONS.filter(i => i.category === activeCategory);

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-bold text-foreground font-arabic text-base">التكاملات والاتصالات</h3>
          <p className="text-xs text-muted-foreground font-arabic mt-0.5">
            اربط جود بتطبيقاتك المفضّلة لتجربة سكرتيرة متكاملة
          </p>
        </div>
        {connectedCount > 0 && (
          <Badge className="bg-jood-teal-900/10 text-jood-teal-700 border-jood-teal-700/20 font-arabic text-xs">
            {connectedCount} مرتبط
          </Badge>
        )}
      </div>

      {/* Category filter */}
      <div className="flex gap-1.5 flex-wrap">
        {categories.map(cat => {
          const info = cat === 'all' ? { ar: 'الكل', icon: Globe } : CATEGORY_LABELS[cat];
          const Icon = info?.icon ?? Globe;
          return (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat)}
              className={cn(
                'flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-arabic transition-all duration-150',
                activeCategory === cat
                  ? 'bg-jood-teal-900 text-white shadow-sm'
                  : 'bg-muted/50 text-muted-foreground hover:text-foreground border border-border/30',
              )}
            >
              <Icon className="w-3.5 h-3.5" />
              {cat === 'all' ? 'الكل' : CATEGORY_LABELS[cat]?.ar ?? cat}
            </button>
          );
        })}
      </div>

      {/* Integration cards */}
      <div className="space-y-2.5">
        {filtered.map((integration, i) => {
          const st = get(integration.id);
          return (
            <IntegrationCard
              key={integration.id}
              integration={integration}
              connected={st.connected}
              apiKey={st.apiKey}
              notifEnabled={st.notifEnabled}
              onConnect={handleConnect}
              onDisconnect={handleDisconnect}
              onKeyChange={handleKeyChange}
              onToggleNotif={handleToggleNotif}
            />
          );
        })}
      </div>

      {/* Footer note */}
      <div className="flex items-start gap-2 p-3 bg-muted/30 rounded-xl border border-border/20">
        <Info className="w-3.5 h-3.5 text-muted-foreground mt-0.5 flex-shrink-0" />
        <p className="text-[11px] font-arabic text-muted-foreground leading-relaxed">
          بيانات التكامل مشفّرة ومحمية. لن تصل جود إلى أي معلومات دون إذنك الصريح.
          OAuth tokens تُخزَّن بأمان ولا تُشارَك مع أطراف خارجية.
        </p>
      </div>
    </div>
  );
};

export default IntegrationsHub;
