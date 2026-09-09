import { describe, it, expect } from 'vitest';
import {
  anoDaData,
  movimentosDeReceber,
  movimentosDePagar,
  agregarDemonstracao,
  arvoreComValores,
  resumoDaDemonstracao,
  linhasDaDemonstracao,
  idsDasContas,
  MovimentoDeConta,
} from './demonstracaoContabil';
import { indicePorLancamento } from './filtrosClassificacao';
import { montarArvore } from './planoContabilTree';
import type { ContaContabil } from '../types/planoContabil';

const conta = (over: Partial<ContaContabil> & { id: string; codigo: string }): ContaContabil => ({
  tenant_id: 't1',
  plano_id: 'p1',
  nome: over.codigo,
  natureza: 'receita',
  tipo: 'analitica',
  nivel: 1,
  ativo: true,
  ...over,
});

// 3 — Receitas
//   3.1 — Operacionais
//     3.1.01 — Mensalidades
//     3.1.03 — Serviços Extras
// 4 — Despesas
//   4.1 — Operacionais
//     4.1.03 — Serviços de Terceiros
const CONTAS: ContaContabil[] = [
  conta({ id: 'r', codigo: '3', nome: 'Receitas', tipo: 'sintetica' }),
  conta({ id: 'r1', codigo: '3.1', nome: 'Operacionais', tipo: 'sintetica', conta_pai_id: 'r' }),
  conta({ id: 'mens', codigo: '3.1.01', nome: 'Mensalidades', conta_pai_id: 'r1' }),
  conta({ id: 'extra', codigo: '3.1.03', nome: 'Serviços Extras', conta_pai_id: 'r1' }),
  conta({ id: 'd', codigo: '4', nome: 'Despesas', natureza: 'despesa', tipo: 'sintetica' }),
  conta({ id: 'd1', codigo: '4.1', nome: 'Operacionais', natureza: 'despesa', tipo: 'sintetica', conta_pai_id: 'd' }),
  conta({ id: 'terc', codigo: '4.1.03', nome: 'Serviços de Terceiros', natureza: 'despesa', conta_pai_id: 'd1' }),
];

const INDICE = indicePorLancamento([
  { id: 'rec1', conta_contabil_id: 'mens' },
  { id: 'rec2', conta_contabil_id: 'extra' },
  { id: 'desp1', conta_contabil_id: 'terc' },
  { id: 'legado', conta_contabil_id: null },
  { id: 'outroPlano', conta_contabil_id: 'conta-de-2025' },
]);

const agregar = (movimentos: MovimentoDeConta[], exercicio = 2026) =>
  agregarDemonstracao({ movimentos, indice: INDICE, contasDoPlano: idsDasContas(CONTAS), exercicio });

const mov = (over: Partial<MovimentoDeConta>): MovimentoDeConta => ({
  paiId: 'rec1',
  valor: 100,
  dataVencimento: '2026-03-10',
  liquidada: false,
  ...over,
});

describe('anoDaData', () => {
  it('lê o ano do texto, não via Date — 1º de janeiro não cai no ano anterior', () => {
    // new Date('2026-01-01') é meia-noite UTC; em UTC-3 seria 31/12/2025.
    expect(anoDaData('2026-01-01')).toBe(2026);
    expect(anoDaData('2026-12-31')).toBe(2026);
    expect(anoDaData('2026-09-07T23:30:00.000Z')).toBe(2026);
  });

  it('devolve null para o que não é data', () => {
    for (const v of ['', null, undefined, 'ontem', '26-01-01']) {
      expect(anoDaData(v as string)).toBeNull();
    }
  });
});

describe('movimentosDeReceber', () => {
  it('marca liquidada e usa o valor recebido, não o de face', () => {
    const [m] = movimentosDeReceber([
      { receita_id: 'rec1', valor: 100, data_vencimento: '2026-03-10', data_pagamento: '2026-03-12', valor_recebido: 95, status: 'recebido' },
    ]);
    expect(m.liquidada).toBe(true);
    expect(m.valor).toBe(100);
    expect(m.valorLiquidado).toBe(95);
    expect(m.dataLiquidacao).toBe('2026-03-12');
  });

  it('sem valor_recebido cai para valor_pago e depois para o de face', () => {
    const [a, b] = movimentosDeReceber([
      { receita_id: 'r', valor: 100, valor_pago: 80, status: 'recebido', data_pagamento: '2026-01-02' },
      { receita_id: 'r', valor: 100, status: 'pago', data_pagamento: '2026-01-02' },
    ]);
    expect(a.valorLiquidado).toBe(80);
    expect(b.valorLiquidado).toBe(100);
  });

  it('descarta cancelada e excluída — não é previsto nem realizado', () => {
    const saida = movimentosDeReceber([
      { receita_id: 'r', valor: 100, status: 'cancelado' },
      { receita_id: 'r', valor: 100, status: 'pendente', deleted_at: '2026-01-01T00:00:00Z' },
      { receita_id: 'r', valor: 100, status: 'pendente' },
    ]);
    expect(saida).toHaveLength(1);
  });

  it('parcela pendente não é liquidada', () => {
    const [m] = movimentosDeReceber([{ receita_id: 'r', valor: 100, status: 'pendente' }]);
    expect(m.liquidada).toBe(false);
  });
});

describe('movimentosDePagar', () => {
  it('usa valor_pago e data_pagamento, caindo para pago_em', () => {
    const [a, b] = movimentosDePagar([
      { despesa_id: 'd', valor: 270, valor_pago: 270, status: 'pago', data_pagamento: '2026-09-05' },
      { despesa_id: 'd', valor: 270, status: 'pago', pago_em: '2026-09-06T10:00:00Z' },
    ]);
    expect(a.dataLiquidacao).toBe('2026-09-05');
    expect(b.dataLiquidacao).toBe('2026-09-06T10:00:00Z');
    expect(b.valorLiquidado).toBe(270);
  });
});

describe('agregarDemonstracao', () => {
  it('soma previsto pelo vencimento e realizado pela liquidação', () => {
    const { porConta } = agregar([
      mov({ valor: 100, dataVencimento: '2026-03-10', liquidada: true, valorLiquidado: 95, dataLiquidacao: '2026-03-12' }),
      mov({ valor: 200, dataVencimento: '2026-04-10' }),
    ]);
    expect(porConta.get('mens')).toEqual({ previsto: 300, realizado: 95 });
  });

  it('a mesma parcela conta uma vez só — a fonte é a parcela, nunca parcela + caixa', () => {
    // Se o caixa fosse somado junto, os 95 apareceriam duas vezes nesta conta.
    const { porConta } = agregar([
      mov({ liquidada: true, valorLiquidado: 95, dataLiquidacao: '2026-03-12' }),
    ]);
    expect(porConta.get('mens')?.realizado).toBe(95);
  });

  it('parcela que vence num ano e é paga no seguinte se divide entre os exercícios', () => {
    const parcela = mov({ valor: 500, dataVencimento: '2026-12-20', liquidada: true, valorLiquidado: 500, dataLiquidacao: '2027-01-08' });

    const em2026 = agregar([parcela], 2026);
    expect(em2026.porConta.get('mens')).toEqual({ previsto: 500, realizado: 0 });
    expect(em2026.foraDoExercicio).toEqual({ previsto: 0, realizado: 500 });

    const em2027 = agregar([parcela], 2027);
    expect(em2027.porConta.get('mens')).toEqual({ previsto: 0, realizado: 500 });
    expect(em2027.foraDoExercicio).toEqual({ previsto: 500, realizado: 0 });
  });

  it('valor de conta deste plano fora do exercício não some — vai para a nota de rodapé', () => {
    const { porConta, foraDoExercicio, naoClassificado } = agregar([
      mov({ valor: 100, dataVencimento: '2025-05-10', liquidada: true, valorLiquidado: 100, dataLiquidacao: '2025-05-10' }),
    ]);
    expect(porConta.size).toBe(0);
    expect(foraDoExercicio).toEqual({ previsto: 100, realizado: 100 });
    expect(naoClassificado).toEqual({ previsto: 0, realizado: 0 });
  });

  it('lançamento legado sem conta, pai não carregado e conta de outro plano caem em naoClassificado', () => {
    const { porConta, naoClassificado, foraDoExercicio } = agregar([
      mov({ paiId: 'legado', valor: 10 }),
      mov({ paiId: 'nao-carregado', valor: 20 }),
      mov({ paiId: 'outroPlano', valor: 30 }),
      mov({ paiId: null, valor: 40 }),
    ]);
    expect(porConta.size).toBe(0);
    expect(naoClassificado.previsto).toBe(100);
    // Não é "fora do exercício": a conta nem pertence a este plano.
    expect(foraDoExercicio).toEqual({ previsto: 0, realizado: 0 });
  });

  it('conta sem movimento nenhum não entra no mapa', () => {
    const { porConta } = agregar([mov({ paiId: 'rec1' })]);
    expect(porConta.has('extra')).toBe(false);
  });

  it('separa receita de despesa pela conta do pai, não por sinal', () => {
    const { porConta } = agregar([
      mov({ paiId: 'rec1', valor: 100 }),
      mov({ paiId: 'desp1', valor: 70 }),
    ]);
    expect(porConta.get('mens')?.previsto).toBe(100);
    expect(porConta.get('terc')?.previsto).toBe(70);
  });

  it('lista vazia devolve tudo zerado, sem quebrar', () => {
    const { porConta, foraDoExercicio, naoClassificado } = agregar([]);
    expect(porConta.size).toBe(0);
    expect(foraDoExercicio).toEqual({ previsto: 0, realizado: 0 });
    expect(naoClassificado).toEqual({ previsto: 0, realizado: 0 });
  });
});

describe('arvoreComValores', () => {
  const comValores = (movimentos: MovimentoDeConta[]) =>
    arvoreComValores(montarArvore(CONTAS), agregar(movimentos).porConta);

  it('a sintética totaliza as filhas, e a analítica mostra só o próprio', () => {
    const arvore = comValores([
      mov({ paiId: 'rec1', valor: 100, liquidada: true, valorLiquidado: 100, dataLiquidacao: '2026-03-01' }),
      mov({ paiId: 'rec2', valor: 250 }),
    ]);

    const receitas = arvore.find((n) => n.codigo === '3');
    expect(receitas?.total).toEqual({ previsto: 350, realizado: 100 });
    expect(receitas?.proprio).toEqual({ previsto: 0, realizado: 0 });

    const mensalidades = receitas?.filhas[0].filhas.find((n) => n.codigo === '3.1.01');
    expect(mensalidades?.total).toEqual({ previsto: 100, realizado: 100 });
  });

  it('conta zerada continua na árvore — o plano é a estrutura, não o extrato', () => {
    const arvore = comValores([]);
    const codigos = arvore.flatMap((n) => [n.codigo, ...n.filhas.flatMap((f) => [f.codigo, ...f.filhas.map((x) => x.codigo)])]);
    expect(codigos).toContain('3.1.03');
  });
});

describe('resumoDaDemonstracao', () => {
  it('resultado é receita menos despesa, no previsto e no realizado', () => {
    const arvore = arvoreComValores(
      montarArvore(CONTAS),
      agregar([
        mov({ paiId: 'rec1', valor: 1000, liquidada: true, valorLiquidado: 600, dataLiquidacao: '2026-02-01' }),
        mov({ paiId: 'desp1', valor: 400, liquidada: true, valorLiquidado: 400, dataLiquidacao: '2026-02-05' }),
      ]).porConta,
    );

    expect(resumoDaDemonstracao(arvore)).toEqual({
      receita: { previsto: 1000, realizado: 600 },
      despesa: { previsto: 400, realizado: 400 },
      resultado: { previsto: 600, realizado: 200 },
    });
  });

  it('déficit sai negativo em vez de zerado — o sinal é informação', () => {
    const arvore = arvoreComValores(
      montarArvore(CONTAS),
      agregar([mov({ paiId: 'desp1', valor: 500 })]).porConta,
    );
    expect(resumoDaDemonstracao(arvore).resultado.previsto).toBe(-500);
  });
});

describe('linhasDaDemonstracao', () => {
  const arvore = () =>
    arvoreComValores(
      montarArvore(CONTAS),
      agregar([mov({ paiId: 'rec1', valor: 200, liquidada: true, valorLiquidado: 50, dataLiquidacao: '2026-02-01' })]).porConta,
    );

  it('achata na ordem de código, com o nível para a indentação', () => {
    const linhas = linhasDaDemonstracao(arvore());
    expect(linhas.map((l) => l.codigo)).toEqual(['3', '3.1', '3.1.01', '3.1.03', '4', '4.1', '4.1.03']);
    expect(linhas.find((l) => l.codigo === '3.1.01')?.nivel).toBe(3);
  });

  it('calcula a execução em % e devolve null quando não há previsto', () => {
    const linhas = linhasDaDemonstracao(arvore());
    expect(linhas.find((l) => l.codigo === '3.1.01')?.execucao).toBe(25);
    expect(linhas.find((l) => l.codigo === '4.1.03')?.execucao).toBeNull();
  });

  it('apenasComMovimento esconde a conta zerada mas mantém os grupos acima da que sobrou', () => {
    const linhas = linhasDaDemonstracao(arvore(), { apenasComMovimento: true });
    expect(linhas.map((l) => l.codigo)).toEqual(['3', '3.1', '3.1.01']);
  });
});
