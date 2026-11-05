import type { Lang } from '@/lib/i18n';

// Stored category keys are English (new entries) or Arabic (older entries typed in Arabic).
const CAT_AR: Record<string, string> = {
  Salary: 'الراتب', Food: 'مطاعم وطعام', Transportation: 'مواصلات',
  Housing: 'سكن وإيجار', Healthcare: 'صحة', Entertainment: 'ترفيه',
  Shopping: 'تسوق', Bills: 'فواتير', Education: 'تعليم',
  Freelance: 'عمل حر', Investment: 'استثمار', Business: 'أعمال',
  Bonus: 'مكافأة', savings: 'ادخار', general: 'عام',
  'Emergency Fund': 'طوارئ', 'Goal-based': 'هدف', Other: 'أخرى',
  'Food & Dining': 'مطاعم وطعام',
};

const CAT_EN: Record<string, string> = {
  Salary: 'Salary', Food: 'Food & Dining', Transportation: 'Transport',
  Housing: 'Housing & Rent', Healthcare: 'Health', Entertainment: 'Entertainment',
  Shopping: 'Shopping', Bills: 'Bills', Education: 'Education',
  Freelance: 'Freelance', Investment: 'Investment', Business: 'Business',
  Bonus: 'Bonus', savings: 'Savings', general: 'General',
  'Emergency Fund': 'Emergency Fund', 'Goal-based': 'Goal', Other: 'Other',
  'الراتب': 'Salary', 'مطاعم وطعام': 'Food & Dining', 'مواصلات': 'Transport',
  'سكن وإيجار': 'Housing & Rent', 'صحة': 'Health', 'ترفيه': 'Entertainment',
  'تسوق': 'Shopping', 'فواتير': 'Bills', 'تعليم': 'Education',
  'عمل حر': 'Freelance', 'استثمار': 'Investment', 'أعمال': 'Business',
  'مكافأة': 'Bonus', 'ادخار': 'Savings', 'عام': 'General',
  'صندوق الطوارئ': 'Emergency Fund', 'هدف': 'Goal', 'أخرى': 'Other',
};

export function categoryLabel(category: string | null | undefined, lang: Lang): string {
  const key = category?.trim();
  if (!key) return lang === 'ar' ? 'عام' : 'General';
  return (lang === 'ar' ? CAT_AR[key] : CAT_EN[key]) ?? key;
}
