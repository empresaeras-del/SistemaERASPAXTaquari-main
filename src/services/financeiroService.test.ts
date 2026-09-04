import { describe, it, expect } from 'vitest';
import { sanitizeReceitaForSupabase, Receita } from './financeiroService';

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
