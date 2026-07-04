import { createContext, useContext, useEffect, useMemo, useState, ReactNode } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  signUp: (email: string, password: string, displayName?: string, gender?: 'male' | 'female', phone?: string) => Promise<{ error: any }>;
  signIn: (email: string, password: string) => Promise<{ error: any }>;
  signOut: () => Promise<void>;
  resetPassword: (email: string) => Promise<{ error: any }>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider = ({ children }: AuthProviderProps) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Supabase fires onAuthStateChange on every token refresh (and other internal
    // ticks) with a freshly-constructed session object even when nothing material
    // changed. Bailing out via the updater form when the access_token is identical
    // keeps `session`/`user` referentially stable, so effects elsewhere that depend
    // on them don't re-fire — and re-invoke paid API calls — on every such tick.
    const applySession = (next: Session | null) => {
      setSession(prev => (prev?.access_token === next?.access_token ? prev : next));
      setUser(prev => (prev?.id === next?.user?.id ? prev : (next?.user ?? null)));
      setLoading(false);
    };

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => applySession(session)
    );

    supabase.auth.getSession().then(({ data: { session } }) => applySession(session));

    return () => subscription.unsubscribe();
  }, []);

  const signUp = async (
    email: string,
    password: string,
    displayName?: string,
    gender?: 'male' | 'female',
    phone?: string,
  ) => {
    const redirectUrl = `${window.location.origin}/dashboard`;
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: redirectUrl,
        data: {
          display_name: displayName,
          gender:       gender,
          phone:        phone,
        }
      }
    });
    return { error };
  };

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error };
  };

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  const resetPassword = async (email: string) => {
    const redirectUrl = `${window.location.origin}/auth`;
    const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: redirectUrl });
    return { error };
  };

  // Memoized so consumers (e.g. SubscriptionProvider) don't see a "new" context value —
  // and re-fire effects depending on it — on every render that doesn't actually change auth state.
  const value = useMemo(
    () => ({ user, session, loading, signUp, signIn, signOut, resetPassword }),
    [user, session, loading],
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
