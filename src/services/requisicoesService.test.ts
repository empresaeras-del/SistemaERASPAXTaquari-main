import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../lib/idb', () => ({
  getFromIDB: vi.fn(),
  saveToIDB: vi.fn(),
  getAllFromIDB: vi.fn(),
  deleteFromIDB: vi.fn(),
}));

import { getAllFromIDB } from '../lib/idb';
import { gerarCodigoRequisicao, getRequisicoes } from './requisicoesService';
import { Requisicao } from '../types/requisicoes';

const mockGetAllFromIDB = vi.mocked(getAllFromIDB);

describe('gerarCodigoRequisicao', () => {
  it('gera o código no formato REQ-AAAAMMDD-NNN, com a data de hoje', () => {
    const hoje = new Date();
    const yyyy = hoje.getFullYear();
    const mm = String(hoje.getMonth() + 1).padStart(2, '0');
    const dd = String(hoje.getDate()).padStart(2, '0');
    expect(gerarCodigoRequisicao(7)).toBe(`REQ-${yyyy}${mm}${dd}-007`);
  });

  it('usa 1 como índice padrão quando nenhum é informado', () => {
    expect(gerarCodigoRequisicao()).toMatch(/-001$/);
  });

  it('preenche o índice com zeros à esquerda até 3 dígitos', () => {
    expect(gerarCodigoRequisicao(42)).toMatch(/-042$/);
    expect(gerarCodigoRequisicao(123)).toMatch(/-123$/);
  });
});

const baseRequisicao: Requisicao = {
  id: 'r1',
  tenant_id: 'emp-1',
  codigo_requisicao: 'REQ-20260905-001',
  data_emissao: '2026-09-01T00:00:00.000Z',
  associado_id: 'a1',
  associado_nome: 'Fulano',
  paciente_tipo: 'titular',
  paciente_nome: 'Fulano',
  tipo_prestador: 'credenciado',
  credenciado_nome: 'Credenciado X',
  itens: [],
  valor_total: 100,
  status: 'emitida',
};

describe('getRequisicoes (offline, fallback IDB)', () => {
  beforeEach(() => {
    mockGetAllFromIDB.mockReset();
  });

  const requisicoes: Requisicao[] = [
    { ...baseRequisicao, id: 'r1', tenant_id: 'emp-1', data_emissao: '2026-09-01T00:00:00.000Z' },
    { ...baseRequisicao, id: 'r2', tenant_id: 'emp-2', data_emissao: '2026-09-03T00:00:00.000Z' },
    { ...baseRequisicao, id: 'r3', tenant_id: 'default_tenant', data_emissao: '2026-09-02T00:00:00.000Z' },
    { ...baseRequisicao, id: 'r4', tenant_id: 'emp-1', data_emissao: '2026-09-04T00:00:00.000Z', deleted_at: '2026-09-04T00:00:00.000Z' } as Requisicao,
  ];

  it('quando offline, não consulta o Supabase e usa só o cache local', async () => {
    mockGetAllFromIDB.mockResolvedValue(requisicoes);
    await getRequisicoes(false, 'emp-1');
    expect(mockGetAllFromIDB).toHaveBeenCalledWith('requisicoes');
  });

  it('filtra requisições de outros tenants, mas mantém as do tenant "default_tenant"', async () => {
    mockGetAllFromIDB.mockResolvedValue(requisicoes);
    const out = await getRequisicoes(false, 'emp-1');
    expect(out.map(r => r.id).sort()).toEqual(['r1', 'r3']);
  });

  it('exclui requisições com deleted_at, mesmo pertencendo ao tenant certo', async () => {
    mockGetAllFromIDB.mockResolvedValue(requisicoes);
    const out = await getRequisicoes(false, 'emp-1');
    expect(out.find(r => r.id === 'r4')).toBeUndefined();
  });

  it('ordena por data_emissao decrescente (mais recente primeiro)', async () => {
    mockGetAllFromIDB.mockResolvedValue(requisicoes);
    const out = await getRequisicoes(false, 'all');
    expect(out.map(r => r.id)).toEqual(['r2', 'r3', 'r1']);
  });

  it('com tenantId "all", não filtra por tenant (só remove as com deleted_at)', async () => {
    mockGetAllFromIDB.mockResolvedValue(requisicoes);
    const out = await getRequisicoes(false, 'all');
    expect(out.map(r => r.id).sort()).toEqual(['r1', 'r2', 'r3']);
  });
});
