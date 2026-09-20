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
// Os valores por procedimento — onde o dado do operador some hoje
// ============================================================================

describe('vincularProcedimento', () => {
  it('manda ao servidor os valores exclusivo e de co-participação', async () => {
    const { result } = await montar();
    await act(async () => {
      await result.current.vincularProcedimento({
        credenciado_id: 'cr-1',
        procedimento_id: 'pr-1',
        valor_exclusivo: 350,
        valor_coparticipacao: 80,
      } as any);
    });

    const upsert = servidor.escritasEm('credenciados_procedimentos')[0];
    expect(upsert.payload.valor_exclusivo).toBe(350);
    expect(upsert.payload.valor_coparticipacao).toBe(80);
  });

  it('`valor` é o exclusivo — é ele que a tabela do banco guarda', async () => {
    const { result } = await montar();
    await act(async () => {
      await result.current.vincularProcedimento({
        credenciado_id: 'cr-1',
        procedimento_id: 'pr-1',
        valor_exclusivo: 350,
        valor_coparticipacao: 80,
      } as any);
    });

    expect(servidor.escritasEm('credenciados_procedimentos')[0].payload.valor).toBe(350);
  });

  it('DEFEITO ATIVO: recusado por coluna ausente, ele REENVIA sem a co-participação', async () => {
    // Este não é um risco adormecido — está acontecendo em produção agora.
    //
    // `credenciados_procedimentos` tem exatamente sete colunas, e **nenhuma delas é
    // `valor_exclusivo` ou `valor_coparticipacao`** (conferido no banco: id, credenciado_id,
    // procedimento_id, valor, created_at, tenant_id, empresa_id). Então o primeiro upsert
    // falha SEMPRE com `PGRST204`, o fallback abaixo sempre roda, e a co-participação que o
    // operador digitou em `ProcedimentosCredenciado.tsx` **nunca chega ao servidor**.
    //
    // O cache local guarda o valor, então a tela de quem digitou mostra o número certo e a de
    // todos os outros mostra vazio — e é a co-participação que vira conta a receber quando a
    // guia é emitida.
    //
    // É a quarta cópia do padrão que o CLAUDE.md classifica: *um retry que muda o dado
    // enviado não é tolerância a falha, é corromper o registro para conseguir gravá-lo.*
    // Travado aqui com o comportamento atual para que a correção seja deliberada — ela exige
    // migration (a coluna que falta), não só mexer no hook.
    let tentativas = 0;
    servidor.definirEscrita('credenciados_procedimentos', (payload) => {
      tentativas += 1;
      return 'valor_coparticipacao' in payload
        ? { data: null, error: recusaColunaAusente('credenciados_procedimentos', 'valor_coparticipacao') }
        : { data: payload, error: null };
    });
    const { result } = await montar();

    await act(async () => {
      await result.current.vincularProcedimento({
        credenciado_id: 'cr-1',
        procedimento_id: 'pr-1',
        valor_exclusivo: 350,
        valor_coparticipacao: 80,
      } as any);
    });

    expect(tentativas).toBe(2);
    const segunda = servidor.escritasEm('credenciados_procedimentos')[1];
    expect(segunda.payload).not.toHaveProperty('valor_coparticipacao');
    expect(segunda.payload.valor).toBe(350);

    // E o cache local fica com o valor que o servidor não tem — a tela mente para quem digitou.
    expect(banco.guardados('credenciados_procedimentos')[0].valor_coparticipacao).toBe(80);
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
        valor_exclusivo: 100,
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
    expect(salvo.valor_exclusivo).toBe(100);
    expect(salvo.valor_coparticipacao).toBe(25);
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
