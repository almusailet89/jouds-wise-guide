import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Card, CardContent } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { useLanguage } from '@/hooks/useLanguage';
import { cn } from '@/lib/utils';
import {
  Bell, BellOff, Smartphone, Mail, MessageSquare,
  Clock, Calendar, TrendingUp, CheckSquare, Heart, Zap,
} from 'lucide-react';

const PREFS_KEY = 'jood.notif.prefs';

interface NotifPrefs {
  pushEnabled: boolean;
  emailEnabled: boolean;
  whatsappEnabled: boolean;
  channels: {
    daily_brief: boolean;
    prayer_times: boolean;
    task_reminders: boolean;
    habit_reminders: boolean;
    financial_alerts: boolean;
    meeting_reminders: boolean;
    portfolio_updates: boolean;
    mood_checkins: boolean;
  };
  quiet_hours: { enabled: boolean; from: string; to: string };
  frequency: 'instant' | 'hourly' | 'daily';
}

const DEFAULT_PREFS: NotifPrefs = {
  pushEnabled: true,
  emailEnabled: false,
  whatsappEnabled: false,
  channels: {
    daily_brief: true,
    prayer_times: true,
    task_reminders: true,
    habit_reminders: true,
    financial_alerts: true,
    meeting_reminders: true,
    portfolio_updates: false,
    mood_checkins: true,
  },
  quiet_hours: { enabled: true, from: '23:00', to: '06:00' },
  frequency: 'instant',
};

// Channel icons only — labels/descs computed inside component via t()
const CHANNEL_ICONS: { key: keyof NotifPrefs['channels']; icon: React.ElementType }[] = [
  { key: 'daily_brief',       icon: Zap         },
  { key: 'prayer_times',      icon: Clock       },
  { key: 'task_reminders',    icon: CheckSquare },
  { key: 'habit_reminders',   icon: Heart       },
  { key: 'financial_alerts',  icon: TrendingUp  },
  { key: 'meeting_reminders', icon: Calendar    },
  { key: 'portfolio_updates', icon: TrendingUp  },
  { key: 'mood_checkins',     icon: Heart       },
];

const NotificationPrefs: React.FC = () => {
  const { toast } = useToast();
  const { t, dir } = useLanguage();
  const [prefs, setPrefs] = useState<NotifPrefs>(() => {
    try { return { ...DEFAULT_PREFS, ...JSON.parse(localStorage.getItem(PREFS_KEY) || '{}') }; }
    catch { return DEFAULT_PREFS; }
  });
  const [pushPermission, setPushPermission] = useState<NotificationPermission>('default');

  useEffect(() => {
    if ('Notification' in window) setPushPermission(Notification.permission);
  }, []);

  // Build translated channel config inside component
  const CHANNEL_CONFIG = CHANNEL_ICONS.map(({ key, icon }) => ({
    key,
    icon,
    label: t(`notif.ch.${key}` as any),
    desc:  t(`notif.ch.${key}.desc` as any),
  }));

  const save = (next: NotifPrefs) => {
    setPrefs(next);
    localStorage.setItem(PREFS_KEY, JSON.stringify(next));
  };

  const requestPush = async () => {
    if (!('Notification' in window)) {
      toast({ title: t('notif.no.support'), variant: 'destructive' }); return;
    }
    const perm = await Notification.requestPermission();
    setPushPermission(perm);
    if (perm === 'granted') {
      save({ ...prefs, pushEnabled: true });
      toast({ title: t('notif.push.success'), description: t('notif.push.success.desc') });
      new Notification('جود AI 🌟', {
        body: t('notif.push.success.desc'),
        icon: '/favicon.ico',
      });
    } else {
      toast({ title: t('notif.push.denied.toast'), description: t('notif.push.denied.desc'), variant: 'destructive' });
    }
  };

  const toggle = (field: keyof Pick<NotifPrefs, 'pushEnabled'|'emailEnabled'|'whatsappEnabled'>) => {
    if (field === 'pushEnabled' && pushPermission !== 'granted' && !prefs.pushEnabled) {
      requestPush(); return;
    }
    save({ ...prefs, [field]: !prefs[field] });
  };

  const toggleChannel = (key: keyof NotifPrefs['channels']) => {
    save({ ...prefs, channels: { ...prefs.channels, [key]: !prefs.channels[key] } });
  };

  const activeCount = Object.values(prefs.channels).filter(Boolean).length;

  return (
    <div className="space-y-5" dir={dir}>
      {/* Header */}
      <div>
        <h3 className="font-bold text-foreground font-arabic text-base">{t('notif.title')}</h3>
        <p className="text-xs text-muted-foreground font-arabic mt-0.5">
          {t('notif.subtitle')}
        </p>
      </div>

      {/* Delivery channels */}
      <Card className="border-border/40">
        <CardContent className="p-4 space-y-4">
          <p className="text-xs font-semibold font-arabic text-muted-foreground uppercase tracking-wide">
            {t('notif.channels.title')}
          </p>

          {/* Push */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={cn('w-8 h-8 rounded-xl flex items-center justify-center',
                pushPermission === 'granted' ? 'bg-jood-teal-900/10' : 'bg-muted/60')}>
                <Smartphone className="w-4 h-4 text-jood-teal-700" />
              </div>
              <div>
                <p className="text-sm font-arabic font-semibold text-foreground">{t('notif.push')}</p>
                <p className="text-[11px] font-arabic text-muted-foreground">
                  {pushPermission === 'granted'
                    ? t('notif.push.granted')
                    : pushPermission === 'denied'
                    ? t('notif.push.denied')
                    : t('notif.push.default')}
                </p>
              </div>
            </div>
            {pushPermission === 'granted' ? (
              <Switch checked={prefs.pushEnabled} onCheckedChange={() => toggle('pushEnabled')} />
            ) : (
              <Button size="sm" onClick={requestPush}
                className="h-8 text-xs font-arabic bg-jood-teal-900 hover:bg-jood-teal-800 text-white">
                {t('notif.push.enable')}
              </Button>
            )}
          </div>

          {/* Email */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-xl bg-muted/60 flex items-center justify-center">
                <Mail className="w-4 h-4 text-muted-foreground" />
              </div>
              <div>
                <p className="text-sm font-arabic font-semibold text-foreground">{t('notif.email')}</p>
                <p className="text-[11px] font-arabic text-muted-foreground">{t('notif.email.hint')}</p>
              </div>
            </div>
            <Switch checked={prefs.emailEnabled} onCheckedChange={() => toggle('emailEnabled')} />
          </div>

          {/* WhatsApp */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-xl bg-green-500/10 flex items-center justify-center">
                <MessageSquare className="w-4 h-4 text-green-600" />
              </div>
              <div>
                <p className="text-sm font-arabic font-semibold text-foreground">{t('notif.whatsapp')}</p>
                <p className="text-[11px] font-arabic text-muted-foreground">{t('notif.whatsapp.hint')}</p>
              </div>
            </div>
            <Switch checked={prefs.whatsappEnabled} onCheckedChange={() => toggle('whatsappEnabled')} />
          </div>
        </CardContent>
      </Card>

      {/* Notification types */}
      <Card className="border-border/40">
        <CardContent className="p-4 space-y-1">
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs font-semibold font-arabic text-muted-foreground uppercase tracking-wide">
              {t('notif.types.title')}
            </p>
            <Badge variant="secondary" className="text-[10px] font-arabic">
              {activeCount} / {CHANNEL_CONFIG.length} {t('notif.active.count')}
            </Badge>
          </div>

          {CHANNEL_CONFIG.map(({ key, label, icon: Icon, desc }) => (
            <motion.div
              key={key}
              className="flex items-center justify-between py-2.5 border-b border-border/20 last:border-0"
            >
              <div className="flex items-center gap-3">
                <Icon className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                <div>
                  <p className="text-sm font-arabic text-foreground">{label}</p>
                  <p className="text-[11px] font-arabic text-muted-foreground">{desc}</p>
                </div>
              </div>
              <Switch
                checked={prefs.channels[key]}
                onCheckedChange={() => toggleChannel(key)}
              />
            </motion.div>
          ))}
        </CardContent>
      </Card>

      {/* Quiet hours */}
      <Card className="border-border/40">
        <CardContent className="p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <BellOff className="w-4 h-4 text-muted-foreground" />
              <p className="text-sm font-arabic font-semibold text-foreground">{t('notif.quiet.title')}</p>
            </div>
            <Switch
              checked={prefs.quiet_hours.enabled}
              onCheckedChange={v => save({ ...prefs, quiet_hours: { ...prefs.quiet_hours, enabled: v } })}
            />
          </div>
          {prefs.quiet_hours.enabled && (
            <div className="flex items-center gap-3 text-sm font-arabic text-muted-foreground">
              <span>{t('notif.quiet.from')}</span>
              <input
                type="time"
                value={prefs.quiet_hours.from}
                onChange={e => save({ ...prefs, quiet_hours: { ...prefs.quiet_hours, from: e.target.value } })}
                className="border border-border/40 rounded-lg px-2 py-1 text-sm bg-background text-foreground"
              />
              <span>{t('notif.quiet.to')}</span>
              <input
                type="time"
                value={prefs.quiet_hours.to}
                onChange={e => save({ ...prefs, quiet_hours: { ...prefs.quiet_hours, to: e.target.value } })}
                className="border border-border/40 rounded-lg px-2 py-1 text-sm bg-background text-foreground"
              />
            </div>
          )}
          <p className="text-[11px] font-arabic text-muted-foreground">
            {t('notif.quiet.desc')}
          </p>
        </CardContent>
      </Card>
    </div>
  );
};

export default NotificationPrefs;
