import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, fireEvent, screen } from '@testing-library/react';
import React from 'react';

const confirmMock = vi.fn();
const signOutMock = vi.fn();

const usuario = {
  id: 'u1',
  nome: 'EDSON RENIS ALVES DA SILVA',
  email: 'eras.renis@gmail.com',
  nivel: 'super_admin',
  modulos_permitidos: ['*'],
};

vi.mock('../../context/AppContext', () => ({
  useAppContext: () => ({
    state: { user: usuario, isOnline: true, theme: 'dark', empresaSelecionada: 'pax' },
    dispatch: vi.fn(),
  }),
}));
vi.mock('../../context/AuthContext', () => ({
  useAuth: () => ({ signOut: signOutMock, supabaseUser: { email: usuario.email } }),
}));
vi.mock('../../context/ConfirmContext', () => ({
  useConfirm: () => ({ confirm: (...a: unknown[]) => confirmMock(...a) }),
}));
vi.mock('react-hot-toast', () => ({
  default: { success: vi.fn(), error: vi.fn(), loading: vi.fn() },
}));
vi.mock('../../services/empresasService', () => ({
  getEmpresas: vi.fn().mockResolvedValue([]),
  getEmpresaById: vi.fn().mockResolvedValue(null),
}));
vi.mock('../../services/usuariosService', () => ({ alterarPropriaSenha: vi.fn() }));
vi.mock('../../hooks/useNotifications', () => ({
  useNotifications: () => ({ totalAlertsCount: 0 }),
}));
vi.mock('../../hooks/useSyncStatus', () => ({
  useSyncStatus: () => ({ pendingCount: 0, isSyncing: false }),
}));
vi.mock('../../hooks/useOfflineSync', () => ({
  useOfflineSync: () => ({ isPriming: false, lastSyncFormatted: 'agora', syncNow: vi.fn() }),
}));
vi.mock('./NotificationCenter', () => ({ NotificationCenter: () => null }));

import { Topbar } from './Topbar';

describe('menu do usuário no Topbar', () => {
  beforeEach(() => vi.clearAllMocks());

  it('um clique na área do usuário abre o menu — não desloga mais direto', () => {
    render(<Topbar />);
    fireEvent.click(screen.getByTitle('Minha conta'));

    expect(confirmMock).not.toHaveBeenCalled();
    expect(signOutMock).not.toHaveBeenCalled();
    expect(screen.getByRole('menu')).toBeTruthy();
  });

  it('oferece alterar senha e sair', () => {
    render(<Topbar />);
    fireEvent.click(screen.getByTitle('Minha conta'));

    expect(screen.getByRole('menuitem', { name: /alterar minha senha/i })).toBeTruthy();
    expect(screen.getByRole('menuitem', { name: /sair do sistema/i })).toBeTruthy();
  });

  it('sair continua passando pela confirmação', () => {
    render(<Topbar />);
    fireEvent.click(screen.getByTitle('Minha conta'));
    fireEvent.click(screen.getByRole('menuitem', { name: /sair do sistema/i }));

    expect(confirmMock).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'Sair do Sistema' })
    );
    expect(screen.queryByRole('menu')).toBeNull();
  });

  it('alterar senha abre o modal e fecha o menu', () => {
    render(<Topbar />);
    fireEvent.click(screen.getByTitle('Minha conta'));
    fireEvent.click(screen.getByRole('menuitem', { name: /alterar minha senha/i }));

    expect(screen.queryByRole('menu')).toBeNull();
    expect(screen.getByText('Alterar minha senha')).toBeTruthy();
    expect(document.querySelector('#senha-atual')).toBeTruthy();
  });

  it('Escape fecha o menu', () => {
    render(<Topbar />);
    fireEvent.click(screen.getByTitle('Minha conta'));
    expect(screen.getByRole('menu')).toBeTruthy();

    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('menu')).toBeNull();
  });

  it('clique fora fecha o menu', () => {
    render(<Topbar />);
    fireEvent.click(screen.getByTitle('Minha conta'));
    fireEvent.mouseDown(document.body);
    expect(screen.queryByRole('menu')).toBeNull();
  });
});
