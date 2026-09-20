import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import {
  criarBancoLocal,
  criarSupabaseFalso,
  recusaColunaAusente,
  recusaDominio,
  type Registro,
} from '../test/harnessDeHook';

const estado: { isOnline: boolean; empresaSelecionada: string | null } = {
  isOnline: true,
  empresaSelecionada: 'emp-1',
};
const autenticado: { user: Registro | null } = {
  user: { id: 'u1', nivel: 'admin', tenant_id: 'emp-1' },
};

vi.mock('../context/AppContext', () => ({ useAppContext: () => ({ state: estado }) }));
vi.mock('../context/AuthContext', () => ({ useAuth: () => autenticado }));
vi.mock('../lib/idb', () => ({
  getFromIDB: vi.fn(),
  saveToIDB: vi.fn(),
  getAllFromIDB: vi.fn(),
  deleteFromIDB: vi.fn(),
}));
vi.mock('../lib/supabase', () => ({
  supabase: { from: vi.fn() },
  registrarAuditoria: vi.fn(),
}));

import { getFromIDB, saveToIDB, getAllFromIDB, deleteFromIDB } from '../lib/idb';
import { supabase, registrarAuditoria } from '../lib/supabase';
import { useProcedimentos } from './useProcedimentos';

const idb = {
  getFromIDB: vi.mocked(getFromIDB),
  saveToIDB: vi.mocked(saveToIDB),
  getAllFromIDB: vi.mocked(getAllFromIDB),
  deleteFromIDB: vi.mocked(deleteFromIDB),
};
const mockFrom = vi.mocked(supabase.from);
const mockAuditoria = vi.mocked(registrarAuditoria);

const banco = criarBancoLocal();
const servidor = criarSupabaseFalso();

const procedimento = (over: Registro = {}): Registro => ({
  id: 'p-1',
  codigo: 'PRC001',
  descricao: 'TANATOPRAXIA',
  valor: 350,
  tenant_id: 'emp-1',
  empresa_id: 'emp-1',
  ...over,
});

beforeEach(() => {
  banco.limpar();
  servidor.limpar();
  estado.isOnline = true;
  estado.empresaSelecionada = 'emp-1';
  autenticado.user = { id: 'u1', nivel: 'admin', tenant_id: 'emp-1' };

  Object.values(idb).forEach((m) => m.mockReset());
  mockFrom.mockReset();
  mockAuditoria.mockReset();

  banco.ligar(idb);
  mockFrom.mockImplementation(((t: string) => servidor.from(t)) as any);
  mockAuditoria.mockImplementation((async () => undefined) as any);
  vi.setSystemTime(new Date('2026-09-20T12:00:00Z'));
});

afterEach(() => vi.useRealTimers());

const montar = async () => {
  const utils = renderHook(() => useProcedimentos());
  await waitFor(() => expect(utils.result.current.loading).toBe(false));
  return utils;
};

// ============================================================================
// A recusa do servidor
// ============================================================================

describe('criar — a recusa do servidor', () => {
  it('lança em vez de gravar só no navegador', async () => {
    // Até 20/09/2026 este bloco fazia `console.warn` e `saveToIDB(newItem)`: o procedimento
    // ficava preso no navegador de quem operou, invisível para todo o resto da empresa, e a
    // tela dizia sucesso. É a armadilha que o CLAUDE.md documenta desde `saveAtendimento`.
    servidor.definirEscrita('procedimentos', {
      data: null,
      error: recusaDominio('procedimentos_valor_check'),
    });
    const { result } = await montar();

    await expect(result.current.criar(procedimento({ id: undefined }) as any)).rejects.toThrow(
      /check constraint/,
    );
  });

  it('a recusa NÃO vira linha de auditoria de criação', async () => {
    // O pior detalhe do comportamento antigo: a auditoria ficava **fora** do if/else, então
    // gravava "Criar Procedimento" mesmo quando o servidor tinha recusado. A trilha passava
    // a afirmar o contrário do que aconteceu — o mesmo defeito das duas linhas falsas de
    // `Editar Usuário` que este repositório já registra como irreparáveis.
    servidor.definirEscrita('procedimentos', { data: null, error: recusaDominio('x') });
    const { result } = await montar();

    await expect(result.current.criar(procedimento({ id: undefined }) as any)).rejects.toThrow();
    expect(mockAuditoria).not.toHaveBeenCalled();
  });

  it('a recusa não deixa o procedimento no cache local', async () => {
    servidor.definirEscrita('procedimentos', {
      data: null,
      error: recusaColunaAusente('procedimentos', 'valor'),
    });
    const { result } = await montar();

    await expect(result.current.criar(procedimento({ id: undefined }) as any)).rejects.toThrow();
    expect(banco.guardados('procedimentos')).toHaveLength(0);
  });

  it('a mensagem diz qual coluna falta, não um "Erro ao criar" genérico', async () => {
    servidor.definirEscrita('procedimentos', {
      data: null,
      error: recusaColunaAusente('procedimentos', 'valor_repasse'),
    });
    const { result } = await montar();

    await expect(result.current.criar(procedimento({ id: undefined }) as any)).rejects.toThrow(
      /valor_repasse/,
    );
  });
});

describe('editar — a recusa do servidor', () => {
  it('lança, não audita e não sobrescreve o registro bom no cache', async () => {
    banco.semear('procedimentos', [procedimento({ descricao: 'DESCRICAO BOA' })]);
    servidor.definirEscrita('procedimentos', { data: null, error: recusaDominio('x') });
    const { result } = await montar();

    await expect(result.current.editar('p-1', { descricao: 'NOVA' } as any)).rejects.toThrow();
    expect(mockAuditoria).not.toHaveBeenCalled();
    expect(banco.guardado('procedimentos', 'p-1')?.descricao).toBe('DESCRICAO BOA');
  });
});

// ============================================================================
// Caminho aceito
// ============================================================================

describe('caminho aceito', () => {
  it('grava, audita e recarrega', async () => {
    const { result } = await montar();
    await act(async () => {
      await result.current.criar(procedimento({ id: undefined, descricao: 'NECROPSIA' }) as any);
    });

    expect(banco.guardados('procedimentos')).toHaveLength(1);
    expect(mockAuditoria).toHaveBeenCalledWith(
      'Criar Procedimento',
      expect.objectContaining({ descricao: 'NECROPSIA' }),
    );
  });

  it('gera id quando o chamador não traz um, e respeita o id informado', async () => {
    const { result } = await montar();
    await act(async () => {
      await result.current.criar(procedimento({ id: undefined }) as any);
      await result.current.criar(procedimento({ id: 'id-escolhido' }) as any);
    });

    const [a, b] = servidor.escritasEm('procedimentos').filter((c) => c.operacao === 'insert');
    expect(a.payload.id).toMatch(/^[0-9a-f]{8}-/i);
    expect(b.payload.id).toBe('id-escolhido');
  });

  it('para quem não é super_admin, o tenant do usuário manda sobre o seletor do topo', async () => {
    estado.empresaSelecionada = 'emp-9';
    autenticado.user = { id: 'u1', nivel: 'gerente', tenant_id: 'emp-1' };
    const { result } = await montar();

    await act(async () => {
      await result.current.criar(procedimento({ id: undefined }) as any);
    });

    const insert = servidor.escritasEm('procedimentos').find((c) => c.operacao === 'insert')!;
    expect(insert.payload.tenant_id).toBe('emp-1');
    expect(insert.payload.empresa_id).toBe('emp-1');
  });

  it('a edição preserva o tenant do registro, não o do seletor', async () => {
    banco.semear('procedimentos', [procedimento({ tenant_id: 'emp-7', empresa_id: 'emp-7' })]);
    const { result } = await montar();

    await act(async () => {
      await result.current.editar('p-1', { descricao: 'OUTRA' } as any);
    });

    const update = servidor.escritasEm('procedimentos').find((c) => c.operacao === 'update')!;
    expect(update.payload.tenant_id).toBe('emp-7');
  });
});

// ============================================================================
// Exclusão: as duas guardas de vínculo
// ============================================================================

describe('excluir — as guardas de vínculo', () => {
  it('recusa quando o procedimento está vinculado a um credenciado', async () => {
    banco.semear('procedimentos', [procedimento()]);
    banco.semear('credenciados_procedimentos', [{ id: 'cp1', procedimento_id: 'p-1' }]);
    const { result } = await montar();

    await expect(result.current.excluir('p-1')).rejects.toThrow(/vinculado a um ou mais credenciados/i);
    expect(banco.guardados('procedimentos')).toHaveLength(1);
  });

  it('recusa quando o procedimento aparece em alguma requisição', async () => {
    // A guia já emitida cita o procedimento; apagá-lo deixaria o documento entregue à
    // família apontando para um item que não existe mais.
    banco.semear('procedimentos', [procedimento()]);
    banco.semear('requisicoes', [{ id: 'r1', itens: [{ procedimento_id: 'p-1' }] }]);
    const { result } = await montar();

    await expect(result.current.excluir('p-1')).rejects.toThrow(/vinculado a uma ou mais requisições/i);
    expect(banco.guardados('procedimentos')).toHaveLength(1);
  });

  it('a guarda roda ANTES de qualquer escrita, inclusive a local', async () => {
    banco.semear('procedimentos', [procedimento()]);
    banco.semear('credenciados_procedimentos', [{ id: 'cp1', procedimento_id: 'p-1' }]);
    const { result } = await montar();

    await expect(result.current.excluir('p-1')).rejects.toThrow();
    expect(servidor.escritasEm('procedimentos')).toHaveLength(0);
    expect(mockAuditoria).not.toHaveBeenCalled();
  });

  it('sem vínculo, exclui e audita', async () => {
    banco.semear('procedimentos', [procedimento()]);
    banco.semear('credenciados_procedimentos', []);
    banco.semear('requisicoes', []);
    const { result } = await montar();

    await act(async () => {
      await result.current.excluir('p-1');
    });

    expect(banco.guardados('procedimentos')).toHaveLength(0);
    expect(mockAuditoria).toHaveBeenCalledWith('Excluir Procedimento', { id: 'p-1' });
  });

  it('vínculo de OUTRO procedimento não bloqueia este', async () => {
    banco.semear('procedimentos', [procedimento()]);
    banco.semear('credenciados_procedimentos', [{ id: 'cp1', procedimento_id: 'outro' }]);
    const { result } = await montar();

    await act(async () => {
      await result.current.excluir('p-1');
    });
    expect(banco.guardados('procedimentos')).toHaveLength(0);
  });
});
