import { useMemo } from 'react';
import { useProfile } from './useProfile';

// Common timezones meaningful for JOOD AI users
export const TIMEZONE_OPTIONS = [
  { tz: 'Asia/Riyadh',    labelAr: 'الرياض (UTC+3)',          labelEn: 'Riyadh (UTC+3)'        },
  { tz: 'Asia/Dubai',     labelAr: 'دبي / أبوظبي (UTC+4)',   labelEn: 'Dubai / Abu Dhabi (UTC+4)' },
  { tz: 'Asia/Kuwait',    labelAr: 'الكويت (UTC+3)',          labelEn: 'Kuwait (UTC+3)'         },
  { tz: 'Asia/Bahrain',   labelAr: 'البحرين (UTC+3)',         labelEn: 'Bahrain (UTC+3)'        },
  { tz: 'Asia/Qatar',     labelAr: 'قطر (UTC+3)',             labelEn: 'Qatar (UTC+3)'          },
  { tz: 'Asia/Muscat',    labelAr: 'مسقط (UTC+4)',            labelEn: 'Muscat (UTC+4)'         },
  { tz: 'Africa/Cairo',   labelAr: 'القاهرة (UTC+3)',         labelEn: 'Cairo (UTC+3)'          },
  { tz: 'Europe/London',  labelAr: 'لندن (UTC+0/+1)',         labelEn: 'London (UTC+0/+1)'      },
  { tz: 'Europe/Paris',   labelAr: 'باريس (UTC+1/+2)',        labelEn: 'Paris (UTC+1/+2)'       },
  { tz: 'America/New_York', labelAr: 'نيويورك (UTC-5/-4)',    labelEn: 'New York (UTC-5/-4)'    },
  { tz: 'America/Los_Angeles', labelAr: 'لوس أنجلوس (UTC-8/-7)', labelEn: 'Los Angeles (UTC-8/-7)' },
  { tz: 'Asia/Tokyo',     labelAr: 'طوكيو (UTC+9)',           labelEn: 'Tokyo (UTC+9)'          },
];

export function useTimezone() {
  const { profile } = useProfile();

  const tz = useMemo(() => {
    if (profile?.timezone_auto) {
      try {
        return Intl.DateTimeFormat().resolvedOptions().timeZone;
      } catch {
        return 'Asia/Riyadh';
      }
    }
    return profile?.timezone ?? 'Asia/Riyadh';
  }, [profile?.timezone, profile?.timezone_auto]);

  const formatDate = useMemo(() => (date: Date | string, opts?: Intl.DateTimeFormatOptions) => {
    const d = typeof date === 'string' ? new Date(date) : date;
    return d.toLocaleDateString(undefined, { timeZone: tz, ...opts });
  }, [tz]);

  const formatTime = useMemo(() => (date: Date | string, opts?: Intl.DateTimeFormatOptions) => {
    const d = typeof date === 'string' ? new Date(date) : date;
    return d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', timeZone: tz, ...opts });
  }, [tz]);

  const formatDateTime = useMemo(() => (date: Date | string, opts?: Intl.DateTimeFormatOptions) => {
    const d = typeof date === 'string' ? new Date(date) : date;
    return d.toLocaleString(undefined, { timeZone: tz, ...opts });
  }, [tz]);

  // Returns a YYYY-MM-DD string for "today" in the user's timezone
  const todayStr = useMemo(() => {
    return new Date().toLocaleDateString('en-CA', { timeZone: tz }); // en-CA = YYYY-MM-DD
  }, [tz]);

  // Returns current hour (0-23) in user's timezone — useful for greetings, prayer logic
  const currentHour = useMemo(() => {
    return parseInt(new Date().toLocaleString('en-US', { hour: 'numeric', hour12: false, timeZone: tz }), 10);
  }, [tz]);

  return { tz, formatDate, formatTime, formatDateTime, todayStr, currentHour };
}
