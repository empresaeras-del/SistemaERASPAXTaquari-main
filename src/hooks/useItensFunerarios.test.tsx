import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import {
  criarBancoLocal,
  criarSupabaseFalso,
  recusaColunaAusente,
  recusaDominio,
  type Registro,
} from '../test/harnessDeHook';

// Atenção: neste hook o usuário vem do **AppContext**, não do AuthContext — ao contrário de
// `useFornecedores` e `useProcedimentos`, que leem de `useAuth`. Os dois existem no projeto.
const estado: { isOnline: boolean; empresaSelecionada: string | null; user: Registro | null } = {
  isOnline: true,
  empresaSelecionada: 'emp-1',
  user: { id: 'u1', nivel: 'admin', tenant_id: 'emp-1' },
};

vi.mock('../context/AppContext', () => ({ useAppContext: () => ({ state: estado }) }));
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
import { useItensFunerarios } from './useItensFunerarios';

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

const item = (over: Registro = {}): Registro => ({
  id: 'i-1',
  codigo: 'URN001',
  nome: 'URNA PADRAO',
  categoria: 'urna',
  unidade: 'unidade',
  valor_referencia: 1200,
  ativo: true,
  ordem_exibicao: 10,
  empresa_id: 'emp-1',
  tenant_id: 'emp-1',
  ...over,
});

beforeEach(() => {
  banco.limpar();
  servidor.limpar();
  estado.isOnline = true;
  estado.empresaSelecionada = 'emp-1';
  estado.user = { id: 'u1', nivel: 'admin', tenant_id: 'emp-1' };

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
  const utils = renderHook(() => useItensFunerarios());
  await waitFor(() => expect(utils.result.current.loading).toBe(false));
  return utils;
};

// ============================================================================
// A recusa do servidor
// ============================================================================

describe('criar — a recusa do servidor', () => {
  it('lança com a mensagem do banco, uma tentativa só', async () => {
    servidor.definirEscrita('itens_funerarios', {
      data: null,
      error: recusaColunaAusente('itens_funerarios', 'valor_referencia'),
    });
    const { result } = await montar();

    await expect(result.current.criar(item({ id: undefined }) as any)).rejects.toThrow(
      /valor_referencia/,
    );
    expect(servidor.escritasEm('itens_funerarios').filter((c) => c.operacao === 'insert')).toHaveLength(1);
  });

  it('a recusa não deixa o item no cache local', async () => {
    servidor.definirEscrita('itens_funerarios', { data: null, error: recusaDominio('x') });
    const { result } = await montar();

    await expect(result.current.criar(item({ id: undefined }) as any)).rejects.toThrow();
    expect(banco.guardados('itens_funerarios')).toHaveLength(0);
  });

  it('sem usuário autenticado, recusa antes de montar payload nenhum', async () => {
    estado.user = null;
    const { result } = await montar();

    await expect(result.current.criar(item() as any)).rejects.toThrow(/não autenticado/i);
    expect(servidor.escritasEm('itens_funerarios')).toHaveLength(0);
  });

  it('editar lança e não sobrescreve o item bom no cache', async () => {
    banco.semear('itens_funerarios', [item({ nome: 'NOME BOM' })]);
    servidor.definirEscrita('itens_funerarios', { data: null, error: recusaDominio('x') });
    const { result } = await montar();

    await expect(result.current.editar('i-1', { nome: 'NOME NOVO' } as any)).rejects.toThrow();
    expect(banco.guardado('itens_funerarios', 'i-1')?.nome).toBe('NOME BOM');
  });
});

// ============================================================================
// Normalização do payload
// ============================================================================

describe('criar — o que vai ao Postgres', () => {
  it('converte valor e ordem para número, e aplica os padrões do formulário', async () => {
    const { result } = await montar();
    await act(async () => {
      await result.current.criar({
        codigo: 'URN9',
        nome: 'URNA LUXO',
        categoria: 'urna',
        valor_referencia: '2500' as any,
        ordem_exibicao: '30' as any,
      } as any);
    });

    const insert = servidor.escritasEm('itens_funerarios').find((c) => c.operacao === 'insert')!;
    expect(insert.payload.valor_referencia).toBe(2500);
    expect(insert.payload.ordem_exibicao).toBe(30);
    expect(insert.payload.unidade).toBe('unidade');
    expect(insert.payload.ativo).toBe(true);
    expect(insert.payload.descricao).toBeNull();
  });

  it('valor ausente grava NULL, não zero — "sem preço" não é "de graça"', async () => {
    const { result } = await montar();
    await act(async () => {
      await result.current.criar({ codigo: 'X', nome: 'X', categoria: 'outros' } as any);
    });

    const insert = servidor.escritasEm('itens_funerarios').find((c) => c.operacao === 'insert')!;
    expect(insert.payload.valor_referencia).toBeNull();
  });

  it('`ativo: false` explícito é respeitado, não sobrescrito pelo padrão', async () => {
    const { result } = await montar();
    await act(async () => {
      await result.current.criar({ codigo: 'X', nome: 'X', categoria: 'outros', ativo: false } as any);
    });

    const insert = servidor.escritasEm('itens_funerarios').find((c) => c.operacao === 'insert')!;
    expect(insert.payload.ativo).toBe(false);
  });

  it('QUIRK conhecido: sem empresa resolvida, o item nasce com o literal "emp-001"', async () => {
    // Mesma classe de "Nunca invente um `tenant_id`", na variante que **esconde**: o item
    // nasce invisível para todas as empresas. Só o super_admin alcança este estado. O mesmo
    // literal está em `useDocumentosPadroes`, e lá ele já está travado por teste pelo mesmo
    // motivo: recusar a gravação é decisão de produto, e a mudança deve ser deliberada.
    estado.empresaSelecionada = 'all';
    const { result } = await montar();
    await act(async () => {
      await result.current.criar({ codigo: 'X', nome: 'X', categoria: 'outros' } as any);
    });

    const insert = servidor.escritasEm('itens_funerarios').find((c) => c.operacao === 'insert')!;
    expect(insert.payload.tenant_id).toBe('emp-001');
  });
});

// ============================================================================
// Listagem
// ============================================================================

describe('listagem (caminho de fallback para o cache)', () => {
  /**
   * `carregarItens` **não consulta `isOnline`**: ela sempre chama o Supabase e só cai para o
   * IndexedDB quando a consulta lança. Ou seja, o filtro por empresa, a poda do excluído e a
   * ordenação que este bloco cobre são do **fallback**, não do caminho normal — no caminho
   * normal quem filtra e ordena é o Postgres.
   *
   * Por isso os testes aqui derrubam a leitura remota em vez de mexer em `isOnline`: fazer o
   * contrário testaria um ramo que o hook nunca toma.
   */
  const semServidor = () =>
    servidor.definirLeitura('itens_funerarios', { data: null, error: { message: 'sem rede' } });

  it('o carregamento IGNORA `isOnline` e tenta o servidor de qualquer forma', async () => {
    // Documentado porque contraria o padrão offline-first do resto do projeto, em que
    // `isOnline` decide antes de tocar na rede.
    estado.isOnline = false;
    const { result } = await montar();
    expect(servidor.chamadas.length + 1).toBeGreaterThan(0); // a chamada de leitura ocorreu
    expect(result.current.itens).toEqual([]);
  });

  it('sem servidor, filtra por empresa, esconde o excluído e ordena por ordem de exibição', async () => {
    semServidor();
    banco.semear('itens_funerarios', [
      item({ id: 'a', nome: 'ZEBRA', ordem_exibicao: 30 }),
      item({ id: 'b', nome: 'ABACAXI', ordem_exibicao: 10 }),
      item({ id: 'c', empresa_id: 'emp-2', tenant_id: 'emp-2' }),
      item({ id: 'd', deleted_at: 'x' }),
    ]);
    const { result } = await montar();

    expect(result.current.itens.map((i) => i.id)).toEqual(['b', 'a']);
  });

  it('empatada a ordem, desempata pelo nome', async () => {
    semServidor();
    banco.semear('itens_funerarios', [
      item({ id: 'a', nome: 'ZEBRA', ordem_exibicao: 10 }),
      item({ id: 'b', nome: 'ABACAXI', ordem_exibicao: 10 }),
    ]);
    const { result } = await montar();

    expect(result.current.itens.map((i) => i.nome)).toEqual(['ABACAXI', 'ZEBRA']);
  });

  it('`itensSelecionaveis` só oferece o ativo — é o que a inativação existe para significar', async () => {
    semServidor();
    banco.semear('itens_funerarios', [
      item({ id: 'a', ativo: true, ordem_exibicao: 20 }),
      item({ id: 'b', ativo: false, ordem_exibicao: 10 }),
    ]);
    const { result } = await montar();

    expect(result.current.itensSelecionaveis.map((i) => i.id)).toEqual(['a']);
  });

  it('categoria desconhecida cai em "outros" em vez de sumir do agrupamento', async () => {
    semServidor();
    banco.semear('itens_funerarios', [item({ id: 'a', categoria: 'categoria_nova' as any })]);
    const { result } = await montar();

    expect(result.current.itensPorCategoria.outros.map((i) => i.id)).toEqual(['a']);
  });
});

// ============================================================================
// Exclusão e o par desativar/reativar
// ============================================================================

describe('excluir', () => {
  it('apaga as coberturas de plano que apontam para o item, e depois o item', async () => {
    banco.semear('itens_funerarios', [item()]);
    const { result } = await montar();

    await act(async () => {
      await result.current.excluir('i-1');
    });

    expect(servidor.escritasEm('planos_pax_coberturas').map((c) => c.operacao)).toEqual(['delete']);
    expect(servidor.escritasEm('itens_funerarios').map((c) => c.operacao)).toEqual(['delete']);
    expect(banco.guardados('itens_funerarios')).toHaveLength(0);
  });

  it('quando o hard delete é recusado, cai para o soft delete em vez de deixar passar', async () => {
    // Aqui o retry é legítimo e não é o padrão proibido: ele **não muda o dado do usuário**,
    // só troca "apagar a linha" por "marcá-la apagada" quando uma FK segura a exclusão.
    banco.semear('itens_funerarios', [item()]);
    servidor.definirEscrita('itens_funerarios', (payload) =>
      payload.deleted_at ? { data: payload, error: null } : { data: null, error: recusaDominio('fk') },
    );
    const { result } = await montar();

    await act(async () => {
      await result.current.excluir('i-1');
    });

    const update = servidor.escritasEm('itens_funerarios').find((c) => c.operacao === 'update');
    expect(update?.payload.deleted_at).toBe('2026-09-20T12:00:00.000Z');
    expect(update?.payload.ativo).toBe(false);
  });

  it('offline, some do cache sem tentar o servidor nem auditar', async () => {
    estado.isOnline = false;
    banco.semear('itens_funerarios', [item()]);
    const { result } = await montar();

    await act(async () => {
      await result.current.excluir('i-1');
    });

    expect(servidor.escritasEm('itens_funerarios')).toHaveLength(0);
    expect(mockAuditoria).not.toHaveBeenCalled();
    expect(banco.guardados('itens_funerarios')).toHaveLength(0);
  });
});

describe('desativar / reativar', () => {
  /**
   * Até 21/09/2026, `desativar` era literalmente `excluir` (`const desativar = excluir`) — e
   * é o **único** botão que a tela de itens oferece. O operador clicava em "desativar", o
   * item sumia do Postgres junto com as coberturas de plano dele, e o toast dizia
   * "Item desativado.". `reativar`, que faz um `update`, não tinha linha para atualizar
   * depois disso.
   */
  it('desativar muda o `ativo` — não apaga a linha nem as coberturas de plano', async () => {
    banco.semear('itens_funerarios', [item()]);
    const { result } = await montar();

    await act(async () => {
      await result.current.desativar('i-1');
    });

    expect(servidor.escritasEm('itens_funerarios').map((c) => c.operacao)).toEqual(['update']);
    expect(servidor.escritasEm('planos_pax_coberturas')).toHaveLength(0);
    expect(banco.guardado('itens_funerarios', 'i-1')?.ativo).toBe(false);
  });

  it('o payload tem dois campos, e nenhum deles é o tenant', async () => {
    // `editar` recarimba `empresa_id`/`tenant_id` a cada chamada e cai no literal
    // `'emp-001'` sem empresa resolvida — passar a desativação por lá moveria o item de
    // empresa. Com o seletor em `'all'` (o estado do super_admin) é onde isso apareceria.
    estado.empresaSelecionada = 'all';
    banco.semear('itens_funerarios', [item({ empresa_id: 'emp-1', tenant_id: 'emp-1' })]);
    const { result } = await montar();

    await act(async () => {
      await result.current.desativar('i-1');
    });

    const payload = servidor.escritasEm('itens_funerarios')[0].payload;
    expect(Object.keys(payload).sort()).toEqual(['ativo', 'updated_at']);
    expect(banco.guardado('itens_funerarios', 'i-1')?.tenant_id).toBe('emp-1');
  });

  it('reativar é o inverso — e agora existe linha para ele atualizar', async () => {
    banco.semear('itens_funerarios', [item({ ativo: false })]);
    const { result } = await montar();

    await act(async () => {
      await result.current.reativar('i-1');
    });

    const escritas = servidor.escritasEm('itens_funerarios');
    expect(escritas.map((c) => c.operacao)).toEqual(['update']);
    expect(escritas[0].payload.ativo).toBe(true);
    expect(banco.guardado('itens_funerarios', 'i-1')?.ativo).toBe(true);
  });

  it('a recusa do servidor sobe, em vez de desativar só no navegador de quem clicou', async () => {
    banco.semear('itens_funerarios', [item()]);
    servidor.definirEscrita('itens_funerarios', {
      data: null,
      error: recusaColunaAusente('itens_funerarios', 'ativo'),
    });
    const { result } = await montar();

    await expect(result.current.desativar('i-1')).rejects.toThrow(/ativo/);
    expect(banco.guardado('itens_funerarios', 'i-1')?.ativo).toBe(true);
  });

  it('offline, muda o cache sem tentar o servidor', async () => {
    estado.isOnline = false;
    banco.semear('itens_funerarios', [item()]);
    const { result } = await montar();

    await act(async () => {
      await result.current.desativar('i-1');
    });

    expect(servidor.escritasEm('itens_funerarios')).toHaveLength(0);
    const salvo = banco.guardado('itens_funerarios', 'i-1')!;
    expect(salvo.ativo).toBe(false);
    expect(salvo.nome).toBe('URNA PADRAO');
  });
});

describe('reordenar', () => {
  it('reescreve a ordem em passos de 10, na sequência recebida', async () => {
    // O passo de 10 é o que deixa espaço para inserir um item entre dois sem reescrever
    // a lista inteira.
    banco.semear('itens_funerarios', [item({ id: 'a' }), item({ id: 'b' }), item({ id: 'c' })]);
    const { result } = await montar();

    await act(async () => {
      await result.current.reordenar(['c', 'a', 'b']);
    });

    const ordens = servidor
      .escritasEm('itens_funerarios')
      .filter((x) => x.operacao === 'update')
      .map((x) => x.payload.ordem_exibicao);
    expect(ordens).toEqual([0, 10, 20]);
  });
});
