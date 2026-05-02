import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Brain, BookHeart, Shield, Link2, Bell, CalendarDays } from 'lucide-react';
import { cn } from '@/lib/utils';
import AIRecommendations from '@/components/Recommendations/AIRecommendations';
import MemoryCenter from '@/components/Memory/MemoryCenter';
import SecurityCenter from '@/components/Security/SecurityCenter';
import IntegrationsHub from '@/components/Settings/IntegrationsHub';
import CalendarSettings from '@/components/Settings/CalendarSettings';
import NotificationPrefs from '@/components/Notifications/NotificationPrefs';

type SettingsTab = 'insights' | 'memory' | 'calendar' | 'security' | 'integrations' | 'notifications';

const TABS: { value: SettingsTab; label: string; icon: React.ElementType }[] = [
  { value: 'insights',      label: 'التوصيات',  icon: Brain },
  { value: 'calendar',      label: 'التقويم',   icon: CalendarDays },
  { value: 'memory',        label: 'الذاكرة',   icon: BookHeart },
  { value: 'integrations',  label: 'الاتصالات', icon: Link2 },
  { value: 'notifications', label: 'الإشعارات', icon: Bell },
  { value: 'security',      label: 'الخصوصية',  icon: Shield },
];

interface SettingsHubProps {
  onNavigate?: (tab: string) => void;
}

const SettingsHub: React.FC<SettingsHubProps> = ({ onNavigate }) => {
  const [active, setActive] = useState<SettingsTab>('insights');

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
