import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Card, CardContent } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
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

const CHANNEL_CONFIG: { key: keyof NotifPrefs['channels']; label: string; icon: React.ElementType; desc: string }[] = [
  { key: 'daily_brief',      label: 'الموجز اليومي',       icon: Zap,         desc: 'ملخص صباحي يومي من جود' },
  { key: 'prayer_times',     label: 'أوقات الصلاة',        icon: Clock,       desc: 'تذكير قبل كل صلاة بـ 10 دقائق' },
  { key: 'task_reminders',   label: 'تذكيرات المهام',      icon: CheckSquare, desc: 'حين يقترب موعد مهمة' },
  { key: 'habit_reminders',  label: 'تذكيرات العادات',     icon: Heart,       desc: 'تذكير يومي لتسجيل العادات' },
  { key: 'financial_alerts', label: 'تنبيهات مالية',       icon: TrendingUp,  desc: 'تجاوز الميزانية أو مصروف غير معتاد' },
  { key: 'meeting_reminders',label: 'تذكيرات الاجتماعات',  icon: Calendar,    desc: 'قبل 15 دقيقة من كل موعد' },
  { key: 'portfolio_updates',label: 'تحديثات المحفظة',     icon: TrendingUp,  desc: 'تغيرات كبيرة في أسعار الأسهم' },
  { key: 'mood_checkins',    label: 'تسجيل المزاج',        icon: Heart,       desc: 'تذكير مسائي لتسجيل كيف أمضيت يومك' },
];

const NotificationPrefs: React.FC = () => {
  const { toast } = useToast();
  const [prefs, setPrefs] = useState<NotifPrefs>(() => {
    try { return { ...DEFAULT_PREFS, ...JSON.parse(localStorage.getItem(PREFS_KEY) || '{}') }; }
    catch { return DEFAULT_PREFS; }
  });
  const [pushPermission, setPushPermission] = useState<NotificationPermission>('default');

  useEffect(() => {
    if ('Notification' in window) setPushPermission(Notification.permission);
  }, []);

  const save = (next: NotifPrefs) => {
    setPrefs(next);
    localStorage.setItem(PREFS_KEY, JSON.stringify(next));
  };

  const requestPush = async () => {
    if (!('Notification' in window)) {
      toast({ title: 'المتصفح لا يدعم الإشعارات', variant: 'destructive' }); return;
    }
    const perm = await Notification.requestPermission();
    setPushPermission(perm);
    if (perm === 'granted') {
      save({ ...prefs, pushEnabled: true });
      toast({ title: '✓ إشعارات الجهاز مفعّلة', description: 'ستصلك تنبيهات جود مباشرة.' });
      // Show a test notification
      new Notification('جود AI 🌟', {
        body: 'الإشعارات تعمل بنجاح! أنا هنا لمساعدتك.',
        icon: '/favicon.ico',
      });
    } else {
      toast({ title: 'تم رفض الإذن', description: 'فعّل الإشعارات من إعدادات المتصفح.', variant: 'destructive' });
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
    <div className="space-y-5">
      {/* Header */}
      <div>
        <h3 className="font-bold text-foreground font-arabic text-base">تفضيلات الإشعارات</h3>
        <p className="text-xs text-muted-foreground font-arabic mt-0.5">
          اختر كيف ومتى تصلك تنبيهات جود
        </p>
      </div>

      {/* Delivery channels */}
      <Card className="border-border/40">
        <CardContent className="p-4 space-y-4">
          <p className="text-xs font-semibold font-arabic text-muted-foreground uppercase tracking-wide">قنوات التوصيل</p>

          {/* Push */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={cn('w-8 h-8 rounded-xl flex items-center justify-center',
                pushPermission === 'granted' ? 'bg-jood-teal-900/10' : 'bg-muted/60')}>
                <Smartphone className="w-4 h-4 text-jood-teal-700" />
              </div>
              <div>
                <p className="text-sm font-arabic font-semibold text-foreground">إشعارات الجهاز</p>
                <p className="text-[11px] font-arabic text-muted-foreground">
                  {pushPermission === 'granted' ? 'مفعّلة' : pushPermission === 'denied' ? 'محجوبة من المتصفح' : 'تحتاج إذناً'}
                </p>
              </div>
            </div>
            {pushPermission === 'granted' ? (
              <Switch checked={prefs.pushEnabled} onCheckedChange={() => toggle('pushEnabled')} />
            ) : (
              <Button size="sm" onClick={requestPush}
                className="h-8 text-xs font-arabic bg-jood-teal-900 hover:bg-jood-teal-800 text-white">
                تفعيل
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
                <p className="text-sm font-arabic font-semibold text-foreground">البريد الإلكتروني</p>
                <p className="text-[11px] font-arabic text-muted-foreground">يحتاج ربط Gmail أو Outlook أولاً</p>
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
                <p className="text-sm font-arabic font-semibold text-foreground">واتساب</p>
                <p className="text-[11px] font-arabic text-muted-foreground">يحتاج ربط WhatsApp Business أولاً</p>
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
            <p className="text-xs font-semibold font-arabic text-muted-foreground uppercase tracking-wide">أنواع الإشعارات</p>
            <Badge variant="secondary" className="text-[10px] font-arabic">
              {activeCount} / {CHANNEL_CONFIG.length} مفعّل
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
              <p className="text-sm font-arabic font-semibold text-foreground">ساعات الهدوء</p>
            </div>
            <Switch
              checked={prefs.quiet_hours.enabled}
              onCheckedChange={v => save({ ...prefs, quiet_hours: { ...prefs.quiet_hours, enabled: v } })}
            />
          </div>
          {prefs.quiet_hours.enabled && (
            <div className="flex items-center gap-3 text-sm font-arabic text-muted-foreground">
              <span>من</span>
              <input
                type="time"
                value={prefs.quiet_hours.from}
                onChange={e => save({ ...prefs, quiet_hours: { ...prefs.quiet_hours, from: e.target.value } })}
                className="border border-border/40 rounded-lg px-2 py-1 text-sm bg-background text-foreground"
              />
              <span>إلى</span>
              <input
                type="time"
                value={prefs.quiet_hours.to}
                onChange={e => save({ ...prefs, quiet_hours: { ...prefs.quiet_hours, to: e.target.value } })}
                className="border border-border/40 rounded-lg px-2 py-1 text-sm bg-background text-foreground"
              />
            </div>
          )}
          <p className="text-[11px] font-arabic text-muted-foreground">
            لن تُرسَل إشعارات خلال ساعات الهدوء — تُجمَّع وتُعرض عند انتهائها.
          </p>
        </CardContent>
      </Card>
    </div>
  );
};

export default NotificationPrefs;
