import { describe, it, expect } from 'vitest';
import {
  ESPECIALIDADES_MEDICAS,
  normalizarTermo,
  filtrarEspecialidades,
  ehEspecialidadeConhecida,
} from './especialidadesMedicas';

describe('catálogo de especialidades', () => {
  it('tem as 55 especialidades da Resolução CFM 2.221/2018', () => {
    // Guarda contra edição acidental: se este número mudar, foi porque alguém
    // mexeu na lista — e aí a mudança precisa ser deliberada, conferida na fonte.
    expect(ESPECIALIDADES_MEDICAS).toHaveLength(55);
  });

  it('não tem duplicatas', () => {
    expect(new Set(ESPECIALIDADES_MEDICAS).size).toBe(ESPECIALIDADES_MEDICAS.length);
  });

  it('está em ordem alfabética, para o combobox não parecer aleatório', () => {
    const ordenado = [...ESPECIALIDADES_MEDICAS].sort((a, b) => a.localeCompare(b, 'pt-BR'));
    expect([...ESPECIALIDADES_MEDICAS]).toEqual(ordenado);
  });

  it('não tem item vazio nem com espaço sobrando', () => {
    for (const e of ESPECIALIDADES_MEDICAS) {
      expect(e.trim()).toBe(e);
      expect(e.length).toBeGreaterThan(0);
    }
  });
});

describe('normalizarTermo', () => {
  it('tira acento e caixa', () => {
    expect(normalizarTermo('Clínica Médica')).toBe('clinica medica');
    expect(normalizarTermo('  CARDIOLOGIA  ')).toBe('cardiologia');
  });

  it('preserva o resto do texto', () => {
    expect(normalizarTermo('Patologia Clínica/Medicina Laboratorial'))
      .toBe('patologia clinica/medicina laboratorial');
  });
});

describe('filtrarEspecialidades', () => {
  it('devolve o catálogo inteiro com termo vazio', () => {
    expect(filtrarEspecialidades('')).toHaveLength(55);
    expect(filtrarEspecialidades('   ')).toHaveLength(55);
  });

  it('acha sem acento o que está acentuado no catálogo', () => {
    expect(filtrarEspecialidades('clinica medica')).toContain('Clínica Médica');
    expect(filtrarEspecialidades('genetica')).toContain('Genética Médica');
  });

  it('acha por trecho no meio do nome, não só pelo começo', () => {
    // Quem procura "vascular" espera as duas, e uma delas não começa por isso.
    const r = filtrarEspecialidades('vascular');
    expect(r).toContain('Cirurgia Vascular');
    expect(r).toContain('Cirurgia Cardiovascular');
  });

  it('agrupa naturalmente a família de cirurgias', () => {
    expect(filtrarEspecialidades('cirurgia').length).toBeGreaterThanOrEqual(10);
  });

  it('devolve vazio quando nada casa', () => {
    expect(filtrarEspecialidades('zzzzz')).toEqual([]);
  });

  it('não muda o catálogo original', () => {
    filtrarEspecialidades('cardio').push('Inventada');
    expect(ESPECIALIDADES_MEDICAS).toHaveLength(55);
  });
});

describe('ehEspecialidadeConhecida', () => {
  it('reconhece um valor do catálogo, com ou sem acento', () => {
    expect(ehEspecialidadeConhecida('Pediatria')).toBe(true);
    expect(ehEspecialidadeConhecida('clinica medica')).toBe(true);
  });

  it('não reconhece valor fora do catálogo — é assim que um dado legado é sinalizado', () => {
    expect(ehEspecialidadeConhecida('Fisioterapia Respiratória')).toBe(false);
  });

  it('trata ausência como desconhecida', () => {
    expect(ehEspecialidadeConhecida(undefined)).toBe(false);
    expect(ehEspecialidadeConhecida(null)).toBe(false);
    expect(ehEspecialidadeConhecida('')).toBe(false);
  });
});
