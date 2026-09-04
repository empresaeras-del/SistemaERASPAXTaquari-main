import React from 'react';
import { LogAuditoria } from '../services/auditoriaService';
import { isWithinInterval, subDays } from 'date-fns';
import { Database, Trash2, RotateCcw, PlusCircle, DollarSign, Edit3, Activity } from 'lucide-react';

/**
 * Funções puras extraídas de pages/Auditoria.tsx — comportamento idêntico ao
 * original, só relocadas para poder ser testadas isoladamente sem montar o
 * componente (que arrasta jsPDF e toda a árvore de UI). Ver CLAUDE.md, seção
 * "God components". Mantidas byte-a-byte iguais ao original (inclusive as
 * classes de estilo), porque este ambiente não tem como verificar visualmente
 * uma mudança de shape aqui.
 */

export type TipoAcaoAuditoria = 'create' | 'update' | 'delete' | 'backup' | 'finance' | 'general';

export interface ActionConfig {
  type: TipoAcaoAuditoria;
  categoryLabel: string;
  badgeLabel: string;
  badgeBg: string;
  badgeText: string;
  badgeBorder: string;
  iconBg: string;
  iconColor: string;
  dotColor: string;
  icon: React.ComponentType<{ className?: string }>;
}

/**
 * Classifica uma ação de auditoria (texto livre gravado pelo backend) num
 * tipo/categoria com estilo visual associado — usada tanto para o badge
 * quanto para o filtro "Tipo de Ação" (via `.type`). A ordem das checagens
 * importa — backup/sistema é checado antes de exclusão, por exemplo, porque
 * "restaurar backup" não deveria cair em "exclusão" mesmo contendo palavras
 * parecidas.
 */
export const getActionConfig = (acao: string): ActionConfig => {
  const lower = acao.toLowerCase();

  // Backup & System
  if (lower.includes('backup') || lower.includes('restaurar') || lower.includes('sistema')) {
    return {
      type: 'backup',
      categoryLabel: 'Sistema & Dados',
      badgeLabel: 'BACKUP / SISTEMA',
      badgeBg: 'bg-indigo-500/10',
      badgeText: 'text-indigo-600 dark:text-indigo-400',
      badgeBorder: 'border-indigo-500/20',
      iconBg: 'bg-indigo-500/10 dark:bg-indigo-500/20',
      iconColor: 'text-indigo-600 dark:text-indigo-400',
      dotColor: 'border-indigo-500 ring-indigo-500/20',
      icon: Database
    };
  }

  // Deletions / Estornos / Cancellations
  if (
    lower.includes('excluir') ||
    lower.includes('soft delete') ||
    lower.includes('cancelamento') ||
    lower.includes('estorno') ||
    lower.includes('desativar')
  ) {
    return {
      type: 'delete',
      categoryLabel: 'Exclusão & Estorno',
      badgeLabel: lower.includes('estorno') ? 'ESTORNO' : 'EXCLUSÃO',
      badgeBg: 'bg-rose-500/10',
      badgeText: 'text-rose-600 dark:text-rose-400',
      badgeBorder: 'border-rose-500/20',
      iconBg: 'bg-rose-500/10 dark:bg-rose-500/20',
      iconColor: 'text-rose-600 dark:text-rose-400',
      dotColor: 'border-rose-500 ring-rose-500/20',
      icon: lower.includes('estorno') ? RotateCcw : Trash2
    };
  }

  // Creations / Openings / Additions
  if (
    lower.includes('criar') ||
    lower.includes('novo') ||
    lower.includes('abertura') ||
    lower.includes('emissão') ||
    (lower.includes('salvar') && !lower.includes('editar'))
  ) {
    return {
      type: 'create',
      categoryLabel: 'Criação / Cadastro',
      badgeLabel: 'NOVO REGISTRO',
      badgeBg: 'bg-emerald-500/10',
      badgeText: 'text-emerald-600 dark:text-emerald-400',
      badgeBorder: 'border-emerald-500/20',
      iconBg: 'bg-emerald-500/10 dark:bg-emerald-500/20',
      iconColor: 'text-emerald-600 dark:text-emerald-400',
      dotColor: 'border-emerald-500 ring-emerald-500/20',
      icon: PlusCircle
    };
  }

  // Finance / Cash Desk / Payments
  if (
    lower.includes('receita') ||
    lower.includes('despesa') ||
    lower.includes('pagamento') ||
    lower.includes('recebimento') ||
    lower.includes('caixa') ||
    lower.includes('lote') ||
    lower.includes('remessa')
  ) {
    return {
      type: 'finance',
      categoryLabel: 'Financeiro & Caixa',
      badgeLabel: 'FINANCEIRO',
      badgeBg: 'bg-amber-500/10',
      badgeText: 'text-amber-600 dark:text-amber-400',
      badgeBorder: 'border-amber-500/20',
      iconBg: 'bg-amber-500/10 dark:bg-amber-500/20',
      iconColor: 'text-amber-600 dark:text-amber-400',
      dotColor: 'border-amber-500 ring-amber-500/20',
      icon: DollarSign
    };
  }

  // Updates / Modifications
  if (
    lower.includes('editar') ||
    lower.includes('atualização') ||
    lower.includes('alteração') ||
    lower.includes('reabertura') ||
    lower.includes('fechamento')
  ) {
    return {
      type: 'update',
      categoryLabel: 'Modificação',
      badgeLabel: lower.includes('reabertura') ? 'REABERTURA' : 'ALTERAÇÃO',
      badgeBg: 'bg-blue-500/10',
      badgeText: 'text-blue-600 dark:text-blue-400',
      badgeBorder: 'border-blue-500/20',
      iconBg: 'bg-blue-500/10 dark:bg-blue-500/20',
      iconColor: 'text-blue-600 dark:text-blue-400',
      dotColor: 'border-blue-500 ring-blue-500/20',
      icon: Edit3
    };
  }

  // General fallback
  return {
    type: 'general',
    categoryLabel: 'Operação Geral',
    badgeLabel: 'OPERAÇÃO',
    badgeBg: 'bg-slate-500/10',
    badgeText: 'text-slate-600 dark:text-slate-400',
    badgeBorder: 'border-slate-500/20',
    iconBg: 'bg-slate-500/10 dark:bg-slate-500/20',
    iconColor: 'text-slate-600 dark:text-slate-400',
    dotColor: 'border-[#3B82F6] ring-[#3B82F6]/20',
    icon: Activity
  };
};

/** Rótulo + classes de estilo do badge de nível de acesso do usuário responsável por um log. */
export const getUserRoleBadge = (nivel?: string): { label: string; bg: string } => {
  switch (nivel) {
    case 'super_admin':
      return { label: 'Super Admin', bg: 'bg-purple-500/15 text-purple-600 dark:text-purple-400 border-purple-500/30' };
    case 'admin':
      return { label: 'Administrador', bg: 'bg-blue-500/15 text-blue-600 dark:text-blue-400 border-blue-500/30' };
    case 'gerente':
      return { label: 'Gerente', bg: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30' };
    case 'funcionario':
      return { label: 'Funcionário', bg: 'bg-slate-500/15 text-slate-600 dark:text-slate-400 border-slate-500/30' };
    case 'sistema':
      return { label: 'Sistema', bg: 'bg-indigo-500/15 text-indigo-600 dark:text-indigo-400 border-indigo-500/30' };
    default:
      return { label: 'Operador', bg: 'bg-gray-500/15 text-gray-600 dark:text-gray-400 border-gray-500/30' };
  }
};

const NOMES_CAMPOS: Record<string, string> = {
  id: 'ID do Registro',
  file: 'Arquivo de Backup',
  tabelas_incluidas: 'Tabelas Processadas',
  registros_total: 'Total de Registros',
  nome: 'Nome',
  nome_fantasia: 'Nome Fantasia',
  razao_social: 'Razão Social',
  descricao: 'Descrição',
  valor: 'Valor',
  valor_pago: 'Valor Pago',
  valor_recebido: 'Valor Recebido',
  codigo: 'Código do Lote',
  lote_id: 'ID do Lote',
  justificativa: 'Justificativa',
  usuario: 'Responsável',
  email: 'E-mail',
  status: 'Status',
  novoStatus: 'Novo Status',
  motivo: 'Motivo',
  tipo: 'Tipo',
  atendimento_id: 'ID do Atendimento',
  qtd_receitas: 'Quantidade de Receitas',
  despesa_id: 'ID da Despesa',
};

/** Formata o nome técnico de um campo (snake_case ou camelCase) para exibição humana. */
export const formatKeyName = (key: string): string => {
  if (NOMES_CAMPOS[key]) return NOMES_CAMPOS[key];
  return key.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
};

export interface CampoAlterado {
  key: string;
  oldVal: unknown;
  newVal: unknown;
}

/**
 * Compara `dados_anteriores` e `dados_novos` de um log e retorna só os
 * campos que de fato mudaram — usada tanto pelo visualizador de diff na tela
 * quanto pela exportação em texto/PDF, que antes recalculavam a mesma coisa
 * de duas formas ligeiramente diferentes.
 */
export const calcularCamposAlterados = (
  oldData: Record<string, unknown> | null | undefined,
  newData: Record<string, unknown> | null | undefined
): CampoAlterado[] => {
  const allKeys = Array.from(new Set([...Object.keys(oldData || {}), ...Object.keys(newData || {})]));
  const changes: CampoAlterado[] = [];
  for (const key of allKeys) {
    const oldVal = oldData?.[key];
    const newVal = newData?.[key];
    if (JSON.stringify(oldVal) !== JSON.stringify(newVal)) {
      changes.push({ key, oldVal, newVal });
    }
  }
  return changes;
};

/** Formata um valor individual de `detalhes` para texto simples (relatórios/CSV/PDF). */
const formatValorParaTexto = (key: string, v: unknown): string => {
  if (typeof v === 'number' && key.toLowerCase().includes('valor')) {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);
  }
  return typeof v === 'object' ? JSON.stringify(v) : String(v);
};

/** Formata o objeto `detalhes` de um log de auditoria em uma linha de texto legível, para relatórios/CSV/PDF. */
export const formatDetalhesParaTexto = (detalhes: any): string => {
  if (!detalhes) return '-';
  if (typeof detalhes === 'string') return detalhes;

  if (detalhes.dados_anteriores || detalhes.dados_novos) {
    const changes = calcularCamposAlterados(detalhes.dados_anteriores || {}, detalhes.dados_novos || {});
    if (changes.length === 0) return 'Sem alterações diretas em campos.';
    return changes
      .map(({ key, oldVal, newVal }) => {
        const oldStr = oldVal !== undefined && oldVal !== null ? JSON.stringify(oldVal) : 'Vazio';
        const newStr = newVal !== undefined && newVal !== null ? JSON.stringify(newVal) : 'Vazio';
        return `${formatKeyName(key)}: ${oldStr} -> ${newStr}`;
      })
      .join(' | ');
  }

  const parts: string[] = [];
  if (detalhes.justificativa) parts.push(`Justificativa: ${detalhes.justificativa}`);
  if (detalhes.motivo) parts.push(`Motivo: ${detalhes.motivo}`);
  if (detalhes.observacao) parts.push(`Obs: ${detalhes.observacao}`);

  Object.entries(detalhes).forEach(([k, v]) => {
    if (['justificativa', 'motivo', 'observacao', 'dados_anteriores', 'dados_novos', 'usuario', 'usuario_email'].includes(k)) return;
    if (v !== undefined && v !== null) {
      parts.push(`${formatKeyName(k)}: ${formatValorParaTexto(k, v)}`);
    }
  });

  return parts.join(' | ') || '-';
};

export interface FiltrosAuditoria {
  searchTerm: string;
  dataInicio: string;
  dataFim: string;
  moduloFiltro: string;
  tipoAcaoFiltro: 'todos' | TipoAcaoAuditoria;
  usuarioFiltro: string;
}

/**
 * Filtra os logs de auditoria por busca livre, período, módulo (inferido por
 * palavras-chave na ação), tipo de ação (via getActionConfig) e usuário
 * responsável.
 */
export const filtrarLogsAuditoria = (
  logs: LogAuditoria[],
  { searchTerm, dataInicio, dataFim, moduloFiltro, tipoAcaoFiltro, usuarioFiltro }: FiltrosAuditoria
): LogAuditoria[] => {
  return logs.filter(log => {
    const term = searchTerm.toLowerCase();
    const matchSearch =
      !searchTerm ||
      log.acao.toLowerCase().includes(term) ||
      (log.usuarios?.nome && log.usuarios.nome.toLowerCase().includes(term)) ||
      (log.usuarios?.email && log.usuarios.email.toLowerCase().includes(term)) ||
      (log.detalhes && JSON.stringify(log.detalhes).toLowerCase().includes(term));

    let matchDate = true;
    if (dataInicio && dataFim) {
      const logDate = new Date(log.created_at).getTime();
      matchDate = logDate >= new Date(dataInicio).getTime() && logDate <= new Date(dataFim + 'T23:59:59').getTime();
    } else if (dataInicio) {
      const logDate = new Date(log.created_at).getTime();
      matchDate = logDate >= new Date(dataInicio).getTime();
    } else if (dataFim) {
      const logDate = new Date(log.created_at).getTime();
      matchDate = logDate <= new Date(dataFim + 'T23:59:59').getTime();
    }

    let matchModulo = true;
    if (moduloFiltro !== 'todos') {
      const acaoLower = log.acao.toLowerCase();
      if (moduloFiltro === 'financeiro') {
        matchModulo = acaoLower.includes('receita') || acaoLower.includes('despesa') || acaoLower.includes('parcela') || acaoLower.includes('pagamento') || acaoLower.includes('recebimento');
      } else if (moduloFiltro === 'contrato') {
        matchModulo = acaoLower.includes('contrato') || acaoLower.includes('associado') || acaoLower.includes('dependente');
      } else if (moduloFiltro === 'caixa') {
        matchModulo = acaoLower.includes('caixa') || acaoLower.includes('lote');
      } else if (moduloFiltro === 'backup') {
        matchModulo = acaoLower.includes('backup') || acaoLower.includes('restaurar');
      } else {
        matchModulo = acaoLower.includes(moduloFiltro.toLowerCase());
      }
    }

    let matchTipo = true;
    if (tipoAcaoFiltro !== 'todos') {
      matchTipo = getActionConfig(log.acao).type === tipoAcaoFiltro;
    }

    let matchUsuario = true;
    if (usuarioFiltro !== 'todos') {
      if (usuarioFiltro === 'sistema') {
        matchUsuario = log.usuario_id === 'system' || !log.usuario_id || (Boolean(log.usuarios?.nome) && log.usuarios!.nome.toLowerCase().includes('sistema'));
      } else {
        matchUsuario = log.usuario_id === usuarioFiltro ||
          (Boolean(log.usuarios?.email) && log.usuarios!.email.toLowerCase() === usuarioFiltro.toLowerCase()) ||
          (Boolean(log.usuarios?.nome) && log.usuarios!.nome.toLowerCase() === usuarioFiltro.toLowerCase());
      }
    }

    return matchSearch && matchDate && matchModulo && matchTipo && matchUsuario;
  });
};

export interface EstatisticasAuditoria {
  totalLogs: number;
  logsHoje: number;
  logsUltimos7Dias: number;
  usuariosUnicos: number;
}

/** Estatísticas do topo da tela de Auditoria. `referenceDate` é injetável para tornar o cálculo testável. */
export const calcularEstatisticasAuditoria = (
  logs: LogAuditoria[],
  referenceDate: Date = new Date()
): EstatisticasAuditoria => {
  const totalLogs = logs.length;
  const logsHoje = logs.filter(log => {
    const d = new Date(log.created_at);
    return d.getDate() === referenceDate.getDate() &&
      d.getMonth() === referenceDate.getMonth() &&
      d.getFullYear() === referenceDate.getFullYear();
  }).length;
  const logsUltimos7Dias = logs.filter(log =>
    isWithinInterval(new Date(log.created_at), { start: subDays(referenceDate, 7), end: referenceDate })
  ).length;
  const usuariosUnicos = new Set(logs.map(log => log.usuario_id || log.usuarios?.email || 'anon')).size;

  return { totalLogs, logsHoje, logsUltimos7Dias, usuariosUnicos };
};
