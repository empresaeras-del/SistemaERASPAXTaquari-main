import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import {
  criarBancoLocal,
  criarSupabaseFalso,
  recusaDominio,
  type Registro,
} from '../test/harnessDeHook';

const estado: { isOnline: boolean; empresaSelecionada: string | null; user: Registro | null } = {
  isOnline: true,
  empresaSelecionada: 'emp-1',
  user: { id: 'u1', nivel: 'admin', tenant_id: 'emp-1' },
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
vi.mock('../lib/syncService', () => ({ getSyncQueue: vi.fn() }));

import { getFromIDB, saveToIDB, getAllFromIDB, deleteFromIDB } from '../lib/idb';
import { supabase, registrarAuditoria } from '../lib/supabase';
import { getSyncQueue } from '../lib/syncService';
import { useFornecedores } from './useFornecedores';

const idb = {
  getFromIDB: vi.mocked(getFromIDB),
  saveToIDB: vi.mocked(saveToIDB),
  getAllFromIDB: vi.mocked(getAllFromIDB),
  deleteFromIDB: vi.mocked(deleteFromIDB),
};
const mockFrom = vi.mocked(supabase.from);
const mockAuditoria = vi.mocked(registrarAuditoria);
const mockFilaDeSync = vi.mocked(getSyncQueue);

const banco = criarBancoLocal();
const servidor = criarSupabaseFalso();

const fornecedor = (over: Registro = {}): Registro => ({
  id: 'f-1',
  codigo: 'FORN0001',
  razao_social: 'URNAS PAX BRASIL LTDA',
  nome_fantasia: 'Urnas Pax',
  cnpj_cpf: '12.345.678/0001-90',
  tipo_pessoa: 'PJ',
  tipo_fornecedor: 'produtos',
  categoria: 'Urnas e Caixões',
  status: 'ativo',
  empresa_id: 'emp-1',
  tenant_id: 'emp-1',
  created_at: '2026-09-01T00:00:00.000Z',
  updated_at: '2026-09-01T00:00:00.000Z',
  ...over,
});

beforeEach(() => {
  banco.limpar();
  servidor.limpar();
  estado.isOnline = true;
  estado.empresaSelecionada = 'emp-1';
  estado.user = { id: 'u1', nivel: 'admin', tenant_id: 'emp-1' };
  autenticado.user = { id: 'u1', nivel: 'admin', tenant_id: 'emp-1' };

  Object.values(idb).forEach((m) => m.mockReset());
  mockFrom.mockReset();
  mockAuditoria.mockReset();
  mockFilaDeSync.mockReset();

  banco.ligar(idb);
  mockFrom.mockImplementation(((t: string) => servidor.from(t)) as any);
  mockAuditoria.mockImplementation((async () => undefined) as any);
  mockFilaDeSync.mockImplementation((async () => []) as any);
  vi.setSystemTime(new Date('2026-09-20T12:00:00Z'));
});

afterEach(() => vi.useRealTimers());

/**
 * Semeia o registro nos **dois** lados — cache e servidor —, que é o estado normal de um
 * fornecedor já sincronizado.
 *
 * Desde que a resposta vazia passou a podar o cache, semear só o local descreve outra coisa:
 * um registro que o servidor não tem mais. O hook então o apaga, que é justamente o defeito
 * corrigido — e é por isso que os testes de listagem precisam dos dois lados para falar do
 * que querem falar.
 */
const semearSincronizado = (registros: Registro[]) => {
  banco.semear('fornecedores', registros);
  servidor.definirLeitura('fornecedores', { data: registros });
};

const montar = async () => {
  const utils = renderHook(() => useFornecedores());
  await waitFor(() => expect(utils.result.current.loading).toBe(false));
  return utils;
};

// ============================================================================
// A recusa do servidor
// ============================================================================

describe('criar — a recusa do servidor', () => {
  it('lança com a mensagem do banco, em vez de gravar só no navegador', async () => {
    // `fornecedores.status` ganhou `'bloqueado'` no `CHECK` em 18/09; antes disso salvar um
    // fornecedor bloqueado levava `23514`. O que este teste trava é que uma recusa assim
    // **chega ao operador** — é por `useFornecedores` lançar que aquele defeito foi achado,
    // enquanto o equivalente em `requisicoes.status` ficou meses escondido atrás de um retry.
    servidor.definirEscrita('fornecedores', {
      data: null,
      error: recusaDominio('fornecedores_status_check'),
    });
    const { result } = await montar();

    await expect(
      result.current.criar(fornecedor({ id: undefined, status: 'bloqueado' }) as any),
    ).rejects.toThrow(/check constraint/);
  });

  it('a recusa não deixa o fornecedor no cache local', async () => {
    servidor.definirEscrita('fornecedores', { data: null, error: recusaDominio('x') });
    const { result } = await montar();

    await expect(result.current.criar(fornecedor() as any)).rejects.toThrow();
    expect(banco.guardados('fornecedores')).toHaveLength(0);
  });

  it('UMA tentativa por gravação — nada de reenviar com o payload mutilado', async () => {
    servidor.definirEscrita('fornecedores', { data: null, error: recusaDominio('x') });
    const { result } = await montar();

    await expect(result.current.criar(fornecedor() as any)).rejects.toThrow();
    expect(servidor.escritasEm('fornecedores').filter((c) => c.operacao === 'insert')).toHaveLength(1);
  });

  it('editar também lança, e não sobrescreve o registro bom que estava no cache', async () => {
    semearSincronizado([fornecedor({ razao_social: 'NOME BOM' })]);
    servidor.definirEscrita('fornecedores', { data: null, error: recusaDominio('x') });
    const { result } = await montar();

    await expect(result.current.editar('f-1', { razao_social: 'NOME NOVO' } as any)).rejects.toThrow();
    expect(banco.guardado('fornecedores', 'f-1')?.razao_social).toBe('NOME BOM');
  });
});

// ============================================================================
// A empresa do registro
// ============================================================================

describe('a empresa do fornecedor', () => {
  it('para quem NÃO é super_admin, o tenant do usuário manda sobre o seletor do topo', async () => {
    // `getTenantId` ignora `empresaSelecionada` fora do super_admin. É o que impede um
    // operador de gravar fornecedor na empresa errada mexendo no seletor.
    estado.empresaSelecionada = 'emp-9';
    autenticado.user = { id: 'u1', nivel: 'admin', tenant_id: 'emp-1' };
    const { result } = await montar();

    await act(async () => {
      await result.current.criar(fornecedor({ id: undefined }) as any);
    });

    const insert = servidor.escritasEm('fornecedores').find((c) => c.operacao === 'insert')!;
    expect(insert.payload.tenant_id).toBe('emp-1');
    expect(insert.payload.empresa_id).toBe('emp-1');
  });

  it('para o super_admin, o seletor do topo é quem decide', async () => {
    estado.empresaSelecionada = 'emp-9';
    autenticado.user = { id: 'u0', nivel: 'super_admin', tenant_id: 'default' };
    const { result } = await montar();

    await act(async () => {
      await result.current.criar(fornecedor({ id: undefined }) as any);
    });

    const insert = servidor.escritasEm('fornecedores').find((c) => c.operacao === 'insert')!;
    expect(insert.payload.tenant_id).toBe('emp-9');
  });

  it('a edição preserva a empresa que o registro já tinha, não a do seletor', async () => {
    // Reabrir um fornecedor de outra empresa e salvar não pode movê-lo de dono.
    banco.semear('fornecedores', [fornecedor({ empresa_id: 'emp-7', tenant_id: 'emp-7' })]);
    estado.empresaSelecionada = 'emp-1';
    const { result } = await montar();

    await act(async () => {
      await result.current.editar('f-1', { razao_social: 'OUTRO NOME' } as any);
    });

    const update = servidor.escritasEm('fornecedores').find((c) => c.operacao === 'update')!;
    expect(update.payload.tenant_id).toBe('emp-7');
  });

  it('gera id próprio e carimba quem criou', async () => {
    const { result } = await montar();
    await act(async () => {
      await result.current.criar(fornecedor({ id: undefined }) as any);
    });

    const insert = servidor.escritasEm('fornecedores').find((c) => c.operacao === 'insert')!;
    expect(insert.payload.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
    expect(insert.payload.created_by).toBe('u1');
  });
});

// ============================================================================
// Offline
// ============================================================================

describe('offline', () => {
  it('criar não toca no Supabase e guarda no cache', async () => {
    estado.isOnline = false;
    const { result } = await montar();

    await act(async () => {
      await result.current.criar(fornecedor({ id: undefined }) as any);
    });

    expect(servidor.escritasEm('fornecedores')).toHaveLength(0);
    expect(banco.guardados('fornecedores')).toHaveLength(1);
  });

  it('editar mescla sobre o registro local sem perder o que não foi tocado', async () => {
    estado.isOnline = false;
    banco.semear('fornecedores', [fornecedor()]);
    const { result } = await montar();

    await act(async () => {
      await result.current.editar('f-1', { razao_social: 'SO A RAZAO' } as any);
    });

    const salvo = banco.guardado('fornecedores', 'f-1')!;
    expect(salvo.razao_social).toBe('SO A RAZAO');
    expect(salvo.cnpj_cpf).toBe('12.345.678/0001-90');
    expect(salvo.categoria).toBe('Urnas e Caixões');
  });
});

// ============================================================================
// Listagem e filtros
// ============================================================================

describe('listagem', () => {
  it('filtra por empresa e esconde o excluído', async () => {
    semearSincronizado([
      fornecedor({ id: 'a', empresa_id: 'emp-1', tenant_id: 'emp-1' }),
      fornecedor({ id: 'b', empresa_id: 'emp-2', tenant_id: 'emp-2' }),
      fornecedor({ id: 'c', empresa_id: 'emp-1', tenant_id: 'emp-1', deleted_at: 'x' }),
    ]);
    const { result } = await montar();
    expect(result.current.fornecedores.map((f) => f.id)).toEqual(['a']);
  });

  it('a busca varre razão social, fantasia, código, documento, contato e cidade', async () => {
    semearSincronizado([
      fornecedor({ id: 'a', razao_social: 'ALFA LTDA', nome_fantasia: 'Alfa' }),
      fornecedor({ id: 'b', razao_social: 'BETA LTDA', nome_fantasia: 'Beta', cidade: 'COXIM' }),
    ]);
    const { result } = await montar();

    await act(async () => result.current.setFiltros({ busca: 'coxim' }));
    await waitFor(() => expect(result.current.fornecedores.map((f) => f.id)).toEqual(['b']));
  });

  it('"todas"/"todos" não filtram nada — são o estado neutro do seletor', async () => {
    semearSincronizado([
      fornecedor({ id: 'a', categoria: 'Urnas e Caixões', status: 'ativo' }),
      fornecedor({ id: 'b', categoria: 'Floricultura', status: 'inativo' }),
    ]);
    const { result } = await montar();

    await act(async () =>
      result.current.setFiltros({ categoria: 'todas', status: 'todos', tipo_fornecedor: 'todos' } as any));
    await waitFor(() => expect(result.current.fornecedores).toHaveLength(2));
  });
});

// ============================================================================
// A poda do cache: zero linhas é resposta válida, não falha de rede
// ============================================================================

describe('a resposta remota vazia poda o cache', () => {
  /**
   * O guard era `if (!error && data && data.length > 0)`, o mesmo que `financeiroService`
   * já tinha corrigido nos quatro getters dele: exigir `length > 0` fazia "a empresa não tem
   * mais nenhum fornecedor" cair no ramo de falha e servir o cache — e era ali que o
   * fornecedor excluído em outra máquina sobrevivia, no IndexedDB de quem nunca soube.
   */
  it('o fornecedor que o servidor não tem mais sai da lista E do cache', async () => {
    banco.semear('fornecedores', [fornecedor({ id: 'fantasma' })]);
    servidor.definirLeitura('fornecedores', { data: [] });
    const { result } = await montar();

    expect(result.current.fornecedores).toEqual([]);
    expect(banco.guardados('fornecedores')).toHaveLength(0);
  });

  it('SALVAGUARDA: com tarefa pendente na fila de sync, o local é preservado', async () => {
    // É a fila que distingue "criado offline, ainda não subiu" de "excluído no servidor" —
    // sem ela, o registro que o operador acabou de cadastrar sem rede sumiria da tela.
    banco.semear('fornecedores', [fornecedor({ id: 'novo-offline' })]);
    servidor.definirLeitura('fornecedores', { data: [] });
    mockFilaDeSync.mockImplementation((async () => [
      { storeName: 'fornecedores', data: { id: 'novo-offline' } },
    ]) as any);
    const { result } = await montar();

    expect(result.current.fornecedores.map((f) => f.id)).toEqual(['novo-offline']);
    expect(banco.guardados('fornecedores')).toHaveLength(1);
  });

  it('SALVAGUARDA: tarefa pendente de OUTRO store não preserva nada', async () => {
    banco.semear('fornecedores', [fornecedor({ id: 'fantasma' })]);
    servidor.definirLeitura('fornecedores', { data: [] });
    mockFilaDeSync.mockImplementation((async () => [
      { storeName: 'despesas', data: { id: 'fantasma' } },
    ]) as any);
    await montar();

    expect(banco.guardados('fornecedores')).toHaveLength(0);
  });

  it('SALVAGUARDA: a leitura que FALHOU não poda nada', async () => {
    // Se o Supabase recusou ou caiu, "ausente na resposta" não significa coisa nenhuma —
    // podar ali apagaria o cache inteiro.
    banco.semear('fornecedores', [fornecedor({ id: 'f-1' })]);
    servidor.definirLeitura('fornecedores', { data: null, error: { message: 'sem rede' } });
    const { result } = await montar();

    expect(result.current.fornecedores.map((f) => f.id)).toEqual(['f-1']);
    expect(banco.guardados('fornecedores')).toHaveLength(1);
  });

  it('SALVAGUARDA: o fornecedor de OUTRA empresa não é podado ao trocar de empresa', async () => {
    // A consulta filtra por empresa, então o registro da outra está legitimamente fora da
    // resposta. Podá-lo apagaria o cache da outra empresa a cada troca no seletor do topo.
    banco.semear('fornecedores', [
      fornecedor({ id: 'da-outra', empresa_id: 'emp-2', tenant_id: 'emp-2' }),
    ]);
    servidor.definirLeitura('fornecedores', { data: [] });
    await montar();

    expect(banco.guardados('fornecedores').map((f) => f.id)).toEqual(['da-outra']);
  });

  it('o registro SEM empresa nenhuma também fica — a consulta filtrada nunca o traria', async () => {
    // É o caso da lista de demonstração do botão "Exemplos": ela nasce só no IndexedDB, sem
    // `empresa_id` nem `tenant_id`, e o caminho de escrita atual carimba as duas colunas —
    // então um registro assim nunca esteve no servidor para ter sido excluído de lá.
    banco.semear('fornecedores', [
      fornecedor({ id: 'forn-001', empresa_id: undefined, tenant_id: undefined }),
    ]);
    servidor.definirLeitura('fornecedores', { data: [] });
    await montar();

    expect(banco.guardados('fornecedores').map((f) => f.id)).toEqual(['forn-001']);
  });

  it('offline, não poda: o servidor nem foi consultado', async () => {
    estado.isOnline = false;
    banco.semear('fornecedores', [fornecedor({ id: 'f-1' })]);
    const { result } = await montar();

    expect(result.current.fornecedores.map((f) => f.id)).toEqual(['f-1']);
  });
});

// ============================================================================
// Exclusão
// ============================================================================

describe('excluir', () => {
  it('apaga em cascata as despesas e as parcelas a pagar do fornecedor, no cache', async () => {
    // Comportamento atual, travado aqui porque é ele que a próxima decisão vai mudar:
    // a cascata não pergunta nada e alcança **parcela já paga** — a mesma classe do
    // `softDeleteAssociado`, que em 14/09 passou a recusar quando há histórico. Ver a nota
    // ao fim deste arquivo.
    semearSincronizado([fornecedor()]);
    banco.semear('despesas', [
      { id: 'd1', fornecedor_id: 'f-1' },
      { id: 'd2', fornecedor_id: 'outro' },
    ]);
    banco.semear('parcelas_pagar', [
      { id: 'p1', despesa_id: 'd1', status: 'pago' },
      { id: 'p2', despesa_id: 'd2', status: 'pendente' },
    ]);
    const { result } = await montar();
    // Depois do `delete` o servidor não devolve mais a linha — e `excluir` termina chamando
    // o recarregamento, que agora relê o servidor de verdade.
    servidor.definirLeitura('fornecedores', { data: [] });

    await act(async () => {
      await result.current.excluir('f-1');
    });

    expect(banco.guardados('fornecedores')).toHaveLength(0);
    expect(banco.guardados('despesas').map((d) => d.id)).toEqual(['d2']);
    expect(banco.guardados('parcelas_pagar').map((p) => p.id)).toEqual(['p2']);
  });

  it('registra auditoria da exclusão quando online', async () => {
    semearSincronizado([fornecedor()]);
    const { result } = await montar();

    await act(async () => {
      await result.current.excluir('f-1');
    });

    expect(mockAuditoria).toHaveBeenCalledWith(
      'Excluir Fornecedor e Despesas Vinculadas',
      { id: 'f-1' },
    );
  });

  it('offline, some do cache sem tentar o servidor nem auditar', async () => {
    estado.isOnline = false;
    banco.semear('fornecedores', [fornecedor()]);
    const { result } = await montar();

    await act(async () => {
      await result.current.excluir('f-1');
    });

    expect(servidor.escritasEm('fornecedores')).toHaveLength(0);
    expect(mockAuditoria).not.toHaveBeenCalled();
    expect(banco.guardados('fornecedores')).toHaveLength(0);
  });
});

describe('alterarStatus', () => {
  it('passa pelo mesmo caminho de editar — a regra do tenant vale igual', async () => {
    semearSincronizado([fornecedor({ status: 'ativo' })]);
    const { result } = await montar();

    await act(async () => {
      await result.current.alterarStatus('f-1', 'bloqueado');
    });

    const update = servidor.escritasEm('fornecedores').find((c) => c.operacao === 'update')!;
    expect(update.payload.status).toBe('bloqueado');
    expect(update.payload.updated_at).toBe('2026-09-20T12:00:00.000Z');
  });

  it('a recusa do status sobe para a tela em vez de virar sucesso silencioso', async () => {
    semearSincronizado([fornecedor()]);
    servidor.definirEscrita('fornecedores', {
      data: null,
      error: recusaDominio('fornecedores_status_check'),
    });
    const { result } = await montar();

    await expect(result.current.alterarStatus('f-1', 'bloqueado' as any)).rejects.toThrow();
  });
});
