import { describe, it, expect } from 'vitest';
import {
  TENANTS_LEGADOS_CORINGA,
  TENANT_SEM_FILTRO,
  ehTenantCoringaLegado,
  ehTenantUtilizavel,
  tenantDeEscrita,
  tenantDeRegistroExistente,
} from './tenant';

const EMPRESA_A = '9a137b50-8a9f-4606-afc5-b53ea7ef7c72';
const EMPRESA_B = 'dae4cb75-a81c-4781-a1bc-873d7e8abfdd';

describe('ehTenantCoringaLegado', () => {
  it('reconhece os dois valores que atravessavam a fronteira entre empresas', () => {
    expect(ehTenantCoringaLegado('default_tenant')).toBe(true);
    expect(ehTenantCoringaLegado('empresa_padrao')).toBe(true);
  });

  it('não confunde "default" com "default_tenant"', () => {
    // O super_admin de produção tem tenant_id = 'default', que é um tenant comum:
    // nunca foi coringa e não pode passar a ser tratado como um.
    expect(ehTenantCoringaLegado('default')).toBe(false);
  });

  it('não trata o sentinela de "sem filtro" como coringa de registro', () => {
    expect(ehTenantCoringaLegado(TENANT_SEM_FILTRO)).toBe(false);
  });

  it('ignora espaço em volta', () => {
    expect(ehTenantCoringaLegado('  empresa_padrao  ')).toBe(true);
  });

  it('aceita nulo e vazio sem quebrar', () => {
    expect(ehTenantCoringaLegado(null)).toBe(false);
    expect(ehTenantCoringaLegado(undefined)).toBe(false);
    expect(ehTenantCoringaLegado('')).toBe(false);
  });
});

describe('ehTenantUtilizavel', () => {
  it('aceita um id de empresa real', () => {
    expect(ehTenantUtilizavel(EMPRESA_A)).toBe(true);
    expect(ehTenantUtilizavel('default')).toBe(true);
  });

  it('recusa vazio, "all" e os coringas legados', () => {
    expect(ehTenantUtilizavel('')).toBe(false);
    expect(ehTenantUtilizavel('   ')).toBe(false);
    expect(ehTenantUtilizavel(null)).toBe(false);
    expect(ehTenantUtilizavel(undefined)).toBe(false);
    expect(ehTenantUtilizavel(TENANT_SEM_FILTRO)).toBe(false);
    for (const coringa of TENANTS_LEGADOS_CORINGA) {
      expect(ehTenantUtilizavel(coringa)).toBe(false);
    }
  });
});

describe('tenantDeEscrita', () => {
  it('usa a empresa selecionada na tela quando existe', () => {
    expect(tenantDeEscrita(EMPRESA_A, EMPRESA_B)).toBe(EMPRESA_A);
  });

  it('cai para a empresa do usuário quando nada está selecionado', () => {
    expect(tenantDeEscrita(null, EMPRESA_B)).toBe(EMPRESA_B);
    expect(tenantDeEscrita('', EMPRESA_B)).toBe(EMPRESA_B);
  });

  it('cai para a empresa do usuário quando a tela está em "todas as empresas"', () => {
    expect(tenantDeEscrita(TENANT_SEM_FILTRO, EMPRESA_B)).toBe(EMPRESA_B);
  });

  it('devolve null em vez de carimbar um coringa quando não há empresa nenhuma', () => {
    // É este o caso que criava o registro visível por todas as empresas.
    expect(tenantDeEscrita(null, null)).toBeNull();
    expect(tenantDeEscrita(TENANT_SEM_FILTRO, null)).toBeNull();
    expect(tenantDeEscrita(undefined, undefined)).toBeNull();
  });

  it('nunca devolve um coringa legado, mesmo se ele vier nas duas pontas', () => {
    expect(tenantDeEscrita('empresa_padrao', 'default_tenant')).toBeNull();
  });

  it('apara espaço do valor devolvido', () => {
    expect(tenantDeEscrita(`  ${EMPRESA_A}  `, null)).toBe(EMPRESA_A);
  });
});

describe('tenantDeRegistroExistente', () => {
  it('mantém o tenant do próprio registro', () => {
    expect(tenantDeRegistroExistente(EMPRESA_A, EMPRESA_B, EMPRESA_B)).toBe(EMPRESA_A);
  });

  it('descarta coringa legado gravado antes da correção e resolve de novo', () => {
    expect(tenantDeRegistroExistente('empresa_padrao', EMPRESA_B, null)).toBe(EMPRESA_B);
    expect(tenantDeRegistroExistente('default_tenant', null, EMPRESA_A)).toBe(EMPRESA_A);
  });

  it('devolve null quando o registro é legado e não há empresa para resolver', () => {
    expect(tenantDeRegistroExistente('empresa_padrao', null, null)).toBeNull();
  });
});
