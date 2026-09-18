import { describe, it, expect } from 'vitest';
import {
  CELULA_VAZIA,
  celulasDaLinha,
  celulasDoRodape,
  colunasDoRelatorio,
  larguraColuna,
  linhaParaTexto,
  montarRelatorioCarteira,
  rodapeParaTexto,
} from './relatorioCarteiraConveniada';
import { montarCarteiraEmpresaConveniada } from './carteiraEmpresaConveniada';
import { Associado } from '../services/associadosService';
import { ParcelaReceber, Receita } from '../services/financeiroService';
import { formatCurrency } from './formatters';

// `formatCurrency` (Intl pt-BR) separa `R$` do número com espaço NÃO-QUEBRÁVEL (U+00A0).
// Escrever o literal com espaço comum reprova por uma diferença que o olho não vê — por isso o
// esperado sai da mesma função que produz o valor.

const EMPRESA = 'emp-1';

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

const montar = (parcelas: ParcelaReceber[], associados = [assoc({ id: 'a1', nome: 'ANA', cpf: '046.537.031-40' })]) =>
  montarRelatorioCarteira(
    montarCarteiraEmpresaConveniada({
      associados,
      parcelas,
      receitas: [receita('r-ana', 'a1'), receita('r-bruno', 'a2')],
      fornecedorId: EMPRESA,
      exercicio: 2026,
    }),
    'CAIXA DE ASSISTENCIA'
  );

describe('montarRelatorioCarteira', () => {
  it('leva os totais da carteira sem recalcular nada', () => {
    // Recalcular aqui abriria espaço para o papel discordar da tela, e as duas contas
    // pareceriam igualmente corretas.
    const r = montar([
      parcela({ id: 'p1', receita_id: 'r-ana', data_vencimento: '2026-03-10', status: 'recebido', valor_recebido: 90 }),
      parcela({ id: 'p2', receita_id: 'r-ana', data_vencimento: '2026-04-10', valor: 110 }),
    ]);
    expect(r.totalRecebido).toBe(90);
    expect(r.totalEmAberto).toBe(110);
    expect(r.totalGeral).toBe(200);
  });

  it('mascara o documento com a regra dos relatórios FINANCEIROS, não a do cadastral', () => {
    // `***.537.031-**` (some prefixo e dígitos verificadores), não `046.***.***-40`.
    const r = montar([parcela({ id: 'p1', receita_id: 'r-ana' })]);
    expect(r.linhas[0].documento).toBe('***.537.031-**');
  });

  it('associado sem documento não imprime máscara nenhuma', () => {
    const r = montar([parcela({ id: 'p1', receita_id: 'r-ana' })], [assoc({ id: 'a1', nome: 'ANA' })]);
    expect(r.linhas[0].documento).toBe('');
    expect(linhaParaTexto(r.linhas[0], 'mensal')[1]).toBe('ANA');
  });

  it('mês sem lançamento imprime travessão, nunca R$ 0,00', () => {
    const r = montar([parcela({ id: 'p1', receita_id: 'r-ana', data_vencimento: '2026-03-10', valor: 50 })]);
    expect(r.linhas[0].meses[0].texto).toBe(CELULA_VAZIA);
    // Na grade mensal o valor sai sem `R$` — ver a decisão em `formatarValorGrade`.
    expect(r.linhas[0].meses[2].texto).toBe('50,00');
  });

  it('a célula com recebido E em aberto no mesmo mês imprime os dois', () => {
    const r = montar([
      parcela({ id: 'p1', receita_id: 'r-ana', data_vencimento: '2026-03-10', status: 'recebido', valor_recebido: 70 }),
      parcela({ id: 'p2', receita_id: 'r-ana', data_vencimento: '2026-03-20', valor: 60 }),
    ]);
    expect(r.linhas[0].meses[2].texto).toBe('70,00\n60,00');
  });

  it('o percentual recebido é do lançado no exercício, e não quebra com zero lançado', () => {
    const r = montar([
      parcela({ id: 'p1', receita_id: 'r-ana', status: 'recebido', valor_recebido: 75 }),
      parcela({ id: 'p2', receita_id: 'r-ana', data_vencimento: '2026-05-10', valor: 25 }),
    ]);
    expect(r.percentualRecebido).toBeCloseTo(75);

    const vazio = montar([]);
    expect(vazio.percentualRecebido).toBe(0);
    expect(vazio.totalGeral).toBe(0);
  });

  it('a situação olha só o exercício do relatório', () => {
    const emDia = montar([
      parcela({ id: 'p1', receita_id: 'r-ana', status: 'recebido', valor_recebido: 10 }),
    ]);
    expect(emDia.linhas[0].situacao).toBe('Em dia');
    expect(emDia.qtdAssociadosEmAberto).toBe(0);

    const devendo = montar([parcela({ id: 'p1', receita_id: 'r-ana', valor: 10 })]);
    expect(devendo.linhas[0].situacao).toBe('Em aberto');
    expect(devendo.qtdAssociadosEmAberto).toBe(1);
  });

  it('o vencimento mais antigo em aberto sai formatado em dd/MM/yyyy', () => {
    const r = montar([
      parcela({ id: 'p1', receita_id: 'r-ana', data_vencimento: '2026-09-10', valor: 10 }),
      parcela({ id: 'p2', receita_id: 'r-ana', data_vencimento: '2026-02-05', valor: 10 }),
    ]);
    expect(r.linhas[0].vencimentoMaisAntigo).toBe('05/02/2026');
  });

  it('o que não entra na soma vira nota impressa, em vez de sumir', () => {
    const r = montar([
      parcela({ id: 'p1', receita_id: 'r-ana', data_vencimento: '2027-01-10', valor: 55 }),
      parcela({ id: 'p2', receita_id: 'r-ana', status: 'cancelado', valor: 30 }),
    ]);
    expect(r.notas).toHaveLength(2);
    expect(r.notas[0]).toContain('outros exercícios');
    expect(r.notas[0]).toContain(formatCurrency(55));
    expect(r.notas[1]).toContain('canceladas');
    expect(r.notas[1]).toContain(formatCurrency(30));
  });

  it('sem nada fora dos totais, não imprime nota nenhuma', () => {
    const r = montar([parcela({ id: 'p1', receita_id: 'r-ana', valor: 10 })]);
    expect(r.notas).toEqual([]);
  });

  it('o associado sem parcela nenhuma continua na lista, zerado', () => {
    const r = montar(
      [parcela({ id: 'p1', receita_id: 'r-ana', status: 'recebido', valor_recebido: 10 })],
      [assoc({ id: 'a1', nome: 'ANA' }), assoc({ id: 'a2', nome: 'BRUNO' })]
    );
    const bruno = r.linhas.find((l) => l.nome === 'BRUNO')!;
    expect(bruno).toBeDefined();
    expect(bruno.totalTexto).toBe(CELULA_VAZIA);
    expect(bruno.situacao).toBe('Em dia');
  });

  it('os cinco KPIs saem preenchidos e nomeiam o exercício', () => {
    const r = montar([parcela({ id: 'p1', receita_id: 'r-ana', valor: 10 })]);
    expect(r.kpis).toHaveLength(5);
    expect(r.kpis[1].rotulo).toBe('Recebido em 2026');
    expect(r.kpis[2].rotulo).toBe('Em aberto em 2026');
    expect(r.kpis.every((k) => k.valor.length > 0)).toBe(true);
  });
});

describe('colunas e linhas por tipo', () => {
  it('o mensal tem as 12 colunas de mês; o resumo não tem nenhuma', () => {
    expect(colunasDoRelatorio('mensal')).toHaveLength(15); // # + associado + 12 meses + total
    expect(colunasDoRelatorio('mensal')[2]).toBe('Jan');
    expect(colunasDoRelatorio('resumo')).toHaveLength(7);
    expect(colunasDoRelatorio('resumo')).not.toContain('Jan');
  });

  it('cada linha tem exatamente uma célula por coluna, nos dois tipos', () => {
    // É o que impede a tabela de sair desalinhada quando alguém acrescentar uma coluna só de
    // um lado — a mesma armadilha do `columnStyles` posicional do jsPDF.
    const r = montar([parcela({ id: 'p1', receita_id: 'r-ana', valor: 10 })]);
    (['mensal', 'resumo'] as const).forEach((tipo) => {
      expect(linhaParaTexto(r.linhas[0], tipo)).toHaveLength(colunasDoRelatorio(tipo).length);
      expect(rodapeParaTexto(r, tipo)).toHaveLength(colunasDoRelatorio(tipo).length);
    });
  });

  it('o resumo imprime travessão onde não há valor, e o rodapé conta quem está em aberto', () => {
    const r = montar([parcela({ id: 'p1', receita_id: 'r-ana', valor: 40 })]);
    const linha = linhaParaTexto(r.linhas[0], 'resumo');
    expect(linha[2]).toBe(CELULA_VAZIA); // recebido
    expect(linha[3]).toBe(formatCurrency(40)); // em aberto
    expect(rodapeParaTexto(r, 'resumo')[6]).toBe('1 em aberto');
  });
});

describe('a cor sai do dado, nunca da posição da linha na célula', () => {
  it('mês só com parcela EM ABERTO tipa a parte como aberto — não como recebido', () => {
    // Colorindo pelo índice (primeira linha = verde), este valor sairia verde e o relatório
    // afirmaria que o dinheiro entrou. Foi o que a foto pegou.
    const r = montar([parcela({ id: 'p1', receita_id: 'r-ana', data_vencimento: '2026-10-10', valor: 60 })]);
    const outubro = r.linhas[0].meses[9];
    expect(outubro.partes).toEqual([{ texto: '60,00', tipo: 'aberto' }]);
  });

  it('mês só com parcela RECEBIDA tipa como recebido', () => {
    const r = montar([
      parcela({ id: 'p1', receita_id: 'r-ana', data_vencimento: '2026-10-10', status: 'recebido', valor_recebido: 60 }),
    ]);
    expect(r.linhas[0].meses[9].partes).toEqual([{ texto: '60,00', tipo: 'recebido' }]);
  });

  it('mês com os dois traz recebido primeiro, e cada parte sabe o que é', () => {
    const r = montar([
      parcela({ id: 'p1', receita_id: 'r-ana', data_vencimento: '2026-03-10', status: 'recebido', valor_recebido: 70 }),
      parcela({ id: 'p2', receita_id: 'r-ana', data_vencimento: '2026-03-20', valor: 60 }),
    ]);
    expect(r.linhas[0].meses[2].partes.map((p) => p.tipo)).toEqual(['recebido', 'aberto']);
  });

  it('mês sem lançamento tem uma parte vazia, e nenhuma cor de valor', () => {
    const r = montar([parcela({ id: 'p1', receita_id: 'r-ana', valor: 10 })]);
    expect(r.linhas[0].meses[0].partes).toEqual([{ texto: CELULA_VAZIA, tipo: 'vazio' }]);
  });

  it('a grade mensal não repete o R$; o total e o resumo mantêm', () => {
    // Na grade o símbolo apareceria 24 vezes por linha e empurrava a largura da coluna.
    const r = montar([
      parcela({ id: 'p1', receita_id: 'r-ana', data_vencimento: '2026-03-10', status: 'recebido', valor_recebido: 120 }),
    ]);
    expect(r.linhas[0].meses[2].texto).toBe('120,00');
    expect(r.linhas[0].totalPartes[0].texto).toBe(formatCurrency(120));
    expect(celulasDaLinha(r.linhas[0], 'resumo')[2][0].texto).toBe(formatCurrency(120));
  });

  it('o texto puro do PDF deriva das mesmas células, sem montagem paralela', () => {
    const r = montar([parcela({ id: 'p1', receita_id: 'r-ana', valor: 10 })]);
    (['mensal', 'resumo'] as const).forEach((tipo) => {
      expect(linhaParaTexto(r.linhas[0], tipo)).toEqual(
        celulasDaLinha(r.linhas[0], tipo).map((partes) => partes.map((x) => x.texto).join('\n'))
      );
      expect(rodapeParaTexto(r, tipo)).toEqual(
        celulasDoRodape(r, tipo).map((partes) => partes.map((x) => x.texto).join('\n'))
      );
    });
  });
});

describe('larguraColuna', () => {
  it('os 12 meses medem igual, tenham valor ou não', () => {
    // Sem isso o navegador dimensiona por conteúdo e o mês vazio encolhe: na primeira foto
    // `Fev` saiu com 34px contra 74px de `Jan`.
    const mesesLargura = new Set(
      Array.from({ length: 12 }, (_, i) => larguraColuna('mensal', i + 2))
    );
    expect(mesesLargura.size).toBe(1);
  });

  it('toda coluna declarada tem largura, nos dois tipos', () => {
    (['mensal', 'resumo'] as const).forEach((tipo) => {
      colunasDoRelatorio(tipo).forEach((_, i) => {
        expect(larguraColuna(tipo, i)).not.toBe('auto');
      });
    });
  });
});
