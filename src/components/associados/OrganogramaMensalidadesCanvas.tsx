import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import {
  Search, X, ZoomIn, ZoomOut, RotateCcw, Maximize2, Minimize2,
  Layers, ChevronDown, ChevronRight, User, DollarSign, Calendar,
  CreditCard, CheckCircle2, Clock, AlertCircle, XCircle, Trash2,
  Edit3, Printer, Sparkles, Building2, Wallet, ArrowRight, ShieldAlert,
  HelpCircle, Eye, Info, Check, Plus
} from 'lucide-react';
import { Receita, ParcelaReceber } from '../../services/financeiroService';
import { formatLocalDate } from '../../utils/dateUtils';

interface OrganogramaMensalidadesCanvasProps {
  associado: any;
  receitas: Receita[];
  parcelas: ParcelaReceber[];
  isAdmin: boolean;
  isOnline: boolean;
  onEditReceita: (receita: Receita) => void;
  onDeleteReceita: (receita: Receita) => void;
  onEditParcela: (parcela: ParcelaReceber) => void;
  onDeleteParcela: (parcela: ParcelaReceber) => void;
  onReceberParcela: (parcela: ParcelaReceber) => void;
  onImprimirRecibo: (parcela: ParcelaReceber) => void;
  onOpenGerarModal: () => void;
}

// Cores temáticas para as receitas pai
const PALETA_RECEITAS = [
  { bg: 'from-blue-600/20 to-blue-900/40', border: 'border-blue-500/40', text: 'text-blue-400', badge: 'bg-blue-500/20 text-blue-300 border-blue-500/30', line: '#3B82F6', glow: 'shadow-blue-500/20' },
  { bg: 'from-purple-600/20 to-purple-900/40', border: 'border-purple-500/40', text: 'text-purple-400', badge: 'bg-purple-500/20 text-purple-300 border-purple-500/30', line: '#8B5CF6', glow: 'shadow-purple-500/20' },
  { bg: 'from-amber-600/20 to-amber-900/40', border: 'border-amber-500/40', text: 'text-amber-400', badge: 'bg-amber-500/20 text-amber-300 border-amber-500/30', line: '#F59E0B', glow: 'shadow-amber-500/20' },
  { bg: 'from-emerald-600/20 to-emerald-900/40', border: 'border-emerald-500/40', text: 'text-emerald-400', badge: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30', line: '#10B981', glow: 'shadow-emerald-500/20' },
  { bg: 'from-rose-600/20 to-rose-900/40', border: 'border-rose-500/40', text: 'text-rose-400', badge: 'bg-rose-500/20 text-rose-300 border-rose-500/30', line: '#F43F5E', glow: 'shadow-rose-500/20' },
  { bg: 'from-cyan-600/20 to-cyan-900/40', border: 'border-cyan-500/40', text: 'text-cyan-400', badge: 'bg-cyan-500/20 text-cyan-300 border-cyan-500/30', line: '#06B6D4', glow: 'shadow-cyan-500/20' },
];

export const OrganogramaMensalidadesCanvas: React.FC<OrganogramaMensalidadesCanvasProps> = ({
  associado,
  receitas,
  parcelas,
  isAdmin,
  isOnline,
  onEditReceita,
  onDeleteReceita,
  onEditParcela,
  onDeleteParcela,
  onReceberParcela,
  onImprimirRecibo,
  onOpenGerarModal,
}) => {
  // Canvas Viewport States (Pan & Zoom)
  const [zoom, setZoom] = useState(0.95);
  const [pan, setPan] = useState({ x: 0, y: 30 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Search & Filtering
  const [canvasSearch, setCanvasSearch] = useState('');

  // Expansion State Map (keys: 'root', 'rec_ID')
  const [expandedNodes, setExpandedNodes] = useState<Record<string, boolean>>({
    'root': true,
  });

  // Selected Node for Detail Drawer
  const [selectedNode, setSelectedNode] = useState<{
    type: 'root' | 'receita' | 'parcela';
    data: any;
    receitaPai?: any;
  } | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);

  // Formatar valores monetários
  const formatCurrency = (val: number = 0) =>
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val || 0);

  // Mapeamento estruturado das receitas e suas parcelas vinculadas
  const arvoreDados = useMemo(() => {
    // 1. Mapear parcelas vinculadas a cada receita
    const receitasMapeadas = receitas.map((rec, idx) => {
      const parcelasDaReceita = parcelas
        .filter(p => p.receita_id === rec.id)
        .sort((a, b) => (a.numero_parcela || 0) - (b.numero_parcela || 0));

      const pagas = parcelasDaReceita.filter(p => p.status === 'recebido' || p.status === 'pago');
      const abertas = parcelasDaReceita.filter(p => p.status === 'pendente');
      const atrasadas = parcelasDaReceita.filter(p => p.status === 'vencido' || p.status === 'atrasado');

      const valorTotalReceita = rec.valor_total || parcelasDaReceita.reduce((acc, p) => acc + (p.valor || 0), 0);
      const valorPago = pagas.reduce((acc, p) => acc + (p.valor_recebido || p.valor || 0), 0);
      const valorAberto = abertas.reduce((acc, p) => acc + (p.valor || 0), 0);
      const valorAtrasado = atrasadas.reduce((acc, p) => acc + (p.valor || 0), 0);

      const estilo = PALETA_RECEITAS[idx % PALETA_RECEITAS.length];

      return {
        ...rec,
        parcelas: parcelasDaReceita,
        totalParcelas: parcelasDaReceita.length || rec.qtd_parcelas || 1,
        qtdPagas: pagas.length,
        qtdAbertas: abertas.length,
        qtdAtrasadas: atrasadas.length,
        valorTotalCalculado: valorTotalReceita,
        valorPago,
        valorAberto,
        valorAtrasado,
        progressoPago: parcelasDaReceita.length > 0 ? Math.round((pagas.length / parcelasDaReceita.length) * 100) : 0,
        estilo
      };
    });

    // 2. Verificar se existem parcelas avulsas / sem receita_id correspondente
    const receitaIds = new Set(receitas.map(r => r.id));
    const parcelasOrfas = parcelas.filter(p => !p.receita_id || !receitaIds.has(p.receita_id));

    if (parcelasOrfas.length > 0) {
      const pagasOrfas = parcelasOrfas.filter(p => p.status === 'recebido' || p.status === 'pago');
      const abertasOrfas = parcelasOrfas.filter(p => p.status === 'pendente');
      const atrasadasOrfas = parcelasOrfas.filter(p => p.status === 'vencido' || p.status === 'atrasado');

      const valorTotalOrfas = parcelasOrfas.reduce((acc, p) => acc + (p.valor || 0), 0);
      const valorPagoOrfas = pagasOrfas.reduce((acc, p) => acc + (p.valor_recebido || p.valor || 0), 0);
      const valorAbertoOrfas = abertasOrfas.reduce((acc, p) => acc + (p.valor || 0), 0);
      const valorAtrasadoOrfas = atrasadasOrfas.reduce((acc, p) => acc + (p.valor || 0), 0);

      const estiloOrfas = {
        bg: 'from-slate-700/20 to-slate-900/40',
        border: 'border-slate-500/40',
        text: 'text-slate-300',
        badge: 'bg-slate-500/20 text-slate-300 border-slate-500/30',
        line: '#64748B',
        glow: 'shadow-slate-500/20'
      };

      receitasMapeadas.push({
        id: `avulsas_${associado.id}`,
        tenant_id: associado.empresa_id || 'default',
        tipo_devedor: 'associado',
        associado_id: associado.id,
        associado_nome: associado.nome,
        descricao: 'Cobranças & Mensalidades Avulsas',
        categoria: 'Mensalidades Legadas',
        data_emissao: parcelasOrfas[0]?.data_vencimento || new Date().toISOString(),
        data_inicio_cobranca: parcelasOrfas[0]?.data_vencimento || new Date().toISOString(),
        valor_total: valorTotalOrfas,
        qtd_parcelas: parcelasOrfas.length,
        forma_pagamento_padrao: 'boleto',
        status: 'ativo',
        parcelas: parcelasOrfas.sort((a, b) => new Date(a.data_vencimento).getTime() - new Date(b.data_vencimento).getTime()),
        totalParcelas: parcelasOrfas.length,
        qtdPagas: pagasOrfas.length,
        qtdAbertas: abertasOrfas.length,
        qtdAtrasadas: atrasadasOrfas.length,
        valorTotalCalculado: valorTotalOrfas,
        valorPago: valorPagoOrfas,
        valorAberto: valorAbertoOrfas,
        valorAtrasado: valorAtrasadoOrfas,
        progressoPago: parcelasOrfas.length > 0 ? Math.round((pagasOrfas.length / parcelasOrfas.length) * 100) : 0,
        estilo: estiloOrfas,
        isOrfas: true
      } as any);
    }

    // 3. Totais globais para o nó raiz (Titular)
    const todasPagas = parcelas.filter(p => p.status === 'recebido' || p.status === 'pago');
    const todasAbertas = parcelas.filter(p => p.status === 'pendente');
    const todasAtrasadas = parcelas.filter(p => p.status === 'vencido' || p.status === 'atrasado');

    const totalGeral = parcelas.reduce((acc, p) => acc + (p.valor || 0), 0);
    const totalPagoGeral = todasPagas.reduce((acc, p) => acc + (p.valor_recebido || p.valor || 0), 0);
    const totalAbertoGeral = todasAbertas.reduce((acc, p) => acc + (p.valor || 0), 0);
    const totalAtrasadoGeral = todasAtrasadas.reduce((acc, p) => acc + (p.valor || 0), 0);

    return {
      titular: {
        id: associado.id,
        nome: associado.nome,
        cpf: associado.cpf,
        plano: associado.plano_nome || associado.plano_pax?.nome || 'Plano Padrão',
        totalReceitas: receitasMapeadas.length,
        totalParcelas: parcelas.length,
        totalPagas: todasPagas.length,
        totalAbertas: todasAbertas.length,
        totalAtrasadas: todasAtrasadas.length,
        valorTotalGeral: totalGeral,
        valorPagoGeral: totalPagoGeral,
        valorAbertoGeral: totalAbertoGeral,
        valorAtrasadoGeral: totalAtrasadoGeral,
        percentualQuitado: parcelas.length > 0 ? Math.round((todasPagas.length / parcelas.length) * 100) : 0
      },
      receitas: receitasMapeadas
    };
  }, [associado, receitas, parcelas]);

  // Inicializa a expansão padrão (Nível 2: Raiz e todas as Receitas Pai abertas)
  useEffect(() => {
    const initialMap: Record<string, boolean> = { 'root': true };
    arvoreDados.receitas.forEach(r => {
      initialMap[`rec_${r.id}`] = true;
    });
    setExpandedNodes(initialMap);
  }, [arvoreDados.receitas]);

  // Expandir / Recolher nó
  const toggleNode = useCallback((nodeKey: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setExpandedNodes(prev => ({
      ...prev,
      [nodeKey]: !prev[nodeKey]
    }));
  }, []);

  // Expansão por Níveis pré-definidos
  const setNivelExpansao = (nivel: 1 | 2) => {
    const newMap: Record<string, boolean> = { 'root': true };
    if (nivel === 1) {
      // Abre apenas receitas, recolhe parcelas
      arvoreDados.receitas.forEach(r => {
        newMap[`rec_${r.id}`] = false;
      });
    } else if (nivel === 2) {
      // Abre todas as receitas e suas parcelas
      arvoreDados.receitas.forEach(r => {
        newMap[`rec_${r.id}`] = true;
      });
    }
    setExpandedNodes(newMap);
  };

  const recolherTudo = () => {
    setExpandedNodes({ 'root': false });
  };

  // Efeito de busca em tempo real com auto-expansão
  useEffect(() => {
    if (!canvasSearch.trim()) return;

    const term = canvasSearch.toLowerCase().trim();
    const newExpanded: Record<string, boolean> = { ...expandedNodes, 'root': true };

    arvoreDados.receitas.forEach(r => {
      const receitaMatch = (r.descricao || '').toLowerCase().includes(term) ||
        (r.categoria || '').toLowerCase().includes(term) ||
        (r.status || '').toLowerCase().includes(term);

      const hasMatchingParcela = r.parcelas?.some(p =>
        (p.descricao || '').toLowerCase().includes(term) ||
        (p.status || '').toLowerCase().includes(term) ||
        (p.data_vencimento || '').includes(term) ||
        String(p.valor || '').includes(term) ||
        `parcela ${p.numero_parcela}`.includes(term)
      );

      if (receitaMatch || hasMatchingParcela) {
        newExpanded[`rec_${r.id}`] = true;
      }
    });

    setExpandedNodes(newExpanded);
  }, [canvasSearch, arvoreDados]);

  // Handlers de Pan (Arrasto)
  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0) return;
    setIsDragging(true);
    setDragStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return;
    setPan({
      x: e.clientX - dragStart.x,
      y: e.clientY - dragStart.y
    });
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  // Handler de Zoom por Scroll
  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const zoomFactor = e.deltaY < 0 ? 1.08 : 0.92;
    setZoom(prev => Math.min(Math.max(prev * zoomFactor, 0.35), 2.0));
  };

  const zoomIn = () => setZoom(z => Math.min(z + 0.12, 2.0));
  const zoomOut = () => setZoom(z => Math.max(z - 0.12, 0.35));
  const resetView = () => {
    setZoom(0.95);
    setPan({ x: 0, y: 30 });
  };

  const fitView = () => {
    setZoom(0.8);
    setPan({ x: 0, y: 15 });
  };

  const toggleFullscreen = () => {
    if (!containerRef.current) return;
    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen().then(() => setIsFullscreen(true)).catch(() => {});
    } else {
      document.exitFullscreen().then(() => setIsFullscreen(false)).catch(() => {});
    }
  };

  const isHighlighted = (text: string = '') => {
    if (!canvasSearch.trim()) return false;
    return text.toLowerCase().includes(canvasSearch.toLowerCase().trim());
  };

  return (
    <div
      ref={containerRef}
      className={`relative w-full overflow-hidden select-none bg-[#0a0d14] rounded-3xl border border-border-default shadow-2xl transition-all ${
        isFullscreen ? 'fixed inset-0 z-50 rounded-none h-screen w-screen' : 'h-[680px]'
      }`}
    >
      {/* BACKGROUND DOT-GRID PATTERN */}
      <div
        className="absolute inset-0 pointer-events-none opacity-20"
        style={{
          backgroundImage: `radial-gradient(rgba(59, 130, 246, 0.4) 1px, transparent 1px)`,
          backgroundSize: `${24 * zoom}px ${24 * zoom}px`,
          backgroundPosition: `${pan.x}px ${pan.y}px`,
        }}
      />

      {/* TOP CONTROL TOOLBAR */}
      <div className="absolute top-4 left-4 right-4 z-20 flex flex-wrap items-center justify-between gap-3 pointer-events-none">
        {/* LEFT: SEARCH & LEVEL CONTROLS */}
        <div className="flex items-center gap-2 pointer-events-auto bg-bg-surface/90 backdrop-blur-md p-1.5 rounded-2xl border border-border-default shadow-lg">
          {/* SEARCH BAR */}
          <div className="relative min-w-[200px] md:min-w-[250px]">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-text-subtle" />
            <input
              type="text"
              placeholder="Localizar receita ou parcela..."
              value={canvasSearch}
              onChange={(e) => setCanvasSearch(e.target.value)}
              className="w-full bg-bg-subtle border border-border-default/60 rounded-xl pl-8 pr-7 py-1.5 text-xs text-text-base focus:outline-none focus:border-[#3B82F6] transition-colors"
            />
            {canvasSearch && (
              <button
                type="button"
                onClick={() => setCanvasSearch('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-text-subtle hover:text-text-base"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          <div className="h-4 w-px bg-border-default/80 mx-1 hidden sm:block" />

          {/* LEVEL EXPANSION SELECTOR */}
          <div className="flex items-center gap-1">
            <span className="text-[10px] font-bold uppercase tracking-wider text-text-subtle hidden lg:inline px-1">
              Níveis:
            </span>
            <button
              type="button"
              onClick={() => setNivelExpansao(1)}
              className="px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-bg-subtle text-text-subtle hover:text-text-base hover:bg-bg-hover transition-colors border border-border-default/50"
              title="Mostrar apenas as Receitas Pai"
            >
              1 · Receitas
            </button>
            <button
              type="button"
              onClick={() => setNivelExpansao(2)}
              className="px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-[#3B82F6]/15 text-[#3B82F6] hover:bg-[#3B82F6]/25 transition-colors border border-[#3B82F6]/30 font-bold"
              title="Expandir Todas as Parcelas"
            >
              2 · Parcelas
            </button>
            <button
              type="button"
              onClick={recolherTudo}
              className="p-1 rounded-lg text-text-subtle hover:text-text-base hover:bg-bg-hover transition-colors"
              title="Recolher Tudo"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* RIGHT: ZOOM, GERAR MENSALIDADES & FULLSCREEN CONTROLS */}
        <div className="flex items-center gap-2 pointer-events-auto">
          <button
            type="button"
            onClick={onOpenGerarModal}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-[#3B82F6] hover:bg-[#2563EB] text-white text-xs font-bold rounded-xl shadow-lg shadow-[#3B82F6]/20 transition-all cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Gerar Mensalidades</span>
          </button>

          <div className="flex items-center gap-1 bg-bg-surface/90 backdrop-blur-md p-1.5 rounded-2xl border border-border-default shadow-lg">
            <span className="text-[11px] font-mono font-bold text-text-subtle px-2 min-w-[40px] text-center">
              {Math.round(zoom * 100)}%
            </span>
            <button
              type="button"
              onClick={zoomIn}
              className="p-1.5 rounded-lg text-text-subtle hover:text-text-base hover:bg-bg-hover transition-colors"
              title="Aumentar Zoom (+)"
            >
              <ZoomIn className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={zoomOut}
              className="p-1.5 rounded-lg text-text-subtle hover:text-text-base hover:bg-bg-hover transition-colors"
              title="Diminuir Zoom (-)"
            >
              <ZoomOut className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={fitView}
              className="p-1.5 rounded-lg text-text-subtle hover:text-text-base hover:bg-bg-hover transition-colors"
              title="Enquadrar na Tela"
            >
              <Layers className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={resetView}
              className="p-1.5 rounded-lg text-text-subtle hover:text-text-base hover:bg-bg-hover transition-colors"
              title="Resetar Posição (100%)"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
            <div className="h-4 w-px bg-border-default/80 mx-1" />
            <button
              type="button"
              onClick={toggleFullscreen}
              className="p-1.5 rounded-lg text-text-subtle hover:text-text-base hover:bg-bg-hover transition-colors"
              title={isFullscreen ? "Sair da Tela Cheia" : "Modo Tela Cheia"}
            >
              {isFullscreen ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
            </button>
          </div>
        </div>
      </div>

      {/* INTERACTIVE DRAGGABLE CANVAS CONTAINER */}
      <div
        className="w-full h-full cursor-grab active:cursor-grabbing overflow-hidden flex items-start justify-center pt-24 pb-32"
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onWheel={handleWheel}
      >
        <div
          ref={contentRef}
          className="transition-transform duration-75 origin-top flex flex-col items-center select-none"
          style={{
            transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
          }}
        >
          {/* ============================================================ */}
          {/* NÍVEL 0: ROOT NODE (ASSOCIADO TITULAR) */}
          {/* ============================================================ */}
          <div className="flex flex-col items-center">
            <div
              onClick={() => setSelectedNode({ type: 'root', data: arvoreDados.titular })}
              className={`group relative cursor-pointer bg-gradient-to-b from-[#181d2a] to-[#0f131c] border-2 border-[#3B82F6]/50 hover:border-[#3B82F6] p-4 rounded-2xl shadow-xl shadow-blue-500/10 hover:shadow-blue-500/25 transition-all duration-300 min-w-[340px] max-w-[420px] ${
                isHighlighted(arvoreDados.titular.nome) || isHighlighted(arvoreDados.titular.cpf) ? 'ring-4 ring-yellow-400/50' : ''
              }`}
            >
              {/* Glow Topo */}
              <div className="absolute -top-px left-1/4 right-1/4 h-0.5 bg-gradient-to-r from-transparent via-[#3B82F6] to-transparent" />

              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 bg-[#3B82F6]/15 border border-[#3B82F6]/30 rounded-xl text-[#3B82F6] shadow-inner">
                    <User className="w-6 h-6" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-bold uppercase tracking-widest text-[#3B82F6] block">
                        Titular do Contrato
                      </span>
                      <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-white/10 text-slate-300">
                        {arvoreDados.titular.plano}
                      </span>
                    </div>
                    <h2 className="text-base font-bold text-white tracking-tight leading-snug">
                      {arvoreDados.titular.nome}
                    </h2>
                    <span className="text-xs text-text-subtle font-mono">
                      CPF: {arvoreDados.titular.cpf || 'Não informado'}
                    </span>
                  </div>
                </div>

                {/* Botão de Toggle da Raiz */}
                <button
                  type="button"
                  onClick={(e) => toggleNode('root', e)}
                  className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-[#3B82F6] border border-[#3B82F6]/20 transition-transform"
                  title={expandedNodes['root'] ? "Recolher Receitas" : "Expandir Receitas"}
                >
                  {expandedNodes['root'] ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                </button>
              </div>

              {/* KPIs Resumo do Titular */}
              <div className="grid grid-cols-4 gap-2 mt-3.5 pt-3 border-t border-white/10 text-center">
                <div className="bg-white/5 p-1.5 rounded-lg border border-white/5">
                  <span className="text-[9px] uppercase font-bold text-slate-400 block">Receitas</span>
                  <span className="text-sm font-extrabold text-blue-400">{arvoreDados.titular.totalReceitas}</span>
                </div>
                <div className="bg-white/5 p-1.5 rounded-lg border border-white/5">
                  <span className="text-[9px] uppercase font-bold text-slate-400 block">Pagas</span>
                  <span className="text-sm font-extrabold text-emerald-400">{arvoreDados.titular.totalPagas}</span>
                </div>
                <div className="bg-white/5 p-1.5 rounded-lg border border-white/5">
                  <span className="text-[9px] uppercase font-bold text-slate-400 block">Abertas</span>
                  <span className="text-sm font-extrabold text-amber-400">{arvoreDados.titular.totalAbertas}</span>
                </div>
                <div className="bg-white/5 p-1.5 rounded-lg border border-white/5">
                  <span className="text-[9px] uppercase font-bold text-slate-400 block">Atrasadas</span>
                  <span className="text-sm font-extrabold text-rose-400">{arvoreDados.titular.totalAtrasadas}</span>
                </div>
              </div>

              {/* Barra de Progresso Global */}
              <div className="mt-3 space-y-1">
                <div className="flex justify-between text-[10px] text-text-subtle">
                  <span>Quitado: {formatCurrency(arvoreDados.titular.valorPagoGeral)}</span>
                  <span className="font-bold text-emerald-400">{arvoreDados.titular.percentualQuitado}%</span>
                </div>
                <div className="w-full h-1.5 bg-white/10 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-emerald-500 to-teal-400 transition-all duration-500"
                    style={{ width: `${arvoreDados.titular.percentualQuitado}%` }}
                  />
                </div>
              </div>
            </div>

            {/* CONECTOR VERTICAL DA RAIZ PARA AS RECEITAS */}
            {expandedNodes['root'] && arvoreDados.receitas.length > 0 && (
              <div className="w-0.5 h-10 bg-gradient-to-b from-[#3B82F6]/80 via-blue-500/40 to-blue-500/80 my-0 relative">
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-2 h-2 rounded-full bg-[#3B82F6] animate-ping opacity-40" />
              </div>
            )}
          </div>

          {/* ============================================================ */}
          {/* NÍVEL 1: RECEITAS PAI (Lotes de Contratos, Vendas, Serviços) */}
          {/* ============================================================ */}
          {expandedNodes['root'] && arvoreDados.receitas.length > 0 && (
            <div className="flex flex-col items-center">
              {/* Linha Horizontal Conectora das Receitas */}
              {arvoreDados.receitas.length > 1 && (
                <div className="h-0.5 bg-blue-500/40 w-[80%] max-w-[1200px] mb-6 relative">
                  <div className="absolute left-0 top-1/2 -translate-y-1/2 w-2 h-2 rounded-full bg-blue-500/60" />
                  <div className="absolute right-0 top-1/2 -translate-y-1/2 w-2 h-2 rounded-full bg-blue-500/60" />
                </div>
              )}

              <div className="flex flex-wrap items-start justify-center gap-8 px-4">
                {arvoreDados.receitas.map((receita: any) => {
                  const nodeKey = `rec_${receita.id}`;
                  const isExpanded = expandedNodes[nodeKey];
                  const matchReceita = isHighlighted(receita.descricao) || isHighlighted(receita.categoria);

                  return (
                    <div key={receita.id} className="flex flex-col items-center">
                      {/* CARD DA RECEITA PAI */}
                      <div
                        onClick={() => setSelectedNode({ type: 'receita', data: receita })}
                        className={`group relative cursor-pointer bg-gradient-to-b from-[#141926] to-[#0c1018] border ${receita.estilo.border} hover:border-white/40 p-4 rounded-2xl shadow-xl transition-all duration-300 w-[320px] ${
                          matchReceita ? 'ring-4 ring-yellow-400/50' : ''
                        }`}
                      >
                        {/* Glow superior */}
                        <div className={`absolute -top-px left-1/4 right-1/4 h-0.5 bg-gradient-to-r from-transparent via-${receita.estilo.text.replace('text-', '')} to-transparent opacity-60`} />

                        {/* Topo: Categoria + Status */}
                        <div className="flex items-center justify-between gap-2 mb-2">
                          <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold border uppercase tracking-wider ${receita.estilo.badge}`}>
                            {receita.categoria || 'Receita Mestre'}
                          </span>
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold border ${
                            receita.status === 'quitado' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' :
                            receita.status === 'cancelado' ? 'bg-rose-500/10 text-rose-400 border-rose-500/20' :
                            'bg-blue-500/10 text-blue-400 border-blue-500/20'
                          }`}>
                            {receita.status ? receita.status.toUpperCase() : 'ATIVO'}
                          </span>
                        </div>

                        {/* Título da Receita */}
                        <h3 className="text-sm font-bold text-white tracking-tight mb-1 truncate" title={receita.descricao}>
                          {receita.descricao || 'Contrato de Plano'}
                        </h3>

                        <div className="flex items-center gap-2 text-xs text-text-subtle mb-3">
                          <Calendar className="w-3.5 h-3.5" />
                          <span>Emissão: {formatLocalDate(receita.data_emissao)}</span>
                        </div>

                        {/* Valor e Parcelas */}
                        <div className="bg-white/5 p-2.5 rounded-xl border border-white/5 mb-3">
                          <div className="flex justify-between items-baseline mb-1">
                            <span className="text-[11px] text-text-subtle font-medium">Valor Total:</span>
                            <span className="text-sm font-extrabold text-emerald-400">
                              {formatCurrency(receita.valorTotalCalculado)}
                            </span>
                          </div>
                          <div className="flex justify-between text-[11px] text-text-subtle">
                            <span>Parcelas: <strong>{receita.totalParcelas}x</strong></span>
                            <span>{receita.qtdPagas} pagas · {receita.qtdAbertas + receita.qtdAtrasadas} em aberto</span>
                          </div>
                        </div>

                        {/* Barra de progresso da receita */}
                        <div className="space-y-1 mb-3">
                          <div className="w-full h-1.5 bg-white/10 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-emerald-500 transition-all duration-300"
                              style={{ width: `${receita.progressoPago}%` }}
                            />
                          </div>
                        </div>

                        {/* Ações da Receita: Admin Edit/Delete e Expandir */}
                        <div className="flex items-center justify-between pt-2 border-t border-white/10 gap-2">
                          <div className="flex items-center gap-1">
                            {isAdmin && !receita.isOrfas && (
                              <>
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    onEditReceita(receita);
                                  }}
                                  className="p-1.5 rounded-lg bg-white/5 hover:bg-white/15 text-blue-400 border border-white/10 hover:border-blue-400/40 transition-colors"
                                  title="Editar esta Receita Pai"
                                >
                                  <Edit3 className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    onDeleteReceita(receita);
                                  }}
                                  className="p-1.5 rounded-lg bg-white/5 hover:bg-rose-500/20 text-rose-400 border border-white/10 hover:border-rose-400/40 transition-colors"
                                  title="Excluir Receita e todas as parcelas vinculadas"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </>
                            )}
                          </div>

                          <button
                            type="button"
                            onClick={(e) => toggleNode(nodeKey, e)}
                            className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold bg-white/5 hover:bg-white/10 text-slate-200 border border-white/10 transition-colors"
                          >
                            <span>{receita.parcelas.length} parcelas</span>
                            {isExpanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                          </button>
                        </div>
                      </div>

                      {/* CONECTOR VERTICAL DA RECEITA PAI PARA AS PARCELAS */}
                      {isExpanded && receita.parcelas.length > 0 && (
                        <div className="w-0.5 h-8 bg-blue-500/40 my-0 relative" />
                      )}

                      {/* ============================================================ */}
                      {/* NÍVEL 2: PARCELAS VINCULADAS */}
                      {/* ============================================================ */}
                      {isExpanded && receita.parcelas.length > 0 && (
                        <div className="flex flex-col items-center">
                          {/* Grid / Cluster das Parcelas */}
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-w-[480px]">
                            {receita.parcelas.map((parcela: ParcelaReceber) => {
                              const isPendente = parcela.status === 'pendente';
                              const isRecebido = parcela.status === 'recebido' || parcela.status === 'pago';
                              const isVencido = parcela.status === 'vencido' || parcela.status === 'atrasado';
                              const isCancelado = parcela.status === 'cancelado';
                              const matchParc = isHighlighted(parcela.descricao) || isHighlighted(parcela.data_vencimento);

                              return (
                                <div
                                  key={parcela.id}
                                  onClick={() => setSelectedNode({ type: 'parcela', data: parcela, receitaPai: receita })}
                                  className={`group/parc relative cursor-pointer bg-gradient-to-b from-[#10141f] to-[#090c13] border rounded-xl p-3 shadow-md hover:shadow-lg transition-all duration-200 w-[210px] ${
                                    isRecebido ? 'border-emerald-500/30 hover:border-emerald-400/60' :
                                    isVencido ? 'border-rose-500/40 hover:border-rose-400/70' :
                                    isCancelado ? 'border-slate-600/30 hover:border-slate-500/50 opacity-60' :
                                    'border-amber-500/30 hover:border-amber-400/60'
                                  } ${matchParc ? 'ring-2 ring-yellow-400' : ''}`}
                                >
                                  {/* Topo da Parcela: Número e Badge de Status */}
                                  <div className="flex items-center justify-between gap-1 mb-1.5">
                                    <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-white/5 text-slate-300 border border-white/10">
                                      #{parcela.numero_parcela}/{parcela.total_parcelas || receita.totalParcelas}
                                    </span>

                                    <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[9px] font-bold border ${
                                      isRecebido ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30' :
                                      isVencido ? 'bg-rose-500/15 text-rose-400 border-rose-500/30' :
                                      isCancelado ? 'bg-slate-500/15 text-slate-400 border-slate-500/30' :
                                      'bg-amber-500/15 text-amber-400 border-amber-500/30'
                                    }`}>
                                      {isRecebido && <CheckCircle2 className="w-2.5 h-2.5" />}
                                      {isVencido && <AlertCircle className="w-2.5 h-2.5" />}
                                      {isPendente && <Clock className="w-2.5 h-2.5" />}
                                      {parcela.status ? parcela.status.toUpperCase() : 'PENDENTE'}
                                    </span>
                                  </div>

                                  {/* Valor e Vencimento */}
                                  <div className="space-y-0.5 mb-2">
                                    <div className="text-sm font-bold text-white">
                                      {formatCurrency(parcela.valor)}
                                    </div>
                                    <div className="text-[10px] text-text-subtle flex items-center gap-1">
                                      <Calendar className="w-3 h-3 text-slate-400" />
                                      <span>Venc: {formatLocalDate(parcela.data_vencimento)}</span>
                                    </div>
                                    {isRecebido && (
                                      <div className="text-[10px] text-emerald-400 font-medium">
                                        Pago em: {formatLocalDate(parcela.data_recebimento || parcela.data_pagamento || parcela.recebido_em)}
                                      </div>
                                    )}
                                  </div>

                                  {/* Ações da Parcela */}
                                  <div className="flex items-center justify-between pt-1.5 border-t border-white/10 gap-1">
                                    <div className="flex items-center gap-1">
                                      {isPendente || isVencido ? (
                                        <button
                                          type="button"
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            onReceberParcela(parcela);
                                          }}
                                          className="px-2 py-0.5 rounded bg-emerald-500/15 hover:bg-emerald-500/30 text-emerald-400 border border-emerald-500/30 text-[10px] font-bold flex items-center gap-1 transition-colors"
                                          title="Dar baixa / receber esta parcela"
                                        >
                                          <DollarSign className="w-3 h-3" />
                                          <span>Receber</span>
                                        </button>
                                      ) : isRecebido ? (
                                        <button
                                          type="button"
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            onImprimirRecibo(parcela);
                                          }}
                                          className="px-2 py-0.5 rounded bg-blue-500/15 hover:bg-blue-500/30 text-blue-400 border border-blue-500/30 text-[10px] font-bold flex items-center gap-1 transition-colors"
                                          title="Imprimir recibo de pagamento"
                                        >
                                          <Printer className="w-3 h-3" />
                                          <span>Recibo</span>
                                        </button>
                                      ) : null}
                                    </div>

                                    {/* Admin Actions: Edit and Delete */}
                                    {isAdmin && (
                                      <div className="flex items-center gap-1">
                                        <button
                                          type="button"
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            onEditParcela(parcela);
                                          }}
                                          className="p-1 rounded bg-white/5 hover:bg-white/15 text-blue-400 transition-colors"
                                          title="Editar esta parcela"
                                        >
                                          <Edit3 className="w-3 h-3" />
                                        </button>
                                        <button
                                          type="button"
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            onDeleteParcela(parcela);
                                          }}
                                          className="p-1 rounded bg-white/5 hover:bg-rose-500/20 text-rose-400 transition-colors"
                                          title="Excluir esta parcela"
                                        >
                                          <Trash2 className="w-3 h-3" />
                                        </button>
                                      </div>
                                    )}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* CASO NÃO HAJA RECEITAS CADASTRADAS */}
          {arvoreDados.receitas.length === 0 && (
            <div className="mt-8 p-6 bg-[#141926] border border-dashed border-border-default rounded-2xl text-center max-w-md">
              <Building2 className="w-10 h-10 text-text-subtle mx-auto mb-2 opacity-50" />
              <h4 className="text-sm font-bold text-white mb-1">Nenhuma Receita ou Mensalidade Registrada</h4>
              <p className="text-xs text-text-subtle mb-4">
                Este associado ainda não possui lançamentos financeiros de mensalidades cadastrados.
              </p>
              <button
                type="button"
                onClick={onOpenGerarModal}
                className="px-4 py-2 bg-[#3B82F6] hover:bg-blue-600 text-white rounded-xl text-xs font-bold transition-all shadow-lg shadow-blue-500/20"
              >
                Gerar Mensalidades Agora
              </button>
            </div>
          )}
        </div>
      </div>

      {/* ============================================================ */}
      {/* DRAWER LATERAL DE DETALHES DO NÓ SELECIONADO */}
      {/* ============================================================ */}
      {selectedNode && (
        <div className="absolute top-0 right-0 bottom-0 w-[340px] md:w-[380px] bg-[#0c1018]/95 backdrop-blur-xl border-l border-border-default shadow-2xl p-6 z-30 flex flex-col justify-between overflow-y-auto animate-in slide-in-from-right duration-200">
          <div className="space-y-5">
            {/* Header do Drawer */}
            <div className="flex items-center justify-between pb-3 border-b border-white/10">
              <div className="flex items-center gap-2">
                <Info className="w-4 h-4 text-[#3B82F6]" />
                <h3 className="text-sm font-bold text-white uppercase tracking-wider">
                  {selectedNode.type === 'root' ? 'Dados do Associado' :
                   selectedNode.type === 'receita' ? 'Detalhes da Receita Pai' :
                   'Detalhes da Parcela'}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setSelectedNode(null)}
                className="p-1 rounded-lg text-text-subtle hover:text-white hover:bg-white/10 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Conteúdo específico por tipo */}
            {selectedNode.type === 'root' && (
              <div className="space-y-4 text-xs">
                <div>
                  <span className="text-text-subtle block mb-0.5">Nome do Titular:</span>
                  <strong className="text-sm text-white">{selectedNode.data.nome}</strong>
                </div>
                <div>
                  <span className="text-text-subtle block mb-0.5">CPF:</span>
                  <span className="font-mono text-slate-200">{selectedNode.data.cpf || 'Não informado'}</span>
                </div>
                <div>
                  <span className="text-text-subtle block mb-0.5">Plano Contratado:</span>
                  <span className="px-2 py-0.5 rounded bg-blue-500/15 text-blue-300 font-bold border border-blue-500/30">
                    {selectedNode.data.plano}
                  </span>
                </div>

                <div className="p-3 bg-white/5 rounded-xl border border-white/5 space-y-2">
                  <div className="flex justify-between">
                    <span className="text-text-subtle">Total de Receitas Mestre:</span>
                    <strong className="text-white">{selectedNode.data.totalReceitas}</strong>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-text-subtle">Total de Parcelas:</span>
                    <strong className="text-white">{selectedNode.data.totalParcelas}</strong>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-text-subtle">Parcelas Pagas:</span>
                    <strong className="text-emerald-400">{selectedNode.data.totalPagas}</strong>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-text-subtle">Parcelas em Aberto:</span>
                    <strong className="text-amber-400">{selectedNode.data.totalAbertas}</strong>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-text-subtle">Parcelas Atrasadas:</span>
                    <strong className="text-rose-400">{selectedNode.data.totalAtrasadas}</strong>
                  </div>
                  <div className="flex justify-between pt-2 border-t border-white/10">
                    <span className="text-text-subtle">Volume Total:</span>
                    <strong className="text-emerald-400 font-mono text-sm">{formatCurrency(selectedNode.data.valorTotalGeral)}</strong>
                  </div>
                </div>
              </div>
            )}

            {selectedNode.type === 'receita' && (
              <div className="space-y-4 text-xs">
                <div>
                  <span className="text-text-subtle block mb-0.5">Descrição da Receita:</span>
                  <strong className="text-sm text-white">{selectedNode.data.descricao}</strong>
                </div>
                <div className="flex gap-4">
                  <div>
                    <span className="text-text-subtle block mb-0.5">Categoria:</span>
                    <span className="px-2 py-0.5 rounded bg-white/10 text-slate-200 font-semibold">
                      {selectedNode.data.categoria || 'Geral'}
                    </span>
                  </div>
                  <div>
                    <span className="text-text-subtle block mb-0.5">Status:</span>
                    <span className="px-2 py-0.5 rounded bg-blue-500/15 text-blue-300 font-bold">
                      {selectedNode.data.status ? selectedNode.data.status.toUpperCase() : 'ATIVO'}
                    </span>
                  </div>
                </div>
                <div>
                  <span className="text-text-subtle block mb-0.5">Data de Emissão:</span>
                  <span className="text-slate-200">{formatLocalDate(selectedNode.data.data_emissao)}</span>
                </div>
                <div>
                  <span className="text-text-subtle block mb-0.5">Início da Cobrança:</span>
                  <span className="text-slate-200">{formatLocalDate(selectedNode.data.data_inicio_cobranca)}</span>
                </div>

                <div className="p-3 bg-white/5 rounded-xl border border-white/5 space-y-2">
                  <div className="flex justify-between">
                    <span className="text-text-subtle">Valor Total:</span>
                    <strong className="text-emerald-400 font-mono text-sm">{formatCurrency(selectedNode.data.valorTotalCalculado)}</strong>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-text-subtle">Total de Parcelas:</span>
                    <strong className="text-white">{selectedNode.data.totalParcelas}x</strong>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-text-subtle">Total Quitado:</span>
                    <strong className="text-emerald-400">{formatCurrency(selectedNode.data.valorPago)}</strong>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-text-subtle">Saldo Restante:</span>
                    <strong className="text-amber-400">{formatCurrency(selectedNode.data.valorAberto + selectedNode.data.valorAtrasado)}</strong>
                  </div>
                </div>

                {isAdmin && !selectedNode.data.isOrfas && (
                  <div className="pt-2 flex gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        onEditReceita(selectedNode.data);
                        setSelectedNode(null);
                      }}
                      className="flex-1 py-2 bg-[#3B82F6] hover:bg-blue-600 text-white rounded-xl font-bold flex items-center justify-center gap-1.5 shadow-lg shadow-blue-500/20"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                      Editar Receita
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        onDeleteReceita(selectedNode.data);
                        setSelectedNode(null);
                      }}
                      className="px-3 py-2 bg-rose-600/20 hover:bg-rose-600 text-rose-300 hover:text-white rounded-xl font-bold border border-rose-500/30 transition-colors"
                      title="Excluir receita"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}
              </div>
            )}

            {selectedNode.type === 'parcela' && (
              <div className="space-y-4 text-xs">
                <div>
                  <span className="text-text-subtle block mb-0.5">Parcela / Descrição:</span>
                  <strong className="text-sm text-white block">{selectedNode.data.descricao}</strong>
                  <span className="text-[11px] font-mono text-blue-400">
                    Número {selectedNode.data.numero_parcela} de {selectedNode.data.total_parcelas || 1}
                  </span>
                </div>

                <div className="flex gap-4">
                  <div>
                    <span className="text-text-subtle block mb-0.5">Vencimento:</span>
                    <strong className="text-slate-200 text-xs">{formatLocalDate(selectedNode.data.data_vencimento)}</strong>
                  </div>
                  <div>
                    <span className="text-text-subtle block mb-0.5">Valor Nominal:</span>
                    <strong className="text-emerald-400 text-xs">{formatCurrency(selectedNode.data.valor)}</strong>
                  </div>
                </div>

                <div className="p-3 bg-white/5 rounded-xl border border-white/5 space-y-2">
                  <div className="flex justify-between">
                    <span className="text-text-subtle">Status:</span>
                    <span className="uppercase font-bold text-slate-200">{selectedNode.data.status}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-text-subtle">Forma de Pagamento:</span>
                    <span className="uppercase font-semibold text-slate-200">{selectedNode.data.forma_pagamento || 'Boleto'}</span>
                  </div>
                  {selectedNode.data.data_recebimento && (
                    <div className="flex justify-between">
                      <span className="text-text-subtle">Data Recebimento:</span>
                      <strong className="text-emerald-400">{formatLocalDate(selectedNode.data.data_recebimento)}</strong>
                    </div>
                  )}
                  {selectedNode.data.valor_recebido && (
                    <div className="flex justify-between">
                      <span className="text-text-subtle">Valor Recebido:</span>
                      <strong className="text-emerald-400">{formatCurrency(selectedNode.data.valor_recebido)}</strong>
                    </div>
                  )}
                  {selectedNode.data.recebido_por && (
                    <div className="flex justify-between">
                      <span className="text-text-subtle">Recebido Por:</span>
                      <span className="text-slate-300">{selectedNode.data.recebido_por}</span>
                    </div>
                  )}
                </div>

                {/* Ações de Baixa / Recibo / Edição */}
                <div className="space-y-2 pt-2">
                  {(selectedNode.data.status === 'pendente' || selectedNode.data.status === 'vencido') && (
                    <button
                      type="button"
                      onClick={() => {
                        onReceberParcela(selectedNode.data);
                        setSelectedNode(null);
                      }}
                      className="w-full py-2.5 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl font-bold flex items-center justify-center gap-1.5 shadow-lg shadow-emerald-500/20"
                    >
                      <DollarSign className="w-4 h-4" />
                      Dar Baixa / Registrar Recebimento
                    </button>
                  )}

                  {(selectedNode.data.status === 'recebido' || selectedNode.data.status === 'pago') && (
                    <button
                      type="button"
                      onClick={() => {
                        onImprimirRecibo(selectedNode.data);
                      }}
                      className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold flex items-center justify-center gap-1.5 shadow-lg shadow-blue-500/20"
                    >
                      <Printer className="w-4 h-4" />
                      Visualizar Recibo de Pagamento
                    </button>
                  )}

                  {isAdmin && (
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          onEditParcela(selectedNode.data);
                          setSelectedNode(null);
                        }}
                        className="flex-1 py-2 bg-white/10 hover:bg-white/20 text-slate-200 rounded-xl font-bold flex items-center justify-center gap-1.5 border border-white/10"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                        Editar Parcela
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          onDeleteParcela(selectedNode.data);
                          setSelectedNode(null);
                        }}
                        className="px-3 py-2 bg-rose-600/20 hover:bg-rose-600 text-rose-300 hover:text-white rounded-xl font-bold border border-rose-500/30 transition-colors"
                        title="Excluir parcela"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          <div className="pt-4 border-t border-white/10 text-center">
            <button
              type="button"
              onClick={() => setSelectedNode(null)}
              className="text-xs text-text-subtle hover:text-white font-medium"
            >
              Fechar Painel
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
