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
import { getHistoricoImpeditivoAssociado, softDeleteAssociado, Associado } from './associadosService';

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
