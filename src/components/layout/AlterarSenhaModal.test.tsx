import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, fireEvent, screen, waitFor } from '@testing-library/react';
import React from 'react';

const usuario = {
  id: 'u1',
  nome: 'PAOLA BEZERRA',
  email: 'perfil@empresa.com',
  nivel: 'funcionario',
  modulos_permitidos: ['dashboard'],
};

const alterarPropriaSenhaMock = vi.fn();

vi.mock('../../context/AppContext', () => ({
  useAppContext: () => ({
    state: { user: usuario, isOnline: true, theme: 'dark', empresaSelecionada: 'pax' },
    dispatch: vi.fn(),
  }),
}));
vi.mock('../../context/AuthContext', () => ({
  useAuth: () => ({ supabaseUser: { email: 'auth@empresa.com' } }),
}));
vi.mock('react-hot-toast', () => ({
  default: { success: vi.fn(), error: vi.fn(), loading: vi.fn() },
}));
vi.mock('../../services/usuariosService', () => ({
  alterarPropriaSenha: (...args: unknown[]) => alterarPropriaSenhaMock(...args),
}));

import { AlterarSenhaModal } from './AlterarSenhaModal';

const preencher = (container: HTMLElement, atual: string, nova: string, confirma: string) => {
  fireEvent.change(container.querySelector('#senha-atual')!, { target: { value: atual } });
  fireEvent.change(container.querySelector('#senha-nova')!, { target: { value: nova } });
  fireEvent.change(container.querySelector('#senha-confirmacao')!, {
    target: { value: confirma },
  });
};

describe('AlterarSenhaModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    alterarPropriaSenhaMock.mockResolvedValue(undefined);
  });

  it('não renderiza nada fechado', () => {
    const { container } = render(<AlterarSenhaModal isOpen={false} onClose={() => {}} />);
    expect(container.innerHTML).toBe('');
  });

  it('mantém o botão desabilitado até a troca ser válida', () => {
    const { container } = render(<AlterarSenhaModal isOpen onClose={() => {}} />);
    const botao = screen.getByRole('button', { name: /alterar senha/i }) as HTMLButtonElement;

    expect(botao.disabled).toBe(true);

    preencher(container, 'atual123', 'NovaSenha!2026', 'NovaSenha!2025');
    expect(botao.disabled).toBe(true);

    preencher(container, 'atual123', 'NovaSenha!2026', 'NovaSenha!2026');
    expect(botao.disabled).toBe(false);
  });

  it('usa o e-mail do Auth, não o do perfil, e não apara a senha', async () => {
    const { container } = render(<AlterarSenhaModal isOpen onClose={() => {}} />);
    preencher(container, ' atual ', ' nova senha ', ' nova senha ');
    fireEvent.submit(container.querySelector('form')!);

    await waitFor(() => expect(alterarPropriaSenhaMock).toHaveBeenCalled());
    expect(alterarPropriaSenhaMock).toHaveBeenCalledWith(
      {
        email: 'auth@empresa.com',
        senhaAtual: ' atual ',
        novaSenha: ' nova senha ',
        confirmacao: ' nova senha ',
      },
      true
    );
  });

  it('fecha e limpa os campos quando a troca dá certo', async () => {
    const onClose = vi.fn();
    const { container } = render(<AlterarSenhaModal isOpen onClose={onClose} />);
    preencher(container, 'atual123', 'NovaSenha!2026', 'NovaSenha!2026');
    fireEvent.submit(container.querySelector('form')!);

    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect((container.querySelector('#senha-atual') as HTMLInputElement).value).toBe('');
  });

  it('mostra a mensagem do servidor e MANTÉM o formulário aberto e preenchido', async () => {
    const onClose = vi.fn();
    alterarPropriaSenhaMock.mockRejectedValue(new Error('A senha atual não confere.'));

    const { container } = render(<AlterarSenhaModal isOpen onClose={onClose} />);
    preencher(container, 'errada', 'NovaSenha!2026', 'NovaSenha!2026');
    fireEvent.submit(container.querySelector('form')!);

    await screen.findByText('A senha atual não confere.');
    expect(onClose).not.toHaveBeenCalled();
    expect((container.querySelector('#senha-nova') as HTMLInputElement).value).toBe(
      'NovaSenha!2026'
    );
  });

  it('o medidor de força só aparece com nova senha digitada, e fica junto dela', () => {
    const { container } = render(<AlterarSenhaModal isOpen onClose={() => {}} />);
    expect(container.textContent).not.toMatch(/Senha (fraca|razoável|forte)/);

    preencher(container, 'atual123', 'senha123', 'senha123');
    expect(container.textContent).toMatch(/Senha razoável/);

    // O medidor mede a NOVA senha: ele precisa estar dentro do bloco desse campo,
    // não solto no fim do formulário ao lado da confirmação.
    const blocoDaNova = container.querySelector('#senha-nova')!.closest('div')!.parentElement!;
    expect(blocoDaNova.textContent).toMatch(/Senha razoável/);
  });

  it('mostrar/ocultar vale para os três campos de uma vez', () => {
    const { container } = render(<AlterarSenhaModal isOpen onClose={() => {}} />);
    const tipos = () =>
      ['#senha-atual', '#senha-nova', '#senha-confirmacao'].map(
        (sel) => (container.querySelector(sel) as HTMLInputElement).type
      );

    expect(tipos()).toEqual(['password', 'password', 'password']);
    fireEvent.click(screen.getAllByTitle('Mostrar senhas')[0]);
    expect(tipos()).toEqual(['text', 'text', 'text']);
  });

  it('todo botão declara type — nenhum submete por acidente', () => {
    const { container } = render(<AlterarSenhaModal isOpen onClose={() => {}} />);
    const botoes = Array.from(container.querySelectorAll('button'));
    expect(botoes.length).toBeGreaterThan(0);
    expect(botoes.every((b) => b.getAttribute('type'))).toBe(true);
    expect(botoes.filter((b) => b.getAttribute('type') === 'submit')).toHaveLength(1);
  });
});
