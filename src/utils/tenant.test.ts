import { describe, it, expect } from 'vitest';
import {
  TENANTS_LEGADOS_CORINGA,
  TENANT_DO_SUPER_ADMIN,
  TENANT_SEM_FILTRO,
  ehTenantCoringaLegado,
  ehTenantUtilizavel,
  registroPertenceAoTenant,
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
    // `'default'` nunca foi coringa de RLS: ele não VAZAVA o registro para todas as empresas,
    // ele o ESCONDIA de todas. São defeitos opostos, e a distinção continua valendo — por
    // isso ele não entrou nesta lista, e sim em `TENANT_DO_SUPER_ADMIN`. O que mudou é que
    // `ehTenantUtilizavel` passou a recusá-lo também; ver o bloco no fim deste arquivo.
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
    expect(ehTenantUtilizavel(EMPRESA_B)).toBe(true);
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

// ============================================================================
// `'default'` — o tenant do super_admin, que não é empresa nenhuma
// ============================================================================

describe('o tenant do super_admin não pode virar tenant de registro', () => {
  /**
   * Achado pelo teste de fluxo do Playwright em 21/09/2026, e medido em produção antes de
   * corrigir: o super_admin tem `tenant_id = 'default'`, e já havia **13 linhas de
   * `auditoria`** e **12 de `notificacoes`** gravadas com esse valor.
   *
   * O caminho era `tenantDeEscrita('all', 'default')`: `'all'` não é utilizável (é o
   * sentinela de "sem filtro"), então a resolução caía no tenant do usuário — e `'default'`
   * passava, porque não estava em `TENANTS_LEGADOS_CORINGA`.
   *
   * É a mesma classe do `'system'` da Ata de Ocorrências, na variante que **esconde**:
   * `has_tenant_access('default')` é falso para todo admin, então o registro nasce invisível
   * para todas as empresas. O lote de caixa aberto assim não aparece no caixa de ninguém.
   */
  it('`ehTenantUtilizavel` recusa o tenant do super_admin', () => {
    expect(ehTenantUtilizavel(TENANT_DO_SUPER_ADMIN)).toBe(false);
    expect(ehTenantUtilizavel('default')).toBe(false);
    expect(ehTenantUtilizavel(' default ')).toBe(false);
  });

  it('super_admin sem empresa escolhida NÃO resolve tenant de escrita', () => {
    // O estado real: o seletor do topo nasce em `'all'` para o super_admin.
    expect(tenantDeEscrita('all', 'default')).toBeNull();
    expect(tenantDeEscrita(null, 'default')).toBeNull();
    expect(tenantDeEscrita('', 'default')).toBeNull();
  });

  it('com a empresa escolhida, o super_admin grava normalmente', () => {
    // A correção recusa o estado indefinido, não o super_admin: escolher a empresa no topo
    // resolve, e é o caminho que ele já usa hoje.
    expect(tenantDeEscrita('empresa-1', 'default')).toBe('empresa-1');
  });

  it('não confunde `default` com um tenant real que começa igual', () => {
    // A comparação é por valor inteiro, não por prefixo: uma empresa chamada `default-sul`
    // é uma empresa de verdade e continua gravável.
    expect(ehTenantUtilizavel('default-sul')).toBe(true);
    expect(tenantDeEscrita('default-sul', 'default')).toBe('default-sul');
  });

  it('registro legado com tenant `default` não é reaproveitado na escrita', () => {
    // As 13 linhas de auditoria e 12 de notificações que existem em produção: ao editar um
    // registro desses, o tenant dele não pode ser copiado adiante — cai na resolução normal.
    expect(tenantDeRegistroExistente('default', 'all', 'default')).toBeNull();
    expect(tenantDeRegistroExistente('default', 'empresa-1', 'default')).toBe('empresa-1');
  });

  it('como FILTRO de leitura, `default` passa a significar "sem filtro"', () => {
    // Efeito colateral medido e aceito: nenhum chamador de `registroPertenceAoTenant` passa
    // `'default'` — todos recebem o valor do seletor de empresa, que só oferece `'all'` e
    // uuids. E com a correção `tenantDeEscrita` devolve `null` para o super_admin, não
    // `'default'`, então esse valor deixa de aparecer como filtro por qualquer caminho.
    expect(registroPertenceAoTenant('empresa-1', 'default')).toBe(true);
  });

  it('`system` continua utilizável — é outra decisão, com semântica própria', () => {
    // O marcador de último caso da auditoria (351 linhas em produção) é gravado de propósito
    // e documentado no `COMMENT` da coluna. Mexer nele muda o que a Ata de Ocorrências
    // mostra, e isso é decisão de produto, não parte desta correção.
    expect(ehTenantUtilizavel('system')).toBe(true);
  });
});
