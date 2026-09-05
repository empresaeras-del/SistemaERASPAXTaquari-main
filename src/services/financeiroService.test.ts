import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('../lib/idb', () => ({
  getFromIDB: vi.fn(),
  saveToIDB: vi.fn(),
  getAllFromIDB: vi.fn(),
  deleteFromIDB: vi.fn(),
}));

vi.mock('../lib/syncService', () => ({
  addToSyncQueue: vi.fn(),
}));

vi.mock('../lib/supabase', () => ({
  supabase: { from: vi.fn() },
  registrarAuditoria: vi.fn(),
}));

import { getFromIDB, saveToIDB, getAllFromIDB } from '../lib/idb';
import { addToSyncQueue } from '../lib/syncService';
import {
  sanitizeReceitaForSupabase,
  sanitizeParcelaReceberForSupabase,
  sanitizeParcelaPagarForSupabase,
  sanitizeDespesaForSupabase,
  getParcelasReceber,
  getParcelasPagar,
  registrarRecebimento,
  registrarPagamento,
  estornarRecebimento,
  estornarPagamento,
  Receita,
  ParcelaReceber,
  ParcelaPagar,
  Despesa,
} from './financeiroService';

const mockGetFromIDB = vi.mocked(getFromIDB);
const mockSaveToIDB = vi.mocked(saveToIDB);
const mockGetAllFromIDB = vi.mocked(getAllFromIDB);
const mockAddToSyncQueue = vi.mocked(addToSyncQueue);

const baseReceita: Receita = {
  id: 'nao-e-um-uuid',
  tenant_id: 'emp-1',
  tipo_devedor: 'associado',
  descricao: 'Mensalidade',
  categoria: 'Plano',
  data_emissao: '2026-09-04T00:00:00.000Z',
  data_inicio_cobranca: '2026-09-04',
  valor_total: 89.9,
  qtd_parcelas: 1,
  forma_pagamento_padrao: 'pix',
  status: 'ativo',
};

describe('sanitizeReceitaForSupabase', () => {
  it('gera um novo UUID quando o id informado não é um UUID válido', () => {
    const out = sanitizeReceitaForSupabase(baseReceita);
    expect(out.id).not.toBe('nao-e-um-uuid');
    expect(out.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
  });

  it('preserva um UUID já válido', () => {
    const comUuid: Receita = { ...baseReceita, id: '123e4567-e89b-12d3-a456-426614174000' };
    const out = sanitizeReceitaForSupabase(comUuid);
    expect(out.id).toBe('123e4567-e89b-12d3-a456-426614174000');
  });

  it('usa o fallback de tenant quando tenant_id é "all" ou vazio', () => {
    const semTenant: Receita = { ...baseReceita, tenant_id: 'all' };
    const out = sanitizeReceitaForSupabase(semTenant, 'emp-2');
    expect(out.tenant_id).toBe('emp-2');
  });

  it('cai para "default_tenant" quando não há tenant nem fallback', () => {
    const semTenant: Receita = { ...baseReceita, tenant_id: '' };
    const out = sanitizeReceitaForSupabase(semTenant);
    expect(out.tenant_id).toBe('default_tenant');
  });

  it('anula associado_id quando não é um UUID válido, em vez de enviar lixo ao Postgres', () => {
    const out = sanitizeReceitaForSupabase({ ...baseReceita, associado_id: 'id-invalido' });
    expect(out.associado_id).toBeNull();
  });

  it('trunca a data de emissão para a parte de data, descartando o horário', () => {
    const out = sanitizeReceitaForSupabase(baseReceita);
    expect(out.data_emissao).toBe('2026-09-04');
  });

  it('coage valor_total e qtd_parcelas para número, com defaults seguros', () => {
    const out = sanitizeReceitaForSupabase({ ...baseReceita, valor_total: NaN, qtd_parcelas: 0 });
    expect(out.valor_total).toBe(0);
    expect(out.qtd_parcelas).toBe(1);
  });
});

const baseParcelaReceber: ParcelaReceber = {
  id: 'nao-e-um-uuid',
  tenant_id: 'emp-1',
  receita_id: 'nao-e-um-uuid',
  numero_parcela: 1,
  valor: 89.9,
  data_vencimento: '2026-09-10',
  status: 'pendente',
};

describe('sanitizeParcelaReceberForSupabase', () => {
  it('gera um novo UUID quando o id informado não é válido', () => {
    const out = sanitizeParcelaReceberForSupabase(baseParcelaReceber);
    expect(out.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
  });

  it('usa o receita_id de fallback quando o informado não é um UUID válido', () => {
    const out = sanitizeParcelaReceberForSupabase(baseParcelaReceber, '123e4567-e89b-12d3-a456-426614174000');
    expect(out.receita_id).toBe('123e4567-e89b-12d3-a456-426614174000');
  });

  it('anula receita_id quando nem o informado nem o fallback são válidos', () => {
    const out = sanitizeParcelaReceberForSupabase(baseParcelaReceber);
    expect(out.receita_id).toBeNull();
  });

  it('parcela pendente: não marca data/valor de pagamento', () => {
    const out = sanitizeParcelaReceberForSupabase(baseParcelaReceber);
    expect(out.data_pagamento).toBeNull();
    expect(out.valor_recebido).toBeNull();
    expect(out.recebido_em).toBeNull();
  });

  it('parcela já paga sem data/valor explícitos: preenche com o valor da parcela e a data atual', () => {
    const out = sanitizeParcelaReceberForSupabase({ ...baseParcelaReceber, status: 'pago' });
    expect(out.valor_recebido).toBe(89.9);
    expect(out.data_pagamento).toBe(new Date().toISOString().split('T')[0]);
    expect(out.recebido_em).not.toBeNull();
  });

  it('prioriza valor_recebido sobre valor_pago quando ambos vêm preenchidos', () => {
    const out = sanitizeParcelaReceberForSupabase({ ...baseParcelaReceber, status: 'recebido', valor_recebido: 100, valor_pago: 50 });
    expect(out.valor_recebido).toBe(100);
  });

  it('usa valor_pago como fallback quando valor_recebido está ausente', () => {
    const out = sanitizeParcelaReceberForSupabase({ ...baseParcelaReceber, status: 'recebido', valor_pago: 75 });
    expect(out.valor_recebido).toBe(75);
  });

  it('trunca a data de vencimento para a parte de data', () => {
    const out = sanitizeParcelaReceberForSupabase({ ...baseParcelaReceber, data_vencimento: '2026-09-10T00:00:00.000Z' });
    expect(out.data_vencimento).toBe('2026-09-10');
  });
});

const baseParcelaPagar: ParcelaPagar = {
  id: 'nao-e-um-uuid',
  tenant_id: 'emp-1',
  despesa_id: 'nao-e-um-uuid',
  numero_parcela: 1,
  valor: 500,
  data_vencimento: '2026-09-10',
  status: 'pendente',
};

describe('sanitizeParcelaPagarForSupabase', () => {
  it('gera um novo UUID quando o id informado não é válido', () => {
    const out = sanitizeParcelaPagarForSupabase(baseParcelaPagar);
    expect(out.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
  });

  it('usa o despesa_id de fallback quando o informado não é válido', () => {
    const out = sanitizeParcelaPagarForSupabase(baseParcelaPagar, '123e4567-e89b-12d3-a456-426614174000');
    expect(out.despesa_id).toBe('123e4567-e89b-12d3-a456-426614174000');
  });

  it('cai para "default_tenant" quando não há tenant nem fallback', () => {
    const out = sanitizeParcelaPagarForSupabase({ ...baseParcelaPagar, tenant_id: '' });
    expect(out.tenant_id).toBe('default_tenant');
  });

  it('trunca data_vencimento e data_pagamento para a parte de data', () => {
    const out = sanitizeParcelaPagarForSupabase({
      ...baseParcelaPagar,
      data_vencimento: '2026-09-10T00:00:00.000Z',
      data_pagamento: '2026-09-15T00:00:00.000Z',
    });
    expect(out.data_vencimento).toBe('2026-09-10');
    expect(out.data_pagamento).toBe('2026-09-15');
  });

  it('mantém valor_pago null quando não informado', () => {
    const out = sanitizeParcelaPagarForSupabase(baseParcelaPagar);
    expect(out.valor_pago).toBeNull();
  });
});

const baseDespesa: Despesa = {
  id: 'nao-e-um-uuid',
  tenant_id: 'emp-1',
  tipo_credor: 'fornecedor',
  descricao: 'Compra de material',
  categoria: 'Insumos',
  data_emissao: '2026-09-04',
  data_inicio_pagamento: '2026-09-10',
  valor_total: 1200,
  qtd_parcelas: 1,
  forma_pagamento_padrao: 'boleto',
  status: 'ativo',
};

describe('sanitizeDespesaForSupabase', () => {
  it('gera um novo UUID quando o id informado não é válido', () => {
    const out = sanitizeDespesaForSupabase(baseDespesa);
    expect(out.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
  });

  it('usa fornecedor_nome como fallback de credor_nome quando credor_nome não é informado', () => {
    const out = sanitizeDespesaForSupabase({ ...baseDespesa, fornecedor_nome: 'Fornecedor X' });
    expect(out.credor_nome).toBe('Fornecedor X');
  });

  it('cai para "Credor" quando nem credor_nome nem fornecedor_nome existem', () => {
    const out = sanitizeDespesaForSupabase(baseDespesa);
    expect(out.credor_nome).toBe('Credor');
  });

  it('anula fornecedor_id quando não é um UUID válido, em vez de enviar lixo ao Postgres', () => {
    const out = sanitizeDespesaForSupabase({ ...baseDespesa, fornecedor_id: 'id-invalido' });
    expect(out.fornecedor_id).toBeNull();
  });

  it('trunca as datas para a parte de data', () => {
    const out = sanitizeDespesaForSupabase({
      ...baseDespesa,
      data_emissao: '2026-09-04T12:00:00.000Z',
      data_inicio_pagamento: '2026-09-10T12:00:00.000Z',
    });
    expect(out.data_emissao).toBe('2026-09-04');
    expect(out.data_inicio_pagamento).toBe('2026-09-10');
  });
});

describe('getParcelasReceber (offline, fallback IDB)', () => {
  beforeEach(() => {
    mockGetAllFromIDB.mockReset();
  });

  const parcelas: ParcelaReceber[] = [
    { ...baseParcelaReceber, id: 'p1', tenant_id: 'emp-1' },
    { ...baseParcelaReceber, id: 'p2', tenant_id: 'emp-2' },
    { ...baseParcelaReceber, id: 'p3', tenant_id: 'default_tenant' },
    { ...baseParcelaReceber, id: 'p4', tenant_id: 'emp-1', deleted_at: '2026-09-01T00:00:00.000Z' },
  ];

  it('quando offline, não consulta o Supabase e usa só o cache local', async () => {
    mockGetAllFromIDB.mockResolvedValue(parcelas);
    await getParcelasReceber(false, 'emp-1');
    expect(mockGetAllFromIDB).toHaveBeenCalledWith('parcelas_receber');
  });

  it('filtra parcelas de outros tenants, mas mantém as do tenant "default_tenant"', async () => {
    mockGetAllFromIDB.mockResolvedValue(parcelas);
    const out = await getParcelasReceber(false, 'emp-1');
    expect(out.map(p => p.id).sort()).toEqual(['p1', 'p3']);
  });

  it('exclui parcelas com deleted_at, mesmo pertencendo ao tenant certo', async () => {
    mockGetAllFromIDB.mockResolvedValue(parcelas);
    const out = await getParcelasReceber(false, 'emp-1');
    expect(out.find(p => p.id === 'p4')).toBeUndefined();
  });

  it('com tenantId "all", não filtra por tenant (só remove as com deleted_at)', async () => {
    mockGetAllFromIDB.mockResolvedValue(parcelas);
    const out = await getParcelasReceber(false, 'all');
    expect(out.map(p => p.id).sort()).toEqual(['p1', 'p2', 'p3']);
  });

  it('retorna lista vazia quando o IDB não tem nada', async () => {
    mockGetAllFromIDB.mockResolvedValue([]);
    const out = await getParcelasReceber(false, 'emp-1');
    expect(out).toEqual([]);
  });
});

describe('getParcelasPagar (offline, fallback IDB)', () => {
  beforeEach(() => {
    mockGetAllFromIDB.mockReset();
  });

  const parcelas: ParcelaPagar[] = [
    { ...baseParcelaPagar, id: 'p1', tenant_id: 'emp-1' },
    { ...baseParcelaPagar, id: 'p2', tenant_id: 'emp-2' },
    { ...baseParcelaPagar, id: 'p3', tenant_id: 'empresa_padrao' },
    { ...baseParcelaPagar, id: 'p4', tenant_id: 'emp-1', deleted_at: '2026-09-01T00:00:00.000Z' },
  ];

  it('quando offline, não consulta o Supabase e usa só o cache local', async () => {
    mockGetAllFromIDB.mockResolvedValue(parcelas);
    await getParcelasPagar(false, 'emp-1');
    expect(mockGetAllFromIDB).toHaveBeenCalledWith('parcelas_pagar');
  });

  it('filtra parcelas de outros tenants, mas mantém as do tenant "empresa_padrao"', async () => {
    mockGetAllFromIDB.mockResolvedValue(parcelas);
    const out = await getParcelasPagar(false, 'emp-1');
    expect(out.map(p => p.id).sort()).toEqual(['p1', 'p3']);
  });

  it('exclui parcelas com deleted_at, mesmo pertencendo ao tenant certo', async () => {
    mockGetAllFromIDB.mockResolvedValue(parcelas);
    const out = await getParcelasPagar(false, 'emp-1');
    expect(out.find(p => p.id === 'p4')).toBeUndefined();
  });

  it('com tenantId "all", não filtra por tenant (só remove as com deleted_at)', async () => {
    mockGetAllFromIDB.mockResolvedValue(parcelas);
    const out = await getParcelasPagar(false, 'all');
    expect(out.map(p => p.id).sort()).toEqual(['p1', 'p2', 'p3']);
  });
});

describe('registrarRecebimento (offline)', () => {
  beforeEach(() => {
    mockGetFromIDB.mockReset();
    mockSaveToIDB.mockReset();
    mockAddToSyncQueue.mockReset();
  });

  it('lança erro quando a parcela não é encontrada no cache local', async () => {
    mockGetFromIDB.mockResolvedValue(null);
    await expect(registrarRecebimento(false, 'p1', {})).rejects.toThrow('Parcela não encontrada');
  });

  it('marca como recebido e usa o valor da própria parcela quando valor_recebido não é informado', async () => {
    mockGetFromIDB.mockResolvedValue({ ...baseParcelaReceber, id: 'p1', valor: 89.9, forma_pagamento: 'pix' });
    await registrarRecebimento(false, 'p1', {});
    const salvo = mockSaveToIDB.mock.calls[0][1] as ParcelaReceber;
    expect(salvo.status).toBe('recebido');
    expect(salvo.valor_recebido).toBe(89.9);
    expect(salvo.forma_pagamento_efetivo).toBe('pix');
  });

  it('usa o valor e a forma de pagamento efetiva informados, quando presentes', async () => {
    mockGetFromIDB.mockResolvedValue({ ...baseParcelaReceber, id: 'p1', valor: 89.9, forma_pagamento: 'pix' });
    await registrarRecebimento(false, 'p1', { valor_recebido: 50, forma_pagamento_efetivo: 'dinheiro' });
    const salvo = mockSaveToIDB.mock.calls[0][1] as ParcelaReceber;
    expect(salvo.valor_recebido).toBe(50);
    expect(salvo.forma_pagamento_efetivo).toBe('dinheiro');
  });

  it('enfileira a atualização para sincronizar depois, em vez de chamar o Supabase, quando offline', async () => {
    mockGetFromIDB.mockResolvedValue({ ...baseParcelaReceber, id: 'p1' });
    await registrarRecebimento(false, 'p1', {});
    expect(mockAddToSyncQueue).toHaveBeenCalledWith(
      expect.objectContaining({ storeName: 'parcelas_receber', action: 'update' })
    );
  });
});

describe('registrarPagamento (offline)', () => {
  beforeEach(() => {
    mockGetFromIDB.mockReset();
    mockSaveToIDB.mockReset();
    mockAddToSyncQueue.mockReset();
  });

  it('lança erro quando a parcela não é encontrada no cache local', async () => {
    mockGetFromIDB.mockResolvedValue(null);
    await expect(registrarPagamento(false, 'p1', {})).rejects.toThrow('Parcela não encontrada');
  });

  it('marca como pago e usa o valor da própria parcela quando valor_pago não é informado', async () => {
    mockGetFromIDB.mockResolvedValue({ ...baseParcelaPagar, id: 'p1', valor: 500, forma_pagamento: 'boleto' });
    await registrarPagamento(false, 'p1', {});
    const salvo = mockSaveToIDB.mock.calls[0][1] as ParcelaPagar;
    expect(salvo.status).toBe('pago');
    expect(salvo.valor_pago).toBe(500);
    expect(salvo.forma_pagamento_efetivo).toBe('boleto');
  });

  it('enfileira a atualização para sincronizar depois, em vez de chamar o Supabase, quando offline', async () => {
    mockGetFromIDB.mockResolvedValue({ ...baseParcelaPagar, id: 'p1' });
    await registrarPagamento(false, 'p1', {});
    expect(mockAddToSyncQueue).toHaveBeenCalledWith(
      expect.objectContaining({ storeName: 'parcelas_pagar', action: 'update' })
    );
  });
});

describe('estornarRecebimento (offline)', () => {
  beforeEach(() => {
    mockGetFromIDB.mockReset();
    mockSaveToIDB.mockReset();
    mockAddToSyncQueue.mockReset();
    vi.setSystemTime(new Date('2026-09-05T12:00:00Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('não lança erro quando a parcela não é encontrada — apenas não faz nada (diferente de registrarRecebimento)', async () => {
    mockGetFromIDB.mockResolvedValue(null);
    await expect(estornarRecebimento(false, 'p1', 'engano')).resolves.toBeUndefined();
    expect(mockSaveToIDB).not.toHaveBeenCalled();
  });

  it('volta para "atrasado" quando o vencimento já passou', async () => {
    mockGetFromIDB.mockResolvedValue({ ...baseParcelaReceber, id: 'p1', status: 'recebido', data_vencimento: '2026-09-01' });
    await estornarRecebimento(false, 'p1', 'engano');
    const salvo = mockSaveToIDB.mock.calls[0][1] as ParcelaReceber;
    expect(salvo.status).toBe('atrasado');
  });

  it('volta para "pendente" quando o vencimento ainda não chegou', async () => {
    mockGetFromIDB.mockResolvedValue({ ...baseParcelaReceber, id: 'p1', status: 'recebido', data_vencimento: '2026-09-10' });
    await estornarRecebimento(false, 'p1', 'engano');
    const salvo = mockSaveToIDB.mock.calls[0][1] as ParcelaReceber;
    expect(salvo.status).toBe('pendente');
  });

  it('limpa os campos de recebimento e registra a observação de estorno', async () => {
    mockGetFromIDB.mockResolvedValue({
      ...baseParcelaReceber, id: 'p1', status: 'recebido', data_vencimento: '2026-09-10', valor_recebido: 89.9,
    });
    await estornarRecebimento(false, 'p1', 'engano no valor');
    const salvo = mockSaveToIDB.mock.calls[0][1] as ParcelaReceber;
    expect(salvo.valor_recebido).toBeNull();
    expect(salvo.data_pagamento).toBeNull();
    expect(salvo.observacao_recebimento).toBe('Estornado: engano no valor');
  });
});

describe('estornarPagamento (offline)', () => {
  beforeEach(() => {
    mockGetFromIDB.mockReset();
    mockSaveToIDB.mockReset();
    mockAddToSyncQueue.mockReset();
    vi.setSystemTime(new Date('2026-09-05T12:00:00Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('não lança erro quando a parcela não é encontrada — apenas não faz nada', async () => {
    mockGetFromIDB.mockResolvedValue(null);
    await expect(estornarPagamento(false, 'p1', 'engano')).resolves.toBeUndefined();
    expect(mockSaveToIDB).not.toHaveBeenCalled();
  });

  it('volta para "atrasado" quando o vencimento já passou', async () => {
    mockGetFromIDB.mockResolvedValue({ ...baseParcelaPagar, id: 'p1', status: 'pago', data_vencimento: '2026-09-01' });
    await estornarPagamento(false, 'p1', 'engano');
    const salvo = mockSaveToIDB.mock.calls[0][1] as ParcelaPagar;
    expect(salvo.status).toBe('atrasado');
  });

  it('volta para "pendente" quando o vencimento ainda não chegou, e limpa os campos de pagamento', async () => {
    mockGetFromIDB.mockResolvedValue({ ...baseParcelaPagar, id: 'p1', status: 'pago', data_vencimento: '2026-09-10', valor_pago: 500 });
    await estornarPagamento(false, 'p1', 'engano');
    const salvo = mockSaveToIDB.mock.calls[0][1] as ParcelaPagar;
    expect(salvo.status).toBe('pendente');
    expect(salvo.valor_pago).toBeNull();
    expect(salvo.observacao_pagamento).toBe('Estornado: engano');
  });
});
