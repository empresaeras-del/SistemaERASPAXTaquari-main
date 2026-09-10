import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('../lib/idb', () => ({
  getFromIDB: vi.fn(),
  saveToIDB: vi.fn(),
  getAllFromIDB: vi.fn(),
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

import { getFromIDB, saveToIDB, getAllFromIDB } from '../lib/idb';
import { addToSyncQueue, getSyncQueue } from '../lib/syncService';
import {
  sanitizeReceitaForSupabase,
  sanitizeParcelaReceberForSupabase,
  sanitizeParcelaPagarForSupabase,
  sanitizeDespesaForSupabase,
  getParcelasReceber,
  getParcelasPagar,
  getReceitas,
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
const mockGetSyncQueue = vi.mocked(getSyncQueue);

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

  it('recusa a gravação quando não há tenant nem fallback, em vez de carimbar um coringa', () => {
    // Antes o último elo era 'default_tenant', que a RLS lia como "de todas as empresas":
    // a receita era gravada sem erro e nascia visível para todo mundo.
    const semTenant: Receita = { ...baseReceita, tenant_id: '' };
    expect(() => sanitizeReceitaForSupabase(semTenant)).toThrow(/empresa/i);
  });

  it('trata um coringa legado gravado antes da correção como ausência de tenant', () => {
    const legado: Receita = { ...baseReceita, tenant_id: 'empresa_padrao' };
    expect(sanitizeReceitaForSupabase(legado, 'emp-2').tenant_id).toBe('emp-2');
    expect(() => sanitizeReceitaForSupabase(legado)).toThrow(/empresa/i);
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

  it('recusa a gravação quando não há tenant nem fallback, em vez de carimbar um coringa', () => {
    expect(() => sanitizeParcelaPagarForSupabase({ ...baseParcelaPagar, tenant_id: '' })).toThrow(/empresa/i);
  });

  it('mantém tenant_id e empresa_id iguais ao tenant resolvido', () => {
    const out = sanitizeParcelaPagarForSupabase({ ...baseParcelaPagar, tenant_id: '' }, undefined, 'emp-2');
    expect(out.tenant_id).toBe('emp-2');
    expect(out.empresa_id).toBe('emp-2');
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

/**
 * Estas funções são listas de permissão explícitas: campo que não está no objeto devolvido
 * é descartado em silêncio a caminho do Supabase — o usuário vê "salvo com sucesso" e o dado
 * não chega. É a armadilha nº 1 do repositório (ver CLAUDE.md), e é exatamente o risco de
 * acrescentar `conta_contabil_id` só na interface TypeScript. Daí estes testes.
 */
describe('classificação contábil nos sanitizers (fase 2 do plano contábil)', () => {
  const UUID = '123e4567-e89b-12d3-a456-426614174000';

  it('leva conta_contabil_id da receita para o payload do Supabase', () => {
    const out = sanitizeReceitaForSupabase({ ...baseReceita, conta_contabil_id: UUID });
    expect(out.conta_contabil_id).toBe(UUID);
  });

  it('leva conta_contabil_id da despesa para o payload do Supabase', () => {
    const out = sanitizeDespesaForSupabase({ ...baseDespesa, conta_contabil_id: UUID });
    expect(out.conta_contabil_id).toBe(UUID);
  });

  it('lançamento legado (sem conta) vai com null, não com undefined nem string vazia', () => {
    expect(sanitizeReceitaForSupabase(baseReceita).conta_contabil_id).toBeNull();
    expect(sanitizeDespesaForSupabase(baseDespesa).conta_contabil_id).toBeNull();
  });

  it('anula conta_contabil_id que não é UUID, em vez de mandar lixo para a FK', () => {
    const out = sanitizeReceitaForSupabase({ ...baseReceita, conta_contabil_id: 'id-invalido' });
    expect(out.conta_contabil_id).toBeNull();
  });

  it('carimba a natureza correta em cada tabela — é o que a FK composta compara', () => {
    expect(sanitizeReceitaForSupabase(baseReceita).natureza_contabil).toBe('receita');
    expect(sanitizeDespesaForSupabase(baseDespesa).natureza_contabil).toBe('despesa');
  });

  it('ignora natureza_contabil vinda de fora: a constante do sanitizer é que vale', () => {
    // Se um payload adulterado chegasse com a natureza trocada, a FK composta no banco
    // recusaria a gravação. O sanitizer nem deixa chegar lá.
    const adulterada = { ...baseReceita, natureza_contabil: 'despesa' } as unknown as Receita;
    expect(sanitizeReceitaForSupabase(adulterada).natureza_contabil).toBe('receita');
  });

  it('preserva categoria como o rótulo do lançamento, ao lado da conta', () => {
    const out = sanitizeReceitaForSupabase({
      ...baseReceita,
      categoria: 'Mensalidades de Planos',
      conta_contabil_id: UUID,
    });
    expect(out.categoria).toBe('Mensalidades de Planos');
    expect(out.conta_contabil_id).toBe(UUID);
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

  it('não devolve a parcela com o tenant coringa legado "default_tenant"', async () => {
    // p3 tem tenant_id 'default_tenant'. Antes ele passava no filtro de qualquer empresa;
    // agora só quem tem exatamente esse tenant o vê — o mesmo critério que a RLS aplica.
    mockGetAllFromIDB.mockResolvedValue(parcelas);
    const out = await getParcelasReceber(false, 'emp-1');
    expect(out.map(p => p.id).sort()).toEqual(['p1']);
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

  it('não devolve a parcela com o tenant coringa legado "empresa_padrao"', async () => {
    mockGetAllFromIDB.mockResolvedValue(parcelas);
    const out = await getParcelasPagar(false, 'emp-1');
    expect(out.map(p => p.id).sort()).toEqual(['p1']);
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

/**
 * Mesmo risco da fase 2, agora com `centro_custo_id`: o campo entrou na interface `Despesa`
 * e no formulário, e sem estar na lista de permissão do sanitizer seria descartado a caminho
 * do Supabase — a despesa salvaria "com sucesso" sem centro de custo nenhum.
 */
describe('centro de custo no sanitizer (fase 4)', () => {
  const UUID = '123e4567-e89b-12d3-a456-426614174000';

  it('leva centro_custo_id da despesa para o payload do Supabase', () => {
    const out = sanitizeDespesaForSupabase({ ...baseDespesa, centro_custo_id: UUID });
    expect(out.centro_custo_id).toBe(UUID);
  });

  it('despesa sem centro de custo vai com null, não com undefined', () => {
    expect(sanitizeDespesaForSupabase(baseDespesa).centro_custo_id).toBeNull();
  });

  it('anula centro_custo_id que não é UUID, em vez de mandar lixo para a FK', () => {
    const out = sanitizeDespesaForSupabase({ ...baseDespesa, centro_custo_id: 'Administrativo' });
    expect(out.centro_custo_id).toBeNull();
  });

  it('mantém centro_custo como snapshot do nome, ao lado do id', () => {
    const out = sanitizeDespesaForSupabase({
      ...baseDespesa,
      centro_custo: 'Administrativo',
      centro_custo_id: UUID,
    });
    expect(out.centro_custo).toBe('Administrativo');
    expect(out.centro_custo_id).toBe(UUID);
  });
});

/**
 * Caminho ONLINE de `getReceitas` — o que o resto deste arquivo não cobre, e onde o bug de
 * 10/09/2026 vivia: a receita `50be9316` foi excluída pelo app e continuou aparecendo em toda
 * sessão cujo IndexedDB ainda a tinha, porque o merge preservava todo local ausente no remoto.
 */
describe('getReceitas (online) — cache que sobrevive à exclusão em outra sessão', () => {
  const viva = { id: 'viva', tenant_id: 'emp-1', descricao: 'existe no servidor' } as unknown as Receita;
  const fantasma = { id: 'fantasma', tenant_id: 'emp-1', descricao: 'excluida em outra sessao' } as unknown as Receita;

  /** Builder awaitable que imita `supabase.from(...).select(...).or(...)`. */
  const respostaSupabase = (resultado: { data: unknown; error: unknown }) => {
    const builder: Record<string, unknown> = {};
    builder.select = () => builder;
    builder.or = () => builder;
    builder.then = (resolve: (v: unknown) => unknown) => resolve(resultado);
    return builder;
  };

  beforeEach(async () => {
    vi.clearAllMocks();
    mockGetSyncQueue.mockResolvedValue([]);
    const { supabase } = await import('../lib/supabase');
    vi.mocked(supabase.from).mockReturnValue(
      respostaSupabase({ data: [viva], error: null }) as never,
    );
  });

  it('remove da lista a receita que o servidor não tem e que não está na fila de sync', async () => {
    mockGetAllFromIDB.mockResolvedValue([viva, fantasma] as never);
    const receitas = await getReceitas(true, 'emp-1');
    expect(receitas.map((r) => r.id)).toEqual(['viva']);
  });

  it('e limpa o IndexedDB, para o cache se curar sozinho', async () => {
    mockGetAllFromIDB.mockResolvedValue([viva, fantasma] as never);
    await getReceitas(true, 'emp-1');
    const { deleteFromIDB } = await import('../lib/idb');
    expect(vi.mocked(deleteFromIDB)).toHaveBeenCalledWith('receitas', 'fantasma');
    expect(vi.mocked(deleteFromIDB)).not.toHaveBeenCalledWith('receitas', 'viva');
  });

  it('mas PRESERVA o que foi criado offline e ainda está na fila de sync', async () => {
    mockGetAllFromIDB.mockResolvedValue([viva, fantasma] as never);
    mockGetSyncQueue.mockResolvedValue([
      { id: 't1', storeName: 'receitas', action: 'update', data: { id: 'fantasma' }, createdAt: '' },
    ] as never);

    const receitas = await getReceitas(true, 'emp-1');
    expect(receitas.map((r) => r.id).sort()).toEqual(['fantasma', 'viva']);
    const { deleteFromIDB } = await import('../lib/idb');
    expect(vi.mocked(deleteFromIDB)).not.toHaveBeenCalled();
  });

  it('servidor sem nenhuma receita é resposta válida, não falha de rede: o cache é podado', async () => {
    // Antes exigia-se `data.length > 0`, então excluir a última receita da empresa fazia o
    // código tratar o resultado vazio como erro e devolver o cache inteiro.
    const { supabase } = await import('../lib/supabase');
    vi.mocked(supabase.from).mockReturnValue(respostaSupabase({ data: [], error: null }) as never);
    mockGetAllFromIDB.mockResolvedValue([fantasma] as never);

    expect(await getReceitas(true, 'emp-1')).toEqual([]);
  });

  it('erro do Supabase NÃO poda nada — sem resposta confiável, o cache é o que sobra', async () => {
    const { supabase } = await import('../lib/supabase');
    vi.mocked(supabase.from).mockReturnValue(
      respostaSupabase({ data: null, error: { message: 'rede caiu' } }) as never,
    );
    mockGetAllFromIDB.mockResolvedValue([viva, fantasma] as never);

    const receitas = await getReceitas(true, 'emp-1');
    expect(receitas.map((r) => r.id).sort()).toEqual(['fantasma', 'viva']);
    const { deleteFromIDB } = await import('../lib/idb');
    expect(vi.mocked(deleteFromIDB)).not.toHaveBeenCalled();
  });

  it('registro de OUTRA empresa no cache não é podado nem devolvido no filtro final', async () => {
    const deOutra = { id: 'outra', tenant_id: 'emp-2' } as unknown as Receita;
    mockGetAllFromIDB.mockResolvedValue([viva, deOutra] as never);

    const receitas = await getReceitas(true, 'emp-1');
    expect(receitas.map((r) => r.id)).toEqual(['viva']);
    const { deleteFromIDB } = await import('../lib/idb');
    expect(vi.mocked(deleteFromIDB)).not.toHaveBeenCalled();
  });
});
