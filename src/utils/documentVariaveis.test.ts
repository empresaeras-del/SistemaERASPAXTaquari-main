import { describe, expect, it } from 'vitest';
import {
  MODULOS,
  resolverAssociado,
  resolverAtendimento,
  resolverCredenciado,
  resolverEmpresa,
  resolverFinanceiro,
  resolverFornecedor,
  resolverPlano,
  resolverRequisicao,
} from './documentVariaveis';
import { Associado } from '../services/associadosService';
import { PlanoPax } from '../types/planosPax';
import { Empresa } from '../services/empresasService';
import { Credenciado } from '../types/credenciados';
import { Atendimento } from '../types/atendimentos';
import { Fornecedor } from '../types/fornecedores';
import { Requisicao } from '../types/requisicoes';
import { Receita, ParcelaReceber } from '../services/financeiroService';

const baseAssociado: Associado = {
  id: '12345678-abcd',
  tenant_id: 'tenant-a',
  nome: 'Maria Silva',
  cpf: '111.111.111-11',
  status: 'ativo',
  data_adesao: '2026-01-10',
  dependentes: [],
};

describe('MODULOS', () => {
  it('não tem tags de variável duplicadas dentro do mesmo módulo', () => {
    MODULOS.forEach(modulo => {
      const tags = modulo.variaveis.map(v => v.variavel);
      expect(new Set(tags).size).toBe(tags.length);
    });
  });

  it('todo módulo tem pelo menos uma variável', () => {
    MODULOS.forEach(modulo => {
      expect(modulo.variaveis.length).toBeGreaterThan(0);
    });
  });
});

describe('resolverAssociado', () => {
  it('monta o endereço completo a partir dos campos endereco_*', () => {
    const result = resolverAssociado({
      ...baseAssociado,
      endereco_logradouro: 'Rua das Flores',
      endereco_numero: '123',
      endereco_bairro: 'Centro',
      endereco_cidade: 'Coxim',
    });
    expect(result['{{associado_endereco}}']).toBe('Rua das Flores, nº 123, Centro, Coxim');
  });

  it('cai para os campos legados (sem prefixo endereco_) quando os novos não existem', () => {
    const result = resolverAssociado({
      ...baseAssociado,
      logradouro: 'Av. Legada',
      numero: '99',
      bairro: 'Bairro Antigo',
      cidade: 'Rio Verde',
    });
    expect(result['{{associado_endereco}}']).toBe('Av. Legada, nº 99, Bairro Antigo, Rio Verde');
  });

  it('usa os 8 primeiros caracteres do id como número de contrato quando não há um cadastrado', () => {
    const result = resolverAssociado(baseAssociado);
    expect(result['{{numero_contrato}}']).toBe('12345678');
  });

  it('lista os dependentes formatados, ou avisa que não há nenhum', () => {
    expect(resolverAssociado(baseAssociado)['{{associado_dependentes}}']).toBe('Nenhum dependente vinculado');

    const comDependente = resolverAssociado({
      ...baseAssociado,
      dependentes: [{ id: 'd1', nome: 'João Silva', parentesco: 'Filho', cpf: '222.222.222-22' }],
    });
    expect(comDependente['{{associado_dependentes}}']).toBe('João Silva (Filho - CPF: 222.222.222-22)');
    expect(comDependente['{{quantidade_dependentes}}']).toBe('1');
  });
});

describe('resolverPlano', () => {
  const basePlano: PlanoPax = {
    id: 'p1',
    codigo: 'PLN-01',
    nome: 'Plano Família',
    tipo_plano: 'coletivo',
    idade_minima: 0,
    valor_mensalidade: 150,
    taxa_adesao: 50,
    carencia_geral_dias: 30,
    carencia_acidente_dias: 0,
    carencia_morte_natural_dias: 90,
    regra_calculo: 'fixo',
    ativo: true,
    created_at: '2026-01-01',
    updated_at: '2026-01-01',
  };

  it('formata tipo do plano e valores monetários', () => {
    const result = resolverPlano(basePlano);
    expect(result['{{plano_tipo}}']).toBe('Coletivo / Familiar');
    expect(result['{{valor_mensalidade}}']).toContain('150,00');
    expect(result['{{plano_taxa_adesao}}']).toContain('50,00');
  });

  it('mostra "Ilimitado" quando o plano não define limite de vidas', () => {
    expect(resolverPlano(basePlano)['{{plano_limite_vidas}}']).toBe('Ilimitado');
    expect(resolverPlano({ ...basePlano, limite_vidas: 4 })['{{plano_limite_vidas}}']).toBe('4');
  });
});

describe('resolverEmpresa', () => {
  it('usa nome fantasia com fallback pra razão social e vice-versa', () => {
    const empresa: Empresa = {
      id: 'e1', razao_social: 'ERAS PAX LTDA', nome_fantasia: '', cnpj: '00.000.000/0001-00',
      email: '', telefone: '', endereco: '', status: 'ativo',
    };
    expect(resolverEmpresa(empresa)['{{empresa_nome}}']).toBe('ERAS PAX LTDA');
    expect(resolverEmpresa({ ...empresa, nome_fantasia: 'ERAS PAX', razao_social: '' })['{{empresa_razao_social}}']).toBe('ERAS PAX');
  });
});

describe('resolverCredenciado', () => {
  it('monta o endereço completo do credenciado', () => {
    const cred: Credenciado = {
      id: 'c1', razao_social: 'Hospital X', cnpj_cpf: '00.000.000/0001-00', ramo_atividade: 'Hospitalar',
      status: 'ativo', endereco: 'Rua A', numero: '10', bairro: 'Centro', cidade: 'Coxim', estado: 'MS',
    };
    expect(resolverCredenciado(cred)['{{credenciado_endereco}}']).toBe('Rua A, nº 10, Centro, Coxim, MS');
    expect(resolverCredenciado(cred)['{{credenciado_cidade}}']).toBe('Coxim - MS');
  });
});

describe('resolverAtendimento', () => {
  it('formata o valor total e o status em maiúsculas', () => {
    const atd: Atendimento = {
      id: 'a1', tenant_id: 't1', tipo_cliente: 'associado', falecido_nome: 'José',
      status: 'concluido', valor_total: 3200,
    };
    const result = resolverAtendimento(atd);
    expect(result['{{atendimento_valor}}']).toContain('3.200,00');
    expect(result['{{atendimento_status}}']).toBe('CONCLUIDO');
  });
});

describe('resolverRequisicao', () => {
  it('traduz o tipo de paciente e formata os valores', () => {
    const req: Requisicao = {
      id: 'r1', tenant_id: 't1', codigo_requisicao: 'REQ-001', data_emissao: '2026-01-01',
      associado_id: 'as1', associado_nome: 'Maria', paciente_tipo: 'dependente', paciente_nome: 'João',
      tipo_prestador: 'credenciado', credenciado_nome: 'Hospital X', itens: [], valor_total: 500,
      status: 'emitida',
    };
    const result = resolverRequisicao(req);
    expect(result['{{paciente_tipo}}']).toBe('Dependente');
    expect(result['{{requisicao_valor}}']).toContain('500,00');
    expect(result['{{requisicao_copart}}']).toContain('0,00');
  });
});

describe('resolverFinanceiro', () => {
  const parcela: ParcelaReceber = {
    id: 'p1', tenant_id: 't1', receita_id: 'rc1', numero_parcela: 2, valor: 199.9,
    data_vencimento: '2026-02-10', status: 'pendente',
  };

  it('usa numero_parcela/qtd_parcelas da receita quando disponível', () => {
    const receita: Receita = {
      id: 'rc1', tenant_id: 't1', tipo_devedor: 'associado', descricao: 'Mensalidade', categoria: 'Mensalidade',
      data_emissao: '2026-01-10', data_inicio_cobranca: '2026-01-10', valor_total: 2398.8, qtd_parcelas: 12,
      forma_pagamento_padrao: 'pix', status: 'ativo',
    };
    const result = resolverFinanceiro(parcela, receita);
    expect(result['{{parcela_numero}}']).toBe('2/12');
    expect(result['{{receita_valor_total}}']).toContain('2.398,80');
  });

  it('cai para o número isolado da parcela quando a receita não é encontrada', () => {
    const result = resolverFinanceiro(parcela, null);
    expect(result['{{parcela_numero}}']).toBe('2');
    expect(result['{{receita_valor_total}}']).toContain('199,90');
  });
});

describe('resolverFornecedor', () => {
  it('usa a chave PIX vinda de dados_bancarios', () => {
    const forn: Fornecedor = {
      id: 'f1', codigo: 'F001', razao_social: 'Fornecedor X', nome_fantasia: 'Fornecedor X',
      cnpj_cpf: '00.000.000/0001-00', tipo_pessoa: 'PJ', tipo_fornecedor: 'produtos', categoria: 'Geral',
      status: 'ativo', created_at: '2026-01-01', updated_at: '2026-01-01',
      dados_bancarios: { banco: 'Banco X', agencia: '0001', conta: '12345', tipo_conta: 'corrente', chave_pix: 'fornecedor@pix.com' },
    };
    expect(resolverFornecedor(forn)['{{fornecedor_chave_pix}}']).toBe('fornecedor@pix.com');
  });
});
