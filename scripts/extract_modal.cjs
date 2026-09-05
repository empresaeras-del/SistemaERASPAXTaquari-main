const fs = require('fs');

const content = fs.readFileSync('src/pages/Associados.tsx', 'utf-8');
const lines = content.split('\n');

let startIdx = lines.findIndex(l => l.includes('{isModalOpen && editingAssociado && ('));
let endIdx = lines.findIndex(l => l.includes('export default AssociadosPage;')) - 3; 

if (startIdx !== -1 && endIdx !== -1) {
    const modalContent = lines.slice(startIdx, endIdx).join('\n');
    const finalContent = `import React from 'react';
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
${modalContent}
    </>
  );
};
`;
    fs.writeFileSync('src/components/associados/AssociadoFormModal.tsx', finalContent);
    console.log('AssociadoFormModal extracted.');
} else {
    console.log('Could not find start or end index.');
}
