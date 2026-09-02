import { describe, expect, it } from 'vitest';
import { calcularValorPlano } from './planosPaxCalculo';
import { PlanoPaxCompleto } from '../types/planosPax';

const planoIndividual = (overrides: Partial<PlanoPaxCompleto> = {}): PlanoPaxCompleto => ({
  id: 'plano-1',
  codigo: 'IND-01',
  nome: 'Plano Individual',
  tipo_plano: 'individual',
  idade_minima: 0,
  valor_mensalidade: 100,
  taxa_adesao: 0,
  carencia_geral_dias: 30,
  carencia_acidente_dias: 0,
  carencia_morte_natural_dias: 90,
  regra_calculo: 'por_vida',
  minimo_vidas_calculo: 2,
  ativo: true,
  created_at: '2026-01-01T00:00:00.000Z',
  updated_at: '2026-01-01T00:00:00.000Z',
  coberturas: [],
  faixas: [],
  ...overrides,
});

const planoColetivo = (overrides: Partial<PlanoPaxCompleto> = {}): PlanoPaxCompleto => ({
  ...planoIndividual({ tipo_plano: 'coletivo', valor_mensalidade: 500, minimo_vidas_calculo: 1 }),
  ...overrides,
});

describe('calcularValorPlano', () => {
  it('retorna valores zerados quando não há plano', () => {
    expect(calcularValorPlano(undefined)).toEqual({ base: 0, por_vida: 0, total: 0, descricao: '' });
  });

  describe('plano individual', () => {
    it('cobra o mínimo de vidas quando o total informado é menor que o mínimo', () => {
      const plano = planoIndividual({ valor_mensalidade: 150, minimo_vidas_calculo: 3 });

      const resultado = calcularValorPlano(plano, 1);

      expect(resultado.base).toBe(450); // 3 vidas x 150, não 1 x 150
      expect(resultado.total).toBe(450);
      expect(resultado.por_vida).toBe(150);
      expect(resultado.descricao).toContain('Mínimo de 3 vidas');
    });

    it('cobra o mínimo de vidas quando o total é exatamente igual ao mínimo', () => {
      const plano = planoIndividual({ valor_mensalidade: 100, minimo_vidas_calculo: 2 });

      const resultado = calcularValorPlano(plano, 2);

      expect(resultado.base).toBe(200);
      expect(resultado.descricao).toContain('Mínimo de 2 vidas');
    });

    it('cobra por vida real quando o total excede o mínimo', () => {
      const plano = planoIndividual({ valor_mensalidade: 100, minimo_vidas_calculo: 2 });

      const resultado = calcularValorPlano(plano, 5);

      expect(resultado.base).toBe(500);
      expect(resultado.descricao).not.toContain('Mínimo');
    });

    it('usa 1 como mínimo de vidas quando minimo_vidas_calculo não é definido', () => {
      const plano = planoIndividual({ valor_mensalidade: 80, minimo_vidas_calculo: undefined });

      const resultado = calcularValorPlano(plano, undefined);

      expect(resultado.base).toBe(80);
      expect(resultado.descricao).toContain('Mínimo de 1 vidas');
    });
  });

  describe('plano coletivo', () => {
    it('usa o valor de mensalidade como base, sem valor extra', () => {
      const plano = planoColetivo({ valor_mensalidade: 500 });

      const resultado = calcularValorPlano(plano, 10);

      expect(resultado.base).toBe(500);
      expect(resultado.total).toBe(500);
      expect(resultado.por_vida).toBe(0);
      expect(resultado.descricao).toBe('Valor Base Coletivo');
    });

    it('soma o valor extra à base quando informado', () => {
      const plano = planoColetivo({ valor_mensalidade: 500 });

      const resultado = calcularValorPlano(plano, 10, [], 150);

      expect(resultado.base).toBe(650);
      expect(resultado.descricao).toContain('Valor Extra (R$ 150)');
    });

    it('ignora valor extra igual a zero na descrição', () => {
      const plano = planoColetivo({ valor_mensalidade: 500 });

      const resultado = calcularValorPlano(plano, 10, [], 0);

      expect(resultado.base).toBe(500);
      expect(resultado.descricao).toBe('Valor Base Coletivo');
    });
  });

  describe('adicional por faixa etária de dependentes', () => {
    const faixas = [
      { id: 'f1', plano_id: 'plano-1', idade_de: 0, idade_ate: 17, valor: 20 },
      { id: 'f2', plano_id: 'plano-1', idade_de: 18, idade_ate: 59, valor: 40 },
      { id: 'f3', plano_id: 'plano-1', idade_de: 60, idade_ate: 120, valor: 60 },
    ];

    it('soma o valor da faixa correspondente a cada dependente', () => {
      const plano = planoIndividual({ valor_mensalidade: 100, minimo_vidas_calculo: 1, faixas });

      const resultado = calcularValorPlano(plano, 1, [10, 30, 65]);

      expect(resultado.base).toBe(100);
      expect(resultado.total).toBe(220); // 100 + 20 + 40 + 60
      expect(resultado.descricao).toContain('Adicional Dependentes (R$ 120)');
    });

    it('não soma nada quando a idade não se encaixa em nenhuma faixa', () => {
      const faixasParciais = [{ id: 'f1', plano_id: 'plano-1', idade_de: 0, idade_ate: 17, valor: 20 }];
      const plano = planoIndividual({ valor_mensalidade: 100, minimo_vidas_calculo: 1, faixas: faixasParciais });

      const resultado = calcularValorPlano(plano, 1, [40]);

      expect(resultado.total).toBe(100);
      expect(resultado.descricao).not.toContain('Adicional Dependentes');
    });

    it('não soma nada quando o plano não tem faixas cadastradas', () => {
      const plano = planoIndividual({ valor_mensalidade: 100, minimo_vidas_calculo: 1, faixas: [] });

      const resultado = calcularValorPlano(plano, 1, [10, 20]);

      expect(resultado.total).toBe(100);
      expect(resultado.descricao).not.toContain('Adicional Dependentes');
    });

    it('usa os limites de idade como inclusivos', () => {
      const plano = planoIndividual({ valor_mensalidade: 100, minimo_vidas_calculo: 1, faixas });

      // 17 e 18 caem em faixas diferentes (borda de cada faixa)
      const resultado = calcularValorPlano(plano, 1, [17, 18]);

      expect(resultado.total).toBe(100 + 20 + 40);
    });
  });
});
