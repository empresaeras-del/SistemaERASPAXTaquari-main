import { describe, it, expect } from 'vitest';
import { formatLocalDate } from './dateUtils';

describe('formatLocalDate', () => {
  it('formata uma data ISO para dd/MM/yyyy', () => {
    expect(formatLocalDate('2026-09-04')).toBe('04/09/2026');
  });

  it('usa o fallback padrão "-" para valor ausente', () => {
    expect(formatLocalDate(undefined)).toBe('-');
  });
});
