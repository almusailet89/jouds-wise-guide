import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useProfile, UserProfile } from '@/hooks/useProfile';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import { User, Phone, Mail, MapPin, Calendar, Globe, Sparkles, Lock, CheckCircle2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}

const AVATAR_OPTIONS = ['🌟', '👩', '👨', '🌸', '⭐', '🦋', '🌙', '🎯', '💎', '🌺'];

const CITIES_SA = [
  'الرياض', 'جدة', 'مكة المكرمة', 'المدينة المنورة', 'الدمام', 'الخبر',
  'الطائف', 'تبوك', 'بريدة', 'خميس مشيط', 'أبها', 'نجران', 'جيزان',
];

export default function ProfileDialog({ open, onOpenChange }: Props) {
  const { user } = useAuth();
  const { profile, loading, saving, save } = useProfile();

  const [form, setForm] = useState({
    display_name: '',
    gender: '' as 'male' | 'female' | '',
    phone: '',
    date_of_birth: '',
    city: '',
    nationality: 'SA',
    avatar_emoji: '🌟',
    bio: '',
  });
  const [tab, setTab] = useState<'profile' | 'account'>('profile');
  const [newPassword, setNewPassword] = useState('');
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
      });
    }
  }, [profile]);

  const set = (k: keyof typeof form, v: string) => setForm(f => ({ ...f, [k]: v }));

  const handleSave = async () => {
    if (!form.display_name.trim()) {
      toast.error('الاسم مطلوب');
      return;
    }
    if (!form.gender) {
      toast.error('يرجى تحديد الجنس حتى تتمكن جود من مخاطبتك بشكل صحيح');
      return;
    }
    const { error } = await save({
      ...form,
      gender: form.gender as 'male' | 'female',
      phone:  form.phone || null,
      date_of_birth: form.date_of_birth || null,
      city:   form.city || null,
      bio:    form.bio  || null,
    });
    if (error) {
      toast.error('تعذّر حفظ البيانات');
    } else {
      toast.success('تم حفظ الملف الشخصي ✓');
      onOpenChange(false);
    }
  };

  const handlePasswordChange = async () => {
    if (newPassword.length < 6) { toast.error('كلمة المرور يجب أن تكون 6 أحرف على الأقل'); return; }
    if (newPassword !== confirmPassword) { toast.error('كلمتا المرور غير متطابقتين'); return; }
    setChangingPassword(true);
    const { createClient } = await import('@supabase/supabase-js');
    // Use supabase auth updateUser
    const { supabase } = await import('@/integrations/supabase/client');
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    setChangingPassword(false);
    if (error) {
      toast.error('تعذّر تغيير كلمة المرور');
    } else {
      toast.success('تم تغيير كلمة المرور بنجاح ✓');
      setNewPassword(''); setConfirmPassword('');
    }
  };

  const genderLabel = form.gender === 'female' ? 'أنثى' : form.gender === 'male' ? 'ذكر' : '';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto p-0" dir="rtl">
        {/* Header */}
        <div className="bg-gradient-to-br from-jood-teal-900 to-jood-teal-700 p-6 rounded-t-xl">
          <div className="flex items-center gap-4">
            {/* Avatar */}
            <div className="w-16 h-16 rounded-2xl bg-white/10 border border-white/20 flex items-center justify-center text-3xl flex-shrink-0">
              {form.avatar_emoji}
            </div>
            <div className="text-white">
              <h2 className="text-lg font-bold font-arabic leading-tight">
                {form.display_name || 'ملفك الشخصي'}
              </h2>
              <p className="text-white/60 text-sm font-arabic">{user?.email}</p>
              {form.gender && (
                <span className="inline-flex items-center gap-1 mt-1 text-xs text-jood-gold-300 font-arabic">
                  <Sparkles className="w-3 h-3" />
                  جود تخاطبك بصيغة {genderLabel}
                </span>
              )}
            </div>
          </div>

          {/* Tab toggle */}
          <div className="flex gap-1 mt-4 p-1 bg-white/10 rounded-xl">
            {(['profile', 'account'] as const).map(t => (
              <button key={t} onClick={() => setTab(t)}
                className={cn(
                  'flex-1 py-1.5 rounded-lg text-sm font-arabic transition-all',
                  tab === t ? 'bg-white text-jood-teal-900 font-semibold shadow-sm' : 'text-white/70 hover:text-white',
                )}>
                {t === 'profile' ? 'الملف الشخصي' : 'إعدادات الحساب'}
              </button>
            ))}
          </div>
        </div>

        <div className="p-5 space-y-4">
          {tab === 'profile' ? (
            <>
              {/* Avatar picker */}
              <div>
                <Label className="text-xs text-muted-foreground font-arabic mb-2 block">الرمز التعبيري</Label>
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

              {/* Display name — REQUIRED */}
              <div className="space-y-1.5">
                <Label className="font-arabic text-sm flex items-center gap-1">
                  <User className="w-3.5 h-3.5 text-muted-foreground" />
                  الاسم
                  <span className="text-destructive text-xs">*</span>
                </Label>
                <Input
                  value={form.display_name}
                  onChange={e => set('display_name', e.target.value)}
                  placeholder="اسمك الكريم"
                  className="h-11 font-arabic text-base"
                />
              </div>

              {/* Gender — REQUIRED, critical for AI */}
              <div className="space-y-1.5">
                <Label className="font-arabic text-sm flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-jood-gold-500" />
                  الجنس
                  <span className="text-destructive text-xs">*</span>
                  <span className="text-muted-foreground text-xs font-normal">(تحتاجه جود لمخاطبتك بالصيغة الصحيحة)</span>
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
                      {g === 'female' ? '👩 أنثى' : '👨 ذكر'}
                    </button>
                  ))}
                </div>
                {form.gender && (
                  <p className="text-xs text-muted-foreground font-arabic flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3 text-green-500" />
                    جود ستخاطبك بصيغة {form.gender === 'female' ? 'المؤنث (افعلي، استخدمي، أخبريني…)' : 'المذكر (افعل، استخدم، أخبرني…)'}
                  </p>
                )}
              </div>

              {/* Phone — optional */}
              <div className="space-y-1.5">
                <Label className="font-arabic text-sm flex items-center gap-1">
                  <Phone className="w-3.5 h-3.5 text-muted-foreground" />
                  رقم الجوال
                  <span className="text-muted-foreground text-xs font-normal">(اختياري)</span>
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

              {/* Date of birth — optional */}
              <div className="space-y-1.5">
                <Label className="font-arabic text-sm flex items-center gap-1">
                  <Calendar className="w-3.5 h-3.5 text-muted-foreground" />
                  تاريخ الميلاد
                  <span className="text-muted-foreground text-xs font-normal">(اختياري)</span>
                </Label>
                <Input
                  value={form.date_of_birth}
                  onChange={e => set('date_of_birth', e.target.value)}
                  type="date"
                  className="h-11 text-base"
                  dir="ltr"
                />
              </div>

              {/* City — optional */}
              <div className="space-y-1.5">
                <Label className="font-arabic text-sm flex items-center gap-1">
                  <MapPin className="w-3.5 h-3.5 text-muted-foreground" />
                  المدينة
                  <span className="text-muted-foreground text-xs font-normal">(اختياري)</span>
                </Label>
                <select
                  value={form.city}
                  onChange={e => set('city', e.target.value)}
                  className="w-full h-11 rounded-md border border-input bg-background px-3 text-sm font-arabic text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                >
                  <option value="">اختاري مدينتك…</option>
                  {CITIES_SA.map(c => <option key={c} value={c}>{c}</option>)}
                  <option value="other">مدينة أخرى</option>
                </select>
              </div>

              {/* Bio — optional */}
              <div className="space-y-1.5">
                <Label className="font-arabic text-sm">
                  نبذة عنك
                  <span className="text-muted-foreground text-xs font-normal mr-1">(اختياري — تساعد جود على فهمك أفضل)</span>
                </Label>
                <Textarea
                  value={form.bio}
                  onChange={e => set('bio', e.target.value)}
                  placeholder="مثلاً: معلمة، أهتم بالتوفير والاستثمار، أحب القراءة…"
                  className="font-arabic text-sm resize-none"
                  rows={3}
                />
              </div>

              <Button
                onClick={handleSave}
                disabled={saving || !form.display_name || !form.gender}
                className="w-full h-11 jood-btn-primary font-arabic text-sm"
              >
                {saving ? 'جارٍ الحفظ…' : 'حفظ الملف الشخصي'}
              </Button>
            </>
          ) : (
            /* Account tab */
            <>
              {/* Email (read-only) */}
              <div className="space-y-1.5">
                <Label className="font-arabic text-sm flex items-center gap-1">
                  <Mail className="w-3.5 h-3.5 text-muted-foreground" />
                  البريد الإلكتروني
                </Label>
                <div className="h-11 rounded-md border border-input bg-muted/40 px-3 flex items-center text-sm text-muted-foreground" dir="ltr">
                  {user?.email}
                </div>
                <p className="text-xs text-muted-foreground font-arabic">لا يمكن تغيير البريد الإلكتروني حالياً</p>
              </div>

              {/* Password change */}
              <div className="space-y-3 pt-2 border-t border-border/40">
                <Label className="font-arabic text-sm flex items-center gap-1">
                  <Lock className="w-3.5 h-3.5 text-muted-foreground" />
                  تغيير كلمة المرور
                </Label>
                <Input
                  type="password"
                  value={newPassword}
                  onChange={e => setNewPassword(e.target.value)}
                  placeholder="كلمة المرور الجديدة"
                  className="h-11 text-base"
                  minLength={6}
                />
                <Input
                  type="password"
                  value={confirmPassword}
                  onChange={e => setConfirmPassword(e.target.value)}
                  placeholder="تأكيد كلمة المرور"
                  className="h-11 text-base"
                />
                <Button
                  onClick={handlePasswordChange}
                  disabled={changingPassword || !newPassword || !confirmPassword}
                  className="w-full h-11 font-arabic text-sm"
                  variant="outline"
                >
                  {changingPassword ? 'جارٍ التغيير…' : 'تغيير كلمة المرور'}
                </Button>
              </div>

              {/* Account info */}
              <div className="pt-2 border-t border-border/40 space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground font-arabic">تاريخ الانضمام</span>
                  <span className="text-foreground font-mono text-xs">
                    {user?.created_at ? new Date(user.created_at).toLocaleDateString('ar-SA') : '—'}
                  </span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground font-arabic">معرّف الحساب</span>
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
