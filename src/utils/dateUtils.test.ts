import { describe, it, expect } from 'vitest';
import { formatLocalDate, formatDateSafe } from './dateUtils';

describe('formatLocalDate', () => {
  it('formata uma data ISO para dd/MM/yyyy', () => {
    expect(formatLocalDate('2026-09-04')).toBe('04/09/2026');
  });

  it('usa o fallback padrão "-" para valor ausente', () => {
    expect(formatLocalDate(undefined)).toBe('-');
  });
});

describe('formatDateSafe', () => {
  it('formata uma data YYYY-MM-DD para DD/MM/YYYY', () => {
    expect(formatDateSafe('2026-09-04')).toBe('04/09/2026');
  });

  it('formata uma data com timestamp (corta na parte de data)', () => {
    expect(formatDateSafe('2026-09-04T13:45:00Z')).toBe('04/09/2026');
  });

  it('retorna string vazia para valor ausente (fallback diferente de formatLocalDate)', () => {
    expect(formatDateSafe(undefined)).toBe('');
  });

  it('retorna string vazia para string vazia', () => {
    expect(formatDateSafe('')).toBe('');
  });
});
