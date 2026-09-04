import { describe, it, expect } from 'vitest';
import {
  ultrapassaLimiteColetivo,
  calcularValorMensalidadeBase,
  descricaoCalculoMensalidade,
  gerarProjecaoParcelas,
  filtrarReceitasDoAssociado,
  filtrarParcelasDoAssociado,
  agruparParcelasPorStatusComTotais,
  filtrarParcelasTabela,
} from './mensalidadesAssociadoHelpers';
import { Receita, ParcelaReceber } from '../services/financeiroService';

describe('ultrapassaLimiteColetivo', () => {
  it('retorna false quando não há plano', () => {
    expect(ultrapassaLimiteColetivo(null, 10)).toBe(false);
  });

  it('retorna false para plano individual, mesmo com muitas vidas', () => {
    expect(ultrapassaLimiteColetivo({ tipo_plano: 'individual', limite_vidas: 2 }, 10)).toBe(false);
  });

  it('retorna true quando vidas excedem o limite do plano coletivo', () => {
    expect(ultrapassaLimiteColetivo({ tipo_plano: 'coletivo', limite_vidas: 5 }, 6)).toBe(true);
  });

  it('retorna false quando vidas estão dentro do limite do plano coletivo', () => {
    expect(ultrapassaLimiteColetivo({ tipo_plano: 'coletivo', limite_vidas: 5 }, 5)).toBe(false);
  });

  it('usa 999 como limite padrão quando o plano coletivo não define limite_vidas', () => {
    expect(ultrapassaLimiteColetivo({ tipo_plano: 'coletivo', limite_vidas: undefined }, 500)).toBe(false);
  });
});

describe('calcularValorMensalidadeBase', () => {
  it('retorna 0 quando não há plano', () => {
    expect(calcularValorMensalidadeBase(null, 3, 0)).toBe(0);
  });

  it('plano individual: multiplica valor unitário pelas vidas cadastradas', () => {
    const plano = { tipo_plano: 'individual' as const, valor_mensalidade: 100, minimo_vidas_calculo: 1 };
    expect(calcularValorMensalidadeBase(plano, 3, 0)).toBe(300);
  });

  it('plano individual: respeita o mínimo de vidas para cálculo', () => {
    const plano = { tipo_plano: 'individual' as const, valor_mensalidade: 100, minimo_vidas_calculo: 4 };
    expect(calcularValorMensalidadeBase(plano, 1, 0)).toBe(400);
  });

  it('plano coletivo: usa valor fixo mais o valor extra', () => {
    const plano = { tipo_plano: 'coletivo' as const, valor_mensalidade: 500, minimo_vidas_calculo: undefined };
    expect(calcularValorMensalidadeBase(plano, 10, 50)).toBe(550);
  });

  it('plano coletivo sem valor extra', () => {
    const plano = { tipo_plano: 'coletivo' as const, valor_mensalidade: 500, minimo_vidas_calculo: undefined };
    expect(calcularValorMensalidadeBase(plano, 10, 0)).toBe(500);
  });
});

describe('descricaoCalculoMensalidade', () => {
  it('retorna string vazia quando não há plano', () => {
    expect(descricaoCalculoMensalidade(null, 3, 0)).toBe('');
  });

  it('plano individual dentro do mínimo: menciona o mínimo exigido', () => {
    const plano = { tipo_plano: 'individual' as const, minimo_vidas_calculo: 2 };
    expect(descricaoCalculoMensalidade(plano, 1, 0)).toBe('Valor Base x 2 (Mínimo de vidas exigido)');
  });

  it('plano individual acima do mínimo: menciona as vidas cadastradas', () => {
    const plano = { tipo_plano: 'individual' as const, minimo_vidas_calculo: 1 };
    expect(descricaoCalculoMensalidade(plano, 4, 0)).toBe('Valor Base x 4 vidas');
  });

  it('plano coletivo sem valor extra', () => {
    expect(descricaoCalculoMensalidade({ tipo_plano: 'coletivo', minimo_vidas_calculo: undefined }, 10, 0)).toBe('Valor Base Coletivo');
  });

  it('plano coletivo com valor extra', () => {
    expect(descricaoCalculoMensalidade({ tipo_plano: 'coletivo', minimo_vidas_calculo: undefined }, 10, 50)).toBe('Valor Base Coletivo + Valor Extra');
  });
});

describe('gerarProjecaoParcelas', () => {
  const formatarData = (d: Date) => d.toISOString().split('T')[0];

  it('gera N parcelas com o valor base, cada uma com o número/mês certo', () => {
    const parcelas = gerarProjecaoParcelas({
      dataInicioISO: '2026-01-01',
      qtdParcelas: 3,
      diaVencimento: 10,
      baseParcela: 100,
      taxaAdesao: 0,
      planoNome: 'Plano Ouro',
      formatarData,
    });
    expect(parcelas).toHaveLength(3);
    expect(parcelas.map(p => p.valor)).toEqual([100, 100, 100]);
    expect(parcelas.map(p => p.numero_parcela)).toEqual([1, 2, 3]);
    expect(parcelas[0].descricao).toBe('Mensalidade 1/3 - Plano Ouro');
  });

  it('soma a taxa de adesão só na primeira parcela e marca isso na descrição', () => {
    const parcelas = gerarProjecaoParcelas({
      dataInicioISO: '2026-01-01',
      qtdParcelas: 2,
      diaVencimento: 10,
      baseParcela: 100,
      taxaAdesao: 30,
      planoNome: 'Plano Ouro',
      formatarData,
    });
    expect(parcelas[0].valor).toBe(130);
    expect(parcelas[0].descricao).toContain('(Inc. Adesão)');
    expect(parcelas[1].valor).toBe(100);
    expect(parcelas[1].descricao).not.toContain('Adesão');
  });

  it('não inclui o sufixo de adesão quando a taxa é zero', () => {
    const parcelas = gerarProjecaoParcelas({
      dataInicioISO: '2026-01-01',
      qtdParcelas: 1,
      diaVencimento: 10,
      baseParcela: 100,
      taxaAdesao: 0,
      planoNome: 'Plano Ouro',
      formatarData,
    });
    expect(parcelas[0].descricao).not.toContain('Adesão');
  });

  it('avança o vencimento um mês por parcela, no dia configurado', () => {
    const parcelas = gerarProjecaoParcelas({
      dataInicioISO: '2026-01-15',
      qtdParcelas: 3,
      diaVencimento: 5,
      baseParcela: 100,
      taxaAdesao: 0,
      planoNome: 'X',
      formatarData,
    });
    expect(parcelas.map(p => p.data_vencimento)).toEqual(['2026-01-05', '2026-02-05', '2026-03-05']);
  });
});

const mkReceita = (over: Partial<Receita>): Receita => ({
  id: over.id || 'r1',
  tenant_id: 'default_tenant',
  tipo_devedor: 'associado',
  descricao: 'Mensalidade',
  categoria: 'Mensalidades',
  data_emissao: '2026-01-01',
  data_inicio_cobranca: '2026-01-01',
  valor_total: 100,
  qtd_parcelas: 1,
  forma_pagamento_padrao: 'boleto',
  status: 'ativo',
  ...over,
});

const mkParcela = (over: Partial<ParcelaReceber>): ParcelaReceber => ({
  id: over.id || 'p1',
  tenant_id: 'default_tenant',
  receita_id: over.receita_id || 'r1',
  numero_parcela: 1,
  valor: 100,
  data_vencimento: '2026-01-10',
  status: 'pendente',
  ...over,
});

describe('filtrarReceitasDoAssociado', () => {
  const associado = { id: 'a1', cpf: '111.111.111-11', nome: 'Maria Silva' };

  it('encontra por associado_id', () => {
    const receitas = [mkReceita({ id: 'r1', associado_id: 'a1' }), mkReceita({ id: 'r2', associado_id: 'outro' })];
    expect(filtrarReceitasDoAssociado(receitas, associado).map(r => r.id)).toEqual(['r1']);
  });

  it('encontra por CPF (ignorando pontuação) quando não há associado_id batendo', () => {
    const receitas = [mkReceita({ id: 'r1', associado_cpf: '11111111111' })];
    expect(filtrarReceitasDoAssociado(receitas, associado).map(r => r.id)).toEqual(['r1']);
  });

  it('encontra por CPF do cliente (cliente_cpf_cnpj) como fallback', () => {
    const receitas = [mkReceita({ id: 'r1', cliente_cpf_cnpj: '111.111.111-11' })];
    expect(filtrarReceitasDoAssociado(receitas, associado).map(r => r.id)).toEqual(['r1']);
  });

  it('encontra por nome normalizado como último fallback', () => {
    const receitas = [mkReceita({ id: 'r1', associado_nome: '  MARIA SILVA  '.trim() })];
    expect(filtrarReceitasDoAssociado(receitas, associado).map(r => r.id)).toEqual(['r1']);
  });

  it('não encontra receita de outro associado', () => {
    const receitas = [mkReceita({ id: 'r1', associado_id: 'outro', associado_cpf: '222', associado_nome: 'Outra Pessoa' })];
    expect(filtrarReceitasDoAssociado(receitas, associado)).toEqual([]);
  });
});

describe('filtrarParcelasDoAssociado', () => {
  const associado = { cpf: '111.111.111-11', nome: 'Maria Silva' };

  it('encontra por vínculo com uma receita já identificada como do associado', () => {
    const receitasDoAssociado = [mkReceita({ id: 'r1' })];
    const parcelas = [mkParcela({ id: 'p1', receita_id: 'r1' }), mkParcela({ id: 'p2', receita_id: 'outra' })];
    expect(filtrarParcelasDoAssociado(parcelas, receitasDoAssociado, associado).map(p => p.id)).toEqual(['p1']);
  });

  it('encontra por CPF do devedor mesmo sem receita vinculada', () => {
    const parcelas = [mkParcela({ id: 'p1', receita_id: 'sem-match', devedor_cpf_cnpj: '11111111111' })];
    expect(filtrarParcelasDoAssociado(parcelas, [], associado).map(p => p.id)).toEqual(['p1']);
  });

  it('encontra por nome do devedor como último fallback', () => {
    const parcelas = [mkParcela({ id: 'p1', receita_id: 'sem-match', devedor_nome: 'Maria Silva' })];
    expect(filtrarParcelasDoAssociado(parcelas, [], associado).map(p => p.id)).toEqual(['p1']);
  });
});

describe('agruparParcelasPorStatusComTotais', () => {
  it('agrupa por status e soma os valores de cada grupo', () => {
    const parcelas = [
      mkParcela({ id: 'p1', status: 'pago', valor: 100, valor_recebido: 110 }),
      mkParcela({ id: 'p2', status: 'recebido', valor: 50 }),
      mkParcela({ id: 'p3', status: 'pendente', valor: 200 }),
      mkParcela({ id: 'p4', status: 'vencido', valor: 30 }),
      mkParcela({ id: 'p5', status: 'atrasado', valor: 20 }),
    ];
    const kpi = agruparParcelasPorStatusComTotais(parcelas);
    expect(kpi.pagas.map(p => p.id)).toEqual(['p1', 'p2']);
    expect(kpi.emAberto.map(p => p.id)).toEqual(['p3']);
    expect(kpi.atrasadas.map(p => p.id)).toEqual(['p4', 'p5']);
    expect(kpi.valorPagas).toBe(160); // usa valor_recebido quando existe, senão valor
    expect(kpi.valorAberto).toBe(200);
    expect(kpi.valorAtrasadas).toBe(50);
  });
});

describe('filtrarParcelasTabela', () => {
  const parcelas = [
    mkParcela({ id: 'p1', status: 'pendente', data_vencimento: '2026-01-10' }),
    mkParcela({ id: 'p2', status: 'pago', data_vencimento: '2026-02-10' }),
    mkParcela({ id: 'p3', status: 'pendente', data_vencimento: '2026-03-10' }),
  ];

  it('sem filtros, retorna todas', () => {
    expect(filtrarParcelasTabela(parcelas, { filtroStatus: 'all', filtroPeriodoInicio: '', filtroPeriodoFim: '' })).toHaveLength(3);
  });

  it('filtra por status', () => {
    const r = filtrarParcelasTabela(parcelas, { filtroStatus: 'pago', filtroPeriodoInicio: '', filtroPeriodoFim: '' });
    expect(r.map(p => p.id)).toEqual(['p2']);
  });

  it('filtra por período (início e fim)', () => {
    const r = filtrarParcelasTabela(parcelas, { filtroStatus: 'all', filtroPeriodoInicio: '2026-02-01', filtroPeriodoFim: '2026-02-28' });
    expect(r.map(p => p.id)).toEqual(['p2']);
  });

  it('combina status e período', () => {
    const r = filtrarParcelasTabela(parcelas, { filtroStatus: 'pendente', filtroPeriodoInicio: '2026-03-01', filtroPeriodoFim: '' });
    expect(r.map(p => p.id)).toEqual(['p3']);
  });
});
