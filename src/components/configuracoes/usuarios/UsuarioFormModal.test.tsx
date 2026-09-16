import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, fireEvent, waitFor } from '@testing-library/react';
import React from 'react';

const saveUsuarioMock = vi.fn();

const superAdmin = {
  id: 'super', nome: 'EDSON RENIS', email: 'eras.renis@gmail.com',
  nivel: 'super_admin', modulos_permitidos: ['*'], tenant_id: 'default',
};

vi.mock('../../../context/AppContext', () => ({
  useAppContext: () => ({
    state: { user: superAdmin, isOnline: true, theme: 'dark', empresaSelecionada: 'all' },
    dispatch: vi.fn(),
  }),
}));
vi.mock('../../../context/ToastContext', () => ({
  useToast: () => ({ success: vi.fn(), error: vi.fn(), info: vi.fn() }),
}));
vi.mock('../../../services/usuariosService', () => ({
  saveUsuario: (...args: unknown[]) => saveUsuarioMock(...args),
}));

import { UsuarioFormModal } from './UsuarioFormModal';

const alvo = {
  id: 'func-1', tenant_id: 'emp-1', nome: 'GIZELLE LEMES',
  email: 'func@empresa.com', nivel: 'funcionario' as const,
  modulos_permitidos: ['dashboard'], status: 'ativo' as const,
};

const montar = () =>
  render(
    <UsuarioFormModal
      usuarioInicial={alvo}
      empresas={[{ id: 'emp-1', nome_fantasia: 'PAX', razao_social: 'PAX LTDA' } as never]}
      usuariosExistentes={[alvo as never]}
      onClose={() => {}}
      onSave={() => {}}
    />
  );

describe('UsuarioFormModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    saveUsuarioMock.mockResolvedValue(undefined);
  });

  /**
   * Em 16/09/2026 a tela chamava `saveUsuario(usuario, isOnline, senha)` — sem o quarto
   * argumento. Dentro do service, os dois ramos de troca de senha dependem dele: ambos
   * eram pulados, a senha era DESCARTADA e a auditoria registrava `senha_alterada: true`
   * assim mesmo. Aconteceu duas vezes com a mesma funcionária, e os logs provaram: nenhuma
   * chamada a `admin_alterar_senha_usuario` e `auth.users.updated_at` intacto.
   *
   * Um teste que só verificasse "saveUsuario foi chamado" passaria nos dois casos. Este
   * exige o argumento que decide o comportamento.
   */
  it('passa o usuário logado para saveUsuario — é ele que decide como a senha é trocada', async () => {
    const { container } = montar();

    fireEvent.change(container.querySelector('#alterar-usuario-senha')!, {
      target: { value: 'NovaSenha!2026' },
    });
    fireEvent.submit(container.querySelector('form')!);

    await waitFor(() => expect(saveUsuarioMock).toHaveBeenCalled());

    const args = saveUsuarioMock.mock.calls[0];
    expect(args).toHaveLength(4);
    expect(args[2]).toBe('NovaSenha!2026');
    expect(args[3]).toEqual(expect.objectContaining({ id: 'super', nivel: 'super_admin' }));
  });

  it('salvar sem senha continua passando o usuário logado', async () => {
    const { container } = montar();
    fireEvent.submit(container.querySelector('form')!);

    await waitFor(() => expect(saveUsuarioMock).toHaveBeenCalled());
    expect(saveUsuarioMock.mock.calls[0][3]).toEqual(
      expect.objectContaining({ id: 'super' })
    );
  });

  it('o campo de senha aparece para o super_admin editando outro usuário', () => {
    const { container } = montar();
    expect(container.querySelector('#alterar-usuario-senha')).toBeTruthy();
  });
});
