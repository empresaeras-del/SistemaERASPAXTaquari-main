export type NivelAcesso = 'super_admin' | 'admin' | 'gerente' | 'funcionario';

export interface Usuario {
  id: string;
  nome: string;
  email: string;
  nivel: NivelAcesso;
  modulos_permitidos: string[];
  tenant_id?: string;
}

export interface AppState {
  user: Usuario | null;
  isOnline: boolean;
  isLoading: boolean;
  empresaSelecionada: string | null;
  theme: "light" | "dark";
  layout: "sidebar" | "topbar";
}

export type AppAction =
  | { type: 'SET_USER'; payload: Usuario | null }
  | { type: 'SET_ONLINE_STATUS'; payload: boolean }
  | { type: 'SET_LOADING'; payload: boolean }
  | { type: 'SET_EMPRESA'; payload: string | null }
  | { type: 'SET_THEME'; payload: "light" | "dark" }
  | { type: 'SET_LAYOUT'; payload: "sidebar" | "topbar" };
