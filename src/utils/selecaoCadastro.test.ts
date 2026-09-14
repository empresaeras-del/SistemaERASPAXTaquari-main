import { describe, it, expect } from 'vitest';
import {
  associadoSelecionavel,
  cadastroForaDeCirculacao,
  dependenteSelecionavel,
} from './selecaoCadastro';

const ativo = { id: 'a1', status: 'ativo' };
const inativo = { id: 'a2', status: 'inativo' };
const encerrado = { id: 'a3', status: 'encerrado' };
const inadimplente = { id: 'a4', status: 'inadimplente' };

describe('associadoSelecionavel', () => {
  it('ativo entra em registro novo', () => {
    expect(associadoSelecionavel(ativo)).toBe(true);
  });

  it('inativo e encerrado ficam de fora — é o que dá sentido à inativação', () => {
    expect(associadoSelecionavel(inativo)).toBe(false);
    expect(associadoSelecionavel(encerrado)).toBe(false);
  });

  it('inadimplente continua selecionável', () => {
    // Quem deve é justamente quem precisa ser atendido e cobrado. Barrar aqui seria
    // negar serviço por atraso — decisão de negócio que ninguém tomou.
    expect(associadoSelecionavel(inadimplente)).toBe(true);
  });

  it('status ausente é tratado como ativo', () => {
    expect(associadoSelecionavel({ id: 'x' })).toBe(true);
    expect(associadoSelecionavel({ id: 'x', status: null })).toBe(true);
  });

  it('tolera caixa e espaço', () => {
    expect(associadoSelecionavel({ id: 'x', status: ' INATIVO ' })).toBe(false);
  });

  it('o já selecionado continua visível, para a edição não perder a seleção', () => {
    // Um registro antigo pode apontar para quem foi inativado depois; sumir com ele
    // reescreveria o registro em silêncio ao salvar.
    expect(associadoSelecionavel(inativo, 'a2')).toBe(true);
    expect(associadoSelecionavel(inativo, 'outro')).toBe(false);
  });

  it('cadastro ausente não é selecionável', () => {
    expect(associadoSelecionavel(null)).toBe(false);
    expect(associadoSelecionavel(undefined)).toBe(false);
  });
});

describe('dependenteSelecionavel', () => {
  const dep = { id: 'd1', status: 'ativo' };

  it('dependente ativo de titular ativo entra', () => {
    expect(dependenteSelecionavel(dep, ativo)).toBe(true);
  });

  it('dependente inativo fica de fora mesmo com titular ativo', () => {
    expect(dependenteSelecionavel({ id: 'd2', status: 'inativo' }, ativo)).toBe(false);
  });

  it('dependente ativo de titular INATIVO fica de fora', () => {
    // A cobertura do dependente vem do plano do titular. Sem este teste, inativar o
    // titular deixaria a família inteira selecionável pela porta dos fundos.
    expect(dependenteSelecionavel(dep, inativo)).toBe(false);
  });

  it('dependente sem status é tratado como ativo', () => {
    expect(dependenteSelecionavel({ id: 'd3' }, ativo)).toBe(true);
  });

  it('o já selecionado vence as duas checagens', () => {
    expect(dependenteSelecionavel({ id: 'd4', status: 'inativo' }, inativo, 'd4')).toBe(true);
  });
});

describe('cadastroForaDeCirculacao', () => {
  it('é o espelho de associadoSelecionavel, não uma segunda lista de status', () => {
    // Se algum dia divergirem, é aqui que aparece.
    for (const cadastro of [ativo, inativo, encerrado, inadimplente]) {
      expect(cadastroForaDeCirculacao(cadastro)).toBe(!associadoSelecionavel(cadastro));
    }
  });

  it('bloqueia inativo e encerrado, libera ativo e inadimplente', () => {
    expect(cadastroForaDeCirculacao(inativo)).toBe(true);
    expect(cadastroForaDeCirculacao(encerrado)).toBe(true);
    expect(cadastroForaDeCirculacao(ativo)).toBe(false);
    expect(cadastroForaDeCirculacao(inadimplente)).toBe(false);
  });

  it('cadastro ausente não bloqueia nada', () => {
    // Um formulário ainda sem associado carregado não pode aparecer travado.
    expect(cadastroForaDeCirculacao(null)).toBe(false);
    expect(cadastroForaDeCirculacao(undefined)).toBe(false);
  });
});
