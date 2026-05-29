import React, { useState, useEffect } from 'react';
import { Mic, Sparkles, ExternalLink, CheckCircle2, AlertCircle, Loader2, Volume2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/hooks/useAuth';
import { useLanguage } from '@/hooks/useLanguage';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';

// ─── STT model options ────────────────────────────────────────────────────────
const STT_MODELS = [
  {
    id:    'gpt-4o-transcribe',
    label: 'GPT-4o Transcribe',
    desc:  { ar: 'الأفضل — دقة عالية جداً للعربية السعودية والمزج مع الإنجليزي', en: 'Best — highest accuracy for Saudi Arabic & mixed speech' },
    badge: 'recommended',
  },
  {
    id:    'gpt-4o-mini-transcribe',
    label: 'GPT-4o Mini Transcribe',
    desc:  { ar: 'سريع — دقة جيدة بتكلفة أقل، مثالي لمحادثات الصوت', en: 'Fast — good accuracy at lower cost, ideal for voice chat' },
    badge: 'fast',
  },
  {
    id:    'whisper-1',
    label: 'Whisper-1',
    desc:  { ar: 'الإصدار القديم — احتياطي فقط', en: 'Legacy model — fallback only' },
    badge: 'legacy',
  },
];

// ═══════════════════════════════════════════════════════════════════════════════
const VoiceSettings: React.FC = () => {
  const { session } = useAuth();
  const { lang } = useLanguage();

  const [voiceId,   setVoiceId]   = useState('');
  const [sttModel,  setSttModel]  = useState('gpt-4o-transcribe');
  const [saving,    setSaving]    = useState(false);
  const [saved,     setSaved]     = useState(false);
  const [error,     setError]     = useState('');
  const [previewPlaying, setPreviewPlaying] = useState(false);

  // Load current settings
  useEffect(() => {
    if (!session?.user?.id) return;
    (supabase as any)
      .from('profiles')
      .select('elevenlabs_voice_id, stt_model')
      .eq('user_id', session.user.id)
      .maybeSingle()
      .then(({ data }: any) => {
        if (data?.elevenlabs_voice_id) setVoiceId(data.elevenlabs_voice_id);
        if (data?.stt_model)          setSttModel(data.stt_model);
      });
  }, [session?.user?.id]);

  const handleSave = async () => {
    if (!session?.user?.id) return;
    setSaving(true);
    setError('');
    try {
      const { error: err } = await (supabase as any)
        .from('profiles')
        .update({
          elevenlabs_voice_id: voiceId.trim() || null,
          stt_model:           sttModel,
        })
        .eq('user_id', session.user.id);
      if (err) throw err;
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (e: any) {
      setError(e?.message || 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  // Quick voice preview — calls TTS with the entered voice ID
  const previewVoice = async () => {
    if (!session || !voiceId.trim() || previewPlaying) return;
    setPreviewPlaying(true);
    try {
      const supabaseUrl = 'https://neadnclykbukvmlquepg.supabase.co';
      const anonKey     = import.meta.env.VITE_SUPABASE_ANON_KEY;
      const res = await fetch(`${supabaseUrl}/functions/v1/elevenlabs-tts`, {
        method: 'POST',
        headers: {
          'Content-Type':  'application/json',
          'Authorization': `Bearer ${session.access_token}`,
          ...(anonKey ? { apikey: anonKey } : {}),
        },
        body: JSON.stringify({
          text:      lang === 'ar' ? 'مرحباً، أنا جود — مساعدتك الشخصية الذكية.' : 'Hello, I am Jood — your personal AI executive secretary.',
          emotion:   'warm',
          voice_mode: false,
          language:  lang === 'ar' ? 'ar' : 'en',
          voice_id:  voiceId.trim(),
        }),
      });
      if (!res.ok) throw new Error('TTS failed');
      const blob = await res.blob();
      const url  = URL.createObjectURL(blob);
      const audio = new Audio(url);
      audio.onended = audio.onerror = () => { setPreviewPlaying(false); URL.revokeObjectURL(url); };
      await audio.play();
    } catch {
      setPreviewPlaying(false);
    }
  };

  const badgeColor: Record<string, string> = {
    recommended: 'bg-jood-gold-500/20 text-jood-gold-700 dark:text-jood-gold-300',
    fast:        'bg-jood-teal-500/20 text-jood-teal-700 dark:text-jood-teal-300',
    legacy:      'bg-muted text-muted-foreground',
  };

  return (
    <div className="space-y-6">

      {/* ── STT Model ────────────────────────────────────────────────────────── */}
      <div className="space-y-3">
        <div>
          <h3 className="text-sm font-semibold font-arabic flex items-center gap-1.5">
            <Mic className="w-4 h-4 text-jood-teal-500" />
            {lang === 'ar' ? 'نموذج التعرف على الصوت' : 'Speech Recognition Model'}
          </h3>
          <p className="text-xs text-muted-foreground font-arabic mt-0.5">
            {lang === 'ar'
              ? 'يؤثر مباشرة على دقة فهم جود للهجة السعودية'
              : 'Directly affects how well Jood understands your Saudi dialect'}
          </p>
        </div>

        <div className="space-y-2">
          {STT_MODELS.map(m => (
            <button
              key={m.id}
              onClick={() => setSttModel(m.id)}
              className={cn(
                'w-full text-right rtl:text-right ltr:text-left p-3 rounded-xl border transition-all',
                sttModel === m.id
                  ? 'border-jood-teal-500 bg-jood-teal-500/8 shadow-sm'
                  : 'border-border/50 hover:border-border bg-card/40',
              )}
            >
              <div className="flex items-center justify-between gap-2">
                <div className={cn('flex-1', lang === 'ar' ? 'text-right' : 'text-left')}>
                  <p className="text-sm font-semibold">{m.label}</p>
                  <p className="text-xs text-muted-foreground font-arabic">
                    {m.desc[lang === 'ar' ? 'ar' : 'en']}
                  </p>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <span className={cn('text-[10px] rounded-full px-2 py-0.5 font-medium', badgeColor[m.badge])}>
                    {m.badge === 'recommended' ? (lang === 'ar' ? 'موصى به' : 'Recommended')
                     : m.badge === 'fast'      ? (lang === 'ar' ? 'سريع' : 'Fast')
                     :                           (lang === 'ar' ? 'قديم' : 'Legacy')}
                  </span>
                  {sttModel === m.id && <CheckCircle2 className="w-4 h-4 text-jood-teal-500" />}
                </div>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* ── Clone Voice ──────────────────────────────────────────────────────── */}
      <div className="space-y-3">
        <div>
          <h3 className="text-sm font-semibold font-arabic flex items-center gap-1.5">
            <Sparkles className="w-4 h-4 text-jood-gold-500" />
            {lang === 'ar' ? 'صوت جود المستنسخ' : 'Jood Clone Voice'}
          </h3>
          <p className="text-xs text-muted-foreground font-arabic mt-0.5">
            {lang === 'ar'
              ? 'أدخل Voice ID من ElevenLabs لتستخدم صوتاً مستنسخاً بدلاً من الصوت الافتراضي'
              : 'Enter your ElevenLabs Voice ID to use a custom cloned voice instead of the default'}
          </p>
        </div>

        {/* How to get a voice ID */}
        <div className="bg-muted/50 border border-border/40 rounded-xl p-3 space-y-1.5">
          <p className="text-xs font-semibold font-arabic">
            {lang === 'ar' ? 'كيف تحصل على Voice ID:' : 'How to get your Voice ID:'}
          </p>
          <ol className="text-xs text-muted-foreground font-arabic space-y-1 list-decimal list-inside">
            {lang === 'ar' ? (
              <>
                <li>افتح ElevenLabs.io وسجّل دخول</li>
                <li>اذهب إلى Voices ← Add Voice ← Instant Voice Clone</li>
                <li>ارفع مقطع صوتي واضح (دقيقة أو أكثر)</li>
                <li>بعد الإنشاء: اضغط على الصوت ← انسخ الـ Voice ID</li>
                <li>الصقه هنا</li>
              </>
            ) : (
              <>
                <li>Open ElevenLabs.io and sign in</li>
                <li>Go to Voices → Add Voice → Instant Voice Clone</li>
                <li>Upload a clear voice recording (1 minute or more)</li>
                <li>After creation: click the voice → copy the Voice ID</li>
                <li>Paste it below</li>
              </>
            )}
          </ol>
          <a
            href="https://elevenlabs.io/voice-lab"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-xs text-jood-teal-500 hover:text-jood-teal-600 font-arabic mt-1"
          >
            <ExternalLink className="w-3 h-3" />
            {lang === 'ar' ? 'فتح ElevenLabs Voice Lab' : 'Open ElevenLabs Voice Lab'}
          </a>
        </div>

        <div className="space-y-2">
          <Label className="text-xs font-arabic">
            {lang === 'ar' ? 'ElevenLabs Voice ID' : 'ElevenLabs Voice ID'}
          </Label>
          <div className="flex gap-2">
            <Input
              value={voiceId}
              onChange={e => setVoiceId(e.target.value)}
              placeholder={lang === 'ar' ? 'مثال: EXAVITQu4vr4xnSDxMaL' : 'e.g. EXAVITQu4vr4xnSDxMaL'}
              className="font-mono text-sm flex-1"
              dir="ltr"
            />
            {voiceId.trim() && (
              <Button
                variant="outline"
                size="icon"
                onClick={previewVoice}
                disabled={previewPlaying}
                title={lang === 'ar' ? 'معاينة الصوت' : 'Preview voice'}
              >
                {previewPlaying
                  ? <Loader2 className="w-4 h-4 animate-spin" />
                  : <Volume2 className="w-4 h-4" />
                }
              </Button>
            )}
          </div>
          <p className="text-[10px] text-muted-foreground font-arabic">
            {lang === 'ar'
              ? 'اتركه فارغاً لاستخدام صوت Sarah الافتراضي'
              : 'Leave empty to use the default Sarah voice'}
          </p>
        </div>
      </div>

      {/* ── Save button ───────────────────────────────────────────────────────── */}
      {error && (
        <div className="flex items-center gap-1.5 text-xs text-destructive font-arabic">
          <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
          {error}
        </div>
      )}

      <Button
        onClick={handleSave}
        disabled={saving}
        className="w-full bg-jood-teal-700 hover:bg-jood-teal-800 text-white font-arabic"
      >
        {saving
          ? <><Loader2 className="w-4 h-4 animate-spin mr-2" />{lang === 'ar' ? 'يحفظ…' : 'Saving…'}</>
          : saved
          ? <><CheckCircle2 className="w-4 h-4 mr-2" />{lang === 'ar' ? 'تم الحفظ' : 'Saved!'}</>
          : (lang === 'ar' ? 'حفظ إعدادات الصوت' : 'Save Voice Settings')
        }
      </Button>
    </div>
  );
};

export default VoiceSettings;
