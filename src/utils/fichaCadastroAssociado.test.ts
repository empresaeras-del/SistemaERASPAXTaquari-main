import { describe, it, expect } from 'vitest';
import { Associado } from '../services/associadosService';
import { montarSecoesFicha, montarDependentesFicha } from './fichaCadastroAssociado';

const baseAssociado: Associado = {
  id: 'a1',
  tenant_id: 'emp-1',
  nome: 'EDSON RENIS ALVES DA SILVA',
  cpf: '017.989.211-89',
  status: 'ativo',
  data_adesao: '2026-09-04',
  dependentes: [],
};

const camposDaSecao = (secoes: ReturnType<typeof montarSecoesFicha>, titulo: string) =>
  secoes.find((s) => s.titulo === titulo)?.linhas.flat() ?? [];

const campo = (linhas: { label: string; valor: string }[], label: string) =>
  linhas.find((l) => l.label === label)?.valor;

describe('montarSecoesFicha', () => {
  it('preenche nome, cpf e status a partir do associado', () => {
    const secoes = montarSecoesFicha(baseAssociado);
    const linhas = camposDaSecao(secoes, 'Dados Pessoais & Contato');
    expect(campo(linhas, 'Nome')).toBe('EDSON RENIS ALVES DA SILVA');
    expect(campo(linhas, 'CPF')).toBe('017.989.211-89');
    expect(campo(linhas, 'Status')).toBe('ATIVO');
  });

  it('usa "Não informado" para campos pessoais ausentes, sem quebrar', () => {
    const secoes = montarSecoesFicha(baseAssociado);
    const linhas = camposDaSecao(secoes, 'Dados Pessoais & Contato');
    expect(campo(linhas, 'RG')).toBe('Não informado');
    expect(campo(linhas, 'Sexo')).toBe('Não informado');
    expect(campo(linhas, 'Telefone')).toBe('Não informado');
    expect(campo(linhas, 'E-mail')).toBe('Não informado');
  });

  it('monta Cidade/UF com as duas partes quando ambas existem', () => {
    // Bug do template antigo: o rótulo prometia "Cidade/UF" mas só a cidade
    // era interpolada — o UF nunca aparecia, por mais que estivesse preenchido.
    const secoes = montarSecoesFicha({
      ...baseAssociado,
      endereco_cidade: 'COXIM',
      endereco_estado: 'MS',
    });
    const linhas = camposDaSecao(secoes, 'Endereço Residencial');
    expect(campo(linhas, 'Cidade/UF')).toBe('COXIM - MS');
  });

  it('mostra só a cidade quando o UF não está cadastrado, sem hífen solto', () => {
    const secoes = montarSecoesFicha({ ...baseAssociado, endereco_cidade: 'COXIM' });
    const linhas = camposDaSecao(secoes, 'Endereço Residencial');
    expect(campo(linhas, 'Cidade/UF')).toBe('COXIM');
  });

  it('cai para "Não informado" quando nem cidade nem UF existem', () => {
    const secoes = montarSecoesFicha(baseAssociado);
    const linhas = camposDaSecao(secoes, 'Endereço Residencial');
    expect(campo(linhas, 'Cidade/UF')).toBe('Não informado');
  });

  it('junta logradouro e número, com "s/n" quando o número está ausente', () => {
    const comNumero = camposDaSecao(
      montarSecoesFicha({ ...baseAssociado, endereco_logradouro: 'AV. MATO GROSSO', endereco_numero: '1519' }),
      'Endereço Residencial',
    );
    expect(campo(comNumero, 'Logradouro')).toBe('AV. MATO GROSSO, 1519');

    const semNumero = camposDaSecao(
      montarSecoesFicha({ ...baseAssociado, endereco_logradouro: 'AV. MATO GROSSO' }),
      'Endereço Residencial',
    );
    expect(campo(semNumero, 'Logradouro')).toBe('AV. MATO GROSSO, s/n');
  });

  it('formata o valor do plano em moeda mesmo quando ausente (zero)', () => {
    // `Intl.NumberFormat` insere um espaço não separável entre "R$" e o número
    // em algumas versões do ICU — comparar contra a própria formatação evita
    // que o teste dependa de qual caractere de espaço a plataforma escolheu.
    const zeroFormatado = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(0);
    const linhas = camposDaSecao(montarSecoesFicha(baseAssociado), 'Plano & Contrato');
    expect(campo(linhas, 'Valor do Plano')).toBe(zeroFormatado);
    expect(campo(linhas, 'Plano Atual')).toBe('Sem plano vinculado');
  });

  it('usa 1 vida como padrão quando n_vidas não está definido', () => {
    const linhas = camposDaSecao(montarSecoesFicha(baseAssociado), 'Plano & Contrato');
    expect(campo(linhas, 'Total de Vidas')).toBe('1 vida(s)');
  });

  it('retorna exatamente quatro seções, na ordem do documento', () => {
    const secoes = montarSecoesFicha(baseAssociado);
    expect(secoes.map((s) => s.titulo)).toEqual([
      'Dados Pessoais & Contato',
      'Endereço Residencial',
      'Filiação',
      'Plano & Contrato',
    ]);
  });
});

describe('montarDependentesFicha', () => {
  it('devolve lista vazia quando o associado não tem dependentes', () => {
    expect(montarDependentesFicha(baseAssociado)).toEqual([]);
  });

  it('formata cada dependente, com CPF e data em branco quando ausentes', () => {
    const linhas = montarDependentesFicha({
      ...baseAssociado,
      dependentes: [
        { id: 'd1', nome: 'JOSIELE DE JESUS SOBRINHO', parentesco: 'OUTRO', data_nascimento: '1989-12-25' },
      ],
    });
    expect(linhas).toEqual([
      { nome: 'JOSIELE DE JESUS SOBRINHO', parentesco: 'OUTRO', cpf: '', dataNascimento: '25/12/1989' },
    ]);
  });
});
