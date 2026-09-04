import { describe, it, expect } from 'vitest';
import { validarDadosAssociado } from './associadoValidation';
import { Associado } from '../services/associadosService';

const associadoValido: Associado = {
  id: '1',
  tenant_id: 'default_tenant',
  nome: 'Maria da Silva',
  cpf: '390.533.447-05',
  data_nascimento: '1990-01-01',
  sexo: 'feminino',
  telefone: '(65) 99999-8888',
  endereco_cep: '78000-000',
  endereco_logradouro: 'Rua das Flores',
  endereco_numero: '123',
  endereco_bairro: 'Centro',
  endereco_cidade: 'Cuiabá - MT',
  status: 'ativo',
  data_adesao: '2026-01-01',
  dependentes: [],
};

describe('validarDadosAssociado', () => {
  it('retorna inválido sem erros quando o associado é null', () => {
    expect(validarDadosAssociado(null)).toEqual({ valido: false, erros: [] });
  });

  it('aceita um associado com todos os campos obrigatórios preenchidos', () => {
    const resultado = validarDadosAssociado(associadoValido);
    expect(resultado.valido).toBe(true);
    expect(resultado.erros).toEqual([]);
  });

  it('acusa nome ausente', () => {
    const resultado = validarDadosAssociado({ ...associadoValido, nome: '' });
    expect(resultado.valido).toBe(false);
    expect(resultado.erros.map(e => e.campo)).toContain('nome');
  });

  it('acusa CPF ausente', () => {
    const resultado = validarDadosAssociado({ ...associadoValido, cpf: '' });
    expect(resultado.erros.find(e => e.campo === 'cpf')?.mensagem).toBe('CPF é obrigatório.');
  });

  it('acusa CPF inválido (formato preenchido mas dígitos verificadores errados)', () => {
    const resultado = validarDadosAssociado({ ...associadoValido, cpf: '111.111.111-11' });
    expect(resultado.erros.find(e => e.campo === 'cpf')?.mensagem).toBe('CPF inválido.');
  });

  it('acusa data de nascimento ausente', () => {
    const resultado = validarDadosAssociado({ ...associadoValido, data_nascimento: '' });
    expect(resultado.erros.map(e => e.campo)).toContain('data_nascimento');
  });

  it('acusa sexo ausente', () => {
    const resultado = validarDadosAssociado({ ...associadoValido, sexo: '' });
    expect(resultado.erros.map(e => e.campo)).toContain('sexo');
  });

  it('acusa telefone ausente ou muito curto (sem DDD)', () => {
    const semTelefone = validarDadosAssociado({ ...associadoValido, telefone: '' });
    expect(semTelefone.erros.map(e => e.campo)).toContain('telefone');

    const telefoneCurto = validarDadosAssociado({ ...associadoValido, telefone: '99999' });
    expect(telefoneCurto.erros.map(e => e.campo)).toContain('telefone');
  });

  it('aceita CEP/logradouro/etc. lidos a partir dos aliases legados quando os campos endereco_* estão vazios', () => {
    const comAliasLegado: Associado = {
      ...associadoValido,
      endereco_cep: undefined,
      endereco_logradouro: undefined,
      endereco_numero: undefined,
      endereco_bairro: undefined,
      endereco_cidade: undefined,
      cep: '78000-000',
      logradouro: 'Rua das Flores',
      numero: '123',
      bairro: 'Centro',
      cidade: 'Cuiabá - MT',
    };
    expect(validarDadosAssociado(comAliasLegado).valido).toBe(true);
  });

  it('acusa todos os campos de endereço ausentes de uma vez', () => {
    const resultado = validarDadosAssociado({
      ...associadoValido,
      endereco_cep: '',
      endereco_logradouro: '',
      endereco_numero: '',
      endereco_bairro: '',
      endereco_cidade: '',
      municipio: '',
    });
    const camposComErro = resultado.erros.map(e => e.campo);
    expect(camposComErro).toEqual(
      expect.arrayContaining(['endereco_cep', 'endereco_logradouro', 'endereco_numero', 'endereco_bairro', 'endereco_cidade'])
    );
  });

  it('acusa data de adesão ausente', () => {
    const resultado = validarDadosAssociado({ ...associadoValido, data_adesao: '' });
    expect(resultado.erros.map(e => e.campo)).toContain('data_adesao');
  });

  it('acumula múltiplos erros de uma vez, cada um com sua subTab correta', () => {
    const resultado = validarDadosAssociado({
      ...associadoValido,
      nome: '',
      telefone: '',
      endereco_cep: '',
    });
    expect(resultado.valido).toBe(false);
    expect(resultado.erros).toHaveLength(3);
    expect(resultado.erros.find(e => e.campo === 'nome')?.subTab).toBe('basicas');
    expect(resultado.erros.find(e => e.campo === 'telefone')?.subTab).toBe('contato');
    expect(resultado.erros.find(e => e.campo === 'endereco_cep')?.subTab).toBe('endereco');
  });
});
