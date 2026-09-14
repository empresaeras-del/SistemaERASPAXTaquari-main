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

vi.mock('./associadosService', () => ({
  saveAssociado: vi.fn(),
}));

vi.mock('./financeiroService', () => ({
  salvarReceita: vi.fn(),
}));

vi.mock('./planoContabilService', () => ({
  resolverContaLancamento: vi.fn(async () => ({ id: 'conta-1', nome: 'Mensalidades de Planos' })),
}));

import { saveToIDB, getAllFromIDB } from '../lib/idb';
import { addToSyncQueue } from '../lib/syncService';
import { registrarAuditoria } from '../lib/supabase';
import { saveAssociado } from './associadosService';
import { salvarReceita } from './financeiroService';
import { MENSAGEM_TENANT_INDEFINIDO } from '../utils/tenant';
import { MENSAGEM_REATIVACAO_DESNECESSARIA } from '../utils/reativacaoAssociado';
import { reativarAssociadoComNovoContrato, DadosReativacao } from './reativacaoService';
import type { Associado } from './associadosService';

const mockSaveToIDB = vi.mocked(saveToIDB);
const mockGetAllFromIDB = vi.mocked(getAllFromIDB);
const mockAddToSyncQueue = vi.mocked(addToSyncQueue);
const mockSaveAssociado = vi.mocked(saveAssociado);
const mockSalvarReceita = vi.mocked(salvarReceita);
const mockAuditoria = vi.mocked(registrarAuditoria);

const associadoInativo = {
  id: 'assoc-1',
  tenant_id: 'empresa-1',
  nome: 'MARIA DA SILVA',
  cpf: '04653703140',
  status: 'inativo',
  data_adesao: '2020-03-01',
  plano_nome: 'Plano Prata',
  plano_pax_id: 'p-antigo',
  valor_plano: 80,
  numero_contrato: 'CTR-ANTIGO01',
  dependentes: [
    { id: 'd1', nome: 'JOÃO', parentesco: 'FILHO', status: 'inativo' as const },
    { id: 'd2', nome: 'ANA', parentesco: 'FILHA', status: 'inativo' as const },
  ],
} as unknown as Associado;

const dados = (over: Partial<DadosReativacao> = {}): DadosReativacao => ({
  associado: associadoInativo,
  idsDependentesReativados: ['d1'],
  planoId: 'p-novo',
  planoNome: 'Plano Ouro',
  valorPlano: 120,
  taxaAdesao: 0,
  numeroContrato: 'CTR-NOVO1234',
  dataAdesao: '2026-09-14',
  qtdParcelas: 2,
  parcelas: [
    { numero_parcela: 1, descricao: 'Mensalidade 1/2 - Plano Ouro', data_vencimento: '2026-09-10', valor: 120 },
    { numero_parcela: 2, descricao: 'Mensalidade 2/2 - Plano Ouro', data_vencimento: '2026-10-10', valor: 120 },
  ],
  ...over,
});

const contexto = {
  isOnline: false,
  empresaSelecionada: 'empresa-1',
  userTenantId: 'empresa-1',
  userId: 'user-1',
};

beforeEach(() => {
  vi.clearAllMocks();
  mockGetAllFromIDB.mockResolvedValue([] as any);
});

describe('reativarAssociadoComNovoContrato (offline)', () => {
  it('reativa o titular e só os dependentes marcados', async () => {
    const r = await reativarAssociadoComNovoContrato(dados(), contexto);

    expect(r.associado.status).toBe('ativo');
    expect(r.dependentesReativados).toBe(1);
    expect(r.dependentesMantidosInativos).toBe(1);
    expect(r.associado.dependentes.map((d) => d.status)).toEqual(['ativo', 'inativo']);

    const gravado = mockSaveAssociado.mock.calls[0][0];
    expect(gravado.plano_pax_id).toBe('p-novo');
    expect(gravado.numero_contrato).toBe('CTR-NOVO1234');
    expect(gravado.n_vidas).toBe(2);
  });

  it('arquiva o contrato anterior ANTES de criar o novo', async () => {
    // A ordem é a regra: `saveAssociado` procura o contrato ativo para atualizar, e com
    // dois ativos ao mesmo tempo ele mexeria no errado.
    mockGetAllFromIDB.mockImplementation(async (store: string) =>
      (store === 'contratos'
        ? [{ id: 'ctr-antigo', associado_id: 'assoc-1', status: 'ativo' }]
        : []) as any,
    );

    await reativarAssociadoComNovoContrato(dados(), contexto);

    const contratosGravados = mockSaveToIDB.mock.calls
      .filter(([store]) => store === 'contratos')
      .map(([, valor]) => valor as any);

    expect(contratosGravados).toHaveLength(2);
    expect(contratosGravados[0]).toMatchObject({
      id: 'ctr-antigo',
      status: 'inativo',
      data_fim: '2026-09-14',
    });
    expect(contratosGravados[1]).toMatchObject({
      numero_contrato: 'CTR-NOVO1234',
      status: 'ativo',
      plano_pax_id: 'p-novo',
      data_fim: null,
    });
  });

  it('o contrato anterior vai para o histórico, e o novo contrato é outra linha', async () => {
    const r = await reativarAssociadoComNovoContrato(dados(), contexto);
    expect(r.associado.historico_contratos).toHaveLength(1);
    expect(r.associado.historico_contratos?.[0]).toMatchObject({
      plano: 'Plano Prata',
      valor: 80,
      data_inicio: '2020-03-01',
    });
  });

  it('gera receita e parcelas classificadas na conta de mensalidade', async () => {
    const r = await reativarAssociadoComNovoContrato(dados(), contexto);

    const [, receita, parcelas] = mockSalvarReceita.mock.calls[0] as any[];
    expect(receita.conta_contabil_id).toBe('conta-1');
    expect(receita.categoria).toBe('Mensalidades de Planos');
    expect(receita.associado_id).toBe('assoc-1');
    expect(receita.valor_total).toBe(240);
    expect(receita.descricao).toContain('Reativação');
    expect(parcelas).toHaveLength(2);
    expect(parcelas.every((p: any) => p.status === 'pendente')).toBe(true);
    expect(r.parcelasGeradas).toBe(2);
    expect(r.valorTotal).toBe(240);
  });

  it('offline, o contrato novo entra na fila de sync', async () => {
    await reativarAssociadoComNovoContrato(dados(), contexto);
    const enfileirados = mockAddToSyncQueue.mock.calls.map(([t]) => t as any);
    expect(enfileirados.some((t) => t.storeName === 'contratos' && t.data.status === 'ativo')).toBe(
      true,
    );
  });

  it('registra na auditoria o que mudou de contrato', async () => {
    await reativarAssociadoComNovoContrato(dados(), contexto);
    const [acao, detalhes] = mockAuditoria.mock.calls[0] as any[];
    expect(acao).toBe('Reativar Associado com Novo Contrato');
    expect(detalhes).toMatchObject({
      numero_contrato: 'CTR-NOVO1234',
      numero_contrato_anterior: 'CTR-ANTIGO01',
      plano_anterior: 'Plano Prata',
      plano_novo: 'Plano Ouro',
      dependentes_reativados: 1,
      dependentes_mantidos_inativos: 1,
    });
  });

  it('a taxa de adesão vai para o contrato', async () => {
    await reativarAssociadoComNovoContrato(dados({ taxaAdesao: 50 }), contexto);
    const novo = mockSaveToIDB.mock.calls
      .filter(([store]) => store === 'contratos')
      .map(([, v]) => v as any)
      .find((c) => c.status === 'ativo');
    expect(novo.taxa_adesao).toBe(50);
  });
});

describe('as recusas', () => {
  it('recusa reativar quem já está ativo, sem tocar em nada', async () => {
    // A guarda vive aqui e não só no botão escondido: reativar um cadastro ativo
    // arquivaria o contrato vigente para criar outro igual.
    await expect(
      reativarAssociadoComNovoContrato(
        dados({ associado: { ...associadoInativo, status: 'ativo' } as Associado }),
        contexto,
      ),
    ).rejects.toThrow(MENSAGEM_REATIVACAO_DESNECESSARIA);

    expect(mockSaveAssociado).not.toHaveBeenCalled();
    expect(mockSalvarReceita).not.toHaveBeenCalled();
    expect(mockSaveToIDB).not.toHaveBeenCalled();
  });

  it('inadimplente não é reativável — ele nunca saiu de circulação', async () => {
    await expect(
      reativarAssociadoComNovoContrato(
        dados({ associado: { ...associadoInativo, status: 'inadimplente' } as Associado }),
        contexto,
      ),
    ).rejects.toThrow(MENSAGEM_REATIVACAO_DESNECESSARIA);
  });

  it('encerrado é reativável, como inativo', async () => {
    const r = await reativarAssociadoComNovoContrato(
      dados({ associado: { ...associadoInativo, status: 'encerrado' } as Associado }),
      contexto,
    );
    expect(r.associado.status).toBe('ativo');
  });

  it('sem empresa resolvida, recusa em vez de carimbar um tenant', async () => {
    await expect(
      reativarAssociadoComNovoContrato(
        dados({ associado: { ...associadoInativo, tenant_id: '' } as Associado }),
        { ...contexto, empresaSelecionada: 'all', userTenantId: null },
      ),
    ).rejects.toThrow(MENSAGEM_TENANT_INDEFINIDO);

    expect(mockSaveToIDB).not.toHaveBeenCalled();
  });
});
