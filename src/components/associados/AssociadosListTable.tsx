import React from 'react';
import { Associado } from '../../services/associadosService';
import { MessageCircle, Edit2, Trash2 } from 'lucide-react';
import { formatDateSafe } from '../../utils/dateUtils';
import { PlanoPax } from '../../services/planosPaxService';

interface AssociadosListTableProps {
  filtered: Associado[];
  isVisible: (col: string) => boolean;
  planos: PlanoPax[];
  parcelasAbertasMap: Record<string, number>;
  setPreviewAssociado: (assoc: Associado) => void;
  handleWhatsAppMenu: (assoc: Associado) => void;
  handleOpenModal: (assoc: Associado) => void;
  handleDelete: (id: string) => void;
}

export const AssociadosListTable: React.FC<AssociadosListTableProps> = ({
  filtered,
  isVisible,
  planos,
  parcelasAbertasMap,
  setPreviewAssociado,
  handleWhatsAppMenu,
  handleOpenModal,
  handleDelete
}) => {
  return (
    <div className="bg-bg-subtle rounded-2xl border border-border-default overflow-hidden animate-in fade-in duration-300 shadow-sm">
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm text-text-subtle">
          <thead className="bg-[#1E293B] border-b border-border-default">
            <tr>
              {isVisible('nome') && <th className="px-6 py-3 text-xs font-semibold text-text-subtle uppercase tracking-wider">Nome do Associado</th>}
              {isVisible('cpf') && <th className="px-6 py-3 text-xs font-semibold text-text-subtle uppercase tracking-wider">CPF</th>}
              {isVisible('plano') && <th className="px-6 py-3 text-xs font-semibold text-text-subtle uppercase tracking-wider">Plano</th>}
              {isVisible('status') && <th className="px-6 py-3 text-xs font-semibold text-text-subtle uppercase tracking-wider">Status</th>}
              {isVisible('adesao') && <th className="px-6 py-3 text-xs font-semibold text-text-subtle uppercase tracking-wider">Adesão</th>}
              {isVisible('acoes') && <th className="px-6 py-3 text-right text-xs font-semibold text-text-subtle uppercase tracking-wider">Ações</th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-[#475569]">
            {filtered.map((associado) => (
              <tr
                key={associado.id}
                className="hover:bg-bg-surface/30 transition-colors cursor-pointer"
                onClick={() => setPreviewAssociado(associado)}
              >
                {isVisible('nome') && <td className="px-6 py-4 font-medium text-text-base">
                  {associado.nome}
                </td>}
                {isVisible('cpf') && <td className="px-6 py-4">{associado.cpf}</td>}
                {isVisible('plano') && <td className="px-6 py-4">
                  <div className="flex flex-col gap-1">
                    <span className="capitalize">{associado.plano_pax_id ? planos.find(p => p.id === associado.plano_pax_id)?.nome || associado.plano_nome : associado.plano_nome || "Sem Plano"}</span>
                    {associado.plano_pax_id && associado.status === 'ativo' && parcelasAbertasMap[associado.id] === 0 && (
                      <span className="inline-flex items-center w-fit px-2 py-0.5 rounded text-[10px] font-bold bg-rose-500/10 text-rose-500 border border-rose-500/20" title="Contrato ativo, mas sem parcelas geradas">
                        SEM MENSALIDADES
                      </span>
                    )}
                    {associado.plano_pax_id && associado.status === 'ativo' && parcelasAbertasMap[associado.id] > 0 && parcelasAbertasMap[associado.id] <= 2 && (
                      <span className="inline-flex items-center w-fit px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/10 text-amber-500 border border-amber-500/20" title="Restam apenas 1 ou 2 mensalidades em aberto">
                        RESTAM {parcelasAbertasMap[associado.id]} MENSALIDADE{parcelasAbertasMap[associado.id] > 1 ? 'S' : ''}
                      </span>
                    )}
                  </div>
                </td>}
                {isVisible('status') && <td className="px-6 py-4">
                  <span
                    className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium border ${
                      associado.status === "ativo"
                        ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                        : associado.status === "inadimplente"
                          ? "bg-rose-500/10 text-rose-400 border-rose-500/20"
                          : "bg-slate-500/10 text-slate-400 border-slate-500/20"
                    }`}
                  >
                    {associado.status === 'inativo' ? 'encerrado' : associado.status}
                  </span>
                </td>}
                {isVisible('adesao') && <td className="px-6 py-4">
                  {formatDateSafe(associado.data_adesao)}
                </td>}
                {isVisible('acoes') && <td className="px-6 py-4 text-right">
                  <div className="flex items-center justify-end gap-2">
                    <button
                      onClick={(e) => { e.stopPropagation(); handleWhatsAppMenu(associado); }}
                      className="p-1 text-emerald-500/70 hover:text-emerald-500 hover:bg-emerald-500/10 rounded-lg transition-colors"
                      title="WhatsApp Automático"
                    >
                      <MessageCircle className="w-4 h-4" />
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); handleOpenModal(associado); }}
                      className="p-1 text-text-subtle hover:text-text-base hover:bg-white/5 rounded-lg transition-colors"
                      title="Editar Associado"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); handleDelete(associado.id || ''); }}
                      className="p-1 text-text-subtle hover:text-rose-400 hover:bg-white/5 rounded-lg transition-colors"
                      title="Excluir Associado"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </td>}
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={6} className="px-6 py-12 text-center text-text-muted">
                  Nenhum associado encontrado com os filtros atuais.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
