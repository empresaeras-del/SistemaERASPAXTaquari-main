import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../lib/idb', () => ({
  getFromIDB: vi.fn(),
  saveToIDB: vi.fn(),
  getAllFromIDB: vi.fn(async () => []),
  deleteFromIDB: vi.fn(),
}));

vi.mock('../lib/syncService', () => ({
  addToSyncQueue: vi.fn(),
  getSyncQueue: vi.fn(async () => []),
}));

vi.mock('../lib/supabase', () => ({
  supabase: { from: vi.fn() },
  registrarAuditoria: vi.fn(),
}));

vi.mock('./financeiroService', () => ({
  cancelarParcelasEmAbertoDoAssociado: vi.fn(async () => 0),
}));

import { getFromIDB, getAllFromIDB, deleteFromIDB } from '../lib/idb';
import { supabase } from '../lib/supabase';
import { addToSyncQueue } from '../lib/syncService';
import {
  getHistoricoImpeditivoAssociado,
  softDeleteAssociado,
  saveAssociado,
  upsertOuFalhar,
  RecusaDoServidor,
  Associado,
} from './associadosService';

const mockSupabase = vi.mocked(supabase, true) as any;

const mockGetFromIDB = vi.mocked(getFromIDB);
const mockGetAllFromIDB = vi.mocked(getAllFromIDB);

const associado = {
  id: 'assoc-1',
  nome: 'MARIA DA SILVA',
  dependentes: [{ id: 'dep-1', nome: 'JOÃO', parentesco: 'FILHO' }],
} as unknown as Associado;

/** `getAllFromIDB` é chamado por store; responde conforme o nome pedido. */
const idbCom = (stores: Record<string, any[]>) => {
  mockGetAllFromIDB.mockImplementation(async (store: string) => (stores[store] || []) as any);
};

beforeEach(() => {
  vi.clearAllMocks();
  mockGetAllFromIDB.mockResolvedValue([] as any);
});

describe('getHistoricoImpeditivoAssociado (offline, pelo cache)', () => {
  it('acha parcela recebida através da receita do associado', () => {
    idbCom({
      receitas: [{ id: 'rec-1', associado_id: 'assoc-1' }],
      parcelas_receber: [
        { id: 'p1', receita_id: 'rec-1', status: 'recebido', numero_parcela: 3, descricao: 'Plano A', valor: 80 },
      ],
    });

    return getHistoricoImpeditivoAssociado(associado, false).then((h) => {
      expect(h.impede).toBe(true);
      expect(h.grupos[0].titulo).toBe('Parcelas recebidas');
      expect(h.grupos[0].registros[0].titulo).toContain('Parcela 3');
    });
  });

  it('parcela pendente não impede — ela não é dinheiro que entrou', async () => {
    idbCom({
      receitas: [{ id: 'rec-1', associado_id: 'assoc-1' }],
      parcelas_receber: [{ id: 'p1', receita_id: 'rec-1', status: 'pendente', valor: 80 }],
    });
    const h = await getHistoricoImpeditivoAssociado(associado, false);
    expect(h.impede).toBe(false);
  });

  it('atendimento do DEPENDENTE também impede', async () => {
    // É o caso que uma checagem só por associado_id deixaria passar.
    idbCom({
      atendimentos: [{ id: 'atd-1', dependente_id: 'dep-1', falecido_nome: 'JOÃO', data_obito: '2026-09-02' }],
    });
    const h = await getHistoricoImpeditivoAssociado(associado, false);
    expect(h.impede).toBe(true);
    expect(h.grupos[0].titulo).toBe('Atendimentos funerários');
    expect(h.grupos[0].registros[0].titulo).toBe('JOÃO');
  });

  it('parcela recebida de OUTRO associado não impede', async () => {
    idbCom({
      receitas: [{ id: 'rec-9', associado_id: 'outro' }],
      parcelas_receber: [{ id: 'p9', receita_id: 'rec-9', status: 'recebido', valor: 80 }],
    });
    const h = await getHistoricoImpeditivoAssociado(associado, false);
    expect(h.impede).toBe(false);
  });

  it('sem histórico nenhum, não impede', async () => {
    const h = await getHistoricoImpeditivoAssociado(associado, false);
    expect(h.impede).toBe(false);
  });
});

describe('softDeleteAssociado', () => {
  it('recusa quando há histórico, e não apaga nada', async () => {
    mockGetFromIDB.mockResolvedValue(associado as any);
    idbCom({
      receitas: [{ id: 'rec-1', associado_id: 'assoc-1' }],
      parcelas_receber: [{ id: 'p1', receita_id: 'rec-1', status: 'recebido', valor: 80 }],
    });

    await expect(softDeleteAssociado('assoc-1', false)).rejects.toThrow(/não pode ser excluído/);
    // A cascata começa apagando o próprio associado do IndexedDB: se ela tivesse rodado,
    // não haveria volta.
    expect(vi.mocked(deleteFromIDB)).not.toHaveBeenCalled();
  });

  it('sem histórico, a exclusão segue', async () => {
    mockGetFromIDB.mockResolvedValue(associado as any);
    await expect(softDeleteAssociado('assoc-1', false)).resolves.toBeUndefined();
    expect(vi.mocked(deleteFromIDB)).toHaveBeenCalledWith('associados', 'assoc-1');
  });
});

describe('saveAssociado: o vínculo com a empresa conveniada chega ao Postgres', () => {
  /**
   * Até 17/09/2026 `fornecedor_id` era desestruturado para fora do payload em `saveAssociado`: o
   * operador escolhia a empresa do associado PJ, a tela dizia "salvo com sucesso" e o vínculo não
   * existia em lugar nenhum. O teste não pergunta se o upsert foi chamado — pergunta COM O QUÊ.
   */
  const capturarUpsertDeAssociados = () => {
    const upserts: Array<Record<string, any>> = [];
    mockSupabase.from.mockImplementation((tabela: string) => {
      if (tabela === 'associados') {
        return {
          upsert: vi.fn(async (payload: Record<string, any>) => {
            upserts.push(payload);
            return { data: null, error: null };
          }),
        } as any;
      }
      // As demais tabelas tocadas no caminho (dependentes, contratos) respondem vazio.
      const encadeavel: any = {
        select: () => encadeavel,
        upsert: async () => ({ data: null, error: null }),
        insert: async () => ({ data: null, error: null }),
        update: () => encadeavel,
        delete: () => encadeavel,
        eq: () => encadeavel,
        is: () => encadeavel,
        in: async () => ({ data: null, error: null }),
        order: () => encadeavel,
        limit: async () => ({ data: [], error: null }),
        maybeSingle: async () => ({ data: null, error: null }),
        then: (resolve: any) => resolve({ data: [], error: null }),
      };
      return encadeavel;
    });
    return upserts;
  };

  const associadoPJ = {
    id: '11111111-1111-4111-8111-111111111111',
    tenant_id: 'empresa-1',
    nome: 'CONSTRUTORA XYZ',
    tipo_pessoa: 'PJ',
    fornecedor_id: '67ca71da-630f-4d84-8140-a327839d5719',
    dependentes: [],
  } as unknown as Associado;

  it('manda fornecedor_id no payload do associado PJ', async () => {
    const upserts = capturarUpsertDeAssociados();
    await saveAssociado(associadoPJ, true);

    expect(upserts).toHaveLength(1);
    expect(upserts[0]).toHaveProperty('fornecedor_id', '67ca71da-630f-4d84-8140-a327839d5719');
    expect(upserts[0].tipo_pessoa).toBe('PJ');
  });

  it('manda null quando o cadastro deixou de ser PJ, em vez de omitir a chave', async () => {
    const upserts = capturarUpsertDeAssociados();
    await saveAssociado({ ...associadoPJ, tipo_pessoa: 'PF' } as Associado, true);

    // A chave precisa EXISTIR com null: omiti-la deixaria o vínculo antigo intacto no banco.
    expect(upserts[0]).toHaveProperty('fornecedor_id');
    expect(upserts[0].fornecedor_id).toBeNull();
  });

  it('manda null quando o PJ ficou sem empresa escolhida (string vazia)', async () => {
    const upserts = capturarUpsertDeAssociados();
    await saveAssociado({ ...associadoPJ, fornecedor_id: '' } as Associado, true);

    // '' numa coluna uuid é 22P02 e derrubaria o insert inteiro.
    expect(upserts[0].fornecedor_id).toBeNull();
  });
});

describe('upsertOuFalhar: a recusa do Postgres sobe, o payload não muda', () => {
  /**
   * `resilientSupabaseUpsert` tentava até 8 vezes e mudava o payload a cada tentativa até o
   * banco aceitar — removia a coluna que o PGRST204 apontava, anulava o `plano_pax_id` na
   * violação de FK e removia o `empresa_id`. As três gravavam um registro diferente do que o
   * operador preencheu, com a tela dizendo "sucesso".
   */
  const recusar = (error: Record<string, any>) => {
    const chamadas: Array<Record<string, any>> = [];
    mockSupabase.from.mockImplementation(() => ({
      upsert: vi.fn(async (payload: Record<string, any>) => {
        chamadas.push(payload);
        return { data: null, error };
      }),
    }) as any);
    return chamadas;
  };

  it('tenta UMA vez e não reenvia com o payload encurtado', async () => {
    const chamadas = recusar({ code: 'PGRST204', message: "Could not find the 'campo_novo' column of 'associados'" });

    await expect(upsertOuFalhar('associados', { id: 'a1', campo_novo: 'x' })).rejects.toThrow();

    // A função antiga faria 2 chamadas aqui: a segunda sem `campo_novo`.
    expect(chamadas).toHaveLength(1);
    expect(chamadas[0]).toHaveProperty('campo_novo', 'x');
  });

  it('PGRST204 nomeia a coluna e diz que falta a migration', async () => {
    recusar({ code: 'PGRST204', message: "Could not find the 'observacoes_extra' column of 'associados'" });

    await expect(upsertOuFalhar('associados', { id: 'a1' })).rejects.toThrow(/observacoes_extra/);
    await expect(upsertOuFalhar('associados', { id: 'a1' })).rejects.toThrow(/migration/i);
  });

  it('FK violada NÃO vira plano_pax_id nulo — ela lança', async () => {
    const chamadas = recusar({
      code: '23503',
      message: 'insert or update on table "associados" violates foreign key constraint "associados_plano_pax_id_fkey"',
    });

    await expect(
      upsertOuFalhar('associados', { id: 'a1', plano_pax_id: 'plano-que-nao-existe' }),
    ).rejects.toThrow(/referência/i);

    // O coração da correção: uma chamada só, e o plano continua no payload.
    expect(chamadas).toHaveLength(1);
    expect(chamadas[0].plano_pax_id).toBe('plano-que-nao-existe');
  });

  it('o erro lançado é RecusaDoServidor — é o que separa recusa de queda de rede', async () => {
    recusar({ code: '23502', message: 'null value in column "nome" violates not-null constraint' });
    await expect(upsertOuFalhar('associados', { id: 'a1' })).rejects.toBeInstanceOf(RecusaDoServidor);
  });

  it('sucesso devolve o dado e não lança', async () => {
    mockSupabase.from.mockImplementation(() => ({
      upsert: vi.fn(async () => ({ data: [{ id: 'a1' }], error: null })),
    }) as any);
    await expect(upsertOuFalhar('associados', { id: 'a1' })).resolves.toEqual([{ id: 'a1' }]);
  });
});

describe('saveAssociado: recusa e queda de rede não terminam igual', () => {
  const associado = {
    id: '22222222-2222-4222-8222-222222222222',
    tenant_id: 'empresa-1',
    nome: 'FULANO',
    plano_pax_id: '33333333-3333-4333-8333-333333333333',
    dependentes: [],
  } as unknown as Associado;

  /** Todas as tabelas respondem; `falha` decide o que a tabela nomeada devolve ou lança. */
  const montarSupabase = (falha: { tabela: string; error?: any; excecao?: any }) => {
    mockSupabase.from.mockImplementation((tabela: string) => {
      const encadeavel: any = {
        select: () => encadeavel,
        upsert: async (payload: Record<string, any>) => {
          if (tabela === falha.tabela) {
            if (falha.excecao) throw falha.excecao;
            return { data: null, error: falha.error };
          }
          return { data: [payload], error: null };
        },
        insert: async () => ({ data: null, error: null }),
        update: () => encadeavel,
        delete: () => encadeavel,
        eq: () => encadeavel,
        is: () => encadeavel,
        in: async () => ({ data: null, error: null }),
        order: () => encadeavel,
        limit: async () => ({ data: [], error: null }),
        // O plano existe no servidor, então a pré-sincronização não roda.
        maybeSingle: async () => ({ data: { id: associado.plano_pax_id }, error: null }),
        then: (resolve: any) => resolve({ data: [], error: null }),
      };
      return encadeavel;
    });
  };

  it('recusa do servidor NÃO vai para a fila de sync', async () => {
    montarSupabase({
      tabela: 'associados',
      error: { code: '23503', message: 'violates foreign key constraint' },
    });

    await expect(saveAssociado(associado, true)).rejects.toBeInstanceOf(RecusaDoServidor);

    // Enfileirar uma recusa só adia a perda: o payload seria o mesmo e o banco recusaria de
    // novo, para sempre. Antes desta correção ela era enfileirada DUAS vezes.
    expect(vi.mocked(addToSyncQueue)).not.toHaveBeenCalled();
  });

  it('queda de rede VAI para a fila de sync', async () => {
    montarSupabase({ tabela: 'associados', excecao: new TypeError('Failed to fetch') });

    await expect(saveAssociado(associado, true)).rejects.toThrow('Failed to fetch');
    expect(vi.mocked(addToSyncQueue)).toHaveBeenCalledTimes(1);
  });

  it('dependente recusado propaga em vez de virar console.warn', async () => {
    montarSupabase({
      tabela: 'dependentes',
      error: { code: '23502', message: 'null value in column "nome"' },
    });

    // Antes: o catch só avisava no console, a tela dizia "sucesso" e o dependente não existia.
    await expect(
      saveAssociado(
        { ...associado, dependentes: [{ id: 'd1', nome: 'FILHO', parentesco: 'FILHO' }] } as unknown as Associado,
        true,
      ),
    ).rejects.toBeInstanceOf(RecusaDoServidor);
  });

  it('contrato recusado propaga', async () => {
    montarSupabase({
      tabela: 'contratos',
      error: { code: '23514', message: 'violates check constraint' },
    });

    await expect(saveAssociado(associado, true)).rejects.toBeInstanceOf(RecusaDoServidor);
  });
});
