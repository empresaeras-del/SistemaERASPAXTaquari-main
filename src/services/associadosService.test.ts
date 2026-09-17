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
import { getHistoricoImpeditivoAssociado, softDeleteAssociado, saveAssociado, Associado } from './associadosService';

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
