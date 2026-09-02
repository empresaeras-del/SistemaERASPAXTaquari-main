import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { gerarCodigoRemessa } from './faturamentoService';

describe('gerarCodigoRemessa', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-09-02T12:00:00.000Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('gera o código no formato REM-AAAAMM-NNN usando o índice informado', () => {
    expect(gerarCodigoRemessa(1)).toBe('REM-202609-001');
    expect(gerarCodigoRemessa(12)).toBe('REM-202609-012');
  });

  it('usa 1 como índice padrão quando nenhum é informado', () => {
    expect(gerarCodigoRemessa()).toBe('REM-202609-001');
  });

  it('preenche o mês com zero à esquerda', () => {
    vi.setSystemTime(new Date('2026-01-15T12:00:00.000Z'));
    expect(gerarCodigoRemessa(3)).toBe('REM-202601-003');
  });

  it('não trunca quando o índice tem mais de 3 dígitos', () => {
    expect(gerarCodigoRemessa(1234)).toBe('REM-202609-1234');
  });
});
