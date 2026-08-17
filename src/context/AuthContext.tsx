import React, { createContext, useContext, useEffect, useState } from 'react';
import { Session, User } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import { NivelAcesso, Usuario } from '../types';

interface AuthContextType {
  session: Session | null;
  user: Usuario | null;
  supabaseUser: User | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
  resetPassword: (email: string) => Promise<{ error: string | null }>;
}

const AuthContext = createContext<AuthContextType>({
  session: null,
  user: null,
  supabaseUser: null,
  loading: true,
  signIn: async () => ({ error: null }),
  signOut: async () => {},
  resetPassword: async () => ({ error: null }),
});

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [supabaseUser, setSupabaseUser] = useState<User | null>(null);
  const [user, setUser] = useState<Usuario | null>(null);
  const [loading, setLoading] = useState(true);

  // Carrega perfil do usuário da tabela `users`
  const loadUserProfile = async (authUser: User): Promise<Usuario | null> => {
    try {
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('id', authUser.id)
        .single();

      if (error || !data) {
        // Fallback: cria perfil mínimo a partir dos metadados do Auth
        const appMeta = authUser.app_metadata || {};
        const userMeta = authUser.user_metadata || {};
        return {
          id: authUser.id,
          nome: userMeta.nome || userMeta.full_name || authUser.email?.split('@')[0] || 'Usuário',
          email: authUser.email || '',
          nivel: (appMeta.nivel as NivelAcesso) || 'funcionario',
          modulos_permitidos: appMeta.modulos_permitidos || ['*'],
        };
      }

      return {
        id: data.id,
        nome: data.nome,
        email: data.email,
        nivel: data.nivel as NivelAcesso,
        modulos_permitidos: data.modulos_permitidos || ['*'],
      };
    } catch {
      return null;
    }
  };

  useEffect(() => {
    // 1. Verifica sessão existente ao montar
    supabase.auth.getSession().then(async ({ data: { session: s } }) => {
      setSession(s);
      if (s?.user) {
        setSupabaseUser(s.user);
        const profile = await loadUserProfile(s.user);
        setUser(profile);
      }
      setLoading(false);
    });

    // 2. Listener para mudanças de auth state
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, s) => {
      setSession(s);
      if (s?.user) {
        setSupabaseUser(s.user);
        const profile = await loadUserProfile(s.user);
        setUser(profile);
      } else {
        setSupabaseUser(null);
        setUser(null);
      }
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signIn = async (email: string, password: string): Promise<{ error: string | null }> => {
    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        setLoading(false);
        // Traduz mensagens de erro comuns
        if (error.message.includes('Invalid login credentials')) {
          return { error: 'Email ou senha incorretos. Verifique suas credenciais.' };
        }
        if (error.message.includes('Email not confirmed')) {
          return { error: 'Seu email ainda não foi confirmado. Verifique sua caixa de entrada.' };
        }
        if (error.message.includes('Too many requests')) {
          return { error: 'Muitas tentativas. Aguarde alguns minutos e tente novamente.' };
        }
        return { error: error.message };
      }
      return { error: null };
    } catch (err) {
      setLoading(false);
      return { error: 'Erro inesperado ao fazer login. Tente novamente.' };
    }
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setSession(null);
    setSupabaseUser(null);
    setUser(null);
  };

  const resetPassword = async (email: string): Promise<{ error: string | null }> => {
    const redirectTo = `${window.location.origin}/reset-password`;
    const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo });
    if (error) return { error: 'Não foi possível enviar o email de recuperação.' };
    return { error: null };
  };

  return (
    <AuthContext.Provider value={{ session, user, supabaseUser, loading, signIn, signOut, resetPassword }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth deve ser usado dentro de AuthProvider');
  return ctx;
};
