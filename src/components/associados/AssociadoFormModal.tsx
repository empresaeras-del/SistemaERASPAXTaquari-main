import React from 'react';
import { X, AlertCircle, Search, Edit2, Heart, Printer } from 'lucide-react';
import { AlertaAlteracoesPendentes } from '../common/AlertaAlteracoesPendentes';
import { AssociadoRequisicoesTab } from './AssociadoRequisicoesTab';
import { AssociadoAtendimentosTab } from './AssociadoAtendimentosTab';
import { AssociadoResumoFinanceiroTab } from './AssociadoResumoFinanceiroTab';
import { AssociadoMensalidadesTab } from './AssociadoMensalidadesTab';
import { AssociadoDetailsModal } from './AssociadoDetailsModal';
import { RegrasCalculoInfo } from './RegrasCalculoInfo';
import { BotaoSalvar } from '../common/BotaoSalvar';
import { VisualizadorDocumentoModal } from './VisualizadorDocumentoModal';
import { DependenteFormModal } from './DependenteFormModal';
import { ContratoDocumentosGenerator } from './ContratoDocumentosGenerator';
import { NovoContratoWizard } from '../contratos/NovoContratoWizard';
import { validarDadosAssociado } from '../../utils/associadoValidation';
import { AssociadoResumoCabecalho } from './AssociadoResumoCabecalho';
import { montarResumoAssociado } from '../../utils/resumoAssociado';
import { MENSAGEM_CADASTRO_INATIVO, cadastroForaDeCirculacao } from '../../utils/selecaoCadastro';
import { encontrarAssociadoComCpfDuplicado } from '../../utils/associadoHelpers';
import { opcoesEmpresaConveniada } from '../../utils/empresaVinculada';
import { maskCPFOrCNPJ } from '../../utils/validators';
import { formatDateSafe } from '../../utils/dateUtils';
import { formatPhone } from '../../utils/formatters';
import { Associado, uploadDocumentoAssociado } from '../../services/associadosService';
import { downloadDocumento } from '../../utils/documentUtils';
import { PlanoPaxSelect } from '../planos-pax/PlanoPaxSelect';
import { RelatorioAssociadosModal } from './RelatorioAssociadosModal';
import { AssociadoAbasLaterais } from './AssociadoAbasLaterais';
import { AssociadoEtapasCadastro } from './AssociadoEtapasCadastro';
import { AssociadoDadosPrincipaisTab } from './AssociadoDadosPrincipaisTab';
import { AssociadoDependentesTab } from './AssociadoDependentesTab';
import { AssociadoContratosTab } from './AssociadoContratosTab';
import { AssociadoDocumentosTab } from './AssociadoDocumentosTab';
import { AssociadoFormRodape } from './AssociadoFormRodape';


/**
 * O formulário de associado — cadastro e edição, oito abas.
 *
 * Este arquivo **monta**: o modal, o cabeçalho de identidade, o `<form>` e os modais
 * auxiliares. Cada pedaço de UI mora no componente correspondente desta pasta
 * (`AssociadoAbasLaterais`, `AssociadoEtapasCadastro`, `AssociadoDadosPrincipaisTab`,
 * `AssociadoDependentesTab`, `AssociadoContratosTab`, `AssociadoDocumentosTab`,
 * `AssociadoFormRodape`), e o estado vive em `hooks/useAssociadosState.ts`.
 *
 * Duas decisões da montagem que não são cosméticas:
 *
 * - **A tela tem dois modos e eles são excludentes.** `isEditingMode` escolhe entre a barra
 *   de abas (navegação livre) e o stepper de cinco etapas (sequência), e o rodapé muda junto.
 *   Um cadastro novo precisa percorrer as etapas; um cadastro existente precisa que a aba
 *   procurada esteja a um clique.
 * - **Tudo é renderizado DENTRO do `<form id="associado-form">`**, inclusive os
 *   visualizadores de documento e recibo. É o que torna obrigatório todo `<button>` daqui
 *   declarar `type` — sem ele o padrão do HTML é `submit`, e o CLAUDE.md registra o incidente
 *   em que abrir um documento salvava e fechava o cadastro. `src/test/botoesDeclaramType.ts`
 *   trava isso para o código que ainda não foi escrito.
 */
export const AssociadoFormModal = (props: any) => {
  const {
    state, toast, planos, fornecedores,
    associados, empresaData, showRelatorioModal, setShowRelatorioModal,
    relatorioReportType, searchTerm, statusFilter, planoFilter, empresaFilter,
    filtered, activeTab, setActiveTab,
    isModalOpen, editingAssociado, setEditingAssociado,
    dependenteFormModalOpen, setDependenteFormModalOpen, dependenteEmEdicao, setDependenteEmEdicao,
    selectedContratoId, setSelectedContratoId, isEditingMode, documentoVisualizando, setDocumentoVisualizando, isUploadingDoc, setIsUploadingDoc,
    isDraggingDoc, setIsDraggingDoc, isSavingAssociado, isSavedAssociado, hasUnsavedChanges, activeSubTab, setActiveSubTab,
    showDependentesModal, setShowDependentesModal, buscaDependenteInterno, setBuscaDependenteInterno,
    buscaDependentes, setBuscaDependentes, showModificarPlanoModal, setShowModificarPlanoModal,
    showNovoContrato, setShowNovoContrato, modificarPlanoStep, setModificarPlanoStep,
    justificativaModificacao, setJustificativaModificacao, novoPlanoSelecionado, setNovoPlanoSelecionado,
    valorPlanoAtivo, dependentesFiltrados,
    loadData, fieldErrors, buscandoCep, buscarCepViaCep,
    executarValidacaoOuAlertar, handleFieldChange, handleOpenModal, handleCloseModal,
    handleSave, handleExcluirDependente, handleExportDependentesPDF,
    handleAbrirReativacao
  } = props;

  // Derivados do associado aberto: o cabeçalho e o bloqueio por status inativo.
  const resumoAssociado = montarResumoAssociado(editingAssociado);
  const bloqueadoPorInatividade = cadastroForaDeCirculacao(editingAssociado);
  // Empresas conveniadas oferecidas ao associado PJ. A já gravada entra na lista mesmo se tiver
  // sido desativada depois — senão abrir para editar perderia a seleção e salvaria o vínculo vazio.
  const empresasConveniadas = opcoesEmpresaConveniada(fornecedores || [], editingAssociado?.fornecedor_id);

  return (
    <>
      {isModalOpen && editingAssociado && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-bg-base/80 backdrop-blur-sm p-4">
          <div className="bg-bg-subtle rounded-3xl shadow-2xl w-full max-w-6xl 2xl:max-w-[1400px] max-h-[90vh] flex flex-col border border-border-default overflow-hidden">
            <div className="px-6 py-4 border-b border-border-default flex items-center justify-between shrink-0 bg-bg-surface/50">
              <div className="flex items-center gap-3">
                <h3 className="text-xl font-bold text-text-base tracking-tight">
                  {editingAssociado.nome ? "Editar Associado" : "Novo Associado"}
                </h3>
                {hasUnsavedChanges && (
                  <span className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30">
                    <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse"></span>
                    Alterações pendentes
                  </span>
                )}
              </div>
              <button
                type="button"
                onClick={handleCloseModal}
                className="text-text-subtle hover:text-text-base transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Identidade do associado, visível em todas as abas — e o aviso de inativo,
                que explica por que as ações estão bloqueadas adiante. */}
            <AssociadoResumoCabecalho
              resumo={resumoAssociado}
              mensagemInativo={MENSAGEM_CADASTRO_INATIVO}
              onReativar={
                handleAbrirReativacao && editingAssociado?.id
                  ? () => {
                      // Fecha o formulário antes de abrir o assistente: os dois são modais
                      // de tela cheia, e o cadastro que o assistente vai gravar é o que está
                      // no banco — deixar o formulário aberto por baixo convidaria a salvar
                      // por cima da reativação com os valores de antes dela.
                      const alvo = editingAssociado;
                      handleCloseModal();
                      handleAbrirReativacao(alvo);
                    }
                  : undefined
              }
            />

            {hasUnsavedChanges && (
              <div className="px-6 pt-3 shrink-0">
                <AlertaAlteracoesPendentes
                  visivel={hasUnsavedChanges}
                  formId="associado-form"
                  salvando={isSavingAssociado}
                  posicao="compact"
                  mensagem="Existem alterações realizadas no cadastro deste associado que necessitam de salvamento para devido registro no banco de dados."
                />
              </div>
            )}
            <div
              className={`flex flex-1 overflow-hidden ${isEditingMode ? "flex-row" : "flex-col"}`}
            >
              {isEditingMode ? (
                <AssociadoAbasLaterais activeTab={activeTab} executarValidacaoOuAlertar={executarValidacaoOuAlertar} isEditingMode={isEditingMode} setActiveTab={setActiveTab} />
              ) : (
                <AssociadoEtapasCadastro activeTab={activeTab} />
              )}

              {/* Form Content */}
              <form
                id="associado-form"
                noValidate
                onSubmit={handleSave}
                className="flex-1 flex flex-col overflow-hidden"
              >
                <div className="flex-1 overflow-y-auto p-8 custom-scrollbar">
                  {activeTab === "resumo" ? (
                    <AssociadoResumoFinanceiroTab associado={editingAssociado} />
                  ) : activeTab === "principal" ? (
                    <AssociadoDadosPrincipaisTab activeSubTab={activeSubTab} associados={associados} buscandoCep={buscandoCep} buscarCepViaCep={buscarCepViaCep} editingAssociado={editingAssociado} fieldErrors={fieldErrors} handleFieldChange={handleFieldChange} setActiveSubTab={setActiveSubTab} toast={toast} />
                  ) : activeTab === "dependentes" ? (
                    <AssociadoDependentesTab bloqueadoPorInatividade={bloqueadoPorInatividade} buscaDependenteInterno={buscaDependenteInterno} editingAssociado={editingAssociado} handleExcluirDependente={handleExcluirDependente} setBuscaDependenteInterno={setBuscaDependenteInterno} setDependenteEmEdicao={setDependenteEmEdicao} setDependenteFormModalOpen={setDependenteFormModalOpen} state={state} />
                  ) : activeTab === "contratos" ? (
                    <AssociadoContratosTab bloqueadoPorInatividade={bloqueadoPorInatividade} editingAssociado={editingAssociado} empresasConveniadas={empresasConveniadas} planos={planos} selectedContratoId={selectedContratoId} setEditingAssociado={setEditingAssociado} setJustificativaModificacao={setJustificativaModificacao} setModificarPlanoStep={setModificarPlanoStep} setNovoPlanoSelecionado={setNovoPlanoSelecionado} setSelectedContratoId={setSelectedContratoId} setShowModificarPlanoModal={setShowModificarPlanoModal} setShowNovoContrato={setShowNovoContrato} valorPlanoAtivo={valorPlanoAtivo} />
                  ) : activeTab === "mensalidades" ? (
                    <AssociadoMensalidadesTab associado={editingAssociado} onSuccess={!isEditingMode ? () => setActiveTab("documentos") : undefined} />
                  ) : activeTab === "requisicoes" ? (
                    <AssociadoRequisicoesTab associado={editingAssociado} />
                  ) : activeTab === "atendimentos" ? (
                    <AssociadoAtendimentosTab associado={editingAssociado} />
                  ) : activeTab === "documentos" ? (
                    <AssociadoDocumentosTab editingAssociado={editingAssociado} isDraggingDoc={isDraggingDoc} isUploadingDoc={isUploadingDoc} setDocumentoVisualizando={setDocumentoVisualizando} setEditingAssociado={setEditingAssociado} setIsDraggingDoc={setIsDraggingDoc} setIsUploadingDoc={setIsUploadingDoc} state={state} toast={toast} valorPlanoAtivo={valorPlanoAtivo} />
                  ) : null}
                </div>

                {/* Footer Buttons */}
                <AssociadoFormRodape activeTab={activeTab} executarValidacaoOuAlertar={executarValidacaoOuAlertar} handleCloseModal={handleCloseModal} isEditingMode={isEditingMode} isSavedAssociado={isSavedAssociado} isSavingAssociado={isSavingAssociado} setActiveTab={setActiveTab} state={state} />
              </form>
            </div>
          </div>
        </div>
      )}

      {showDependentesModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-bg-surface w-full max-w-3xl rounded-3xl shadow-2xl border border-border-default overflow-hidden flex flex-col max-h-[85vh]">
            <div className="p-6 border-b border-border-default flex items-center justify-between sticky top-0 bg-bg-surface/95 backdrop-blur z-10">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-indigo-500/10 rounded-xl">
                  <Heart className="w-5 h-5 text-indigo-400" />
                </div>
                <h3 className="text-lg font-bold text-text-base">Lista de Dependentes</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowDependentesModal(false)}
                className="p-2 text-text-subtle hover:bg-bg-subtle rounded-full transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="p-6 border-b border-border-default">
              <div className="relative">
                <Search className="w-5 h-5 absolute left-3 top-1/2 transform -translate-y-1/2 text-text-muted" />
                <input
                  type="text"
                  placeholder="Buscar por nome do dependente ou titular..."
                  value={buscaDependentes}
                  onChange={(e) => setBuscaDependentes(e.target.value)}
                  className="w-full bg-bg-subtle border border-border-default rounded-xl pl-10 pr-4 py-2.5 text-text-base focus:border-[#3B82F6] focus:ring-1 focus:ring-[#3B82F6] outline-none transition-all"
                />
              </div>
            </div>

            <div className="p-6 overflow-y-auto flex-1">
              <div className="bg-bg-subtle border border-border-default rounded-2xl overflow-hidden shadow-sm">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm text-text-subtle">
                    <thead className="bg-bg-surface border-b border-border-default text-xs uppercase font-semibold text-text-muted">
                      <tr>
                        <th className="px-6 py-4">Nome do Dependente</th>
                        <th className="px-6 py-4">Parentesco</th>
                        <th className="px-6 py-4">Titular</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border-default">
                      {dependentesFiltrados.length === 0 ? (
                        <tr>
                          <td colSpan={3} className="px-6 py-8 text-center text-text-muted">
                            Nenhum dependente encontrado.
                          </td>
                        </tr>
                      ) : (
                        dependentesFiltrados.map((d: any, index: number) => {
                          const assoc = associados.find((a: any) => 
                            (a.nome && d.titular_nome && a.nome.trim().toLowerCase() === d.titular_nome.trim().toLowerCase()) ||
                            (a.dependentes && a.dependentes.some((dep: any) => dep.id === d.id))
                          );
                          return (
                            <tr 
                              key={index} 
                              onClick={() => {
                                if (assoc) {
                                  setShowDependentesModal(false);
                                  handleOpenModal(assoc);
                                  setActiveTab('dependentes');
                                  setDependenteEmEdicao(d);
                                  setDependenteFormModalOpen(true);
                                }
                              }}
                              className="hover:bg-bg-surface/70 transition-colors cursor-pointer group"
                              title="Clique para abrir e gerenciar este dependente"
                            >
                              <td className="px-6 py-4 text-text-base font-medium">
                                <div className="flex items-center justify-between">
                                  <span>{d.nome}</span>
                                  <Edit2 className="w-3.5 h-3.5 text-[#3B82F6] opacity-0 group-hover:opacity-100 transition-opacity" />
                                </div>
                              </td>
                              <td className="px-6 py-4 capitalize">{d.parentesco || 'Não informado'}</td>
                              <td className="px-6 py-4 text-text-base">{d.titular_nome}</td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
            
            <div className="p-4 border-t border-border-default flex justify-between bg-bg-subtle/50">
              <button
                type="button"
                onClick={handleExportDependentesPDF}
                className="flex items-center gap-2 px-6 py-2 bg-bg-surface border border-border-default text-text-subtle text-sm font-semibold rounded-xl hover:text-text-base hover:bg-bg-hover transition-colors"
                title="Gerar relatório em PDF"
              >
                <Printer className="w-4 h-4" />
                <span>Gerar Relatório</span>
              </button>
              <button
                type="button"
                onClick={() => setShowDependentesModal(false)}
                className="px-6 py-2 bg-bg-hover border border-[#64748B] text-text-muted rounded-xl font-medium hover:bg-[#64748B] hover:text-text-base transition-colors"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}

      {showModificarPlanoModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-bg-surface w-full max-w-lg rounded-3xl shadow-2xl border border-border-default overflow-hidden flex flex-col">
            <div className="p-6 border-b border-border-default flex items-center justify-between bg-bg-surface/95 backdrop-blur z-10">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-[#3B82F6]/10 rounded-xl">
                  <Edit2 className="w-5 h-5 text-[#3B82F6]" />
                </div>
                <h3 className="text-lg font-bold text-text-base">Modificar Plano</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowModificarPlanoModal(false)}
                className="p-2 text-text-subtle hover:bg-bg-subtle rounded-full transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="p-6 overflow-y-auto">
              {modificarPlanoStep === "confirmar" && (
                <div className="space-y-6 text-center">
                  <div className="w-16 h-16 bg-rose-500/10 rounded-full flex items-center justify-center mx-auto mb-4">
                    <AlertCircle className="w-8 h-8 text-rose-500" />
                  </div>
                  <h4 className="text-xl font-bold text-text-base">Atenção!</h4>
                  <p className="text-text-subtle leading-relaxed">
                    Você está prestes a iniciar o processo de modificação do plano atual do associado. 
                    Esta ação afetará o contrato vigente. Deseja continuar?
                  </p>
                  
                  <div className="flex justify-center gap-4 pt-4">
                    <button
                      type="button"
                      onClick={() => setShowModificarPlanoModal(false)}
                      className="px-6 py-2.5 bg-bg-subtle border border-border-default text-text-base rounded-xl font-medium hover:bg-bg-hover transition-colors"
                    >
                      Cancelar
                    </button>
                    <button
                      type="button"
                      onClick={() => setModificarPlanoStep("justificativa")}
                      className="px-6 py-2.5 bg-[#3B82F6] text-white rounded-xl font-medium hover:opacity-90 transition-opacity shadow-lg shadow-[#3B82F6]/25"
                    >
                      Continuar
                    </button>
                  </div>
                </div>
              )}
              
              {modificarPlanoStep === "justificativa" && (
                <div className="space-y-6">
                  <div>
                    <h4 className="text-lg font-bold text-text-base mb-2">Justificativa</h4>
                    <p className="text-sm text-text-subtle">
                      Por favor, informe o motivo para a alteração de plano deste associado.
                    </p>
                  </div>
                  
                  <textarea
                    value={justificativaModificacao}
                    onChange={(e) => setJustificativaModificacao(e.target.value)}
                    rows={4}
                    placeholder="Ex: Upgrade de plano solicitado pelo cliente, ajuste de valores..."
                    className="w-full px-4 py-3 bg-bg-subtle border border-border-default rounded-xl text-text-base focus:border-[#3B82F6] focus:ring-1 focus:ring-[#3B82F6] outline-none transition-all resize-none"
                  ></textarea>
                  
                  <div className="flex justify-end gap-4 pt-4">
                    <button
                      type="button"
                      onClick={() => setModificarPlanoStep("confirmar")}
                      className="px-6 py-2.5 bg-bg-subtle border border-border-default text-text-base rounded-xl font-medium hover:bg-bg-hover transition-colors"
                    >
                      Voltar
                    </button>
                    <button
                      type="button"
                      disabled={!justificativaModificacao.trim()}
                      onClick={() => setModificarPlanoStep("selecionar")}
                      className="px-6 py-2.5 bg-[#3B82F6] text-white rounded-xl font-medium hover:opacity-90 transition-opacity shadow-lg shadow-[#3B82F6]/25 disabled:opacity-50"
                    >
                      Avançar
                    </button>
                  </div>
                </div>
              )}
              
              {modificarPlanoStep === "selecionar" && (
                <div className="space-y-6">
                  <div>
                    <h4 className="text-lg font-bold text-text-base mb-2">Novo Plano</h4>
                    <p className="text-sm text-text-subtle">
                      Selecione o novo plano para o associado. A alteração será efetivada ao salvar o cadastro.
                    </p>
                  </div>
                  
                  <div className="space-y-1">
                    <PlanoPaxSelect
                      value={novoPlanoSelecionado}
                      onChange={(id) => {
                        setNovoPlanoSelecionado(id);
                      }}
                      nVidas={1 + (editingAssociado?.dependentes?.length || 0)}
                      idadesDependentes={editingAssociado?.dependentes?.filter((d: any) => d.data_nascimento).map((d: any) => {
                        const ageDifMs = Date.now() - new Date(d.data_nascimento!).getTime();
                        const ageDate = new Date(ageDifMs);
                        return Math.abs(ageDate.getUTCFullYear() - 1970);
                      }) || []}
                    />
                  </div>
                  
                  <div className="flex justify-end gap-4 pt-6 mt-4 border-t border-border-default">
                    <button
                      type="button"
                      onClick={() => setModificarPlanoStep("justificativa")}
                      className="px-6 py-2.5 bg-bg-subtle border border-border-default text-text-base rounded-xl font-medium hover:bg-bg-hover transition-colors"
                    >
                      Voltar
                    </button>
                    <button
                      type="button"
                      disabled={!novoPlanoSelecionado}
                      onClick={() => {
                        if (editingAssociado) {
                          setEditingAssociado({
                            ...editingAssociado,
                            plano_pax_id: novoPlanoSelecionado,
                            justificativa_modificacao_plano: justificativaModificacao
                          } as any);
                        }
                        setShowModificarPlanoModal(false);
                      }}
                      className="px-6 py-2.5 bg-emerald-500 text-white rounded-xl font-medium hover:opacity-90 transition-opacity shadow-lg shadow-emerald-500/25 disabled:opacity-50"
                    >
                      Confirmar Modificação
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {showNovoContrato && editingAssociado && (
        <NovoContratoWizard 
          associadoInicial={editingAssociado}
          onClose={() => setShowNovoContrato(false)}
          onSuccess={() => {
            setShowNovoContrato(false);
            loadData();
            handleCloseModal();
          }}
        />
      )}

      {/* Visualizador de Documentos */}
      {documentoVisualizando && (
        <VisualizadorDocumentoModal
          documento={documentoVisualizando}
          onClose={() => setDocumentoVisualizando(null)}
        />
      )}

      {/* Modal Independente de Formulário de Dependente */}
      {dependenteFormModalOpen && editingAssociado && (
        <DependenteFormModal
          isOpen={dependenteFormModalOpen}
          onClose={() => {
            setDependenteFormModalOpen(false);
            setDependenteEmEdicao(null);
          }}
          dependente={dependenteEmEdicao}
          titularNome={editingAssociado.nome}
          existingCpfs={(editingAssociado.dependentes || []).map((d: any) => d.cpf || "").filter(Boolean)}
          onDelete={handleExcluirDependente}
          onSave={(salvoDep) => {
            setEditingAssociado((prev: any) => {
              if (!prev) return null;
              const deps = prev.dependentes ? [...prev.dependentes] : [];
              const index = deps.findIndex((d: any) => d.id === salvoDep.id);
              if (index !== -1) {
                deps[index] = salvoDep;
              } else {
                deps.push(salvoDep);
              }
              return {
                ...prev,
                dependentes: deps,
              };
            });
            setDependenteFormModalOpen(false);
            setDependenteEmEdicao(null);
          }}
        />
      )}

      {/* Relatório Profissional Modal */}
      <RelatorioAssociadosModal
        isOpen={showRelatorioModal}
        onClose={() => setShowRelatorioModal(false)}
        associados={filtered}
        empresaData={empresaData}
        currentFilters={{
          searchTerm,
          statusFilter,
          planoFilter,
          empresaFilter
        }}
        fornecedores={fornecedores || []}
        userName={state.user?.nome || 'Administrador'}
        initialReportType={relatorioReportType}
      />
    </>
  );
};
