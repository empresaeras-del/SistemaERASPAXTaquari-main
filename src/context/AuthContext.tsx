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
  refreshProfile: () => Promise<Usuario | null>;
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
  refreshProfile: async () => null,
});

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [supabaseUser, setSupabaseUser] = useState<User | null>(null);
  const [user, setUser] = useState<Usuario | null>(null);
  const [loading, setLoading] = useState(true);

  // Carrega perfil do usuário da tabela `users`
  const loadUserProfile = async (authUser: User): Promise<Usuario | null> => {
    try {
      // 1. Tenta buscar pelo ID do Auth
      let { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('id', authUser.id)
        .maybeSingle();

      // 2. Se não encontrar pelo ID, tenta pelo email (caso tenha sido criado com outro UUID)
      if (!data && authUser.email) {
        const { data: userByEmail } = await supabase
          .from('users')
          .select('*')
          .eq('email', authUser.email.trim().toLowerCase())
          .maybeSingle();

        if (userByEmail) {
          data = userByEmail;
          // Sincroniza auth_user_id se necessário
          if (data.id !== authUser.id) {
            try {
              await supabase.from('users').update({ auth_user_id: authUser.id }).eq('id', data.id);
            } catch (e) {}
          }
        }
      }

      const appMeta = authUser.app_metadata || {};
      const userMeta = authUser.user_metadata || {};

      const tenantId = data?.tenant_id || (data as any)?.empresa_id || appMeta.tenant_id || userMeta.tenant_id || '';

      const finalProfile: Usuario = {
        id: data?.id || authUser.id,
        nome: data?.nome || userMeta.nome || userMeta.full_name || authUser.email?.split('@')[0] || 'Usuário',
        email: data?.email || authUser.email || '',
        nivel: (data?.nivel || appMeta.nivel || userMeta.nivel || 'funcionario') as NivelAcesso,
        modulos_permitidos: data?.modulos_permitidos || appMeta.modulos_permitidos || ['*'],
        tenant_id: tenantId,
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

  const refreshProfile = async (): Promise<Usuario | null> => {
    let authUser = supabaseUser;
    if (!authUser) {
      const { data } = await supabase.auth.getUser();
      authUser = data.user;
    }
    if (authUser) {
      const p = await loadUserProfile(authUser);
      if (p) setUser(p);
      return p;
    }
    return null;
  };

  useEffect(() => {
    let isMounted = true;

    // 1. Tenta recuperar perfil em cache imediatamente para carregamento instantâneo
    const getCachedProfile = (): Usuario | null => {
      try {
        const cached = localStorage.getItem('cached_user_profile');
        if (cached) return JSON.parse(cached);
      } catch (e) {}
      return null;
    };

    const initialCached = getCachedProfile();
    if (initialCached) {
      setUser(initialCached);
    }

    // 2. Verifica sessão existente ao montar
    supabase.auth.getSession().then(async ({ data: { session: s } }) => {
      if (!isMounted) return;
      if (s) {
        setSession(s);
        if (s.user) {
          setSupabaseUser(s.user);
          const profile = await loadUserProfile(s.user);
          setUser(profile || initialCached);
        }
      } else {
        setSession(null);
        setUser(null);
      }
      setLoading(false);
    }).catch(() => {
      if (!isMounted) return;
      setSession(null);
      setUser(null);
      setLoading(false);
    });

    // 3. Listener para mudanças de auth state
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, s) => {
      if (!isMounted) return;
      if (s?.user) {
        setSession(s);
        setSupabaseUser(s.user);
        const profile = await loadUserProfile(s.user);
        setUser(profile);
        try {
          localStorage.setItem('eras_last_activity', String(Date.now()));
        } catch (e) {}
      } else if (event === 'SIGNED_OUT') {
        setSession(null);
        setSupabaseUser(null);
        setUser(null);
        try {
          localStorage.removeItem('eras_last_activity');
          localStorage.removeItem('cached_user_profile');
        } catch (e) {}
      }
      setLoading(false);
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, []);

  // 4. Sincronização em tempo real e revalidação ao focar na janela
  useEffect(() => {
    if (!supabaseUser?.id) return;
    let isMounted = true;

    const channel = supabase
      .channel(`realtime-users-sync-${supabaseUser.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'users',
          filter: `id=eq.${supabaseUser.id}`,
        },
        async () => {
          if (!isMounted) return;
          const fresh = await loadUserProfile(supabaseUser);
          if (fresh && isMounted) setUser(fresh);
        }
      )
      .subscribe();

    const handleFocus = async () => {
      if (supabaseUser && isMounted) {
        const fresh = await loadUserProfile(supabaseUser);
        if (fresh && isMounted) setUser(fresh);
      }
    };
    window.addEventListener('focus', handleFocus);

    return () => {
      isMounted = false;
      channel.unsubscribe();
      window.removeEventListener('focus', handleFocus);
    };
  }, [supabaseUser?.id]);

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
        localStorage.removeItem('cached_user_profile');
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
    <AuthContext.Provider value={{ session, user, supabaseUser, loading, signIn, signUp, signOut, resetPassword, refreshProfile }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth deve ser usado dentro de AuthProvider');
  return ctx;
};
