import { describe, it, expect } from 'vitest';
import { normalizarTermo, contemTermo } from './normalizarTexto';

describe('normalizarTermo', () => {
  it('remove acentos', () => {
    expect(normalizarTermo('Clínica Médica')).toBe('clinica medica');
    expect(normalizarTermo('Genética')).toBe('genetica');
    expect(normalizarTermo('Coração')).toBe('coracao');
  });

  it('baixa a caixa e apara as pontas', () => {
    expect(normalizarTermo('  CARDIO  ')).toBe('cardio');
  });

  it('não mexe em pontuação nem em barras', () => {
    expect(normalizarTermo('Patologia Clínica/Medicina Laboratorial'))
      .toBe('patologia clinica/medicina laboratorial');
  });

  it('aceita string vazia', () => {
    expect(normalizarTermo('')).toBe('');
    expect(normalizarTermo('   ')).toBe('');
  });
});

describe('contemTermo', () => {
  it('acha ignorando acento e caixa', () => {
    expect(contemTermo('Clínica Médica', 'clinica')).toBe(true);
    expect(contemTermo('Clínica Médica', 'MEDICA')).toBe(true);
  });

  it('acha no meio do texto, não só no começo', () => {
    expect(contemTermo('Cirurgia Cardiovascular', 'vascular')).toBe(true);
  });

  it('termo vazio casa com tudo — é o estado inicial de uma busca', () => {
    expect(contemTermo('qualquer coisa', '')).toBe(true);
    expect(contemTermo('qualquer coisa', '  ')).toBe(true);
  });

  it('devolve false quando não casa', () => {
    expect(contemTermo('Pediatria', 'ortopedia')).toBe(false);
  });
});
