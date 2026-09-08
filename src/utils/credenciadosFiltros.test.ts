import { describe, it, expect } from 'vitest';
import { filtrarCredenciados, casaBusca, especialidadesPresentes } from './credenciadosFiltros';
import type { Credenciado } from '../types/credenciados';

const cred = (over: Partial<Credenciado>): Credenciado => ({
  id: over.id || '1',
  razao_social: 'Razão',
  cnpj_cpf: '00.000.000/0001-00',
  ramo_atividade: 'clinica_medica',
  status: 'ativo',
  ...over,
});

const BASE: Credenciado[] = [
  cred({ id: '1', razao_social: 'Hospital Cassems', nome_fantasia: 'Cassems Coxim', cnpj_cpf: '04.311.093/0011-06', especialidade: 'Clínica Médica', ramo_atividade: 'hospital' }),
  cred({ id: '2', razao_social: 'Dr Claudemiro', especialidade: 'Ortopedia e Traumatologia', ramo_atividade: 'medico_independente', status: 'bloqueado' }),
  cred({ id: '3', razao_social: 'Lab Central', especialidade: 'Patologia Clínica/Medicina Laboratorial', ramo_atividade: 'laboratorio' }),
  cred({ id: '4', razao_social: 'Farmácia Popular', ramo_atividade: 'farmacia' }),
];

describe('casaBusca', () => {
  it('termo vazio casa com todos', () => {
    expect(BASE.every((c) => casaBusca(c, ''))).toBe(true);
    expect(BASE.every((c) => casaBusca(c, '   '))).toBe(true);
  });

  it('acha por razão social, nome fantasia e documento', () => {
    expect(casaBusca(BASE[0], 'cassems')).toBe(true);
    expect(casaBusca(BASE[0], 'Coxim')).toBe(true);
    expect(casaBusca(BASE[0], '04.311')).toBe(true);
  });

  it('acha pela especialidade — o que a busca não fazia antes', () => {
    expect(casaBusca(BASE[1], 'ortopedia')).toBe(true);
    expect(casaBusca(BASE[2], 'laboratorial')).toBe(true);
  });

  it('ignora acento na especialidade', () => {
    expect(casaBusca(BASE[0], 'clinica medica')).toBe(true);
  });

  it('não casa quem não tem o termo em campo nenhum', () => {
    expect(casaBusca(BASE[3], 'ortopedia')).toBe(false);
  });

  it('não quebra com credenciado sem especialidade', () => {
    expect(casaBusca(BASE[3], 'farmacia')).toBe(true);
  });

  it('não quebra com credenciado sem CNPJ/CPF — documento é opcional', () => {
    const semDocumento = cred({ id: '5', razao_social: 'Dr Sem Documento', cnpj_cpf: undefined });
    expect(casaBusca(semDocumento, 'sem documento')).toBe(true);
    expect(casaBusca(semDocumento, '00.000')).toBe(false);
  });
});

describe('filtrarCredenciados', () => {
  it('sem filtros devolve tudo', () => {
    expect(filtrarCredenciados(BASE, {})).toHaveLength(4);
  });

  it('filtra por especialidade exata', () => {
    const r = filtrarCredenciados(BASE, { especialidade: 'Ortopedia e Traumatologia' });
    expect(r.map((c) => c.id)).toEqual(['2']);
  });

  it("'todas' não filtra especialidade", () => {
    expect(filtrarCredenciados(BASE, { especialidade: 'todas' })).toHaveLength(4);
  });

  it("'todos' não filtra ramo", () => {
    expect(filtrarCredenciados(BASE, { ramo: 'todos' })).toHaveLength(4);
  });

  it('combina busca, ramo, status e especialidade', () => {
    const r = filtrarCredenciados(BASE, {
      busca: 'dr',
      ramo: 'medico_independente',
      status: 'bloqueado',
      especialidade: 'Ortopedia e Traumatologia',
    });
    expect(r.map((c) => c.id)).toEqual(['2']);
  });

  it('um critério que não bate zera o resultado, mesmo com os outros batendo', () => {
    const r = filtrarCredenciados(BASE, {
      busca: 'dr',
      especialidade: 'Clínica Médica',
    });
    expect(r).toEqual([]);
  });

  it('não muda a lista original', () => {
    filtrarCredenciados(BASE, { busca: 'lab' });
    expect(BASE).toHaveLength(4);
  });
});

describe('especialidadesPresentes', () => {
  it('lista só o que existe na base, sem repetir e em ordem', () => {
    expect(especialidadesPresentes(BASE)).toEqual([
      'Clínica Médica',
      'Ortopedia e Traumatologia',
      'Patologia Clínica/Medicina Laboratorial',
    ]);
  });

  it('ignora vazio e espaço em branco', () => {
    const lista = [cred({ id: 'a', especialidade: '' }), cred({ id: 'b', especialidade: '   ' })];
    expect(especialidadesPresentes(lista)).toEqual([]);
  });

  it('devolve vazio para base vazia', () => {
    expect(especialidadesPresentes([])).toEqual([]);
  });
});
