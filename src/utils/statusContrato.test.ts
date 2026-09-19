import { describe, expect, it } from 'vitest';
import { DOMINIOS_DO_BANCO } from '../config/dominiosDoBanco';
import { statusDoContratoParaAssociado } from './statusContrato';

describe('statusDoContratoParaAssociado', () => {
  it('nunca devolve valor que contratos_status_check recusaria', () => {
    // A asserção que resolve o defeito: qualquer status de associado — inclusive todos os que o
    // banco aceita em `associados.status` — precisa virar um status que `contratos` aceita.
    const entradas = [...DOMINIOS_DO_BANCO['associados.status'], '', 'coisa nova', null, undefined];
    for (const entrada of entradas) {
      expect(DOMINIOS_DO_BANCO['contratos.status'], `entrada: ${entrada}`)
        .toContain(statusDoContratoParaAssociado(entrada));
    }
  });

  it('inadimplente NÃO encerra o contrato — quem deve continua coberto', () => {
    expect(statusDoContratoParaAssociado('inadimplente')).toBe('ativo');
  });

  it('ativo segue ativo', () => {
    expect(statusDoContratoParaAssociado('ativo')).toBe('ativo');
  });

  it('inativo e encerrado atravessam', () => {
    expect(statusDoContratoParaAssociado('inativo')).toBe('inativo');
    expect(statusDoContratoParaAssociado('encerrado')).toBe('encerrado');
  });

  it('status desconhecido ou ausente cai em ativo, não em encerrado', () => {
    // O padrão seguro e o contrato vigente: um status que este mapa nao conhece nao pode, sozinho,
    // encerrar a adesao de alguem.
    for (const v of ['', '   ', 'qualquer', null, undefined]) {
      expect(statusDoContratoParaAssociado(v)).toBe('ativo');
    }
  });

  it('não depende de caixa nem de espaço em volta', () => {
    expect(statusDoContratoParaAssociado('  INATIVO ')).toBe('inativo');
    expect(statusDoContratoParaAssociado('Encerrado')).toBe('encerrado');
  });
});
