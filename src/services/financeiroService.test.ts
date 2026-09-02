import { describe, expect, it } from 'vitest';
import {
  Despesa,
  ParcelaPagar,
  ParcelaReceber,
  Receita,
  sanitizeDespesaForSupabase,
  sanitizeParcelaPagarForSupabase,
  sanitizeParcelaReceberForSupabase,
  sanitizeReceitaForSupabase,
} from './financeiroService';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const VALID_UUID = '123e4567-e89b-42d3-a456-426614174000';

const baseReceita = (overrides: Partial<Receita> = {}): Receita => ({
  id: VALID_UUID,
  tenant_id: 'empresa-1',
  tipo_devedor: 'associado',
  descricao: 'Mensalidade Plano Família',
  categoria: 'Mensalidade',
  data_emissao: '2026-09-01T00:00:00.000Z',
  data_inicio_cobranca: '2026-09-05T00:00:00.000Z',
  valor_total: 199.9,
  qtd_parcelas: 1,
  forma_pagamento_padrao: 'pix',
  status: 'ativo',
  ...overrides,
});

const baseParcelaReceber = (overrides: Partial<ParcelaReceber> = {}): ParcelaReceber => ({
  id: VALID_UUID,
  tenant_id: 'empresa-1',
  receita_id: VALID_UUID,
  numero_parcela: 1,
  valor: 199.9,
  data_vencimento: '2026-09-10T00:00:00.000Z',
  status: 'pendente',
  ...overrides,
});

const baseDespesa = (overrides: Partial<Despesa> = {}): Despesa => ({
  id: VALID_UUID,
  tenant_id: 'empresa-1',
  tipo_credor: 'fornecedor_pj',
  descricao: 'Repasse credenciado',
  categoria: 'Rede Assistencial',
  data_emissao: '2026-09-01T00:00:00.000Z',
  data_inicio_pagamento: '2026-09-10T00:00:00.000Z',
  valor_total: 1200,
  qtd_parcelas: 1,
  forma_pagamento_padrao: 'pix',
  status: 'ativo',
  ...overrides,
});

const baseParcelaPagar = (overrides: Partial<ParcelaPagar> = {}): ParcelaPagar => ({
  id: VALID_UUID,
  tenant_id: 'empresa-1',
  despesa_id: VALID_UUID,
  numero_parcela: 1,
  valor: 1200,
  data_vencimento: '2026-09-10T00:00:00.000Z',
  status: 'pendente',
  ...overrides,
});

describe('sanitizeReceitaForSupabase', () => {
  it('preserva um id UUID válido', () => {
    const result = sanitizeReceitaForSupabase(baseReceita({ id: VALID_UUID }));
    expect(result.id).toBe(VALID_UUID);
  });

  it('gera um novo UUID quando o id informado não é um UUID válido', () => {
    const result = sanitizeReceitaForSupabase(baseReceita({ id: 'nao-e-um-uuid' }));
    expect(result.id).toMatch(UUID_REGEX);
    expect(result.id).not.toBe('nao-e-um-uuid');
  });

  it('nunca perde ou zera o valor_total, mesmo com string numérica', () => {
    const result = sanitizeReceitaForSupabase(baseReceita({ valor_total: '350.50' as unknown as number }));
    expect(result.valor_total).toBe(350.5);
  });

  it('usa 0 quando valor_total não é um número válido', () => {
    const result = sanitizeReceitaForSupabase(baseReceita({ valor_total: 'abc' as unknown as number }));
    expect(result.valor_total).toBe(0);
  });

  it('usa o tenant_id do registro quando válido', () => {
    const result = sanitizeReceitaForSupabase(baseReceita({ tenant_id: 'empresa-taquari' }));
    expect(result.tenant_id).toBe('empresa-taquari');
    expect(result.empresa_id).toBe('empresa-taquari');
  });

  it('cai para o fallbackTenantId quando tenant_id é "all" ou vazio', () => {
    const result = sanitizeReceitaForSupabase(baseReceita({ tenant_id: 'all' }), 'empresa-fallback');
    expect(result.tenant_id).toBe('empresa-fallback');
  });

  it('cai para "default_tenant" quando não há tenant_id nem fallback', () => {
    const result = sanitizeReceitaForSupabase(baseReceita({ tenant_id: '' }));
    expect(result.tenant_id).toBe('default_tenant');
  });

  it('normaliza a data de emissão para apenas a parte da data (YYYY-MM-DD)', () => {
    const result = sanitizeReceitaForSupabase(baseReceita({ data_emissao: '2026-09-01T14:32:00.000Z' }));
    expect(result.data_emissao).toBe('2026-09-01');
  });

  it('descarta um associado_id que não seja um UUID válido', () => {
    const result = sanitizeReceitaForSupabase(baseReceita({ associado_id: 'id-invalido' }));
    expect(result.associado_id).toBeNull();
  });
});

describe('sanitizeParcelaReceberForSupabase', () => {
  it('preserva o valor da parcela', () => {
    const result = sanitizeParcelaReceberForSupabase(baseParcelaReceber({ valor: 249.9 }));
    expect(result.valor).toBe(249.9);
  });

  it('marca valor_recebido igual ao valor quando status é "pago" sem valor_pago informado', () => {
    const result = sanitizeParcelaReceberForSupabase(baseParcelaReceber({ status: 'pago', valor: 199.9 }));
    expect(result.valor_recebido).toBe(199.9);
    expect(result.valor_pago).toBe(199.9);
    expect(result.recebido_em).not.toBeNull();
  });

  it('não define valor_recebido quando a parcela ainda está pendente', () => {
    const result = sanitizeParcelaReceberForSupabase(baseParcelaReceber({ status: 'pendente' }));
    expect(result.valor_recebido).toBeNull();
    expect(result.recebido_em).toBeNull();
  });

  it('prioriza valor_recebido explícito sobre valor_pago e sobre o valor da parcela', () => {
    const result = sanitizeParcelaReceberForSupabase(
      baseParcelaReceber({ status: 'recebido', valor: 100, valor_pago: 90, valor_recebido: 80 })
    );
    expect(result.valor_recebido).toBe(80);
  });

  it('usa o fallbackReceitaId quando receita_id não é um UUID válido', () => {
    const result = sanitizeParcelaReceberForSupabase(
      baseParcelaReceber({ receita_id: 'invalido' }),
      VALID_UUID
    );
    expect(result.receita_id).toBe(VALID_UUID);
  });

  it('define receita_id como null quando nem o valor nem o fallback são UUIDs válidos', () => {
    const result = sanitizeParcelaReceberForSupabase(baseParcelaReceber({ receita_id: 'invalido' }));
    expect(result.receita_id).toBeNull();
  });
});

describe('sanitizeDespesaForSupabase', () => {
  it('preserva o valor_total da despesa', () => {
    const result = sanitizeDespesaForSupabase(baseDespesa({ valor_total: 3450.75 }));
    expect(result.valor_total).toBe(3450.75);
  });

  it('usa credor_nome quando informado, senão cai para fornecedor_nome', () => {
    const result = sanitizeDespesaForSupabase(
      baseDespesa({ credor_nome: undefined, fornecedor_nome: 'Fornecedor Padrão' })
    );
    expect(result.credor_nome).toBe('Fornecedor Padrão');
  });

  it('usa "default_tenant" quando tenant_id não é informado', () => {
    const result = sanitizeDespesaForSupabase(baseDespesa({ tenant_id: '' }));
    expect(result.tenant_id).toBe('default_tenant');
    expect(result.empresa_id).toBe('default_tenant');
  });
});

describe('sanitizeParcelaPagarForSupabase', () => {
  it('preserva o valor da parcela a pagar', () => {
    const result = sanitizeParcelaPagarForSupabase(baseParcelaPagar({ valor: 1200 }));
    expect(result.valor).toBe(1200);
  });

  it('usa o fallbackDespesaId quando despesa_id não é um UUID válido', () => {
    const result = sanitizeParcelaPagarForSupabase(
      baseParcelaPagar({ despesa_id: 'invalido' }),
      VALID_UUID
    );
    expect(result.despesa_id).toBe(VALID_UUID);
  });

  it('mantém valor_pago como null quando não informado', () => {
    const result = sanitizeParcelaPagarForSupabase(baseParcelaPagar({ valor_pago: undefined }));
    expect(result.valor_pago).toBeNull();
  });
});
