import React from 'react';
import { Associado } from '../../services/associadosService';
import { formatDateSafe } from '../../utils/dateUtils';
import { CATEGORIA_EMPRESA_CONVENIADA, nomeDaEmpresa } from '../../utils/empresaVinculada';
import { Edit2, Lock, Plus, Search } from 'lucide-react';

interface Props {
  bloqueadoPorInatividade: any;
  editingAssociado: any;
  empresasConveniadas: any[];
  planos: any;
  selectedContratoId: any;
  setEditingAssociado: any;
  setJustificativaModificacao: any;
  setModificarPlanoStep: any;
  setNovoPlanoSelecionado: any;
  setSelectedContratoId: any;
  setShowModificarPlanoModal: any;
  setShowNovoContrato: any;
  valorPlanoAtivo: any;
}

/**
 * A aba de contratos: tipo de pessoa (com a empresa conveniada do associado PJ), o widget do
 * contrato ativo e os cards do histórico.
 *
 * Os cards são `<div onClick>`, sem `role` nem `tabIndex` — a mesma lacuna de acessibilidade
 * que o CLAUDE.md registra no item-pai de submenu da Sidebar. É pré-existente e não foi
 * corrigida aqui: mexer nisso muda comportamento, não só marcação.
 *
 * A lista de empresas conveniadas chega por prop já resolvida (`opcoesEmpresaConveniada`), e
 * inclui a empresa já gravada mesmo desativada — senão abrir para editar perderia a seleção
 * e o save gravaria o vínculo vazio.
 */
export const AssociadoContratosTab: React.FC<Props> = ({ bloqueadoPorInatividade, editingAssociado, empresasConveniadas, planos, selectedContratoId, setEditingAssociado, setJustificativaModificacao, setModificarPlanoStep, setNovoPlanoSelecionado, setSelectedContratoId, setShowModificarPlanoModal, setShowNovoContrato, valorPlanoAtivo }) => {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between border-b border-border-default pb-4">
        <h4 className="text-text-base font-medium">
          Contratos do Associado
        </h4>
      </div>


      <div className="bg-bg-surface p-5 rounded-xl border border-border-default space-y-4 mb-4">
        <h5 className="text-sm font-semibold text-text-subtle">
          Tipo de Contrato / Pessoa
        </h5>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-text-subtle mb-1">Tipo de Pessoa *</label>
            <select 
              value={editingAssociado.tipo_pessoa || 'PF'}
              onChange={(e) => setEditingAssociado({ ...editingAssociado, tipo_pessoa: e.target.value as 'PF' | 'PJ' })}
              className="w-full bg-bg-base border border-border-default rounded-xl px-4 py-2.5 text-sm text-text-base focus:ring-2 focus:ring-[#3B82F6] focus:border-transparent outline-none transition-all"
            >
              <option value="PF">Pessoa Física (PF)</option>
              <option value="PJ">Pessoa Jurídica (PJ)</option>
            </select>
          </div>
          {editingAssociado.tipo_pessoa === 'PJ' && (
            <div>
              <label className="block text-xs font-medium text-text-subtle mb-1">Empresa / Convênio (Fornecedor) *</label>
              {empresasConveniadas.length === 0 ? (
                <div className="w-full bg-amber-500/10 border border-amber-500/30 rounded-xl px-4 py-2.5 text-xs text-amber-600 dark:text-amber-400">
                  Nenhuma empresa conveniada cadastrada. Cadastre um fornecedor na categoria
                  <strong> {CATEGORIA_EMPRESA_CONVENIADA}</strong> em Cadastros → Fornecedores para
                  poder vincular este associado.
                </div>
              ) : (
                <select
                  value={editingAssociado.fornecedor_id || ''}
                  onChange={(e) => setEditingAssociado({ ...editingAssociado, fornecedor_id: e.target.value })}
                  required
                  className="w-full bg-bg-base border border-border-default rounded-xl px-4 py-2.5 text-sm text-text-base focus:ring-2 focus:ring-[#3B82F6] focus:border-transparent outline-none transition-all"
                >
                  <option value="">Selecione a empresa conveniada</option>
                  {empresasConveniadas.map((f) => (
                    <option key={f.id} value={f.id}>
                      {nomeDaEmpresa(f)}{f.status !== 'ativo' ? ' (desativada)' : ''}
                    </option>
                  ))}
                </select>
              )}
            </div>
          )}
        </div>
      </div>

      {!selectedContratoId ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Active Contract Widget */}
          <div 
            onClick={() => setSelectedContratoId('active')}
            className="p-5 bg-bg-surface border border-[#3B82F6]/50 rounded-xl cursor-pointer hover:bg-bg-subtle transition-colors relative overflow-hidden"
          >
            <div className="absolute top-0 right-0 px-3 py-1 bg-[#3B82F6]/10 text-[#3B82F6] text-xs font-semibold rounded-bl-lg">
              ATIVO
            </div>
            <h5 className="text-lg font-bold text-text-base mb-1">
              {editingAssociado.plano_nome || "Nenhum Plano Selecionado"}
            </h5>
            <p className="text-sm text-text-subtle mb-4">
              Valor: R$ {valorPlanoAtivo.toFixed(2).replace(".", ",")}
            </p>
            <div className="flex justify-between items-center text-xs text-text-subtle">
              <span>Desde {editingAssociado.data_adesao ? formatDateSafe(editingAssociado.data_adesao) : "N/A"}</span>
              <span className="flex items-center gap-1 text-[#3B82F6]">Editar <Search className="w-3 h-3" /></span>
            </div>
          </div>

          {/* Inactive Contracts Widgets */}
          {editingAssociado.historico_contratos?.map((hist: any) => (
            <div 
              key={hist.id}
              onClick={() => setSelectedContratoId(hist.id)}
              className="p-5 bg-bg-surface border border-border-default rounded-xl cursor-pointer hover:bg-bg-subtle transition-colors relative overflow-hidden opacity-75"
            >
              <div className="absolute top-0 right-0 px-3 py-1 bg-slate-500/10 text-text-subtle text-xs font-semibold rounded-bl-lg">
                INATIVO
              </div>
              <h5 className="text-lg font-bold text-text-base mb-1">
                Plano {hist.plano}
              </h5>
              <p className="text-sm text-text-subtle mb-4">
                Valor: R$ {hist.valor.toFixed(2).replace('.', ',')}
              </p>
              <div className="flex justify-between items-center text-xs text-text-subtle">
                <span>{formatDateSafe(hist.data_inicio)} - {hist.data_fim ? formatDateSafe(hist.data_fim) : "N/A"}</span>
                <span className="flex items-center gap-1">Ver <Search className="w-3 h-3" /></span>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="space-y-6">
          <div className="flex items-center">
            <button
              type="button"
              onClick={() => setSelectedContratoId(null)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-bg-subtle border border-border-default text-text-muted rounded-lg text-sm font-medium hover:bg-[#64748B] transition-colors"
            >
              Voltar
            </button>
          </div>

          {selectedContratoId === 'active' ? (

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
        <div className="space-y-4 xl:col-span-7">
          <h5 className="text-sm font-semibold text-text-subtle">
            Dados do Contrato
          </h5>
          <div className="space-y-4">
            <div className="p-5 bg-bg-surface border border-border-default rounded-xl">
              <div className="flex justify-between items-start mb-4">
                <div>
                  <p className="text-sm font-medium text-text-subtle mb-1">Plano Atual</p>
                  <h4 className="text-lg font-bold text-text-base capitalize">
                    {editingAssociado.plano_pax_id ? planos.find((p: any) => p.id === editingAssociado.plano_pax_id)?.nome || editingAssociado.plano_nome : editingAssociado.plano_nome || "Nenhum Plano Selecionado"}
                  </h4>
                </div>
                <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  Ativo
                </span>
              </div>

              <div className="grid grid-cols-2 gap-4 text-sm mt-4">
                <div>
                  <p className="text-text-subtle">Valor Mensal</p>
                  <p className="font-semibold text-text-base">R$ {valorPlanoAtivo.toFixed(2).replace(".", ",")}</p>
                </div>
                <div>
                  <p className="text-text-subtle">Data de Adesão</p>
                  <p className="font-semibold text-text-base">
                    {editingAssociado.data_adesao ? formatDateSafe(editingAssociado.data_adesao) : "N/A"}
                  </p>
                </div>
              </div>
            </div>

            {/* Contrato de associado inativo não se cria nem se altera:
                a inativação já o pôs em `inativo` e mexer aqui o
                reativaria pela porta dos fundos. */}
            {bloqueadoPorInatividade ? (
              <div className="w-full px-4 py-3 bg-bg-hover border border-border-default rounded-xl text-sm text-text-subtle flex items-center justify-center gap-2">
                <Lock className="w-4 h-4 shrink-0" />
                Contrato bloqueado — associado inativo
              </div>
            ) : !editingAssociado.plano_pax_id ? (
              <button
                type="button"
                onClick={() => setShowNovoContrato(true)}
                className="w-full px-4 py-3 bg-[#3B82F6] text-white hover:bg-[#3B82F6]/90 rounded-xl text-sm font-medium transition-colors flex items-center justify-center gap-2 shadow-lg shadow-[#3B82F6]/20"
              >
                <Plus className="w-4 h-4" />
                Cadastrar Novo Contrato
              </button>
            ) : (
              <button
                type="button"
                onClick={() => {
                  setShowModificarPlanoModal(true);
                  setModificarPlanoStep("confirmar");
                  setJustificativaModificacao("");
                  setNovoPlanoSelecionado("");
                }}
                className="w-full px-4 py-3 bg-[#3B82F6]/10 text-[#3B82F6] hover:bg-[#3B82F6]/20 border border-[#3B82F6]/30 rounded-xl text-sm font-medium transition-colors flex items-center justify-center gap-2"
              >
                <Edit2 className="w-4 h-4" />
                Modificar Plano
              </button>
            )}
          </div>
          <div className="space-y-1">
            <label className="block text-sm font-semibold text-text-subtle mb-1">
              Número de Vidas
            </label>
            <input
              type="number"
              min="1"
              readOnly
              value={1 + (editingAssociado.dependentes?.length || 0)}
              className="w-full px-4 py-2.5 bg-bg-surface border border-border-default rounded-xl text-text-subtle cursor-not-allowed focus:outline-none transition-all"
            />
            <p className="text-xs text-text-subtle mt-1">Calculado automaticamente (Titular + Dependentes)</p>
          </div>

          <div className="p-4 bg-bg-surface border border-border-default rounded-xl mt-4">
            <p className="text-sm text-text-subtle">
              Quantidade de Dependentes Vinculados
            </p>
            <p className="text-2xl font-bold text-text-base mt-1">
              {editingAssociado.dependentes?.length || 0}
            </p>
          </div>

        </div>
        <div className="space-y-4 xl:col-span-5">
          <h5 className="text-sm font-semibold text-text-subtle">
            Histórico de Alterações
          </h5>
          <div className="bg-bg-surface border border-border-default rounded-xl p-4 overflow-y-auto max-h-[300px]">
            <div className="space-y-4">
              <div className="flex gap-4">
                <div className="mt-1">
                  <div className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]"></div>
                  <div className="w-0.5 h-full bg-bg-hover mx-auto mt-1"></div>
                </div>
                <div className="pb-4">
                  <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium bg-emerald-500/10 text-emerald-400 mb-1 border border-emerald-500/20">
                    Contrato Ativo
                  </span>
                  <p className="text-sm text-text-base font-medium capitalize">
                    Plano{" "}
                    {editingAssociado.plano_nome || "Nenhum"}
                  </p>
                  <p className="text-xs text-text-muted mt-0.5">
                    Valor: R$ {valorPlanoAtivo.toFixed(2).replace(".", ",")}
                  </p>
                  <p className="text-xs text-text-subtle mt-1">
                    Desde{" "}
                    {editingAssociado.data_adesao
                      ? formatDateSafe(editingAssociado.data_adesao)
                      : "Data não definida"}
                  </p>
                </div>
              </div>
              {editingAssociado.historico_contratos &&
                editingAssociado.historico_contratos.map(
                  (hist: NonNullable<Associado['historico_contratos']>[number]) => (
                    <div className="flex gap-4" key={hist.id}>
                      <div className="mt-1">
                        <div className="w-2 h-2 rounded-full bg-[#60A5FA]"></div>
                        <div className="w-0.5 h-full bg-bg-hover mx-auto mt-1"></div>
                      </div>
                      <div className="pb-4">
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium bg-[#60A5FA]/10 text-[#60A5FA] mb-1 border border-[#60A5FA]/20">
                          Anterior
                        </span>
                        <p className="text-sm text-text-base font-medium capitalize">
                          Plano {hist.plano}
                        </p>
                        <p className="text-xs text-text-muted mt-0.5">
                          Valor: R 
                          {hist.valor
                            .toFixed(2)
                            .replace(".", ",")}
                        </p>
                        <p className="text-xs text-text-subtle mt-1">
                          {formatDateSafe(hist.data_inicio)}{" "}
                          {hist.data_fim
                            ? `até ${formatDateSafe(hist.data_fim)}`
                            : ""}
                        </p>
                      </div>
                    </div>
                  ),
                )}
              <div className="flex gap-4">
                <div className="mt-1">
                  <div className="w-2 h-2 rounded-full bg-slate-600"></div>
                </div>
                <div>
                  <p className="text-sm text-text-subtle font-medium">
                    Adesão Inicial
                  </p>
                  <p className="text-xs text-text-subtle mt-0.5">
                    {editingAssociado.data_adesao
                      ? formatDateSafe(editingAssociado.data_adesao)
                      : "Data não definida"}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

          ) : (
            <div className="p-6 bg-bg-surface border border-border-default rounded-xl max-w-2xl">
               {(() => {
                 const hist = editingAssociado.historico_contratos?.find((h: any) => h.id === selectedContratoId);
                 if (!hist) return <p className="text-text-subtle">Contrato não encontrado.</p>;
                 return (
                   <div className="space-y-6">
                     <h5 className="text-xl font-bold text-text-base">Plano {hist.plano}</h5>
                     <div className="grid grid-cols-2 gap-6">
                       <div className="bg-bg-subtle p-4 rounded-lg border border-border-default">
                         <span className="text-xs font-semibold uppercase text-text-subtle block mb-1">Valor do Plano</span>
                         <span className="text-lg font-medium text-text-base">R$ {hist.valor.toFixed(2).replace('.', ',')}</span>
                       </div>
                       <div className="bg-bg-subtle p-4 rounded-lg border border-border-default">
                         <span className="text-xs font-semibold uppercase text-text-subtle block mb-1">Período</span>
                         <span className="text-sm text-text-base">{formatDateSafe(hist.data_inicio)} a {hist.data_fim ? formatDateSafe(hist.data_fim) : "-"}</span>
                       </div>
                     </div>
                   </div>
                 );
               })()}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
