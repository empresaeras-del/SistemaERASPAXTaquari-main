import { describe, it, expect } from 'vitest';
import {
  anoMesDaData,
  associadosDaEmpresa,
  montarCarteiraEmpresaConveniada,
} from './carteiraEmpresaConveniada';
import { Associado } from '../services/associadosService';
import { ParcelaReceber, Receita } from '../services/financeiroService';

const EMPRESA = 'emp-1';
const OUTRA_EMPRESA = 'emp-2';

const assoc = (over: Partial<Associado> & { id: string }): Associado =>
  ({ nome: 'ASSOCIADO', status: 'ativo', tipo_pessoa: 'PJ', fornecedor_id: EMPRESA, ...over }) as Associado;

const receita = (id: string, associadoId: string): Receita =>
  ({ id, associado_id: associadoId }) as Receita;

const parcela = (over: Partial<ParcelaReceber> & { id: string }): ParcelaReceber =>
  ({
    tenant_id: 't1',
    receita_id: 'r1',
    numero_parcela: 1,
    valor: 100,
    data_vencimento: '2026-03-10',
    status: 'pendente',
    ...over,
  }) as ParcelaReceber;

describe('anoMesDaData', () => {
  it('lê ano e mês do texto, sem passar por new Date()', () => {
    expect(anoMesDaData('2026-01-01')).toEqual({ ano: 2026, mes: 0 });
    expect(anoMesDaData('2026-12-31')).toEqual({ ano: 2026, mes: 11 });
  });

  it('1º de janeiro continua em janeiro — é onde o new Date() em UTC erraria', () => {
    // new Date('2026-01-01') é meia-noite UTC; em UTC-3 isso é 31/12/2025.
    expect(anoMesDaData('2026-01-01')).toEqual({ ano: 2026, mes: 0 });
  });

  it('aceita timestamp ISO com o mesmo prefixo', () => {
    expect(anoMesDaData('2026-07-05T13:40:00.000Z')).toEqual({ ano: 2026, mes: 6 });
  });

  it('devolve null para data ausente ou quebrada', () => {
    expect(anoMesDaData(null)).toBeNull();
    expect(anoMesDaData('')).toBeNull();
    expect(anoMesDaData('10/03/2026')).toBeNull();
    expect(anoMesDaData('2026-13-01')).toBeNull();
  });
});

describe('associadosDaEmpresa', () => {
  const lista = [
    assoc({ id: 'b', nome: 'BRUNO' }),
    assoc({ id: 'a', nome: 'ANA' }),
    assoc({ id: 'c', nome: 'CARLA', fornecedor_id: OUTRA_EMPRESA }),
    assoc({ id: 'd', nome: 'PESSOA FISICA', tipo_pessoa: 'PF', fornecedor_id: EMPRESA }),
  ];

  it('traz só os PJ da empresa pedida, em ordem alfabética', () => {
    expect(associadosDaEmpresa(lista, EMPRESA).map((a) => a.id)).toEqual(['a', 'b']);
  });

  it('um PF com id residual não entra — quem decide é o tipo', () => {
    expect(associadosDaEmpresa(lista, EMPRESA).some((a) => a.id === 'd')).toBe(false);
  });

  it('sem empresa, lista vazia', () => {
    expect(associadosDaEmpresa(lista, '')).toEqual([]);
    expect(associadosDaEmpresa(lista, null)).toEqual([]);
  });
});

describe('montarCarteiraEmpresaConveniada', () => {
  const associados = [assoc({ id: 'a1', nome: 'ANA' }), assoc({ id: 'a2', nome: 'BRUNO' })];
  const receitas = [receita('r-ana', 'a1'), receita('r-bruno', 'a2')];

  const montar = (parcelas: ParcelaReceber[], exercicio = 2026) =>
    montarCarteiraEmpresaConveniada({
      associados,
      parcelas,
      receitas,
      fornecedorId: EMPRESA,
      exercicio,
    });

  it('separa recebido e em aberto no mês do vencimento', () => {
    const c = montar([
      parcela({ id: 'p1', receita_id: 'r-ana', data_vencimento: '2026-03-10', status: 'recebido', valor_recebido: 90 }),
      parcela({ id: 'p2', receita_id: 'r-ana', data_vencimento: '2026-04-10', status: 'pendente', valor: 100 }),
    ]);

    const ana = c.linhas.find((l) => l.associado.id === 'a1')!;
    expect(ana.meses[2]).toMatchObject({ recebido: 90, emAberto: 0, qtdRecebida: 1 });
    expect(ana.meses[3]).toMatchObject({ recebido: 0, emAberto: 100, qtdEmAberto: 1 });
    expect(c.totalRecebido).toBe(90);
    expect(c.totalEmAberto).toBe(100);
  });

  it('a parcela paga com atraso fica no mês em que VENCEU, não no que foi paga', () => {
    // É a divergência deliberada com a Demonstração Contábil: aqui a pergunta é "a mensalidade
    // de março foi paga?". Datando pela liquidação, março mostraria um buraco que não existe.
    const c = montar([
      parcela({
        id: 'p1',
        receita_id: 'r-ana',
        data_vencimento: '2026-03-10',
        data_pagamento: '2026-04-28',
        status: 'pago',
        valor_recebido: 100,
      }),
    ]);

    const ana = c.linhas.find((l) => l.associado.id === 'a1')!;
    expect(ana.meses[2].recebido).toBe(100);
    expect(ana.meses[3].recebido).toBe(0);
  });

  it('R$ 0,00 recebido não vira o valor de face', () => {
    const c = montar([
      parcela({ id: 'p1', receita_id: 'r-ana', status: 'recebido', valor: 100, valor_recebido: 0 }),
    ]);
    expect(c.totalRecebido).toBe(0);
  });

  it('sem valor_recebido, cai para o valor de face', () => {
    const c = montar([parcela({ id: 'p1', receita_id: 'r-ana', status: 'recebido', valor: 100 })]);
    expect(c.totalRecebido).toBe(100);
  });

  it('"recebido" e "pago" contam igual; os três nomes de "em aberto" também', () => {
    const c = montar([
      parcela({ id: 'p1', receita_id: 'r-ana', status: 'recebido', valor_recebido: 10 }),
      parcela({ id: 'p2', receita_id: 'r-ana', status: 'pago', valor_recebido: 20 }),
      parcela({ id: 'p3', receita_id: 'r-bruno', status: 'pendente', valor: 1 }),
      parcela({ id: 'p4', receita_id: 'r-bruno', status: 'vencido', valor: 2 }),
      parcela({ id: 'p5', receita_id: 'r-bruno', status: 'atrasado', valor: 4 }),
    ]);
    expect(c.totalRecebido).toBe(30);
    expect(c.totalEmAberto).toBe(7);
  });

  it('cancelada não soma em lugar nenhum, mas vira nota', () => {
    const c = montar([
      parcela({ id: 'p1', receita_id: 'r-ana', status: 'cancelado', valor: 100 }),
    ]);
    expect(c.totalEmAberto).toBe(0);
    expect(c.totalRecebido).toBe(0);
    expect(c.canceladas).toEqual({ quantidade: 1, valor: 100 });
  });

  it('parcela de outro exercício vira nota em vez de sumir', () => {
    const c = montar([
      parcela({ id: 'p1', receita_id: 'r-ana', data_vencimento: '2027-01-10', valor: 55 }),
    ]);
    expect(c.totalEmAberto).toBe(0);
    expect(c.foraDoExercicio).toEqual({ quantidade: 1, valor: 55 });
    expect(c.exerciciosDisponiveis).toContain(2027);
  });

  it('parcela de associado de OUTRA empresa fica de fora, e nem vira nota', () => {
    const outros = [...associados, assoc({ id: 'a3', nome: 'CARLA', fornecedor_id: OUTRA_EMPRESA })];
    const c = montarCarteiraEmpresaConveniada({
      associados: outros,
      parcelas: [parcela({ id: 'p1', receita_id: 'r-carla', valor: 999 })],
      receitas: [...receitas, receita('r-carla', 'a3')],
      fornecedorId: EMPRESA,
      exercicio: 2026,
    });
    expect(c.totalEmAberto).toBe(0);
    expect(c.foraDoExercicio.quantidade).toBe(0);
    expect(c.canceladas.quantidade).toBe(0);
  });

  it('o associado sem nenhuma parcela continua na lista, zerado', () => {
    // A carteira é a relação de quem está vinculado; sumir com quem não tem lançamento faria
    // procurar o associado que se sabe que existe.
    const c = montar([parcela({ id: 'p1', receita_id: 'r-ana', status: 'recebido', valor_recebido: 10 })]);
    const bruno = c.linhas.find((l) => l.associado.id === 'a2')!;
    expect(bruno).toBeDefined();
    expect(bruno.totalRecebido).toBe(0);
    expect(bruno.totalEmAberto).toBe(0);
  });

  it('o vencimento mais antigo em aberto é o menor, comparado como texto', () => {
    const c = montar([
      parcela({ id: 'p1', receita_id: 'r-ana', data_vencimento: '2026-09-10', valor: 10 }),
      parcela({ id: 'p2', receita_id: 'r-ana', data_vencimento: '2026-02-05', valor: 10 }),
      parcela({ id: 'p3', receita_id: 'r-ana', data_vencimento: '2026-05-01', status: 'recebido', valor_recebido: 10 }),
    ]);
    const ana = c.linhas.find((l) => l.associado.id === 'a1')!;
    expect(ana.vencimentoMaisAntigoEmAberto).toBe('2026-02-05');
  });

  it('resolve o dono pelo CPF quando a receita não traz associado_id', () => {
    const comCpf = [assoc({ id: 'a1', nome: 'ANA', cpf: '046.537.031-40' })];
    const c = montarCarteiraEmpresaConveniada({
      associados: comCpf,
      parcelas: [parcela({ id: 'p1', receita_id: 'sem-receita', devedor_cpf_cnpj: '04653703140', valor: 70 })],
      receitas: [],
      fornecedorId: EMPRESA,
      exercicio: 2026,
    });
    expect(c.totalEmAberto).toBe(70);
  });

  it('totaliza por mês somando todos os associados', () => {
    const c = montar([
      parcela({ id: 'p1', receita_id: 'r-ana', data_vencimento: '2026-03-10', valor: 100 }),
      parcela({ id: 'p2', receita_id: 'r-bruno', data_vencimento: '2026-03-15', valor: 50 }),
    ]);
    expect(c.totaisPorMes[2]).toMatchObject({ emAberto: 150, qtdEmAberto: 2 });
  });

  it('empresa sem associado nenhum devolve carteira vazia, não quebra', () => {
    const c = montarCarteiraEmpresaConveniada({
      associados: [],
      parcelas: [],
      receitas: [],
      fornecedorId: EMPRESA,
      exercicio: 2026,
    });
    expect(c.linhas).toEqual([]);
    expect(c.totaisPorMes).toHaveLength(12);
    expect(c.totalRecebido).toBe(0);
  });
});
