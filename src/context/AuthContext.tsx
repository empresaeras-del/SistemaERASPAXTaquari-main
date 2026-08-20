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
  signUp: (email: string, password: string, metadata: { nome: string; tenant_id?: string }) => Promise<{ error: string | null; user?: User | null }>;
  signOut: () => Promise<void>;
  resetPassword: (email: string) => Promise<{ error: string | null }>;
}

const AuthContext = createContext<AuthContextType>({
  session: null,
  user: null,
  supabaseUser: null,
  loading: true,
  signIn: async () => ({ error: null }),
  signUp: async () => ({ error: null }),
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
          nivel: (appMeta.nivel as NivelAcesso) || (userMeta.nivel as NivelAcesso) || 'funcionario',
          modulos_permitidos: appMeta.modulos_permitidos || ['*'],
          tenant_id: appMeta.tenant_id || userMeta.tenant_id,
        };
      }

      const finalProfile = {
        id: data?.id || authUser.id,
        nome: data?.nome || (authUser.user_metadata?.nome || authUser.email?.split('@')[0] || 'Usuário'),
        email: data?.email || authUser.email || '',
        nivel: (data?.nivel || authUser.app_metadata?.nivel || authUser.user_metadata?.nivel || 'funcionario') as NivelAcesso,
        modulos_permitidos: data?.modulos_permitidos || authUser.app_metadata?.modulos_permitidos || ['*'],
        tenant_id: data?.tenant_id || authUser.app_metadata?.tenant_id || authUser.user_metadata?.tenant_id,
      };

      try {
        localStorage.setItem('cached_user_profile', JSON.stringify(finalProfile));
      } catch (e) {}

      return finalProfile;
    } catch {
      try {
        const cached = localStorage.getItem('cached_user_profile');
        if (cached) return JSON.parse(cached);
      } catch (e) {}
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
    }).catch(() => {
      setLoading(false);
    });

    // 2. Listener para mudanças de auth state
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, s) => {
      setSession(s);
      if (s?.user) {
        setSupabaseUser(s.user);
        const profile = await loadUserProfile(s.user);
        setUser(profile);
        try {
          localStorage.setItem('eras_last_activity', String(Date.now()));
        } catch (e) {}
      } else {
        setSupabaseUser(null);
        setUser(null);
        try {
          localStorage.removeItem('eras_last_activity');
        } catch (e) {}
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

  const signUp = async (
    email: string,
    password: string,
    metadata: { nome: string; tenant_id?: string }
  ): Promise<{ error: string | null; user?: User | null }> => {
    setLoading(true);
    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            nome: metadata.nome,
            tenant_id: metadata.tenant_id || 'default',
            nivel: 'funcionario'
          }
        }
      });

      setLoading(false);

      if (error) {
        if (error.message.includes('already registered') || error.message.includes('User already exists')) {
          return { error: 'Este e-mail já está cadastrado no sistema.' };
        }
        if (error.message.includes('Password should be at least')) {
          return { error: 'A senha deve conter no mínimo 6 caracteres.' };
        }
        return { error: error.message };
      }

      return { error: null, user: data.user };
    } catch (err) {
      setLoading(false);
      return { error: 'Erro inesperado ao realizar cadastro. Tente novamente.' };
    }
  };

  const signOut = async () => {
    try {
      await supabase.auth.signOut();
    } catch (e) {
      console.warn('Erro ao chamar signOut no Supabase:', e);
    } finally {
      setSession(null);
      setSupabaseUser(null);
      setUser(null);
      try {
        localStorage.removeItem('eras_last_activity');
      } catch (e) {}
    }
  };

  const resetPassword = async (email: string): Promise<{ error: string | null }> => {
    const redirectTo = `${window.location.origin}/reset-password`;
    const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo });
    if (error) return { error: 'Não foi possível enviar o email de recuperação.' };
    return { error: null };
  };

  return (
    <AuthContext.Provider value={{ session, user, supabaseUser, loading, signIn, signUp, signOut, resetPassword }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth deve ser usado dentro de AuthProvider');
  return ctx;
};
