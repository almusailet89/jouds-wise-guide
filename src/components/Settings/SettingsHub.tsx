import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { BookHeart, Shield, Link2, Bell, CalendarDays, Mic2, UserCog, Lock } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useLanguage } from '@/hooks/useLanguage';
import { useRoles } from '@/hooks/useRoles';
import MemoryCenter from '@/components/Memory/MemoryCenter';
import SecurityCenter from '@/components/Security/SecurityCenter';
import IntegrationsHub from '@/components/Settings/IntegrationsHub';
import CalendarSettings from '@/components/Settings/CalendarSettings';
import NotificationPrefs from '@/components/Notifications/NotificationPrefs';
import VoiceSettings from '@/components/Settings/VoiceSettings';

type SettingsTab = 'profile' | 'voice' | 'memory' | 'calendar' | 'security' | 'integrations' | 'notifications';

interface SettingsHubProps {
  onNavigate?: (tab: string) => void;
  onOpenProfile?: () => void;
}

const SettingsHub: React.FC<SettingsHubProps> = ({ onNavigate, onOpenProfile }) => {
  const { t, lang } = useLanguage();
  const { isAdmin } = useRoles();
  const [active, setActive] = useState<SettingsTab>('profile');

  const tabs: { value: SettingsTab; label: string; icon: React.ElementType; adminOnly?: boolean }[] = [
    { value: 'profile',       label: lang === 'ar' ? 'الحساب' : 'Account',       icon: UserCog },
    { value: 'voice',         label: lang === 'ar' ? 'الصوت' : 'Voice',          icon: Mic2 },
    { value: 'calendar',      label: t('settings.tab.calendar'),                  icon: CalendarDays },
    { value: 'memory',        label: t('settings.tab.memory'),                    icon: BookHeart },
    { value: 'integrations',  label: t('settings.tab.integrations'),              icon: Link2 },
    { value: 'notifications', label: t('settings.tab.notifications'),             icon: Bell },
    { value: 'security',      label: t('settings.tab.security'),                  icon: Shield },
  ];
  const TABS = tabs.filter(tab => !tab.adminOnly || isAdmin());

  return (
    <div className="space-y-4">
      {/* Sub-tab bar — scrollable on small screens */}
      <div className="overflow-x-auto pb-1 -mb-1">
        <div className="flex gap-1 p-1 bg-muted/40 rounded-xl border border-border/30 w-fit min-w-full sm:min-w-0">
          {TABS.map(({ value, label, icon: Icon }) => (
            <button
              key={value}
              onClick={() => setActive(value)}
              className={cn(
                'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-arabic transition-all duration-200 whitespace-nowrap flex-shrink-0',
                active === value
                  ? 'bg-card shadow-sm text-foreground font-semibold'
                  : 'text-muted-foreground hover:text-foreground',
              )}
            >
              <Icon className="w-3.5 h-3.5 flex-shrink-0" />
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <AnimatePresence mode="wait">
        <motion.div
          key={active}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
        >
          {active === 'profile'       && (
            <div className="jood-card p-6 flex flex-col sm:flex-row items-center gap-4 text-center sm:text-start">
              <div className="w-12 h-12 rounded-2xl bg-jood-gold-500/15 flex items-center justify-center flex-shrink-0">
                <UserCog className="w-6 h-6 text-jood-gold-600 dark:text-jood-gold-300" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-arabic font-bold text-foreground">
                  {lang === 'ar' ? 'ملفك الشخصي' : 'Your profile'}
                </p>
                <p className="text-sm text-muted-foreground font-arabic mt-0.5">
                  {lang === 'ar' ? 'عدّل اسمك وجنسك وعملتك وكل تفاصيل حسابك' : 'Edit your name, gender, currency, and account details'}
                </p>
              </div>
              <button onClick={() => onOpenProfile?.()} className="jood-btn-primary !py-2.5 font-arabic flex-shrink-0">
                {lang === 'ar' ? 'تعديل الملف الشخصي' : 'Edit profile'}
              </button>
            </div>
          )}
          {active === 'voice'         && <VoiceSettings />}
          {active === 'calendar'      && <CalendarSettings />}
          {active === 'memory'        && <MemoryCenter />}
          {active === 'integrations'  && <IntegrationsHub />}
          {active === 'notifications' && <NotificationPrefs />}
          {active === 'security'      && <SecurityCenter />}
        </motion.div>
      </AnimatePresence>
    </div>
  );
};

export default SettingsHub;
