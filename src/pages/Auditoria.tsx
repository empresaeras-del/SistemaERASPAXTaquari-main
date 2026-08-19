import React, { useState, useEffect, useMemo } from 'react';
import { useAppContext } from '../context/AppContext';
import { usePrintPreview } from '../hooks/usePrintPreview';
import { getLogsAuditoria, LogAuditoria } from '../services/auditoriaService';
import { getEmpresaById, Empresa } from '../services/empresasService';
import { fetchImageWithDimensions } from '../utils/imageUtils';
import { 
  ShieldAlert, 
  Search, 
  Clock, 
  User, 
  Activity, 
  Calendar, 
  ArrowRight, 
  FileText, 
  Users, 
  Printer, 
  Download, 
  RefreshCw, 
  Trash2, 
  Edit3, 
  PlusCircle, 
  Database, 
  Copy, 
  Check, 
  ChevronDown, 
  ChevronUp, 
  DollarSign, 
  AlertTriangle, 
  X, 
  RotateCcw, 
  FileCode,
  Tag,
  Sparkles,
  ArrowLeft,
  FileSpreadsheet
} from 'lucide-react';
import { format, isToday, isWithinInterval, subDays, formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import toast from 'react-hot-toast';

// Helper to determine metadata, icons and colors for actions
interface ActionConfig {
  type: 'create' | 'update' | 'delete' | 'backup' | 'finance' | 'general';
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

const getActionConfig = (acao: string): ActionConfig => {
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

// Format key names for human display
const formatKeyName = (key: string): string => {
  const map: Record<string, string> = {
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
    despesa_id: 'ID da Despesa'
  };

  if (map[key]) return map[key];
  return key
    .replace(/_/g, ' ')
    .replace(/\b\w/g, c => c.toUpperCase());
};

// Format details object into readable text for PDF and reports
const formatDetalhesParaTexto = (detalhes: any): string => {
  if (!detalhes) return '-';
  if (typeof detalhes === 'string') return detalhes;

  if (detalhes.dados_anteriores || detalhes.dados_novos) {
    const oldData = detalhes.dados_anteriores || {};
    const newData = detalhes.dados_novos || {};
    const allKeys = Array.from(new Set([...Object.keys(oldData), ...Object.keys(newData)]));
    const changes = allKeys
      .map(k => {
        const o = oldData[k];
        const n = newData[k];
        if (JSON.stringify(o) !== JSON.stringify(n)) {
          const oldStr = o !== undefined && o !== null ? JSON.stringify(o) : 'Vazio';
          const newStr = n !== undefined && n !== null ? JSON.stringify(n) : 'Vazio';
          return `${formatKeyName(k)}: ${oldStr} -> ${newStr}`;
        }
        return null;
      })
      .filter(Boolean);
    return changes.length > 0 ? changes.join(' | ') : 'Sem alterações diretas em campos.';
  }

  const parts: string[] = [];
  if (detalhes.justificativa) parts.push(`Justificativa: ${detalhes.justificativa}`);
  if (detalhes.motivo) parts.push(`Motivo: ${detalhes.motivo}`);
  if (detalhes.observacao) parts.push(`Obs: ${detalhes.observacao}`);

  Object.entries(detalhes).forEach(([k, v]) => {
    if (['justificativa', 'motivo', 'observacao', 'dados_anteriores', 'dados_novos'].includes(k)) return;
    if (v !== undefined && v !== null) {
      if (typeof v === 'number' && k.toLowerCase().includes('valor')) {
        parts.push(`${formatKeyName(k)}: ${new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v)}`);
      } else {
        parts.push(`${formatKeyName(k)}: ${typeof v === 'object' ? JSON.stringify(v) : v}`);
      }
    }
  });

  return parts.join(' | ') || '-';
};

// Format value nicely in UI
const formatValueDisplay = (key: string, val: any): React.ReactNode => {
  if (val === null || val === undefined) return <span className="text-text-subtle italic">Não informado</span>;
  if (typeof val === 'boolean') {
    return (
      <span className={`px-2 py-0.5 rounded text-xs font-semibold ${val ? 'bg-emerald-500/10 text-emerald-600 border border-emerald-500/20' : 'bg-rose-500/10 text-rose-600 border border-rose-500/20'}`}>
        {val ? 'SIM' : 'NÃO'}
      </span>
    );
  }
  if (typeof val === 'number') {
    if (key.toLowerCase().includes('valor')) {
      return (
        <span className="font-semibold text-emerald-600 dark:text-emerald-400 font-mono">
          {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val)}
        </span>
      );
    }
    return <span className="font-semibold text-text-base font-mono">{val.toLocaleString('pt-BR')}</span>;
  }
  if (typeof val === 'object') {
    return <span className="font-mono text-xs text-text-muted">{JSON.stringify(val)}</span>;
  }

  // Strings
  const str = String(val);
  if ((key.toLowerCase().includes('id') || key.toLowerCase().includes('codigo')) && str.length > 20) {
    return <span className="font-mono text-xs bg-bg-hover px-2 py-0.5 rounded border border-border-default text-text-muted">{str}</span>;
  }

  return <span className="text-text-base font-medium break-all">{str}</span>;
};

// Diff Component
const DiffViewer: React.FC<{ oldData: any; newData: any }> = ({ oldData, newData }) => {
  if (!oldData && !newData) return null;
  
  const allKeys = Array.from(new Set([...Object.keys(oldData || {}), ...Object.keys(newData || {})]));
  
  const changes = allKeys.map(key => {
    const oldVal = oldData?.[key];
    const newVal = newData?.[key];
    if (JSON.stringify(oldVal) !== JSON.stringify(newVal)) {
      return { key, oldVal, newVal };
    }
    return null;
  }).filter(Boolean);

  if (changes.length === 0) {
    return (
      <div className="text-xs text-text-subtle italic py-1">
        Nenhuma alteração direta nos campos detectada.
      </div>
    );
  }

  return (
    <div className="space-y-2.5">
      <div className="flex items-center gap-2 pb-1.5 border-b border-border-default">
        <Sparkles className="w-3.5 h-3.5 text-blue-500" />
        <span className="text-xs font-bold uppercase tracking-wider text-text-subtle">Campos Modificados</span>
        <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-blue-500/10 text-blue-600 font-semibold">
          {changes.length} {changes.length === 1 ? 'campo' : 'campos'}
        </span>
      </div>

      <div className="grid grid-cols-1 gap-2">
        {changes.map((change, i) => (
          <div key={i} className="flex flex-col md:flex-row md:items-center gap-2 text-xs bg-bg-surface/80 p-2.5 rounded-xl border border-border-default/80 hover:border-blue-500/30 transition-colors">
            <span className="font-mono text-blue-600 dark:text-blue-400 font-semibold min-w-[140px] shrink-0">
              {formatKeyName(change?.key || '')}:
            </span>
            <div className="flex items-center gap-2 flex-1 overflow-hidden flex-wrap sm:flex-nowrap">
              <div className="bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 px-2.5 py-1 rounded-lg line-through truncate max-w-full sm:max-w-[45%]" title={JSON.stringify(change?.oldVal)}>
                {change?.oldVal !== undefined && change?.oldVal !== null ? JSON.stringify(change.oldVal) : 'Vazio'}
              </div>
              <ArrowRight className="w-3.5 h-3.5 text-text-subtle shrink-0" />
              <div className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 font-medium px-2.5 py-1 rounded-lg truncate max-w-full sm:max-w-[45%]" title={JSON.stringify(change?.newVal)}>
                {change?.newVal !== undefined && change?.newVal !== null ? JSON.stringify(change.newVal) : 'Vazio'}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

// Details Card Component
const LogDetailsViewer: React.FC<{ detalhes: any; acao: string }> = ({ detalhes }) => {
  const [showRawJson, setShowRawJson] = useState(false);
  const [copied, setCopied] = useState(false);

  if (!detalhes || (typeof detalhes === 'object' && Object.keys(detalhes).length === 0)) {
    return null;
  }

  const isDiff = detalhes.dados_anteriores || detalhes.dados_novos;
  const isObject = typeof detalhes === 'object' && !Array.isArray(detalhes);

  const handleCopyJson = (e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(JSON.stringify(detalhes, null, 2));
    setCopied(true);
    toast.success('Detalhes copiados em JSON!');
    setTimeout(() => setCopied(false), 2000);
  };

  const calloutText = detalhes.justificativa || detalhes.motivo || detalhes.observacao;

  const standardKeys = isObject
    ? Object.keys(detalhes).filter(
        k => !['dados_anteriores', 'dados_novos', 'justificativa', 'motivo', 'observacao'].includes(k)
      )
    : [];

  return (
    <div className="mt-3 bg-bg-base/70 rounded-xl p-3.5 border border-border-default/60 space-y-3">
      {isDiff ? (
        <DiffViewer oldData={detalhes.dados_anteriores} newData={detalhes.dados_novos} />
      ) : (
        <>
          {standardKeys.length > 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5">
              {standardKeys.map(k => (
                <div 
                  key={k} 
                  className="bg-bg-surface/90 p-2.5 rounded-lg border border-border-default/60 flex flex-col justify-between hover:border-border-default transition-colors"
                >
                  <span className="text-[11px] font-semibold tracking-wider text-text-subtle uppercase truncate mb-1">
                    {formatKeyName(k)}
                  </span>
                  <div className="text-xs truncate">
                    {formatValueDisplay(k, detalhes[k])}
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {calloutText && (
        <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-3 text-xs text-amber-700 dark:text-amber-300 flex items-start gap-2.5">
          <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
          <div className="flex-1">
            <span className="font-bold uppercase tracking-wider text-[10px] block text-amber-800 dark:text-amber-200 mb-0.5">
              Justificativa / Observação:
            </span>
            <p className="italic">{calloutText}</p>
          </div>
        </div>
      )}

      <div className="flex items-center justify-between pt-1 border-t border-border-default/40">
        <button
          type="button"
          onClick={() => setShowRawJson(!showRawJson)}
          className="flex items-center gap-1.5 text-[11px] font-medium text-text-subtle hover:text-text-base transition-colors px-2 py-1 rounded hover:bg-bg-hover"
        >
          <FileCode className="w-3.5 h-3.5 text-text-subtle" />
          <span>{showRawJson ? 'Ocultar JSON bruto' : 'Ver JSON bruto'}</span>
          {showRawJson ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
        </button>

        <button
          type="button"
          onClick={handleCopyJson}
          className="flex items-center gap-1.5 text-[11px] font-medium text-text-subtle hover:text-text-base transition-colors px-2 py-1 rounded hover:bg-bg-hover"
          title="Copiar JSON para a área de transferência"
        >
          {copied ? (
            <>
              <Check className="w-3.5 h-3.5 text-emerald-500" />
              <span className="text-emerald-500">Copiado!</span>
            </>
          ) : (
            <>
              <Copy className="w-3.5 h-3.5" />
              <span>Copiar dados</span>
            </>
          )}
        </button>
      </div>

      {showRawJson && (
        <div className="relative mt-2">
          <pre className="text-[11px] leading-relaxed text-emerald-500 dark:text-emerald-400 font-mono bg-bg-surface p-3 rounded-lg border border-border-default overflow-x-auto max-h-56">
            {JSON.stringify(detalhes, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
};

export const AuditoriaPage: React.FC = () => {
  const { state } = useAppContext();
  
  const [logs, setLogs] = useState<LogAuditoria[]>([]);
  const [loading, setLoading] = useState(true);
  const [empresa, setEmpresa] = useState<Empresa | null>(null);
  
  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [isPreviewPrint, setIsPreviewPrint] = useState(false);
  usePrintPreview(isPreviewPrint);
  const [dataInicio, setDataInicio] = useState('');
  const [dataFim, setDataFim] = useState('');
  const [moduloFiltro, setModuloFiltro] = useState('todos');
  const [tipoAcaoFiltro, setTipoAcaoFiltro] = useState<'todos' | 'create' | 'update' | 'delete' | 'backup' | 'finance'>('todos');

  const loadData = async () => {
    setLoading(true);
    try {
      if (state.empresaSelecionada) {
        const [logsData, empData] = await Promise.all([
          getLogsAuditoria(state.isOnline, state.empresaSelecionada),
          getEmpresaById(state.empresaSelecionada, state.isOnline)
        ]);
        
        setEmpresa(empData);

        // Fallback mock if completely empty
        if (logsData.length === 0) {
          setLogs([
            { 
              id: '1', 
              tenant_id: state.empresaSelecionada, 
              usuario_id: '1', 
              acao: 'Salvar Plano', 
              detalhes: { id: 'pln-1', nome: 'Plano Familiar Master', valor: 85.00 }, 
              created_at: new Date().toISOString(), 
              usuarios: { nome: 'Super Admin', email: 'superadmin@eras.com' } 
            },
            { 
              id: '2', 
              tenant_id: state.empresaSelecionada, 
              usuario_id: '1', 
              acao: 'Gerar Backup Completo do Sistema', 
              detalhes: { file: 'eras_backup_completo_2026-08-19.json', tabelas_incluidas: 22, registros_total: 412 }, 
              created_at: new Date(Date.now() - 3600000).toISOString(), 
              usuarios: { nome: 'Super Admin', email: 'superadmin@eras.com' } 
            },
            { 
              id: '3', 
              tenant_id: state.empresaSelecionada, 
              usuario_id: '1', 
              acao: 'Excluir Associado (Soft Delete)', 
              detalhes: { id: 'assoc-1', justificativa: 'Cancelamento a pedido do titular' }, 
              created_at: new Date(Date.now() - 86400000).toISOString(), 
              usuarios: { nome: 'Super Admin', email: 'superadmin@eras.com' } 
            },
            { 
              id: '4', 
              tenant_id: state.empresaSelecionada, 
              usuario_id: '1', 
              acao: 'Salvar Empresa', 
              detalhes: { 
                dados_anteriores: { nome_fantasia: 'PAX Taquari Antiga' }, 
                dados_novos: { nome_fantasia: 'PAX e Funerária Taquari' } 
              }, 
              created_at: new Date(Date.now() - 172800000).toISOString(), 
              usuarios: { nome: 'Super Admin', email: 'superadmin@eras.com' } 
            },
          ]);
        } else {
          setLogs(logsData);
        }
      } else {
        setLogs([]);
        setEmpresa(null);
      }
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [state.isOnline, state.empresaSelecionada]);

  // Filter logic
  const filteredLogs = useMemo(() => {
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
        const config = getActionConfig(log.acao);
        matchTipo = config.type === tipoAcaoFiltro;
      }

      return matchSearch && matchDate && matchModulo && matchTipo;
    });
  }, [logs, searchTerm, dataInicio, dataFim, moduloFiltro, tipoAcaoFiltro]);

  // Quick period helpers
  const handleSetQuickPeriod = (days: number | 'hoje' | 'limpar') => {
    if (days === 'limpar') {
      setDataInicio('');
      setDataFim('');
      return;
    }
    const today = new Date();
    const todayStr = format(today, 'yyyy-MM-dd');
    if (days === 'hoje') {
      setDataInicio(todayStr);
      setDataFim(todayStr);
    } else {
      const pastDate = subDays(today, days);
      setDataInicio(format(pastDate, 'yyyy-MM-dd'));
      setDataFim(todayStr);
    }
  };

  // Export CSV
  const handleExportCSV = () => {
    if (filteredLogs.length === 0) {
      toast.error('Nenhum registro para exportar.');
      return;
    }

    try {
      const headers = ['ID', 'Data/Hora', 'Ação', 'Módulo', 'Usuário', 'E-mail', 'Detalhes (Texto)', 'JSON Bruto'];
      const rows = filteredLogs.map(log => {
        const config = getActionConfig(log.acao);
        return [
          `"${log.id}"`,
          `"${format(new Date(log.created_at), 'dd/MM/yyyy HH:mm:ss')}"`,
          `"${log.acao.replace(/"/g, '""')}"`,
          `"${config.categoryLabel.replace(/"/g, '""')}"`,
          `"${(log.usuarios?.nome || 'Desconhecido').replace(/"/g, '""')}"`,
          `"${(log.usuarios?.email || 'N/A').replace(/"/g, '""')}"`,
          `"${formatDetalhesParaTexto(log.detalhes).replace(/"/g, '""')}"`,
          `"${JSON.stringify(log.detalhes || {}).replace(/"/g, '""')}"`
        ];
      });

      const csvContent = '\uFEFF' + [headers.join(';'), ...rows.map(r => r.join(';'))].join('\r\n');
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.setAttribute('href', url);
      link.setAttribute('download', `auditoria_logs_${format(new Date(), 'yyyyMMdd_HHmmss')}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      toast.success('Arquivo CSV exportado com sucesso!');
    } catch (err) {
      console.error(err);
      toast.error('Erro ao gerar CSV.');
    }
  };

  // Generate Official PDF Report for Logs
  const handleGerarRelatorioPDF = async () => {
    if (filteredLogs.length === 0) {
      toast.error('Nenhum registro encontrado para gerar relatório.');
      return;
    }

    const toastId = toast.loading('Gerando relatório em PDF...');
    try {
      const doc = new jsPDF('landscape', 'mm', 'a4');
      const pageWidth = doc.internal.pageSize.getWidth(); // ~297mm
      let currentY = 14;

      // 1. Logo / Cabeçalho Empresa
      const nomeEmpresa = empresa?.nome_fantasia || empresa?.razao_social || 'PAX e Funerária Taquari';
      const docEmpresa = empresa?.cnpj ? `CNPJ: ${empresa.cnpj}` : '';
      const contatoEmpresa = [empresa?.telefone, empresa?.email].filter(Boolean).join(' | ');

      if (empresa?.logo_url) {
        try {
          const imgData = await fetchImageWithDimensions(empresa.logo_url);
          if (imgData && imgData.base64) {
            const maxWidth = 50;
            const maxHeight = 20;
            let imgWidth = maxWidth;
            let imgHeight = (imgData.height * maxWidth) / imgData.width;
            if (imgHeight > maxHeight) {
              imgHeight = maxHeight;
              imgWidth = (imgData.width * maxHeight) / imgData.height;
            }
            doc.addImage(imgData.base64, 'PNG', 14, currentY, imgWidth, imgHeight, '', 'FAST');
          }
        } catch (e) {
          console.warn('Erro ao carregar logo para PDF', e);
        }
      }

      // Dados da Empresa (Texto à direita/centro)
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(14);
      doc.setTextColor(30, 41, 59);
      doc.text(nomeEmpresa, 14, currentY + 6);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8.5);
      doc.setTextColor(100, 116, 139);
      if (docEmpresa) {
        doc.text(docEmpresa, 14, currentY + 11);
      }
      if (contatoEmpresa) {
        doc.text(contatoEmpresa, 14, currentY + 15);
      }

      // Título do Relatório
      currentY += 22;
      doc.setFillColor(241, 245, 249);
      doc.rect(14, currentY, pageWidth - 28, 14, 'F');
      
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(12);
      doc.setTextColor(15, 23, 42);
      doc.text('RELATÓRIO DE ATA DE OCORRÊNCIAS (AUDITORIA DO SISTEMA)', 18, currentY + 6.5);

      // Metadados do Relatório (Filtros aplicados)
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(71, 85, 105);

      const periodoTexto = (dataInicio || dataFim) 
        ? `${dataInicio ? format(new Date(dataInicio + 'T12:00:00'), 'dd/MM/yyyy') : 'Início'} até ${dataFim ? format(new Date(dataFim + 'T12:00:00'), 'dd/MM/yyyy') : 'Hoje'}`
        : 'Histórico Completo';

      const filtroModuloTexto = moduloFiltro === 'todos' ? 'Todos os Módulos' : moduloFiltro.toUpperCase();
      const filtroTipoTexto = tipoAcaoFiltro === 'todos' ? 'Todos os Tipos' : tipoAcaoFiltro.toUpperCase();

      doc.text(`Período: ${periodoTexto}  |  Módulo: ${filtroModuloTexto}  |  Tipo: ${filtroTipoTexto}`, 18, currentY + 11);
      doc.text(`Emissão: ${format(new Date(), 'dd/MM/yyyy HH:mm:ss')}  |  Total: ${filteredLogs.length} registros`, pageWidth - 18, currentY + 11, { align: 'right' });

      currentY += 18;

      // Tabela com autoTable
      const tableData = filteredLogs.map((log, index) => {
        const config = getActionConfig(log.acao);
        const dataFormatada = format(new Date(log.created_at), 'dd/MM/yyyy HH:mm:ss');
        const moduloFormatado = `${config.categoryLabel}\n[${config.badgeLabel}]`;
        const usuarioFormatado = `${log.usuarios?.nome || 'Sistema'}\n(${log.usuarios?.email || 'N/A'})`;
        const detalhesTexto = formatDetalhesParaTexto(log.detalhes);

        return [
          (index + 1).toString(),
          dataFormatada,
          moduloFormatado,
          log.acao,
          usuarioFormatado,
          detalhesTexto
        ];
      });

      autoTable(doc, {
        startY: currentY,
        head: [['#', 'Data / Hora', 'Módulo / Tipo', 'Ação / Evento', 'Usuário Responsável', 'Detalhes da Ocorrência / Alterações']],
        body: tableData,
        theme: 'grid',
        headStyles: {
          fillColor: [30, 41, 59],
          textColor: [255, 255, 255],
          fontStyle: 'bold',
          fontSize: 8.5,
          halign: 'left'
        },
        styles: {
          fontSize: 7.5,
          cellPadding: 2.5,
          valign: 'middle',
          overflow: 'linebreak'
        },
        alternateRowStyles: {
          fillColor: [248, 250, 252]
        },
        columnStyles: {
          0: { cellWidth: 10, halign: 'center' },
          1: { cellWidth: 32 },
          2: { cellWidth: 38 },
          3: { cellWidth: 50, fontStyle: 'bold' },
          4: { cellWidth: 46 },
          5: { cellWidth: 'auto' }
        },
        margin: { left: 14, right: 14, bottom: 16 },
        didDrawPage: (data) => {
          const totalPages = doc.getNumberOfPages();
          doc.setFontSize(7.5);
          doc.setTextColor(148, 163, 184);
          doc.text(
            `Página ${data.pageNumber} de ${totalPages}  •  Sistema ERAS - Rastreabilidade e Auditoria`,
            pageWidth - 14,
            202,
            { align: 'right' }
          );
        }
      });

      const filename = `Relatorio_Ata_Ocorrencias_${format(new Date(), 'yyyyMMdd_HHmm')}.pdf`;
      doc.save(filename);
      toast.success('Relatório em PDF gerado com sucesso!', { id: toastId });
    } catch (err) {
      console.error(err);
      toast.error('Erro ao gerar relatório em PDF.', { id: toastId });
    }
  };
  
  // Export PDF Reaberturas
  const handleExportReaberturasPDF = () => {
    try {
      const reaberturas = logs.filter(log => log.acao === 'Reabertura Lote Caixa');
      if (reaberturas.length === 0) {
        toast.error('Nenhum registro de reabertura de caixa encontrado para exportar.');
        return;
      }

      const doc = new jsPDF('landscape');
      
      doc.setFontSize(16);
      doc.text('Relatório de Reaberturas de Caixas', 14, 20);
      
      doc.setFontSize(10);
      doc.text(`Data da Emissão: ${format(new Date(), "dd/MM/yyyy HH:mm")}`, 14, 28);
      
      const tableData = reaberturas.map(log => {
        const dataStr = format(new Date(log.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR });
        const codigoLote = log.detalhes?.codigo || log.detalhes?.id || 'N/A';
        const usuarioAutorizador = log.usuarios?.nome || log.detalhes?.usuario || 'N/A';
        const justificativa = log.detalhes?.justificativa || 'N/A';
        
        return [
          dataStr,
          codigoLote,
          usuarioAutorizador,
          justificativa
        ];
      });

      autoTable(doc, {
        startY: 35,
        head: [['Data / Hora', 'Lote / Sessão', 'Autorizado Por', 'Justificativa']],
        body: tableData,
        theme: 'grid',
        styles: { fontSize: 8, cellPadding: 3 },
        headStyles: { fillColor: [59, 130, 246] },
        columnStyles: {
          0: { cellWidth: 35 },
          1: { cellWidth: 40 },
          2: { cellWidth: 45 },
          3: { cellWidth: 'auto' }
        }
      });

      doc.save(`Relatorio_Reaberturas_Caixa_${format(new Date(), 'yyyyMMdd_HHmm')}.pdf`);
      toast.success('Relatório de reaberturas exportado com sucesso!');
    } catch (error) {
      console.error(error);
      toast.error('Erro ao gerar relatório em PDF.');
    }
  };

  const totalLogs = logs.length;
  const logsHoje = logs.filter(log => isToday(new Date(log.created_at))).length;
  const logsUltimos7Dias = logs.filter(log => 
    isWithinInterval(new Date(log.created_at), { start: subDays(new Date(), 7), end: new Date() })
  ).length;
  const usuariosUnicos = new Set(logs.map(log => log.usuario_id || log.usuarios?.email || 'anon')).size;

  const hasActiveFilters = Boolean(searchTerm || dataInicio || dataFim || moduloFiltro !== 'todos' || tipoAcaoFiltro !== 'todos');

  const clearAllFilters = () => {
    setSearchTerm('');
    setDataInicio('');
    setDataFim('');
    setModuloFiltro('todos');
    setTipoAcaoFiltro('todos');
  };

  const handleEntrarModoImpressao = () => {
    setIsPreviewPrint(true);
    // Também gera ou disponibiliza o PDF
    handleGerarRelatorioPDF();
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12 h-full flex flex-col">
      {/* Top Banner when in Print Preview Mode */}
      {isPreviewPrint ? (
        <div className="bg-amber-500/15 border-2 border-amber-500/30 p-4 rounded-2xl flex flex-col sm:flex-row items-center justify-between gap-3 shadow-md no-print">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-amber-500 text-white font-bold">
              <Printer className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-base text-text-base">Modo de Visualização para Impressão</h3>
              <p className="text-xs text-text-subtle">
                Layout formatado para folha A4 e emissão de relatório oficial.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <button
              type="button"
              onClick={handleGerarRelatorioPDF}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-semibold text-xs sm:text-sm shadow-sm transition-all"
            >
              <Download className="w-4 h-4" />
              <span>Baixar Relatório (PDF)</span>
            </button>

            <button
              type="button"
              onClick={() => window.print()}
              className="flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white rounded-xl font-semibold text-xs sm:text-sm shadow-sm transition-all"
            >
              <Printer className="w-4 h-4" />
              <span>Imprimir Página</span>
            </button>

            <button
              type="button"
              onClick={() => setIsPreviewPrint(false)}
              className="flex items-center gap-1.5 px-3.5 py-2 bg-bg-surface hover:bg-bg-hover text-text-base border border-border-default rounded-xl font-medium text-xs sm:text-sm shadow-sm transition-all"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Voltar ao Sistema</span>
            </button>
          </div>
        </div>
      ) : null}

      {/* Header (Hidden in print preview when printing page) */}
      {!isPreviewPrint && (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-600 text-white shadow-md">
                <ShieldAlert className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-2xl font-bold tracking-tight text-text-base">Ata de Ocorrências</h2>
                <p className="text-text-subtle text-xs sm:text-sm mt-0.5">
                  Logs de auditoria e rastreabilidade detalhada de eventos do sistema.
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <button
              type="button"
              onClick={loadData}
              disabled={loading}
              className="flex items-center gap-2 px-3.5 py-2 bg-bg-surface hover:bg-bg-hover text-text-base border border-border-default rounded-xl font-medium text-xs sm:text-sm transition-colors shadow-sm"
              title="Recarregar logs"
            >
              <RefreshCw className={`w-4 h-4 text-text-muted ${loading ? 'animate-spin' : ''}`} />
              <span className="hidden md:inline">Atualizar</span>
            </button>

            <button
              type="button"
              onClick={handleExportCSV}
              className="flex items-center gap-2 px-3.5 py-2 bg-bg-surface hover:bg-bg-hover text-text-base border border-border-default rounded-xl font-medium text-xs sm:text-sm transition-colors shadow-sm"
              title="Exportar logs filtrados em formato CSV"
            >
              <FileSpreadsheet className="w-4 h-4 text-emerald-500" />
              <span>Exportar CSV</span>
            </button>

            <button 
              type="button"
              onClick={handleExportReaberturasPDF}
              className="flex items-center gap-2 px-3.5 py-2 bg-bg-surface hover:bg-bg-hover text-text-base border border-border-default rounded-xl font-medium text-xs sm:text-sm transition-colors shadow-sm no-print"
              title="Gerar PDF de Reaberturas de Caixas"
            >
              <FileText className="w-4 h-4 text-blue-500" />
              <span className="hidden md:inline">Reaberturas</span>
            </button>

            <button
              type="button"
              onClick={handleEntrarModoImpressao}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-semibold text-xs sm:text-sm transition-all shadow-md hover:shadow-lg"
              title="Gerar Relatório em PDF e Visualizar Impressão"
            >
              <Printer className="w-4 h-4" />
              <span>Imprimir / Gerar PDF</span>
            </button>
          </div>
        </div>
      )}

      {/* KPI Cards (Hidden in Print Preview) */}
      {!isPreviewPrint && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
          <div className="bg-bg-subtle rounded-3xl shadow-sm border border-border-default p-5 flex flex-col justify-between hover:border-blue-500/50 transition-all relative overflow-hidden group">
            <div className="absolute -right-6 -top-6 w-28 h-28 opacity-20 blur-2xl rounded-full bg-gradient-to-tr from-blue-600 to-indigo-600 group-hover:opacity-40 transition-opacity" />
            <div className="flex items-start justify-between mb-3 relative z-10">
              <div className="p-3 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-600 text-white shadow-md">
                <FileText className="w-5 h-5" />
              </div>
              <span className="text-[11px] font-semibold text-blue-600 dark:text-blue-400 bg-blue-500/10 border border-blue-500/20 px-2 py-0.5 rounded-full">
                Histórico
              </span>
            </div>
            <div className="relative z-10">
              <h3 className="text-3xl font-bold text-text-base tracking-tight">{totalLogs}</h3>
              <p className="text-xs font-medium text-text-subtle mt-1">Total de Registros Gravados</p>
            </div>
          </div>
          
          <div className="bg-bg-subtle rounded-3xl shadow-sm border border-border-default p-5 flex flex-col justify-between hover:border-emerald-500/50 transition-all relative overflow-hidden group">
            <div className="absolute -right-6 -top-6 w-28 h-28 opacity-20 blur-2xl rounded-full bg-gradient-to-tr from-emerald-600 to-teal-500 group-hover:opacity-40 transition-opacity" />
            <div className="flex items-start justify-between mb-3 relative z-10">
              <div className="p-3 rounded-2xl bg-gradient-to-tr from-emerald-600 to-teal-500 text-white shadow-md">
                <Clock className="w-5 h-5" />
              </div>
              <span className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-full">
                Hoje
              </span>
            </div>
            <div className="relative z-10">
              <h3 className="text-3xl font-bold text-text-base tracking-tight">{logsHoje}</h3>
              <p className="text-xs font-medium text-text-subtle mt-1">Ações Realizadas Hoje</p>
            </div>
          </div>

          <div className="bg-bg-subtle rounded-3xl shadow-sm border border-border-default p-5 flex flex-col justify-between hover:border-amber-500/50 transition-all relative overflow-hidden group">
            <div className="absolute -right-6 -top-6 w-28 h-28 opacity-20 blur-2xl rounded-full bg-gradient-to-tr from-amber-500 to-orange-500 group-hover:opacity-40 transition-opacity" />
            <div className="flex items-start justify-between mb-3 relative z-10">
              <div className="p-3 rounded-2xl bg-gradient-to-tr from-amber-500 to-orange-500 text-white shadow-md">
                <Calendar className="w-5 h-5" />
              </div>
              <span className="text-[11px] font-semibold text-amber-600 dark:text-amber-400 bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded-full">
                7 Dias
              </span>
            </div>
            <div className="relative z-10">
              <h3 className="text-3xl font-bold text-text-base tracking-tight">{logsUltimos7Dias}</h3>
              <p className="text-xs font-medium text-text-subtle mt-1">Atividade nos Últimos 7 Dias</p>
            </div>
          </div>

          <div className="bg-bg-subtle rounded-3xl shadow-sm border border-border-default p-5 flex flex-col justify-between hover:border-purple-500/50 transition-all relative overflow-hidden group">
            <div className="absolute -right-6 -top-6 w-28 h-28 opacity-20 blur-2xl rounded-full bg-gradient-to-tr from-purple-600 to-pink-500 group-hover:opacity-40 transition-opacity" />
            <div className="flex items-start justify-between mb-3 relative z-10">
              <div className="p-3 rounded-2xl bg-gradient-to-tr from-purple-600 to-pink-500 text-white shadow-md">
                <Users className="w-5 h-5" />
              </div>
              <span className="text-[11px] font-semibold text-purple-600 dark:text-purple-400 bg-purple-500/10 border border-purple-500/20 px-2 py-0.5 rounded-full">
                Equipe
              </span>
            </div>
            <div className="relative z-10">
              <h3 className="text-3xl font-bold text-text-base tracking-tight">{usuariosUnicos}</h3>
              <p className="text-xs font-medium text-text-subtle mt-1">Usuários Ativos no Período</p>
            </div>
          </div>
        </div>
      )}

      {/* When in Print Preview Mode: Printable Report Document Sheet */}
      {isPreviewPrint ? (
        <div className="bg-white text-slate-900 border border-slate-300 rounded-2xl p-6 sm:p-10 shadow-lg space-y-6">
          {/* Printable Header */}
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pb-6 border-b-2 border-slate-800">
            <div>
              <h1 className="text-xl sm:text-2xl font-black text-slate-900 uppercase tracking-tight">
                {empresa?.nome_fantasia || empresa?.razao_social || 'PAX e Funerária Taquari'}
              </h1>
              <p className="text-xs text-slate-600 font-medium mt-0.5">
                {empresa?.cnpj ? `CNPJ: ${empresa.cnpj} ` : ''}
                {empresa?.telefone ? ` • Tel: ${empresa.telefone}` : ''}
              </p>
            </div>
            <div className="text-left sm:text-right">
              <span className="inline-block px-3 py-1 bg-slate-900 text-white text-xs font-bold uppercase tracking-wider rounded">
                Relatório de Auditoria
              </span>
              <p className="text-[11px] text-slate-500 font-mono mt-1">
                Emissão: {format(new Date(), 'dd/MM/yyyy HH:mm:ss')}
              </p>
            </div>
          </div>

          {/* Printable Filter Badges */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-50 p-4 rounded-xl border border-slate-200 text-xs">
            <div>
              <span className="text-[10px] font-bold uppercase text-slate-500 block">Período</span>
              <span className="font-semibold text-slate-800">
                {(dataInicio || dataFim) 
                  ? `${dataInicio ? format(new Date(dataInicio + 'T12:00:00'), 'dd/MM/yyyy') : 'Início'} até ${dataFim ? format(new Date(dataFim + 'T12:00:00'), 'dd/MM/yyyy') : 'Hoje'}`
                  : 'Histórico Completo'}
              </span>
            </div>
            <div>
              <span className="text-[10px] font-bold uppercase text-slate-500 block">Módulo</span>
              <span className="font-semibold text-slate-800">
                {moduloFiltro === 'todos' ? 'Todos os Módulos' : moduloFiltro.toUpperCase()}
              </span>
            </div>
            <div>
              <span className="text-[10px] font-bold uppercase text-slate-500 block">Tipo de Ação</span>
              <span className="font-semibold text-slate-800">
                {tipoAcaoFiltro === 'todos' ? 'Todos os Tipos' : tipoAcaoFiltro.toUpperCase()}
              </span>
            </div>
            <div>
              <span className="text-[10px] font-bold uppercase text-slate-500 block">Total de Ocorrências</span>
              <span className="font-bold text-slate-900">{filteredLogs.length} eventos listados</span>
            </div>
          </div>

          {/* Printable Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse border border-slate-300">
              <thead>
                <tr className="bg-slate-900 text-white">
                  <th className="p-2.5 border border-slate-400 font-bold w-8 text-center">#</th>
                  <th className="p-2.5 border border-slate-400 font-bold w-28">Data / Hora</th>
                  <th className="p-2.5 border border-slate-400 font-bold w-36">Módulo / Categoria</th>
                  <th className="p-2.5 border border-slate-400 font-bold w-48">Ação / Evento</th>
                  <th className="p-2.5 border border-slate-400 font-bold w-44">Responsável</th>
                  <th className="p-2.5 border border-slate-400 font-bold">Detalhes / Dados</th>
                </tr>
              </thead>
              <tbody>
                {filteredLogs.map((log, idx) => {
                  const config = getActionConfig(log.acao);
                  return (
                    <tr key={log.id} className={idx % 2 === 0 ? 'bg-white' : 'bg-slate-50'}>
                      <td className="p-2 border border-slate-300 text-center font-mono text-slate-500">{idx + 1}</td>
                      <td className="p-2 border border-slate-300 font-mono whitespace-nowrap text-slate-700">
                        {format(new Date(log.created_at), 'dd/MM/yyyy HH:mm')}
                      </td>
                      <td className="p-2 border border-slate-300 font-medium text-slate-700">
                        {config.categoryLabel}
                      </td>
                      <td className="p-2 border border-slate-300 font-bold text-slate-900">
                        {log.acao}
                      </td>
                      <td className="p-2 border border-slate-300 text-slate-700">
                        <div className="font-semibold">{log.usuarios?.nome || 'Sistema'}</div>
                        <div className="text-[10px] text-slate-500">{log.usuarios?.email || 'N/A'}</div>
                      </td>
                      <td className="p-2 border border-slate-300 text-slate-700 text-[11px] leading-relaxed">
                        {formatDetalhesParaTexto(log.detalhes)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="pt-6 border-t border-slate-200 flex justify-between items-center text-[10px] text-slate-500">
            <span>Sistema ERAS - Software de Gestão Funerária e Planos PAX</span>
            <span>Documento emitido eletronicamente para fins de auditoria interna</span>
          </div>
        </div>
      ) : (
        /* Normal Interactive Mode Container */
        <div className="bg-bg-subtle rounded-2xl shadow-sm border border-border-default overflow-hidden flex-1 flex flex-col min-h-0">
          {/* Filters Section */}
          <div className="p-4 sm:p-5 border-b border-border-default bg-bg-surface space-y-4 shrink-0">
            <div className="grid grid-cols-1 md:grid-cols-12 gap-3.5 items-end">
              {/* Search Input */}
              <div className="md:col-span-5 relative">
                <label className="block text-[11px] font-bold text-text-subtle mb-1 uppercase tracking-wider">
                  Busca Livre
                </label>
                <div className="relative">
                  <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-text-subtle" />
                  <input 
                    type="text" 
                    placeholder="Buscar ação, usuário, ID, campos..." 
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-9 pr-8 py-2 text-xs sm:text-sm border border-border-default rounded-xl focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500 bg-bg-subtle/50 text-text-base transition-all"
                  />
                  {searchTerm && (
                    <button 
                      onClick={() => setSearchTerm('')}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 p-0.5 rounded-full hover:bg-bg-hover text-text-subtle hover:text-text-base"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>
              
              {/* Module Selector */}
              <div className="md:col-span-3">
                <label className="block text-[11px] font-bold text-text-subtle mb-1 uppercase tracking-wider">
                  Módulo do Sistema
                </label>
                <select
                  value={moduloFiltro}
                  onChange={(e) => setModuloFiltro(e.target.value)}
                  className="w-full px-3 py-2 text-xs sm:text-sm border border-border-default rounded-xl focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500 bg-bg-subtle/50 text-text-base transition-all"
                >
                  <option value="todos">Todos os Módulos</option>
                  <option value="contrato">Contratos / Associados</option>
                  <option value="financeiro">Financeiro / Contas</option>
                  <option value="caixa">Caixas / Lotes</option>
                  <option value="remessa">Faturamento / Remessas</option>
                  <option value="plano">Planos Pax</option>
                  <option value="backup">Backup & Restauração</option>
                  <option value="empresa">Empresas & Unidades</option>
                  <option value="usuario">Usuários & Acesso</option>
                  <option value="atendimento">Atendimentos / Guias</option>
                </select>
              </div>
              
              {/* Date Range */}
              <div className="md:col-span-4 flex items-center gap-2">
                <div className="flex-1">
                  <label className="block text-[11px] font-bold text-text-subtle mb-1 uppercase tracking-wider">
                    Início
                  </label>
                  <input 
                    type="date"
                    value={dataInicio}
                    onChange={(e) => setDataInicio(e.target.value)}
                    className="w-full px-2.5 py-2 text-xs border border-border-default rounded-xl focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500 bg-bg-subtle/50 text-text-base"
                  />
                </div>
                <div className="flex-1">
                  <label className="block text-[11px] font-bold text-text-subtle mb-1 uppercase tracking-wider">
                    Fim
                  </label>
                  <input 
                    type="date"
                    value={dataFim}
                    onChange={(e) => setDataFim(e.target.value)}
                    className="w-full px-2.5 py-2 text-xs border border-border-default rounded-xl focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500 bg-bg-subtle/50 text-text-base"
                  />
                </div>
              </div>
            </div>

            {/* Quick Filter Tags & Period Shortcuts */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2 border-t border-border-default/50">
              {/* Type Tags */}
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 scrollbar-none text-xs">
                <span className="text-[11px] font-semibold text-text-subtle mr-1 uppercase flex items-center gap-1">
                  <Tag className="w-3 h-3" /> Tipo:
                </span>
                <button
                  type="button"
                  onClick={() => setTipoAcaoFiltro('todos')}
                  className={`px-2.5 py-1 rounded-lg font-medium transition-colors whitespace-nowrap text-xs ${
                    tipoAcaoFiltro === 'todos' 
                      ? 'bg-blue-600 text-white shadow-sm' 
                      : 'bg-bg-subtle hover:bg-bg-hover text-text-subtle'
                  }`}
                >
                  Todos
                </button>
                <button
                  type="button"
                  onClick={() => setTipoAcaoFiltro('create')}
                  className={`px-2.5 py-1 rounded-lg font-medium transition-colors whitespace-nowrap text-xs ${
                    tipoAcaoFiltro === 'create' 
                      ? 'bg-emerald-600 text-white shadow-sm' 
                      : 'bg-bg-subtle hover:bg-bg-hover text-text-subtle'
                  }`}
                >
                  Criações
                </button>
                <button
                  type="button"
                  onClick={() => setTipoAcaoFiltro('update')}
                  className={`px-2.5 py-1 rounded-lg font-medium transition-colors whitespace-nowrap text-xs ${
                    tipoAcaoFiltro === 'update' 
                      ? 'bg-blue-500 text-white shadow-sm' 
                      : 'bg-bg-subtle hover:bg-bg-hover text-text-subtle'
                  }`}
                >
                  Edições
                </button>
                <button
                  type="button"
                  onClick={() => setTipoAcaoFiltro('delete')}
                  className={`px-2.5 py-1 rounded-lg font-medium transition-colors whitespace-nowrap text-xs ${
                    tipoAcaoFiltro === 'delete' 
                      ? 'bg-rose-600 text-white shadow-sm' 
                      : 'bg-bg-subtle hover:bg-bg-hover text-text-subtle'
                  }`}
                >
                  Exclusões
                </button>
                <button
                  type="button"
                  onClick={() => setTipoAcaoFiltro('backup')}
                  className={`px-2.5 py-1 rounded-lg font-medium transition-colors whitespace-nowrap text-xs ${
                    tipoAcaoFiltro === 'backup' 
                      ? 'bg-indigo-600 text-white shadow-sm' 
                      : 'bg-bg-subtle hover:bg-bg-hover text-text-subtle'
                  }`}
                >
                  Backup
                </button>
                <button
                  type="button"
                  onClick={() => setTipoAcaoFiltro('finance')}
                  className={`px-2.5 py-1 rounded-lg font-medium transition-colors whitespace-nowrap text-xs ${
                    tipoAcaoFiltro === 'finance' 
                      ? 'bg-amber-600 text-white shadow-sm' 
                      : 'bg-bg-subtle hover:bg-bg-hover text-text-subtle'
                  }`}
                >
                  Financeiro
                </button>
              </div>

              {/* Period Shortcuts & Clear */}
              <div className="flex items-center gap-1.5 shrink-0 text-xs">
                <span className="text-[11px] font-semibold text-text-subtle uppercase">Período:</span>
                <button 
                  type="button"
                  onClick={() => handleSetQuickPeriod('hoje')} 
                  className="px-2 py-0.5 rounded bg-bg-subtle hover:bg-bg-hover text-text-subtle hover:text-text-base text-xs font-medium"
                >
                  Hoje
                </button>
                <button 
                  type="button"
                  onClick={() => handleSetQuickPeriod(7)} 
                  className="px-2 py-0.5 rounded bg-bg-subtle hover:bg-bg-hover text-text-subtle hover:text-text-base text-xs font-medium"
                >
                  7 Dias
                </button>
                <button 
                  type="button"
                  onClick={() => handleSetQuickPeriod(30)} 
                  className="px-2 py-0.5 rounded bg-bg-subtle hover:bg-bg-hover text-text-subtle hover:text-text-base text-xs font-medium"
                >
                  30 Dias
                </button>
                {hasActiveFilters && (
                  <button 
                    type="button"
                    onClick={clearAllFilters}
                    className="px-2 py-0.5 rounded bg-rose-500/10 text-rose-600 dark:text-rose-400 hover:bg-rose-500/20 text-xs font-semibold flex items-center gap-1 ml-1"
                  >
                    <X className="w-3 h-3" /> Limpar
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Results Counter Bar */}
          <div className="px-5 py-2.5 bg-bg-surface/50 border-b border-border-default flex items-center justify-between text-xs text-text-subtle">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-text-base">
                Exibindo {filteredLogs.length} de {logs.length} ocorrências
              </span>
              {hasActiveFilters && (
                <span className="px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-600 dark:text-blue-400 text-[11px] font-medium">
                  Filtros ativos
                </span>
              )}
            </div>
            <span className="text-[11px] text-text-subtle hidden sm:inline">
              Ordenado cronologicamente (mais recentes primeiro)
            </span>
          </div>

          {/* Timeline List */}
          <div className="p-4 sm:p-6 overflow-y-auto flex-1 min-h-0 space-y-6">
            {loading ? (
              <div className="text-center py-16 text-text-subtle flex flex-col items-center justify-center space-y-3">
                <div className="p-4 rounded-2xl bg-blue-500/10 text-blue-500 animate-pulse">
                  <ShieldAlert className="w-8 h-8" />
                </div>
                <p className="font-medium text-sm text-text-base">Carregando logs de auditoria...</p>
                <p className="text-xs text-text-subtle">Consultando registros e histórico de operações.</p>
              </div>
            ) : !state.empresaSelecionada ? (
              <div className="text-center py-16 text-text-subtle flex flex-col items-center justify-center space-y-2">
                <ShieldAlert className="w-10 h-10 text-amber-500 mb-1" />
                <p className="font-semibold text-text-base">Nenhuma empresa selecionada</p>
                <p className="text-xs text-text-subtle">Selecione uma empresa no topo para visualizar os registros de auditoria correspondentes.</p>
              </div>
            ) : filteredLogs.length === 0 ? (
              <div className="text-center py-16 text-text-subtle flex flex-col items-center justify-center space-y-3">
                <div className="p-4 rounded-2xl bg-bg-surface border border-border-default text-text-subtle">
                  <Search className="w-8 h-8 opacity-40" />
                </div>
                <p className="font-semibold text-text-base">Nenhum registro encontrado</p>
                <p className="text-xs text-text-subtle max-w-sm">
                  Não encontramos ocorrências para os filtros informados. Tente ajustar os termos de busca ou o período selecionado.
                </p>
                {hasActiveFilters && (
                  <button
                    type="button"
                    onClick={clearAllFilters}
                    className="mt-2 px-4 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold shadow-sm transition-colors"
                  >
                    Limpar todos os filtros
                  </button>
                )}
              </div>
            ) : (
              <div className="relative border-l-2 border-border-default/80 ml-4 sm:ml-6 space-y-6 pb-6">
                {filteredLogs.map((log) => {
                  const config = getActionConfig(log.acao);
                  const IconComponent = config.icon;
                  const dateObj = new Date(log.created_at);
                  const timeAgo = formatDistanceToNow(dateObj, { addSuffix: true, locale: ptBR });

                  return (
                    <div key={log.id} className="relative pl-6 sm:pl-8 group">
                      {/* Timeline Node Dot */}
                      <div 
                        className={`absolute -left-[11px] top-4 w-5 h-5 rounded-full bg-bg-surface border-2 ${config.dotColor} ring-4 transition-all group-hover:scale-110 flex items-center justify-center`}
                      >
                        <div className="w-1.5 h-1.5 rounded-full bg-current" />
                      </div>
                      
                      {/* Card */}
                      <div className="bg-bg-surface border border-border-default rounded-2xl p-4 sm:p-5 shadow-sm hover:shadow-md hover:border-border-subtle transition-all">
                        {/* Top Row: Action Title, Badges, Time */}
                        <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-3 mb-3">
                          <div className="flex items-center gap-3">
                            <div className={`p-2.5 rounded-xl ${config.iconBg} ${config.iconColor} shrink-0`}>
                              <IconComponent className="w-4 h-4 sm:w-5 sm:h-5" />
                            </div>
                            <div>
                              <div className="flex items-center gap-2 flex-wrap">
                                <h4 className="font-bold text-text-base text-sm sm:text-base tracking-tight">
                                  {log.acao}
                                </h4>
                                <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider border ${config.badgeBg} ${config.badgeText} ${config.badgeBorder}`}>
                                  {config.badgeLabel}
                                </span>
                              </div>
                              <span className="text-[11px] text-text-subtle font-medium">
                                Módulo: {config.categoryLabel}
                              </span>
                            </div>
                          </div>

                          {/* Date & Time Badge */}
                          <div className="flex items-center gap-3 text-xs font-medium text-text-subtle bg-bg-subtle/80 px-3 py-1.5 rounded-xl w-fit border border-border-default/60 shrink-0">
                            <span className="flex items-center gap-1.5" title={format(dateObj, "dd/MM/yyyy HH:mm:ss")}>
                              <Calendar className="w-3.5 h-3.5 text-blue-500" />
                              {format(dateObj, "dd 'de' MMM, yyyy", { locale: ptBR })}
                            </span>
                            <span className="w-1 h-1 rounded-full bg-border-default" />
                            <span className="flex items-center gap-1.5 font-mono">
                              <Clock className="w-3.5 h-3.5 text-blue-500" />
                              {format(dateObj, "HH:mm:ss")}
                            </span>
                            <span className="hidden md:inline text-[11px] text-text-subtle italic">
                              ({timeAgo})
                            </span>
                          </div>
                        </div>
                        
                        {/* User Info Bar */}
                        <div className="flex items-center justify-between gap-3 text-xs text-text-muted bg-bg-subtle/50 p-2.5 sm:p-3 rounded-xl border border-border-default/70 mb-3">
                          <div className="flex items-center gap-2.5">
                            <div className="w-7 h-7 rounded-full bg-blue-600/10 border border-blue-600/20 text-blue-600 flex items-center justify-center font-bold text-xs shrink-0">
                              {log.usuarios?.nome ? log.usuarios.nome.charAt(0).toUpperCase() : <User className="w-3.5 h-3.5" />}
                            </div>
                            <div>
                              <p className="font-semibold text-text-base">
                                {log.usuarios?.nome || 'Operador / Sistema'}
                              </p>
                              <p className="text-[11px] text-text-subtle">
                                {log.usuarios?.email || 'Ação interna do sistema'}
                              </p>
                            </div>
                          </div>

                          <div className="text-[11px] text-text-subtle font-mono px-2 py-1 rounded bg-bg-surface border border-border-default/60 hidden sm:block">
                            ID: {log.id.slice(0, 8)}
                          </div>
                        </div>
                        
                        {/* Details Box */}
                        {log.detalhes && (
                          <LogDetailsViewer detalhes={log.detalhes} acao={log.acao} />
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
