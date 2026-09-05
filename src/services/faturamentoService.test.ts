import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../lib/idb', () => ({
  getFromIDB: vi.fn(),
  saveToIDB: vi.fn(),
  getAllFromIDB: vi.fn(),
  deleteFromIDB: vi.fn(),
}));

import { getAllFromIDB } from '../lib/idb';
import { gerarCodigoRemessa, getRemessas } from './faturamentoService';
import { RemessaFaturamento } from '../types/faturamento';

const mockGetAllFromIDB = vi.mocked(getAllFromIDB);

describe('gerarCodigoRemessa', () => {
  it('gera o código no formato REM-AAAAMM-NNN, com o mês/ano de hoje', () => {
    const hoje = new Date();
    const yyyy = hoje.getFullYear();
    const mm = String(hoje.getMonth() + 1).padStart(2, '0');
    expect(gerarCodigoRemessa(7)).toBe(`REM-${yyyy}${mm}-007`);
  });

  it('usa 1 como índice padrão quando nenhum é informado', () => {
    expect(gerarCodigoRemessa()).toMatch(/-001$/);
  });

  it('preenche o índice com zeros à esquerda até 3 dígitos', () => {
    expect(gerarCodigoRemessa(42)).toMatch(/-042$/);
    expect(gerarCodigoRemessa(123)).toMatch(/-123$/);
  });
});

const baseRemessa: RemessaFaturamento = {
  id: 'rm1',
  tenant_id: 'emp-1',
  codigo_remessa: 'REM-202609-001',
  tipo_prestador: 'credenciado',
  credenciado_nome: 'Credenciado X',
  data_criacao: '2026-09-01T00:00:00.000Z',
  requisicao_ids: [],
  qtd_guias: 1,
  valor_bruto: 100,
  valor_desconto_glosa: 0,
  valor_liquido: 100,
  status: 'em_aberto',
};

describe('getRemessas (offline, fallback IDB)', () => {
  beforeEach(() => {
    mockGetAllFromIDB.mockReset();
  });

  const remessas: RemessaFaturamento[] = [
    { ...baseRemessa, id: 'rm1', tenant_id: 'emp-1', data_criacao: '2026-09-01T00:00:00.000Z' },
    { ...baseRemessa, id: 'rm2', tenant_id: 'emp-2', data_criacao: '2026-09-03T00:00:00.000Z' },
    { ...baseRemessa, id: 'rm3', tenant_id: 'empresa_padrao', data_criacao: '2026-09-02T00:00:00.000Z' },
    { ...baseRemessa, id: 'rm4', tenant_id: 'emp-1', data_criacao: '2026-09-04T00:00:00.000Z', deleted_at: '2026-09-04T00:00:00.000Z' } as RemessaFaturamento,
  ];

  it('quando offline, não consulta o Supabase e usa só o cache local', async () => {
    mockGetAllFromIDB.mockResolvedValue(remessas);
    await getRemessas(false, 'emp-1');
    expect(mockGetAllFromIDB).toHaveBeenCalledWith('remessas_faturamento');
  });

  it('filtra remessas de outros tenants, mas mantém as do tenant "empresa_padrao"', async () => {
    mockGetAllFromIDB.mockResolvedValue(remessas);
    const out = await getRemessas(false, 'emp-1');
    expect(out.map(r => r.id).sort()).toEqual(['rm1', 'rm3']);
  });

  it('exclui remessas com deleted_at, mesmo pertencendo ao tenant certo', async () => {
    mockGetAllFromIDB.mockResolvedValue(remessas);
    const out = await getRemessas(false, 'emp-1');
    expect(out.find(r => r.id === 'rm4')).toBeUndefined();
  });

  it('ordena por data_criacao decrescente (mais recente primeiro)', async () => {
    mockGetAllFromIDB.mockResolvedValue(remessas);
    const out = await getRemessas(false, 'all');
    expect(out.map(r => r.id)).toEqual(['rm2', 'rm3', 'rm1']);
  });

  it('com tenantId "all", não filtra por tenant (só remove as com deleted_at)', async () => {
    mockGetAllFromIDB.mockResolvedValue(remessas);
    const out = await getRemessas(false, 'all');
    expect(out.map(r => r.id).sort()).toEqual(['rm1', 'rm2', 'rm3']);
  });
});
