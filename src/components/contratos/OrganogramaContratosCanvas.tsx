import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { 
  Plus, Minus, Maximize2, Minimize2, ZoomIn, ZoomOut, RotateCcw, 
  Search, Shield, Users, User, Heart, ChevronDown, ChevronRight,
  FileText, Calendar, CreditCard, Sparkles, Building2, Eye, X,
  Download, Layers, Phone, Mail, MapPin, CheckCircle2, AlertCircle, XCircle
} from 'lucide-react';
import { Associado, Dependente } from '../../services/associadosService';
import { PlanoPaxCompleto } from '../../types/planosPax';
import { formatLocalDate } from '../../utils/dateUtils';

interface OrganogramaContratosCanvasProps {
  associados: Associado[];
  planos: PlanoPaxCompleto[];
  empresaNome?: string;
  onSelectAssociado?: (associado: Associado) => void;
  statusFilter?: string;
  planoFilter?: string;
}

// Cores temáticas por índice de plano
const PALETA_PLANOS = [
  { bg: 'from-blue-600/20 to-blue-900/40', border: 'border-blue-500/50', text: 'text-blue-400', badge: 'bg-blue-500/20 text-blue-300 border-blue-500/30', line: '#3B82F6', glow: 'shadow-blue-500/20' },
  { bg: 'from-amber-600/20 to-amber-900/40', border: 'border-amber-500/50', text: 'text-amber-400', badge: 'bg-amber-500/20 text-amber-300 border-amber-500/30', line: '#F59E0B', glow: 'shadow-amber-500/20' },
  { bg: 'from-emerald-600/20 to-emerald-900/40', border: 'border-emerald-500/50', text: 'text-emerald-400', badge: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30', line: '#10B981', glow: 'shadow-emerald-500/20' },
  { bg: 'from-purple-600/20 to-purple-900/40', border: 'border-purple-500/50', text: 'text-purple-400', badge: 'bg-purple-500/20 text-purple-300 border-purple-500/30', line: '#8B5CF6', glow: 'shadow-purple-500/20' },
  { bg: 'from-rose-600/20 to-rose-900/40', border: 'border-rose-500/50', text: 'text-rose-400', badge: 'bg-rose-500/20 text-rose-300 border-rose-500/30', line: '#F43F5E', glow: 'shadow-rose-500/20' },
  { bg: 'from-cyan-600/20 to-cyan-900/40', border: 'border-cyan-500/50', text: 'text-cyan-400', badge: 'bg-cyan-500/20 text-cyan-300 border-cyan-500/30', line: '#06B6D4', glow: 'shadow-cyan-500/20' },
];

export const OrganogramaContratosCanvas: React.FC<OrganogramaContratosCanvasProps> = ({
  associados,
  planos,
  empresaNome = "PAX & Funerária Taquari",
  onSelectAssociado,
  statusFilter = "todos",
  planoFilter = "todos",
}) => {
  // Canvas Viewport States (Pan & Zoom)
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 40 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [isFullscreen, setIsFullscreen] = useState(false);
  
  // Search & Filtering
  const [canvasSearch, setCanvasSearch] = useState('');
  
  // Expansion State Map (keys: 'root', 'plano_ID', 'assoc_ID')
  const [expandedNodes, setExpandedNodes] = useState<Record<string, boolean>>({
    'root': true,
  });

  // Selected Node for Detail Drawer
  const [selectedNode, setSelectedNode] = useState<{
    type: 'root' | 'plano' | 'associado' | 'dependente';
    data: any;
    planoInfo?: any;
    titularInfo?: Associado;
  } | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);

  // Inicializa a expansão padrão (Nível 2: Raiz e Planos abertos)
  useEffect(() => {
    const initialMap: Record<string, boolean> = { 'root': true };
    planos.forEach(p => {
      initialMap[`plano_${p.id}`] = true;
    });
    setExpandedNodes(initialMap);
  }, [planos]);

  // Agrupamento hierárquico: Planos -> Contratos -> Dependentes
  const arvoreDados = useMemo(() => {
    // Filtrar associados de acordo com status e plano
    const associadosFiltrados = associados.filter(a => {
      const matchStatus = statusFilter === 'todos' || a.status === statusFilter;
      const matchPlano = planoFilter === 'todos' || a.plano_pax_id === planoFilter;
      return matchStatus && matchPlano;
    });

    // Planos mapeados com seus associados
    const planosMapeados = planos
      .filter(p => planoFilter === 'todos' || p.id === planoFilter)
      .map((plano, idx) => {
        const associadosDoPlano = associadosFiltrados.filter(a => a.plano_pax_id === plano.id);
        const totalVidasPlano = associadosDoPlano.reduce((acc, curr) => acc + (curr.n_vidas || (curr.dependentes?.length ? curr.dependentes.length + 1 : 1)), 0);
        const receitaMensal = associadosDoPlano.reduce((acc, curr) => acc + (curr.valor_plano || 0), 0);
        const estilo = PALETA_PLANOS[idx % PALETA_PLANOS.length];

        return {
          ...plano,
          associados: associadosDoPlano,
          totalContratos: associadosDoPlano.length,
          totalVidas: totalVidasPlano,
          receitaMensal,
          estilo
        };
      });

    const totalContratosGeral = associadosFiltrados.length;
    const totalVidasGeral = associadosFiltrados.reduce((acc, curr) => acc + (curr.n_vidas || (curr.dependentes?.length ? curr.dependentes.length + 1 : 1)), 0);
    const receitaTotalGeral = associadosFiltrados.reduce((acc, curr) => acc + (curr.valor_plano || 0), 0);

    return {
      empresa: {
        nome: empresaNome,
        totalPlanos: planosMapeados.length,
        totalContratos: totalContratosGeral,
        totalVidas: totalVidasGeral,
        receitaTotal: receitaTotalGeral
      },
      planos: planosMapeados
    };
  }, [associados, planos, empresaNome, statusFilter, planoFilter]);

  // Expandir / Recolher nó
  const toggleNode = useCallback((nodeKey: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setExpandedNodes(prev => ({
      ...prev,
      [nodeKey]: !prev[nodeKey]
    }));
  }, []);

  // Expansão por Níveis pré-definidos
  const setNivelExpansao = (nivel: 1 | 2 | 3) => {
    const newMap: Record<string, boolean> = { 'root': true };

    if (nivel >= 2) {
      // Abre todos os planos
      planos.forEach(p => {
        newMap[`plano_${p.id}`] = true;
      });
    }

    if (nivel >= 3) {
      // Abre todos os associados para mostrar dependentes
      associados.forEach(a => {
        newMap[`assoc_${a.id}`] = true;
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

    arvoreDados.planos.forEach(plano => {
      let planoHasMatch = plano.nome.toLowerCase().includes(term) || (plano.codigo && plano.codigo.toLowerCase().includes(term));

      plano.associados.forEach(assoc => {
        const titularMatch = 
          assoc.nome.toLowerCase().includes(term) || 
          assoc.cpf.includes(term) || 
          (assoc.numero_contrato && assoc.numero_contrato.toLowerCase().includes(term));

        const depMatch = assoc.dependentes?.some(d => 
          d.nome.toLowerCase().includes(term) || 
          (d.cpf && d.cpf.includes(term)) ||
          d.parentesco.toLowerCase().includes(term)
        );

        if (titularMatch || depMatch) {
          planoHasMatch = true;
          newExpanded[`plano_${plano.id}`] = true;
        }

        if (depMatch) {
          newExpanded[`assoc_${assoc.id}`] = true;
        }
      });

      if (planoHasMatch) {
        newExpanded[`plano_${plano.id}`] = true;
      }
    });

    setExpandedNodes(newExpanded);
  }, [canvasSearch, arvoreDados]);

  // Handlers de Pan (Arrasto)
  const handleMouseDown = (e: React.MouseEvent) => {
    // Apenas com o botão esquerdo e se não estiver clicando em controles
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
    const zoomFactor = e.deltaY < 0 ? 1.1 : 0.9;
    setZoom(prev => Math.min(Math.max(prev * zoomFactor, 0.3), 2.2));
  };

  // Controles de Zoom
  const zoomIn = () => setZoom(z => Math.min(z + 0.15, 2.2));
  const zoomOut = () => setZoom(z => Math.max(z - 0.15, 0.3));
  const resetView = () => {
    setZoom(1);
    setPan({ x: 0, y: 40 });
  };

  // Centralizar na tela
  const fitView = () => {
    setZoom(0.85);
    setPan({ x: 0, y: 20 });
  };

  // Toggle Fullscreen
  const toggleFullscreen = () => {
    if (!containerRef.current) return;
    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen().then(() => setIsFullscreen(true)).catch(() => {});
    } else {
      document.exitFullscreen().then(() => setIsFullscreen(false)).catch(() => {});
    }
  };

  // Verifica se o nó atende ao termo de busca
  const isHighlighted = (text: string = '') => {
    if (!canvasSearch.trim()) return false;
    return text.toLowerCase().includes(canvasSearch.toLowerCase().trim());
  };

  return (
    <div 
      ref={containerRef}
      className={`relative w-full overflow-hidden select-none bg-[#0a0d14] rounded-3xl border border-border-default shadow-2xl transition-all ${
        isFullscreen ? 'fixed inset-0 z-50 rounded-none h-screen w-screen' : 'h-[750px]'
      }`}
    >
      {/* BACKGROUND DOT-GRID PATTERN */}
      <div 
        className="absolute inset-0 pointer-events-none opacity-25"
        style={{
          backgroundImage: `radial-gradient(rgba(200, 168, 75, 0.3) 1px, transparent 1px)`,
          backgroundSize: `${24 * zoom}px ${24 * zoom}px`,
          backgroundPosition: `${pan.x}px ${pan.y}px`,
        }}
      />

      {/* TOP CONTROL TOOLBAR */}
      <div className="absolute top-4 left-4 right-4 z-20 flex flex-wrap items-center justify-between gap-3 pointer-events-none">
        
        {/* LEFT: SEARCH & LEVEL CONTROLS */}
        <div className="flex items-center gap-2 pointer-events-auto bg-bg-surface/90 backdrop-blur-md p-1.5 rounded-2xl border border-border-default shadow-lg">
          
          {/* SEARCH BAR */}
          <div className="relative min-w-[200px] md:min-w-[260px]">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-text-subtle" />
            <input
              type="text"
              placeholder="Localizar no organograma..."
              value={canvasSearch}
              onChange={(e) => setCanvasSearch(e.target.value)}
              className="w-full bg-bg-subtle border border-border-default/60 rounded-xl pl-9 pr-7 py-1.5 text-xs text-text-base focus:outline-none focus:border-[#3B82F6] transition-colors"
            />
            {canvasSearch && (
              <button 
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
              onClick={() => setNivelExpansao(1)}
              className="px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-bg-subtle text-text-subtle hover:text-text-base hover:bg-bg-hover transition-colors border border-border-default/50"
              title="Mostrar apenas os Planos"
            >
              1 · Planos
            </button>
            <button
              onClick={() => setNivelExpansao(2)}
              className="px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-bg-subtle text-text-subtle hover:text-text-base hover:bg-bg-hover transition-colors border border-border-default/50"
              title="Expandir até Contratos"
            >
              2 · Contratos
            </button>
            <button
              onClick={() => setNivelExpansao(3)}
              className="px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-[#3B82F6]/15 text-[#3B82F6] hover:bg-[#3B82F6]/25 transition-colors border border-[#3B82F6]/30 font-bold"
              title="Expandir Todos os Dependentes"
            >
              3 · Tudo
            </button>
            <button
              onClick={recolherTudo}
              className="p-1 rounded-lg text-text-subtle hover:text-text-base hover:bg-bg-hover transition-colors"
              title="Recolher Tudo"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* RIGHT: ZOOM & FULLSCREEN CONTROLS */}
        <div className="flex items-center gap-1.5 pointer-events-auto bg-bg-surface/90 backdrop-blur-md p-1.5 rounded-2xl border border-border-default shadow-lg">
          <span className="text-[11px] font-mono font-bold text-text-subtle px-2 min-w-[45px] text-center">
            {Math.round(zoom * 100)}%
          </span>
          <button
            onClick={zoomIn}
            className="p-1.5 rounded-lg text-text-subtle hover:text-text-base hover:bg-bg-hover transition-colors"
            title="Aumentar Zoom (+)"
          >
            <ZoomIn className="w-4 h-4" />
          </button>
          <button
            onClick={zoomOut}
            className="p-1.5 rounded-lg text-text-subtle hover:text-text-base hover:bg-bg-hover transition-colors"
            title="Diminuir Zoom (-)"
          >
            <ZoomOut className="w-4 h-4" />
          </button>
          <button
            onClick={fitView}
            className="p-1.5 rounded-lg text-text-subtle hover:text-text-base hover:bg-bg-hover transition-colors"
            title="Enquadrar na Tela"
          >
            <Layers className="w-4 h-4" />
          </button>
          <button
            onClick={resetView}
            className="p-1.5 rounded-lg text-text-subtle hover:text-text-base hover:bg-bg-hover transition-colors"
            title="Resetar Posição e Zoom (100%)"
          >
            <RotateCcw className="w-4 h-4" />
          </button>
          <div className="h-4 w-px bg-border-default/80 mx-1" />
          <button
            onClick={toggleFullscreen}
            className="p-1.5 rounded-lg text-text-subtle hover:text-text-base hover:bg-bg-hover transition-colors"
            title={isFullscreen ? "Sair da Tela Cheia" : "Modo Tela Cheia"}
          >
            {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* INTERACTIVE DRAGGABLE CANVAS CONTAINER */}
      <div 
        className={`w-full h-full cursor-grab active:cursor-grabbing overflow-hidden flex items-start justify-center pt-24 pb-32`}
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
          {/* NÍVEL 0: ROOT NODE (EMPRESA / PAX CENTRAL) */}
          {/* ============================================================ */}
          <div className="flex flex-col items-center">
            <div 
              onClick={() => setSelectedNode({ type: 'root', data: arvoreDados.empresa })}
              className="group relative cursor-pointer bg-gradient-to-b from-[#181d2a] to-[#0f131c] border-2 border-amber-500/40 hover:border-amber-400 p-4 rounded-2xl shadow-xl shadow-amber-500/10 hover:shadow-amber-500/25 transition-all duration-300 min-w-[320px] max-w-[380px]"
            >
              {/* Efeito Glow Topo */}
              <div className="absolute -top-px left-1/4 right-1/4 h-0.5 bg-gradient-to-r from-transparent via-amber-400 to-transparent" />
              
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 bg-amber-500/15 border border-amber-500/30 rounded-xl text-amber-400 shadow-inner">
                    <Building2 className="w-6 h-6" />
                  </div>
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-widest text-amber-400/90 block">
                      Gestão Central de Contratos
                    </span>
                    <h2 className="text-base font-bold text-white tracking-tight">
                      {arvoreDados.empresa.nome}
                    </h2>
                  </div>
                </div>

                {/* Botão de Toggle da Raiz */}
                <button
                  onClick={(e) => toggleNode('root', e)}
                  className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-amber-400 border border-amber-500/20 transition-transform"
                  title={expandedNodes['root'] ? "Recolher Planos" : "Expandir Planos"}
                >
                  {expandedNodes['root'] ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                </button>
              </div>

              {/* KPIs Resumo da Empresa */}
              <div className="grid grid-cols-3 gap-2 mt-3.5 pt-3 border-t border-white/10 text-center">
                <div className="bg-white/5 p-1.5 rounded-lg border border-white/5">
                  <span className="text-[9px] uppercase font-bold text-slate-400 block">Planos</span>
                  <span className="text-sm font-extrabold text-amber-300">{arvoreDados.empresa.totalPlanos}</span>
                </div>
                <div className="bg-white/5 p-1.5 rounded-lg border border-white/5">
                  <span className="text-[9px] uppercase font-bold text-slate-400 block">Contratos</span>
                  <span className="text-sm font-extrabold text-blue-400">{arvoreDados.empresa.totalContratos}</span>
                </div>
                <div className="bg-white/5 p-1.5 rounded-lg border border-white/5">
                  <span className="text-[9px] uppercase font-bold text-slate-400 block">Total Vidas</span>
                  <span className="text-sm font-extrabold text-emerald-400">{arvoreDados.empresa.totalVidas}</span>
                </div>
              </div>
            </div>

            {/* CONECTOR VERTICAL DA RAIZ PARA OS PLANOS */}
            {expandedNodes['root'] && arvoreDados.planos.length > 0 && (
              <div className="w-0.5 h-12 bg-gradient-to-b from-amber-500/60 via-blue-500/40 to-blue-500/80 my-0 relative">
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-2 h-2 rounded-full bg-amber-400 animate-ping opacity-40" />
              </div>
            )}
          </div>

          {/* ============================================================ */}
          {/* NÍVEL 1: PLANOS PAX ATIVOS */}
          {/* ============================================================ */}
          {expandedNodes['root'] && (
            <div className="flex items-start justify-center gap-10 relative pt-2">
              {/* Linha horizontal superior que conecta todos os planos */}
              {arvoreDados.planos.length > 1 && (
                <div 
                  className="absolute top-0 h-0.5 bg-gradient-to-r from-transparent via-blue-500/50 to-transparent"
                  style={{
                    left: '10%',
                    right: '10%',
                  }}
                />
              )}

              {arvoreDados.planos.map((plano) => {
                const isPlanoExpanded = expandedNodes[`plano_${plano.id}`];
                const matchPlano = isHighlighted(plano.nome) || (plano.codigo && isHighlighted(plano.codigo));

                return (
                  <div key={plano.id} className="flex flex-col items-center relative">
                    {/* Linha conectora vertical superior descendo para o plano */}
                    <div className="w-0.5 h-8 bg-blue-500/50 -mt-2 mb-0" />

                    {/* CARD DO PLANO */}
                    <div 
                      onClick={() => setSelectedNode({ type: 'plano', data: plano })}
                      className={`group cursor-pointer relative bg-gradient-to-b ${plano.estilo.bg} bg-[#111622] border ${
                        matchPlano ? 'border-amber-400 ring-2 ring-amber-400/50 shadow-amber-400/20' : plano.estilo.border
                      } hover:border-white/50 p-4 rounded-2xl shadow-lg ${plano.estilo.glow} transition-all duration-300 w-[290px]`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2.5">
                          <div className={`p-2 rounded-xl bg-black/40 border ${plano.estilo.border} ${plano.estilo.text}`}>
                            <Shield className="w-5 h-5" />
                          </div>
                          <div>
                            <span className="text-[10px] font-mono font-bold text-slate-400 block">
                              {plano.codigo || 'PLN-PAX'}
                            </span>
                            <h3 className="text-sm font-bold text-white group-hover:text-amber-300 transition-colors">
                              {plano.nome}
                            </h3>
                          </div>
                        </div>

                        {/* Botão de Toggle do Plano */}
                        <button
                          onClick={(e) => toggleNode(`plano_${plano.id}`, e)}
                          className={`p-1.5 rounded-lg bg-black/40 hover:bg-black/60 border ${plano.estilo.border} ${plano.estilo.text} transition-transform flex items-center gap-1`}
                          title={isPlanoExpanded ? "Recolher Contratos" : "Expandir Contratos"}
                        >
                          <span className="text-[10px] font-bold">{plano.totalContratos}</span>
                          {isPlanoExpanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                        </button>
                      </div>

                      {/* Métricas do Plano */}
                      <div className="flex items-center justify-between mt-3 pt-2.5 border-t border-white/10 text-xs">
                        <div className="flex items-center gap-1.5 text-slate-300">
                          <Users className="w-3.5 h-3.5 text-slate-400" />
                          <span>{plano.totalVidas} Vidas</span>
                        </div>
                        <div className="font-bold text-emerald-400">
                          R$ {plano.receitaMensal.toFixed(2).replace('.', ',')}
                          <span className="text-[9px] text-slate-400 font-normal"> /mês</span>
                        </div>
                      </div>
                    </div>

                    {/* CONECTOR VERTICAL DESCENDO PARA OS CONTRATOS */}
                    {isPlanoExpanded && plano.associados.length > 0 && (
                      <div className="w-0.5 h-10 bg-slate-600/70 my-0 relative" />
                    )}

                    {/* ============================================================ */}
                    {/* NÍVEL 2: CONTRATOS / ASSOCIADOS TITULARES */}
                    {/* ============================================================ */}
                    {isPlanoExpanded && plano.associados.length > 0 && (
                      <div className="flex flex-col items-center gap-4 relative pt-1">
                        {plano.associados.map((assoc) => {
                          const isAssocExpanded = expandedNodes[`assoc_${assoc.id}`];
                          const totalDependentes = assoc.dependentes?.length || 0;
                          const matchAssoc = isHighlighted(assoc.nome) || isHighlighted(assoc.cpf) || (assoc.numero_contrato && isHighlighted(assoc.numero_contrato));

                          return (
                            <div key={assoc.id} className="flex flex-col items-center relative">
                              {/* CARD DO CONTRATO / ASSOCIADO */}
                              <div
                                onClick={() => setSelectedNode({ type: 'associado', data: assoc, planoInfo: plano })}
                                className={`group cursor-pointer relative bg-[#131722] hover:bg-[#181e2b] border ${
                                  matchAssoc 
                                    ? 'border-amber-400 ring-2 ring-amber-400/50 shadow-amber-400/30' 
                                    : assoc.status === 'inadimplente'
                                    ? 'border-rose-500/40 hover:border-rose-400'
                                    : 'border-slate-700/60 hover:border-blue-400/60'
                                } p-3.5 rounded-xl shadow-md hover:shadow-lg transition-all duration-200 w-[275px]`}
                              >
                                <div className="flex items-start justify-between gap-2">
                                  <div className="flex items-center gap-2.5">
                                    <div className="w-8 h-8 rounded-full bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400 font-bold text-xs shrink-0">
                                      {assoc.nome.charAt(0).toUpperCase()}
                                    </div>
                                    <div className="overflow-hidden">
                                      <div className="flex items-center gap-1.5 mb-0.5">
                                        <span className="font-mono text-[9px] font-bold bg-white/5 text-slate-300 px-1.5 py-0.5 rounded border border-white/10">
                                          {assoc.numero_contrato || `CTR-${assoc.id.substring(0,6).toUpperCase()}`}
                                        </span>
                                        {assoc.status === 'ativo' && (
                                          <span className="w-2 h-2 rounded-full bg-emerald-400" title="Ativo" />
                                        )}
                                        {assoc.status === 'inadimplente' && (
                                          <span className="w-2 h-2 rounded-full bg-rose-400 animate-pulse" title="Inadimplente" />
                                        )}
                                      </div>
                                      <h4 className="text-xs font-bold text-white group-hover:text-blue-300 transition-colors truncate" title={assoc.nome}>
                                        {assoc.nome}
                                      </h4>
                                    </div>
                                  </div>

                                  {/* Botão de Toggle dos Dependentes */}
                                  {totalDependentes > 0 ? (
                                    <button
                                      onClick={(e) => toggleNode(`assoc_${assoc.id}`, e)}
                                      className="p-1 rounded-md bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white border border-white/10 text-[10px] font-semibold flex items-center gap-1 shrink-0"
                                      title={isAssocExpanded ? "Recolher Dependentes" : "Expandir Dependentes"}
                                    >
                                      <span>+{totalDependentes}</span>
                                      {isAssocExpanded ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                                    </button>
                                  ) : (
                                    <span className="text-[9px] text-slate-500 font-semibold px-1.5 py-0.5">Individual</span>
                                  )}
                                </div>

                                {/* Informações Rápidas do Titular */}
                                <div className="grid grid-cols-2 gap-1.5 mt-2.5 pt-2 border-t border-white/5 text-[10px] text-slate-400">
                                  <div>
                                    <span>CPF: </span>
                                    <span className="font-mono text-slate-300">{assoc.cpf}</span>
                                  </div>
                                  <div className="text-right">
                                    <span className="font-bold text-emerald-400">
                                      R$ {assoc.valor_plano ? assoc.valor_plano.toFixed(2).replace('.', ',') : "0,00"}
                                    </span>
                                  </div>
                                </div>
                              </div>

                              {/* CONECTOR VERTICAL DESCENDO PARA OS DEPENDENTES */}
                              {isAssocExpanded && totalDependentes > 0 && (
                                <div className="w-0.5 h-6 bg-slate-700 my-0 relative" />
                              )}

                              {/* ============================================================ */}
                              {/* NÍVEL 3: DEPENDENTES DO CONTRATO */}
                              {/* ============================================================ */}
                              {isAssocExpanded && totalDependentes > 0 && (
                                <div className="flex flex-col items-center gap-2 pl-4 border-l-2 border-dashed border-slate-700/60 my-1">
                                  {assoc.dependentes.map((dep, depIdx) => {
                                    const matchDep = isHighlighted(dep.nome) || (dep.cpf && isHighlighted(dep.cpf)) || isHighlighted(dep.parentesco);

                                    return (
                                      <div
                                        key={dep.id || depIdx}
                                        onClick={() => setSelectedNode({ type: 'dependente', data: dep, titularInfo: assoc, planoInfo: plano })}
                                        className={`group cursor-pointer relative bg-[#0e111a] hover:bg-[#141824] border ${
                                          matchDep 
                                            ? 'border-amber-400 ring-2 ring-amber-400/50 shadow-amber-400/30' 
                                            : 'border-slate-800 hover:border-slate-600'
                                        } p-2.5 rounded-lg shadow-sm w-[250px] transition-all`}
                                      >
                                        <div className="flex items-center justify-between gap-2">
                                          <div className="flex items-center gap-2 min-w-0">
                                            <div className="p-1 rounded-md bg-purple-500/10 text-purple-400 border border-purple-500/20 shrink-0">
                                              <Heart className="w-3 h-3" />
                                            </div>
                                            <div className="min-w-0">
                                              <p className="text-[11px] font-semibold text-slate-200 group-hover:text-purple-300 transition-colors truncate" title={dep.nome}>
                                                {dep.nome}
                                              </p>
                                              <p className="text-[9px] text-slate-400">
                                                {dep.cpf ? `CPF: ${dep.cpf}` : 'Sem CPF informado'}
                                              </p>
                                            </div>
                                          </div>

                                          {/* Badge de Parentesco */}
                                          <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-purple-500/15 text-purple-300 border border-purple-500/30 shrink-0">
                                            {dep.parentesco || 'Dependente'}
                                          </span>
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* ============================================================ */}
      {/* DRAWER LATERAL DE DETALHES DO NÓ SELECIONADO */}
      {/* ============================================================ */}
      {selectedNode && (
        <div className="absolute top-0 right-0 bottom-0 w-full max-w-sm bg-[#0e121c]/95 backdrop-blur-xl border-l border-border-default shadow-2xl p-6 flex flex-col justify-between z-30 animate-in slide-in-from-right duration-200 overflow-y-auto">
          <div>
            {/* DRAWER HEADER */}
            <div className="flex items-center justify-between pb-4 border-b border-white/10">
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-bold uppercase tracking-widest text-[#3B82F6] bg-[#3B82F6]/10 px-2 py-0.5 rounded-md border border-[#3B82F6]/20">
                  {selectedNode.type === 'root' && 'Empresa / Central'}
                  {selectedNode.type === 'plano' && 'Plano PAX'}
                  {selectedNode.type === 'associado' && 'Contrato Titular'}
                  {selectedNode.type === 'dependente' && 'Dependente'}
                </span>
              </div>
              <button
                onClick={() => setSelectedNode(null)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* DRAWER CONTENT CONFORME TIPO */}
            <div className="mt-5 space-y-4 text-xs">
              {/* NÓ EMPRESA / CENTRAL */}
              {selectedNode.type === 'root' && (
                <div className="space-y-4">
                  <div>
                    <h3 className="text-base font-bold text-white">{selectedNode.data.nome}</h3>
                    <p className="text-slate-400 text-xs mt-0.5">Visão consolidada da carteira de associados e planos funerários.</p>
                  </div>
                  <div className="bg-white/5 p-4 rounded-xl space-y-2 border border-white/5">
                    <div className="flex justify-between"><span className="text-slate-400">Total de Planos Ativos:</span><strong className="text-white">{selectedNode.data.totalPlanos}</strong></div>
                    <div className="flex justify-between"><span className="text-slate-400">Total de Contratos:</span><strong className="text-white">{selectedNode.data.totalContratos}</strong></div>
                    <div className="flex justify-between"><span className="text-slate-400">Total de Vidas Protegidas:</span><strong className="text-white">{selectedNode.data.totalVidas}</strong></div>
                    <div className="flex justify-between pt-2 border-t border-white/10"><span className="text-slate-400">Faturamento Mensal Estimado:</span><strong className="text-emerald-400">R$ {selectedNode.data.receitaTotal.toFixed(2).replace('.', ',')}</strong></div>
                  </div>
                </div>
              )}

              {/* NÓ PLANO PAX */}
              {selectedNode.type === 'plano' && (
                <div className="space-y-4">
                  <div>
                    <span className="font-mono text-xs text-[#3B82F6] font-bold">{selectedNode.data.codigo}</span>
                    <h3 className="text-base font-bold text-white mt-0.5">{selectedNode.data.nome}</h3>
                    <p className="text-slate-400 text-xs mt-1">{selectedNode.data.descricao || "Plano de assistência funeral e benefícios familiares."}</p>
                  </div>
                  <div className="bg-white/5 p-4 rounded-xl space-y-2 border border-white/5">
                    <div className="flex justify-between"><span className="text-slate-400">Valor Base da Mensalidade:</span><strong className="text-white">R$ {Number(selectedNode.data.valor_mensalidade || 0).toFixed(2).replace('.', ',')}</strong></div>
                    <div className="flex justify-between"><span className="text-slate-400">Contratos Ativos neste Plano:</span><strong className="text-white">{selectedNode.data.totalContratos}</strong></div>
                    <div className="flex justify-between"><span className="text-slate-400">Vidas Cobertas:</span><strong className="text-white">{selectedNode.data.totalVidas}</strong></div>
                    <div className="flex justify-between pt-2 border-t border-white/10"><span className="text-slate-400">Receita Recorrente:</span><strong className="text-emerald-400">R$ {selectedNode.data.receitaMensal.toFixed(2).replace('.', ',')}</strong></div>
                  </div>
                </div>
              )}

              {/* NÓ ASSOCIADO TITULAR */}
              {selectedNode.type === 'associado' && (
                <div className="space-y-4">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-mono text-xs font-bold text-slate-300 bg-white/10 px-2 py-0.5 rounded">
                        {selectedNode.data.numero_contrato || `CTR-${selectedNode.data.id.substring(0,8).toUpperCase()}`}
                      </span>
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                        selectedNode.data.status === 'ativo' ? 'bg-emerald-500/20 text-emerald-300' : 'bg-rose-500/20 text-rose-300'
                      }`}>
                        {selectedNode.data.status}
                      </span>
                    </div>
                    <h3 className="text-base font-bold text-white">{selectedNode.data.nome}</h3>
                  </div>

                  <div className="bg-white/5 p-4 rounded-xl space-y-2.5 border border-white/5">
                    <div className="flex justify-between"><span className="text-slate-400">CPF:</span><strong className="font-mono text-white">{selectedNode.data.cpf}</strong></div>
                    <div className="flex justify-between"><span className="text-slate-400">Plano Vinculado:</span><strong className="text-[#3B82F6]">{selectedNode.planoInfo?.nome || "Plano PAX"}</strong></div>
                    <div className="flex justify-between"><span className="text-slate-400">Data de Adesão:</span><strong className="text-white">{formatLocalDate(selectedNode.data.data_adesao, 'dd/MM/yyyy', 'Não informada')}</strong></div>
                    <div className="flex justify-between"><span className="text-slate-400">Valor Mensal:</span><strong className="text-emerald-400">R$ {selectedNode.data.valor_plano ? selectedNode.data.valor_plano.toFixed(2).replace('.', ',') : "0,00"}</strong></div>
                    <div className="flex justify-between"><span className="text-slate-400">Total de Dependentes:</span><strong className="text-white">{selectedNode.data.dependentes?.length || 0}</strong></div>
                  </div>

                  {/* LISTA DE DEPENDENTES DO TITULAR */}
                  {selectedNode.data.dependentes && selectedNode.data.dependentes.length > 0 && (
                    <div>
                      <h4 className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-2">
                        Dependentes Vinculados ({selectedNode.data.dependentes.length})
                      </h4>
                      <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                        {selectedNode.data.dependentes.map((dep: Dependente, idx: number) => (
                          <div key={idx} className="p-2 bg-white/5 rounded-lg flex items-center justify-between border border-white/5">
                            <span className="text-slate-200 font-medium">{dep.nome}</span>
                            <span className="text-[9px] uppercase font-bold text-purple-300 bg-purple-500/20 px-1.5 py-0.5 rounded">
                              {dep.parentesco}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* NÓ DEPENDENTE */}
              {selectedNode.type === 'dependente' && (
                <div className="space-y-4">
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-purple-400 bg-purple-500/10 px-2 py-0.5 rounded border border-purple-500/20">
                      {selectedNode.data.parentesco || 'Dependente'}
                    </span>
                    <h3 className="text-base font-bold text-white mt-1.5">{selectedNode.data.nome}</h3>
                  </div>

                  <div className="bg-white/5 p-4 rounded-xl space-y-2.5 border border-white/5">
                    <div className="flex justify-between"><span className="text-slate-400">CPF:</span><strong className="font-mono text-white">{selectedNode.data.cpf || "Não informado"}</strong></div>
                    <div className="flex justify-between"><span className="text-slate-400">Data de Nascimento:</span><strong className="text-white">{selectedNode.data.data_nascimento ? formatLocalDate(selectedNode.data.data_nascimento, 'dd/MM/yyyy') : "Não informada"}</strong></div>
                    <div className="flex justify-between"><span className="text-slate-400">Titular Responsável:</span><strong className="text-[#3B82F6]">{selectedNode.titularInfo?.nome}</strong></div>
                    <div className="flex justify-between"><span className="text-slate-400">Nº do Contrato:</span><strong className="font-mono text-white">{selectedNode.titularInfo?.numero_contrato || 'S/C'}</strong></div>
                    <div className="flex justify-between"><span className="text-slate-400">Plano:</span><strong className="text-amber-300">{selectedNode.planoInfo?.nome}</strong></div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* DRAWER FOOTER ACTION */}
          {selectedNode.type === 'associado' && onSelectAssociado && (
            <div className="pt-4 border-t border-white/10">
              <button
                onClick={() => onSelectAssociado(selectedNode.data)}
                className="w-full py-2.5 px-4 rounded-xl bg-gradient-to-r from-[#3B82F6] to-[#60A5FA] text-white font-bold text-xs hover:opacity-90 transition-opacity flex items-center justify-center gap-2 shadow-lg shadow-blue-500/20"
              >
                <Eye className="w-4 h-4" />
                <span>Ver Ficha Completa</span>
              </button>
            </div>
          )}
        </div>
      )}

      {/* FOOTER TIPS BAR */}
      <div className="absolute bottom-3 left-4 right-4 z-10 flex items-center justify-between text-[11px] text-text-subtle pointer-events-none">
        <div className="flex items-center gap-3 bg-bg-surface/80 backdrop-blur-sm px-3 py-1.5 rounded-xl border border-border-default/50 pointer-events-auto">
          <span>💡 <strong>Dica:</strong> Arraste o canvas para navegar · Use a roda do mouse para Zoom · Clique nos nós para detalhes</span>
        </div>
        <div className="hidden md:flex items-center gap-2 bg-bg-surface/80 backdrop-blur-sm px-3 py-1.5 rounded-xl border border-border-default/50 pointer-events-auto">
          <span className="w-2 h-2 rounded-full bg-emerald-400" />
          <span>Ativos</span>
          <span className="w-2 h-2 rounded-full bg-rose-400 ml-2" />
          <span>Inadimplentes</span>
          <span className="w-2 h-2 rounded-full bg-purple-400 ml-2" />
          <span>Dependentes</span>
        </div>
      </div>
    </div>
  );
};
