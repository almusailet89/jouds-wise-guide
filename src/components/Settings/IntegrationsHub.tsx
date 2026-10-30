import React, { useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useLanguage } from '@/hooks/useLanguage';

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

// These providers have no verified connection backend yet. Never accept keys or
// report a connection based on browser-local state.
const IntegrationsHub: React.FC = () => {
  const { lang, dir, t } = useLanguage();

  useEffect(() => {
    // Retire API keys saved by the previous simulated integration screen.
    localStorage.removeItem('jood.integrations');
  }, []);

  return (
    <section className="space-y-5" dir={dir} aria-labelledby="integrations-title">
      <div>
        <h3 id="integrations-title" className="font-bold font-arabic text-base">{t('integr.title')}</h3>
        <p className="text-sm text-muted-foreground font-arabic mt-2">
          {lang === 'ar'
            ? 'الربط بالخدمات الخارجية غير متاح حالياً. ستظهر خيارات الربط هنا عندما تصبح جاهزة للاستخدام.'
            : 'External service connections are not available yet. Connection options will appear here when they are ready to use.'}
        </p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        {INTEGRATIONS.map(integration => (
          <Card key={integration.id}>
            <CardContent className="p-4 flex items-center gap-3">
              <span aria-hidden="true" className="text-2xl">{integration.icon}</span>
              <span className="font-arabic font-medium flex-1">
                {lang === 'ar' ? integration.nameAr : integration.name}
              </span>
              <Badge variant="secondary" className="font-arabic">
                {lang === 'ar' ? 'غير متاح بعد' : 'Not available yet'}
              </Badge>
            </CardContent>
          </Card>
        ))}
      </div>
    </section>
  );
};

export default IntegrationsHub;
