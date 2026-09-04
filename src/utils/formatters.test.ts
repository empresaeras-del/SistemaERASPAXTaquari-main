import { describe, it, expect } from 'vitest';
import { formatCurrency } from './formatters';

// Intl.NumberFormat('pt-BR', {style:'currency'}) usa um espaço NBSP (U+00A0)
// entre "R$" e o valor, não um espaço comum — normalizamos antes de comparar
// para o teste não depender de qual caractere invisível a ICU decidiu usar.
const normalizarEspacos = (s: string) => s.replace(/\u00A0/g, ' ');

describe('formatCurrency', () => {
  it('formata um valor positivo como moeda BRL', () => {
    expect(normalizarEspacos(formatCurrency(1234.56))).toBe('R$ 1.234,56');
  });

  it('trata valor ausente como zero', () => {
    expect(normalizarEspacos(formatCurrency())).toBe('R$ 0,00');
  });

  it('trata zero explícito', () => {
    expect(normalizarEspacos(formatCurrency(0))).toBe('R$ 0,00');
  });
});
