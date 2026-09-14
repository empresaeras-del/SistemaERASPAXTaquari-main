import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

vi.mock('../../../context/AppContext', () => ({
  useAppContext: () => ({
    state: { isOnline: true, user: { id: 'u', nivel: 'admin', tenant_id: 't1' }, empresaSelecionada: 't1' },
  }),
}));

const toastSuccess = vi.fn();
const toastError = vi.fn();
vi.mock('../../../context/ToastContext', () => ({
  useToast: () => ({ success: toastSuccess, error: toastError }),
}));

vi.mock('../../../services/cadastrosIncompletosService', () => ({
  getCadastrosIncompletos: vi.fn(),
  reenviarConfirmacaoDeEmail: vi.fn(),
  criarPerfilDoCadastro: vi.fn(),
}));

import {
  getCadastrosIncompletos,
  reenviarConfirmacaoDeEmail,
} from '../../../services/cadastrosIncompletosService';
import { CadastrosIncompletosPainel } from './CadastrosIncompletosPainel';
import type { CadastroDeUsuario } from '../../../utils/cadastrosIncompletos';

const mockLista = vi.mocked(getCadastrosIncompletos);
const mockReenviar = vi.mocked(reenviarConfirmacaoDeEmail);

const cadastro = (over: Partial<CadastroDeUsuario> = {}): CadastroDeUsuario => ({
  usuario_id: 'u1',
  email: 'fulano@exemplo.com',
  nome: 'FULANO DE TAL',
  tenant_id: 't1',
  nivel: 'funcionario',
  criado_em: '2026-09-11T11:59:02.000Z',
  tem_perfil: true,
  email_confirmado: true,
  ja_acessou: false,
  convite_enviado_em: null,
  ...over,
});

beforeEach(() => {
  vi.clearAllMocks();
});

describe('CadastrosIncompletosPainel', () => {
  it('não ocupa espaço nenhum quando está tudo certo', async () => {
    mockLista.mockResolvedValue([]);
    const { container } = render(<CadastrosIncompletosPainel onResolvido={vi.fn()} />);
    await waitFor(() => expect(mockLista).toHaveBeenCalled());
    expect(container).toBeEmptyDOMElement();
  });

  it('some, em vez de mostrar erro, quando a RPC recusa', async () => {
    // Quem está abaixo de admin recebe 42501: o painel não é assunto dele, e um erro na
    // tela seria sobre algo que ele não teria como resolver.
    mockLista.mockRejectedValue(new Error('permission denied'));
    const { container } = render(<CadastrosIncompletosPainel onResolvido={vi.fn()} />);
    await waitFor(() => expect(mockLista).toHaveBeenCalled());
    expect(container).toBeEmptyDOMElement();
  });

  it('cada cadastro recebe só os botões das pendências que ele tem', async () => {
    mockLista.mockResolvedValue([
      cadastro({ usuario_id: 'orfao', nome: 'SEM PERFIL', email: 'orfao@x.com', tem_perfil: false }),
      cadastro({ usuario_id: 'convite', nome: 'SEM CONFIRMAR', email: 'c@x.com', email_confirmado: false }),
    ]);
    render(<CadastrosIncompletosPainel onResolvido={vi.fn()} />);

    await screen.findByText(/2 cadastros de usuário estão pela metade/);
    expect(screen.getAllByRole('button', { name: /Criar perfil/ })).toHaveLength(1);
    expect(screen.getAllByRole('button', { name: /Reenviar convite/ })).toHaveLength(1);
    expect(screen.getByText('Sem perfil de acesso')).toBeTruthy();
    expect(screen.getByText('Convite não confirmado')).toBeTruthy();
  });

  it('o cadastro sem nome no convite não repete o e-mail duas vezes', async () => {
    mockLista.mockResolvedValue([cadastro({ nome: null, email: 'so.email@x.com', tem_perfil: false })]);
    render(<CadastrosIncompletosPainel onResolvido={vi.fn()} />);
    const linha = await screen.findByText(/so\.email@x\.com/);
    expect(linha.textContent).toBe('so.email@x.com');
  });

  it('reenviar manda para o e-mail daquela linha', async () => {
    mockLista.mockResolvedValue([
      cadastro({ usuario_id: 'w', email: 'welliton@x.com', email_confirmado: false }),
      cadastro({ usuario_id: 'g', email: 'gizelle@x.com', email_confirmado: false }),
    ]);
    mockReenviar.mockResolvedValue(undefined);
    render(<CadastrosIncompletosPainel onResolvido={vi.fn()} />);

    const botoes = await screen.findAllByRole('button', { name: /Reenviar convite/ });
    await userEvent.click(botoes[1]);

    await waitFor(() => expect(mockReenviar).toHaveBeenCalledWith('gizelle@x.com'));
    expect(toastSuccess).toHaveBeenCalled();
  });

  it('a recusa do reenvio chega ao operador com a mensagem do servidor', async () => {
    // Um "reenviado com sucesso" sobre um limite de envio estourado faria o admin marcar a
    // pendência como resolvida enquanto ela continua lá.
    mockLista.mockResolvedValue([cadastro({ email_confirmado: false })]);
    mockReenviar.mockRejectedValue(new Error('email rate limit exceeded'));
    render(<CadastrosIncompletosPainel onResolvido={vi.fn()} />);

    await userEvent.click(await screen.findByRole('button', { name: /Reenviar convite/ }));

    await waitFor(() => expect(toastError).toHaveBeenCalledWith('email rate limit exceeded'));
  });
});
