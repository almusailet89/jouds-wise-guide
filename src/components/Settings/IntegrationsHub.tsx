import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import { useLanguage } from '@/hooks/useLanguage';
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
  capabilitiesEn: string[];
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
    capabilitiesEn: ['Send messages', 'Meeting notifications', 'Task reminders', 'Daily digest'],
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
    capabilitiesEn: ['Event sync', 'Meeting booking', 'Calendar invites', 'Smart reminders'],
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
    capabilitiesEn: ['iCloud sync', 'iPhone events', 'Apple reminders'],
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
    capabilitiesEn: ['Draft emails', 'Direct send', 'Thread tracking', 'Smart labels'],
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
    capabilitiesEn: ['Email', 'Teams meetings', 'Outlook calendar', 'OneDrive'],
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
    capabilitiesEn: ['Team notifications', 'Daily summary', 'Task reminders', 'Portfolio reports'],
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
    capabilitiesEn: ['Task sync', 'Add notes', 'Update databases'],
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
    capabilitiesEn: ['Morning brief', 'Instant alerts', 'Quick commands'],
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
    capabilitiesEn: ['Book meetings', 'Teams notifications', 'Record meetings'],
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
    capabilitiesEn: ['Create meetings', 'Generate links', 'Send invites'],
    color: 'bg-blue-400',
  },
];

const CATEGORY_ICONS: Record<string, React.ElementType> = {
  communication: MessageSquare,
  calendar:      Calendar,
  productivity:  Zap,
  finance:       Briefcase,
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
  const { t, lang } = useLanguage();

  const isComingSoon = integration.authType === 'coming_soon';
  const displayName = lang === 'ar' ? integration.nameAr : integration.name;
  const displayDesc = lang === 'ar' ? integration.descAr : integration.description;

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
            <span className="font-semibold text-sm text-foreground font-arabic">{displayName}</span>
            {connected && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 flex-shrink-0" />}
            {isComingSoon && <Badge variant="secondary" className="text-[10px] font-arabic">{t('integr.coming.soon')}</Badge>}
          </div>
          <p className="text-xs text-muted-foreground font-arabic mt-0.5 truncate">{displayDesc}</p>
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
              {connected ? t('integr.btn.disconnect') : integration.authType === 'apikey' ? t('integr.btn.connect') : t('integr.btn.login')}
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
            <p className="text-[11px] font-arabic text-muted-foreground mb-2">{t('integr.capabilities')}</p>
            <div className="flex flex-wrap gap-1.5">
              {(lang === 'ar' ? integration.capabilities : integration.capabilitiesEn).map(cap => (
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
                  placeholder={t('integr.key.placeholder')}
                  className="text-sm font-mono h-9"
                  dir="ltr"
                />
                <Button
                  size="sm"
                  onClick={() => { if (inputVal.trim()) onConnect(integration.id); }}
                  className="h-9 bg-jood-teal-900 hover:bg-jood-teal-800 text-white text-xs font-arabic"
                  disabled={!inputVal.trim()}
                >
                  {t('integr.btn.connect')}
                </Button>
              </div>
            </div>
          )}

          {/* OAuth instructions */}
          {!connected && integration.authType === 'oauth' && (
            <div className="flex items-start gap-2 p-2.5 bg-muted/40 rounded-xl">
              <Info className="w-3.5 h-3.5 text-muted-foreground mt-0.5 flex-shrink-0" />
              <p className="text-[11px] font-arabic text-muted-foreground leading-relaxed">
                {t('integr.oauth.hint')}
              </p>
            </div>
          )}

          {/* Coming soon */}
          {isComingSoon && (
            <div className="flex items-center gap-2 text-xs font-arabic text-muted-foreground">
              <Settings2 className="w-3.5 h-3.5" />
              {t('integr.dev.msg')}
            </div>
          )}

          {/* Connected state */}
          {connected && (
            <div className="flex items-center gap-2 p-2.5 bg-emerald-500/5 rounded-xl border border-emerald-500/20">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
              <div className="flex-1">
                <p className="text-xs font-arabic text-emerald-600 font-semibold">{t('integr.success')}</p>
                <p className="text-[10px] font-arabic text-muted-foreground mt-0.5">
                  {t('notif.types.title')} {notifEnabled ? t('integr.notif.on') : t('integr.notif.off')} {t('integr.notif.hint')}
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
  const { t, lang } = useLanguage();
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

    const displayName = lang === 'ar' ? integration.nameAr : integration.name;
    if (integration.authType === 'oauth') {
      toast({ title: `${displayName}…` });
      setTimeout(() => {
        save({ ...states, [id]: { connected: true, apiKey: '', notifEnabled: true } });
        toast({ title: `✓ ${t('integr.success')} — ${displayName}` });
      }, 1500);
    } else {
      const cur = get(id);
      if (!cur.apiKey.trim()) return;
      save({ ...states, [id]: { ...cur, connected: true } });
      toast({ title: `✓ ${t('integr.success')} — ${displayName}` });
    }
  };

  const handleDisconnect = (id: string) => {
    const integration = INTEGRATIONS.find(i => i.id === id);
    const displayName = integration ? (lang === 'ar' ? integration.nameAr : integration.name) : '';
    save({ ...states, [id]: { connected: false, apiKey: '', notifEnabled: true } });
    toast({ title: `${t('integr.btn.disconnect')} — ${displayName}`, variant: 'default' });
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
          <h3 className="font-bold text-foreground font-arabic text-base">{t('integr.title')}</h3>
          <p className="text-xs text-muted-foreground font-arabic mt-0.5">
            {t('integr.subtitle')}
          </p>
        </div>
        {connectedCount > 0 && (
          <Badge className="bg-jood-teal-900/10 text-jood-teal-700 border-jood-teal-700/20 font-arabic text-xs">
            {connectedCount} {t('integr.connected')}
          </Badge>
        )}
      </div>

      {/* Category filter */}
      <div className="flex gap-1.5 flex-wrap">
        {categories.map(cat => {
          const Icon = cat === 'all' ? Globe : (CATEGORY_ICONS[cat] ?? Globe);
          const label = cat === 'all' ? t('integr.cat.all') : t(`integr.cat.${cat}` as any);
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
              {label}
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
          {t('integr.privacy')}
        </p>
      </div>
    </div>
  );
};

export default IntegrationsHub;
