import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useProfile, UserProfile } from '@/hooks/useProfile';
import { useAuth } from '@/hooks/useAuth';
import { useLanguage } from '@/hooks/useLanguage';
import { toast } from 'sonner';
import { User, Phone, Mail, MapPin, Calendar, Sparkles, Lock, CheckCircle2, Languages, Coins, Globe, Smartphone } from 'lucide-react';
import { TIMEZONE_OPTIONS } from '@/hooks/useTimezone';
import { cn } from '@/lib/utils';
import type { Lang } from '@/lib/i18n';

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}

const AVATAR_OPTIONS = ['🌟', '👩', '👨', '🌸', '⭐', '🦋', '🌙', '🎯', '💎', '🌺'];

const CITIES_SA = [
  'الرياض', 'جدة', 'مكة المكرمة', 'المدينة المنورة', 'الدمام', 'الخبر',
  'الطائف', 'تبوك', 'بريدة', 'خميس مشيط', 'أبها', 'نجران', 'جيزان',
];

const CURRENCIES = [
  { code: 'SAR', label: 'ريال سعودي — SAR', flag: '🇸🇦' },
  { code: 'USD', label: 'دولار أمريكي — USD', flag: '🇺🇸' },
  { code: 'EUR', label: 'يورو — EUR',         flag: '🇪🇺' },
  { code: 'AED', label: 'درهم إماراتي — AED', flag: '🇦🇪' },
  { code: 'KWD', label: 'دينار كويتي — KWD',  flag: '🇰🇼' },
  { code: 'GBP', label: 'جنيه إسترليني — GBP', flag: '🇬🇧' },
];

export default function ProfileDialog({ open, onOpenChange }: Props) {
  const { user } = useAuth();
  const { profile, loading, saving, save } = useProfile();
  const { lang, dir, t, setLang } = useLanguage();

  const [form, setForm] = useState({
    display_name:  '',
    gender:        '' as 'male' | 'female' | '',
    phone:         '',
    date_of_birth: '',
    city:          '',
    nationality:   'SA',
    avatar_emoji:  '🌟',
    bio:           '',
    base_currency:  'SAR',
    app_language:   'ar' as Lang,
    timezone:       'Asia/Riyadh',
    timezone_auto:  false,
  });
  const [tab, setTab] = useState<'profile' | 'account'>('profile');
  const [newPassword, setNewPassword]     = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [changingPassword, setChangingPassword] = useState(false);

  // Populate form when profile loads
  useEffect(() => {
    if (profile) {
      setForm({
        display_name:  profile.display_name  ?? '',
        gender:        profile.gender        ?? '',
        phone:         profile.phone         ?? '',
        date_of_birth: profile.date_of_birth ?? '',
        city:          profile.city          ?? '',
        nationality:   profile.nationality   ?? 'SA',
        avatar_emoji:  profile.avatar_emoji  ?? '🌟',
        bio:           profile.bio           ?? '',
        base_currency:  profile.base_currency ?? 'SAR',
        app_language:   (profile as any).app_language ?? 'ar',
        timezone:       profile.timezone ?? 'Asia/Riyadh',
        timezone_auto:  profile.timezone_auto ?? false,
      });
    }
  }, [profile]);

  const set = (k: keyof typeof form, v: string | boolean) => setForm(f => ({ ...f, [k]: v }));

  const handleSave = async () => {
    if (!form.display_name.trim()) {
      toast.error(t('toast.name.required'));
      return;
    }
    if (!form.gender) {
      toast.error(t('toast.gender.required'));
      return;
    }

    // If language changed, update the language context immediately
    if (form.app_language !== lang) {
      await setLang(form.app_language);
    }

    const { error } = await save({
      ...form,
      gender:        form.gender as 'male' | 'female',
      phone:         form.phone         || null,
      date_of_birth: form.date_of_birth || null,
      city:          form.city          || null,
      bio:           form.bio           || null,
      app_language:   form.app_language  as any,
      timezone:       form.timezone,
      timezone_auto:  form.timezone_auto,
    } as any);
    if (error) {
      toast.error(t('toast.save.error'));
    } else {
      toast.success(t('toast.save.success'));
      onOpenChange(false);
    }
  };

  const handlePasswordChange = async () => {
    if (newPassword.length < 6)           { toast.error(t('toast.password.short'));    return; }
    if (newPassword !== confirmPassword)   { toast.error(t('toast.password.mismatch')); return; }
    setChangingPassword(true);
    const { supabase } = await import('@/integrations/supabase/client');
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    setChangingPassword(false);
    if (error) {
      toast.error(t('toast.password.error'));
    } else {
      toast.success(t('toast.password.success'));
      setNewPassword(''); setConfirmPassword('');
    }
  };

  const genderLabel = form.gender === 'female'
    ? t('profile.jood.female.label')
    : form.gender === 'male'
      ? t('profile.jood.male.label')
      : '';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto p-0" dir={dir}>
        {/* Header */}
        <div className="bg-gradient-to-br from-jood-teal-900 to-jood-teal-700 p-6 rounded-t-xl">
          <div className="flex items-center gap-4">
            {/* Avatar */}
            <div className="w-16 h-16 rounded-2xl bg-white/10 border border-white/20 flex items-center justify-center text-3xl flex-shrink-0">
              {form.avatar_emoji}
            </div>
            <div className="text-white">
              <h2 className="text-lg font-bold font-arabic leading-tight">
                {form.display_name || t('profile.title')}
              </h2>
              <p className="text-white/60 text-sm">{user?.email}</p>
              {form.gender && (
                <span className="inline-flex items-center gap-1 mt-1 text-xs text-jood-gold-300 font-arabic">
                  <Sparkles className="w-3 h-3" />
                  {t('profile.jood.gender')} {genderLabel}
                </span>
              )}
            </div>
          </div>

          {/* Tab toggle */}
          <div className="flex gap-1 mt-4 p-1 bg-white/10 rounded-xl">
            {(['profile', 'account'] as const).map(tabKey => (
              <button key={tabKey} onClick={() => setTab(tabKey)}
                className={cn(
                  'flex-1 py-1.5 rounded-lg text-sm font-arabic transition-all',
                  tab === tabKey
                    ? 'bg-white text-jood-teal-900 font-semibold shadow-sm'
                    : 'text-white/70 hover:text-white',
                )}>
                {tabKey === 'profile' ? t('profile.tab.profile') : t('profile.tab.account')}
              </button>
            ))}
          </div>
        </div>

        <div className="p-5 space-y-4">
          {tab === 'profile' ? (
            <>
              {/* Avatar picker */}
              <div>
                <Label className="text-xs text-muted-foreground font-arabic mb-2 block">
                  {t('profile.avatar')}
                </Label>
                <div className="flex gap-2 flex-wrap">
                  {AVATAR_OPTIONS.map(e => (
                    <button key={e} onClick={() => set('avatar_emoji', e)}
                      className={cn(
                        'w-10 h-10 rounded-xl text-xl transition-all border',
                        form.avatar_emoji === e
                          ? 'border-jood-teal-500 bg-jood-teal-50 dark:bg-jood-teal-900/30 scale-110'
                          : 'border-border hover:border-jood-teal-300',
                      )}>
                      {e}
                    </button>
                  ))}
                </div>
              </div>

              {/* Display name */}
              <div className="space-y-1.5">
                <Label className="font-arabic text-sm flex items-center gap-1">
                  <User className="w-3.5 h-3.5 text-muted-foreground" />
                  {t('profile.name')}
                  <span className="text-destructive text-xs">{t('profile.required')}</span>
                </Label>
                <Input
                  value={form.display_name}
                  onChange={e => set('display_name', e.target.value)}
                  placeholder={lang === 'ar' ? 'اسمك الكريم' : 'Your name'}
                  className="h-11 font-arabic text-base"
                />
              </div>

              {/* Gender */}
              <div className="space-y-1.5">
                <Label className="font-arabic text-sm flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-jood-gold-500" />
                  {t('profile.gender')}
                  <span className="text-destructive text-xs">{t('profile.required')}</span>
                  <span className="text-muted-foreground text-xs font-normal">{t('profile.gender.hint')}</span>
                </Label>
                <div className="grid grid-cols-2 gap-3">
                  {(['male', 'female'] as const).map(g => (
                    <button
                      key={g}
                      onClick={() => set('gender', g)}
                      className={cn(
                        'h-12 rounded-xl border-2 font-arabic text-sm font-semibold transition-all',
                        form.gender === g
                          ? g === 'female'
                            ? 'border-pink-400 bg-pink-50 dark:bg-pink-900/20 text-pink-700 dark:text-pink-300'
                            : 'border-jood-teal-500 bg-jood-teal-50 dark:bg-jood-teal-900/20 text-jood-teal-700 dark:text-jood-teal-300'
                          : 'border-border hover:border-border/80 text-muted-foreground',
                      )}
                    >
                      {t(g === 'female' ? 'profile.gender.female' : 'profile.gender.male')}
                    </button>
                  ))}
                </div>
                {form.gender && (
                  <p className="text-xs text-muted-foreground font-arabic flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3 text-green-500" />
                    {t(form.gender === 'female' ? 'profile.gender.jood.female' : 'profile.gender.jood.male')}
                  </p>
                )}
              </div>

              {/* App Language */}
              <div className="space-y-1.5">
                <Label className="font-arabic text-sm flex items-center gap-1.5">
                  <Languages className="w-3.5 h-3.5 text-muted-foreground" />
                  {t('profile.language')}
                </Label>
                <div className="grid grid-cols-2 gap-3">
                  {(['ar', 'en'] as const).map(l => (
                    <button
                      key={l}
                      onClick={() => set('app_language', l)}
                      className={cn(
                        'h-11 rounded-xl border-2 text-sm font-semibold transition-all',
                        form.app_language === l
                          ? 'border-jood-teal-500 bg-jood-teal-50 dark:bg-jood-teal-900/20 text-jood-teal-700 dark:text-jood-teal-300'
                          : 'border-border hover:border-border/80 text-muted-foreground',
                      )}
                    >
                      {l === 'ar' ? '🇸🇦 العربية' : '🇬🇧 English'}
                    </button>
                  ))}
                </div>
                {form.app_language === 'en' && (
                  <p className="text-xs text-muted-foreground flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3 text-green-500" />
                    App UI will switch to English after saving
                  </p>
                )}
              </div>

              {/* Preferred Currency */}
              <div className="space-y-1.5">
                <Label className="font-arabic text-sm flex items-center gap-1.5">
                  <Coins className="w-3.5 h-3.5 text-muted-foreground" />
                  {t('profile.currency')}
                </Label>
                <div className="grid grid-cols-3 gap-2">
                  {CURRENCIES.map(({ code, flag }) => (
                    <button
                      key={code}
                      onClick={() => set('base_currency', code)}
                      className={cn(
                        'h-10 rounded-xl border-2 text-xs font-semibold transition-all flex items-center justify-center gap-1',
                        form.base_currency === code
                          ? 'border-jood-teal-500 bg-jood-teal-50 dark:bg-jood-teal-900/20 text-jood-teal-700 dark:text-jood-teal-300'
                          : 'border-border hover:border-border/80 text-muted-foreground',
                      )}
                    >
                      <span>{flag}</span>
                      <span>{code}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Timezone */}
              <div className="space-y-2">
                <Label className="font-arabic text-sm flex items-center gap-1.5">
                  <Globe className="w-3.5 h-3.5 text-muted-foreground" />
                  {lang === 'ar' ? 'المنطقة الزمنية' : 'Timezone'}
                </Label>
                {/* Auto-detect toggle */}
                <button
                  type="button"
                  onClick={() => set('timezone_auto', !form.timezone_auto)}
                  className={cn(
                    'w-full flex items-center justify-between px-3 py-2.5 rounded-xl border-2 text-sm transition-all',
                    form.timezone_auto
                      ? 'border-jood-teal-500 bg-jood-teal-50 dark:bg-jood-teal-900/20 text-jood-teal-700 dark:text-jood-teal-300'
                      : 'border-border text-muted-foreground hover:border-border/80',
                  )}
                >
                  <span className="flex items-center gap-2 font-arabic">
                    <Smartphone className="w-4 h-4" />
                    {lang === 'ar' ? 'استخدم منطقة الجهاز تلقائياً' : 'Use device timezone automatically'}
                  </span>
                  <span className={cn(
                    'w-9 h-5 rounded-full transition-colors relative flex-shrink-0',
                    form.timezone_auto ? 'bg-jood-teal-500' : 'bg-muted',
                  )}>
                    <span className={cn(
                      'absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform',
                      form.timezone_auto ? 'translate-x-4' : 'translate-x-0.5',
                    )} />
                  </span>
                </button>
                {/* Manual picker — shown when auto is off */}
                {!form.timezone_auto && (
                  <select
                    value={form.timezone}
                    onChange={e => set('timezone', e.target.value)}
                    className="w-full h-10 rounded-xl border border-border bg-background px-3 text-sm font-arabic focus:outline-none focus:ring-2 focus:ring-jood-teal-400"
                    dir="ltr"
                  >
                    {TIMEZONE_OPTIONS.map(opt => (
                      <option key={opt.tz} value={opt.tz}>
                        {lang === 'ar' ? opt.labelAr : opt.labelEn}
                      </option>
                    ))}
                  </select>
                )}
                {form.timezone_auto && (
                  <p className="text-xs text-muted-foreground flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3 text-green-500" />
                    {lang === 'ar'
                      ? `المنطقة المكتشفة: ${Intl.DateTimeFormat().resolvedOptions().timeZone}`
                      : `Detected: ${Intl.DateTimeFormat().resolvedOptions().timeZone}`}
                  </p>
                )}
              </div>

              {/* Phone */}
              <div className="space-y-1.5">
                <Label className="font-arabic text-sm flex items-center gap-1">
                  <Phone className="w-3.5 h-3.5 text-muted-foreground" />
                  {t('profile.phone')}
                  <span className="text-muted-foreground text-xs font-normal">{t('profile.optional')}</span>
                </Label>
                <Input
                  value={form.phone}
                  onChange={e => set('phone', e.target.value)}
                  placeholder="+966 5x xxx xxxx"
                  className="h-11 text-left text-base"
                  dir="ltr"
                  type="tel"
                />
              </div>

              {/* Date of birth */}
              <div className="space-y-1.5">
                <Label className="font-arabic text-sm flex items-center gap-1">
                  <Calendar className="w-3.5 h-3.5 text-muted-foreground" />
                  {t('profile.dob')}
                  <span className="text-muted-foreground text-xs font-normal">{t('profile.optional')}</span>
                </Label>
                <Input
                  value={form.date_of_birth}
                  onChange={e => set('date_of_birth', e.target.value)}
                  type="date"
                  className="h-11 text-base"
                  dir="ltr"
                />
              </div>

              {/* City */}
              <div className="space-y-1.5">
                <Label className="font-arabic text-sm flex items-center gap-1">
                  <MapPin className="w-3.5 h-3.5 text-muted-foreground" />
                  {t('profile.city')}
                  <span className="text-muted-foreground text-xs font-normal">{t('profile.optional')}</span>
                </Label>
                <select
                  value={form.city}
                  onChange={e => set('city', e.target.value)}
                  className="w-full h-11 rounded-md border border-input bg-background px-3 text-sm font-arabic text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                >
                  <option value="">{t('profile.city.placeholder')}</option>
                  {CITIES_SA.map(c => <option key={c} value={c}>{c}</option>)}
                  <option value="other">{t('profile.city.other')}</option>
                </select>
              </div>

              {/* Bio */}
              <div className="space-y-1.5">
                <Label className="font-arabic text-sm">
                  {t('profile.bio')}
                  <span className="text-muted-foreground text-xs font-normal mr-1">{t('profile.bio.hint')}</span>
                </Label>
                <Textarea
                  value={form.bio}
                  onChange={e => set('bio', e.target.value)}
                  placeholder={t('profile.bio.placeholder')}
                  className="font-arabic text-sm resize-none"
                  rows={3}
                />
              </div>

              <Button
                onClick={handleSave}
                disabled={saving || !form.display_name || !form.gender}
                className="w-full h-11 jood-btn-primary font-arabic text-sm"
              >
                {saving ? t('profile.saving') : t('profile.save')}
              </Button>
            </>
          ) : (
            /* Account tab */
            <>
              {/* Email (read-only) */}
              <div className="space-y-1.5">
                <Label className="font-arabic text-sm flex items-center gap-1">
                  <Mail className="w-3.5 h-3.5 text-muted-foreground" />
                  {t('account.email')}
                </Label>
                <div className="h-11 rounded-md border border-input bg-muted/40 px-3 flex items-center text-sm text-muted-foreground" dir="ltr">
                  {user?.email}
                </div>
                <p className="text-xs text-muted-foreground font-arabic">{t('account.email.readonly')}</p>
              </div>

              {/* Password change */}
              <div className="space-y-3 pt-2 border-t border-border/40">
                <Label className="font-arabic text-sm flex items-center gap-1">
                  <Lock className="w-3.5 h-3.5 text-muted-foreground" />
                  {t('account.password')}
                </Label>
                <Input
                  type="password"
                  value={newPassword}
                  onChange={e => setNewPassword(e.target.value)}
                  placeholder={t('account.password.new')}
                  className="h-11 text-base"
                  minLength={6}
                />
                <Input
                  type="password"
                  value={confirmPassword}
                  onChange={e => setConfirmPassword(e.target.value)}
                  placeholder={t('account.password.confirm')}
                  className="h-11 text-base"
                />
                <Button
                  onClick={handlePasswordChange}
                  disabled={changingPassword || !newPassword || !confirmPassword}
                  className="w-full h-11 font-arabic text-sm"
                  variant="outline"
                >
                  {changingPassword ? t('account.password.saving') : t('account.password.save')}
                </Button>
              </div>

              {/* Account info */}
              <div className="pt-2 border-t border-border/40 space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground font-arabic">{t('account.joined')}</span>
                  <span className="text-foreground font-mono text-xs">
                    {user?.created_at ? new Date(user.created_at).toLocaleDateString(lang === 'ar' ? 'ar-SA' : 'en-US') : '—'}
                  </span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground font-arabic">{t('account.id')}</span>
                  <span className="text-foreground font-mono text-xs truncate max-w-[140px]">{user?.id?.slice(0, 8)}…</span>
                </div>
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
