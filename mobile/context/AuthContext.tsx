import React, { createContext, useContext, useEffect, useState } from 'react';
import { Session, User } from '@supabase/supabase-js';
import { supabase } from '@/services/supabase';
import { Jurisdiction } from '@/constants/jurisdiction';

interface AuthContextValue {
  session: Session | null;
  user: User | null;
  token: string | null;
  loading: boolean;
  jurisdiction: Jurisdiction | null;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, jurisdiction: Jurisdiction) => Promise<void>;
  updateJurisdiction: (jurisdiction: Jurisdiction) => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [jurisdiction, setJurisdiction] = useState<Jurisdiction | null>(null);

  async function loadJurisdiction(userId?: string) {
    if (!userId) { setJurisdiction(null); return; }
    const { data } = await supabase.from('profiles').select('jurisdiction').eq('id', userId).maybeSingle();
    setJurisdiction((data?.jurisdiction as Jurisdiction) || null);
  }

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      loadJurisdiction(data.session?.user.id);
      setLoading(false);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s);
      loadJurisdiction(s?.user.id);
    });

    return () => listener.subscription.unsubscribe();
  }, []);

  async function signIn(email: string, password: string) {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
  }

  async function signUp(email: string, password: string, selected: Jurisdiction) {
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { jurisdiction: selected } },
    });
    if (error) throw error;
  }

  async function updateJurisdiction(selected: Jurisdiction) {
    if (!session?.user) throw new Error('Sign in to save your state or territory');
    const { error } = await supabase.from('profiles').update({ jurisdiction: selected }).eq('id', session.user.id);
    if (error) throw error;
    setJurisdiction(selected);
  }

  async function signOut() {
    await supabase.auth.signOut();
  }

  return (
    <AuthContext.Provider
      value={{
        session,
        user: session?.user ?? null,
        token: session?.access_token ?? null,
        loading,
        jurisdiction,
        signIn,
        signUp,
        updateJurisdiction,
        signOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
