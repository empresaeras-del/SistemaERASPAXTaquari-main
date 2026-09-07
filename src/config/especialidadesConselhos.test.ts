import { describe, it, expect } from 'vitest';
import {
  CATALOGOS,
  ESPECIALIDADES_MEDICAS,
  catalogoDoRamo,
  filtrarEspecialidades,
  ehEspecialidadeConhecida,
  normalizarTermo,
} from './especialidadesConselhos';

describe('catálogos por conselho', () => {
  it('cobre os quatro conselhos com catálogo', () => {
    expect(CATALOGOS.map((c) => c.id)).toEqual([
      'medicina',
      'odontologia',
      'fisioterapia',
      'psicologia',
    ]);
  });

  it('declara procedência em todos — é o que permite conferir depois', () => {
    for (const c of CATALOGOS) {
      expect(c.conselho.length).toBeGreaterThan(0);
      expect(c.fonte.length).toBeGreaterThan(0);
      expect(typeof c.verificado).toBe('boolean');
    }
  });

  it('nenhum catálogo está vazio', () => {
    for (const c of CATALOGOS) expect(c.itens.length).toBeGreaterThan(0);
  });

  it('nenhum catálogo tem duplicatas', () => {
    for (const c of CATALOGOS) {
      expect(new Set(c.itens).size, `duplicata em ${c.id}`).toBe(c.itens.length);
    }
  });

  it('todos em ordem alfabética, para o combobox não parecer aleatório', () => {
    for (const c of CATALOGOS) {
      const ordenado = [...c.itens].sort((a, b) => a.localeCompare(b, 'pt-BR'));
      expect([...c.itens], `ordem em ${c.id}`).toEqual(ordenado);
    }
  });

  it('nenhum item vazio nem com espaço sobrando', () => {
    for (const c of CATALOGOS) {
      for (const item of c.itens) {
        expect(item.trim()).toBe(item);
        expect(item.length).toBeGreaterThan(0);
      }
    }
  });

  // A contagem do CFM é a única corroborada por fonte secundária (55
  // especialidades e 59 áreas de atuação). Os demais catálogos não têm
  // contagem travada de propósito: travar um número que não pôde ser conferido
  // daria falsa garantia — ver o cabeçalho do módulo.
  it('a lista do CFM tem as 55 especialidades', () => {
    expect(ESPECIALIDADES_MEDICAS).toHaveLength(55);
  });
});

describe('catalogoDoRamo', () => {
  it('manda os ramos médicos para o catálogo do CFM', () => {
    for (const ramo of ['clinica_medica', 'hospital', 'medico_independente', 'laboratorio']) {
      expect(catalogoDoRamo(ramo)?.conselho, ramo).toBe('CFM');
    }
  });

  it('manda cada ramo próprio para o conselho dele', () => {
    expect(catalogoDoRamo('odontologia')?.conselho).toBe('CFO');
    expect(catalogoDoRamo('fisioterapia')?.conselho).toBe('COFFITO');
    expect(catalogoDoRamo('psicologia')?.conselho).toBe('CFP');
  });

  it('devolve null para ramo sem catálogo — é o que faz o campo sumir da tela', () => {
    expect(catalogoDoRamo('farmacia')).toBeNull();
    expect(catalogoDoRamo('outros')).toBeNull();
  });

  it('devolve null para ramo ausente ou desconhecido', () => {
    expect(catalogoDoRamo(undefined)).toBeNull();
    expect(catalogoDoRamo(null)).toBeNull();
    expect(catalogoDoRamo('')).toBeNull();
    expect(catalogoDoRamo('ramo_inexistente')).toBeNull();
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
    const r = filtrarEspecialidades('vascular');
    expect(r).toContain('Cirurgia Vascular');
    expect(r).toContain('Cirurgia Cardiovascular');
  });

  it('funciona sobre qualquer catálogo, não só o médico', () => {
    const odonto = catalogoDoRamo('odontologia')!.itens;
    expect(filtrarEspecialidades('ortodontia', odonto)).toContain('Ortodontia');
    expect(filtrarEspecialidades('protese', odonto).length).toBeGreaterThanOrEqual(2);
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

  it('checa contra o catálogo informado, não sempre o médico', () => {
    const odonto = catalogoDoRamo('odontologia')!.itens;
    expect(ehEspecialidadeConhecida('Ortodontia', odonto)).toBe(true);
    // Uma especialidade médica não é conhecida no catálogo odontológico — é
    // exatamente o caso que o aviso de "fora do catálogo" precisa pegar quando
    // alguém troca o ramo de atividade de um credenciado já cadastrado.
    expect(ehEspecialidadeConhecida('Cardiologia', odonto)).toBe(false);
  });

  it('trata ausência como desconhecida', () => {
    expect(ehEspecialidadeConhecida(undefined)).toBe(false);
    expect(ehEspecialidadeConhecida(null)).toBe(false);
    expect(ehEspecialidadeConhecida('')).toBe(false);
  });
});

describe('normalizarTermo reexportado', () => {
  it('continua disponível para quem já importava daqui', () => {
    expect(normalizarTermo('Clínica Médica')).toBe('clinica medica');
  });
});
