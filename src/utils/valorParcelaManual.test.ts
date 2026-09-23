import { describe, it, expect } from 'vitest';
import { valorManualDaParcela, baseDaParcela } from './valorParcelaManual';

describe('valorManualDaParcela', () => {
  it('devolve o número quando o operador digitou um valor', () => {
    expect(valorManualDaParcela('150')).toBe(150);
    expect(valorManualDaParcela('105.50')).toBe(105.5);
  });

  it('devolve null quando o campo está vazio — aí quem manda é o cálculo do plano', () => {
    expect(valorManualDaParcela('')).toBeNull();
    expect(valorManualDaParcela(null)).toBeNull();
    expect(valorManualDaParcela(undefined)).toBeNull();
  });

  /**
   * Zero é valor digitado, não campo vazio: é como se lança a mensalidade de cortesia. Um
   * `Number(x) || calculado` trataria os dois como a mesma coisa e o operador veria o valor
   * do plano voltar sozinho depois de digitar `0`.
   */
  it('aceita zero como valor manual', () => {
    expect(valorManualDaParcela('0')).toBe(0);
    expect(valorManualDaParcela('0.00')).toBe(0);
  });

  it('recusa o negativo, que viraria receita negativa no caixa', () => {
    expect(valorManualDaParcela('-1')).toBeNull();
    expect(valorManualDaParcela('-0.01')).toBeNull();
  });

  it('recusa o que não é número', () => {
    expect(valorManualDaParcela('abc')).toBeNull();
    expect(valorManualDaParcela('12,50')).toBeNull(); // vírgula: `Number` devolve NaN
  });

  /**
   * `Number('  ')` é `0`. Sem o `trim`, um campo com espaço em branco geraria 12 parcelas de
   * R$ 0,00 em vez de cair no automático. O `<input type="number">` da tela não produz esse
   * estado, mas a função é chamada também pela auditoria e por teste.
   */
  it('trata espaço em branco como campo vazio, não como zero', () => {
    expect(valorManualDaParcela('   ')).toBeNull();
  });
});

describe('baseDaParcela', () => {
  it('prefere o valor manual quando existe', () => {
    expect(baseDaParcela('150', 105)).toBe(150);
    expect(baseDaParcela('0', 105)).toBe(0);
  });

  it('cai para o valor calculado quando não há manual válido', () => {
    expect(baseDaParcela('', 105)).toBe(105);
    expect(baseDaParcela('-5', 105)).toBe(105);
    expect(baseDaParcela('abc', 105)).toBe(105);
  });
});
