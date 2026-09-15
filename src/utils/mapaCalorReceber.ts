import type { Associado } from '../services/associadosService';
import { parcelaEmAberto } from './statusParcela';

/**
 * Onde está o dinheiro a receber, por município e por bairro.
 *
 * O relatório de Contas a Receber lista parcelas em ordem de vencimento — útil para o
 * financeiro, inútil para quem vai à rua cobrar. Um cobrador não percorre uma lista
 * cronológica: ele escolhe um bairro e faz todas as visitas dali. Este módulo responde a
 * pergunta que a lista não responde — **qual zona concentra o valor a receber** —,
 * primeiro por município e, dentro dele, por bairro.
 *
 * Tudo aqui é puro: decide **o quê**, e cada renderizador (prévia, impressão, PDF)
 * decide só **como**. É a mesma divisão da Ficha de Cadastro e da Demonstração Contábil.
 */

/** Rótulo usado quando a parcela não tem endereço para ser roteirizada. */
export const ROTULO_SEM_LOCALIZACAO = 'Sem endereço cadastrado';

/**
 * As quatro faixas de calor, da mais quente para a mais fria.
 *
 * São **quatro**, e não um gradiente contínuo, porque o destino é papel: um cobrador lê
 * "Crítica" numa linha impressa, não interpola tom de azul. E a faixa nunca aparece
 * sozinha — vem sempre ao lado do valor e do rótulo, porque cor impressa (ou fotocopiada
 * em preto e branco) não pode ser o único portador da informação.
 */
export type FaixaDeCalor = 'critica' | 'alta' | 'media' | 'baixa';

export const FAIXAS_DE_CALOR: readonly FaixaDeCalor[] = ['critica', 'alta', 'media', 'baixa'];

export interface DescricaoFaixa {
  rotulo: string;
  /**
   * Rampa sequencial de um só tom, clara → escura.
   *
   * Um tom só porque a variável é **magnitude**, não identidade: arco-íris aqui faria
   * duas zonas vizinhas parecerem categorias diferentes em vez de mais e menos dinheiro.
   * Os quatro passos foram validados contra fundo claro (monotonia de luminosidade,
   * degrau visível entre passos, e o passo mais claro ainda separável do papel).
   */
  cor: string;
  /** Cor do texto sobre `cor`, para o contraste não depender de sorte. */
  corTexto: string;
}

export const DESCRICAO_FAIXA: Record<FaixaDeCalor, DescricaoFaixa> = {
  critica: { rotulo: 'Crítica', cor: '#184f95', corTexto: '#ffffff' },
  alta: { rotulo: 'Alta', cor: '#2a78d6', corTexto: '#ffffff' },
  media: { rotulo: 'Média', cor: '#5598e7', corTexto: '#0f172a' },
  baixa: { rotulo: 'Baixa', cor: '#86b6ef', corTexto: '#0f172a' },
};

/** A parcela como este módulo a lê. */
export interface ParcelaParaMapa {
  id?: string;
  receita_id?: string;
  status?: string;
  valor?: number;
  data_vencimento?: string;
  devedor_nome?: string;
  devedor_cpf_cnpj?: string;
}

/** A receita, só para achar o associado pelo `associado_id` quando ele existe. */
export interface ReceitaParaMapa {
  id?: string;
  associado_id?: string;
}

export interface IndiceDeAssociados {
  porId: Map<string, Associado>;
  porCpf: Map<string, Associado>;
  porNome: Map<string, Associado>;
}

/**
 * Índice de busca dos associados, montado uma vez por relatório.
 *
 * Índice, não varredura: sem ele cada parcela procuraria o dono na lista inteira. É a
 * mesma escolha de `indicePorLancamento` nos filtros por classificação.
 */
export const indiceDeAssociados = (associados: readonly Associado[]): IndiceDeAssociados => {
  const porId = new Map<string, Associado>();
  const porCpf = new Map<string, Associado>();
  const porNome = new Map<string, Associado>();

  for (const assoc of associados || []) {
    if (!assoc) continue;
    if (assoc.id) porId.set(assoc.id, assoc);
    const cpf = (assoc.cpf || '').replace(/\D/g, '');
    if (cpf) porCpf.set(cpf, assoc);
    if (assoc.nome) porNome.set(assoc.nome.trim().toLowerCase(), assoc);
  }

  return { porId, porCpf, porNome };
};

/**
 * O associado dono da parcela, por três caminhos em ordem de confiança.
 *
 * `associado_id` da receita é chave de verdade; o CPF é quase tão bom; o nome é o último
 * recurso e casa por texto, então erra com homônimo e com espaço a mais. A ordem importa
 * e é a que o relatório de Contas a Receber já usava — esta função é a extração daquele
 * trecho, não uma segunda implementação dele.
 */
export const resolverAssociadoDaParcela = (
  parcela: ParcelaParaMapa,
  indice: IndiceDeAssociados,
  receitasPorId?: Map<string, ReceitaParaMapa>,
): Associado | undefined => {
  const receita = parcela.receita_id ? receitasPorId?.get(parcela.receita_id) : undefined;
  if (receita?.associado_id) {
    const porId = indice.porId.get(receita.associado_id);
    if (porId) return porId;
  }

  const cpf = (parcela.devedor_cpf_cnpj || '').replace(/\D/g, '');
  if (cpf) {
    const porCpf = indice.porCpf.get(cpf);
    if (porCpf) return porCpf;
  }

  if (parcela.devedor_nome) {
    return indice.porNome.get(parcela.devedor_nome.trim().toLowerCase());
  }
  return undefined;
};

/**
 * A chave pela qual duas grafias do mesmo lugar se encontram.
 *
 * "Coxim", "COXIM" e "coxim  - ms " são o mesmo município digitado por operadores
 * diferentes; sem normalizar, o relatório mostraria três zonas com um terço do dinheiro
 * cada e nenhuma delas pareceria importante. Acento sai porque "SÃO" e "SAO" convivem no
 * mesmo cadastro.
 *
 * A chave serve só para **agrupar** — o que aparece impresso é a primeira grafia vista,
 * porque é assim que o cobrador reconhece o bairro no mapa dele.
 */
export const normalizarLocalidade = (valor?: string | null): string =>
  (valor || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toUpperCase();

export interface ZonaDeCobranca {
  chave: string;
  /** A grafia que vai para o papel: a primeira encontrada para esta chave. */
  rotulo: string;
  valorAReceber: number;
  valorVencido: number;
  qtdAReceber: number;
  qtdVencida: number;
  /** Devedores distintos — quantas visitas a zona representa, não quantos boletos. */
  devedores: number;
  /** Fatia do total a receber, de 0 a 1. É o número que vai impresso. */
  participacao: number;
  /** Quanto esta zona vale em relação à mais quente do mesmo nível, de 0 a 1. */
  intensidade: number;
  faixa: FaixaDeCalor;
}

export interface ZonaMunicipio extends ZonaDeCobranca {
  bairros: ZonaDeCobranca[];
}

export interface NotaDoMapa {
  valor: number;
  quantidade: number;
}

export interface MapaDeCalorReceber {
  municipios: ZonaMunicipio[];
  totalAReceber: number;
  totalVencido: number;
  qtdAReceber: number;
  qtdVencida: number;
  devedores: number;
  /** Parcelas a receber cujo dono não foi achado, ou está sem endereço. */
  semLocalizacao: NotaDoMapa;
  /** O que veio no filtro mas não é cobrança em aberto (liquidada ou cancelada). */
  foraDaCobranca: NotaDoMapa;
}

export interface OpcoesDoMapa {
  associados?: readonly Associado[];
  receitas?: readonly ReceitaParaMapa[];
  /** `YYYY-MM-DD` de hoje. Injetável para o teste não depender de quando ele roda. */
  hoje?: string;
}

interface Acumulador {
  chave: string;
  rotulo: string;
  valorAReceber: number;
  valorVencido: number;
  qtdAReceber: number;
  qtdVencida: number;
  devedores: Set<string>;
}

const novoAcumulador = (chave: string, rotulo: string): Acumulador => ({
  chave,
  rotulo,
  valorAReceber: 0,
  valorVencido: 0,
  qtdAReceber: 0,
  qtdVencida: 0,
  devedores: new Set<string>(),
});

const somar = (acc: Acumulador, valor: number, vencida: boolean, devedor: string) => {
  acc.valorAReceber += valor;
  acc.qtdAReceber += 1;
  if (vencida) {
    acc.valorVencido += valor;
    acc.qtdVencida += 1;
  }
  if (devedor) acc.devedores.add(devedor);
};

/**
 * A faixa de calor de uma zona, pela intensidade dela **em relação à zona mais quente**.
 *
 * A primeira versão cortava por participação no total, e a foto do relatório mostrou o
 * defeito: com cinco bairros, o maior tinha 31,6% e nada alcançava a faixa mais quente —
 * o topo da rampa ficava sem uso justamente na linha que o cobrador procura. Relativo à
 * zona líder, a mais quente é sempre "Crítica", que é o que um mapa de calor significa.
 *
 * O número absoluto não se perde: `participacao` continua indo impresso ao lado. A cor
 * responde "onde ir primeiro", o número responde "quanto disso é do total" — e as duas
 * perguntas são diferentes.
 */
export const faixaPorIntensidade = (intensidade: number): FaixaDeCalor => {
  if (intensidade >= 0.75) return 'critica';
  if (intensidade >= 0.45) return 'alta';
  if (intensidade >= 0.2) return 'media';
  return 'baixa';
};

const fecharZona = (acc: Acumulador, total: number, maiorDoNivel: number): ZonaDeCobranca => {
  const participacao = total > 0 ? acc.valorAReceber / total : 0;
  const intensidade = maiorDoNivel > 0 ? acc.valorAReceber / maiorDoNivel : 0;
  return {
    chave: acc.chave,
    rotulo: acc.rotulo,
    valorAReceber: acc.valorAReceber,
    valorVencido: acc.valorVencido,
    qtdAReceber: acc.qtdAReceber,
    qtdVencida: acc.qtdVencida,
    devedores: acc.devedores.size,
    participacao,
    intensidade,
    faixa: faixaPorIntensidade(intensidade),
  };
};

const maiorValor = (accs: Iterable<Acumulador>): number => {
  let maior = 0;
  for (const acc of accs) if (acc.valorAReceber > maior) maior = acc.valorAReceber;
  return maior;
};

/** Da zona com mais dinheiro para a com menos; empate desempata pelo rótulo. */
const ordenarZonas = <T extends ZonaDeCobranca>(zonas: T[]): T[] =>
  [...zonas].sort((a, b) =>
    b.valorAReceber !== a.valorAReceber
      ? b.valorAReceber - a.valorAReceber
      : a.rotulo.localeCompare(b.rotulo),
  );

/**
 * O mapa de calor das parcelas que chegaram do filtro da tela.
 *
 * **Só parcela em aberto entra na soma.** O filtro da tela pode incluir recebidas e
 * canceladas — elas continuam no relatório, mas como **nota de rodapé**, nunca somadas:
 * mandar um cobrador a um bairro cujo "calor" é dinheiro que já entrou é o erro que este
 * relatório existe para evitar. É a mesma escolha do `foraDoExercicio` na Demonstração
 * Contábil: o que não entra na conta aparece, em vez de sumir.
 *
 * **A participação do bairro é sobre o total geral**, não sobre o município dele. O
 * cobrador decide para onde ir comparando bairros entre si, e uma fatia relativa ao
 * próprio município faria o bairro de uma cidade pequena parecer tão quente quanto o
 * maior bairro da cidade grande.
 */
export const montarMapaDeCalor = (
  parcelas: readonly ParcelaParaMapa[],
  opcoes: OpcoesDoMapa = {},
): MapaDeCalorReceber => {
  const indice = indiceDeAssociados(opcoes.associados || []);
  const receitasPorId = new Map<string, ReceitaParaMapa>();
  for (const receita of opcoes.receitas || []) {
    if (receita?.id) receitasPorId.set(receita.id, receita);
  }
  const hoje = opcoes.hoje || new Date().toISOString().slice(0, 10);

  const municipios = new Map<string, { acc: Acumulador; bairros: Map<string, Acumulador> }>();
  const semLocalizacao: NotaDoMapa = { valor: 0, quantidade: 0 };
  const foraDaCobranca: NotaDoMapa = { valor: 0, quantidade: 0 };
  const devedoresGerais = new Set<string>();
  let totalAReceber = 0;
  let totalVencido = 0;
  let qtdAReceber = 0;
  let qtdVencida = 0;

  for (const parcela of parcelas || []) {
    if (!parcela) continue;
    const valor = Number(parcela.valor) || 0;

    if (!parcelaEmAberto(parcela.status)) {
      foraDaCobranca.valor += valor;
      foraDaCobranca.quantidade += 1;
      continue;
    }

    // Comparação de texto, não `new Date()`: para `YYYY-MM-DD` a ordem lexicográfica é a
    // cronológica, e `new Date('2026-01-01')` é meia-noite UTC — em UTC-3, 31/12/2025.
    const vencida = Boolean(parcela.data_vencimento) && String(parcela.data_vencimento) < hoje;
    const devedor =
      (parcela.devedor_cpf_cnpj || '').replace(/\D/g, '') ||
      (parcela.devedor_nome || '').trim().toLowerCase();

    totalAReceber += valor;
    qtdAReceber += 1;
    if (vencida) {
      totalVencido += valor;
      qtdVencida += 1;
    }
    if (devedor) devedoresGerais.add(devedor);

    const associado = resolverAssociadoDaParcela(parcela, indice, receitasPorId);
    // O par canônico é `endereco_*`; o legado continua valendo como leitura, porque o
    // cadastro antigo pode ter só ele preenchido.
    const cidade = (associado?.endereco_cidade || (associado as any)?.cidade || '').trim();
    const bairro = (associado?.endereco_bairro || (associado as any)?.bairro || '').trim();

    if (!cidade && !bairro) {
      semLocalizacao.valor += valor;
      semLocalizacao.quantidade += 1;
      continue;
    }

    const chaveCidade = normalizarLocalidade(cidade) || normalizarLocalidade(ROTULO_SEM_LOCALIZACAO);
    let municipio = municipios.get(chaveCidade);
    if (!municipio) {
      municipio = { acc: novoAcumulador(chaveCidade, cidade || ROTULO_SEM_LOCALIZACAO), bairros: new Map() };
      municipios.set(chaveCidade, municipio);
    }
    somar(municipio.acc, valor, vencida, devedor);

    const chaveBairro = normalizarLocalidade(bairro) || normalizarLocalidade(ROTULO_SEM_LOCALIZACAO);
    let zonaBairro = municipio.bairros.get(chaveBairro);
    if (!zonaBairro) {
      zonaBairro = novoAcumulador(chaveBairro, bairro || ROTULO_SEM_LOCALIZACAO);
      municipio.bairros.set(chaveBairro, zonaBairro);
    }
    somar(zonaBairro, valor, vencida, devedor);
  }

  // A intensidade compara zonas do MESMO nível: município com município, bairro com
  // bairro. Medir o bairro contra o município dele faria o maior bairro de toda cidade
  // parecer igualmente quente, que é o oposto de escolher para onde ir.
  const maiorMunicipio = maiorValor([...municipios.values()].map((m) => m.acc));
  const maiorBairro = maiorValor(
    [...municipios.values()].flatMap((m) => [...m.bairros.values()]),
  );

  const zonas: ZonaMunicipio[] = [];
  for (const { acc, bairros } of municipios.values()) {
    zonas.push({
      ...fecharZona(acc, totalAReceber, maiorMunicipio),
      bairros: ordenarZonas(
        [...bairros.values()].map((b) => fecharZona(b, totalAReceber, maiorBairro)),
      ),
    });
  }

  return {
    municipios: ordenarZonas(zonas),
    totalAReceber,
    totalVencido,
    qtdAReceber,
    qtdVencida,
    devedores: devedoresGerais.size,
    semLocalizacao,
    foraDaCobranca,
  };
};

/**
 * A rota sugerida: as zonas mais quentes, já achatadas em linhas de "vá aqui primeiro".
 *
 * É o que o cobrador leva no bolso — município + bairro + quanto há lá —, em vez de ter
 * de reconstruir isso lendo a árvore inteira.
 */
export interface LinhaDeRoteiro {
  ordem: number;
  municipio: string;
  bairro: string;
  valorAReceber: number;
  valorVencido: number;
  qtdAReceber: number;
  devedores: number;
  participacao: number;
  intensidade: number;
  faixa: FaixaDeCalor;
}

export const roteiroSugerido = (mapa: MapaDeCalorReceber, limite = 10): LinhaDeRoteiro[] => {
  const linhas: Omit<LinhaDeRoteiro, 'ordem'>[] = [];
  for (const municipio of mapa.municipios) {
    for (const bairro of municipio.bairros) {
      linhas.push({
        municipio: municipio.rotulo,
        bairro: bairro.rotulo,
        valorAReceber: bairro.valorAReceber,
        valorVencido: bairro.valorVencido,
        qtdAReceber: bairro.qtdAReceber,
        devedores: bairro.devedores,
        participacao: bairro.participacao,
        intensidade: bairro.intensidade,
        faixa: bairro.faixa,
      });
    }
  }

  return linhas
    .sort((a, b) =>
      // O desempate é pelo VENCIDO: entre dois bairros com o mesmo valor a receber, o
      // que já passou do vencimento é a visita que não pode esperar mais uma semana.
      b.valorAReceber !== a.valorAReceber
        ? b.valorAReceber - a.valorAReceber
        : b.valorVencido - a.valorVencido,
    )
    .slice(0, limite)
    .map((linha, i) => ({ ...linha, ordem: i + 1 }));
};
