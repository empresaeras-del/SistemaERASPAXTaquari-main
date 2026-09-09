import { describe, it, expect } from 'vitest';
import { exerciciosExistentes, proximoExercicioLivre, exercicioValido } from './exerciciosContabeis';
import type { PlanoContabil } from '../types/planoContabil';

const plano = (exercicio: number): PlanoContabil => ({
  id: `p${exercicio}`,
  tenant_id: 't1',
  codigo: 'PADRAO',
  nome: `Plano ${exercicio}`,
  exercicio,
  vigencia_inicio: `${exercicio}-01-01`,
  ativo: true,
});

describe('exerciciosExistentes', () => {
  it('lista os anos em ordem, sem repetir', () => {
    expect(exerciciosExistentes([plano(2027), plano(2026), plano(2027)])).toEqual([2026, 2027]);
  });

  it('ignora entrada sem exercício em vez de quebrar', () => {
    const sujo = [plano(2026), { id: 'x', tenant_id: 't1' } as PlanoContabil];
    expect(exerciciosExistentes(sujo)).toEqual([2026]);
  });

  it('lista vazia devolve vazio', () => {
    expect(exerciciosExistentes([])).toEqual([]);
  });
});

describe('proximoExercicioLivre', () => {
  it('com plano só do ano corrente, sugere o ano seguinte — o caso do bug', () => {
    // A versão anterior não oferecia nada aqui, porque exigia plano.exercicio < ano atual.
    expect(proximoExercicioLivre([plano(2026)], 2026)).toBe(2027);
  });

  it('pula os anos que já têm plano', () => {
    expect(proximoExercicioLivre([plano(2026), plano(2027)], 2026)).toBe(2028);
    expect(proximoExercicioLivre([plano(2026), plano(2027), plano(2028)], 2026)).toBe(2029);
  });

  it('não sugere um ano já ocupado mesmo quando a base é anterior a ele', () => {
    expect(proximoExercicioLivre([plano(2026), plano(2027)], 2025)).toBe(2028);
  });

  it('sem plano nenhum, sugere o ano seguinte à base', () => {
    expect(proximoExercicioLivre([], 2026)).toBe(2027);
  });

  it('não entra em laço infinito com dado corrompido', () => {
    const muitos = Array.from({ length: 400 }, (_, i) => plano(1900 + i));
    expect(proximoExercicioLivre(muitos, 1900)).toBeLessThanOrEqual(2200);
  });
});

describe('exercicioValido', () => {
  it('aceita a faixa que o CHECK da coluna aceita', () => {
    expect(exercicioValido(2026)).toBe(true);
    expect(exercicioValido(1900)).toBe(true);
    expect(exercicioValido(2200)).toBe(true);
  });

  it('recusa fora da faixa e não-inteiro', () => {
    expect(exercicioValido(1899)).toBe(false);
    expect(exercicioValido(2201)).toBe(false);
    expect(exercicioValido(2026.5)).toBe(false);
    expect(exercicioValido(NaN)).toBe(false);
  });
});
