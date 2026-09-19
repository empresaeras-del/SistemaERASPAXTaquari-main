import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';

const estado: { isOnline: boolean; empresaSelecionada: string | null } = {
  isOnline: true,
  empresaSelecionada: 'emp-1',
};

vi.mock('../context/AppContext', () => ({
  useAppContext: () => ({ state: estado }),
}));

vi.mock('../lib/idb', () => ({
  getFromIDB: vi.fn(),
  saveToIDB: vi.fn(),
  getAllFromIDB: vi.fn(),
  deleteFromIDB: vi.fn(),
}));

vi.mock('../lib/supabase', () => ({
  supabase: { from: vi.fn(), storage: { from: vi.fn() } },
  registrarAuditoria: vi.fn(),
}));

import { getFromIDB, saveToIDB, getAllFromIDB, deleteFromIDB } from '../lib/idb';
import { supabase, registrarAuditoria } from '../lib/supabase';
import { useDocumentosPadroes } from './useDocumentosPadroes';

const mockGetFromIDB = vi.mocked(getFromIDB);
const mockSaveToIDB = vi.mocked(saveToIDB);
const mockGetAllFromIDB = vi.mocked(getAllFromIDB);
const mockDeleteFromIDB = vi.mocked(deleteFromIDB);
const mockFrom = vi.mocked(supabase.from);
const mockRegistrarAuditoria = vi.mocked(registrarAuditoria);

// ---------------------------------------------------------------------------
// IndexedDB falso com estado de verdade, pelo mesmo motivo de `caixasService.test.ts`:
// toda escrita deste hook termina chamando `carregarDocumentos`, que relê o store inteiro.
// Mockar por chamada faria o teste depender da ordem interna das leituras.
// ---------------------------------------------------------------------------
type Registro = Record<string, any>;
const bancoLocal = new Map<string, Map<string, Registro>>();
const guardados = (store: string): Registro[] => [...(bancoLocal.get(store)?.values() ?? [])];

/**
 * Supabase falso que **registra cada chamada de escrita**.
 *
 * O que importa aqui não é só o resultado: é **quantas vezes** o hook tentou gravar e
 * **com qual payload** em cada tentativa — que é onde mora o defeito que este arquivo
 * mede. Um mock que só devolvesse `{data, error}` não conseguiria distinguir "gravou" de
 * "gravou depois de jogar fora metade dos campos do usuário".
 */
const chamadas: { operacao: 'insert' | 'update' | 'delete'; payload: Registro }[] = [];
let respostaDeEscrita: () => { data: Registro | null; error: Registro | null } = () => ({
  data: null,
  error: null,
});
let leituraRemota: { data: Registro[] | null; error: Registro | null } = { data: [], error: null };

const construirQuery = (): any => {
  const q: any = {
    select: () => q,
    is: () => q,
    or: () => q,
    eq: () => q,
    order: () => Promise.resolve(leituraRemota),
    single: () => Promise.resolve(respostaDeEscrita()),
    insert: (payload: Registro[]) => {
      chamadas.push({ operacao: 'insert', payload: { ...payload[0] } });
      return q;
    },
    update: (payload: Registro) => {
      chamadas.push({ operacao: 'update', payload: { ...payload } });
      return q;
    },
    delete: () => {
      chamadas.push({ operacao: 'delete', payload: {} });
      return q;
    },
    then: (ok: any, falha: any) => Promise.resolve(respostaDeEscrita()).then(ok, falha),
  };
  return q;
};

const recusaPorColunaAusente = (coluna: string) => ({
  code: 'PGRST204',
  message: `Could not find the '${coluna}' column of 'documentos_padroes' in the schema cache`,
});

const documentoSalvo = (over: Registro = {}): Registro => ({
  id: 'doc-1',
  nome: 'CONTRATO PADRAO',
  tipo: 'contrato',
  conteudo: '<p>corpo</p>',
  empresa_id: 'emp-1',
  tenant_id: 'emp-1',
  criado_em: '2026-09-01T00:00:00.000Z',
  atualizado_em: '2026-09-01T00:00:00.000Z',
  ...over,
});

beforeEach(() => {
  bancoLocal.clear();
  chamadas.length = 0;
  respostaDeEscrita = () => ({ data: null, error: null });
  leituraRemota = { data: [], error: null };
  estado.isOnline = true;
  estado.empresaSelecionada = 'emp-1';

  mockGetFromIDB.mockReset();
  mockSaveToIDB.mockReset();
  mockGetAllFromIDB.mockReset();
  mockDeleteFromIDB.mockReset();
  mockFrom.mockReset();
  mockRegistrarAuditoria.mockReset();

  mockGetFromIDB.mockImplementation((async (s: string, id: string) =>
    bancoLocal.get(s)?.get(id) ?? null) as any);
  mockGetAllFromIDB.mockImplementation((async (s: string) =>
    [...(bancoLocal.get(s)?.values() ?? [])]) as any);
  mockSaveToIDB.mockImplementation((async (s: string, d: Registro) => {
    if (!bancoLocal.has(s)) bancoLocal.set(s, new Map());
    bancoLocal.get(s)!.set(String(d.id), d);
  }) as any);
  mockDeleteFromIDB.mockImplementation((async (s: string, id: string) => {
    bancoLocal.get(s)?.delete(id);
  }) as any);
  mockFrom.mockImplementation((() => construirQuery()) as any);
  mockRegistrarAuditoria.mockImplementation((async () => undefined) as any);

  vi.setSystemTime(new Date('2026-09-19T12:00:00Z'));
});

afterEach(() => {
  vi.useRealTimers();
});

/** Monta o hook e espera o carregamento inicial terminar. */
const montar = async () => {
  const utils = renderHook(() => useDocumentosPadroes());
  await waitFor(() => expect(utils.result.current.loading).toBe(false));
  return utils;
};

// ============================================================================
// A recusa do servidor
// ============================================================================

describe('criar — a recusa do servidor', () => {
  it('UMA tentativa por gravação: o payload enviado é o payload do usuário', async () => {
    // Este é o teste central do arquivo. Até 19/09/2026 o hook respondia ao `PGRST204`
    // **apagando a coluna que faltava e tentando de novo**, até 12 vezes: o documento era
    // gravado sem o campo, a tela dizia "salvo com sucesso" e o dado do usuário sumia sem
    // erro nenhum. É o mesmo padrão que este repositório já removeu de `criarRequisicao`
    // (o retry que regravava a guia com outro status) e de `resilientSupabaseUpsert` (que
    // anulava o `plano_pax_id` quando a FK falhava).
    respostaDeEscrita = () => ({ data: null, error: recusaPorColunaAusente('assinatura_config') });
    const { result } = await montar();

    await expect(
      act(async () => {
        await result.current.criar({ nome: 'NOVO', tipo: 'contrato', conteudo: '<p>x</p>' } as any);
      }),
    ).rejects.toThrow();

    const inserts = chamadas.filter((c) => c.operacao === 'insert');
    expect(inserts).toHaveLength(1);
  });

  it('a mensagem diz QUAL coluna falta e que é migration faltando, não erro do operador', async () => {
    respostaDeEscrita = () => ({ data: null, error: recusaPorColunaAusente('assinatura_config') });
    const { result } = await montar();

    await expect(
      result.current.criar({ nome: 'NOVO', tipo: 'contrato' } as any),
    ).rejects.toThrow(/assinatura_config/);
  });

  it('a recusa não deixa meio documento no cache local', async () => {
    respostaDeEscrita = () => ({ data: null, error: recusaPorColunaAusente('margens') });
    const { result } = await montar();

    await expect(result.current.criar({ nome: 'NOVO', tipo: 'contrato' } as any)).rejects.toThrow();
    expect(guardados('documentos_padroes')).toHaveLength(0);
  });

  it('a recusa não vira linha de auditoria de criação', async () => {
    respostaDeEscrita = () => ({ data: null, error: recusaPorColunaAusente('margens') });
    const { result } = await montar();

    await expect(result.current.criar({ nome: 'NOVO', tipo: 'contrato' } as any)).rejects.toThrow();
    expect(mockRegistrarAuditoria).not.toHaveBeenCalled();
  });

  it('qualquer outra recusa também lança, com o motivo do servidor', async () => {
    respostaDeEscrita = () => ({
      data: null,
      error: { code: '42501', message: 'new row violates row-level security policy' },
    });
    const { result } = await montar();

    await expect(result.current.criar({ nome: 'NOVO', tipo: 'contrato' } as any)).rejects.toThrow(
      /permissão|row-level security/i,
    );
  });
});

describe('editar — a recusa do servidor', () => {
  it('UMA tentativa, com o conteúdo que o operador escreveu', async () => {
    // Na edição o campo em risco é o `conteudo`: um modelo de contrato inteiro, reescrito
    // pelo operador, descartado para a gravação "passar".
    respostaDeEscrita = () => ({ data: null, error: recusaPorColunaAusente('conteudo') });
    bancoLocal.set('documentos_padroes', new Map([['doc-1', documentoSalvo()]]));
    const { result } = await montar();

    await expect(
      result.current.editar('doc-1', { conteudo: '<p>texto novo e longo</p>' } as any),
    ).rejects.toThrow(/conteudo/);

    const updates = chamadas.filter((c) => c.operacao === 'update');
    expect(updates).toHaveLength(1);
    expect(updates[0].payload.conteudo).toBe('<p>texto novo e longo</p>');
  });

  it('a recusa não sobrescreve o documento bom que estava no cache', async () => {
    respostaDeEscrita = () => ({ data: null, error: recusaPorColunaAusente('conteudo') });
    bancoLocal.set('documentos_padroes', new Map([['doc-1', documentoSalvo()]]));
    const { result } = await montar();

    await expect(result.current.editar('doc-1', { conteudo: 'novo' } as any)).rejects.toThrow();
    expect(guardados('documentos_padroes')[0].conteudo).toBe('<p>corpo</p>');
  });
});

// ============================================================================
// O caminho feliz e o offline
// ============================================================================

describe('criar — caminho aceito', () => {
  beforeEach(() => {
    respostaDeEscrita = () => ({ data: documentoSalvo({ id: 'doc-novo', nome: 'NOVO' }), error: null });
  });

  it('grava no cache, audita e recarrega a lista', async () => {
    const { result } = await montar();
    leituraRemota = { data: [documentoSalvo({ id: 'doc-novo', nome: 'NOVO' })], error: null };

    await act(async () => {
      await result.current.criar({ nome: 'NOVO', tipo: 'contrato' } as any);
    });

    expect(guardados('documentos_padroes').map((d) => d.id)).toContain('doc-novo');
    expect(mockRegistrarAuditoria).toHaveBeenCalledWith(
      'Criar Modelo Documento',
      expect.objectContaining({ nome: 'NOVO' }),
    );
  });

  it('aplica os padrões do formulário em vez de mandar indefinido ao Postgres', async () => {
    const { result } = await montar();
    await act(async () => {
      await result.current.criar({ nome: 'NOVO', tipo: 'contrato' } as any);
    });

    const payload = chamadas.find((c) => c.operacao === 'insert')!.payload;
    expect(payload.orientacao).toBe('retrato');
    expect(payload.tamanho_papel).toBe('a4');
    expect(payload.ativo).toBe(true);
    expect(payload.padrao).toBe(false);
    expect(payload.variaveis_disponiveis).toEqual([]);
    expect(payload.conteudo).toBe('');
  });

  it('`padrao: false` e `ativo: false` explícitos são respeitados, não sobrescritos pelo default', async () => {
    // `data.padrao !== undefined ? ... : false` existe exatamente para isso; um `||` aqui
    // transformaria "o operador desmarcou" em "o operador não disse nada".
    const { result } = await montar();
    await act(async () => {
      await result.current.criar({ nome: 'NOVO', tipo: 'contrato', ativo: false, padrao: false } as any);
    });

    const payload = chamadas.find((c) => c.operacao === 'insert')!.payload;
    expect(payload.ativo).toBe(false);
    expect(payload.padrao).toBe(false);
  });

  it('gera id quando o chamador não traz um', async () => {
    const { result } = await montar();
    await act(async () => {
      await result.current.criar({ nome: 'NOVO', tipo: 'contrato' } as any);
    });

    const payload = chamadas.find((c) => c.operacao === 'insert')!.payload;
    expect(payload.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
  });

  it('a empresa do documento vem da seleção, e `empresa_id` explícito ganha dela', async () => {
    const { result } = await montar();
    await act(async () => {
      await result.current.criar({ nome: 'A', tipo: 'contrato' } as any);
      await result.current.criar({ nome: 'B', tipo: 'contrato', empresa_id: 'emp-9' } as any);
    });

    const [a, b] = chamadas.filter((c) => c.operacao === 'insert');
    expect(a.payload.empresa_id).toBe('emp-1');
    expect(a.payload.tenant_id).toBe('emp-1');
    expect(b.payload.empresa_id).toBe('emp-9');
    expect(b.payload.tenant_id).toBe('emp-9');
  });

  it('QUIRK conhecido: sem empresa resolvida, o documento nasce com o literal "emp-001"', async () => {
    // Documentado, **não** corrigido nesta rodada. É a mesma classe de "Nunca invente um
    // `tenant_id`": `'emp-001'` não é empresa nenhuma, então o modelo nasce invisível para
    // todas — o espelho do `'system'` da Ata de Ocorrências. Só o super_admin alcança este
    // estado (para os demais níveis o AppContext força a própria empresa).
    //
    // Recusar a gravação aqui é decisão de produto sobre quem pode criar modelo sem empresa
    // escolhida, não limpeza de código — e o mesmo literal está em `useItensFunerarios`.
    // Este teste existe para que a mudança seja deliberada quando vier, em vez de silenciosa.
    estado.empresaSelecionada = 'all';
    const { result } = await montar();
    await act(async () => {
      await result.current.criar({ nome: 'NOVO', tipo: 'contrato' } as any);
    });

    expect(chamadas.find((c) => c.operacao === 'insert')!.payload.tenant_id).toBe('emp-001');
  });
});

describe('criar — offline', () => {
  it('não toca no Supabase e guarda o documento no cache', async () => {
    estado.isOnline = false;
    const { result } = await montar();
    mockFrom.mockClear();

    await act(async () => {
      await result.current.criar({ nome: 'NOVO', tipo: 'contrato' } as any);
    });

    expect(chamadas.filter((c) => c.operacao === 'insert')).toHaveLength(0);
    expect(guardados('documentos_padroes')).toHaveLength(1);
    expect(guardados('documentos_padroes')[0].nome).toBe('NOVO');
  });

  it('offline não audita — a auditoria do modelo vive do lado do servidor', async () => {
    estado.isOnline = false;
    const { result } = await montar();
    await act(async () => {
      await result.current.criar({ nome: 'NOVO', tipo: 'contrato' } as any);
    });
    expect(mockRegistrarAuditoria).not.toHaveBeenCalled();
  });
});

describe('editar — caminho aceito e offline', () => {
  it('online, mescla a resposta do servidor sobre o que havia no cache', async () => {
    respostaDeEscrita = () => ({
      data: documentoSalvo({ nome: 'RENOMEADO', conteudo: '<p>novo</p>' }),
      error: null,
    });
    bancoLocal.set('documentos_padroes', new Map([['doc-1', documentoSalvo({ tipo: 'contrato' })]]));
    const { result } = await montar();

    let retorno: any;
    await act(async () => {
      retorno = await result.current.editar('doc-1', { nome: 'RENOMEADO' } as any);
    });

    expect(retorno.nome).toBe('RENOMEADO');
    expect(retorno.tipo).toBe('contrato'); // veio do que já estava guardado
    expect(mockRegistrarAuditoria).toHaveBeenCalledWith(
      'Editar Modelo Documento',
      expect.objectContaining({ id: 'doc-1' }),
    );
  });

  it('carimba `atualizado_em` com o instante da edição', async () => {
    respostaDeEscrita = () => ({ data: documentoSalvo(), error: null });
    bancoLocal.set('documentos_padroes', new Map([['doc-1', documentoSalvo()]]));
    const { result } = await montar();

    await act(async () => {
      await result.current.editar('doc-1', { nome: 'X' } as any);
    });

    const update = chamadas.find((c) => c.operacao === 'update')!;
    expect(update.payload.atualizado_em).toBe('2026-09-19T12:00:00.000Z');
  });

  it('offline, mescla sobre o documento local sem perder os campos que não foram tocados', async () => {
    estado.isOnline = false;
    bancoLocal.set('documentos_padroes', new Map([['doc-1', documentoSalvo()]]));
    const { result } = await montar();

    await act(async () => {
      await result.current.editar('doc-1', { nome: 'SO O NOME' } as any);
    });

    const salvo = guardados('documentos_padroes')[0];
    expect(salvo.nome).toBe('SO O NOME');
    expect(salvo.conteudo).toBe('<p>corpo</p>');
    expect(salvo.tipo).toBe('contrato');
  });
});

// ============================================================================
// Leitura e exclusão
// ============================================================================

describe('carregarDocumentos', () => {
  it('online, guarda no cache o que veio do servidor', async () => {
    leituraRemota = { data: [documentoSalvo(), documentoSalvo({ id: 'doc-2', nome: 'ATA' })], error: null };
    const { result } = await montar();

    expect(result.current.documentos.map((d) => d.id)).toEqual(['doc-1', 'doc-2']);
    expect(guardados('documentos_padroes')).toHaveLength(2);
  });

  it('a falha remota cai para o cache local em vez de esvaziar a tela', async () => {
    leituraRemota = { data: null, error: { message: 'timeout' } };
    bancoLocal.set('documentos_padroes', new Map([['doc-1', documentoSalvo()]]));
    const { result } = await montar();

    expect(result.current.documentos.map((d) => d.id)).toEqual(['doc-1']);
  });

  it('offline, filtra por empresa e esconde o excluído', async () => {
    estado.isOnline = false;
    bancoLocal.set(
      'documentos_padroes',
      new Map([
        ['d1', documentoSalvo({ id: 'd1', nome: 'B', empresa_id: 'emp-1' })],
        ['d2', documentoSalvo({ id: 'd2', nome: 'A', empresa_id: 'emp-2', tenant_id: 'emp-2' })],
        ['d3', documentoSalvo({ id: 'd3', nome: 'C', empresa_id: 'emp-1', deleted_at: 'x' })],
      ]),
    );
    const { result } = await montar();

    expect(result.current.documentos.map((d) => d.id)).toEqual(['d1']);
  });

  it('offline, ordena por nome — a lista é escolhida pelo operador lendo', async () => {
    estado.isOnline = false;
    bancoLocal.set(
      'documentos_padroes',
      new Map([
        ['d1', documentoSalvo({ id: 'd1', nome: 'CONTRATO' })],
        ['d2', documentoSalvo({ id: 'd2', nome: 'ATA' })],
      ]),
    );
    const { result } = await montar();

    expect(result.current.documentos.map((d) => d.nome)).toEqual(['ATA', 'CONTRATO']);
  });
});

describe('excluir', () => {
  it('online, marca `deleted_at` em vez de apagar a linha', async () => {
    bancoLocal.set('documentos_padroes', new Map([['doc-1', documentoSalvo()]]));
    const { result } = await montar();

    await act(async () => {
      await result.current.excluir('doc-1');
    });

    const update = chamadas.find((c) => c.operacao === 'update')!;
    expect(update.payload.deleted_at).toBe('2026-09-19T12:00:00.000Z');
    expect(chamadas.some((c) => c.operacao === 'delete')).toBe(false);
  });

  it('tira do cache local e registra auditoria', async () => {
    bancoLocal.set('documentos_padroes', new Map([['doc-1', documentoSalvo()]]));
    const { result } = await montar();

    await act(async () => {
      await result.current.excluir('doc-1');
    });

    expect(guardados('documentos_padroes')).toHaveLength(0);
    expect(mockRegistrarAuditoria).toHaveBeenCalledWith('Excluir Modelo Documento', { id: 'doc-1' });
  });

  it('offline, some do cache sem tentar o servidor', async () => {
    estado.isOnline = false;
    bancoLocal.set('documentos_padroes', new Map([['doc-1', documentoSalvo()]]));
    const { result } = await montar();

    await act(async () => {
      await result.current.excluir('doc-1');
    });

    expect(chamadas).toHaveLength(0);
    expect(guardados('documentos_padroes')).toHaveLength(0);
  });
});
