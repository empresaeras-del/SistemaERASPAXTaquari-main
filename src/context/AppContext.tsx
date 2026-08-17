import React, { createContext, useReducer, useContext, useEffect } from 'react';
import { AppState, AppAction, Usuario } from '../types';
import { get, set } from '../lib/idb-safe';
import { isSupabaseConfigured } from '../lib/supabase';

const initialState: AppState = {
  user: null, // Pode ser preenchido por padrão em dev ou após auth
  isOnline: navigator.onLine && isSupabaseConfigured,
  isLoading: false,
  empresaSelecionada: null,
  theme: 'dark',
  layout: 'sidebar',
};

const appReducer = (state: AppState, action: AppAction): AppState => {
  switch (action.type) {
    case 'SET_USER':
      return { ...state, user: action.payload };
    case 'SET_ONLINE_STATUS':
      return { ...state, isOnline: action.payload };
    case 'SET_LOADING':
      return { ...state, isLoading: action.payload };
    case 'SET_EMPRESA':
      return { ...state, empresaSelecionada: action.payload };
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

  // Initialize selected tenant from idb
  useEffect(() => {
    get('tenant_id').then((tenantId) => {
      if (tenantId) {
        dispatch({ type: 'SET_EMPRESA', payload: tenantId as string });
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

  // Persist and apply theme
  useEffect(() => {
    set('layout', state.layout);
  }, [state.layout]);

  useEffect(() => {
    set('theme', state.theme);
    if (state.theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [state.theme]);

  // Persist selected tenant on change
  useEffect(() => {
    if (state.empresaSelecionada) {
      set('tenant_id', state.empresaSelecionada).catch(console.error);
    }
  }, [state.empresaSelecionada]);

  useEffect(() => {
    const handleOnline = () => dispatch({ type: 'SET_ONLINE_STATUS', payload: true && isSupabaseConfigured });
    const handleOffline = () => dispatch({ type: 'SET_ONLINE_STATUS', payload: false });

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // TODO: Supabase auth listener para SET_USER

    // Stub temporário para dev UI
    dispatch({ 
      type: 'SET_USER', 
      payload: { id: '1', nome: 'Super Admin', email: 'superadmin@eras.com', nivel: 'super_admin', modulos_permitidos: ['*'] } 
    });

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

