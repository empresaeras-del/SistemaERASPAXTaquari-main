import React from 'react';
import { X, User, Users, Activity, FileText, FolderOpen, ClipboardList, DollarSign, ChevronRight, CheckCircle, Save } from 'lucide-react';
import { AlertaAlteracoesPendentes } from './common/AlertaAlteracoesPendentes';
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

export const AssociadoFormModal = (props: any) => {
  const {
    state, toast, confirm, planos, planosCompletos, calcularValor, fornecedores,
    associados, setAssociados, loading, setLoading, previewAssociado, setPreviewAssociado,
    empresaData, setEmpresaData, showRelatorioModal, setShowRelatorioModal,
    relatorioReportType, setRelatorioReportType, viewMode, setViewMode,
    searchTerm, setSearchTerm, visibleColumns, isVisible, setVisibleColumns,
    columns, statusFilter, setStatusFilter, planoFilter, setPlanoFilter,
    sortBy, setSortBy, showFilters, setShowFilters, filtered, activeTab, setActiveTab,
    isModalOpen, setIsModalOpen, editingAssociado, setEditingAssociado,
    dependenteFormModalOpen, setDependenteFormModalOpen, dependenteEmEdicao, setDependenteEmEdicao,
    selectedContratoId, setSelectedContratoId, isEditingMode, setIsEditingMode,
    documentoVisualizando, setDocumentoVisualizando, isUploadingDoc, setIsUploadingDoc,
    isDraggingDoc, setIsDraggingDoc, isSavingAssociado, setIsSavingAssociado,
    isSavedAssociado, setIsSavedAssociado, initialAssociadoSnapshot, setInitialAssociadoSnapshot,
    hasUnsavedChanges, handleWhatsAppMenu, activeSubTab, setActiveSubTab,
    showDependentesModal, setShowDependentesModal, buscaDependenteInterno, setBuscaDependenteInterno,
    buscaDependentes, setBuscaDependentes, showModificarPlanoModal, setShowModificarPlanoModal,
    showNovoContrato, setShowNovoContrato, modificarPlanoStep, setModificarPlanoStep,
    justificativaModificacao, setJustificativaModificacao, novoPlanoSelecionado, setNovoPlanoSelecionado,
    parcelasAbertasMap, setParcelasAbertasMap, valorPlanoAtivo, todosDependentes, dependentesFiltrados,
    loadData, fieldErrors, setFieldErrors, buscandoCep, setBuscandoCep, buscarCepViaCep,
    executarValidacaoOuAlertar, handleFieldChange, handleOpenModal, handleCloseModal,
    handleSave, handleDelete, handleExcluirDependente, handleExportPDF, handleExportDependentesPDF,
    totalTitulares, totalDependentes, vidasProtegidas, inadimplentes, qtdAssociadosAtivosSemParcelas
  } = props;

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
                onClick={handleCloseModal}
                className="text-text-subtle hover:text-text-base transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

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
                <div className="w-64 border-r border-border-default bg-bg-surface/30 flex flex-col py-4 shrink-0">
                  <button
                    type="button"
                    onClick={() => {
                      if (!executarValidacaoOuAlertar()) return;
                      setActiveTab("resumo");
                    }}
                    className={`px-6 py-3 text-left font-medium text-sm transition-colors border-l-2 flex items-center gap-3 ${
                      activeTab === "resumo"
                        ? "border-[#3B82F6] text-[#3B82F6] bg-[#3B82F6]/10"
                        : "border-transparent text-text-subtle hover:text-text-base hover:bg-white/5"
                    }`}
                  >
                    <Activity className="w-4 h-4" />
                    Resumo Financeiro
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (!executarValidacaoOuAlertar()) return;
                      setActiveTab("principal");
                    }}
                    className={`px-6 py-3 text-left font-medium text-sm transition-colors border-l-2 flex items-center gap-3 ${
                      activeTab === "principal"
                        ? "border-[#3B82F6] text-[#3B82F6] bg-[#3B82F6]/10"
                        : "border-transparent text-text-subtle hover:text-text-base hover:bg-white/5"
                    }`}
                  >
                    <User className="w-4 h-4" />
                    Dados Principais
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (!executarValidacaoOuAlertar()) return;
                      setActiveTab("dependentes");
                    }}
                    className={`px-6 py-3 text-left font-medium text-sm transition-colors border-l-2 flex items-center gap-3 ${
                      activeTab === "dependentes"
                        ? "border-[#3B82F6] text-[#3B82F6] bg-[#3B82F6]/10"
                        : "border-transparent text-text-subtle hover:text-text-base hover:bg-white/5"
                    }`}
                  >
                    <Users className="w-4 h-4" />
                    Dependentes
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (!executarValidacaoOuAlertar()) return;
                      setActiveTab("contratos");
                    }}
                    className={`px-6 py-3 text-left font-medium text-sm transition-colors border-l-2 flex items-center gap-3 ${
                      activeTab === "contratos"
                        ? "border-[#3B82F6] text-[#3B82F6] bg-[#3B82F6]/10"
                        : "border-transparent text-text-subtle hover:text-text-base hover:bg-white/5"
                    }`}
                  >
                    <FileText className="w-4 h-4" />
                    Contratos
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (!executarValidacaoOuAlertar()) return;
                      setActiveTab("mensalidades");
                    }}
                    className={`px-6 py-3 text-left font-medium text-sm transition-colors border-l-2 flex items-center gap-3 ${
                      activeTab === "mensalidades"
                        ? "border-[#3B82F6] text-[#3B82F6] bg-[#3B82F6]/10"
                        : "border-transparent text-text-subtle hover:text-text-base hover:bg-white/5"
                    }`}
                  >
                    <DollarSign className="w-4 h-4" />
                    Mensalidades
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (!executarValidacaoOuAlertar()) return;
                      setActiveTab("documentos");
                    }}
                    className={`px-6 py-3 text-left font-medium text-sm transition-colors border-l-2 flex items-center gap-3 ${
                      activeTab === "documentos"
                        ? "border-[#3B82F6] text-[#3B82F6] bg-[#3B82F6]/10"
                        : "border-transparent text-text-subtle hover:text-text-base hover:bg-white/5"
                    }`}
                  >
                    <FolderOpen className="w-4 h-4" />
                    Documentos
                  </button>
                  {isEditingMode && (
                    <>
                      <button
                        type="button"
                        onClick={() => {
                          if (!executarValidacaoOuAlertar()) return;
                          setActiveTab("requisicoes");
                        }}
                        className={`px-6 py-3 text-left font-medium text-sm transition-colors border-l-2 flex items-center gap-3 ${
                          activeTab === "requisicoes"
                            ? "border-[#3B82F6] text-[#3B82F6] bg-[#3B82F6]/10"
                            : "border-transparent text-text-subtle hover:text-text-base hover:bg-white/5"
                        }`}
                      >
                        <ClipboardList className="w-4 h-4" />
                        Requisições
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          if (!executarValidacaoOuAlertar()) return;
                          setActiveTab("atendimentos");
                        }}
                        className={`px-6 py-3 text-left font-medium text-sm transition-colors border-l-2 flex items-center gap-3 ${
                          activeTab === "atendimentos"
                            ? "border-[#3B82F6] text-[#3B82F6] bg-[#3B82F6]/10"
                            : "border-transparent text-text-subtle hover:text-text-base hover:bg-white/5"
                        }`}
                      >
                        <Activity className="w-4 h-4" />
                        Atendimentos
                      </button>
                    </>
                  )}
                </div>
              ) : (
                <div className="px-8 py-5 border-b border-border-default bg-bg-surface/30">
                  <div className="flex items-center justify-between max-w-2xl mx-auto">
                    {/* Step 1 */}
                    <div
                      className={`flex flex-col items-center flex-1 ${activeTab === "principal" || activeTab === "dependentes" || activeTab === "contratos" || activeTab === "mensalidades" || activeTab === "documentos" ? "text-[#3B82F6]" : "text-text-subtle"}`}
                    >
                      <div
                        className={`w-8 h-8 rounded-full flex items-center justify-center font-bold mb-2 transition-colors ${activeTab === "principal" || activeTab === "dependentes" || activeTab === "contratos" || activeTab === "mensalidades" || activeTab === "documentos" ? "bg-[#3B82F6] text-white shadow-[0_0_10px_rgba(59,130,246,0.5)]" : "bg-bg-hover text-text-subtle"}`}
                      >
                        1
                      </div>
                      <span className="text-xs font-medium">Dados Básicos</span>
                    </div>

                    <div
                      className={`w-16 h-0.5 mx-2 ${activeTab === "dependentes" || activeTab === "contratos" || activeTab === "mensalidades" || activeTab === "documentos" ? "bg-[#3B82F6]" : "bg-bg-hover"}`}
                    ></div>

                    {/* Step 2 */}
                    <div
                      className={`flex flex-col items-center flex-1 ${activeTab === "dependentes" || activeTab === "contratos" || activeTab === "mensalidades" || activeTab === "documentos" ? "text-[#3B82F6]" : "text-text-subtle"}`}
                    >
                      <div
                        className={`w-8 h-8 rounded-full flex items-center justify-center font-bold mb-2 transition-colors ${activeTab === "dependentes" || activeTab === "contratos" || activeTab === "mensalidades" || activeTab === "documentos" ? "bg-[#3B82F6] text-white shadow-[0_0_10px_rgba(59,130,246,0.5)]" : "bg-bg-hover text-text-subtle"}`}
                      >
                        2
                      </div>
                      <span className="text-xs font-medium">Dependentes</span>
                    </div>

                    <div
                      className={`w-16 h-0.5 mx-2 ${activeTab === "contratos" || activeTab === "mensalidades" || activeTab === "documentos" ? "bg-[#3B82F6]" : "bg-bg-hover"}`}
                    ></div>

                    {/* Step 3 */}
                    <div
                      className={`flex flex-col items-center flex-1 ${activeTab === "contratos" || activeTab === "mensalidades" || activeTab === "documentos" ? "text-[#3B82F6]" : "text-text-subtle"}`}
                    >
                      <div
                        className={`w-8 h-8 rounded-full flex items-center justify-center font-bold mb-2 transition-colors ${activeTab === "contratos" || activeTab === "mensalidades" || activeTab === "documentos" ? "bg-[#3B82F6] text-white shadow-[0_0_10px_rgba(59,130,246,0.5)]" : "bg-bg-hover text-text-subtle"}`}
                      >
                        3
                      </div>
                      <span className="text-xs font-medium">Contrato</span>
                    </div>

                    <div
                      className={`w-16 h-0.5 mx-2 ${activeTab === "mensalidades" || activeTab === "documentos" ? "bg-[#3B82F6]" : "bg-bg-hover"}`}
                    ></div>

                    {/* Step 4 */}
                    <div
                      className={`flex flex-col items-center flex-1 ${activeTab === "mensalidades" || activeTab === "documentos" ? "text-[#3B82F6]" : "text-text-subtle"}`}
                    >
                      <div
                        className={`w-8 h-8 rounded-full flex items-center justify-center font-bold mb-2 transition-colors ${activeTab === "mensalidades" || activeTab === "documentos" ? "bg-[#3B82F6] text-white shadow-[0_0_10px_rgba(59,130,246,0.5)]" : "bg-bg-hover text-text-subtle"}`}
                      >
                        4
                      </div>
                      <span className="text-xs font-medium">Mensalidades</span>
                    </div>

                    <div
                      className={`w-16 h-0.5 mx-2 ${activeTab === "documentos" ? "bg-[#3B82F6]" : "bg-bg-hover"}`}
                    ></div>

                    {/* Step 5 */}
                    <div
                      className={`flex flex-col items-center flex-1 ${activeTab === "documentos" ? "text-[#3B82F6]" : "text-text-subtle"}`}
                    >
                      <div
                        className={`w-8 h-8 rounded-full flex items-center justify-center font-bold mb-2 transition-colors ${activeTab === "documentos" ? "bg-[#3B82F6] text-white shadow-[0_0_10px_rgba(59,130,246,0.5)]" : "bg-bg-hover text-text-subtle"}`}
                      >
                        5
                      </div>
                      <span className="text-xs font-medium">Documentos</span>
                    </div>
                  </div>
                </div>
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
                    <div className="animate-in fade-in slide-in-from-bottom-2 duration-300 flex flex-col h-full">
                      {/* Sub-tabs para Dados Principais (Fichários) */}
                      <div className="flex overflow-x-auto gap-2 pb-4 mb-4 border-b border-border-default/50 custom-scrollbar shrink-0">
                        {(() => {
                          const { erros } = validarDadosAssociado(editingAssociado);
                          const errBasicas = erros.filter(e => e.subTab === "basicas").length;
                          const errContato = erros.filter(e => e.subTab === "contato").length;
                          const errEndereco = erros.filter(e => e.subTab === "endereco").length;
                          const errSistema = erros.filter(e => e.subTab === "sistema").length;

                          return (
                            <>
                              <button
                                type="button"
                                onClick={() => setActiveSubTab("basicas")}
                                className={`px-4 py-2 text-sm font-semibold whitespace-nowrap rounded-lg transition-colors flex items-center gap-1.5 ${activeSubTab === "basicas" ? "bg-[#3B82F6]/10 text-[#3B82F6]" : "text-text-subtle hover:text-text-base hover:bg-bg-hover"}`}
                              >
                                <span>Informações Básicas</span>
                                {Object.keys(fieldErrors).length > 0 && errBasicas > 0 && (
                                  <span className="px-1.5 py-0.5 text-[10px] bg-rose-500 text-white rounded-full font-bold">
                                    {errBasicas}
                                  </span>
                                )}
                              </button>
                              <button
                                type="button"
                                onClick={() => setActiveSubTab("filiacao")}
                                className={`px-4 py-2 text-sm font-semibold whitespace-nowrap rounded-lg transition-colors flex items-center gap-1.5 ${activeSubTab === "filiacao" ? "bg-indigo-500/10 text-indigo-400" : "text-text-subtle hover:text-text-base hover:bg-bg-hover"}`}
                              >
                                <span>Filiação</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => setActiveSubTab("contato")}
                                className={`px-4 py-2 text-sm font-semibold whitespace-nowrap rounded-lg transition-colors flex items-center gap-1.5 ${activeSubTab === "contato" ? "bg-emerald-500/10 text-emerald-400" : "text-text-subtle hover:text-text-base hover:bg-bg-hover"}`}
                              >
                                <span>Contato</span>
                                {Object.keys(fieldErrors).length > 0 && errContato > 0 && (
                                  <span className="px-1.5 py-0.5 text-[10px] bg-rose-500 text-white rounded-full font-bold">
                                    {errContato}
                                  </span>
                                )}
                              </button>
                              <button
                                type="button"
                                onClick={() => setActiveSubTab("endereco")}
                                className={`px-4 py-2 text-sm font-semibold whitespace-nowrap rounded-lg transition-colors flex items-center gap-1.5 ${activeSubTab === "endereco" ? "bg-amber-500/10 text-amber-400" : "text-text-subtle hover:text-text-base hover:bg-bg-hover"}`}
                              >
                                <span>Endereço</span>
                                {Object.keys(fieldErrors).length > 0 && errEndereco > 0 && (
                                  <span className="px-1.5 py-0.5 text-[10px] bg-rose-500 text-white rounded-full font-bold">
                                    {errEndereco}
                                  </span>
                                )}
                              </button>
                              <button
                                type="button"
                                onClick={() => setActiveSubTab("sistema")}
                                className={`px-4 py-2 text-sm font-semibold whitespace-nowrap rounded-lg transition-colors flex items-center gap-1.5 ${activeSubTab === "sistema" ? "bg-purple-500/10 text-purple-400" : "text-text-subtle hover:text-text-base hover:bg-bg-hover"}`}
                              >
                                <span>Informações do Sistema</span>
                                {Object.keys(fieldErrors).length > 0 && errSistema > 0 && (
                                  <span className="px-1.5 py-0.5 text-[10px] bg-rose-500 text-white rounded-full font-bold">
                                    {errSistema}
                                  </span>
                                )}
                              </button>
                            </>
                          );
                        })()}
                      </div>

                      <div className="space-y-8">
                      {/* Section: Informações Básicas */}
                      <div className={`bg-bg-subtle/50 p-6 rounded-2xl border border-border-default/50 space-y-6 ${activeSubTab === "basicas" ? "block animate-in fade-in slide-in-from-bottom-2" : "hidden"}`}>
                        <div className="flex items-center gap-3 border-b border-border-default/50 pb-4">
                          <div className="p-2 bg-[#3B82F6]/10 rounded-xl text-[#3B82F6]">
                            <User className="w-5 h-5" />
                          </div>
                          <h4 className="text-lg font-bold text-text-base tracking-tight">
                            Informações Básicas
                          </h4>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                          <div className="space-y-1">
                            <label className="block text-sm font-semibold text-text-muted uppercase tracking-wider mb-1">
                              Nome Completo *
                            </label>
                            <input
                              type="text"
                              value={editingAssociado.nome || ""}
                              onChange={(e) => handleFieldChange("nome", e.target.value)}
                              placeholder="Digite o nome completo"
                              className={`w-full px-4 py-2.5 bg-bg-surface border rounded-xl text-text-base focus:outline-none transition-all ${
                                fieldErrors.nome
                                  ? "border-rose-500 ring-2 ring-rose-500/30 bg-rose-500/5"
                                  : "border-border-default focus:ring-2 focus:ring-[#3B82F6]/50 focus:border-[#3B82F6]"
                              }`}
                            />
                            {fieldErrors.nome && (
                              <p className="text-xs text-rose-500 flex items-center gap-1 mt-1 font-medium">
                                <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                                {fieldErrors.nome}
                              </p>
                            )}
                          </div>

                          <div className="space-y-1">
                            <label className="block text-sm font-semibold text-text-muted uppercase tracking-wider mb-1">
                              CPF *
                            </label>
                            <input
                              type="text"
                              maxLength={14}
                              placeholder="000.000.000-00"
                              value={editingAssociado.cpf || ""}
                              onChange={(e) => {
                                const formatted = maskCPFOrCNPJ(e.target.value, false);
                                handleFieldChange("cpf", formatted);
                                const cpfLimpo = formatted.replace(/\D/g, '');
                                if (cpfLimpo.length === 11) {
                                  const duplicateUser = associados.find(a => a.status === 'ativo' && a.cpf?.replace(/\D/g, '') === cpfLimpo && a.id !== editingAssociado.id);
                                  if (duplicateUser) {
                                    toast.error(`ATENÇÃO: CPF já cadastrado no associado ativo: ${duplicateUser.nome}`);
                                  }
                                }
                              }}
                              className={`w-full px-4 py-2.5 bg-bg-surface border rounded-xl text-text-base focus:outline-none transition-all ${
                                fieldErrors.cpf
                                  ? "border-rose-500 ring-2 ring-rose-500/30 bg-rose-500/5"
                                  : "border-border-default focus:ring-2 focus:ring-[#3B82F6]/50 focus:border-[#3B82F6]"
                              }`}
                            />
                            {fieldErrors.cpf && (
                              <p className="text-xs text-rose-500 flex items-center gap-1 mt-1 font-medium">
                                <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                                {fieldErrors.cpf}
                              </p>
                            )}
                          </div>

                          <div className="space-y-1">
                            <label className="block text-sm font-semibold text-text-muted uppercase tracking-wider mb-1">
                              RG
                            </label>
                            <input
                              type="text"
                              value={editingAssociado.rg || ""}
                              onChange={(e) => handleFieldChange("rg", e.target.value)}
                              placeholder="Número do RG"
                              className="w-full px-4 py-2.5 bg-bg-surface border border-border-default rounded-xl text-text-base focus:outline-none focus:ring-2 focus:ring-[#3B82F6]/50 focus:border-[#3B82F6] transition-all"
                            />
                          </div>

                          <div className="space-y-1">
                            <label className="block text-sm font-semibold text-text-muted uppercase tracking-wider mb-1">
                              Data de Nascimento *
                            </label>
                            <input
                              type="date"
                              value={editingAssociado.data_nascimento || ""}
                              onChange={(e) => handleFieldChange("data_nascimento", e.target.value)}
                              className={`w-full px-4 py-2.5 bg-bg-surface border rounded-xl text-text-base focus:outline-none transition-all ${
                                fieldErrors.data_nascimento
                                  ? "border-rose-500 ring-2 ring-rose-500/30 bg-rose-500/5"
                                  : "border-border-default focus:ring-2 focus:ring-[#3B82F6]/50 focus:border-[#3B82F6]"
                              }`}
                            />
                            {fieldErrors.data_nascimento && (
                              <p className="text-xs text-rose-500 flex items-center gap-1 mt-1 font-medium">
                                <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                                {fieldErrors.data_nascimento}
                              </p>
                            )}
                          </div>

                          <div className="space-y-1">
                            <label className="block text-sm font-semibold text-text-muted uppercase tracking-wider mb-1">
                              Sexo *
                            </label>
                            <select
                              value={editingAssociado.sexo || ""}
                              onChange={(e) => handleFieldChange("sexo", e.target.value)}
                              className={`w-full px-4 py-2.5 bg-bg-surface border rounded-xl text-text-base focus:outline-none transition-all ${
                                fieldErrors.sexo
                                  ? "border-rose-500 ring-2 ring-rose-500/30 bg-rose-500/5"
                                  : "border-border-default focus:ring-2 focus:ring-[#3B82F6]/50 focus:border-[#3B82F6]"
                              }`}
                            >
                              <option value="">Selecione</option>
                              <option value="M">Masculino</option>
                              <option value="F">Feminino</option>
                              <option value="O">Outro</option>
                            </select>
                            {fieldErrors.sexo && (
                              <p className="text-xs text-rose-500 flex items-center gap-1 mt-1 font-medium">
                                <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                                {fieldErrors.sexo}
                              </p>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Section: Filiação */}
                      <div className={`bg-bg-subtle/50 p-6 rounded-2xl border border-border-default/50 space-y-6 ${activeSubTab === "filiacao" ? "block animate-in fade-in slide-in-from-bottom-2" : "hidden"}`}>
                        <div className="flex items-center gap-3 border-b border-border-default/50 pb-4">
                          <div className="p-2 bg-indigo-500/10 rounded-xl text-indigo-400">
                            <Users className="w-5 h-5" />
                          </div>
                          <h4 className="text-lg font-bold text-text-base tracking-tight">
                            Filiação
                          </h4>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                          <div className="space-y-1">
                            <label className="block text-sm font-semibold text-text-muted uppercase tracking-wider mb-1">
                              Nome da Mãe
                            </label>
                            <input
                              type="text"
                              value={editingAssociado.nome_mae || ""}
                              onChange={(e) => handleFieldChange("nome_mae", e.target.value)}
                              placeholder="Nome da mãe"
                              className="w-full px-4 py-2.5 bg-bg-surface border border-border-default rounded-xl text-text-base focus:outline-none focus:ring-2 focus:ring-[#3B82F6]/50 focus:border-[#3B82F6] transition-all"
                            />
                          </div>
                          <div className="space-y-1">
                            <label className="block text-sm font-semibold text-text-muted uppercase tracking-wider mb-1">
                              Nome do Pai
                            </label>
                            <input
                              type="text"
                              value={editingAssociado.nome_pai || ""}
                              onChange={(e) => handleFieldChange("nome_pai", e.target.value)}
                              placeholder="Nome do pai"
                              className="w-full px-4 py-2.5 bg-bg-surface border border-border-default rounded-xl text-text-base focus:outline-none focus:ring-2 focus:ring-[#3B82F6]/50 focus:border-[#3B82F6] transition-all"
                            />
                          </div>
                        </div>
                      </div>

                      {/* Section: Contato */}
                      <div className={`bg-bg-subtle/50 p-6 rounded-2xl border border-border-default/50 space-y-6 ${activeSubTab === "contato" ? "block animate-in fade-in slide-in-from-bottom-2" : "hidden"}`}>
                        <div className="flex items-center gap-3 border-b border-border-default/50 pb-4">
                          <div className="p-2 bg-emerald-500/10 rounded-xl text-emerald-400">
                            <Phone className="w-5 h-5" />
                          </div>
                          <h4 className="text-lg font-bold text-text-base tracking-tight">
                            Contato
                          </h4>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                          <div className="space-y-1">
                            <label className="block text-sm font-semibold text-text-muted uppercase tracking-wider mb-1">
                              Telefone *
                            </label>
                            <input
                              type="tel"
                              maxLength={15}
                              placeholder="(00) 00000-0000"
                              value={editingAssociado.telefone || ""}
                              onChange={(e) => {
                                const formatted = formatPhone(e.target.value);
                                handleFieldChange("telefone", formatted);
                              }}
                              className={`w-full px-4 py-2.5 bg-bg-surface border rounded-xl text-text-base focus:outline-none transition-all ${
                                fieldErrors.telefone
                                  ? "border-rose-500 ring-2 ring-rose-500/30 bg-rose-500/5"
                                  : "border-border-default focus:ring-2 focus:ring-[#3B82F6]/50 focus:border-[#3B82F6]"
                              }`}
                            />
                            {fieldErrors.telefone && (
                              <p className="text-xs text-rose-500 flex items-center gap-1 mt-1 font-medium">
                                <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                                {fieldErrors.telefone}
                              </p>
                            )}
                          </div>
                          <div className="space-y-1">
                            <label className="block text-sm font-semibold text-text-muted uppercase tracking-wider mb-1">
                              E-mail
                            </label>
                            <input
                              type="email"
                              value={editingAssociado.email || ""}
                              onChange={(e) => handleFieldChange("email", e.target.value)}
                              placeholder="exemplo@email.com"
                              className="w-full px-4 py-2.5 bg-bg-surface border border-border-default rounded-xl text-text-base focus:outline-none focus:ring-2 focus:ring-[#3B82F6]/50 focus:border-[#3B82F6] transition-all"
                            />
                          </div>
                        </div>
                      </div>

                      {/* Section: Endereço */}
                      <div className={`bg-bg-subtle/50 p-6 rounded-2xl border border-border-default/50 space-y-6 ${activeSubTab === "endereco" ? "block animate-in fade-in slide-in-from-bottom-2" : "hidden"}`}>
                        <div className="flex items-center justify-between border-b border-border-default/50 pb-4">
                          <div className="flex items-center gap-3">
                            <div className="p-2 bg-amber-500/10 rounded-xl text-amber-400">
                              <MapPin className="w-5 h-5" />
                            </div>
                            <div>
                              <h4 className="text-lg font-bold text-text-base tracking-tight">
                                Endereço Residencial
                              </h4>
                              <p className="text-xs text-text-subtle">Digite o CEP para buscar automaticamente ou preencha os campos abaixo</p>
                            </div>
                          </div>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-12 gap-5">
                          {/* CEP */}
                          <div className="space-y-1 md:col-span-3">
                            <label className="block text-xs font-semibold text-text-muted uppercase tracking-wider mb-1">
                              CEP *
                            </label>
                            <div className="relative flex items-center">
                              <input
                                type="text"
                                maxLength={9}
                                placeholder="00000-000"
                                value={editingAssociado.endereco_cep || editingAssociado.cep || ""}
                                onChange={(e) => handleFieldChange("endereco_cep", e.target.value)}
                                className={`w-full px-3.5 py-2.5 pr-10 bg-bg-surface border rounded-xl text-text-base text-sm focus:outline-none transition-all ${
                                  fieldErrors.endereco_cep || fieldErrors.cep
                                    ? "border-rose-500 ring-2 ring-rose-500/30 bg-rose-500/5"
                                    : "border-border-default focus:ring-2 focus:ring-[#3B82F6]/50 focus:border-[#3B82F6]"
                                }`}
                              />
                              <button
                                type="button"
                                disabled={buscandoCep}
                                onClick={() => buscarCepViaCep(editingAssociado.endereco_cep || editingAssociado.cep || "")}
                                title="Buscar endereço pelo CEP"
                                className="absolute right-2 p-1.5 text-text-subtle hover:text-[#3B82F6] hover:bg-bg-hover rounded-lg transition-colors disabled:opacity-50"
                              >
                                {buscandoCep ? (
                                  <div className="w-4 h-4 border-2 border-[#3B82F6] border-t-transparent rounded-full animate-spin" />
                                ) : (
                                  <Search className="w-4 h-4" />
                                )}
                              </button>
                            </div>
                            {(fieldErrors.endereco_cep || fieldErrors.cep) && (
                              <p className="text-[11px] text-rose-500 flex items-center gap-1 mt-1 font-medium">
                                <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                                {fieldErrors.endereco_cep || fieldErrors.cep}
                              </p>
                            )}
                          </div>

                          {/* Logradouro */}
                          <div className="space-y-1 md:col-span-6">
                            <label className="block text-xs font-semibold text-text-muted uppercase tracking-wider mb-1">
                              Logradouro *
                            </label>
                            <input
                              type="text"
                              placeholder="Rua, Avenida, Alameda, Travessa..."
                              value={editingAssociado.endereco_logradouro || editingAssociado.logradouro || ""}
                              onChange={(e) => handleFieldChange("endereco_logradouro", e.target.value)}
                              className={`w-full px-3.5 py-2.5 bg-bg-surface border rounded-xl text-text-base text-sm focus:outline-none transition-all ${
                                fieldErrors.endereco_logradouro || fieldErrors.logradouro
                                  ? "border-rose-500 ring-2 ring-rose-500/30 bg-rose-500/5"
                                  : "border-border-default focus:ring-2 focus:ring-[#3B82F6]/50 focus:border-[#3B82F6]"
                              }`}
                            />
                            {(fieldErrors.endereco_logradouro || fieldErrors.logradouro) && (
                              <p className="text-[11px] text-rose-500 flex items-center gap-1 mt-1 font-medium">
                                <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                                {fieldErrors.endereco_logradouro || fieldErrors.logradouro}
                              </p>
                            )}
                          </div>

                          {/* Número */}
                          <div className="space-y-1 md:col-span-3">
                            <label className="block text-xs font-semibold text-text-muted uppercase tracking-wider mb-1">
                              Número *
                            </label>
                            <input
                              type="text"
                              placeholder="Nº ou S/N"
                              value={editingAssociado.endereco_numero || editingAssociado.numero || ""}
                              onChange={(e) => handleFieldChange("endereco_numero", e.target.value)}
                              className={`w-full px-3.5 py-2.5 bg-bg-surface border rounded-xl text-text-base text-sm focus:outline-none transition-all ${
                                fieldErrors.endereco_numero || fieldErrors.numero
                                  ? "border-rose-500 ring-2 ring-rose-500/30 bg-rose-500/5"
                                  : "border-border-default focus:ring-2 focus:ring-[#3B82F6]/50 focus:border-[#3B82F6]"
                              }`}
                            />
                            {(fieldErrors.endereco_numero || fieldErrors.numero) && (
                              <p className="text-[11px] text-rose-500 flex items-center gap-1 mt-1 font-medium">
                                <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                                {fieldErrors.endereco_numero || fieldErrors.numero}
                              </p>
                            )}
                          </div>

                          {/* Bairro */}
                          <div className="space-y-1 md:col-span-6">
                            <label className="block text-xs font-semibold text-text-muted uppercase tracking-wider mb-1">
                              Bairro *
                            </label>
                            <input
                              type="text"
                              placeholder="Nome do bairro"
                              value={editingAssociado.endereco_bairro || editingAssociado.bairro || ""}
                              onChange={(e) => handleFieldChange("endereco_bairro", e.target.value)}
                              className={`w-full px-3.5 py-2.5 bg-bg-surface border rounded-xl text-text-base text-sm focus:outline-none transition-all ${
                                fieldErrors.endereco_bairro || fieldErrors.bairro
                                  ? "border-rose-500 ring-2 ring-rose-500/30 bg-rose-500/5"
                                  : "border-border-default focus:ring-2 focus:ring-[#3B82F6]/50 focus:border-[#3B82F6]"
                              }`}
                            />
                            {(fieldErrors.endereco_bairro || fieldErrors.bairro) && (
                              <p className="text-[11px] text-rose-500 flex items-center gap-1 mt-1 font-medium">
                                <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                                {fieldErrors.endereco_bairro || fieldErrors.bairro}
                              </p>
                            )}
                          </div>

                          {/* Cidade / UF / Município */}
                          <div className="space-y-1 md:col-span-6">
                            <label className="block text-xs font-semibold text-text-muted uppercase tracking-wider mb-1">
                              Município / UF *
                            </label>
                            <input
                              type="text"
                              placeholder="Ex: Coxim - MS ou Taquari"
                              value={editingAssociado.endereco_cidade || editingAssociado.cidade || editingAssociado.municipio || ""}
                              onChange={(e) => handleFieldChange("endereco_cidade", e.target.value)}
                              className={`w-full px-3.5 py-2.5 bg-bg-surface border rounded-xl text-text-base text-sm focus:outline-none transition-all ${
                                fieldErrors.endereco_cidade || fieldErrors.cidade
                                  ? "border-rose-500 ring-2 ring-rose-500/30 bg-rose-500/5"
                                  : "border-border-default focus:ring-2 focus:ring-[#3B82F6]/50 focus:border-[#3B82F6]"
                              }`}
                            />
                            {(fieldErrors.endereco_cidade || fieldErrors.cidade) && (
                              <p className="text-[11px] text-rose-500 flex items-center gap-1 mt-1 font-medium">
                                <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                                {fieldErrors.endereco_cidade || fieldErrors.cidade}
                              </p>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Section: Sistema */}
                      <div className={`bg-bg-subtle/50 p-6 rounded-2xl border border-border-default/50 space-y-6 ${activeSubTab === "sistema" ? "block animate-in fade-in slide-in-from-bottom-2" : "hidden"}`}>
                        <div className="flex items-center gap-3 border-b border-border-default/50 pb-4">
                          <div className="p-2 bg-purple-500/10 rounded-xl text-purple-400">
                            <ShieldCheck className="w-5 h-5" />
                          </div>
                          <h4 className="text-lg font-bold text-text-base tracking-tight">
                            Informações do Sistema
                          </h4>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                          <div className="space-y-1">
                            <label className="block text-sm font-semibold text-text-muted uppercase tracking-wider mb-1">
                              Data de Adesão *
                            </label>
                            <input
                              type="date"
                              value={editingAssociado.data_adesao || ""}
                              onChange={(e) => handleFieldChange("data_adesao", e.target.value)}
                              className={`w-full px-4 py-2.5 bg-bg-surface border rounded-xl text-text-base focus:outline-none transition-all ${
                                fieldErrors.data_adesao
                                  ? "border-rose-500 ring-2 ring-rose-500/30 bg-rose-500/5"
                                  : "border-border-default focus:ring-2 focus:ring-[#3B82F6]/50 focus:border-[#3B82F6]"
                              }`}
                            />
                            {fieldErrors.data_adesao && (
                              <p className="text-xs text-rose-500 flex items-center gap-1 mt-1 font-medium">
                                <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                                {fieldErrors.data_adesao}
                              </p>
                            )}
                          </div>

                          <div className="space-y-1">
                            <label className="block text-sm font-semibold text-text-muted uppercase tracking-wider mb-1">
                              Status *
                            </label>
                            <select
                              value={editingAssociado.status || "ativo"}
                              onChange={(e) => handleFieldChange("status", e.target.value as Associado["status"])}
                              className="w-full px-4 py-2.5 bg-bg-surface border border-border-default rounded-xl text-text-base focus:outline-none focus:ring-2 focus:ring-[#3B82F6]/50 focus:border-[#3B82F6] transition-all"
                            >
                              <option value="ativo">Ativo</option>
                              <option value="inadimplente">Inadimplente</option>
                              <option value="inativo">Inativo</option>
                            </select>
                          </div>
                        </div>
                      </div>
                      </div>
                    </div>
                  ) : activeTab === "dependentes" ? (
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
                          <button
                            type="button"
                            onClick={() => {
                              setDependenteEmEdicao(null);
                              setDependenteFormModalOpen(true);
                            }}
                            className="inline-flex items-center gap-2 px-4 py-2 bg-[#3B82F6] hover:bg-blue-600 text-white rounded-xl text-xs sm:text-sm font-semibold transition-all shadow-lg shadow-blue-500/20 shrink-0 active:scale-95"
                          >
                            <Plus className="w-4 h-4" />
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
                              .filter((dep) => {
                                if (!buscaDependenteInterno) return true;
                                const s = buscaDependenteInterno.toLowerCase();
                                const sDigits = s.replace(/\D/g, "");
                                return (
                                  dep.nome.toLowerCase().includes(s) ||
                                  (dep.parentesco && dep.parentesco.toLowerCase().includes(s)) ||
                                  (dep.cpf && dep.cpf.replace(/\D/g, "").includes(sDigits))
                                );
                              })
                              .map((dep, index) => {
                                const initials = (dep.nome || "D")
                                  .split(" ")
                                  .filter(Boolean)
                                  .slice(0, 2)
                                  .map((p) => p[0])
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
                                                try {
                                                  const d = new Date(dep.data_nascimento);
                                                  if (!isNaN(d.getTime())) {
                                                    const age = new Date().getFullYear() - d.getFullYear();
                                                    return age >= 0 ? (
                                                      <span className="text-[10px] text-blue-400 font-bold bg-blue-500/10 px-1.5 py-0.5 rounded border border-blue-500/20">
                                                        {age}a
                                                      </span>
                                                    ) : null;
                                                  }
                                                } catch {}
                                                return null;
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
                  ) : activeTab === "contratos" ? (
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
                              <label className="block text-xs font-medium text-text-subtle mb-1">Empresa / Convenio (Fornecedor) *</label>
                              <select 
                                value={editingAssociado.fornecedor_id || ''}
                                onChange={(e) => setEditingAssociado({ ...editingAssociado, fornecedor_id: e.target.value })}
                                required
                                className="w-full bg-bg-base border border-border-default rounded-xl px-4 py-2.5 text-sm text-text-base focus:ring-2 focus:ring-[#3B82F6] focus:border-transparent outline-none transition-all"
                              >
                                <option value="">Selecione a empresa conveniada</option>
                                {fornecedores.filter(f => f.categoria === 'Convenios Associados' && f.status === 'ativo').map(f => (
                                  <option key={f.id} value={f.id}>{f.razao_social || f.nome_fantasia}</option>
                                ))}
                              </select>
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
                          {editingAssociado.historico_contratos?.map(hist => (
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
                                    {editingAssociado.plano_pax_id ? planos.find(p => p.id === editingAssociado.plano_pax_id)?.nome || editingAssociado.plano_nome : editingAssociado.plano_nome || "Nenhum Plano Selecionado"}
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
                            
                            {!editingAssociado.plano_pax_id ? (
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
                                  (hist) => (
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
                                 const hist = editingAssociado.historico_contratos?.find(h => h.id === selectedContratoId);
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
                  ) : activeTab === "mensalidades" ? (
                    <MensalidadesTab associado={editingAssociado} onSuccess={!isEditingMode ? () => setActiveTab("documentos") : undefined} />
                  ) : activeTab === "requisicoes" ? (
                    <AssociadoRequisicoesTab associado={editingAssociado} />
                  ) : activeTab === "atendimentos" ? (
                    <AssociadoAtendimentosTab associado={editingAssociado} />
                  ) : activeTab === "documentos" ? (
                    <div className="space-y-6">
                      <div className="flex items-center justify-between border-b border-border-default pb-4">
                        <div>
                          <h4 className="text-text-base font-semibold text-base">
                            Documentos do Associado
                          </h4>
                          <p className="text-xs text-text-subtle mt-0.5">
                            Gere modelos de documentos ou anexe contratos assinados, documentos pessoais e comprovantes.
                          </p>
                        </div>
                      </div>
                      
                      <div className="bg-bg-subtle p-6 rounded-2xl border border-border-default/50 mb-6">
                        <ContratoDocumentosGenerator associado={editingAssociado} valorMensalidade={valorPlanoAtivo} />
                      </div>

                      <div className="space-y-4">
                        <div
                          onDragOver={(e) => {
                            e.preventDefault();
                            setIsDraggingDoc(true);
                          }}
                          onDragLeave={() => setIsDraggingDoc(false)}
                          onDrop={async (e) => {
                            e.preventDefault();
                            setIsDraggingDoc(false);
                            const file = e.dataTransfer.files?.[0];
                            if (file) {
                              try {
                                setIsUploadingDoc(true);
                                const novoDoc = await uploadDocumentoAssociado(file, editingAssociado.id, state.isOnline);
                                setEditingAssociado({
                                  ...editingAssociado,
                                  documentos: [
                                    ...(editingAssociado.documentos || []),
                                    novoDoc,
                                  ],
                                });
                                toast.success("Documento anexado com sucesso!");
                              } catch (err: any) {
                                toast.error(err.message || "Falha ao anexar documento.");
                              } finally {
                                setIsUploadingDoc(false);
                              }
                            }
                          }}
                          className={`border-2 border-dashed rounded-2xl p-8 flex flex-col items-center justify-center transition-all ${
                            isDraggingDoc 
                              ? 'border-[#3B82F6] bg-[#3B82F6]/10 scale-[1.01]' 
                              : 'border-border-default hover:border-[#3B82F6]/50 bg-bg-surface/50'
                          }`}
                        >
                          <input
                            type="file"
                            id="upload-doc"
                            className="hidden"
                            accept=".pdf,image/*"
                            disabled={isUploadingDoc}
                            onChange={async (e) => {
                              const file = e.target.files?.[0];
                              if (file) {
                                try {
                                  setIsUploadingDoc(true);
                                  const novoDoc = await uploadDocumentoAssociado(file, editingAssociado.id, state.isOnline);
                                  setEditingAssociado({
                                    ...editingAssociado,
                                    documentos: [
                                      ...(editingAssociado.documentos || []),
                                      novoDoc,
                                    ],
                                  });
                                  toast.success("Documento anexado com sucesso!");
                                } catch (err: any) {
                                  toast.error(err.message || "Falha ao anexar documento.");
                                } finally {
                                  setIsUploadingDoc(false);
                                  e.target.value = "";
                                }
                              }
                            }}
                          />
                          <label
                            htmlFor="upload-doc"
                            className="cursor-pointer flex flex-col items-center group w-full"
                          >
                            <div className="w-14 h-14 bg-bg-hover group-hover:bg-[#3B82F6]/10 rounded-2xl flex items-center justify-center mb-3 transition-colors">
                              {isUploadingDoc ? (
                                <div className="w-6 h-6 border-2 border-[#3B82F6] border-t-transparent rounded-full animate-spin"></div>
                              ) : (
                                <UploadCloud className="w-7 h-7 text-[#3B82F6] group-hover:scale-110 transition-transform" />
                              )}
                            </div>
                            <p className="text-sm font-semibold text-text-base mb-1 text-center">
                              {isUploadingDoc ? "Processando e anexando arquivo..." : "Clique para enviar ou arraste um documento aqui"}
                            </p>
                            <p className="text-xs text-text-subtle text-center">
                              Suporta PDF, JPG, PNG e WebP (máx. 10MB)
                            </p>
                          </label>
                        </div>

                        {editingAssociado.documentos &&
                          editingAssociado.documentos.length > 0 && (
                            <div className="space-y-3 mt-6">
                              <div className="flex items-center justify-between">
                                <h5 className="text-sm font-semibold text-text-subtle flex items-center gap-2">
                                  <FileText className="w-4 h-4 text-[#3B82F6]" />
                                  <span>Arquivos Salvos ({editingAssociado.documentos.length})</span>
                                </h5>
                              </div>

                              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                {editingAssociado.documentos.map((doc, idx) => {
                                  const isPdf = isPdfDocument(doc);
                                  const isImg = isImageDocument(doc);
                                  const isLegacyBlob = doc.url && doc.url.startsWith("blob:");

                                  return (
                                    <div
                                      key={doc.id || idx}
                                      className="flex items-center justify-between p-3.5 bg-bg-surface hover:bg-bg-subtle/80 border border-border-default rounded-xl transition-all group"
                                    >
                                      <div 
                                        onClick={() => setDocumentoVisualizando(doc)}
                                        className="flex items-center gap-3 overflow-hidden cursor-pointer flex-1 mr-2"
                                      >
                                        <div className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 font-bold text-xs ${
                                          isPdf 
                                            ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20' 
                                            : isImg 
                                            ? 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/20' 
                                            : 'bg-bg-subtle text-text-subtle border border-border-default'
                                        }`}>
                                          {isPdf ? (
                                            <FileText className="w-5 h-5" />
                                          ) : isImg ? (
                                            <ImageIcon className="w-5 h-5" />
                                          ) : (
                                            <span className="uppercase">{doc.nome.split(".").pop()?.substring(0, 3)}</span>
                                          )}
                                        </div>
                                        <div className="overflow-hidden">
                                          <p className="text-sm text-text-base font-medium truncate group-hover:text-[#3B82F6] transition-colors" title={doc.nome}>
                                            {doc.nome}
                                          </p>
                                          <div className="flex items-center gap-2 mt-0.5">
                                            <p className="text-xs text-text-subtle">
                                              {doc.tamanho ? `${(doc.tamanho / 1024).toFixed(1)} KB` : 'Anexo'}
                                              {doc.data_upload && (
                                                <> • {new Date(doc.data_upload).toLocaleDateString("pt-BR")}</>
                                              )}
                                            </p>
                                            {isLegacyBlob && (
                                              <span className="inline-flex items-center gap-1 text-[10px] bg-amber-500/10 text-amber-400 px-1.5 py-0.5 rounded border border-amber-500/20 font-medium" title="Arquivo anexado em sessão anterior. Reenvie para visualização permanente.">
                                                <AlertTriangle className="w-2.5 h-2.5" /> Reenvio sugerido
                                              </span>
                                            )}
                                          </div>
                                        </div>
                                      </div>
                                      
                                      <div className="flex items-center gap-1 shrink-0">
                                        <button
                                          type="button"
                                          onClick={() => setDocumentoVisualizando(doc)}
                                          title="Visualizar documento"
                                          className="p-2 text-text-subtle hover:text-[#3B82F6] hover:bg-bg-hover rounded-xl transition-colors"
                                        >
                                          <Eye className="w-4 h-4" />
                                        </button>
                                        <button
                                          type="button"
                                          onClick={async () => {
                                            const success = await downloadDocumento(doc);
                                            if (!success) toast.error("Não foi possível baixar este arquivo.");
                                            else toast.success("Download iniciado!");
                                          }}
                                          title="Baixar arquivo"
                                          className="p-2 text-text-subtle hover:text-emerald-400 hover:bg-bg-hover rounded-xl transition-colors"
                                        >
                                          <Download className="w-4 h-4" />
                                        </button>
                                        <button
                                          type="button"
                                          onClick={() => {
                                            const novosDocs = [
                                              ...editingAssociado.documentos!,
                                            ];
                                            novosDocs.splice(idx, 1);
                                            setEditingAssociado({
                                              ...editingAssociado,
                                              documentos: novosDocs,
                                            });
                                            toast.success("Documento removido da lista.");
                                          }}
                                          title="Excluir anexo"
                                          className="p-2 text-text-subtle hover:text-rose-500 hover:bg-bg-hover rounded-xl transition-colors"
                                        >
                                          <Trash2 className="w-4 h-4" />
                                        </button>
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          )}
                      </div>
                    </div>
                  ) : null}
                </div>

                {/* Footer Buttons */}
                <div className="p-6 border-t border-border-default bg-bg-surface/50 flex items-center justify-between shrink-0">
                  <button
                    type="button"
                    onClick={handleCloseModal}
                    className="px-4 py-2 bg-bg-hover border border-[#64748B] text-text-muted rounded-xl font-medium hover:bg-[#64748B] hover:text-text-base transition-colors"
                  >
                    Cancelar
                  </button>
                  <div className="flex gap-3">
                    {isEditingMode ? (
                      <BotaoSalvar
                        type="submit"
                        salvando={isSavingAssociado}
                        salvo={isSavedAssociado}
                        disabled={!state.isOnline}
                        texto="Salvar Alterações"
                        textoSalvando="Salvando Alterações..."
                        textoSalvo="Alterações Salvas!"
                        variante="primary"
                      />
                    ) : (
                      <>
                        {activeTab !== "principal" && (
                          <button
                            type="button"
                            onClick={() => {
                              if (activeTab === "atendimentos")
                                setActiveTab("requisicoes");
                              else if (activeTab === "requisicoes")
                                setActiveTab("documentos");
                              else if (activeTab === "documentos")
                                setActiveTab("mensalidades");
                              else if (activeTab === "mensalidades")
                                setActiveTab("contratos");
                              else if (activeTab === "contratos")
                                setActiveTab("dependentes");
                              else if (activeTab === "dependentes")
                                setActiveTab("principal");
                            }}
                            className="px-4 py-2 bg-bg-hover border border-[#64748B] text-text-muted rounded-xl font-medium hover:bg-[#64748B] hover:text-text-base transition-colors"
                          >
                            Voltar
                          </button>
                        )}

                        {(isEditingMode ? activeTab !== "atendimentos" : activeTab !== "documentos") ? (
                          <button
                            key="btn-next"
                            type="button"
                            onClick={() => {
                              if (activeTab === "principal") {
                                if (!executarValidacaoOuAlertar()) return;
                                setActiveTab("dependentes");
                              } else if (activeTab === "dependentes")
                                setActiveTab("contratos");
                              else if (activeTab === "contratos")
                                setActiveTab("mensalidades");
                              else if (activeTab === "mensalidades")
                                setActiveTab("documentos");
                              else if (activeTab === "documentos")
                                setActiveTab("requisicoes");
                              else if (activeTab === "requisicoes")
                                setActiveTab("atendimentos");
                            }}
                            className="px-4 py-2 bg-gradient-to-r from-[#3B82F6] to-[#60A5FA] text-white rounded-xl font-medium hover:opacity-90 transition-opacity shadow-lg shadow-[#3B82F6]/25"
                          >
                            Próximo
                          </button>
                        ) : (
                          <BotaoSalvar
                            key="btn-submit"
                            type="submit"
                            salvando={isSavingAssociado}
                            salvo={isSavedAssociado}
                            disabled={!state.isOnline}
                            texto="Finalizar Cadastro"
                            textoSalvando="Gravando Associado..."
                            textoSalvo="Cadastro Concluído!"
                            variante="emerald"
                          />
                        )}
                      </>
                    )}
                  </div>
                </div>
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
                        dependentesFiltrados.map((d, index) => {
                          const assoc = associados.find(a => 
                            (a.nome && d.titular_nome && a.nome.trim().toLowerCase() === d.titular_nome.trim().toLowerCase()) ||
                            (a.dependentes && a.dependentes.some(dep => dep.id === d.id))
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
                onClick={handleExportDependentesPDF}
                className="flex items-center gap-2 px-6 py-2 bg-bg-surface border border-border-default text-text-subtle text-sm font-semibold rounded-xl hover:text-text-base hover:bg-bg-hover transition-colors"
                title="Gerar relatório em PDF"
              >
                <Printer className="w-4 h-4" />
                <span>Gerar Relatório</span>
              </button>
              <button
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
                      onClick={() => setShowModificarPlanoModal(false)}
                      className="px-6 py-2.5 bg-bg-subtle border border-border-default text-text-base rounded-xl font-medium hover:bg-bg-hover transition-colors"
                    >
                      Cancelar
                    </button>
                    <button
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
                      onClick={() => setModificarPlanoStep("confirmar")}
                      className="px-6 py-2.5 bg-bg-subtle border border-border-default text-text-base rounded-xl font-medium hover:bg-bg-hover transition-colors"
                    >
                      Voltar
                    </button>
                    <button
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
                      idadesDependentes={editingAssociado?.dependentes?.filter(d => d.data_nascimento).map(d => {
                        const ageDifMs = Date.now() - new Date(d.data_nascimento!).getTime();
                        const ageDate = new Date(ageDifMs);
                        return Math.abs(ageDate.getUTCFullYear() - 1970);
                      }) || []}
                    />
                  </div>
                  
                  <div className="flex justify-end gap-4 pt-6 mt-4 border-t border-border-default">
                    <button
                      onClick={() => setModificarPlanoStep("justificativa")}
                      className="px-6 py-2.5 bg-bg-subtle border border-border-default text-text-base rounded-xl font-medium hover:bg-bg-hover transition-colors"
                    >
                      Voltar
                    </button>
                    <button
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
          existingCpfs={(editingAssociado.dependentes || []).map((d) => d.cpf || "").filter(Boolean)}
          onDelete={handleExcluirDependente}
          onSave={(salvoDep) => {
            setEditingAssociado(prev => {
              if (!prev) return null;
              const deps = prev.dependentes ? [...prev.dependentes] : [];
              const index = deps.findIndex((d) => d.id === salvoDep.id);
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
          planoFilter
        }}
        userName={state.user?.nome || 'Administrador'}
        initialReportType={relatorioReportType}
      />
    </>
  );
};
