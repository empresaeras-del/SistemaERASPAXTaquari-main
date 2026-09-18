import { CarteiraEmpresaConveniada, MESES_ABREVIADOS } from './carteiraEmpresaConveniada';
import { mascararDocumento } from './mascaraDocumento';
import { formatCurrency } from './formatters';
import { formatDateSafe } from './dateUtils';

/**
 * O relatório da carteira de uma empresa conveniada: o que a aba **Associados & Mensalidades**
 * mostra na tela, preparado para sair no papel.
 *
 * Puro e testado — decide **o quê** (quais linhas, quais colunas, quais números, o que vira
 * nota), e cada renderizador decide só **como**: a prévia em tela, a janela de impressão e o
 * `jsPDF` do modal. É o mesmo desenho da Ficha de Cadastro, da Demonstração Contábil e do mapa
 * de calor de Contas a Receber.
 *
 * **Este módulo não soma nada.** Os totais vêm prontos de `montarCarteiraEmpresaConveniada`,
 * que é a mesma fonte da tela. Recalcular aqui abriria espaço para o papel discordar do que o
 * operador acabou de ver — e as duas contas pareceriam igualmente corretas.
 */

export type TipoRelatorioCarteira = 'mensal' | 'resumo';

export const ROTULOS_TIPO_RELATORIO: Record<TipoRelatorioCarteira, string> = {
  mensal: 'Mensalidades mês a mês',
  resumo: 'Resumo por associado',
};

/**
 * O que uma linha de uma célula representa. **A cor sai daqui, nunca da posição.**
 *
 * A primeira versão coloria pelo índice — verde na primeira linha da célula, âmbar na segunda —
 * e isso acerta só quando a célula tem os dois valores. Num mês que só tem parcela em aberto, o
 * valor saía **verde**, afirmando que o dinheiro entrou. Foi o que a foto pegou, e nenhuma
 * medição de largura acusaria.
 */
export type TipoParteCelula = 'recebido' | 'aberto' | 'vazio' | 'neutro';

export interface ParteCelula {
  texto: string;
  tipo: TipoParteCelula;
}

export interface CelulaRelatorio {
  recebido: number;
  emAberto: number;
  /** Já formatado, com `—` quando não houve lançamento nenhum no mês. */
  texto: string;
  /** As mesmas linhas do `texto`, cada uma sabendo o que é. */
  partes: ParteCelula[];
  vazia: boolean;
}

export interface LinhaRelatorioCarteira {
  indice: number;
  associadoId: string;
  nome: string;
  /** CPF/CNPJ **mascarado** — ver a decisão no topo de `montarRelatorioCarteira`. */
  documento: string;
  meses: CelulaRelatorio[];
  totalRecebido: number;
  totalEmAberto: number;
  qtdEmAberto: number;
  /** `dd/MM/yyyy` do vencimento em aberto mais antigo, ou `''`. */
  vencimentoMaisAntigo: string;
  situacao: 'Em dia' | 'Em aberto';
  /** Coluna Total já formatada, com `—` quando a linha está zerada. */
  totalTexto: string;
  /** A coluna Total, cada linha sabendo se é recebido ou em aberto. */
  totalPartes: ParteCelula[];
}

export interface KpiRelatorioCarteira {
  rotulo: string;
  valor: string;
  detalhe: string;
}

export interface RelatorioCarteiraConveniada {
  exercicio: number;
  empresaNome: string;
  meses: readonly string[];
  linhas: LinhaRelatorioCarteira[];
  totaisPorMes: CelulaRelatorio[];
  totalRecebido: number;
  totalEmAberto: number;
  totalGeral: number;
  /** 0–100, quanto do lançado no exercício já foi recebido. `0` quando nada foi lançado. */
  percentualRecebido: number;
  qtdAssociados: number;
  qtdAssociadosEmAberto: number;
  kpis: KpiRelatorioCarteira[];
  /** O que existe no banco e **não** entra nos totais. Vai impresso, em vez de sumir. */
  notas: string[];
  totalTexto: string;
  /** A célula Total do rodapé, cada linha sabendo o que é. */
  totalPartes: ParteCelula[];
}

/** `—` para célula sem lançamento: um zero impresso ao lado de valores reais é ruído. */
const CELULA_VAZIA = '—';

/**
 * Valor de uma célula da **grade mensal**, sem o `R$`.
 *
 * Na grade de 12 meses o símbolo apareceria até 24 vezes por linha sem dizer nada de novo — e,
 * pior, `R$ 120,00` não cabe na largura de uma coluna de mês, então o texto empurrava a coluna
 * e os meses saíam com larguras diferentes (foi o que a foto pegou). A unidade fica na legenda
 * e nos KPIs, que é onde ela informa. **O total e o resumo mantêm o `R$`**: ali há espaço e são
 * os números que alguém copia para outro documento.
 */
const formatarValorGrade = (valor: number): string =>
  new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(
    valor || 0
  );

const montarCelula = (recebido: number, emAberto: number): CelulaRelatorio => {
  const vazia = recebido === 0 && emAberto === 0;
  const partes: ParteCelula[] = [];
  if (recebido > 0) partes.push({ texto: formatarValorGrade(recebido), tipo: 'recebido' });
  if (emAberto > 0) partes.push({ texto: formatarValorGrade(emAberto), tipo: 'aberto' });
  if (vazia) partes.push({ texto: CELULA_VAZIA, tipo: 'vazio' });
  return { recebido, emAberto, vazia, partes, texto: partes.map((p) => p.texto).join('\n') };
};

/**
 * Monta o relatório a partir da carteira já agregada.
 *
 * **A máscara é a dos relatórios FINANCEIROS** (`mascararDocumento`, `***.537.031-**`), não a
 * do relatório cadastral de associados (`046.***.***-40`). As duas existem neste projeto e o
 * CLAUDE.md fixa qual vale para cada classe: aqui some o prefixo e os dígitos verificadores,
 * que são o que permite validar um palpite. E ela é aplicada **na montagem do item**, não em
 * cada renderizador — são três saídas lendo o mesmo campo, e mascarar aqui cobre as três sem
 * dar para esquecer uma.
 */
export const montarRelatorioCarteira = (
  carteira: CarteiraEmpresaConveniada,
  empresaNome: string
): RelatorioCarteiraConveniada => {
  const linhas: LinhaRelatorioCarteira[] = (carteira.linhas || []).map((linha, i) => {
    const totalRecebido = linha.totalRecebido;
    const totalEmAberto = linha.totalEmAberto;
    const zerada = totalRecebido === 0 && totalEmAberto === 0;
    const totalPartes: ParteCelula[] = [];
    if (totalRecebido > 0) totalPartes.push({ texto: formatCurrency(totalRecebido), tipo: 'recebido' });
    if (totalEmAberto > 0) totalPartes.push({ texto: formatCurrency(totalEmAberto), tipo: 'aberto' });
    if (zerada) totalPartes.push({ texto: CELULA_VAZIA, tipo: 'vazio' });

    return {
      indice: i + 1,
      associadoId: linha.associado.id,
      nome: linha.associado.nome || 'Sem nome',
      documento: mascararDocumento(linha.associado.cpf || ''),
      meses: linha.meses.map((c) => montarCelula(c.recebido, c.emAberto)),
      totalRecebido,
      totalEmAberto,
      qtdEmAberto: linha.qtdEmAberto,
      vencimentoMaisAntigo: linha.vencimentoMaisAntigoEmAberto
        ? formatDateSafe(linha.vencimentoMaisAntigoEmAberto)
        : '',
      // "Em dia" é a ausência de parcela em aberto no exercício — não uma afirmação sobre a
      // vida inteira do associado, que pode ter parcela aberta em outro ano (vira nota).
      situacao: linha.qtdEmAberto > 0 ? 'Em aberto' : 'Em dia',
      totalTexto: totalPartes.map((p) => p.texto).join('\n'),
      totalPartes,
    };
  });

  const totalGeral = carteira.totalRecebido + carteira.totalEmAberto;
  const percentualRecebido = totalGeral > 0 ? (carteira.totalRecebido / totalGeral) * 100 : 0;
  const qtdAssociadosEmAberto = linhas.filter((l) => l.qtdEmAberto > 0).length;

  const totalGeralPartes: ParteCelula[] = [];
  if (carteira.totalRecebido > 0)
    totalGeralPartes.push({ texto: formatCurrency(carteira.totalRecebido), tipo: 'recebido' });
  if (carteira.totalEmAberto > 0)
    totalGeralPartes.push({ texto: formatCurrency(carteira.totalEmAberto), tipo: 'aberto' });
  if (totalGeralPartes.length === 0) totalGeralPartes.push({ texto: CELULA_VAZIA, tipo: 'vazio' });

  const kpis: KpiRelatorioCarteira[] = [
    {
      rotulo: 'Associados',
      valor: String(linhas.length),
      detalhe: 'Vinculados à empresa',
    },
    {
      rotulo: `Recebido em ${carteira.exercicio}`,
      valor: formatCurrency(carteira.totalRecebido),
      detalhe: 'Mensalidades liquidadas',
    },
    {
      rotulo: `Em aberto em ${carteira.exercicio}`,
      valor: formatCurrency(carteira.totalEmAberto),
      detalhe: `${qtdAssociadosEmAberto} associado(s) com pendência`,
    },
    {
      rotulo: 'Lançado no exercício',
      valor: formatCurrency(totalGeral),
      detalhe: 'Recebido + em aberto',
    },
    {
      rotulo: '% Recebido',
      valor: `${percentualRecebido.toFixed(1)}%`,
      detalhe: 'Do total lançado',
    },
  ];

  // O que não entra na soma aparece como nota — mesma regra de `foraDoExercicio` na
  // Demonstração Contábil e das parcelas sem endereço no mapa de calor. Sem isso esse dinheiro
  // não apareceria em lugar nenhum, e quem lê concluiria que o sistema perdeu lançamento.
  const notas: string[] = [];
  if (carteira.foraDoExercicio.quantidade > 0) {
    notas.push(
      `${carteira.foraDoExercicio.quantidade} parcela(s) de outros exercícios, somando ` +
        `${formatCurrency(carteira.foraDoExercicio.valor)} — fora dos totais deste relatório.`
    );
  }
  if (carteira.canceladas.quantidade > 0) {
    notas.push(
      `${carteira.canceladas.quantidade} parcela(s) canceladas em ${carteira.exercicio}, somando ` +
        `${formatCurrency(carteira.canceladas.valor)} — existem no banco e não cobram ninguém.`
    );
  }

  return {
    exercicio: carteira.exercicio,
    empresaNome,
    meses: MESES_ABREVIADOS,
    linhas,
    totaisPorMes: (carteira.totaisPorMes || []).map((c) => montarCelula(c.recebido, c.emAberto)),
    totalRecebido: carteira.totalRecebido,
    totalEmAberto: carteira.totalEmAberto,
    totalGeral,
    percentualRecebido,
    qtdAssociados: linhas.length,
    qtdAssociadosEmAberto,
    kpis,
    notas,
    totalTexto: totalGeralPartes.map((p) => p.texto).join('\n'),
    totalPartes: totalGeralPartes,
  };
};

/**
 * Cabeçalho da tabela, por tipo de relatório.
 *
 * O **mensal** é a grade da tela: 12 colunas de mês, e só fecha em paisagem. O **resumo** é a
 * mesma carteira numa linha por associado — existe porque em retrato a grade não cabe, e uma
 * tabela espremida a ponto de quebrar cada valor em três linhas não é legível no papel.
 */
export const colunasDoRelatorio = (tipo: TipoRelatorioCarteira): string[] =>
  tipo === 'mensal'
    ? ['#', 'Associado', ...MESES_ABREVIADOS, 'Total']
    : ['#', 'Associado', 'Recebido', 'Em aberto', 'Parcelas em aberto', 'Vencimento mais antigo', 'Situação'];

const valor = (v: number, tipo: TipoParteCelula): ParteCelula[] =>
  v > 0 ? [{ texto: formatCurrency(v), tipo }] : [{ texto: CELULA_VAZIA, tipo: 'vazio' }];

const neutro = (texto: string): ParteCelula[] => [{ texto, tipo: 'neutro' }];

/**
 * Uma linha da tabela, célula a célula, **com o tipo de cada valor** — é o que a prévia e a
 * janela de impressão usam para colorir. A cor nunca sai da posição da linha na célula.
 */
export const celulasDaLinha = (
  linha: LinhaRelatorioCarteira,
  tipo: TipoRelatorioCarteira
): ParteCelula[][] =>
  tipo === 'mensal'
    ? [
        neutro(String(linha.indice)),
        neutro(linha.documento ? `${linha.nome}\n${linha.documento}` : linha.nome),
        ...linha.meses.map((c) => c.partes),
        linha.totalPartes,
      ]
    : [
        neutro(String(linha.indice)),
        neutro(linha.documento ? `${linha.nome}\n${linha.documento}` : linha.nome),
        valor(linha.totalRecebido, 'recebido'),
        valor(linha.totalEmAberto, 'aberto'),
        linha.qtdEmAberto > 0 ? neutro(String(linha.qtdEmAberto)) : [{ texto: CELULA_VAZIA, tipo: 'vazio' as const }],
        neutro(linha.vencimentoMaisAntigo || CELULA_VAZIA),
        [{ texto: linha.situacao, tipo: linha.situacao === 'Em aberto' ? 'aberto' : 'neutro' }],
      ];

/** Linha de totais, célula a célula, com o tipo de cada valor. */
export const celulasDoRodape = (
  relatorio: RelatorioCarteiraConveniada,
  tipo: TipoRelatorioCarteira
): ParteCelula[][] =>
  tipo === 'mensal'
    ? [
        neutro(''),
        neutro('TOTAL'),
        ...relatorio.totaisPorMes.map((c) => c.partes),
        relatorio.totalPartes,
      ]
    : [
        neutro(''),
        neutro('TOTAL'),
        valor(relatorio.totalRecebido, 'recebido'),
        valor(relatorio.totalEmAberto, 'aberto'),
        neutro(''),
        neutro(''),
        neutro(`${relatorio.qtdAssociadosEmAberto} em aberto`),
      ];

const achatar = (celulas: ParteCelula[][]): string[] =>
  celulas.map((partes) => partes.map((p) => p.texto).join('\n'));

/**
 * A mesma linha como texto puro, na ordem de `colunasDoRelatorio` — é o que o `jsPDF` consome,
 * e ele não colore célula. Deriva de `celulasDaLinha` de propósito: duas montagens paralelas
 * são como as saídas passam a discordar na primeira coluna nova.
 */
export const linhaParaTexto = (
  linha: LinhaRelatorioCarteira,
  tipo: TipoRelatorioCarteira
): string[] => achatar(celulasDaLinha(linha, tipo));

/** Linha de totais da tabela, na mesma ordem das colunas. */
export const rodapeParaTexto = (
  relatorio: RelatorioCarteiraConveniada,
  tipo: TipoRelatorioCarteira
): string[] => achatar(celulasDoRodape(relatorio, tipo));

/**
 * Largura de cada coluna, em porcentagem da tabela.
 *
 * **Fica aqui, e não em cada renderizador**, porque as três saídas desenham a mesma tabela — e
 * porque sem largura declarada o navegador dimensiona por conteúdo: na primeira foto, `Fev`
 * (vazio) saiu com 34px e `Jan` com 74px. Num relatório que se lê varrendo a linha, coluna de
 * mês com largura variável desalinha o olho a cada registro. Os 12 meses têm de medir igual,
 * **independentemente de terem valor**.
 *
 * O índice é posicional, como o `columnStyles` do `jspdf-autotable` — inserir coluna no meio
 * muda o mapa dos dois lados junto.
 */
export const larguraColuna = (tipo: TipoRelatorioCarteira, indice: number): string => {
  if (tipo === 'mensal') {
    if (indice === 0) return '3%';
    if (indice === 1) return '21%';
    if (indice === 14) return '10%';
    return '5.5%'; // os 12 meses, todos iguais
  }
  const larguras = ['4%', '31%', '14%', '14%', '13%', '15%', '9%'];
  return larguras[indice] ?? 'auto';
};

export { CELULA_VAZIA };
