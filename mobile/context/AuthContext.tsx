import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { Session, User } from '@supabase/supabase-js';
import * as Linking from 'expo-linking';
import { supabase } from '@/services/supabase';
import { Jurisdiction } from '@/constants/jurisdiction';
import { AUTH_CALLBACK_URL, parseAuthCallback, RECOVERY_CALLBACK_URL } from '@/services/authLinks';

interface AuthContextValue {
  session: Session | null;
  user: User | null;
  token: string | null;
  loading: boolean;
  recoveryMode: boolean;
  authLinkError: string | null;
  jurisdiction: Jurisdiction | null;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, jurisdiction: Jurisdiction) => Promise<void>;
  requestPasswordReset: (email: string) => Promise<void>;
  updatePassword: (password: string) => Promise<void>;
  clearRecoveryMode: () => void;
  updateJurisdiction: (jurisdiction: Jurisdiction) => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [jurisdiction, setJurisdiction] = useState<Jurisdiction | null>(null);
  const [recoveryMode, setRecoveryMode] = useState(false);
  const [authLinkError, setAuthLinkError] = useState<string | null>(null);

  async function loadJurisdiction(userId?: string) {
    if (!userId) { setJurisdiction(null); return; }
    const { data } = await supabase.from('profiles').select('jurisdiction').eq('id', userId).maybeSingle();
    setJurisdiction((data?.jurisdiction as Jurisdiction) || null);
  }

  const handleAuthLink = useCallback(async (url: string) => {
    if (!url.startsWith(AUTH_CALLBACK_URL)) return;
    const callback = parseAuthCallback(url);
    const isRecovery = callback.type === 'recovery';
    if (isRecovery) setRecoveryMode(true);
    setAuthLinkError(null);
    if (callback.error) {
      setAuthLinkError(callback.error);
      return;
    }

    let error = null;
    if (callback.code) {
      ({ error } = await supabase.auth.exchangeCodeForSession(callback.code));
    } else if (callback.accessToken && callback.refreshToken) {
      ({ error } = await supabase.auth.setSession({
        access_token: callback.accessToken,
        refresh_token: callback.refreshToken,
      }));
    } else {
      setAuthLinkError('The authentication link is incomplete or has expired.');
      return;
    }

    if (error) {
      setAuthLinkError(error.message);
      return;
    }
    setRecoveryMode(isRecovery);
  }, []);

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

    Linking.getInitialURL().then((url) => {
      if (url) handleAuthLink(url);
    });
    const linkListener = Linking.addEventListener('url', ({ url }) => {
      handleAuthLink(url);
    });

    return () => {
      listener.subscription.unsubscribe();
      linkListener.remove();
    };
  }, [handleAuthLink]);

  async function signIn(email: string, password: string) {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
  }

  async function signUp(email: string, password: string, selected: Jurisdiction) {
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { jurisdiction: selected },
        emailRedirectTo: AUTH_CALLBACK_URL,
      },
    });
    if (error) throw error;
  }

  async function requestPasswordReset(email: string) {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: RECOVERY_CALLBACK_URL,
    });
    if (error) throw error;
  }

  async function updatePassword(password: string) {
    const { error } = await supabase.auth.updateUser({ password });
    if (error) throw error;
    setRecoveryMode(false);
  }

  async function updateJurisdiction(selected: Jurisdiction) {
    if (!session?.user) throw new Error('Sign in to save your state or territory');
    const { error } = await supabase.from('profiles').update({ jurisdiction: selected }).eq('id', session.user.id);
    if (error) throw error;
    setJurisdiction(selected);
  }

  async function signOut() {
    await supabase.auth.signOut();
    setRecoveryMode(false);
  }

  return (
    <AuthContext.Provider
      value={{
        session,
        user: session?.user ?? null,
        token: session?.access_token ?? null,
        loading,
        recoveryMode,
        authLinkError,
        jurisdiction,
        signIn,
        signUp,
        requestPasswordReset,
        updatePassword,
        clearRecoveryMode: () => setRecoveryMode(false),
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
