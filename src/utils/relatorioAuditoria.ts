/**
 * O que a Ata de Ocorrências imprime — decidido **uma vez**, para as três saídas.
 *
 * A tela tem três renderizadores do mesmo conteúdo: a folha de pré-visualização (JSX), o CSV
 * e o PDF (`jsPDF` + `autoTable`). Antes desta decomposição cada um montava o próprio
 * cabeçalho de filtros e a própria linha de tabela, e eles **já discordavam**: a folha
 * imprimia `Todos os Usuários` onde o PDF imprimia `Todos os Operadores`, e o PDF resolvia o
 * operador por id **ou e-mail** enquanto a folha só olhava o id — um filtro por e-mail saía
 * identificado no PDF e como um uuid cru na folha.
 *
 * É a mesma divisão da Ficha de Cadastro e da Demonstração Contábil: **uma função pura decide
 * o quê, cada renderizador decide só como.** Um relatório que não diz por qual filtro foi
 * gerado afirma ser a lista completa sem ser — então os rótulos são conteúdo, não enfeite.
 */
import { format } from 'date-fns';
import {
  getActionConfig,
  getUserRoleBadge,
  formatDetalhesParaTexto,
  type FiltrosAuditoria,
} from './auditoriaHelpers';
import type { LogAuditoria } from '../services/auditoriaService';

export interface OperadorConhecido {
  id?: string;
  nome?: string;
  email?: string;
}

export interface RotulosDeFiltro {
  periodo: string;
  modulo: string;
  tipo: string;
  operador: string;
}

/** O sentinela que o seletor usa para "sem filtro". Não é id de ninguém. */
export const SEM_FILTRO = 'todos';

/**
 * A data vem do TEXTO `YYYY-MM-DD`, com meio-dia colado antes de virar `Date`.
 *
 * `new Date('2026-01-01')` é meia-noite **UTC**; em UTC-3 isso é 31/12/2025, e o cabeçalho
 * imprimiria um período deslocado em um dia. O `T12:00:00` é a margem que o resto do projeto
 * já usa — ver `anoDaData()` no CLAUDE.md.
 */
const dataLegivel = (iso: string) => format(new Date(`${iso}T12:00:00`), 'dd/MM/yyyy');

export const rotulosDeFiltro = (
  filtros: Pick<FiltrosAuditoria, 'dataInicio' | 'dataFim' | 'moduloFiltro' | 'tipoAcaoFiltro' | 'usuarioFiltro'>,
  usuarios: OperadorConhecido[],
): RotulosDeFiltro => {
  const { dataInicio, dataFim, moduloFiltro, tipoAcaoFiltro, usuarioFiltro } = filtros;

  const periodo =
    dataInicio || dataFim
      ? `${dataInicio ? dataLegivel(dataInicio) : 'Início'} até ${dataFim ? dataLegivel(dataFim) : 'Hoje'}`
      : 'Histórico Completo';

  let operador = 'Todos os Operadores';
  if (usuarioFiltro === 'sistema') {
    operador = 'Sistema (Automações)';
  } else if (usuarioFiltro && usuarioFiltro !== SEM_FILTRO) {
    // Por id **ou** e-mail: `getLogsAuditoria` indexa o mapa de usuários pelos dois, então o
    // filtro pode carregar qualquer um dos dois. Olhar só o id imprime um uuid cru.
    const u = (usuarios || []).find((user) => user?.id === usuarioFiltro || user?.email === usuarioFiltro);
    operador = u ? `${u.nome} (${u.email})` : usuarioFiltro;
  }

  return {
    periodo,
    modulo: moduloFiltro === SEM_FILTRO ? 'Todos os Módulos' : String(moduloFiltro).toUpperCase(),
    tipo: tipoAcaoFiltro === SEM_FILTRO ? 'Todos os Tipos' : String(tipoAcaoFiltro).toUpperCase(),
    operador,
  };
};

export interface LinhaDoRelatorio {
  id: string;
  indice: number;
  dataHora: string;
  /** Categoria e etiqueta do módulo, já formatadas para a célula. */
  modulo: string;
  categoria: string;
  etiqueta: string;
  acao: string;
  operadorNome: string;
  operadorPapel: string;
  operadorEmail: string;
  /** Empresa do log, resolvida por id — cai para o `tenant_id` cru, que o CSV imprime. */
  empresa: string;
  detalhes: string;
  /** O payload como está gravado, sem máscara: é a coluna "JSON Bruto" do CSV. */
  detalhesBrutos: string;
}

/**
 * Uma linha por log, com tudo já resolvido. Os três renderizadores leem daqui.
 *
 * `detalhes` sai de `formatDetalhesParaTexto`, que **mascara CPF/CNPJ** — é a mesma função da
 * tela, e mascarar aqui, na montagem, é o que faz as três saídas concordarem em vez de cada
 * uma lembrar de mascarar. Ver `utils/mascaraDocumento.ts`.
 */
export const linhasDoRelatorio = (
  logs: LogAuditoria[],
  empresas: Array<{ id?: string; nome_fantasia?: string }> = [],
): LinhaDoRelatorio[] =>
  (logs || []).map((log, i) => {
    const config = getActionConfig(log.acao);
    return {
      id: log.id,
      indice: i + 1,
      dataHora: format(new Date(log.created_at), 'dd/MM/yyyy HH:mm:ss'),
      modulo: `${config.categoryLabel}\n[${config.badgeLabel}]`,
      categoria: config.categoryLabel,
      etiqueta: config.badgeLabel,
      acao: log.acao,
      operadorNome: log.usuarios?.nome || 'Sistema',
      operadorPapel: getUserRoleBadge(log.usuarios?.nivel).label,
      operadorEmail: log.usuarios?.email || 'N/A',
      empresa: (empresas || []).find((e) => e.id === log.tenant_id)?.nome_fantasia
        || log.tenant_id
        || 'Padrão',
      detalhes: formatDetalhesParaTexto(log.detalhes),
      detalhesBrutos: JSON.stringify(log.detalhes || {}),
    };
  });

/** A célula "quem" do PDF, em três linhas. Deriva da linha acima, nunca do log de novo. */
export const operadorEmTresLinhas = (linha: LinhaDoRelatorio): string =>
  `${linha.operadorNome}\n(${linha.operadorPapel})\n${linha.operadorEmail}`;

export const CABECALHO_CSV = [
  'ID', 'Data/Hora', 'Ação', 'Módulo', 'Usuário', 'Nível', 'E-mail',
  'Empresa / Unidade', 'Detalhes (Texto)', 'JSON Bruto',
] as const;

export const CABECALHO_PDF = [
  '#', 'Data / Hora', 'Módulo / Tipo', 'Ação / Evento',
  'Usuário Responsável', 'Detalhes da Ocorrência / Alterações',
] as const;

/** Escapa uma célula para CSV com `;` como separador — aspas duplicadas, como manda o RFC. */
const celulaCsv = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`;

/**
 * O CSV inteiro, com BOM.
 *
 * O BOM (U+FEFF) na frente não é superstição: sem ele o Excel em pt-BR abre o arquivo em
 * ANSI e todo acento vira caractere quebrado — e um relatório de auditoria ilegível é tão
 * útil quanto nenhum.
 */
export const montarCsvDeAuditoria = (
  logs: LogAuditoria[],
  empresas: Array<{ id?: string; nome_fantasia?: string }> = [],
): string => {
  const corpo = linhasDoRelatorio(logs, empresas).map((l) =>
    [
      l.id, l.dataHora, l.acao, l.categoria, l.operadorNome,
      l.operadorPapel, l.operadorEmail, l.empresa, l.detalhes, l.detalhesBrutos,
    ].map(celulaCsv).join(';'),
  );

  return '\uFEFF' + [CABECALHO_CSV.join(';'), ...corpo].join('\r\n');
};
