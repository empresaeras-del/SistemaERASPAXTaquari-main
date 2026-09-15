import { describe, it, expect } from 'vitest';
import {
  escopoDaAuditoria,
  tenantDoEscopo,
  rotuloDoEscopo,
  MENSAGEM_ESCOPO_INDEFINIDO,
} from './escopoAuditoria';

const EMPRESA_A = '9a137b50-8a9f-4606-afc5-b53ea7ef7c72';
const EMPRESA_B = 'dae4cb75-a81c-4781-a1bc-873d7e8abfdd';

describe('escopoDaAuditoria', () => {
  describe('super_admin', () => {
    it('sem empresa escolhida, vê tudo', () => {
      expect(escopoDaAuditoria({ nivel: 'super_admin', tenant_id: 'default' }, 'all'))
        .toEqual({ tipo: 'global' });
    });

    it('vê tudo também quando a seleção vem vazia ou nula', () => {
      expect(escopoDaAuditoria({ nivel: 'super_admin' }, '')).toEqual({ tipo: 'global' });
      expect(escopoDaAuditoria({ nivel: 'super_admin' }, null)).toEqual({ tipo: 'global' });
      expect(escopoDaAuditoria({ nivel: 'super_admin' }, undefined)).toEqual({ tipo: 'global' });
    });

    it('o tenant do PRÓPRIO super_admin não vira filtro — ele não é uma empresa', () => {
      // O super_admin tem tenant_id 'default' em produção. Se a função caísse nele,
      // a visão global viraria "os logs de uma empresa que não existe" — zero linhas.
      expect(escopoDaAuditoria({ nivel: 'super_admin', tenant_id: 'default' }))
        .toEqual({ tipo: 'global' });
    });

    it('a empresa escolhida estreita a visão, quando ele escolhe uma', () => {
      expect(escopoDaAuditoria({ nivel: 'super_admin', tenant_id: 'default' }, EMPRESA_B))
        .toEqual({ tipo: 'empresa', tenantId: EMPRESA_B });
    });

    it('não aceita coringa legado como empresa escolhida', () => {
      expect(escopoDaAuditoria({ nivel: 'super_admin' }, 'empresa_padrao'))
        .toEqual({ tipo: 'global' });
      expect(escopoDaAuditoria({ nivel: 'super_admin' }, 'default_tenant'))
        .toEqual({ tipo: 'global' });
    });
  });

  describe('admin e demais níveis', () => {
    it('vê a própria empresa inteira', () => {
      expect(escopoDaAuditoria({ nivel: 'admin', tenant_id: EMPRESA_A }, EMPRESA_A))
        .toEqual({ tipo: 'empresa', tenantId: EMPRESA_A });
    });

    it('NÃO é alargado pelo seletor: escolher "all" não lhe dá visão global', () => {
      expect(escopoDaAuditoria({ nivel: 'admin', tenant_id: EMPRESA_A }, 'all'))
        .toEqual({ tipo: 'empresa', tenantId: EMPRESA_A });
    });

    it('NÃO é desviado pelo seletor: escolher outra empresa não troca a dele', () => {
      expect(escopoDaAuditoria({ nivel: 'admin', tenant_id: EMPRESA_A }, EMPRESA_B))
        .toEqual({ tipo: 'empresa', tenantId: EMPRESA_A });
    });

    it('gerente e funcionário seguem a mesma regra do admin', () => {
      for (const nivel of ['gerente', 'funcionario']) {
        expect(escopoDaAuditoria({ nivel, tenant_id: EMPRESA_A }, 'all'))
          .toEqual({ tipo: 'empresa', tenantId: EMPRESA_A });
      }
    });

    it('sem empresa resolvida, recusa em vez de cair em "all"', () => {
      const escopo = escopoDaAuditoria({ nivel: 'admin', tenant_id: null }, 'all');
      expect(escopo).toEqual({ tipo: 'indefinido', motivo: MENSAGEM_ESCOPO_INDEFINIDO });
    });

    it('coringa legado no usuário não vale como empresa', () => {
      expect(escopoDaAuditoria({ nivel: 'admin', tenant_id: 'empresa_padrao' }, 'all').tipo)
        .toBe('indefinido');
    });

    it('usuário ausente é escopo indefinido, não global', () => {
      expect(escopoDaAuditoria(null, 'all').tipo).toBe('indefinido');
      expect(escopoDaAuditoria(undefined, EMPRESA_A).tipo).toBe('indefinido');
    });
  });
});

describe('tenantDoEscopo', () => {
  it('traduz global para o sentinela de "sem filtro" dos services', () => {
    expect(tenantDoEscopo({ tipo: 'global' })).toBe('all');
  });

  it('devolve a empresa quando há uma', () => {
    expect(tenantDoEscopo({ tipo: 'empresa', tenantId: EMPRESA_A })).toBe(EMPRESA_A);
  });

  it('devolve null no indefinido — nunca "all"', () => {
    // Cair em 'all' aqui seria dar visão global a quem não conseguiu provar a empresa:
    // o erro exatamente oposto ao pretendido.
    expect(tenantDoEscopo({ tipo: 'indefinido', motivo: 'x' })).toBeNull();
  });
});

describe('rotuloDoEscopo', () => {
  it('nomeia os três estados', () => {
    expect(rotuloDoEscopo({ tipo: 'global' })).toBe('VISÃO GLOBAL');
    expect(rotuloDoEscopo({ tipo: 'empresa', tenantId: EMPRESA_A })).toBe('EMPRESA');
    expect(rotuloDoEscopo({ tipo: 'indefinido', motivo: 'x' })).toBe('SEM ESCOPO');
  });
});
