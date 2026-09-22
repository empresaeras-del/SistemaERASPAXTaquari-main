import React from 'react';
import { Dependente } from '../../services/associadosService';
import { formatDateSafe } from '../../utils/dateUtils';
import { idadeEmAnos } from '../../utils/resumoAssociado';
import { MENSAGEM_CADASTRO_INATIVO } from '../../utils/selecaoCadastro';
import { maskCPFOrCNPJ } from '../../utils/validators';
import { Edit2, Lock, Plus, Search, Trash2, Users, X } from 'lucide-react';

interface Props {
  bloqueadoPorInatividade: any;
  buscaDependenteInterno: any;
  editingAssociado: any;
  handleExcluirDependente: any;
  setBuscaDependenteInterno: any;
  setDependenteEmEdicao: any;
  setDependenteFormModalOpen: any;
  state: any;
}

/**
 * A aba de dependentes: cabeçalho com a contagem de vidas, busca, e a lista de cards.
 *
 * **A contagem de vidas é `1 + dependentes.length`** — o titular conta. É esse número que
 * vira `n_vidas` no contrato e entra no cálculo do valor do plano, então um dependente a
 * mais ou a menos aqui é dinheiro no boleto, não um rótulo.
 *
 * Associado fora de circulação não ganha dependente novo (`bloqueadoPorInatividade`): a
 * cobertura do dependente vem do plano do titular, que parou.
 */
export const AssociadoDependentesTab: React.FC<Props> = ({ bloqueadoPorInatividade, buscaDependenteInterno, editingAssociado, handleExcluirDependente, setBuscaDependenteInterno, setDependenteEmEdicao, setDependenteFormModalOpen, state }) => {
  return (
    <div className="space-y-6 flex flex-col h-full animate-in fade-in duration-200">
      {/* Top Bar with Title, Total Vidas and Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-bg-surface p-4 sm:p-5 rounded-2xl border border-border-default shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-2xl bg-[#3B82F6]/10 border border-[#3B82F6]/20 text-[#3B82F6] flex items-center justify-center shrink-0">
            <Users className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h4 className="text-base sm:text-lg font-bold text-text-base leading-tight">
                Dependentes do Associado
              </h4>
              <span className="px-2.5 py-0.5 bg-[#3B82F6]/10 text-[#3B82F6] rounded-full text-xs font-bold border border-[#3B82F6]/20">
                {editingAssociado.dependentes?.length || 0} cadastrado(s)
              </span>
            </div>
            <p className="text-xs text-text-subtle mt-0.5">
              Contrato PAX: <strong className="text-text-base">{1 + (editingAssociado.dependentes?.length || 0)} vidas</strong> (1 Titular + {editingAssociado.dependentes?.length || 0} Dependentes)
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="relative flex-1 sm:w-64">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
            <input
              type="text"
              placeholder="Buscar por nome, CPF..."
              value={buscaDependenteInterno}
              onChange={(e) => setBuscaDependenteInterno(e.target.value)}
              className="w-full bg-bg-subtle border border-border-default rounded-xl pl-9 pr-8 py-2 text-text-base focus:outline-none focus:border-[#3B82F6] text-xs transition-colors"
            />
            {buscaDependenteInterno && (
              <button
                type="button"
                onClick={() => setBuscaDependenteInterno("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-base"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
          {/* Associado inativo não ganha dependente novo: a cobertura
              do dependente vem do plano do titular, que parou. */}
          <button
            type="button"
            disabled={bloqueadoPorInatividade}
            title={bloqueadoPorInatividade ? MENSAGEM_CADASTRO_INATIVO : undefined}
            onClick={() => {
              if (bloqueadoPorInatividade) return;
              setDependenteEmEdicao(null);
              setDependenteFormModalOpen(true);
            }}
            className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all shrink-0 ${
              bloqueadoPorInatividade
                ? 'bg-bg-hover text-text-subtle cursor-not-allowed'
                : 'bg-[#3B82F6] hover:bg-blue-600 text-white shadow-lg shadow-blue-500/20 active:scale-95'
            }`}
          >
            {bloqueadoPorInatividade ? <Lock className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
            Novo Dependente
          </button>
        </div>
      </div>

      {/* Lista de Cards de Dependentes ou Empty State */}
      <div className="flex-1 overflow-y-auto pr-1 custom-scrollbar">
        {!editingAssociado.dependentes || editingAssociado.dependentes.length === 0 ? (
          <div className="text-center py-16 px-4 bg-bg-subtle border border-dashed border-border-default rounded-3xl flex flex-col items-center justify-center">
            <div className="w-16 h-16 rounded-3xl bg-[#3B82F6]/10 text-[#3B82F6] flex items-center justify-center mb-4 border border-[#3B82F6]/20">
              <Users className="w-8 h-8 opacity-80" />
            </div>
            <h5 className="text-base font-bold text-text-base mb-1">Nenhum dependente cadastrado</h5>
            <p className="text-text-subtle text-xs max-w-sm mb-6">
              Este associado ainda não possui dependentes vinculados ao seu plano PAX. Cadastre um novo dependente através do formulário individual e independente.
            </p>
            <button
              type="button"
              onClick={() => {
                setDependenteEmEdicao(null);
                setDependenteFormModalOpen(true);
              }}
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#3B82F6] hover:bg-blue-600 text-white rounded-2xl text-sm font-bold transition-all shadow-lg shadow-blue-500/20 active:scale-95"
            >
              <Plus className="w-4 h-4" />
              Cadastrar Primeiro Dependente
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {editingAssociado.dependentes
              .filter((dep: Dependente) => {
                if (!buscaDependenteInterno) return true;
                const s = buscaDependenteInterno.toLowerCase();
                const sDigits = s.replace(/\D/g, "");
                return (
                  dep.nome.toLowerCase().includes(s) ||
                  (dep.parentesco && dep.parentesco.toLowerCase().includes(s)) ||
                  (dep.cpf && dep.cpf.replace(/\D/g, "").includes(sDigits))
                );
              })
              .map((dep: Dependente, index: number) => {
                const initials = (dep.nome || "D")
                  .split(" ")
                  .filter(Boolean)
                  .slice(0, 2)
                  .map((p: any) => p[0])
                  .join("")
                  .toUpperCase();

                return (
                  <div
                    key={dep.id || index}
                    className="p-5 bg-bg-surface border border-border-default rounded-2xl relative group hover:border-[#3B82F6]/60 transition-all hover:shadow-lg flex flex-col justify-between"
                  >
                    <div className="space-y-3">
                      {/* Header do Card */}
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-600 text-white flex items-center justify-center font-bold text-sm shadow-md shrink-0">
                            {initials}
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm font-bold text-text-base truncate" title={dep.nome}>
                              {dep.nome || "Sem Nome"}
                            </p>
                            <span className="inline-block mt-0.5 px-2 py-0.5 bg-blue-500/10 text-[#3B82F6] border border-blue-500/20 rounded-md text-[10px] font-bold uppercase tracking-wider">
                              {dep.parentesco || "Dependente"}
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            type="button"
                            onClick={() => {
                              setDependenteEmEdicao(dep);
                              setDependenteFormModalOpen(true);
                            }}
                            className="p-1.5 text-text-muted hover:text-[#3B82F6] hover:bg-[#3B82F6]/10 rounded-lg transition-colors"
                            title="Editar Dependente"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleExcluirDependente(dep, index)}
                            className={`p-1.5 rounded-lg transition-colors ${
                              state.user?.nivel === 'funcionario'
                                ? 'text-text-muted hover:text-amber-400 hover:bg-amber-400/10'
                                : 'text-text-muted hover:text-rose-500 hover:bg-rose-500/10'
                            }`}
                            title={state.user?.nivel === 'funcionario' ? "Exclusão restrita (Nível Funcionário)" : "Excluir Dependente"}
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>

                      {/* Informações detalhadas do dependente (Campos da tabela Supabase) */}
                      <div className="grid grid-cols-1 gap-1.5 pt-2 border-t border-border-default/50 text-xs text-text-subtle">
                        <div className="flex items-center justify-between">
                          <span className="text-text-muted">CPF:</span>
                          <span className="font-medium text-text-base">
                            {dep.cpf ? maskCPFOrCNPJ(dep.cpf, false) : "Não informado"}
                          </span>
                        </div>
                        {dep.data_nascimento && (
                          <div className="flex items-center justify-between">
                            <span className="text-text-muted">Nascimento:</span>
                            <span className="font-medium text-text-base flex items-center gap-1.5">
                              {formatDateSafe(dep.data_nascimento)}
                              {(() => {
                                const age = idadeEmAnos(dep.data_nascimento);
                                return age !== null ? (
                                  <span className="text-[10px] text-blue-400 font-bold bg-blue-500/10 px-1.5 py-0.5 rounded border border-blue-500/20">
                                    {age}a
                                  </span>
                                ) : null;
                              })()}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Botão de Edição Rápida */}
                    <div className="mt-3 pt-2">
                      <button
                        type="button"
                        onClick={() => {
                          setDependenteEmEdicao(dep);
                          setDependenteFormModalOpen(true);
                        }}
                        className="w-full py-1.5 px-3 bg-bg-subtle hover:bg-bg-hover border border-border-default rounded-xl text-xs font-semibold text-text-muted hover:text-text-base transition-colors flex items-center justify-center gap-1.5"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                        Editar / Gerenciar Dependente
                      </button>
                    </div>
                  </div>
                );
              })}
          </div>
        )}
      </div>
    </div>
  );
};
