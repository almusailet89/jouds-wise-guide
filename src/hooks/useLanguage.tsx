import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from 'react';
import { useProfile } from './useProfile';
import { translate, translateGendered, type Lang } from '@/lib/i18n';

interface LanguageContextValue {
  lang: Lang;
  dir: 'rtl' | 'ltr';
  t: (key: string) => string;
  tg: (key: string) => string;
  gender: 'male' | 'female' | null;
  setLang: (lang: Lang) => Promise<void>;
}

const LanguageContext = createContext<LanguageContextValue>({
  lang: 'ar',
  dir: 'rtl',
  t: (key) => key,
  tg: (key) => key,
  gender: null,
  setLang: async () => {},
});

export function LanguageProvider({ children }: { children: ReactNode }) {
  const { profile, save } = useProfile();

  const [lang, setLangState] = useState<Lang>(() => {
    const stored = localStorage.getItem('jood.lang');
    return (stored === 'ar' || stored === 'en') ? stored : 'ar';
  });

  // Sync from profile once it loads (profile is source of truth)
  useEffect(() => {
    const profileLang = (profile as any)?.app_language;
    if (profileLang === 'ar' || profileLang === 'en') {
      setLangState(profileLang);
      localStorage.setItem('jood.lang', profileLang);
    }
  }, [(profile as any)?.app_language]);

  // Apply dir + lang attributes to <html>
  useEffect(() => {
    document.documentElement.dir  = lang === 'ar' ? 'rtl' : 'ltr';
    document.documentElement.lang = lang;
  }, [lang]);

  const setLang = useCallback(async (newLang: Lang) => {
    setLangState(newLang);
    localStorage.setItem('jood.lang', newLang);
    // Persist to profile (save accepts any partial update)
    await save({ app_language: newLang } as any);
  }, [save]);

  const gender = (profile?.gender ?? null) as 'male' | 'female' | null;

  const t = useCallback((key: string) => translate(lang, key), [lang]);
  const tg = useCallback((key: string) => translateGendered(lang, key, gender), [lang, gender]);

  return (
    <LanguageContext.Provider value={{ lang, dir: lang === 'ar' ? 'rtl' : 'ltr', t, tg, gender, setLang }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  return useContext(LanguageContext);
}
