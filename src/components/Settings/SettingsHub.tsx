import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Brain, BookHeart, Shield, Link2, Bell, CalendarDays, Mic2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useLanguage } from '@/hooks/useLanguage';
import AIRecommendations from '@/components/Recommendations/AIRecommendations';
import MemoryCenter from '@/components/Memory/MemoryCenter';
import SecurityCenter from '@/components/Security/SecurityCenter';
import IntegrationsHub from '@/components/Settings/IntegrationsHub';
import CalendarSettings from '@/components/Settings/CalendarSettings';
import NotificationPrefs from '@/components/Notifications/NotificationPrefs';
import VoiceSettings from '@/components/Settings/VoiceSettings';

type SettingsTab = 'insights' | 'voice' | 'memory' | 'calendar' | 'security' | 'integrations' | 'notifications';

interface SettingsHubProps {
  onNavigate?: (tab: string) => void;
}

const SettingsHub: React.FC<SettingsHubProps> = ({ onNavigate }) => {
  const { t, lang } = useLanguage();
  const [active, setActive] = useState<SettingsTab>('insights');

  const TABS: { value: SettingsTab; label: string; icon: React.ElementType }[] = [
    { value: 'insights',      label: t('settings.tab.insights'),      icon: Brain },
    { value: 'voice',         label: lang === 'ar' ? 'الصوت' : 'Voice', icon: Mic2 },
    { value: 'calendar',      label: t('settings.tab.calendar'),      icon: CalendarDays },
    { value: 'memory',        label: t('settings.tab.memory'),        icon: BookHeart },
    { value: 'integrations',  label: t('settings.tab.integrations'),  icon: Link2 },
    { value: 'notifications', label: t('settings.tab.notifications'), icon: Bell },
    { value: 'security',      label: t('settings.tab.security'),      icon: Shield },
  ];

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
          {active === 'insights'      && <AIRecommendations onNavigate={onNavigate ?? (() => {})} />}
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
