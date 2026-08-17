import React, { useState } from 'react';
import { usePlanosPax } from '../hooks/usePlanosPax';
import { PlanoPaxForm } from '../components/planos-pax/PlanoPaxForm';
import { PlanoPaxCompleto } from '../types/planosPax';
import { Building2, Plus, Search, Pencil, Power, PowerOff, ShieldCheck, ShieldAlert, ArrowRightLeft, Trash2, User, Users, CircleDollarSign, Check, Clock, MapPin, LayoutGrid, List, Filter } from 'lucide-react';
import toast from 'react-hot-toast';
import { useConfirm } from '../context/ConfirmContext';

const PlanoCard = ({ plano, handleOpenForm, handleToggleStatus, handleDelete }: { plano: any, handleOpenForm: any, handleToggleStatus: any, handleDelete: any }) => {
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });
  const [isHovering, setIsHovering] = useState(false);

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    setMousePosition({
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    });
  };

  return (
    <div 
      onClick={() => handleOpenForm(plano)}
      onMouseMove={handleMouseMove}
      onMouseEnter={() => setIsHovering(true)}
      onMouseLeave={() => setIsHovering(false)}
      className="bg-bg-surface border border-border-default rounded-2xl p-5 hover:border-transparent transition-all cursor-pointer relative group flex flex-col h-full overflow-hidden shadow-sm"
    >
      {/* Glow Effect Background */}
      <div 
        className="absolute inset-0 z-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none"
        style={{
          background: isHovering ? `radial-gradient(600px circle at ${mousePosition.x}px ${mousePosition.y}px, rgba(59, 130, 246, 0.15), transparent 40%)` : 'none',
        }}
      />
      
      {/* Animated Border Gradient */}
      <div className="absolute inset-0 z-0 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none p-[1px]" style={{ background: isHovering ? `radial-gradient(400px circle at ${mousePosition.x}px ${mousePosition.y}px, rgba(59, 130, 246, 0.5), rgba(139, 92, 246, 0.5), transparent 40%)` : 'none' }}>
         <div className="absolute inset-[1px] bg-bg-surface rounded-2xl z-0"></div>
      </div>

      <div className="relative z-10 flex flex-col h-full">
        <div className={`absolute top-[-20px] right-[-20px] px-3 py-1 text-xs font-semibold rounded-bl-lg ${
          plano.ativo 
            ? 'bg-emerald-500/10 text-emerald-500' 
            : 'bg-red-500/10 text-red-500'
        }`}>
          {plano.ativo ? 'ATIVO' : 'INATIVO'}
        </div>
        
        <div className="mb-4 pt-2">
          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-[#3B82F6]/10 text-[#3B82F6] uppercase tracking-wider mb-2 inline-block">
            {plano.codigo}
          </span>
          <h3 className="font-bold text-xl text-text-base line-clamp-1 group-hover:text-transparent group-hover:bg-clip-text group-hover:bg-gradient-to-r group-hover:from-[#3B82F6] group-hover:to-purple-400 transition-all">{plano.nome}</h3>
          <p className="text-sm text-text-subtle mt-1 flex items-center gap-1.5">
            {plano.tipo_plano === 'individual' ? <User className="w-4 h-4" /> : <Users className="w-4 h-4" />}
            <span className="capitalize">{plano.tipo_plano === 'individual' ? 'Individual' : `Coletivo (${plano.limite_vidas} vidas)`}</span>
          </p>
        </div>
        
        <div className="flex-1 space-y-4">
          <div className="bg-bg-base/50 p-3 rounded-xl border border-border-default/50 group-hover:border-[#3B82F6]/20 transition-colors">
            <div className="flex justify-between items-center text-sm mb-1">
              <span className="text-text-subtle flex items-center gap-1.5 font-medium">
                <CircleDollarSign className="w-4 h-4 text-emerald-500" />
                Mensalidade
              </span>
              <span className="font-bold text-emerald-500 text-right">
                {plano.regra_calculo === 'faixa_etaria' 
                  ? 'Por Idade'
                  : Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(plano.valor_mensalidade || 0)
                }
              </span>
            </div>
            {plano.regra_calculo === 'por_vida' && (
              <div className="text-right text-[10px] text-text-subtle font-medium">Valor cobrado por vida</div>
            )}
          </div>
          
          <div>
            <div className="text-[11px] font-bold text-text-subtle uppercase tracking-wider mb-2 flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-[#3B82F6]" /> 
              Principais Coberturas
            </div>
            <div className="flex flex-wrap gap-1.5">
              {plano.coberturas?.filter((c: any) => c.tipo_cobertura === 'coberto').slice(0, 3).map((c: any, i: number) => (
                  <span key={i} className="inline-flex items-center gap-1 px-2 py-1 rounded bg-[#3B82F6]/10 text-[#3B82F6] border border-[#3B82F6]/20 text-[10px] font-medium whitespace-nowrap">
                    <Check className="w-3 h-3" />
                    {c.item?.nome || 'Item'}
                  </span>
              ))}
              {(plano.coberturas?.filter((c: any) => c.tipo_cobertura === 'coberto').length || 0) > 3 && (
                  <span className="inline-flex items-center gap-1 px-2 py-1 rounded bg-bg-base text-text-subtle border border-border-default text-[10px] font-medium">
                    +{(plano.coberturas?.filter((c: any) => c.tipo_cobertura === 'coberto').length || 0) - 3} itens
                  </span>
              )}
              {(plano.coberturas?.filter((c: any) => c.tipo_cobertura === 'coberto').length || 0) === 0 && (
                <span className="text-[11px] text-text-muted italic">Nenhum item coberto</span>
              )}
            </div>
          </div>
          {(plano.coberturas?.filter((c: any) => c.tipo_cobertura === 'excluido').length || 0) > 0 && (
          <div>
            <div className="text-[11px] font-bold text-text-subtle uppercase tracking-wider mb-2 flex items-center gap-1.5 mt-1">
              <ShieldAlert className="w-4 h-4 text-red-500" /> 
              Não Cobertos
            </div>
            <div className="flex flex-wrap gap-1.5">
              {plano.coberturas?.filter((c: any) => c.tipo_cobertura === 'excluido').slice(0, 2).map((c: any, i: number) => (
                  <span key={i} className="inline-flex items-center gap-1 px-2 py-1 rounded bg-red-500/10 text-red-500 border border-red-500/20 text-[10px] font-medium line-through decoration-red-500/50 whitespace-nowrap">
                    {c.item?.nome || 'Item'}
                  </span>
              ))}
              {(plano.coberturas?.filter((c: any) => c.tipo_cobertura === 'excluido').length || 0) > 2 && (
                  <span className="inline-flex items-center gap-1 px-2 py-1 rounded bg-bg-base text-text-subtle border border-border-default text-[10px] font-medium">
                    +{(plano.coberturas?.filter((c: any) => c.tipo_cobertura === 'excluido').length || 0) - 2} itens
                  </span>
              )}
            </div>
          </div>
          )}
          <div className="flex gap-3 pt-2">
              <div className="flex-1 bg-bg-base/50 rounded-lg p-2.5 border border-border-default/50 flex flex-col justify-center items-center text-center">
                  <span className="text-[10px] text-text-subtle uppercase tracking-wider mb-1 flex items-center gap-1 font-semibold">
                      <Clock className="w-3.5 h-3.5" />
                      Carência
                  </span>
                  <span className="text-sm font-bold text-text-base">{plano.carencia_geral_dias || 0} dias</span>
              </div>
              <div className="flex-1 bg-bg-base/50 rounded-lg p-2.5 border border-border-default/50 flex flex-col justify-center items-center text-center">
                  <span className="text-[10px] text-text-subtle uppercase tracking-wider mb-1 flex items-center gap-1 font-semibold">
                      <MapPin className="w-3.5 h-3.5" />
                      Translado
                  </span>
                  <span className="text-sm font-bold text-text-base">{plano.km_translado_coberto ? `${plano.km_translado_coberto} km` : 'N/A'}</span>
              </div>
          </div>
        </div>
        
        <div className="mt-5 pt-4 border-t border-border-default flex justify-end gap-2 relative z-20" onClick={(e) => e.stopPropagation()}>
          <button
            onClick={() => handleToggleStatus(plano)}
            className={`p-2 rounded-lg transition-colors ${
              plano.ativo 
                  ? 'text-text-subtle hover:text-red-500 hover:bg-red-500/10' 
                  : 'text-text-subtle hover:text-emerald-500 hover:bg-emerald-500/10'
            }`}
            title={plano.ativo ? "Desativar" : "Ativar"}
          >
            {plano.ativo ? <PowerOff className="w-4 h-4" /> : <Power className="w-4 h-4" />}
          </button>
          <button
            onClick={() => handleDelete(plano)}
            className="p-2 text-text-subtle hover:text-red-500 hover:bg-red-500/10 rounded-lg transition-colors"
            title="Excluir"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};

export const PlanosPaxPage: React.FC = () => {
  const { planos, loading, criar, editar, desativar, reativar, excluir } = usePlanosPax();
  const { confirm } = useConfirm();
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingPlano, setEditingPlano] = useState<PlanoPaxCompleto | null>(null);
  
  const [viewMode, setViewMode] = useState<"grid" | "table">("grid");
  const [filtros, setFiltros] = useState({
    busca: '',
    tipo_plano: '',
    ativo: ''
  });

  const handleOpenForm = (plano?: PlanoPaxCompleto) => {
    setEditingPlano(plano || null);
    setIsFormOpen(true);
  };

  const handleSave = async (data: any) => {
    if (editingPlano) {
      await editar(editingPlano.id, data);
    } else {
      await criar(data);
    }
  };

  const handleDelete = (plano: PlanoPaxCompleto) => {
    confirm({
      title: "Excluir Plano",
      message: `Tem certeza que deseja excluir o plano "${plano.nome}"? Esta ação não pode ser desfeita e contratos vinculados podem perder a referência.`,
      danger: true,
      confirmText: "Excluir",
      onConfirm: async () => {
        try {
          await excluir(plano.id);
          toast.success('Plano excluído com sucesso!');
        } catch (error: any) {
          toast.error(error.message || 'Erro ao excluir plano');
        }
      }
    });
  };

  const handleToggleStatus = async (plano: PlanoPaxCompleto) => {
    try {
      if (plano.ativo) {
        await desativar(plano.id);
        toast.success('Plano desativado.');
      } else {
        await reativar(plano.id);
        toast.success('Plano ativado.');
      }
    } catch (e: any) {
      toast.error(e.message || 'Erro ao alterar status.');
    }
  };

  const planosFiltrados = planos.filter(p => {
    if (filtros.ativo && p.ativo.toString() !== filtros.ativo) return false;
    if (filtros.tipo_plano && p.tipo_plano !== filtros.tipo_plano) return false;
    if (filtros.busca) {
      const search = filtros.busca.toLowerCase();
      return p.nome.toLowerCase().includes(search) || p.codigo.toLowerCase().includes(search);
    }
    return true;
  });

  const kpis = {
    total: planos.length,
    ativos: planos.filter(p => p.ativo).length,
    inativos: planos.filter(p => !p.ativo).length,
    individual: planos.filter(p => p.tipo_plano === 'individual' && p.ativo).length,
    coletivo: planos.filter(p => p.tipo_plano === 'coletivo' && p.ativo).length,
  };

  return (
    <div className="space-y-6">
      {/* HEADER SECTION */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs text-text-subtle mb-1">
            <span>Administração</span>
            <span className="w-1 h-1 rounded-full bg-border-default"></span>
            <span>Planos</span>
          </div>
          <h1 className="text-2xl font-bold text-text-base flex items-center gap-2">
            <ShieldCheck className="w-6 h-6 text-[#3B82F6]" />
            Gestão de Planos
          </h1>
          <p className="text-sm text-text-subtle mt-1">
            Configure os planos e serviços oferecidos aos associados
          </p>
        </div>
        
        <div className="flex items-center gap-3">
          <button
            onClick={() => handleOpenForm()}
            className="flex items-center gap-2 px-5 py-2.5 bg-[#3B82F6] text-white text-sm font-semibold rounded-xl hover:opacity-90 transition-opacity shadow-[0_0_15px_rgba(59,130,246,0.25)]"
          >
            <Plus className="w-4 h-4" />
            Novo Plano
          </button>
        </div>
      </div>

      {/* STATS OVERVIEW CARDS */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-bg-surface p-4 rounded-2xl border border-border-default shadow-sm flex items-center gap-4">
          <div className="p-3 bg-[#3B82F6]/10 text-[#3B82F6] rounded-2xl border border-[#3B82F6]/20 shrink-0">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs font-semibold text-text-subtle">Total de Planos</p>
            <p className="text-xl font-extrabold text-text-base mt-0.5">{kpis.total}</p>
          </div>
        </div>

        <div className="bg-bg-surface p-4 rounded-2xl border border-border-default shadow-sm flex items-center gap-4">
          <div className="p-3 bg-emerald-500/10 text-emerald-400 rounded-2xl border border-emerald-500/20 shrink-0">
            <Check className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs font-semibold text-text-subtle">Planos Ativos</p>
            <p className="text-xl font-extrabold text-emerald-400 mt-0.5">{kpis.ativos}</p>
          </div>
        </div>

        <div className="bg-bg-surface p-4 rounded-2xl border border-border-default shadow-sm flex items-center gap-4">
          <div className="p-3 bg-purple-500/10 text-purple-400 rounded-2xl border border-purple-500/20 shrink-0">
            <User className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs font-semibold text-text-subtle">Ativos (Individuais)</p>
            <p className="text-xl font-extrabold text-purple-400 mt-0.5">{kpis.individual}</p>
          </div>
        </div>

        <div className="bg-bg-surface p-4 rounded-2xl border border-border-default shadow-sm flex items-center gap-4">
          <div className="p-3 bg-blue-500/10 text-blue-400 rounded-2xl border border-blue-500/20 shrink-0">
            <Users className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs font-semibold text-text-subtle">Ativos (Coletivos)</p>
            <p className="text-xl font-extrabold text-blue-400 mt-0.5">{kpis.coletivo}</p>
          </div>
        </div>
      </div>

      <div className="bg-bg-subtle border border-border-default rounded-2xl overflow-hidden shadow-sm">
        <div className="p-4 border-b border-border-default flex flex-col sm:flex-row gap-4 justify-between bg-bg-surface/50">
          <div className="relative w-full max-w-md">
            <Search className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-text-subtle" />
            <input
              type="text"
              placeholder="Buscar por código ou nome..."
              value={filtros.busca}
              onChange={(e) => setFiltros(prev => ({ ...prev, busca: e.target.value }))}
              className="w-full bg-bg-surface border border-border-default rounded-xl pl-10 pr-4 py-2.5 text-text-base focus:outline-none focus:border-[#3B82F6]"
            />
          </div>
          
          <div className="flex gap-4">
            <select
              value={filtros.tipo_plano}
              onChange={(e) => setFiltros(prev => ({ ...prev, tipo_plano: e.target.value }))}
              className="bg-bg-surface border border-border-default rounded-xl px-4 py-2.5 text-text-base focus:outline-none focus:border-[#3B82F6]"
            >
              <option value="">Todos Tipos</option>
              <option value="individual">Individual</option>
              <option value="coletivo">Coletivo</option>
            </select>
            
            <select
              value={filtros.ativo}
              onChange={(e) => setFiltros(prev => ({ ...prev, ativo: e.target.value }))}
              className="bg-bg-surface border border-border-default rounded-xl px-4 py-2.5 text-text-base focus:outline-none focus:border-[#3B82F6]"
            >
              <option value="">Todos Status</option>
              <option value="true">Ativos</option>
              <option value="false">Inativos</option>
            </select>
          </div>

        {/* VIEW MODE TOGGLES */}
        <div className="flex items-center gap-2 border-l border-border-default pl-4 pr-2">
          <div className="flex items-center bg-bg-subtle border border-border-default rounded-xl p-1">
            <button
              onClick={() => setViewMode('grid')}
              className={`p-1.5 rounded-lg transition-colors ${viewMode === 'grid' ? 'bg-[#3B82F6] text-white' : 'text-text-subtle hover:text-text-base'}`}
              title="Visualização em Cards"
            >
              <LayoutGrid className="w-4 h-4" />
            </button>
            <button
              onClick={() => setViewMode('table')}
              className={`p-1.5 rounded-lg transition-colors ${viewMode === 'table' ? 'bg-[#3B82F6] text-white' : 'text-text-subtle hover:text-text-base'}`}
              title="Visualização em Tabela"
            >
              <List className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      <div className="overflow-x-auto flex-1 min-h-0 overflow-y-auto w-full">
        {loading ? (
            <div className="p-8 text-center text-text-subtle">Carregando planos...</div>
          ) : planosFiltrados.length === 0 ? (
            <div className="p-8 text-center text-text-subtle">Nenhum plano encontrado.</div>
          ) : (
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {planosFiltrados.map((plano) => (
                <PlanoCard key={plano.id} plano={plano} handleOpenForm={handleOpenForm} handleToggleStatus={handleToggleStatus} handleDelete={handleDelete} />
              ))}
            </div>
          )}
        </div>
      </div>

      <PlanoPaxForm
        isOpen={isFormOpen}
        onClose={() => setIsFormOpen(false)}
        onSave={handleSave}
        initialData={editingPlano}
      />
    </div>
  );
};
