import React from 'react';
import { Associado } from '../../services/associadosService';
import { ShieldCheck, Calendar, Users, MessageCircle, Edit2, Trash2 } from 'lucide-react';
import { formatDateSafe } from '../../utils/dateUtils';
import { PlanoPax } from '../../services/planosPaxService';

interface AssociadosListGridProps {
  filtered: Associado[];
  planos: PlanoPax[];
  parcelasAbertasMap: Record<string, number>;
  isOnline: boolean;
  setPreviewAssociado: (assoc: Associado) => void;
  handleWhatsAppMenu: (assoc: Associado) => void;
  handleOpenModal: (assoc: Associado) => void;
  handleDelete: (id: string) => void;
}

export const AssociadosListGrid: React.FC<AssociadosListGridProps> = ({
  filtered,
  planos,
  parcelasAbertasMap,
  isOnline,
  setPreviewAssociado,
  handleWhatsAppMenu,
  handleOpenModal,
  handleDelete
}) => {
  if (filtered.length === 0) {
    return (
      <div className="bg-bg-subtle rounded-2xl border border-border-default p-12 text-center text-text-muted animate-in fade-in duration-300">
        Nenhum associado encontrado com os filtros atuais.
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 animate-in fade-in duration-300">
      {filtered.map((associado) => (
        <div 
          key={associado.id} 
          className="bg-bg-surface border border-border-default rounded-2xl p-5 hover:border-[#3B82F6]/50 transition-all flex flex-col h-full shadow-sm cursor-pointer"
          onClick={() => setPreviewAssociado(associado)}
        >
          <div className="flex items-start justify-between mb-4">
            <div>
              <h3 className="font-bold text-text-base line-clamp-1">{associado.nome}</h3>
              <p className="text-xs text-text-subtle mt-0.5">CPF: {associado.cpf}</p>
            </div>
            <span
              className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium border shrink-0 ${
                associado.status === "ativo"
                  ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                  : associado.status === "inadimplente"
                    ? "bg-rose-500/10 text-rose-400 border-rose-500/20"
                    : "bg-slate-500/10 text-slate-400 border-slate-500/20"
              }`}
            >
              {associado.status === 'inativo' ? 'encerrado' : associado.status}
            </span>
          </div>
          
          <div className="flex items-center gap-2 mb-3">
            {associado.plano_pax_id && associado.status === 'ativo' && parcelasAbertasMap[associado.id] === 0 && (
              <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-rose-500/10 text-rose-500 border border-rose-500/20" title="Contrato ativo, mas sem parcelas geradas">
                SEM MENSALIDADES
              </span>
            )}
            {associado.plano_pax_id && associado.status === 'ativo' && parcelasAbertasMap[associado.id] > 0 && parcelasAbertasMap[associado.id] <= 2 && (
              <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/10 text-amber-500 border border-amber-500/20" title="Restam apenas 1 ou 2 mensalidades em aberto">
                RESTAM {parcelasAbertasMap[associado.id]} MENSALIDADE{parcelasAbertasMap[associado.id] > 1 ? 'S' : ''}
              </span>
            )}
          </div>
          <div className="space-y-2 mb-4 flex-1">
            <div className="flex items-center gap-2 text-xs text-text-muted">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              <span className="truncate">
                {associado.plano_pax_id ? planos.find(p => p.id === associado.plano_pax_id)?.nome || associado.plano_nome : associado.plano_nome || "Sem Plano"}
              </span>
            </div>
            <div className="flex items-center gap-2 text-xs text-text-muted">
              <Calendar className="w-4 h-4 text-[#3B82F6]" />
              <span>Adesão: {formatDateSafe(associado.data_adesao)}</span>
            </div>
            {associado.dependentes && associado.dependentes.length > 0 && (
              <div className="flex items-center gap-2 text-xs text-text-muted">
                <Users className="w-4 h-4 text-[#8B5CF6]" />
                <span>{associado.dependentes.length} {associado.dependentes.length === 1 ? 'dependente' : 'dependentes'}</span>
              </div>
            )}
          </div>
          
          <div className="pt-4 border-t border-border-default flex items-center justify-between mt-auto">
            <button
              onClick={(e) => { e.stopPropagation(); setPreviewAssociado(associado); }}
              className="text-xs font-medium text-[#3B82F6] hover:text-[#60A5FA] flex items-center gap-1 transition-colors"
            >
              Ver Detalhes
            </button>
            <div className="flex items-center gap-2">
              <button
                onClick={(e) => { e.stopPropagation(); handleWhatsAppMenu(associado); }}
                className="p-1.5 text-emerald-500/70 hover:text-emerald-500 hover:bg-emerald-500/10 rounded-lg transition-colors"
                title="WhatsApp Automático"
              >
                <MessageCircle className="w-4 h-4" />
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); handleOpenModal(associado); }}
                className="p-1.5 text-text-subtle hover:text-text-base hover:bg-white/5 rounded-lg transition-colors"
                title="Editar Associado"
              >
                <Edit2 className="w-4 h-4" />
              </button>
              <button
                disabled={!isOnline}
                onClick={(e) => { e.stopPropagation(); handleDelete(associado.id || ''); }}
                className="p-1.5 text-text-subtle hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition-colors disabled:opacity-50"
                title="Excluir Associado"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};
