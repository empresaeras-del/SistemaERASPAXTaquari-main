import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';

/**
 * O hook que substituiu `useBackgroundChecks`.
 *
 * A rotina antiga rodava no carregamento da aplicação, para **todo** operador, e mudava o
 * status do associado para `inadimplente` direto no cadastro — sem confirmação, sem
 * notificação e sem nada na tela. A única testemunha era um `console.log`, e ninguém lê o
 * console de um operador; quem descobria era quem abrisse o cadastro depois.
 *
 * Por isso o teste central deste arquivo não verifica o que o hook faz, e sim **o que ele
 * nunca mais pode fazer**: `saveAssociado` não é chamado em nenhum caminho. Um teste que só
 * cobrisse a notificação passaria de novo no dia em que alguém reintroduzisse a gravação
 * "para adiantar o trabalho do admin".
 */

const estado: {
  isOnline: boolean;
  empresaSelecionada: string | null;
  user: { id?: string; nivel?: string; tenant_id?: string } | null;
} = { isOnline: true, empresaSelecionada: 'emp-1', user: { id: 'u1', nivel: 'admin', tenant_id: 'emp-1' } };

vi.mock('../context/AppContext', () => ({
  useAppContext: () => ({ state: estado }),
}));

vi.mock('../services/associadosService', () => ({
  getAssociados: vi.fn(async () => []),
  saveAssociado: vi.fn(async () => undefined),
}));

vi.mock('../services/financeiroService', () => ({
  getParcelasReceber: vi.fn(async () => []),
  getReceitas: vi.fn(async () => []),
}));

vi.mock('../services/notificacoesService', () => ({
  avisoJaEnviado: vi.fn(async () => false),
  createNotificacao: vi.fn(async () => undefined),
}));

import { getAssociados, saveAssociado } from '../services/associadosService';
import { getParcelasReceber, getReceitas } from '../services/financeiroService';
import { avisoJaEnviado, createNotificacao } from '../services/notificacoesService';
import { useAvisoInadimplencia } from './useAvisoInadimplencia';
import { TITULO_AVISO_INADIMPLENCIA } from '../utils/inadimplencia';

const mockGetAssociados = vi.mocked(getAssociados);
const mockSaveAssociado = vi.mocked(saveAssociado);
const mockGetParcelas = vi.mocked(getParcelasReceber);
const mockGetReceitas = vi.mocked(getReceitas);
const mockAvisoJaEnviado = vi.mocked(avisoJaEnviado);
const mockCreateNotificacao = vi.mocked(createNotificacao);

const associadoDevedor = {
  id: 'a1',
  nome: 'MARIA DA SILVA',
  cpf: '017.989.211-89',
  status: 'ativo',
  tenant_id: 'emp-1',
};

const receitaDele = { id: 'r1', associado_id: 'a1', tenant_id: 'emp-1' };

/** Quatro parcelas vencidas: acima do limiar de 3, que é o que faz o aviso nascer. */
const parcelasVencidas = [1, 2, 3, 4].map((n) => ({
  id: `p${n}`,
  receita_id: 'r1',
  tenant_id: 'emp-1',
  numero_parcela: n,
  valor: 100,
  data_vencimento: `2026-0${n}-10`,
  status: 'vencido',
}));

const comInadimplenteDeVerdade = () => {
  mockGetAssociados.mockResolvedValue([associadoDevedor] as any);
  mockGetParcelas.mockResolvedValue(parcelasVencidas as any);
  mockGetReceitas.mockResolvedValue([receitaDele] as any);
};

beforeEach(() => {
  vi.clearAllMocks();
  mockGetAssociados.mockResolvedValue([] as any);
  mockGetParcelas.mockResolvedValue([] as any);
  mockGetReceitas.mockResolvedValue([] as any);
  mockAvisoJaEnviado.mockResolvedValue(false);
  estado.isOnline = true;
  estado.empresaSelecionada = 'emp-1';
  estado.user = { id: 'u1', nivel: 'admin', tenant_id: 'emp-1' };
  vi.setSystemTime(new Date(2026, 8, 19, 10, 0, 0));
});

afterEach(() => {
  vi.useRealTimers();
});

describe('useAvisoInadimplencia — o que ele nunca mais faz', () => {
  it('NÃO grava no cadastro do associado, mesmo com inadimplente de sobra', async () => {
    // É a regressão que este arquivo existe para impedir. Marcar um cliente como
    // inadimplente é decisão de cobrança, tomada pelo admin na tela de Associados.
    comInadimplenteDeVerdade();
    renderHook(() => useAvisoInadimplencia());

    await waitFor(() => expect(mockCreateNotificacao).toHaveBeenCalled());
    expect(mockSaveAssociado).not.toHaveBeenCalled();
  });

  it('não grava nem quando a criação da notificação falha', async () => {
    comInadimplenteDeVerdade();
    mockCreateNotificacao.mockRejectedValueOnce(new Error('sem rede'));
    renderHook(() => useAvisoInadimplencia());

    await waitFor(() => expect(mockCreateNotificacao).toHaveBeenCalled());
    expect(mockSaveAssociado).not.toHaveBeenCalled();
  });
});

describe('useAvisoInadimplencia — quem recebe', () => {
  it('avisa o admin', async () => {
    comInadimplenteDeVerdade();
    renderHook(() => useAvisoInadimplencia());

    await waitFor(() => expect(mockCreateNotificacao).toHaveBeenCalledTimes(1));
    const [notificacao] = mockCreateNotificacao.mock.calls[0];
    expect(notificacao.titulo).toBe(TITULO_AVISO_INADIMPLENCIA);
    expect(notificacao.usuario_id).toBe('u1');
    expect(notificacao.tenant_id).toBe('emp-1');
    expect(notificacao.link).toBe('/associados');
    expect(notificacao.tipo).toBe('alerta');
  });

  it('avisa o super_admin', async () => {
    comInadimplenteDeVerdade();
    estado.user = { id: 'u0', nivel: 'super_admin', tenant_id: 'default' };
    renderHook(() => useAvisoInadimplencia());
    await waitFor(() => expect(mockCreateNotificacao).toHaveBeenCalledTimes(1));
  });

  it.each(['gerente', 'funcionario'])(
    'não avisa o %s, que não tem o que fazer com este alerta',
    async (nivel) => {
      // Encher de alerta quem não pode resolvê-lo é como se aprende a não ler o aviso.
      comInadimplenteDeVerdade();
      estado.user = { id: 'u2', nivel, tenant_id: 'emp-1' };
      renderHook(() => useAvisoInadimplencia());

      await new Promise((r) => setTimeout(r, 0));
      expect(mockGetAssociados).not.toHaveBeenCalled();
      expect(mockCreateNotificacao).not.toHaveBeenCalled();
    },
  );

  it('sem usuário, não faz consulta nenhuma', async () => {
    estado.user = null;
    renderHook(() => useAvisoInadimplencia());
    await new Promise((r) => setTimeout(r, 0));
    expect(mockGetAssociados).not.toHaveBeenCalled();
  });

  it('offline não verifica: a notificação precisaria de rede e o dado estaria velho', async () => {
    comInadimplenteDeVerdade();
    estado.isOnline = false;
    renderHook(() => useAvisoInadimplencia());
    await new Promise((r) => setTimeout(r, 0));
    expect(mockGetAssociados).not.toHaveBeenCalled();
  });
});

describe('useAvisoInadimplencia — a empresa do aviso', () => {
  it('sem empresa resolvida, o aviso não nasce: notificação precisa de dono', async () => {
    // Cair num literal aqui daria à notificação uma empresa que não existe — a lição do
    // `empresa_padrao`, do lado de quem grava.
    comInadimplenteDeVerdade();
    estado.empresaSelecionada = 'all';
    estado.user = { id: 'u0', nivel: 'super_admin' };
    renderHook(() => useAvisoInadimplencia());

    await new Promise((r) => setTimeout(r, 0));
    expect(mockGetAssociados).not.toHaveBeenCalled();
    expect(mockCreateNotificacao).not.toHaveBeenCalled();
  });

  it('consulta as três fontes pela MESMA empresa do aviso', async () => {
    comInadimplenteDeVerdade();
    renderHook(() => useAvisoInadimplencia());

    await waitFor(() => expect(mockCreateNotificacao).toHaveBeenCalled());
    expect(mockGetAssociados).toHaveBeenCalledWith(true, 'emp-1');
    expect(mockGetParcelas).toHaveBeenCalledWith(true, 'emp-1');
    expect(mockGetReceitas).toHaveBeenCalledWith(true, 'emp-1');
  });

  it('o tenant do usuário serve de fallback quando não há empresa selecionada', async () => {
    comInadimplenteDeVerdade();
    estado.empresaSelecionada = null;
    renderHook(() => useAvisoInadimplencia());

    await waitFor(() => expect(mockCreateNotificacao).toHaveBeenCalled());
    expect(mockGetAssociados).toHaveBeenCalledWith(true, 'emp-1');
  });
});

describe('useAvisoInadimplencia — quando o aviso não nasce', () => {
  it('sem ninguém acima do limiar, não notifica', async () => {
    mockGetAssociados.mockResolvedValue([associadoDevedor] as any);
    mockGetReceitas.mockResolvedValue([receitaDele] as any);
    mockGetParcelas.mockResolvedValue(parcelasVencidas.slice(0, 2) as any); // 2 < 3
    renderHook(() => useAvisoInadimplencia());

    await waitFor(() => expect(mockGetAssociados).toHaveBeenCalled());
    expect(mockCreateNotificacao).not.toHaveBeenCalled();
  });

  it('não repete o aviso que já foi enviado com a mesma lista', async () => {
    comInadimplenteDeVerdade();
    mockAvisoJaEnviado.mockResolvedValue(true);
    renderHook(() => useAvisoInadimplencia());

    await waitFor(() => expect(mockAvisoJaEnviado).toHaveBeenCalled());
    expect(mockCreateNotificacao).not.toHaveBeenCalled();
  });

  it('a comparação do "já enviado" é pela MENSAGEM, não só pelo título', async () => {
    // O título é constante justamente para o aviso não renascer do zero a cada mudança na
    // lista; quem distingue uma lista da outra é a mensagem.
    comInadimplenteDeVerdade();
    renderHook(() => useAvisoInadimplencia());

    await waitFor(() => expect(mockAvisoJaEnviado).toHaveBeenCalled());
    const [, usuarioId, titulo, mensagem] = mockAvisoJaEnviado.mock.calls[0];
    expect(usuarioId).toBe('u1');
    expect(titulo).toBe(TITULO_AVISO_INADIMPLENCIA);
    expect(mensagem).toEqual(expect.stringContaining('MARIA DA SILVA'));
  });

  it('uma falha na consulta não derruba o carregamento do app', async () => {
    mockGetAssociados.mockRejectedValue(new Error('sem rede'));
    const { result } = renderHook(() => useAvisoInadimplencia());

    await new Promise((r) => setTimeout(r, 0));
    expect(result.current).toBeUndefined(); // o hook não devolve nada, e não lança
    expect(mockCreateNotificacao).not.toHaveBeenCalled();
  });
});

describe('useAvisoInadimplencia — uma verificação por sessão', () => {
  it('re-renderizar não dispara uma segunda verificação', async () => {
    comInadimplenteDeVerdade();
    const { rerender } = renderHook(() => useAvisoInadimplencia());

    await waitFor(() => expect(mockCreateNotificacao).toHaveBeenCalledTimes(1));
    rerender();
    rerender();
    await new Promise((r) => setTimeout(r, 0));
    expect(mockCreateNotificacao).toHaveBeenCalledTimes(1);
  });
});
