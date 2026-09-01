import React, { createContext, useReducer, useContext, useEffect } from 'react';
import { AppState, AppAction, Usuario } from '../types';
import { get, set } from '../lib/idb-safe';
import { isSupabaseConfigured } from '../lib/supabase';
import { useAuth } from './AuthContext';

const initialState: AppState = {
  user: null,
  isOnline: navigator.onLine && isSupabaseConfigured,
  isLoading: false,
  empresaSelecionada: null,
  theme: 'dark',
  layout: 'sidebar',
};

const appReducer = (state: AppState, action: AppAction): AppState => {
  switch (action.type) {
    case 'SET_USER': {
      const nextUser = action.payload;
      const isSuperAdmin = nextUser?.nivel === 'super_admin';
      const nextTenant = (!isSuperAdmin && nextUser?.tenant_id)
        ? nextUser.tenant_id
        : state.empresaSelecionada;
      return { ...state, user: nextUser, empresaSelecionada: nextTenant };
    }
    case 'SET_ONLINE_STATUS':
      return { ...state, isOnline: action.payload };
    case 'SET_LOADING':
      return { ...state, isLoading: action.payload };
    case 'SET_EMPRESA': {
      // Se for usuário comum/admin com tenant_id, garante o tenant_id do usuário atual
      if (state.user && state.user.nivel !== 'super_admin' && state.user.tenant_id) {
        return { ...state, empresaSelecionada: state.user.tenant_id };
      }
      return { ...state, empresaSelecionada: action.payload };
    }
    case 'SET_THEME':
      return { ...state, theme: action.payload };
    case 'SET_LAYOUT':
      return { ...state, layout: action.payload };
    default:
      return state;
  }
};

const AppContext = createContext<{
  state: AppState;
  dispatch: React.Dispatch<AppAction>;
}>({
  state: initialState,
  dispatch: () => null,
});

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [state, dispatch] = useReducer(appReducer, initialState);
  const { user } = useAuth();

  // Sincroniza o usuário autenticado com o AppState
  useEffect(() => {
    dispatch({ type: 'SET_USER', payload: user });

    // Ao logar ou atualizar o usuário, sincroniza o tenant e o IDB
    if (user && user.nivel !== 'super_admin' && user.tenant_id) {
      dispatch({ type: 'SET_EMPRESA', payload: user.tenant_id });
      set('tenant_id', user.tenant_id).catch(console.error);
    }
  }, [user]);

  // Inicializa preferências do IDB
  useEffect(() => {
    get('tenant_id').then((tenantId) => {
      if (tenantId) {
        // Só aplica o tenant do cache se:
        // 1. O usuário for super_admin (pode trocar de empresa), OU
        // 2. Não houver usuário logado ainda
        if (!user || user.nivel === 'super_admin') {
          dispatch({
            type: 'SET_EMPRESA',
            payload: tenantId as string,
          });
        }
      }
    });
    get('theme').then((t) => {
      if (t === 'light' || t === 'dark') {
        dispatch({ type: 'SET_THEME', payload: t });
      }
    });
    get('layout').then((l) => {
      if (l === 'sidebar' || l === 'topbar') {
        dispatch({ type: 'SET_LAYOUT', payload: l });
      }
    });
  }, []);

  // Persiste e aplica o layout
  useEffect(() => {
    set('layout', state.layout);
  }, [state.layout]);

  // Persiste e aplica o tema
  useEffect(() => {
    set('theme', state.theme);
    if (state.theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [state.theme]);

  // Persiste o tenant selecionado
  useEffect(() => {
    if (state.empresaSelecionada) {
      set('tenant_id', state.empresaSelecionada).catch(console.error);
    }
  }, [state.empresaSelecionada]);

  // Monitor de conectividade
  useEffect(() => {
    const handleOnline = () => dispatch({ type: 'SET_ONLINE_STATUS', payload: true && isSupabaseConfigured });
    const handleOffline = () => dispatch({ type: 'SET_ONLINE_STATUS', payload: false });

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  return (
    <AppContext.Provider value={{ state, dispatch }}>
      {children}
    </AppContext.Provider>
  );
};

export const useAppContext = () => useContext(AppContext);
