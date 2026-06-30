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
}

const SettingsHub: React.FC<SettingsHubProps> = ({ onNavigate }) => {
  const { t, lang } = useLanguage();
  const { isAdmin } = useRoles();
  const [active, setActive] = useState<SettingsTab>('profile');

  const TABS: { value: SettingsTab; label: string; icon: React.ElementType; adminOnly?: boolean }[] = [
    { value: 'profile',       label: lang === 'ar' ? 'الحساب' : 'Account',       icon: UserCog },
    { value: 'voice',         label: lang === 'ar' ? 'الصوت' : 'Voice',          icon: Mic2, adminOnly: true },
    { value: 'calendar',      label: t('settings.tab.calendar'),                  icon: CalendarDays },
    { value: 'memory',        label: t('settings.tab.memory'),                    icon: BookHeart },
    { value: 'integrations',  label: t('settings.tab.integrations'),              icon: Link2 },
    { value: 'notifications', label: t('settings.tab.notifications'),             icon: Bell },
    { value: 'security',      label: t('settings.tab.security'),                  icon: Shield },
  ].filter(tab => !tab.adminOnly || isAdmin());

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
            <div className="text-center py-8 text-muted-foreground text-sm font-arabic">
              <UserCog className="w-8 h-8 mx-auto mb-2 opacity-40" />
              {lang === 'ar' ? 'انقر على صورتك في الشريط العلوي لتعديل ملفك الشخصي' : 'Click your avatar in the top bar to edit your profile'}
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
