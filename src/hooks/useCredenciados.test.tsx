import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import {
  criarBancoLocal,
  criarSupabaseFalso,
  recusaColunaAusente,
  recusaDuplicado,
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
vi.mock('../lib/syncService', () => ({ addToSyncQueue: vi.fn() }));
vi.mock('../lib/supabase', () => ({
  supabase: { from: vi.fn() },
  registrarAuditoria: vi.fn(),
}));

import { getFromIDB, saveToIDB, getAllFromIDB, deleteFromIDB } from '../lib/idb';
import { addToSyncQueue } from '../lib/syncService';
import { supabase } from '../lib/supabase';
import { useCredenciados } from './useCredenciados';

const idb = {
  getFromIDB: vi.mocked(getFromIDB),
  saveToIDB: vi.mocked(saveToIDB),
  getAllFromIDB: vi.mocked(getAllFromIDB),
  deleteFromIDB: vi.mocked(deleteFromIDB),
};
const mockFila = vi.mocked(addToSyncQueue);
const mockFrom = vi.mocked(supabase.from);

const banco = criarBancoLocal();
const servidor = criarSupabaseFalso();

const credenciado = (over: Registro = {}): Registro => ({
  id: 'cr-1',
  nome_fantasia: 'HOSPITAL SANTA CASA',
  razao_social: 'SANTA CASA LTDA',
  cnpj_cpf: '12.345.678/0001-90',
  tipo: 'hospital',
  status: 'ativo',
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
  mockFila.mockReset();
  mockFrom.mockReset();

  banco.ligar(idb);
  mockFila.mockImplementation((async () => undefined) as any);
  mockFrom.mockImplementation(((t: string) => servidor.from(t)) as any);
  vi.setSystemTime(new Date('2026-09-20T12:00:00Z'));
});

afterEach(() => vi.useRealTimers());

const montar = async () => {
  const utils = renderHook(() => useCredenciados());
  await waitFor(() => expect(utils.result.current.loading).toBe(false));
  return utils;
};

// ============================================================================
// Cadastro
// ============================================================================

describe('criar', () => {
  it('a recusa do servidor lança e não deixa o credenciado no cache', async () => {
    servidor.definirEscrita('credenciados', {
      data: null,
      error: recusaColunaAusente('credenciados', 'tipo'),
    });
    const { result } = await montar();

    await expect(result.current.criar(credenciado({ id: undefined }) as any)).rejects.toThrow(/tipo/);
    expect(banco.guardados('credenciados')).toHaveLength(0);
  });

  it('o `23505` vira a frase que o operador entende, não a do Postgres', async () => {
    // A unicidade do documento é POR EMPRESA desde a migration `20260911135652`; antes disso
    // ela era global e uma empresa bloqueava o cadastro da outra citando um registro que o
    // operador nem podia abrir. A mensagem daqui reflete a regra atual.
    servidor.definirEscrita('credenciados', {
      data: null,
      error: recusaDuplicado('credenciados_tenant_documento_uk'),
    });
    const { result } = await montar();

    await expect(result.current.criar(credenciado({ id: undefined }) as any)).rejects.toThrow(
      /Já existe um credenciado com este CNPJ\/CPF nesta empresa/,
    );
  });

  it('para quem não é super_admin, o tenant do usuário manda sobre o seletor', async () => {
    estado.empresaSelecionada = 'emp-9';
    autenticado.user = { id: 'u1', nivel: 'gerente', tenant_id: 'emp-1' };
    const { result } = await montar();

    await act(async () => {
      await result.current.criar(credenciado({ id: undefined }) as any);
    });

    const insert = servidor.escritasEm('credenciados').find((c) => c.operacao === 'insert')!;
    expect(insert.payload.tenant_id).toBe('emp-1');
    expect(insert.payload.empresa_id).toBe('emp-1');
  });

  it('offline, enfileira para subir depois em vez de perder o cadastro', async () => {
    // Este hook é o único do grupo que usa a fila de sync — os outros só gravam no cache.
    estado.isOnline = false;
    const { result } = await montar();

    await act(async () => {
      await result.current.criar(credenciado({ id: undefined }) as any);
    });

    expect(mockFila).toHaveBeenCalledWith(
      expect.objectContaining({ storeName: 'credenciados', action: 'insert' }),
    );
    expect(banco.guardados('credenciados')).toHaveLength(1);
  });
});

describe('editar', () => {
  it('preserva o tenant do registro, não o do seletor', async () => {
    banco.semear('credenciados', [credenciado({ tenant_id: 'emp-7', empresa_id: 'emp-7' })]);
    const { result } = await montar();

    await act(async () => {
      await result.current.editar('cr-1', { nome_fantasia: 'OUTRO NOME' } as any);
    });

    const update = servidor.escritasEm('credenciados').find((c) => c.operacao === 'update')!;
    expect(update.payload.tenant_id).toBe('emp-7');
  });

  it('a recusa lança e o registro bom continua no cache', async () => {
    banco.semear('credenciados', [credenciado({ nome_fantasia: 'NOME BOM' })]);
    servidor.definirEscrita('credenciados', { data: null, error: recusaDuplicado('x') });
    const { result } = await montar();

    await expect(result.current.editar('cr-1', { nome_fantasia: 'NOVO' } as any)).rejects.toThrow();
    expect(banco.guardado('credenciados', 'cr-1')?.nome_fantasia).toBe('NOME BOM');
  });

  it('offline, enfileira a alteração com o id junto', async () => {
    estado.isOnline = false;
    banco.semear('credenciados', [credenciado()]);
    const { result } = await montar();

    await act(async () => {
      await result.current.editar('cr-1', { nome_fantasia: 'NOVO' } as any);
    });

    expect(mockFila).toHaveBeenCalledWith(
      expect.objectContaining({
        storeName: 'credenciados',
        action: 'update',
        data: expect.objectContaining({ id: 'cr-1' }),
      }),
    );
  });
});

// ============================================================================
// Os valores por procedimento
// ============================================================================

describe('vincularProcedimento', () => {
  it('o preço vai em `valor` e a co-participação em coluna própria', async () => {
    // Até 20/09/2026 o payload mandava `valor_exclusivo` — que NUNCA foi coluna — e por isso
    // levava `PGRST204` em toda gravação. O preço é gravado em `valor`, que é a coluna
    // canônica; criar `valor_exclusivo` ao lado dela reintroduziria o par de colunas
    // duplicadas que a migration `20260915132838` eliminou.
    const { result } = await montar();
    await act(async () => {
      await result.current.vincularProcedimento({
        credenciado_id: 'cr-1',
        procedimento_id: 'pr-1',
        valor_exclusivo: 350,
        valor_coparticipacao: 80,
      } as any);
    });

    const escritas = servidor.escritasEm('credenciados_procedimentos');
    expect(escritas).toHaveLength(1);
    expect(escritas[0].payload.valor).toBe(350);
    expect(escritas[0].payload.valor_coparticipacao).toBe(80);
    expect(escritas[0].payload).not.toHaveProperty('valor_exclusivo');
  });

  it('uma tentativa só: a recusa lança em vez de reenviar sem a co-participação', async () => {
    // O comportamento antigo era a quarta cópia do padrão que o CLAUDE.md classifica — *um
    // retry que muda o dado enviado não é tolerância a falha, é corromper o registro para
    // conseguir gravá-lo*. Ele reenviava sem a co-participação, e ela é justamente o que vira
    // conta a receber quando a guia é emitida: ficava só no IndexedDB de quem digitou, a tela
    // dele mostrava o número e a de todos os outros, vazio.
    let tentativas = 0;
    servidor.definirEscrita('credenciados_procedimentos', () => {
      tentativas += 1;
      return {
        data: null,
        error: recusaColunaAusente('credenciados_procedimentos', 'valor_coparticipacao'),
      };
    });
    const { result } = await montar();

    await expect(
      result.current.vincularProcedimento({
        credenciado_id: 'cr-1',
        procedimento_id: 'pr-1',
        valor_exclusivo: 350,
        valor_coparticipacao: 80,
      } as any),
    ).rejects.toThrow(/valor_coparticipacao/);

    expect(tentativas).toBe(1);
  });

  it('a recusa não deixa cache mentindo nem tarefa na fila', async () => {
    // Recusa não é queda de rede: repetir amanhã com o mesmo payload dá o mesmo resultado,
    // então enfileirar só adiaria a perda — e o cache local afirmaria um vínculo que o
    // servidor não tem.
    servidor.definirEscrita('credenciados_procedimentos', {
      data: null,
      error: recusaColunaAusente('credenciados_procedimentos', 'valor_coparticipacao'),
    });
    const { result } = await montar();

    await expect(
      result.current.vincularProcedimento({
        credenciado_id: 'cr-1',
        procedimento_id: 'pr-1',
        valor_coparticipacao: 80,
      } as any),
    ).rejects.toThrow();

    expect(banco.guardados('credenciados_procedimentos')).toHaveLength(0);
    expect(mockFila).not.toHaveBeenCalled();
  });

  it('sem rede, guarda no cache E enfileira — nunca nenhum dos dois', async () => {
    servidor.derrubarRede('credenciados_procedimentos');
    const { result } = await montar();

    await act(async () => {
      await result.current.vincularProcedimento({
        credenciado_id: 'cr-1',
        procedimento_id: 'pr-1',
        valor_exclusivo: 350,
        valor_coparticipacao: 80,
      } as any);
    });

    expect(banco.guardados('credenciados_procedimentos')).toHaveLength(1);
    expect(mockFila).toHaveBeenCalledWith(
      expect.objectContaining({ storeName: 'credenciados_procedimentos' }),
    );
  });

  it('revincular o mesmo par reaproveita o id, em vez de criar uma segunda linha', async () => {
    banco.semear('credenciados_procedimentos', [
      { id: 'cp-existente', credenciado_id: 'cr-1', procedimento_id: 'pr-1', valor: 100 },
    ]);
    const { result } = await montar();

    await act(async () => {
      await result.current.vincularProcedimento({
        credenciado_id: 'cr-1',
        procedimento_id: 'pr-1',
        valor_exclusivo: 200,
      } as any);
    });

    expect(banco.guardados('credenciados_procedimentos')).toHaveLength(1);
    expect(servidor.escritasEm('credenciados_procedimentos')[0].payload.id).toBe('cp-existente');
  });

  it('sem valor informado, herda o que já estava gravado em vez de zerar', async () => {
    banco.semear('credenciados_procedimentos', [
      {
        id: 'cp-1',
        credenciado_id: 'cr-1',
        procedimento_id: 'pr-1',
        valor: 100,
        valor_coparticipacao: 25,
      },
    ]);
    const { result } = await montar();

    await act(async () => {
      await result.current.vincularProcedimento({
        credenciado_id: 'cr-1',
        procedimento_id: 'pr-1',
      } as any);
    });

    const salvo = banco.guardado('credenciados_procedimentos', 'cp-1')!;
    expect(salvo.valor).toBe(100);
    expect(salvo.valor_coparticipacao).toBe(25);
  });

  it('cache gravado antes da correção ainda entrega o preço, por `valor_exclusivo`', async () => {
    // Linha escrita pelo caminho antigo: ela tem `valor_exclusivo` e `valor` pode estar em 0.
    // Herdar do nome legado é o que impede a revinculação de zerar o preço de quem já usava.
    banco.semear('credenciados_procedimentos', [
      {
        id: 'cp-1',
        credenciado_id: 'cr-1',
        procedimento_id: 'pr-1',
        valor_exclusivo: 180,
        valor_coparticipacao: 40,
      },
    ]);
    const { result } = await montar();

    await act(async () => {
      await result.current.vincularProcedimento({
        credenciado_id: 'cr-1',
        procedimento_id: 'pr-1',
      } as any);
    });

    expect(servidor.escritasEm('credenciados_procedimentos')[0].payload.valor).toBe(180);
  });

  it('offline, guarda o vínculo no cache sem tentar o servidor', async () => {
    estado.isOnline = false;
    const { result } = await montar();

    await act(async () => {
      await result.current.vincularProcedimento({
        credenciado_id: 'cr-1',
        procedimento_id: 'pr-1',
        valor_exclusivo: 90,
      } as any);
    });

    expect(servidor.escritasEm('credenciados_procedimentos')).toHaveLength(0);
    expect(banco.guardados('credenciados_procedimentos')).toHaveLength(1);
    expect(mockFila).toHaveBeenCalled();
  });
});

describe('atualizarValorProcedimento', () => {
  it('traduz `valor_exclusivo` para `valor` e não envia o nome que não é coluna', async () => {
    banco.semear('credenciados_procedimentos', [
      { id: 'cp-1', credenciado_id: 'cr-1', procedimento_id: 'pr-1', valor: 100 },
    ]);
    const { result } = await montar();

    await act(async () => {
      await result.current.atualizarValorProcedimento('cp-1', {
        valor_exclusivo: 260,
        valor_coparticipacao: 35,
      } as any);
    });

    const update = servidor.escritasEm('credenciados_procedimentos')[0];
    expect(update.payload.valor).toBe(260);
    expect(update.payload.valor_coparticipacao).toBe(35);
    expect(update.payload).not.toHaveProperty('valor_exclusivo');
  });

  it('a recusa lança em vez de reenviar só o preço, descartando a co-participação', async () => {
    banco.semear('credenciados_procedimentos', [
      { id: 'cp-1', credenciado_id: 'cr-1', procedimento_id: 'pr-1', valor: 100 },
    ]);
    let tentativas = 0;
    servidor.definirEscrita('credenciados_procedimentos', () => {
      tentativas += 1;
      return {
        data: null,
        error: recusaColunaAusente('credenciados_procedimentos', 'valor_coparticipacao'),
      };
    });
    const { result } = await montar();

    await expect(
      result.current.atualizarValorProcedimento('cp-1', { valor_coparticipacao: 35 } as any),
    ).rejects.toThrow(/valor_coparticipacao/);

    expect(tentativas).toBe(1);
    expect(banco.guardado('credenciados_procedimentos', 'cp-1')?.valor).toBe(100);
  });
});

describe('desvincularProcedimento', () => {
  it('tira do cache local mesmo quando o servidor recusa', async () => {
    // Comportamento atual. Ao contrário do caso do vínculo acima, aqui o desencontro é
    // recuperável — o próximo carregamento traz a linha de volta.
    banco.semear('credenciados_procedimentos', [{ id: 'cp-1', credenciado_id: 'cr-1' }]);
    servidor.definirEscrita('credenciados_procedimentos', {
      data: null,
      error: { code: '42501', message: 'row-level security' },
    });
    const { result } = await montar();

    await act(async () => {
      await result.current.desvincularProcedimento('cp-1');
    });

    expect(banco.guardados('credenciados_procedimentos')).toHaveLength(0);
  });
});
