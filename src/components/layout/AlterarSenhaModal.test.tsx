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

/**
 * O modal é renderizado por `createPortal` em `document.body` — o `<header>` do Topbar tem
 * `backdrop-filter`, que viraria bloco de contenção do `position: fixed`. Por isso os
 * seletores procuram no DOCUMENTO, não no `container` devolvido pelo render.
 */
const campoDe = (id: string) => document.querySelector(id) as HTMLInputElement;

const preencher = (atual: string, nova: string, confirma: string) => {
  fireEvent.change(campoDe('#senha-atual'), { target: { value: atual } });
  fireEvent.change(campoDe('#senha-nova'), { target: { value: nova } });
  fireEvent.change(campoDe('#senha-confirmacao'), { target: { value: confirma } });
};

const formulario = () => document.querySelector('form') as HTMLFormElement;

describe('AlterarSenhaModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    alterarPropriaSenhaMock.mockResolvedValue(undefined);
  });

  it('não renderiza nada fechado', () => {
    const { container } = render(<AlterarSenhaModal isOpen={false} onClose={() => {}} />);
    expect(container.innerHTML).toBe('');
    expect(document.querySelector('#senha-atual')).toBeNull();
  });

  it('vai para document.body por portal, não para a árvore de quem o montou', () => {
    // Quem monta este modal é o Topbar, cujo <header> tem `backdrop-filter` — e
    // `backdrop-filter` cria bloco de contenção para `position: fixed`. Dentro dele o
    // `fixed inset-0` resolvia contra a faixa do cabeçalho, e o modal saía cortado.
    const { container } = render(<AlterarSenhaModal isOpen onClose={() => {}} />);

    expect(container.innerHTML).toBe('');
    const overlay = document.querySelector('.fixed.inset-0');
    expect(overlay).toBeTruthy();
    expect(overlay!.parentElement).toBe(document.body);
  });

  it('mantém o botão desabilitado até a troca ser válida', () => {
    render(<AlterarSenhaModal isOpen onClose={() => {}} />);
    const botao = screen.getByRole('button', { name: /alterar senha/i }) as HTMLButtonElement;

    expect(botao.disabled).toBe(true);

    preencher('atual123', 'NovaSenha!2026', 'NovaSenha!2025');
    expect(botao.disabled).toBe(true);

    preencher('atual123', 'NovaSenha!2026', 'NovaSenha!2026');
    expect(botao.disabled).toBe(false);
  });

  it('usa o e-mail do Auth, não o do perfil, e não apara a senha', async () => {
    render(<AlterarSenhaModal isOpen onClose={() => {}} />);
    preencher(' atual ', ' nova senha ', ' nova senha ');
    fireEvent.submit(formulario());

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
    render(<AlterarSenhaModal isOpen onClose={onClose} />);
    preencher('atual123', 'NovaSenha!2026', 'NovaSenha!2026');
    fireEvent.submit(formulario());

    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(campoDe('#senha-atual').value).toBe('');
  });

  it('mostra a mensagem do servidor e MANTÉM o formulário aberto e preenchido', async () => {
    const onClose = vi.fn();
    alterarPropriaSenhaMock.mockRejectedValue(new Error('A senha atual não confere.'));

    const { container } = render(<AlterarSenhaModal isOpen onClose={onClose} />);
    preencher('errada', 'NovaSenha!2026', 'NovaSenha!2026');
    fireEvent.submit(formulario());

    await screen.findByText('A senha atual não confere.');
    expect(onClose).not.toHaveBeenCalled();
    expect(campoDe('#senha-nova').value).toBe(
      'NovaSenha!2026'
    );
  });

  it('o medidor de força só aparece com nova senha digitada, e fica junto dela', () => {
    render(<AlterarSenhaModal isOpen onClose={() => {}} />);
    expect(formulario().textContent).not.toMatch(/Senha (fraca|razoável|forte)/);

    preencher('atual123', 'senha123', 'senha123');
    expect(formulario().textContent).toMatch(/Senha razoável/);

    // O medidor mede a NOVA senha: ele precisa estar dentro do bloco desse campo,
    // não solto no fim do formulário ao lado da confirmação.
    const blocoDaNova = campoDe('#senha-nova').closest('div')!.parentElement!;
    expect(blocoDaNova.textContent).toMatch(/Senha razoável/);
  });

  it('mostrar/ocultar vale para os três campos de uma vez', () => {
    render(<AlterarSenhaModal isOpen onClose={() => {}} />);
    const tipos = () =>
      ['#senha-atual', '#senha-nova', '#senha-confirmacao'].map((sel) => campoDe(sel).type);

    expect(tipos()).toEqual(['password', 'password', 'password']);
    fireEvent.click(screen.getAllByTitle('Mostrar senhas')[0]);
    expect(tipos()).toEqual(['text', 'text', 'text']);
  });

  it('todo botão declara type — nenhum submete por acidente', () => {
    render(<AlterarSenhaModal isOpen onClose={() => {}} />);
    const botoes = Array.from(document.querySelectorAll('button'));
    expect(botoes.length).toBeGreaterThan(0);
    expect(botoes.every((b) => b.getAttribute('type'))).toBe(true);
    expect(botoes.filter((b) => b.getAttribute('type') === 'submit')).toHaveLength(1);
  });
});
